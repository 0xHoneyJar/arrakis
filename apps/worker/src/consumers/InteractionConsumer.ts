import amqp, { type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';
import type { DiscordEventPayload, ConsumeResult } from '../types.js';
import { extractCommandName, isInteractionEvent } from '../types.js';
import {
  getCommandHandler,
  defaultCommandHandler,
} from '../handlers/index.js';
import type { DiscordRestService } from '../services/DiscordRest.js';
import type { StateManager } from '../services/StateManager.js';
import type { ConsumerStatus } from '../health.js';

/**
 * InteractionConsumer processes interaction events (slash commands, buttons, modals)
 * from the priority queue and responds via Discord REST API.
 *
 * Key responsibilities:
 * 1. Consume from priority queue (arrakis.interactions)
 * 2. Defer response immediately (within 3s Discord timeout)
 * 3. Route to appropriate command handler
 * 4. Send followup response
 * 5. Acknowledge or reject message
 */
export class InteractionConsumer {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerTag: string | null = null;
  private readonly log: Logger;

  // Stats tracking
  private messagesProcessed = 0;
  private messagesErrored = 0;

  constructor(
    private readonly rabbitmqUrl: string,
    private readonly queueName: string,
    private readonly prefetch: number,
    private readonly discordRest: DiscordRestService,
    private readonly stateManager: StateManager,
    logger: Logger
  ) {
    this.log = logger.child({ component: 'InteractionConsumer' });
  }

  /**
   * Connect to RabbitMQ
   */
  async connect(): Promise<void> {
    this.log.info('Connecting to RabbitMQ');

    this.connection = await amqp.connect(this.rabbitmqUrl, {
      heartbeat: 30,
    });

    this.connection.on('error', (error) => {
      this.log.error({ error }, 'RabbitMQ connection error');
    });

    this.connection.on('close', () => {
      this.log.warn('RabbitMQ connection closed');
      this.scheduleReconnect();
    });

    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(this.prefetch);

    this.channel.on('error', (error) => {
      this.log.error({ error }, 'RabbitMQ channel error');
    });

    this.channel.on('close', () => {
      this.log.warn('RabbitMQ channel closed');
    });

    this.log.info({ queue: this.queueName, prefetch: this.prefetch }, 'Connected to RabbitMQ');
  }

  /**
   * Start consuming messages from the queue
   */
  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    this.log.info({ queue: this.queueName }, 'Starting to consume messages');

    const { consumerTag } = await this.channel.consume(
      this.queueName,
      async (msg) => {
        if (!msg) {
          return;
        }

        const startTime = Date.now();
        let payload: DiscordEventPayload | null = null;

        try {
          payload = JSON.parse(msg.content.toString()) as DiscordEventPayload;

          this.log.debug(
            {
              eventId: payload.eventId,
              eventType: payload.eventType,
              guildId: payload.guildId,
            },
            'Received interaction message'
          );

          const result = await this.processInteraction(payload);

          switch (result) {
            case 'ack':
              this.channel?.ack(msg);
              this.messagesProcessed++;
              break;
            case 'nack':
              // Permanent failure - send to DLQ
              this.channel?.nack(msg, false, false);
              this.messagesErrored++;
              break;
            case 'nack-requeue':
              // Transient failure - requeue for retry
              this.channel?.nack(msg, false, true);
              break;
          }

          const duration = Date.now() - startTime;
          this.log.info(
            {
              eventId: payload.eventId,
              result,
              durationMs: duration,
            },
            'Processed interaction'
          );
        } catch (error) {
          this.messagesErrored++;
          this.log.error(
            {
              error,
              eventId: payload?.eventId,
              // Note: Raw message content not logged to prevent token exposure (MED-1)
            },
            'Error processing interaction message'
          );

          // Parse error - don't requeue (would fail again)
          this.channel?.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    this.consumerTag = consumerTag;
    this.log.info({ consumerTag }, 'Consumer started');
  }

  /**
   * Process a single interaction event
   */
  private async processInteraction(payload: DiscordEventPayload): Promise<ConsumeResult> {
    // Validate this is an interaction event
    if (!isInteractionEvent(payload.eventType)) {
      this.log.warn(
        { eventType: payload.eventType },
        'Non-interaction event received on interaction queue'
      );
      return 'ack'; // Acknowledge to prevent blocking
    }

    // Must have interaction token for responses
    if (!payload.interactionId || !payload.interactionToken) {
      this.log.error(
        { eventId: payload.eventId },
        'Interaction missing interactionId or token'
      );
      return 'nack'; // Permanent failure
    }

    // Step 1: Defer response immediately
    const deferResult = await this.discordRest.deferReply(
      payload.interactionId,
      payload.interactionToken
    );

    if (!deferResult.success) {
      this.log.warn(
        {
          eventId: payload.eventId,
          error: deferResult.error,
        },
        'Failed to defer interaction response'
      );
      // Token may have expired (>3s) - permanent failure
      return 'nack';
    }

    // Step 2: Route to handler
    const commandName = extractCommandName(payload.eventType);
    const handler = commandName
      ? getCommandHandler(commandName) ?? defaultCommandHandler
      : defaultCommandHandler;

    try {
      const result = await handler(payload, this.log);

      // Step 3: Send followup if handler succeeded
      // Note: Handlers are responsible for sending their own followups
      // This is just the message acknowledgment result

      return result;
    } catch (error) {
      this.log.error(
        {
          error,
          eventId: payload.eventId,
          commandName,
        },
        'Handler threw an error'
      );

      // Try to send error followup
      await this.discordRest.sendFollowup(
        payload.interactionToken,
        {
          content: '❌ An error occurred while processing your request.',
          flags: 64, // Ephemeral
        }
      );

      // Handler errors are usually transient - requeue once
      // If it's in the DLQ, we'll know there's a persistent issue
      return 'nack';
    }
  }

  /**
   * Stop consuming messages (graceful shutdown)
   */
  async stopConsuming(): Promise<void> {
    if (this.channel && this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
      this.consumerTag = null;
      this.log.info('Stopped consuming messages');
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    this.log.info('Connection closed');
  }

  /**
   * Get consumer status for health checks
   */
  getStatus(): ConsumerStatus {
    return {
      connected: this.connection !== null && this.channel !== null,
      consuming: this.consumerTag !== null,
      messagesProcessed: this.messagesProcessed,
      messagesErrored: this.messagesErrored,
    };
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.log.info('Scheduling reconnection in 5s');
    setTimeout(async () => {
      try {
        await this.connect();
        if (this.consumerTag === null) {
          await this.startConsuming();
        }
      } catch (error) {
        this.log.error({ error }, 'Reconnection failed, will retry');
        this.scheduleReconnect();
      }
    }, 5000);
  }
}

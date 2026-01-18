import amqp, { type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';
import type { DiscordEventPayload, ConsumeResult } from '../types.js';
import { isMemberEvent, isGuildEvent } from '../types.js';
import { getEventHandler, defaultEventHandler } from '../handlers/index.js';
import type { StateManager } from '../services/StateManager.js';
import type { ConsumerStatus } from '../health.js';

/**
 * EventConsumer processes guild/member events from the normal queue.
 * These are background events that don't require immediate user responses.
 *
 * Key responsibilities:
 * 1. Consume from event queue (arrakis.events.guild)
 * 2. Route to appropriate event handler
 * 3. Handle idempotency (duplicate event detection)
 * 4. Acknowledge or reject message
 */
export class EventConsumer {
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
    private readonly stateManager: StateManager,
    logger: Logger
  ) {
    this.log = logger.child({ component: 'EventConsumer' });
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
            'Received event message'
          );

          const result = await this.processEvent(payload);

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
              eventType: payload.eventType,
              result,
              durationMs: duration,
            },
            'Processed event'
          );
        } catch (error) {
          this.messagesErrored++;
          this.log.error(
            {
              error,
              eventId: payload?.eventId,
              raw: msg.content.toString().slice(0, 200),
            },
            'Error processing event message'
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
   * Process a single event
   */
  private async processEvent(payload: DiscordEventPayload): Promise<ConsumeResult> {
    // Validate this is a guild/member event
    if (!isMemberEvent(payload.eventType) && !isGuildEvent(payload.eventType)) {
      // Message events are low priority - just ack them for now
      if (payload.eventType === 'message.create') {
        this.log.debug({ eventId: payload.eventId }, 'Skipping message event (not implemented)');
        return 'ack';
      }

      this.log.warn(
        { eventType: payload.eventType },
        'Unexpected event type on event queue'
      );
      return 'ack';
    }

    // Check for duplicate processing (idempotency)
    const isProcessed = await this.checkIdempotency(payload.eventId);
    if (isProcessed) {
      this.log.debug(
        { eventId: payload.eventId },
        'Event already processed, skipping'
      );
      return 'ack';
    }

    // Get handler for event type
    const handler = getEventHandler(payload.eventType) ?? defaultEventHandler;

    try {
      const result = await handler(payload, this.log);

      // Mark as processed on success
      if (result === 'ack') {
        await this.markProcessed(payload.eventId);
      }

      return result;
    } catch (error) {
      this.log.error(
        {
          error,
          eventId: payload.eventId,
          eventType: payload.eventType,
        },
        'Handler threw an error'
      );

      // Event handler errors are usually transient - requeue once
      return 'nack-requeue';
    }
  }

  /**
   * Check if event has already been processed (idempotency)
   * Uses Redis SET with TTL to track processed event IDs
   */
  private async checkIdempotency(eventId: string): Promise<boolean> {
    try {
      const key = `event:processed:${eventId}`;
      const exists = await this.stateManager.exists(key);
      return exists;
    } catch (error) {
      // Redis error - assume not processed to avoid data loss
      this.log.warn({ error, eventId }, 'Failed to check idempotency, assuming not processed');
      return false;
    }
  }

  /**
   * Mark event as processed
   * TTL: 24 hours (events won't be replayed after this)
   */
  private async markProcessed(eventId: string): Promise<void> {
    try {
      const key = `event:processed:${eventId}`;
      const ttlMs = 24 * 60 * 60 * 1000; // 24 hours
      await this.stateManager.set(key, '1', ttlMs);
    } catch (error) {
      // Non-fatal - duplicate processing is acceptable
      this.log.warn({ error, eventId }, 'Failed to mark event as processed');
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

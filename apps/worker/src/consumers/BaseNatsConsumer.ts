/**
 * Base NATS Consumer for Arrakis Workers
 * Sprint S-5: NATS JetStream Deployment
 *
 * Abstract base class for NATS JetStream consumers per SDD §5.2.2
 */

import {
  JetStreamClient,
  JetStreamManager,
  StringCodec,
  Consumer,
  ConsumerMessages,
  JsMsg,
  AckPolicy,
  DeliverPolicy,
} from 'nats';
import type { Logger } from 'pino';
import { Counter, Histogram, Gauge } from 'prom-client';

// --------------------------------------------------------------------------
// Metrics
// --------------------------------------------------------------------------

const messagesProcessed = new Counter({
  name: 'nats_consumer_messages_processed_total',
  help: 'Total number of messages processed',
  labelNames: ['consumer', 'status'],
});

const messageProcessingDuration = new Histogram({
  name: 'nats_consumer_message_processing_duration_seconds',
  help: 'Message processing duration in seconds',
  labelNames: ['consumer'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const consumerLag = new Gauge({
  name: 'nats_consumer_lag',
  help: 'Number of pending messages for consumer',
  labelNames: ['consumer'],
});

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface BaseConsumerConfig {
  streamName: string;
  consumerName: string;
  filterSubjects: string[];
  maxAckPending?: number;
  ackWait?: number; // milliseconds
  maxDeliver?: number;
  batchSize?: number;
}

export interface ProcessResult {
  success: boolean;
  retryable?: boolean;
  error?: Error;
}

// --------------------------------------------------------------------------
// Base Consumer
// --------------------------------------------------------------------------

export abstract class BaseNatsConsumer<T> {
  protected readonly log: Logger;
  protected readonly config: BaseConsumerConfig;
  protected readonly codec = StringCodec();

  private consumer: Consumer | null = null;
  private messages: ConsumerMessages | null = null;
  private isRunning = false;
  private messagesProcessedCount = 0;
  private messagesErroredCount = 0;

  constructor(config: BaseConsumerConfig, logger: Logger) {
    this.config = {
      maxAckPending: 100,
      ackWait: 30_000,
      maxDeliver: 3,
      batchSize: 10,
      ...config,
    };
    this.log = logger.child({
      component: this.constructor.name,
      consumer: config.consumerName,
    });
  }

  /**
   * Initialize consumer (ensure it exists in NATS)
   */
  async initialize(jsm: JetStreamManager): Promise<void> {
    try {
      await jsm.consumers.info(this.config.streamName, this.config.consumerName);
      this.log.debug('Consumer already exists');
    } catch {
      this.log.info('Creating consumer');

      await jsm.consumers.add(this.config.streamName, {
        durable_name: this.config.consumerName,
        filter_subjects: this.config.filterSubjects,
        ack_policy: AckPolicy.Explicit,
        max_ack_pending: this.config.maxAckPending,
        ack_wait: this.config.ackWait! * 1_000_000, // Convert to nanoseconds
        max_deliver: this.config.maxDeliver,
        deliver_policy: DeliverPolicy.All,
      });

      this.log.info('Consumer created');
    }
  }

  /**
   * Start consuming messages
   */
  async start(js: JetStreamClient): Promise<void> {
    if (this.isRunning) {
      this.log.warn('Consumer already running');
      return;
    }

    this.consumer = await js.consumers.get(
      this.config.streamName,
      this.config.consumerName
    );

    this.messages = await this.consumer.consume({
      max_messages: this.config.batchSize,
    });

    this.isRunning = true;
    this.log.info('Started consuming messages');

    // Process messages
    this.processMessages().catch((error) => {
      this.log.error({ error }, 'Message processing loop error');
      this.isRunning = false;
    });
  }

  /**
   * Message processing loop
   */
  private async processMessages(): Promise<void> {
    if (!this.messages) {
      throw new Error('Consumer not started');
    }

    for await (const msg of this.messages) {
      if (!this.isRunning) {
        break;
      }

      const startTime = Date.now();

      try {
        const payload = this.parseMessage(msg);
        const result = await this.processMessage(payload, msg);

        if (result.success) {
          msg.ack();
          this.messagesProcessedCount++;
          messagesProcessed.inc({ consumer: this.config.consumerName, status: 'success' });
        } else if (result.retryable) {
          // Negative ack with delay for retryable errors
          msg.nak(5000);
          messagesProcessed.inc({ consumer: this.config.consumerName, status: 'retry' });
          this.log.warn(
            { subject: msg.subject, error: result.error?.message },
            'Message processing failed (will retry)'
          );
        } else {
          // Terminal failure - ack to prevent retry
          msg.term();
          this.messagesErroredCount++;
          messagesProcessed.inc({ consumer: this.config.consumerName, status: 'failed' });
          this.log.error(
            { subject: msg.subject, error: result.error?.message },
            'Message processing failed (terminal)'
          );
        }
      } catch (error) {
        // Unexpected error - treat as retryable
        this.messagesErroredCount++;
        messagesProcessed.inc({ consumer: this.config.consumerName, status: 'error' });
        msg.nak(10000);

        this.log.error(
          { error, subject: msg.subject },
          'Unexpected error processing message'
        );
      }

      const duration = (Date.now() - startTime) / 1000;
      messageProcessingDuration.observe(
        { consumer: this.config.consumerName },
        duration
      );
    }
  }

  /**
   * Parse message payload
   */
  private parseMessage(msg: JsMsg): T {
    const data = this.codec.decode(msg.data);
    return JSON.parse(data) as T;
  }

  /**
   * Process a single message - implement in subclass
   */
  abstract processMessage(payload: T, msg: JsMsg): Promise<ProcessResult>;

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.messages) {
      this.messages.stop();
      this.messages = null;
    }

    this.consumer = null;
    this.log.info('Consumer stopped');
  }

  /**
   * Get consumer statistics
   */
  getStats(): { processed: number; errored: number; running: boolean } {
    return {
      processed: this.messagesProcessedCount,
      errored: this.messagesErroredCount,
      running: this.isRunning,
    };
  }

  /**
   * Update lag metric (call periodically)
   */
  async updateLagMetric(jsm: JetStreamManager): Promise<void> {
    try {
      const info = await jsm.consumers.info(
        this.config.streamName,
        this.config.consumerName
      );
      consumerLag.set({ consumer: this.config.consumerName }, info.num_pending);
    } catch (error) {
      this.log.warn({ error }, 'Failed to update lag metric');
    }
  }
}

// --------------------------------------------------------------------------
// Helper type for consumer factories
// --------------------------------------------------------------------------

export type ConsumerFactory<T> = (
  config: BaseConsumerConfig,
  logger: Logger
) => BaseNatsConsumer<T>;

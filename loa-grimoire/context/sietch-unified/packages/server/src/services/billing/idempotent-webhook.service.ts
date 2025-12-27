/**
 * =============================================================================
 * SIETCH UNIFIED - IDEMPOTENT WEBHOOK HANDLER
 * =============================================================================
 * 
 * Enterprise-grade webhook handling with:
 * - Idempotency keys to prevent duplicate processing
 * - Event deduplication via Redis
 * - Retry tracking with exponential backoff
 * - Dead letter queue for failed events
 * 
 * ENTERPRISE STANDARD: Stripe best practices for webhook idempotency.
 * 
 * @module services/billing/idempotent-webhook.service
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import Stripe from 'stripe';
import { getObservability } from '../observability/observability.service';

// =============================================================================
// TYPES
// =============================================================================

export interface WebhookEvent {
  id: string;
  type: string;
  payload: Stripe.Event;
  receivedAt: Date;
  processedAt?: Date;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  error?: string;
}

export interface IdempotencyConfig {
  deduplicationWindowSeconds: number;  // How long to remember processed events
  maxRetries: number;
  retryBackoffMs: number[];            // Exponential backoff intervals
  deadLetterAfterRetries: number;
  dlqRetentionDays: number;            // How long to keep DLQ entries
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: IdempotencyConfig = {
  deduplicationWindowSeconds: 86400,    // 24 hours
  maxRetries: 3,
  retryBackoffMs: [1000, 5000, 30000, 120000, 600000],  // 1s, 5s, 30s, 2m, 10m
  deadLetterAfterRetries: 5,
  dlqRetentionDays: 7,
};

// =============================================================================
// IDEMPOTENT WEBHOOK SERVICE
// =============================================================================

export class IdempotentWebhookService {
  private redis: Redis;
  private prisma: PrismaClient;
  private config: IdempotencyConfig;
  private obs = getObservability();
  private handlers: Map<string, (event: Stripe.Event) => Promise<void>> = new Map();

  private readonly PROCESSED_PREFIX = 'webhook:processed:';
  private readonly LOCK_PREFIX = 'webhook:lock:';
  private readonly DLQ_PREFIX = 'webhook:dlq:';
  private readonly RETRY_PREFIX = 'webhook:retry:';
  private readonly LOCK_TTL = 30000; // 30 seconds

  constructor(params: {
    redis: Redis;
    prisma: PrismaClient;
    config?: Partial<IdempotencyConfig>;
  }) {
    this.redis = params.redis;
    this.prisma = params.prisma;
    this.config = { ...DEFAULT_CONFIG, ...params.config };
  }

  // ===========================================================================
  // HANDLER REGISTRATION
  // ===========================================================================

  /**
   * Register a handler for a specific event type.
   */
  registerHandler(eventType: string, handler: (event: Stripe.Event) => Promise<void>): void {
    this.handlers.set(eventType, handler);
    this.obs.info('webhook_handler_registered', { eventType });
  }

  // ===========================================================================
  // EVENT PROCESSING
  // ===========================================================================

  /**
   * Process a webhook event with idempotency.
   */
  async processEvent(event: Stripe.Event): Promise<{
    processed: boolean;
    status: 'new' | 'duplicate' | 'locked' | 'failed' | 'dlq';
    message: string;
  }> {
    const eventId = event.id;
    const eventType = event.type;

    this.obs.info('webhook_received', { eventId, eventType });

    // 1. Check if already processed (idempotency)
    const isDuplicate = await this.checkDuplicate(eventId);
    if (isDuplicate) {
      this.obs.info('webhook_duplicate', { eventId });
      return {
        processed: false,
        status: 'duplicate',
        message: `Event ${eventId} already processed`,
      };
    }

    // 2. Check if in DLQ
    const inDlq = await this.isInDeadLetterQueue(eventId);
    if (inDlq) {
      this.obs.info('webhook_in_dlq', { eventId });
      return {
        processed: false,
        status: 'dlq',
        message: `Event ${eventId} is in dead letter queue`,
      };
    }

    // 3. Try to acquire processing lock
    const lockAcquired = await this.acquireLock(eventId);
    if (!lockAcquired) {
      this.obs.warn('webhook_locked', { eventId });
      return {
        processed: false,
        status: 'locked',
        message: `Event ${eventId} is being processed by another worker`,
      };
    }

    try {
      // 4. Get handler for event type
      const handler = this.handlers.get(eventType);
      if (!handler) {
        this.obs.warn('webhook_no_handler', { eventType });
        // Mark as processed to avoid retries for unknown events
        await this.markProcessed(eventId);
        return {
          processed: true,
          status: 'new',
          message: `No handler for event type: ${eventType}`,
        };
      }

      // 5. Execute handler
      await handler(event);

      // 6. Mark as processed
      await this.markProcessed(eventId);

      this.obs.info('webhook_processed', { eventId, eventType });
      this.obs.counter('webhook_events_processed', 1, { type: eventType });

      return {
        processed: true,
        status: 'new',
        message: `Event ${eventId} processed successfully`,
      };
    } catch (error) {
      this.obs.error('webhook_processing_failed', error as Error, { eventId, eventType });
      this.obs.counter('webhook_events_failed', 1, { type: eventType });

      // Handle retry or DLQ
      await this.handleFailure(event, error as Error);

      return {
        processed: false,
        status: 'failed',
        message: `Failed to process event: ${(error as Error).message}`,
      };
    } finally {
      // Always release lock
      await this.releaseLock(eventId);
    }
  }

  // ===========================================================================
  // DEAD LETTER QUEUE
  // ===========================================================================

  /**
   * Check if event is in DLQ.
   */
  private async isInDeadLetterQueue(eventId: string): Promise<boolean> {
    const key = `${this.DLQ_PREFIX}${eventId}`;
    return (await this.redis.exists(key)) === 1;
  }

  /**
   * Move event to dead letter queue.
   */
  private async moveToDeadLetterQueue(
    event: Stripe.Event,
    error: Error,
    retryCount: number
  ): Promise<void> {
    const key = `${this.DLQ_PREFIX}${event.id}`;
    const retentionSeconds = this.config.dlqRetentionDays * 24 * 60 * 60;
    
    const dlqEntry = {
      eventId: event.id,
      eventType: event.type,
      payload: event,
      error: {
        message: error.message,
        stack: error.stack,
      },
      retryCount,
      addedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + retentionSeconds * 1000).toISOString(),
    };

    await this.redis.setex(key, retentionSeconds, JSON.stringify(dlqEntry));

    // Also store in audit log for persistence
    await this.prisma.auditLog.create({
      data: {
        action: 'webhook_moved_to_dlq',
        actor: 'system:webhook',
        metadata: {
          eventId: event.id,
          eventType: event.type,
          error: error.message,
          retryCount,
        },
      },
    });

    this.obs.warn('webhook_moved_to_dlq', {
      eventId: event.id,
      eventType: event.type,
      retryCount,
    });
    this.obs.counter('webhook_dlq_entries', 1, { type: event.type });
  }

  /**
   * Get all events in DLQ.
   */
  async getDeadLetterQueue(): Promise<Array<{
    eventId: string;
    eventType: string;
    error: string;
    retryCount: number;
    addedAt: string;
  }>> {
    const keys = await this.redis.keys(`${this.DLQ_PREFIX}*`);
    const entries: Array<any> = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const entry = JSON.parse(data);
        entries.push({
          eventId: entry.eventId,
          eventType: entry.eventType,
          error: entry.error?.message || 'Unknown error',
          retryCount: entry.retryCount,
          addedAt: entry.addedAt,
        });
      }
    }

    return entries.sort((a, b) => 
      new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );
  }

  /**
   * Retry an event from DLQ.
   */
  async retryFromDeadLetterQueue(eventId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const key = `${this.DLQ_PREFIX}${eventId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return { success: false, message: 'Event not found in DLQ' };
    }

    const entry = JSON.parse(data);
    
    // Remove from DLQ
    await this.redis.del(key);
    
    // Clear any processed marker
    await this.redis.del(`${this.PROCESSED_PREFIX}${eventId}`);

    // Reprocess
    const result = await this.processEvent(entry.payload);

    return {
      success: result.processed,
      message: result.message,
    };
  }

  /**
   * Clear expired DLQ entries.
   */
  async clearExpiredDlqEntries(): Promise<number> {
    const keys = await this.redis.keys(`${this.DLQ_PREFIX}*`);
    let cleared = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const entry = JSON.parse(data);
        if (new Date(entry.expiresAt) < new Date()) {
          await this.redis.del(key);
          cleared++;
        }
      }
    }

    if (cleared > 0) {
      this.obs.info('dlq_entries_cleared', { count: cleared });
    }

    return cleared;
  }

  // ===========================================================================
  // RETRY HANDLING
  // ===========================================================================

  /**
   * Handle failed event with retry or DLQ.
   */
  private async handleFailure(event: Stripe.Event, error: Error): Promise<void> {
    // Get current retry count
    const retryKey = `${this.RETRY_PREFIX}${event.id}`;
    const retryCountStr = await this.redis.get(retryKey);
    const retryCount = retryCountStr ? parseInt(retryCountStr, 10) : 0;

    if (retryCount >= this.config.deadLetterAfterRetries) {
      // Move to DLQ
      await this.moveToDeadLetterQueue(event, error, retryCount);
    } else {
      // Schedule retry with exponential backoff
      const nextRetry = retryCount + 1;
      const backoffMs = this.config.retryBackoffMs[
        Math.min(retryCount, this.config.retryBackoffMs.length - 1)
      ];

      // Store retry count
      await this.redis.setex(retryKey, 86400, String(nextRetry));

      // Log the failure for retry
      await this.logFailure(event, error, nextRetry, backoffMs);

      this.obs.info('webhook_scheduled_retry', {
        eventId: event.id,
        retryCount: nextRetry,
        backoffMs,
      });
    }
  }

  // ===========================================================================
  // IDEMPOTENCY HELPERS
  // ===========================================================================

  /**
   * Check if event has already been processed.
   */
  private async checkDuplicate(eventId: string): Promise<boolean> {
    const key = `${this.PROCESSED_PREFIX}${eventId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Mark event as processed.
   */
  private async markProcessed(eventId: string): Promise<void> {
    const key = `${this.PROCESSED_PREFIX}${eventId}`;
    await this.redis.setex(key, this.config.deduplicationWindowSeconds, 'processed');
  }

  /**
   * Acquire processing lock for event.
   */
  private async acquireLock(eventId: string): Promise<boolean> {
    const key = `${this.LOCK_PREFIX}${eventId}`;
    const result = await this.redis.set(key, 'locked', 'PX', this.LOCK_TTL, 'NX');
    return result === 'OK';
  }

  /**
   * Release processing lock.
   */
  private async releaseLock(eventId: string): Promise<void> {
    const key = `${this.LOCK_PREFIX}${eventId}`;
    await this.redis.del(key);
  }

  // ===========================================================================
  // FAILURE HANDLING
  // ===========================================================================

  /**
   * Log a failed event for retry/dead letter.
   */
  private async logFailure(
    event: Stripe.Event, 
    error: Error,
    retryCount?: number,
    backoffMs?: number
  ): Promise<void> {
    // Store in audit log for debugging
    await this.prisma.auditLog.create({
      data: {
        action: 'webhook_processing_failed',
        actor: 'system:webhook',
        metadata: {
          eventId: event.id,
          eventType: event.type,
          error: error.message,
          stack: error.stack,
          retryCount: retryCount || 0,
          nextRetryIn: backoffMs ? `${backoffMs}ms` : null,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // If Cloud Tasks is available, schedule retry
    // This would be implemented when integrating with cloud-tasks.service.ts
  }

  /**
   * Get processing status for an event.
   */
  async getEventStatus(eventId: string): Promise<{
    processed: boolean;
    locked: boolean;
  }> {
    const processedKey = `${this.PROCESSED_PREFIX}${eventId}`;
    const lockKey = `${this.LOCK_PREFIX}${eventId}`;

    const [processed, locked] = await Promise.all([
      this.redis.exists(processedKey),
      this.redis.exists(lockKey),
    ]);

    return {
      processed: processed === 1,
      locked: locked === 1,
    };
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get webhook processing statistics.
   */
  async getStats(): Promise<{
    processedCount: number;
    failedCount: number;
    duplicateCount: number;
  }> {
    // In production, these would come from proper metrics
    // For now, return from audit log
    const failedCount = await this.prisma.auditLog.count({
      where: {
        action: 'webhook_processing_failed',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        },
      },
    });

    return {
      processedCount: 0, // Would come from metrics
      failedCount,
      duplicateCount: 0, // Would come from metrics
    };
  }
}

// =============================================================================
// STRIPE WEBHOOK HANDLER FACTORY
// =============================================================================

/**
 * Create an idempotent Stripe webhook handler with all standard handlers registered.
 */
export function createIdempotentStripeHandler(params: {
  redis: Redis;
  prisma: PrismaClient;
  stripe: Stripe;
  onSubscriptionCreated?: (sub: Stripe.Subscription) => Promise<void>;
  onInvoicePaid?: (invoice: Stripe.Invoice) => Promise<void>;
  onPaymentFailed?: (invoice: Stripe.Invoice) => Promise<void>;
  onSubscriptionDeleted?: (sub: Stripe.Subscription) => Promise<void>;
  onBoostPurchased?: (sub: Stripe.Subscription) => Promise<void>;
  onBadgePurchased?: (session: Stripe.Checkout.Session) => Promise<void>;
}): IdempotentWebhookService {
  const service = new IdempotentWebhookService({
    redis: params.redis,
    prisma: params.prisma,
  });

  // Register subscription handlers
  service.registerHandler('checkout.session.completed', async (event) => {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Route to appropriate handler based on metadata
    if (session.metadata?.type === 'community_boost' && params.onBoostPurchased) {
      const subscription = await params.stripe.subscriptions.retrieve(
        session.subscription as string
      );
      await params.onBoostPurchased(subscription);
    } else if (session.metadata?.type === 'badge_purchase' && params.onBadgePurchased) {
      await params.onBadgePurchased(session);
    } else if (params.onSubscriptionCreated && session.subscription) {
      const subscription = await params.stripe.subscriptions.retrieve(
        session.subscription as string
      );
      await params.onSubscriptionCreated(subscription);
    }
  });

  service.registerHandler('invoice.paid', async (event) => {
    const invoice = event.data.object as Stripe.Invoice;
    if (params.onInvoicePaid) {
      await params.onInvoicePaid(invoice);
    }
  });

  service.registerHandler('invoice.payment_failed', async (event) => {
    const invoice = event.data.object as Stripe.Invoice;
    if (params.onPaymentFailed) {
      await params.onPaymentFailed(invoice);
    }
  });

  service.registerHandler('customer.subscription.deleted', async (event) => {
    const subscription = event.data.object as Stripe.Subscription;
    if (params.onSubscriptionDeleted) {
      await params.onSubscriptionDeleted(subscription);
    }
  });

  service.registerHandler('customer.subscription.updated', async (event) => {
    const subscription = event.data.object as Stripe.Subscription;
    
    // Check if this is a boost subscription
    if (subscription.metadata?.type === 'community_boost' && params.onBoostPurchased) {
      await params.onBoostPurchased(subscription);
    }
  });

  return service;
}

// =============================================================================
// SINGLETON
// =============================================================================

let idempotentWebhookInstance: IdempotentWebhookService | null = null;

export function getIdempotentWebhookService(params: {
  redis: Redis;
  prisma: PrismaClient;
}): IdempotentWebhookService {
  if (!idempotentWebhookInstance) {
    idempotentWebhookInstance = new IdempotentWebhookService(params);
  }
  return idempotentWebhookInstance;
}

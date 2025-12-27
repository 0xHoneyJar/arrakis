/**
 * =============================================================================
 * SIETCH UNIFIED - CLOUD TASKS EVENT DISPATCHER
 * =============================================================================
 * 
 * Event-driven architecture using GCP Cloud Tasks for real-time role updates.
 * Replaces polling-based conviction refresh with reactive triggers.
 * 
 * ENTERPRISE STANDARD: Google Cloud best practices for async task processing.
 * 
 * @module services/events/cloud-tasks.service
 */

import { CloudTasksClient, protos } from '@google-cloud/tasks';
import { getObservability } from '../observability/observability.service';

// =============================================================================
// TYPES
// =============================================================================

export type TaskQueue = 
  | 'conviction-updates'
  | 'role-sync'
  | 'webhook-retry'
  | 'data-lifecycle';

export interface TaskPayload {
  type: string;
  data: Record<string, unknown>;
  metadata: {
    correlationId: string;
    source: string;
    timestamp: string;
    retryCount?: number;
  };
}

export interface TaskOptions {
  queue: TaskQueue;
  scheduleTime?: Date;
  dispatchDeadline?: number;  // seconds
  headers?: Record<string, string>;
}

export interface CloudTasksConfig {
  projectId: string;
  location: string;
  serviceUrl: string;
  serviceAccountEmail?: string;
  queues: {
    [key in TaskQueue]: {
      name: string;
      rateLimitPerSecond: number;
      maxConcurrentDispatches: number;
      maxRetries: number;
    };
  };
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: CloudTasksConfig = {
  projectId: process.env.GCP_PROJECT_ID || '',
  location: process.env.GCP_LOCATION || 'us-central1',
  serviceUrl: process.env.TASKS_SERVICE_URL || 'https://api.sietch.io',
  queues: {
    'conviction-updates': {
      name: 'conviction-updates',
      rateLimitPerSecond: 100,
      maxConcurrentDispatches: 10,
      maxRetries: 5,
    },
    'role-sync': {
      name: 'role-sync',
      rateLimitPerSecond: 50,
      maxConcurrentDispatches: 5,
      maxRetries: 3,
    },
    'webhook-retry': {
      name: 'webhook-retry',
      rateLimitPerSecond: 20,
      maxConcurrentDispatches: 3,
      maxRetries: 5,
    },
    'data-lifecycle': {
      name: 'data-lifecycle',
      rateLimitPerSecond: 10,
      maxConcurrentDispatches: 2,
      maxRetries: 3,
    },
  },
};

// =============================================================================
// EVENT TYPES
// =============================================================================

export const EventTypes = {
  // Conviction events
  CONVICTION_SCORE_UPDATED: 'conviction.score_updated',
  CONVICTION_TIER_CHANGED: 'conviction.tier_changed',
  CONVICTION_RECALCULATE: 'conviction.recalculate',
  
  // Boost events
  BOOST_PURCHASED: 'boost.purchased',
  BOOST_CANCELLED: 'boost.cancelled',
  BOOST_LEVEL_CHANGED: 'boost.level_changed',
  
  // Role sync events
  ROLE_SYNC_DISCORD: 'role.sync_discord',
  ROLE_SYNC_TELEGRAM: 'role.sync_telegram',
  ROLE_SYNC_ALL: 'role.sync_all',
  
  // Identity events
  IDENTITY_VERIFIED: 'identity.verified',
  IDENTITY_WALLET_LINKED: 'identity.wallet_linked',
  
  // Billing events
  SUBSCRIPTION_ACTIVATED: 'billing.subscription_activated',
  SUBSCRIPTION_CANCELLED: 'billing.subscription_cancelled',
  PAYMENT_SUCCEEDED: 'billing.payment_succeeded',
  PAYMENT_FAILED: 'billing.payment_failed',
  
  // Webhook retry
  WEBHOOK_RETRY: 'webhook.retry',
  
  // Data lifecycle
  DATA_PURGE: 'data.purge',
  SESSION_CLEANUP: 'data.session_cleanup',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

// =============================================================================
// CLOUD TASKS SERVICE
// =============================================================================

export class CloudTasksService {
  private client: CloudTasksClient | null = null;
  private config: CloudTasksConfig;
  private obs = getObservability();
  private enabled: boolean = false;

  constructor(config?: Partial<CloudTasksConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = !!this.config.projectId;
    
    if (this.enabled) {
      this.client = new CloudTasksClient();
      console.log(`✅ Cloud Tasks enabled: ${this.config.projectId}/${this.config.location}`);
    } else {
      console.log('⚠️ Cloud Tasks disabled: GCP_PROJECT_ID not set');
    }
  }

  // ===========================================================================
  // TASK DISPATCH
  // ===========================================================================

  /**
   * Dispatch a task to Cloud Tasks queue.
   */
  async dispatch(
    eventType: EventType,
    data: Record<string, unknown>,
    options: Partial<TaskOptions> = {}
  ): Promise<{ taskId: string; dispatched: boolean }> {
    const correlationId = this.generateCorrelationId();
    const queue = options.queue || this.getQueueForEvent(eventType);
    
    const payload: TaskPayload = {
      type: eventType,
      data,
      metadata: {
        correlationId,
        source: 'sietch-unified',
        timestamp: new Date().toISOString(),
      },
    };

    // If Cloud Tasks is disabled, process synchronously (development mode)
    if (!this.enabled || !this.client) {
      this.obs.warn('cloud_tasks_disabled', { eventType, correlationId });
      return { taskId: correlationId, dispatched: false };
    }

    try {
      const queuePath = this.client.queuePath(
        this.config.projectId,
        this.config.location,
        this.config.queues[queue].name
      );

      const task: protos.google.cloud.tasks.v2.ITask = {
        httpRequest: {
          httpMethod: 'POST',
          url: `${this.config.serviceUrl}/internal/tasks/${eventType}`,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-Id': correlationId,
            ...options.headers,
          },
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          oidcToken: this.config.serviceAccountEmail ? {
            serviceAccountEmail: this.config.serviceAccountEmail,
          } : undefined,
        },
        scheduleTime: options.scheduleTime ? {
          seconds: Math.floor(options.scheduleTime.getTime() / 1000),
        } : undefined,
        dispatchDeadline: options.dispatchDeadline ? {
          seconds: options.dispatchDeadline,
        } : undefined,
      };

      const [response] = await this.client.createTask({
        parent: queuePath,
        task,
      });

      const taskId = response.name?.split('/').pop() || correlationId;

      this.obs.info('task_dispatched', {
        taskId,
        eventType,
        queue,
        correlationId,
      });

      this.obs.counter('cloud_tasks_dispatched', 1, { queue, eventType });

      return { taskId, dispatched: true };
    } catch (error) {
      this.obs.error('task_dispatch_failed', error as Error, {
        eventType,
        queue,
        correlationId,
      });

      this.obs.counter('cloud_tasks_dispatch_errors', 1, { queue, eventType });

      throw error;
    }
  }

  /**
   * Dispatch multiple tasks in batch.
   */
  async dispatchBatch(
    tasks: Array<{
      eventType: EventType;
      data: Record<string, unknown>;
      options?: Partial<TaskOptions>;
    }>
  ): Promise<Array<{ taskId: string; dispatched: boolean }>> {
    return Promise.all(
      tasks.map(t => this.dispatch(t.eventType, t.data, t.options))
    );
  }

  // ===========================================================================
  // CONVENIENCE METHODS FOR COMMON EVENTS
  // ===========================================================================

  /**
   * Trigger conviction recalculation for a user.
   */
  async triggerConvictionRecalc(params: {
    unifiedIdentityId: string;
    reason: string;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<{ taskId: string }> {
    const result = await this.dispatch(
      EventTypes.CONVICTION_RECALCULATE,
      {
        unifiedIdentityId: params.unifiedIdentityId,
        reason: params.reason,
      },
      {
        queue: 'conviction-updates',
      }
    );
    return { taskId: result.taskId };
  }

  /**
   * Trigger role sync for a user across platforms.
   */
  async triggerRoleSync(params: {
    unifiedIdentityId: string;
    platform?: 'discord' | 'telegram' | 'all';
    newTier?: string;
  }): Promise<{ taskId: string }> {
    const eventType = params.platform === 'discord' 
      ? EventTypes.ROLE_SYNC_DISCORD
      : params.platform === 'telegram'
      ? EventTypes.ROLE_SYNC_TELEGRAM
      : EventTypes.ROLE_SYNC_ALL;

    const result = await this.dispatch(eventType, params, {
      queue: 'role-sync',
    });
    return { taskId: result.taskId };
  }

  /**
   * Trigger boost level recalculation for a community.
   */
  async triggerBoostLevelRecalc(params: {
    communityId: string;
    trigger: 'purchase' | 'cancellation' | 'scheduled';
  }): Promise<{ taskId: string }> {
    const result = await this.dispatch(
      EventTypes.BOOST_LEVEL_CHANGED,
      params,
      { queue: 'conviction-updates' }
    );
    return { taskId: result.taskId };
  }

  /**
   * Schedule webhook retry.
   */
  async scheduleWebhookRetry(params: {
    eventId: string;
    eventType: string;
    payload: unknown;
    retryCount: number;
    delaySeconds: number;
  }): Promise<{ taskId: string }> {
    const scheduleTime = new Date(Date.now() + params.delaySeconds * 1000);
    
    const result = await this.dispatch(
      EventTypes.WEBHOOK_RETRY,
      {
        eventId: params.eventId,
        eventType: params.eventType,
        payload: params.payload,
        retryCount: params.retryCount,
      },
      {
        queue: 'webhook-retry',
        scheduleTime,
      }
    );
    return { taskId: result.taskId };
  }

  /**
   * Schedule data lifecycle purge.
   */
  async scheduleDataPurge(params: {
    dataType: string;
    scheduleTime?: Date;
  }): Promise<{ taskId: string }> {
    const result = await this.dispatch(
      EventTypes.DATA_PURGE,
      { dataType: params.dataType },
      {
        queue: 'data-lifecycle',
        scheduleTime: params.scheduleTime,
      }
    );
    return { taskId: result.taskId };
  }

  // ===========================================================================
  // QUEUE MANAGEMENT
  // ===========================================================================

  /**
   * Get queue for event type.
   */
  private getQueueForEvent(eventType: EventType): TaskQueue {
    if (eventType.startsWith('conviction.') || eventType.startsWith('boost.')) {
      return 'conviction-updates';
    }
    if (eventType.startsWith('role.')) {
      return 'role-sync';
    }
    if (eventType.startsWith('webhook.')) {
      return 'webhook-retry';
    }
    if (eventType.startsWith('data.')) {
      return 'data-lifecycle';
    }
    return 'conviction-updates';
  }

  /**
   * Generate correlation ID for tracing.
   */
  private generateCorrelationId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check if Cloud Tasks is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get queue stats (would query Cloud Tasks API in production).
   */
  async getQueueStats(queue: TaskQueue): Promise<{
    name: string;
    tasksInQueue: number;
    rateLimitPerSecond: number;
  }> {
    return {
      name: this.config.queues[queue].name,
      tasksInQueue: 0, // Would query actual stats
      rateLimitPerSecond: this.config.queues[queue].rateLimitPerSecond,
    };
  }
}

// =============================================================================
// TASK HANDLER REGISTRY
// =============================================================================

type TaskHandler = (payload: TaskPayload) => Promise<void>;

export class TaskHandlerRegistry {
  private handlers: Map<string, TaskHandler> = new Map();
  private obs = getObservability();

  /**
   * Register a handler for an event type.
   */
  register(eventType: EventType, handler: TaskHandler): void {
    this.handlers.set(eventType, handler);
    this.obs.info('task_handler_registered', { eventType });
  }

  /**
   * Process an incoming task.
   */
  async process(payload: TaskPayload): Promise<void> {
    const handler = this.handlers.get(payload.type);
    
    if (!handler) {
      this.obs.warn('task_handler_not_found', { type: payload.type });
      return;
    }

    const startTime = performance.now();
    
    try {
      await handler(payload);
      
      const duration = performance.now() - startTime;
      this.obs.info('task_processed', {
        type: payload.type,
        correlationId: payload.metadata.correlationId,
        durationMs: duration,
      });
      this.obs.histogram('task_processing_duration_ms', duration, { type: payload.type });
      this.obs.counter('tasks_processed', 1, { type: payload.type, status: 'success' });
    } catch (error) {
      this.obs.error('task_processing_failed', error as Error, {
        type: payload.type,
        correlationId: payload.metadata.correlationId,
      });
      this.obs.counter('tasks_processed', 1, { type: payload.type, status: 'failed' });
      throw error;
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let cloudTasksInstance: CloudTasksService | null = null;
let taskHandlerRegistryInstance: TaskHandlerRegistry | null = null;

export function getCloudTasksService(config?: Partial<CloudTasksConfig>): CloudTasksService {
  if (!cloudTasksInstance) {
    cloudTasksInstance = new CloudTasksService(config);
  }
  return cloudTasksInstance;
}

export function getTaskHandlerRegistry(): TaskHandlerRegistry {
  if (!taskHandlerRegistryInstance) {
    taskHandlerRegistryInstance = new TaskHandlerRegistry();
  }
  return taskHandlerRegistryInstance;
}

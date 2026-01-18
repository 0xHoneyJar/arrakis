/**
 * Synthesis Engine Port Interface
 *
 * Sprint S-21: Synthesis Engine & Rate Limiting
 *
 * Defines the contract for async Discord operations with
 * platform-wide rate limiting via Global Token Bucket.
 *
 * @see SDD §6.3.4 Synthesis Engine
 * @see SDD §6.3.5 Global Token Bucket
 */

import type { CommunityManifest } from '../domain/wizard.js';

// =============================================================================
// Synthesis Job Types
// =============================================================================

/**
 * Types of synthesis operations supported.
 * All 7 job types per sprint S-21.5.
 */
export type SynthesisJobType =
  | 'create_role'
  | 'delete_role'
  | 'assign_role'
  | 'remove_role'
  | 'create_channel'
  | 'delete_channel'
  | 'update_permissions';

/**
 * Create role payload.
 */
export interface CreateRolePayload {
  name: string;
  color: number;
  mentionable: boolean;
  hoist: boolean;
  permissions?: string[];
}

/**
 * Delete role payload.
 */
export interface DeleteRolePayload {
  roleId: string;
}

/**
 * Assign role payload.
 */
export interface AssignRolePayload {
  userId: string;
  roleId: string;
}

/**
 * Remove role payload.
 */
export interface RemoveRolePayload {
  userId: string;
  roleId: string;
}

/**
 * Create channel payload.
 */
export interface CreateChannelPayload {
  name: string;
  type: 'text' | 'voice' | 'category';
  topic?: string;
  parentId?: string;
  permissionOverwrites?: PermissionOverwrite[];
}

/**
 * Delete channel payload.
 */
export interface DeleteChannelPayload {
  channelId: string;
}

/**
 * Update permissions payload.
 */
export interface UpdatePermissionsPayload {
  channelId: string;
  overwrites: PermissionOverwrite[];
}

/**
 * Permission overwrite for channels.
 */
export interface PermissionOverwrite {
  id: string;
  type: 'role' | 'member';
  allow: string[];
  deny: string[];
}

/**
 * Union of all synthesis payloads.
 */
export type SynthesisPayload =
  | CreateRolePayload
  | DeleteRolePayload
  | AssignRolePayload
  | RemoveRolePayload
  | CreateChannelPayload
  | DeleteChannelPayload
  | UpdatePermissionsPayload;

// =============================================================================
// Synthesis Job
// =============================================================================

/**
 * Synthesis job definition.
 */
export interface SynthesisJob<T extends SynthesisPayload = SynthesisPayload> {
  /** Job type */
  type: SynthesisJobType;
  /** Discord guild ID */
  guildId: string;
  /** Community ID (tenant) */
  communityId: string;
  /** Job-specific payload */
  payload: T;
  /** Idempotency key to prevent duplicates (24h TTL) */
  idempotencyKey: string;
}

/**
 * Job status enum.
 */
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

/**
 * Synthesis job info with metadata.
 */
export interface SynthesisJobInfo {
  /** BullMQ job ID */
  jobId: string;
  /** Job name */
  name: string;
  /** Current status */
  status: JobStatus;
  /** Job data */
  data: SynthesisJob;
  /** Progress (0-100) */
  progress: number;
  /** Retry attempt count */
  attemptsMade: number;
  /** Failure reason (if failed) */
  failedReason?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Processed timestamp */
  processedAt?: Date;
  /** Finished timestamp */
  finishedAt?: Date;
}

// =============================================================================
// Batch Synthesis Result
// =============================================================================

/**
 * Result of batch job enqueueing.
 */
export interface BatchSynthesisResult {
  /** Community ID */
  communityId: string;
  /** Guild ID */
  guildId: string;
  /** Number of jobs enqueued */
  jobCount: number;
  /** List of job IDs */
  jobIds: string[];
  /** Timestamp */
  enqueuedAt: Date;
}

// =============================================================================
// Token Bucket Status
// =============================================================================

/**
 * Token bucket status.
 */
export interface TokenBucketStatus {
  /** Current available tokens */
  tokens: number;
  /** Maximum tokens */
  maxTokens: number;
  /** Refill rate (tokens/sec) */
  refillRate: number;
  /** Timestamp of last refill */
  lastRefillAt: Date;
}

// =============================================================================
// Synthesis Engine Stats
// =============================================================================

/**
 * Synthesis engine statistics.
 */
export interface SynthesisEngineStats {
  /** Jobs waiting in queue */
  waiting: number;
  /** Jobs currently being processed */
  active: number;
  /** Jobs completed successfully */
  completed: number;
  /** Jobs that failed */
  failed: number;
  /** Jobs delayed for retry */
  delayed: number;
  /** Token bucket status */
  tokenBucket: TokenBucketStatus;
  /** Rate limit hits in last hour */
  rateLimitHitsLastHour: number;
  /** Discord 429 errors in last hour */
  discord429ErrorsLastHour: number;
}

// =============================================================================
// Synthesis Engine Interface
// =============================================================================

/**
 * ISynthesisEngine port interface.
 *
 * Provides async Discord operations with:
 * - BullMQ queue with 3 retries, exponential backoff
 * - Global token bucket (50 tokens/sec)
 * - Idempotency keys (24h TTL)
 * - 5 concurrent workers, 10 jobs/sec limiter
 */
export interface ISynthesisEngine {
  // ===========================================================================
  // Queue Operations
  // ===========================================================================

  /**
   * Enqueue a single synthesis job.
   *
   * @param job - Synthesis job to enqueue
   * @param options - Optional job options
   * @returns Job ID
   */
  enqueue(
    job: SynthesisJob,
    options?: { priority?: number; delay?: number }
  ): Promise<string>;

  /**
   * Enqueue synthesis jobs for a full community manifest.
   * Creates roles and channels as defined in manifest.
   *
   * @param communityId - Community ID
   * @param guildId - Discord guild ID
   * @param manifest - Community manifest to synthesize
   * @returns Batch result with job IDs
   */
  enqueueSynthesis(
    communityId: string,
    guildId: string,
    manifest: CommunityManifest
  ): Promise<BatchSynthesisResult>;

  /**
   * Get job information by ID.
   *
   * @param jobId - Job ID
   * @returns Job info or null
   */
  getJob(jobId: string): Promise<SynthesisJobInfo | null>;

  /**
   * Get all jobs for a community.
   *
   * @param communityId - Community ID
   * @param status - Optional status filter
   * @returns List of job info
   */
  getJobsByCommunity(
    communityId: string,
    status?: JobStatus
  ): Promise<SynthesisJobInfo[]>;

  /**
   * Cancel a pending job.
   *
   * @param jobId - Job ID
   * @returns True if cancelled
   */
  cancelJob(jobId: string): Promise<boolean>;

  /**
   * Retry a failed job.
   *
   * @param jobId - Job ID
   * @returns New job ID or null
   */
  retryJob(jobId: string): Promise<string | null>;

  // ===========================================================================
  // Token Bucket Operations
  // ===========================================================================

  /**
   * Get current token bucket status.
   */
  getTokenBucketStatus(): Promise<TokenBucketStatus>;

  // ===========================================================================
  // Stats & Monitoring
  // ===========================================================================

  /**
   * Get synthesis engine statistics.
   */
  getStats(): Promise<SynthesisEngineStats>;

  /**
   * Check if an idempotency key has been processed.
   *
   * @param key - Idempotency key
   * @returns True if already processed
   */
  isProcessed(key: string): Promise<boolean>;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Gracefully close the synthesis engine.
   * Waits for active jobs to complete.
   */
  close(): Promise<void>;

  /**
   * Pause job processing.
   */
  pause(): Promise<void>;

  /**
   * Resume job processing.
   */
  resume(): Promise<void>;
}

// =============================================================================
// Global Token Bucket Interface
// =============================================================================

/**
 * IGlobalTokenBucket port interface.
 *
 * Redis-backed token bucket for platform-wide rate limiting.
 * Per SDD §6.3.5: 50 tokens/sec, acquireWithWait() blocking.
 */
export interface IGlobalTokenBucket {
  /**
   * Acquire a token, blocking until available or timeout.
   *
   * @param maxWaitMs - Maximum wait time in milliseconds (default: 5000)
   * @throws Error if max wait exceeded
   */
  acquireWithWait(maxWaitMs?: number): Promise<void>;

  /**
   * Try to acquire a token without blocking.
   *
   * @returns True if token acquired, false if bucket empty
   */
  tryAcquire(): Promise<boolean>;

  /**
   * Get current bucket status.
   */
  getStatus(): Promise<TokenBucketStatus>;

  /**
   * Reset bucket to full (for testing).
   */
  reset(): Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default synthesis queue configuration.
 */
export const SYNTHESIS_QUEUE_CONFIG = {
  /** Queue name */
  QUEUE_NAME: 'discord-synthesis',
  /** Maximum retry attempts */
  MAX_ATTEMPTS: 3,
  /** Base backoff delay in ms */
  BACKOFF_BASE_MS: 1000,
  /** Backoff type */
  BACKOFF_TYPE: 'exponential' as const,
  /** Max concurrent jobs */
  CONCURRENCY: 5,
  /** Jobs per second limit */
  RATE_LIMIT_MAX: 10,
  /** Rate limit duration in ms */
  RATE_LIMIT_DURATION: 1000,
  /** Keep completed jobs for (seconds) */
  REMOVE_ON_COMPLETE_AGE: 3600,
  /** Keep failed jobs for (seconds) */
  REMOVE_ON_FAIL_AGE: 86400,
} as const;

/**
 * Token bucket configuration.
 */
export const TOKEN_BUCKET_CONFIG = {
  /** Redis key for bucket */
  REDIS_KEY: 'synthesis:token_bucket',
  /** Maximum tokens in bucket */
  MAX_TOKENS: 50,
  /** Refill rate (tokens per second) */
  REFILL_RATE: 50,
  /** Default max wait time for acquireWithWait */
  DEFAULT_MAX_WAIT_MS: 5000,
  /** Polling interval for waiting */
  POLL_INTERVAL_MS: 100,
} as const;

/**
 * Idempotency key configuration.
 */
export const IDEMPOTENCY_CONFIG = {
  /** Redis key prefix */
  KEY_PREFIX: 'synthesis:idempotency:',
  /** TTL in seconds (24 hours) */
  TTL_SECONDS: 86400,
} as const;

/**
 * Synthesis metrics configuration.
 */
export const SYNTHESIS_METRICS_PREFIX = 'arrakis_synthesis_' as const;

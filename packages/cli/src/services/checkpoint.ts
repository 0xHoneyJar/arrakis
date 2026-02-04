/**
 * CheckpointService - Sietch Vault checkpoint management
 *
 * Sprint 149: Checkpoint Hooks (Sietch Vault CS1)
 *
 * Provides automatic checkpoint creation before destructive operations
 * and integration with the Dashboard API for restore functionality.
 *
 * @see SDD §15.3.1 CheckpointService
 * @module packages/cli/services/checkpoint
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for creating a checkpoint
 */
export interface CreateCheckpointParams {
  /** Discord server (guild) ID */
  serverId: string;
  /** Command that triggered checkpoint creation */
  triggerCommand: 'destroy' | 'teardown' | 'apply';
  /** Optional reason for the checkpoint */
  reason?: string;
}

/**
 * Result of checkpoint creation
 */
export interface CheckpointResult {
  /** Unique checkpoint identifier */
  checkpointId: string;
  /** When the checkpoint was created */
  createdAt: Date;
  /** When the checkpoint expires (typically 30 days) */
  expiresAt: Date;
  /** Command that triggered creation */
  triggerCommand: string;
}

/**
 * Checkpoint metadata
 */
export interface Checkpoint {
  /** Unique identifier */
  id: string;
  /** Discord server ID */
  serverId: string;
  /** Command that triggered creation */
  triggerCommand: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Schema version for compatibility */
  schemaVersion: number;
}

/**
 * Threshold change in impact analysis
 */
export interface ThresholdChange {
  name: string;
  oldValue: number;
  newValue: number;
}

/**
 * Feature gate change in impact analysis
 */
export interface FeatureGateChange {
  name: string;
  oldEnabled: boolean;
  newEnabled: boolean;
}

/**
 * Role mapping change in impact analysis
 */
export interface RoleMapChange {
  tier: string;
  oldRoleId: string | null;
  newRoleId: string | null;
}

/**
 * Impact analysis for a checkpoint restore
 */
export interface ImpactAnalysis {
  /** Number of users affected by the restore */
  affectedUsers: number;
  /** Threshold changes that will occur */
  thresholdChanges: ThresholdChange[];
  /** Feature gate changes that will occur */
  featureGateChanges: FeatureGateChange[];
  /** Role mapping changes that will occur */
  roleMapChanges: RoleMapChange[];
  /** Warning messages for the user */
  warnings: string[];
  /** Whether this is a high-impact restore (>10 users) */
  isHighImpact: boolean;
  /** Whether manual confirmation is required */
  confirmationRequired: boolean;
  /** Confirmation code if required */
  confirmationCode?: string;
}

/**
 * Result of a restore operation
 */
export interface RestoreResult {
  /** Whether the restore succeeded */
  success: boolean;
  /** When the restore completed */
  restoredAt: Date;
  /** Summary of restored items */
  summary: {
    thresholdsRestored: number;
    featureGatesRestored: number;
    roleMapsRestored: number;
  };
}

// =============================================================================
// Error Class
// =============================================================================

/**
 * Error thrown when checkpoint operations fail
 *
 * When this error is thrown during pre-destructive checkpoint creation,
 * the destructive operation MUST be blocked to ensure safety.
 */
export class CheckpointError extends Error {
  /** HTTP status code if from API */
  statusCode?: number;
  /** Error code for programmatic handling */
  code: string;

  constructor(message: string, statusCode?: number, code: string = 'CHECKPOINT_ERROR') {
    super(message);
    this.name = 'CheckpointError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// =============================================================================
// CheckpointService
// =============================================================================

/**
 * Service for managing Sietch Vault checkpoints
 *
 * Provides:
 * - Pre-destructive checkpoint creation (blocks if fails)
 * - Checkpoint listing and preview
 * - Restore execution with confirmation flow
 *
 * @example
 * ```typescript
 * const service = new CheckpointService('http://localhost:3000');
 *
 * // Before destroy/teardown - MUST succeed or operation is blocked
 * try {
 *   const checkpoint = await service.create({
 *     serverId: guildId,
 *     triggerCommand: 'destroy'
 *   });
 *   console.log(`Checkpoint created: ${checkpoint.checkpointId}`);
 * } catch (error) {
 *   if (error instanceof CheckpointError) {
 *     console.error('Destroy blocked: could not create safety checkpoint');
 *     process.exit(1);
 *   }
 * }
 * ```
 */
export class CheckpointService {
  private baseUrl: string;

  /**
   * Create a new CheckpointService
   *
   * @param baseUrl - Dashboard API base URL (defaults to GAIB_API_URL env var)
   */
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.GAIB_API_URL || 'http://localhost:3000';
  }

  /**
   * Create a checkpoint before a destructive operation
   *
   * This method MUST succeed before any destructive operation can proceed.
   * If it fails, a CheckpointError is thrown and the operation must be blocked.
   *
   * @param params - Checkpoint creation parameters
   * @returns The created checkpoint details
   * @throws CheckpointError if creation fails (blocks the destructive operation)
   */
  async create(params: CreateCheckpointParams): Promise<CheckpointResult> {
    const { serverId, triggerCommand, reason } = params;

    try {
      const response = await fetch(
        `${this.baseUrl}/api/servers/${serverId}/checkpoints`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ triggerCommand, reason }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new CheckpointError(
          `Failed to create checkpoint: ${response.statusText} - ${errorBody}`,
          response.status,
          'CHECKPOINT_CREATE_FAILED'
        );
      }

      const data = await response.json() as {
        checkpointId?: string;
        id?: string;
        createdAt: string;
        expiresAt: string;
        triggerCommand: string;
      };

      return {
        checkpointId: data.checkpointId || data.id || '',
        createdAt: new Date(data.createdAt),
        expiresAt: new Date(data.expiresAt),
        triggerCommand: data.triggerCommand,
      };
    } catch (error) {
      if (error instanceof CheckpointError) {
        throw error;
      }

      // Network or other errors
      throw new CheckpointError(
        `Checkpoint service unavailable: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'CHECKPOINT_SERVICE_UNAVAILABLE'
      );
    }
  }

  /**
   * List available checkpoints for a server
   *
   * @param serverId - Discord server ID
   * @returns Array of available checkpoints
   */
  async list(serverId: string): Promise<Checkpoint[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/servers/${serverId}/restore/checkpoints`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new CheckpointError(
          `Failed to list checkpoints: ${response.statusText}`,
          response.status,
          'CHECKPOINT_LIST_FAILED'
        );
      }

      const data = await response.json() as {
        checkpoints?: Record<string, unknown>[];
      } | Record<string, unknown>[];
      const checkpoints = Array.isArray(data) ? data : (data.checkpoints || []);

      return checkpoints.map((cp: Record<string, unknown>) => ({
        id: cp.id as string,
        serverId: cp.serverId as string,
        triggerCommand: cp.triggerCommand as string,
        createdAt: new Date(cp.createdAt as string),
        expiresAt: new Date(cp.expiresAt as string),
        schemaVersion: cp.schemaVersion as number ?? 1,
      }));
    } catch (error) {
      if (error instanceof CheckpointError) {
        throw error;
      }

      throw new CheckpointError(
        `Failed to list checkpoints: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'CHECKPOINT_LIST_FAILED'
      );
    }
  }

  /**
   * Preview the impact of restoring a checkpoint
   *
   * @param serverId - Discord server ID
   * @param checkpointId - Checkpoint to preview
   * @returns Impact analysis showing what would change
   */
  async preview(serverId: string, checkpointId: string): Promise<ImpactAnalysis> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/servers/${serverId}/restore/preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ checkpointId }),
        }
      );

      if (!response.ok) {
        throw new CheckpointError(
          `Failed to preview restore: ${response.statusText}`,
          response.status,
          'CHECKPOINT_PREVIEW_FAILED'
        );
      }

      return await response.json() as ImpactAnalysis;
    } catch (error) {
      if (error instanceof CheckpointError) {
        throw error;
      }

      throw new CheckpointError(
        `Failed to preview restore: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'CHECKPOINT_PREVIEW_FAILED'
      );
    }
  }

  /**
   * Execute a checkpoint restoration
   *
   * @param serverId - Discord server ID
   * @param checkpointId - Checkpoint to restore
   * @param confirmationCode - Required for high-impact restores
   * @returns Result of the restore operation
   */
  async restore(
    serverId: string,
    checkpointId: string,
    confirmationCode?: string
  ): Promise<RestoreResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/servers/${serverId}/restore/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ checkpointId, confirmationCode }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new CheckpointError(
          `Failed to execute restore: ${response.statusText} - ${errorBody}`,
          response.status,
          'CHECKPOINT_RESTORE_FAILED'
        );
      }

      const data = await response.json() as {
        success?: boolean;
        restoredAt?: string;
        summary?: {
          thresholdsRestored: number;
          featureGatesRestored: number;
          roleMapsRestored: number;
        };
      };

      return {
        success: data.success ?? true,
        restoredAt: new Date(data.restoredAt || Date.now()),
        summary: data.summary ?? {
          thresholdsRestored: 0,
          featureGatesRestored: 0,
          roleMapsRestored: 0,
        },
      };
    } catch (error) {
      if (error instanceof CheckpointError) {
        throw error;
      }

      throw new CheckpointError(
        `Failed to execute restore: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'CHECKPOINT_RESTORE_FAILED'
      );
    }
  }
}

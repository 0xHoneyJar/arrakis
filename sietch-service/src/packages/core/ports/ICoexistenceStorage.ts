/**
 * ICoexistenceStorage - Port Interface for Coexistence Data Access
 *
 * Sprint 56: Shadow Mode Foundation - Incumbent Detection
 *
 * Defines the contract for storing and retrieving coexistence-related data:
 * - Incumbent bot configurations (detected token-gating bots)
 * - Migration states (shadow -> parallel -> primary -> exclusive)
 *
 * This interface supports the hexagonal architecture pattern, allowing
 * different storage implementations (PostgreSQL, in-memory for tests).
 *
 * @module packages/core/ports/ICoexistenceStorage
 */

import type {
  IncumbentProvider,
  HealthStatus,
  CoexistenceMode,
  MigrationStrategy,
  DetectedRole,
  IncumbentCapabilities,
  DivergenceType,
  ShadowStateSnapshot,
} from '../../adapters/storage/schema.js';

// =============================================================================
// Incumbent Configuration Types
// =============================================================================

/**
 * Information about an incumbent token-gating bot detected in a guild
 */
export interface IncumbentInfo {
  /** Incumbent provider type */
  provider: IncumbentProvider;
  /** Detection confidence score (0-1) */
  confidence: number;
  /** Bot information if detected */
  bot: {
    id: string;
    username: string;
    joinedAt: Date;
  } | null;
  /** Relevant channel IDs */
  channels: {
    verification: string | null;
    config: string | null;
  };
  /** Detected roles that may be token-gated */
  roles: DetectedRole[];
  /** Capabilities comparison */
  capabilities: IncumbentCapabilities;
}

/**
 * Input for saving an incumbent configuration
 */
export interface SaveIncumbentInput {
  communityId: string;
  provider: IncumbentProvider;
  botId?: string;
  botUsername?: string;
  verificationChannelId?: string;
  confidence: number;
  manualOverride?: boolean;
  detectedRoles?: DetectedRole[];
  capabilities?: IncumbentCapabilities;
}

/**
 * Stored incumbent configuration with metadata
 */
export interface StoredIncumbentConfig {
  id: string;
  communityId: string;
  provider: IncumbentProvider;
  botId: string | null;
  botUsername: string | null;
  verificationChannelId: string | null;
  detectedAt: Date;
  confidence: number;
  manualOverride: boolean;
  lastHealthCheck: Date | null;
  healthStatus: HealthStatus;
  detectedRoles: DetectedRole[];
  capabilities: IncumbentCapabilities;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Migration State Types
// =============================================================================

/**
 * Coexistence state tracking for a community
 */
export interface CoexistenceState {
  mode: CoexistenceMode;
  incumbentProvider: IncumbentProvider | null;
  shadowStartedAt: Date | null;
  parallelEnabledAt: Date | null;
  primaryEnabledAt: Date | null;
  exclusiveEnabledAt: Date | null;
  lastRollbackAt: Date | null;
  rollbackCount: number;
}

/**
 * Input for creating/updating migration state
 */
export interface SaveMigrationStateInput {
  communityId: string;
  currentMode: CoexistenceMode;
  targetMode?: CoexistenceMode;
  strategy?: MigrationStrategy;
  shadowStartedAt?: Date;
  parallelEnabledAt?: Date;
  primaryEnabledAt?: Date;
  exclusiveEnabledAt?: Date;
  rollbackCount?: number;
  lastRollbackAt?: Date;
  lastRollbackReason?: string;
  readinessCheckPassed?: boolean;
  accuracyPercent?: number;
  shadowDays?: number;
}

/**
 * Stored migration state with full metadata
 */
export interface StoredMigrationState {
  id: string;
  communityId: string;
  currentMode: CoexistenceMode;
  targetMode: CoexistenceMode | null;
  strategy: MigrationStrategy | null;
  shadowStartedAt: Date | null;
  parallelEnabledAt: Date | null;
  primaryEnabledAt: Date | null;
  exclusiveEnabledAt: Date | null;
  rollbackCount: number;
  lastRollbackAt: Date | null;
  lastRollbackReason: string | null;
  readinessCheckPassed: boolean;
  accuracyPercent: number | null;
  shadowDays: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Health check update input
 */
export interface UpdateHealthInput {
  communityId: string;
  healthStatus: HealthStatus;
  lastHealthCheck: Date;
}

// =============================================================================
// Port Interface
// =============================================================================

/**
 * Port interface for coexistence data storage
 *
 * Implementations:
 * - CoexistenceStorage (PostgreSQL via Drizzle)
 * - InMemoryCoexistenceStorage (for unit tests)
 */
export interface ICoexistenceStorage {
  // =========================================================================
  // Incumbent Configuration Methods
  // =========================================================================

  /**
   * Get incumbent configuration for a community
   * @param communityId - Community UUID
   * @returns Incumbent config or null if not found
   */
  getIncumbentConfig(communityId: string): Promise<StoredIncumbentConfig | null>;

  /**
   * Save or update incumbent configuration
   * @param input - Incumbent configuration data
   * @returns Saved configuration
   */
  saveIncumbentConfig(input: SaveIncumbentInput): Promise<StoredIncumbentConfig>;

  /**
   * Update incumbent health status
   * @param input - Health check data
   */
  updateIncumbentHealth(input: UpdateHealthInput): Promise<void>;

  /**
   * Delete incumbent configuration
   * @param communityId - Community UUID
   */
  deleteIncumbentConfig(communityId: string): Promise<void>;

  /**
   * Check if community has an incumbent configured
   * @param communityId - Community UUID
   */
  hasIncumbent(communityId: string): Promise<boolean>;

  // =========================================================================
  // Migration State Methods
  // =========================================================================

  /**
   * Get migration state for a community
   * @param communityId - Community UUID
   * @returns Migration state or null if not found
   */
  getMigrationState(communityId: string): Promise<StoredMigrationState | null>;

  /**
   * Save or update migration state
   * @param input - Migration state data
   * @returns Saved state
   */
  saveMigrationState(input: SaveMigrationStateInput): Promise<StoredMigrationState>;

  /**
   * Get current coexistence mode for a community
   * @param communityId - Community UUID
   * @returns Current mode or 'shadow' if not configured
   */
  getCurrentMode(communityId: string): Promise<CoexistenceMode>;

  /**
   * Update coexistence mode (state machine transition)
   * @param communityId - Community UUID
   * @param mode - New mode
   * @param reason - Reason for transition (for rollbacks)
   */
  updateMode(
    communityId: string,
    mode: CoexistenceMode,
    reason?: string
  ): Promise<void>;

  /**
   * Record a rollback event
   * @param communityId - Community UUID
   * @param reason - Reason for rollback
   * @param targetMode - Mode to rollback to
   */
  recordRollback(
    communityId: string,
    reason: string,
    targetMode: CoexistenceMode
  ): Promise<void>;

  /**
   * Initialize migration state for a new community in shadow mode
   * @param communityId - Community UUID
   * @returns Initial migration state
   */
  initializeShadowMode(communityId: string): Promise<StoredMigrationState>;

  // =========================================================================
  // Query Methods
  // =========================================================================

  /**
   * Get all communities in a specific mode
   * @param mode - Coexistence mode to filter by
   */
  getCommunitiesByMode(mode: CoexistenceMode): Promise<string[]>;

  /**
   * Get communities ready for migration (passed readiness check)
   */
  getReadyCommunities(): Promise<string[]>;

  /**
   * Get incumbent health status across all communities
   * @returns Map of communityId -> healthStatus
   */
  getIncumbentHealthOverview(): Promise<Map<string, HealthStatus>>;

  // =========================================================================
  // Shadow Member State Methods (Sprint 57)
  // =========================================================================

  /**
   * Get shadow member state by community and member
   * @param communityId - Community UUID
   * @param memberId - Discord member ID
   */
  getShadowMemberState(
    communityId: string,
    memberId: string
  ): Promise<StoredShadowMemberState | null>;

  /**
   * Get all shadow member states for a community
   * @param communityId - Community UUID
   * @param options - Pagination and filter options
   */
  getShadowMemberStates(
    communityId: string,
    options?: {
      limit?: number;
      offset?: number;
      divergenceType?: DivergenceType;
    }
  ): Promise<StoredShadowMemberState[]>;

  /**
   * Save or update a shadow member state (upsert)
   * @param input - Shadow member state data
   */
  saveShadowMemberState(input: SaveShadowMemberInput): Promise<StoredShadowMemberState>;

  /**
   * Batch save shadow member states (for sync efficiency)
   * @param inputs - Array of shadow member state data
   */
  batchSaveShadowMemberStates(inputs: SaveShadowMemberInput[]): Promise<void>;

  /**
   * Delete shadow member state
   * @param communityId - Community UUID
   * @param memberId - Discord member ID
   */
  deleteShadowMemberState(communityId: string, memberId: string): Promise<void>;

  // =========================================================================
  // Shadow Divergence Methods (Sprint 57)
  // =========================================================================

  /**
   * Save a new divergence record
   * @param input - Divergence data
   */
  saveDivergence(input: SaveDivergenceInput): Promise<StoredDivergence>;

  /**
   * Get divergences for a community
   * @param communityId - Community UUID
   * @param options - Pagination and filter options
   */
  getDivergences(
    communityId: string,
    options?: {
      limit?: number;
      offset?: number;
      divergenceType?: DivergenceType;
      since?: Date;
      unresolved?: boolean;
    }
  ): Promise<StoredDivergence[]>;

  /**
   * Mark a divergence as resolved
   * @param divergenceId - Divergence UUID
   * @param resolutionType - How it was resolved
   */
  resolveDivergence(
    divergenceId: string,
    resolutionType: 'member_action' | 'sync_corrected' | 'manual'
  ): Promise<void>;

  /**
   * Get divergence summary for a community
   * @param communityId - Community UUID
   */
  getDivergenceSummary(communityId: string): Promise<DivergenceSummary>;

  // =========================================================================
  // Shadow Prediction Methods (Sprint 57)
  // =========================================================================

  /**
   * Save a new prediction
   * @param input - Prediction data
   */
  savePrediction(input: SavePredictionInput): Promise<StoredPrediction>;

  /**
   * Validate a prediction against actual outcome
   * @param input - Validation data
   */
  validatePrediction(input: ValidatePredictionInput): Promise<void>;

  /**
   * Get unvalidated predictions for a community
   * @param communityId - Community UUID
   * @param limit - Max predictions to return
   */
  getUnvalidatedPredictions(
    communityId: string,
    limit?: number
  ): Promise<StoredPrediction[]>;

  /**
   * Calculate accuracy percentage for a community
   * @param communityId - Community UUID
   * @param since - Only consider predictions after this date
   */
  calculateAccuracy(communityId: string, since?: Date): Promise<number>;
}

// =============================================================================
// Shadow Member State Types (Sprint 57)
// =============================================================================

/**
 * Input for saving/updating a shadow member state
 */
export interface SaveShadowMemberInput {
  communityId: string;
  memberId: string;
  incumbentRoles?: string[];
  incumbentTier?: number | null;
  incumbentLastUpdate?: Date;
  arrakisRoles?: string[];
  arrakisTier?: number | null;
  arrakisConviction?: number | null;
  arrakisLastCalculated?: Date;
  divergenceType?: DivergenceType | null;
  divergenceReason?: string | null;
  divergenceDetectedAt?: Date | null;
}

/**
 * Stored shadow member state
 */
export interface StoredShadowMemberState {
  id: string;
  communityId: string;
  memberId: string;
  incumbentRoles: string[];
  incumbentTier: number | null;
  incumbentLastUpdate: Date | null;
  arrakisRoles: string[];
  arrakisTier: number | null;
  arrakisConviction: number | null;
  arrakisLastCalculated: Date | null;
  divergenceType: DivergenceType | null;
  divergenceReason: string | null;
  divergenceDetectedAt: Date | null;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for saving a divergence record
 */
export interface SaveDivergenceInput {
  communityId: string;
  memberId: string;
  divergenceType: DivergenceType;
  incumbentState: ShadowStateSnapshot;
  arrakisState: ShadowStateSnapshot;
  reason?: string;
}

/**
 * Stored divergence record
 */
export interface StoredDivergence {
  id: string;
  communityId: string;
  memberId: string;
  divergenceType: DivergenceType;
  incumbentState: ShadowStateSnapshot;
  arrakisState: ShadowStateSnapshot;
  reason: string | null;
  detectedAt: Date;
  resolvedAt: Date | null;
  resolutionType: string | null;
  createdAt: Date;
}

/**
 * Input for saving a prediction record
 */
export interface SavePredictionInput {
  communityId: string;
  memberId: string;
  predictedRoles: string[];
  predictedTier?: number | null;
  predictedConviction?: number | null;
}

/**
 * Input for validating a prediction
 */
export interface ValidatePredictionInput {
  predictionId: string;
  actualRoles: string[];
  actualTier?: number | null;
  accurate: boolean;
  accuracyScore: number;
  accuracyDetails?: string;
}

/**
 * Stored prediction record
 */
export interface StoredPrediction {
  id: string;
  communityId: string;
  memberId: string;
  predictedRoles: string[];
  predictedTier: number | null;
  predictedConviction: number | null;
  predictedAt: Date;
  actualRoles: string[] | null;
  actualTier: number | null;
  validatedAt: Date | null;
  accurate: boolean | null;
  accuracyScore: number | null;
  accuracyDetails: string | null;
  createdAt: Date;
}

/**
 * Summary of divergences for a community
 */
export interface DivergenceSummary {
  communityId: string;
  totalMembers: number;
  matchCount: number;
  arrakisHigherCount: number;
  arrakisLowerCount: number;
  mismatchCount: number;
  accuracyPercent: number;
}

/**
 * Re-export schema types for convenience
 */
export type {
  IncumbentProvider,
  HealthStatus,
  CoexistenceMode,
  MigrationStrategy,
  DetectedRole,
  IncumbentCapabilities,
  DivergenceType,
  ShadowStateSnapshot,
};

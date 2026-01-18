/**
 * IShadowSync Interface
 *
 * Sprint S-25: Shadow Sync Job & Verification Tiers
 *
 * Port interface for shadow sync operations including periodic comparison,
 * accuracy tracking, and notification capabilities.
 *
 * @see SDD §7.1.4 Shadow Sync Job
 */

import type {
  ShadowSyncResult,
  CoexistenceConfig,
} from '../domain/coexistence.js';
import type { VerificationTier, CommunityVerificationStatus } from '../domain/verification-tiers.js';

// =============================================================================
// Shadow Sync Options
// =============================================================================

/**
 * Options for running a shadow sync.
 */
export interface ShadowSyncOptions {
  /** Force sync even if interval hasn't elapsed */
  force?: boolean;
  /** Maximum members to process (for testing/debugging) */
  maxMembers?: number;
  /** Skip notification even if divergences found */
  skipNotification?: boolean;
}

/**
 * Options for fetching guild members with cursor-based pagination.
 */
export interface MemberFetchOptions {
  /** Number of members per batch (max 1000) */
  batchSize?: number;
  /** Cursor for pagination (Discord user ID to start after) */
  after?: string;
  /** Maximum total members to fetch (0 = all) */
  maxTotal?: number;
}

/**
 * Result of a paginated member fetch.
 */
export interface MemberFetchResult<T> {
  /** Fetched members */
  members: T[];
  /** Cursor for next page (null if no more pages) */
  nextCursor: string | null;
  /** Total fetched so far */
  totalFetched: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

// =============================================================================
// Shadow Digest Types
// =============================================================================

/**
 * Shadow digest notification content.
 */
export interface ShadowDigest {
  /** Community ID */
  communityId: string;
  /** Discord guild ID */
  guildId: string;
  /** Sync result summary */
  syncResult: ShadowSyncResult;
  /** Divergence summary */
  divergenceSummary: {
    /** Total false positives (incumbent grants, Arrakis wouldn't) */
    falsePositives: number;
    /** Total false negatives (incumbent denies, Arrakis would grant) */
    falseNegatives: number;
    /** New divergences since last digest */
    newDivergences: number;
  };
  /** Accuracy trend */
  accuracyTrend: Array<{
    date: Date;
    accuracy: number;
    sampleSize: number;
  }>;
  /** Tier upgrade status */
  tierStatus: {
    currentTier: VerificationTier;
    daysUntilUpgradeEligible: number | null;
    accuracyNeeded: number | null;
  };
  /** Generated at timestamp */
  generatedAt: Date;
}

// =============================================================================
// IShadowSync Interface
// =============================================================================

/**
 * Port interface for shadow sync operations.
 */
export interface IShadowSync {
  // ===========================================================================
  // Core Sync Operations
  // ===========================================================================

  /**
   * Run shadow sync for a community.
   * Compares incumbent state vs Arrakis eligibility without mutations.
   *
   * @param communityId - Community ID
   * @param guildId - Discord guild ID
   * @param options - Sync options
   * @returns Sync result with divergence counts
   */
  sync(
    communityId: string,
    guildId: string,
    options?: ShadowSyncOptions
  ): Promise<ShadowSyncResult>;

  /**
   * Run shadow sync for all eligible communities.
   * Typically called by scheduler every 6 hours.
   *
   * @returns Array of sync results
   */
  syncAll(): Promise<ShadowSyncResult[]>;

  /**
   * Check if a community is due for sync based on interval.
   *
   * @param communityId - Community ID
   * @returns True if sync is due
   */
  isSyncDue(communityId: string): Promise<boolean>;

  /**
   * Get the last sync result for a community.
   *
   * @param communityId - Community ID
   * @returns Last sync result or null
   */
  getLastSyncResult(communityId: string): Promise<ShadowSyncResult | null>;

  // ===========================================================================
  // Member Fetch Operations
  // ===========================================================================

  /**
   * Fetch guild members with cursor-based pagination.
   * Prevents OOM on large communities.
   *
   * @param guildId - Discord guild ID
   * @param options - Fetch options
   * @returns Paginated member result
   */
  fetchMembers<T>(
    guildId: string,
    options?: MemberFetchOptions
  ): Promise<MemberFetchResult<T>>;

  /**
   * Fetch all members using async iteration.
   * Yields batches to allow processing without loading all into memory.
   *
   * @param guildId - Discord guild ID
   * @param batchSize - Members per batch
   */
  fetchMembersIterator<T>(
    guildId: string,
    batchSize?: number
  ): AsyncGenerator<T[], void, unknown>;

  // ===========================================================================
  // Verification Tier Operations
  // ===========================================================================

  /**
   * Get verification status for a community.
   *
   * @param communityId - Community ID
   * @returns Verification status with tier info
   */
  getVerificationStatus(communityId: string): Promise<CommunityVerificationStatus | null>;

  /**
   * Check if community meets requirements for next tier.
   *
   * @param communityId - Community ID
   * @returns True if upgrade requirements met
   */
  checkTierUpgradeEligibility(communityId: string): Promise<boolean>;

  /**
   * Upgrade community to next tier if eligible.
   *
   * @param communityId - Community ID
   * @returns New tier or null if not eligible
   */
  upgradeTier(communityId: string): Promise<VerificationTier | null>;

  // ===========================================================================
  // Notification Operations
  // ===========================================================================

  /**
   * Generate shadow digest for a community.
   *
   * @param communityId - Community ID
   * @returns Shadow digest content
   */
  generateDigest(communityId: string): Promise<ShadowDigest | null>;

  /**
   * Send shadow digest notification to community admins.
   *
   * @param communityId - Community ID
   * @param digest - Digest content to send
   * @returns True if notification sent successfully
   */
  sendDigestNotification(
    communityId: string,
    digest: ShadowDigest
  ): Promise<boolean>;

  /**
   * Check if community has opted into digest notifications.
   *
   * @param communityId - Community ID
   * @returns True if notifications enabled
   */
  isDigestEnabled(communityId: string): Promise<boolean>;

  /**
   * Enable or disable digest notifications for a community.
   *
   * @param communityId - Community ID
   * @param enabled - Whether to enable notifications
   */
  setDigestEnabled(communityId: string, enabled: boolean): Promise<void>;

  // ===========================================================================
  // Configuration Operations
  // ===========================================================================

  /**
   * Get coexistence configuration for a community.
   *
   * @param communityId - Community ID
   * @returns Coexistence config or null
   */
  getConfig(communityId: string): Promise<CoexistenceConfig | null>;

  /**
   * Update coexistence configuration.
   *
   * @param config - Updated configuration
   * @returns Updated config
   */
  updateConfig(config: Partial<CoexistenceConfig> & { communityId: string }): Promise<CoexistenceConfig>;

  /**
   * Get all communities in shadow mode.
   *
   * @returns Array of community IDs
   */
  getShadowModeCommunities(): Promise<string[]>;
}

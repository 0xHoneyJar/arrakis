/**
 * IParallelMode Port Interface
 *
 * Sprint S-26: Namespaced Roles & Parallel Channels
 *
 * Port interface for parallel mode operations including namespaced role
 * management and channel strategy execution.
 *
 * @see SDD §7.2 Parallel Mode Architecture
 */

import type {
  NamespacedRoleConfig,
  RoleSyncResult,
  MemberEligibility,
  ChannelStrategyConfig,
  ParallelModeConfig,
  ParallelModeStatus,
  DiscordRole,
  DiscordChannel,
} from '../domain/parallel-mode.js';

// =============================================================================
// Namespaced Role Manager Interface
// =============================================================================

/**
 * Tier configuration for role creation.
 */
export interface TierRoleConfig {
  /** Tier ID */
  id: string;
  /** Tier name (will be prefixed) */
  name: string;
  /** Role color (hex) */
  roleColor: number;
  /** Role permissions (when mode is 'inherit') */
  permissions: bigint;
}

/**
 * Port interface for namespaced role management.
 */
export interface INamespacedRoleManager {
  // ===========================================================================
  // Role Creation
  // ===========================================================================

  /**
   * Create a namespaced Arrakis role for a tier.
   * Uses synthesis engine for rate-limited Discord operations.
   *
   * @param guildId - Discord guild ID
   * @param communityId - Community ID
   * @param tierConfig - Tier configuration
   * @param config - Namespaced role configuration
   * @returns Created role name
   */
  createNamespacedRole(
    guildId: string,
    communityId: string,
    tierConfig: TierRoleConfig,
    config?: Partial<NamespacedRoleConfig>
  ): Promise<string>;

  /**
   * Create all Arrakis roles for a community's theme.
   * Batch creation via synthesis engine.
   *
   * @param guildId - Discord guild ID
   * @param communityId - Community ID
   * @param tiers - All tier configurations
   * @param config - Namespaced role configuration
   * @returns Array of created role names
   */
  createAllRoles(
    guildId: string,
    communityId: string,
    tiers: TierRoleConfig[],
    config?: Partial<NamespacedRoleConfig>
  ): Promise<string[]>;

  // ===========================================================================
  // Role Positioning
  // ===========================================================================

  /**
   * Find the position of incumbent roles in the hierarchy.
   * Used to position Arrakis roles below incumbents.
   *
   * @param guildId - Discord guild ID
   * @returns Incumbent role position or default position
   */
  findIncumbentRolePosition(guildId: string): Promise<number>;

  /**
   * Calculate target position for Arrakis roles.
   *
   * @param guildId - Discord guild ID
   * @param config - Role configuration with position strategy
   * @returns Target position for new roles
   */
  calculateRolePosition(
    guildId: string,
    config: NamespacedRoleConfig
  ): Promise<number>;

  // ===========================================================================
  // Role Sync
  // ===========================================================================

  /**
   * Sync Arrakis roles for members based on eligibility.
   * CRITICAL: Never touches incumbent roles.
   *
   * @param guildId - Discord guild ID
   * @param communityId - Community ID
   * @param members - Member eligibility list
   * @returns Sync result with counts
   */
  syncRoles(
    guildId: string,
    communityId: string,
    members: MemberEligibility[]
  ): Promise<RoleSyncResult>;

  /**
   * Sync Arrakis role for a single member.
   *
   * @param guildId - Discord guild ID
   * @param communityId - Community ID
   * @param member - Member eligibility
   * @returns Whether role was changed
   */
  syncMemberRole(
    guildId: string,
    communityId: string,
    member: MemberEligibility
  ): Promise<boolean>;

  // ===========================================================================
  // Role Queries
  // ===========================================================================

  /**
   * Get all Arrakis roles in a guild.
   *
   * @param guildId - Discord guild ID
   * @returns Array of Arrakis roles
   */
  getArrakisRoles(guildId: string): Promise<DiscordRole[]>;

  /**
   * Check if a role is an Arrakis role (has prefix).
   *
   * @param roleName - Role name to check
   * @returns True if role is Arrakis-managed
   */
  isArrakisRole(roleName: string): boolean;

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Get current role configuration for a community.
   *
   * @param communityId - Community ID
   * @returns Role configuration or null
   */
  getConfig(communityId: string): Promise<NamespacedRoleConfig | null>;

  /**
   * Update role configuration for a community.
   *
   * @param communityId - Community ID
   * @param config - New configuration
   */
  updateConfig(
    communityId: string,
    config: Partial<NamespacedRoleConfig>
  ): Promise<void>;
}

// =============================================================================
// Channel Strategy Manager Interface
// =============================================================================

/**
 * Port interface for channel strategy management.
 */
export interface IChannelStrategyManager {
  // ===========================================================================
  // Channel Creation
  // ===========================================================================

  /**
   * Create Arrakis channels based on strategy.
   *
   * @param guildId - Discord guild ID
   * @param communityId - Community ID
   * @param config - Channel strategy configuration
   * @returns Created channel IDs
   */
  createChannels(
    guildId: string,
    communityId: string,
    config: ChannelStrategyConfig
  ): Promise<string[]>;

  /**
   * Create the Arrakis category for channels.
   *
   * @param guildId - Discord guild ID
   * @param categoryName - Category name
   * @returns Category ID
   */
  createCategory(guildId: string, categoryName: string): Promise<string>;

  /**
   * Create additive conviction-gated channels.
   *
   * @param guildId - Discord guild ID
   * @param communityId - Community ID
   * @param categoryId - Parent category ID
   * @param config - Channel strategy configuration
   * @returns Created channel IDs
   */
  createAdditiveChannels(
    guildId: string,
    communityId: string,
    categoryId: string,
    config: ChannelStrategyConfig
  ): Promise<string[]>;

  /**
   * Create mirror channels for incumbent channels.
   *
   * @param guildId - Discord guild ID
   * @param communityId - Community ID
   * @param categoryId - Parent category ID
   * @param config - Channel strategy configuration
   * @returns Created channel IDs
   */
  createMirrorChannels(
    guildId: string,
    communityId: string,
    categoryId: string,
    config: ChannelStrategyConfig
  ): Promise<string[]>;

  // ===========================================================================
  // Channel Sync
  // ===========================================================================

  /**
   * Sync channel permissions based on member eligibility.
   *
   * @param guildId - Discord guild ID
   * @param communityId - Community ID
   * @param channelId - Channel to sync
   * @param members - Member eligibility list
   */
  syncChannelPermissions(
    guildId: string,
    communityId: string,
    channelId: string,
    members: MemberEligibility[]
  ): Promise<void>;

  // ===========================================================================
  // Channel Queries
  // ===========================================================================

  /**
   * Get all Arrakis channels in a guild.
   *
   * @param guildId - Discord guild ID
   * @returns Array of Arrakis channels
   */
  getArrakisChannels(guildId: string): Promise<DiscordChannel[]>;

  /**
   * Check if a channel is an Arrakis channel.
   *
   * @param channelName - Channel name to check
   * @returns True if channel is Arrakis-managed
   */
  isArrakisChannel(channelName: string): boolean;

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Get channel strategy configuration for a community.
   *
   * @param communityId - Community ID
   * @returns Channel strategy configuration or null
   */
  getConfig(communityId: string): Promise<ChannelStrategyConfig | null>;

  /**
   * Update channel strategy configuration.
   *
   * @param communityId - Community ID
   * @param config - New configuration
   */
  updateConfig(
    communityId: string,
    config: Partial<ChannelStrategyConfig>
  ): Promise<void>;
}

// =============================================================================
// Parallel Mode Orchestrator Interface
// =============================================================================

/**
 * Port interface for parallel mode orchestration.
 * Coordinates role and channel managers for full parallel mode operation.
 */
export interface IParallelMode {
  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Enable parallel mode for a community.
   * Creates all Arrakis roles and channels based on configuration.
   *
   * @param communityId - Community ID
   * @param guildId - Discord guild ID
   * @param config - Parallel mode configuration
   * @returns Whether enablement was successful
   */
  enable(
    communityId: string,
    guildId: string,
    config: Partial<ParallelModeConfig>
  ): Promise<boolean>;

  /**
   * Disable parallel mode for a community.
   * Optionally removes Arrakis roles and channels.
   *
   * @param communityId - Community ID
   * @param removeArtifacts - Whether to remove roles/channels
   * @returns Whether disablement was successful
   */
  disable(communityId: string, removeArtifacts?: boolean): Promise<boolean>;

  /**
   * Check if community meets requirements for parallel mode.
   *
   * @param communityId - Community ID
   * @returns Readiness status with details
   */
  checkReadiness(communityId: string): Promise<ParallelModeReadiness>;

  // ===========================================================================
  // Sync Operations
  // ===========================================================================

  /**
   * Run full parallel mode sync for a community.
   * Syncs all member roles and channel permissions.
   *
   * @param communityId - Community ID
   * @returns Sync result
   */
  sync(communityId: string): Promise<ParallelModeSyncResult>;

  /**
   * Sync a single member in parallel mode.
   *
   * @param communityId - Community ID
   * @param userId - Discord user ID
   * @returns Whether member was synced
   */
  syncMember(communityId: string, userId: string): Promise<boolean>;

  // ===========================================================================
  // Status & Monitoring
  // ===========================================================================

  /**
   * Get parallel mode status for a community.
   *
   * @param communityId - Community ID
   * @returns Status or null if not in parallel mode
   */
  getStatus(communityId: string): Promise<ParallelModeStatus | null>;

  /**
   * Get parallel mode configuration for a community.
   *
   * @param communityId - Community ID
   * @returns Configuration or null
   */
  getConfig(communityId: string): Promise<ParallelModeConfig | null>;

  /**
   * Update parallel mode configuration.
   *
   * @param communityId - Community ID
   * @param config - Updated configuration
   */
  updateConfig(
    communityId: string,
    config: Partial<ParallelModeConfig>
  ): Promise<void>;

  // ===========================================================================
  // Component Access
  // ===========================================================================

  /** Access to role manager */
  readonly roleManager: INamespacedRoleManager;

  /** Access to channel manager */
  readonly channelManager: IChannelStrategyManager;
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Readiness check result for parallel mode.
 */
export interface ParallelModeReadiness {
  /** Is community ready for parallel mode? */
  ready: boolean;
  /** Individual check results */
  checks: {
    /** Shadow mode duration check */
    shadowDays: {
      current: number;
      required: number;
      passed: boolean;
    };
    /** Accuracy check */
    accuracy: {
      current: number;
      required: number;
      passed: boolean;
    };
    /** Feature gate check */
    featureGate: {
      tier: string;
      hasAccess: boolean;
      passed: boolean;
    };
  };
  /** Blocking issues */
  blockers: string[];
}

/**
 * Result of parallel mode sync operation.
 */
export interface ParallelModeSyncResult {
  /** Community ID */
  communityId: string;
  /** Guild ID */
  guildId: string;
  /** When sync completed */
  syncedAt: Date;
  /** Role sync result */
  roleSync: RoleSyncResult;
  /** Number of channels synced */
  channelsSynced: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Any errors */
  errors: string[];
}

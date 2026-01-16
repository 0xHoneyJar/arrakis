/**
 * Parallel Mode Domain Types
 *
 * Sprint S-26: Namespaced Roles & Parallel Channels
 *
 * Defines domain types for parallel mode coexistence where
 * Arrakis operates alongside incumbents with isolation.
 *
 * @see SDD §7.2 Parallel Mode Architecture
 */

// =============================================================================
// Namespaced Role Types
// =============================================================================

/**
 * Position strategy for Arrakis roles relative to incumbent roles.
 *
 * - below_incumbent: Position Arrakis roles below incumbent roles (default)
 * - bottom: Position at the bottom of the role hierarchy
 * - custom: Admin-specified position
 */
export type RolePositionStrategy = 'below_incumbent' | 'bottom' | 'custom';

/**
 * Permission mode for Arrakis roles.
 *
 * - none: No permissions granted (security default)
 * - view_only: Read-only channel access
 * - inherit: Inherit from theme tier configuration
 */
export type PermissionMode = 'none' | 'view_only' | 'inherit';

/**
 * Configuration for namespaced role management.
 */
export interface NamespacedRoleConfig {
  /** Role name prefix (default: 'arrakis-') */
  prefix: string;
  /** How to position Arrakis roles relative to incumbents */
  positionStrategy: RolePositionStrategy;
  /** What permissions Arrakis roles receive */
  permissionsMode: PermissionMode;
  /** Custom position (only used when positionStrategy is 'custom') */
  customPosition?: number;
}

/**
 * Default namespaced role configuration.
 * Security-first: no permissions by default.
 */
export const DEFAULT_NAMESPACED_ROLE_CONFIG: NamespacedRoleConfig = {
  prefix: 'arrakis-',
  positionStrategy: 'below_incumbent',
  permissionsMode: 'none',
};

/**
 * Result of a role sync operation.
 */
export interface RoleSyncResult {
  /** Number of roles assigned */
  assigned: number;
  /** Number of roles removed */
  removed: number;
  /** Number of members unchanged */
  unchanged: number;
  /** Any errors encountered */
  errors?: RoleSyncError[];
}

/**
 * Error during role sync for a specific member.
 */
export interface RoleSyncError {
  /** User ID */
  userId: string;
  /** Error message */
  message: string;
  /** Whether the error is retryable */
  retryable: boolean;
}

/**
 * Member eligibility for role sync.
 */
export interface MemberEligibility {
  /** Discord user ID */
  userId: string;
  /** Is member eligible for Arrakis role? */
  eligible: boolean;
  /** Target tier name */
  tier: string | null;
  /** Current Discord roles */
  roles: string[];
}

// =============================================================================
// Channel Strategy Types
// =============================================================================

/**
 * Channel strategy for parallel mode.
 *
 * - none: No Arrakis channels created
 * - additive_only: New conviction-gated channels incumbents can't offer
 * - parallel_mirror: Arrakis versions of incumbent channels
 * - custom: Admin-defined channel structure
 */
export type ChannelStrategy = 'none' | 'additive_only' | 'parallel_mirror' | 'custom';

/**
 * Additive channel configuration.
 * Defines conviction-gated channels that incumbents can't offer.
 */
export interface AdditiveChannelConfig {
  /** Channel name (without prefix) */
  name: string;
  /** Minimum conviction score required */
  minConvictionScore: number;
  /** Channel topic/description */
  topic: string;
  /** Whether channel is read-only for qualifying members */
  readOnly: boolean;
}

/**
 * Default additive channels per SDD §7.2.1.
 */
export const DEFAULT_ADDITIVE_CHANNELS: AdditiveChannelConfig[] = [
  {
    name: 'conviction-lounge',
    minConvictionScore: 80,
    topic: 'Exclusive lounge for high-conviction holders (80+ score)',
    readOnly: false,
  },
  {
    name: 'diamond-hands',
    minConvictionScore: 95,
    topic: 'Elite channel for diamond-hand holders (95+ score)',
    readOnly: false,
  },
];

/**
 * Mirror channel configuration.
 * Creates Arrakis versions of incumbent channels.
 */
export interface MirrorChannelConfig {
  /** Source channel to mirror (incumbent channel ID or name pattern) */
  sourcePattern: string;
  /** Arrakis channel name (with prefix) */
  arrakisName: string;
  /** Minimum tier required for access */
  minTier: string;
  /** Whether to sync channel permissions from source */
  syncPermissions: boolean;
}

/**
 * Custom channel configuration.
 */
export interface CustomChannelConfig {
  /** Channel name */
  name: string;
  /** Channel type (0 = text, 2 = voice) */
  type: 0 | 2;
  /** Required tier or conviction score */
  requirement: {
    type: 'tier' | 'conviction';
    value: string | number;
  };
  /** Channel topic */
  topic: string;
  /** Parent category ID */
  parentId?: string;
}

/**
 * Full channel strategy configuration.
 */
export interface ChannelStrategyConfig {
  /** Strategy type */
  strategy: ChannelStrategy;
  /** Additive channels (when strategy is additive_only) */
  additiveChannels?: AdditiveChannelConfig[];
  /** Mirror channels (when strategy is parallel_mirror) */
  mirrorChannels?: MirrorChannelConfig[];
  /** Custom channels (when strategy is custom) */
  customChannels?: CustomChannelConfig[];
  /** Channel name prefix */
  channelPrefix: string;
  /** Category name for Arrakis channels */
  categoryName: string;
}

/**
 * Default channel strategy configuration.
 */
export const DEFAULT_CHANNEL_STRATEGY_CONFIG: ChannelStrategyConfig = {
  strategy: 'none',
  channelPrefix: 'arrakis-',
  categoryName: 'Arrakis',
};

// =============================================================================
// Parallel Mode Configuration
// =============================================================================

/**
 * Full parallel mode configuration for a community.
 */
export interface ParallelModeConfig {
  /** Community ID */
  communityId: string;
  /** Discord guild ID */
  guildId: string;
  /** Is parallel mode enabled? */
  enabled: boolean;
  /** Namespaced role configuration */
  roleConfig: NamespacedRoleConfig;
  /** Channel strategy configuration */
  channelConfig: ChannelStrategyConfig;
  /** When parallel mode was enabled */
  enabledAt: Date | null;
  /** Shadow mode accuracy when parallel was enabled */
  entryAccuracy: number | null;
  /** Shadow days when parallel was enabled */
  entryShadowDays: number | null;
}

/**
 * Parallel mode status for monitoring.
 */
export interface ParallelModeStatus {
  /** Community ID */
  communityId: string;
  /** Is parallel mode active? */
  active: boolean;
  /** Number of Arrakis roles created */
  arrakisRolesCount: number;
  /** Number of Arrakis channels created */
  arrakisChannelsCount: number;
  /** Number of members with Arrakis roles */
  membersWithArrakisRoles: number;
  /** Sync health status */
  syncHealth: 'healthy' | 'degraded' | 'failed';
  /** Last sync time */
  lastSyncAt: Date | null;
  /** Any active errors */
  errors: string[];
}

// =============================================================================
// Discord Role Types
// =============================================================================

/**
 * Discord role representation.
 */
export interface DiscordRole {
  /** Role ID */
  id: string;
  /** Role name */
  name: string;
  /** Role color (hex value) */
  color: number;
  /** Role position in hierarchy */
  position: number;
  /** Role permissions bitfield */
  permissions: bigint;
  /** Is role hoisted (displayed separately)? */
  hoist: boolean;
  /** Is role managed by an integration? */
  managed: boolean;
  /** Is role mentionable? */
  mentionable: boolean;
}

/**
 * Discord channel representation.
 */
export interface DiscordChannel {
  /** Channel ID */
  id: string;
  /** Channel name */
  name: string;
  /** Channel type (0 = text, 2 = voice, 4 = category) */
  type: number;
  /** Parent category ID */
  parentId: string | null;
  /** Channel position */
  position: number;
  /** Channel topic */
  topic: string | null;
}

// =============================================================================
// Events
// =============================================================================

/**
 * Event types for parallel mode operations.
 */
export type ParallelModeEventType =
  | 'parallel_mode.enabled'
  | 'parallel_mode.disabled'
  | 'parallel_mode.role.created'
  | 'parallel_mode.role.assigned'
  | 'parallel_mode.role.removed'
  | 'parallel_mode.channel.created'
  | 'parallel_mode.sync.completed'
  | 'parallel_mode.error';

/**
 * Parallel mode event payload.
 */
export interface ParallelModeEvent {
  /** Event type */
  type: ParallelModeEventType;
  /** Community ID */
  communityId: string;
  /** Guild ID */
  guildId: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event-specific data */
  data: Record<string, unknown>;
}

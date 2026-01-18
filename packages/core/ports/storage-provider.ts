/**
 * Storage Provider Interface
 *
 * Sprint S-19: Enhanced RLS & Drizzle Adapter
 *
 * Defines the contract for storage operations in a multi-tenant environment.
 * All implementations must handle tenant isolation transparently via RLS.
 *
 * @see SDD §6.3 PostgreSQL Multi-Tenant
 * @module packages/core/ports/storage-provider
 */

// =============================================================================
// Common Types
// =============================================================================

/**
 * Subscription tier for community access levels
 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/**
 * Community entity representing a tenant
 */
export interface Community {
  id: string;
  name: string;
  themeId: string;
  subscriptionTier: SubscriptionTier;
  discordGuildId: string | null;
  telegramChatId: string | null;
  isActive: boolean;
  settings: CommunitySettings;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Community settings stored as JSONB
 */
export interface CommunitySettings {
  rolePrefix?: string;
  autoSync?: boolean;
  syncInterval?: number;
  welcomeMessage?: string;
  adminWebhook?: string;
}

/**
 * New community input (for creation)
 */
export type NewCommunity = Omit<Community, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Profile entity representing a community member
 */
export interface Profile {
  id: string;
  communityId: string;
  discordId: string | null;
  telegramId: string | null;
  walletAddress: string | null;
  tier: string | null;
  currentRank: number | null;
  activityScore: number;
  convictionScore: number;
  joinedAt: Date;
  lastSeenAt: Date;
  firstClaimAt: Date | null;
  metadata: ProfileMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Profile metadata stored as JSONB
 */
export interface ProfileMetadata {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  ensName?: string;
  highestTier?: string;
  highestRank?: number;
  bio?: string;
  pfpUrl?: string;
  notifications?: NotificationPreferences;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  positionUpdates: boolean;
  atRiskWarnings: boolean;
  naibAlerts: boolean;
  frequency: '1_per_week' | '2_per_week' | '3_per_week' | 'daily';
  alertsSentThisWeek: number;
}

/**
 * New profile input (for creation)
 */
export type NewProfile = Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Badge entity representing an awarded badge
 */
export interface Badge {
  id: string;
  communityId: string;
  profileId: string;
  badgeType: string;
  awardedAt: Date;
  awardedBy: string | null;
  revokedAt: Date | null;
  metadata: BadgeMetadata;
  createdAt: Date;
}

/**
 * Badge metadata stored as JSONB
 */
export interface BadgeMetadata {
  badgeName?: string;
  name?: string;
  description?: string;
  emoji?: string;
  category?: string;
  tierAtAward?: string;
  rankAtAward?: number;
  reason?: string;
}

/**
 * New badge input (for creation)
 */
export type NewBadge = Omit<Badge, 'id' | 'createdAt'>;

/**
 * Query options for pagination and filtering
 */
export interface QueryOptions {
  /** Number of items to return (default: 50, max: 1000) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Order by field */
  orderBy?: string;
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Result of a paginated query
 */
export interface PaginatedResult<T> {
  /** Items for the current page */
  items: T[];
  /** Total count of items */
  total: number;
  /** Whether there are more items */
  hasMore: boolean;
}

/**
 * Badge lineage node for referral chains
 */
export interface BadgeLineageNode {
  /** Badge ID */
  badgeId: string;
  /** Profile ID of badge owner */
  profileId: string;
  /** Display name of badge owner */
  displayName: string | null;
  /** When the badge was awarded */
  awardedAt: Date;
  /** Depth in lineage tree (0 = root) */
  depth: number;
}

// =============================================================================
// Storage Provider Interface
// =============================================================================

/**
 * IStorageProvider defines the contract for multi-tenant storage operations.
 *
 * Implementations:
 * - DrizzleStorageAdapter: PostgreSQL with RLS
 *
 * All operations are automatically scoped to the tenant (community) specified
 * during construction. Cross-tenant access is prevented at the database level
 * via Row-Level Security (RLS) policies.
 *
 * Security guarantees:
 * - Cross-tenant queries return empty results (not errors)
 * - Tenant context not set = no rows visible
 * - INSERT/UPDATE with wrong community_id = permission denied
 *
 * @see SDD §6.3.2 RLS Policies
 */
export interface IStorageProvider {
  // ===========================================================================
  // Tenant Context
  // ===========================================================================

  /**
   * Get the current tenant ID
   */
  readonly tenantId: string;

  // ===========================================================================
  // Community Operations
  // ===========================================================================

  /**
   * Get community by ID
   * Note: Community lookup may bypass RLS for initial tenant resolution
   */
  getCommunity(id: string): Promise<Community | null>;

  /**
   * Get community by Discord guild ID
   */
  getCommunityByDiscordGuild(guildId: string): Promise<Community | null>;

  /**
   * Get community by Telegram chat ID
   */
  getCommunityByTelegramChat(chatId: string): Promise<Community | null>;

  /**
   * Create a new community
   */
  createCommunity(data: NewCommunity): Promise<Community>;

  /**
   * Update an existing community
   */
  updateCommunity(id: string, data: Partial<NewCommunity>): Promise<Community | null>;

  /**
   * Soft delete a community (set isActive = false)
   */
  deactivateCommunity(id: string): Promise<boolean>;

  // ===========================================================================
  // Profile Operations
  // ===========================================================================

  /**
   * Get profile by ID
   */
  getProfile(id: string): Promise<Profile | null>;

  /**
   * Get profile by Discord ID
   */
  getProfileByDiscordId(discordId: string): Promise<Profile | null>;

  /**
   * Get profile by Telegram ID
   */
  getProfileByTelegramId(telegramId: string): Promise<Profile | null>;

  /**
   * Get profile by wallet address
   */
  getProfileByWallet(walletAddress: string): Promise<Profile | null>;

  /**
   * Get all profiles (with pagination)
   */
  getProfiles(options?: QueryOptions): Promise<PaginatedResult<Profile>>;

  /**
   * Get profiles by tier
   */
  getProfilesByTier(tier: string, options?: QueryOptions): Promise<PaginatedResult<Profile>>;

  /**
   * Create a new profile
   */
  createProfile(data: NewProfile): Promise<Profile>;

  /**
   * Update an existing profile
   */
  updateProfile(id: string, data: Partial<NewProfile>): Promise<Profile | null>;

  /**
   * Delete a profile
   */
  deleteProfile(id: string): Promise<boolean>;

  /**
   * Update last seen timestamp
   */
  touchProfile(id: string): Promise<void>;

  // ===========================================================================
  // Badge Operations
  // ===========================================================================

  /**
   * Get badge by ID
   */
  getBadge(id: string): Promise<Badge | null>;

  /**
   * Get all badges for a profile
   */
  getBadgesForProfile(profileId: string): Promise<Badge[]>;

  /**
   * Get badges by type
   */
  getBadgesByType(badgeType: string, options?: QueryOptions): Promise<PaginatedResult<Badge>>;

  /**
   * Check if profile has a specific badge type
   */
  hasBadge(profileId: string, badgeType: string): Promise<boolean>;

  /**
   * Award a badge to a profile
   */
  awardBadge(data: NewBadge): Promise<Badge>;

  /**
   * Revoke a badge
   */
  revokeBadge(badgeId: string): Promise<boolean>;

  /**
   * Get badge lineage (referral chain)
   * Uses recursive CTE to traverse the awarded_by chain.
   */
  getBadgeLineage(badgeId: string, maxDepth?: number): Promise<BadgeLineageNode[]>;

  /**
   * Get badges awarded by a profile (descendants)
   */
  getBadgesAwardedBy(profileId: string): Promise<Badge[]>;

  // ===========================================================================
  // Transaction Support
  // ===========================================================================

  /**
   * Execute operations within a transaction
   *
   * @param fn - Async function containing operations
   * @returns Result of the function
   * @throws Rolls back on error
   */
  transaction<T>(fn: (tx: IStorageProvider) => Promise<T>): Promise<T>;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Close database connections
   */
  close(): Promise<void>;
}

// =============================================================================
// Factory Types
// =============================================================================

/**
 * Options for creating a storage provider
 */
export interface StorageProviderOptions {
  /** Database connection string */
  connectionString: string;
  /** Tenant ID for RLS scoping */
  tenantId: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Factory function type for creating storage providers
 */
export type StorageProviderFactory = (
  options: StorageProviderOptions
) => Promise<IStorageProvider>;

// =============================================================================
// Validation
// =============================================================================

/**
 * Validation result for storage provider operations
 */
export interface StorageValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a community ID is a valid UUID
 */
export function isValidCommunityId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates subscription tier
 */
export function isValidSubscriptionTier(value: unknown): value is SubscriptionTier {
  return value === 'free' || value === 'pro' || value === 'enterprise';
}

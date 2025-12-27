/**
 * Sietch Unified - Shared Type Definitions
 * 
 * Core types for cross-platform identity bridging and conviction metrics.
 */

// =============================================================================
// IDENTITY TYPES
// =============================================================================

/** Supported platforms for identity linking */
export type Platform = 'discord' | 'telegram' | 'wallet';

/** Wallet chain types */
export type Chain = 'ethereum' | 'solana' | 'berachain';

/**
 * A linked social account - part of UnifiedIdentity
 */
export interface LinkedAccount {
  platform: Platform;
  platformId: string;          // Discord UID or Telegram UID
  username?: string;           // Display name on platform
  linkedAt: Date;
  verifiedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * A verified wallet address - part of UnifiedIdentity
 */
export interface LinkedWallet {
  address: string;             // Checksummed address
  chain: Chain;
  isPrimary: boolean;
  verifiedAt: Date;
  verificationMethod: 'signature' | 'collabland' | 'manual';
}

/**
 * Unified Identity - The "Diplomatic Passport"
 * Bridges Discord/Telegram UIDs to verified wallet addresses
 */
export interface UnifiedIdentity {
  id: string;                  // Internal UUID
  primaryWallet: string;       // Primary wallet address (source of truth)
  wallets: LinkedWallet[];
  accounts: LinkedAccount[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Identity lookup result from Collab.Land AccountKit
 */
export interface AccountKitIdentity {
  discordId?: string;
  telegramId?: string;
  walletAddresses: string[];
  primaryWallet?: string;
  verified: boolean;
}

// =============================================================================
// CONVICTION TYPES
// =============================================================================

/** Conviction tier names */
export type TierName = 'naib' | 'fedaykin' | 'none';

/**
 * A single conviction metric definition from config
 */
export interface ConvictionMetric {
  name: string;
  description: string;
  weight: number;              // 0.0 - 1.0
  source: MetricSource;
  normalization: 'percentile' | 'linear' | 'log';
  filters?: MetricFilter[];
  decay?: {
    enabled: boolean;
    rate: number;              // e.g., 0.10 for 10%
    interval: number;          // seconds
  };
}

/**
 * Data source for a conviction metric
 */
export interface MetricSource {
  type: 'dune' | 'onchain' | 'internal';
  queryId?: number;            // Dune query ID
  parameters?: Record<string, unknown>;
  refreshInterval?: number;    // seconds
  service?: string;            // Internal service name
}

/**
 * Filter applied to conviction metric
 */
export interface MetricFilter {
  type: string;
  description: string;
  duneQueryId?: number;
}

/**
 * Tier definition from config
 */
export interface TierDefinition {
  name: string;
  description: string;
  rankRange: [number, number];
  color: string;
  discordRoleId: string;
  telegramBadge: string;
  permissions: string[];
  channels: {
    discord: string[];
    telegram: string[];
  };
}

/**
 * User's conviction evaluation result
 */
export interface ConvictionResult {
  walletAddress: string;
  tier: TierName;
  rank: number;
  totalScore: number;
  metrics: {
    [metricName: string]: {
      rawValue: number;
      normalizedValue: number;
      weight: number;
      weightedScore: number;
    };
  };
  eligible: boolean;
  disqualificationReason?: string;
  evaluatedAt: Date;
  expiresAt: Date;
}

/**
 * Composite rule for AND/OR logic
 */
export interface CompositeRule {
  name: string;
  conditions: {
    operator: 'AND' | 'OR';
    rules: Array<{
      metric: string;
      minPercentile?: number;
      minValue?: number;
      maxValue?: number;
    }>;
  };
}

// =============================================================================
// PROFILE / SOCIAL TYPES
// =============================================================================

/** Badge types available in the system */
export type BadgeType = 
  // Tenure badges
  | 'first_wave'
  | 'veteran'
  | 'diamond_hands'
  // Achievement badges
  | 'council'
  | 'survivor'
  | 'streak_master'
  // Activity badges
  | 'engaged'
  | 'contributor'
  | 'pillar';

/**
 * User badge with metadata
 */
export interface Badge {
  type: BadgeType;
  name: string;
  description: string;
  earnedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * User profile (pseudonymous)
 */
export interface UserProfile {
  id: string;
  unifiedIdentityId: string;
  nym: string;                 // Pseudonymous name
  bio?: string;
  avatar?: string;             // IPFS hash or URL
  visibility: 'public' | 'members_only' | 'private';
  badges: Badge[];
  tier: TierName;
  rank: number;
  activityScore: number;
  tenure: {
    joinedAt: Date;
    daysActive: number;
  };
  platforms: {
    discord?: { serverId: string; roles: string[] };
    telegram?: { chatId: string };
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Activity tracking entry
 */
export interface ActivityEntry {
  id: string;
  profileId: string;
  platform: Platform;
  actionType: 'message' | 'reaction' | 'voice' | 'command';
  points: number;
  timestamp: Date;
}

// =============================================================================
// DIRECTORY / SEARCH TYPES
// =============================================================================

/**
 * Directory filter options
 */
export interface DirectoryFilters {
  tier?: TierName;
  badge?: BadgeType;
  minActivityScore?: number;
  platform?: Platform;
  search?: string;             // Search nym
}

/**
 * Directory entry (privacy-respecting)
 */
export interface DirectoryEntry {
  nym: string;
  tier: TierName;
  badges: BadgeType[];
  activityScore: number;
  joinedAt: Date;
  lastActiveAt: Date;
}

/**
 * Paginated directory response
 */
export interface DirectoryResponse {
  members: DirectoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// HANDSHAKE / CROSS-PLATFORM TYPES
// =============================================================================

/**
 * Handshake verification request
 */
export interface HandshakeRequest {
  sourcePlatform: Platform;
  sourcePlatformId: string;
  walletAddress: string;
  signature?: string;          // For wallet verification
}

/**
 * Handshake verification result
 */
export interface HandshakeResult {
  success: boolean;
  unifiedIdentityId: string;
  linkedPlatforms: Platform[];
  tier: TierName;
  rolesGranted: {
    discord?: string[];
    telegram?: string[];
  };
  error?: string;
}

/**
 * Role sync event
 */
export interface RoleSyncEvent {
  unifiedIdentityId: string;
  previousTier: TierName;
  newTier: TierName;
  platforms: Platform[];
  timestamp: Date;
  reason: 'eligibility_change' | 'manual' | 'handshake';
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
  };
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    collab_land: 'up' | 'down';
    dune: 'up' | 'down';
  };
}

// =============================================================================
// CONFIG TYPES
// =============================================================================

/**
 * Parsed conviction metrics configuration
 */
export interface ConvictionConfig {
  version: string;
  community: {
    name: string;
    description: string;
    theme: string;
  };
  tiers: Record<TierName, TierDefinition>;
  metrics: Record<string, ConvictionMetric>;
  compositeRules: Record<string, CompositeRule>;
  dataSources: {
    dune: DuneConfig;
    berachain: ChainConfig;
    collab_land: CollabLandConfig;
  };
  automation: AutomationConfig;
  handshake: HandshakeConfig;
  privacy: PrivacyConfig;
  security: SecurityConfig;
}

export interface DuneConfig {
  apiBase: string;
  apiKey: string;
  rateLimit: { requestsPerMinute: number; burst: number };
  cache: { enabled: boolean; ttl: number };
}

export interface ChainConfig {
  rpcUrl: string;
  fallbackUrls: string[];
  contracts: Record<string, string>;
}

export interface CollabLandConfig {
  apiBase: string;
  apiKey: string;
}

export interface AutomationConfig {
  eligibilitySync: { enabled: boolean; cron: string; timeout: number };
  activityDecay: { enabled: boolean; cron: string; timeout: number };
  badgeCheck: { enabled: boolean; cron: string; timeout: number };
  reverify: { enabled: boolean; cron: string; timeout: number };
}

export interface HandshakeConfig {
  discordToTelegram: { enabled: boolean; delay: number };
  telegramToDiscord: { enabled: boolean; delay: number };
  verificationTtl: number;
  gracePeriod: number;
}

export interface PrivacyConfig {
  chathamHouse: boolean;
  defaultVisibility: 'public' | 'members_only' | 'private';
  allowPseudonyms: boolean;
  requireWallet: boolean;
}

export interface SecurityConfig {
  rateLimit: { requestsPerMinute: number; perIp: boolean };
  telegramVerifyInitData: boolean;
  discordScopes: string[];
}

// =============================================================================
// BILLING / SUBSCRIPTION TYPES
// =============================================================================

/** Subscription tier names aligned with Collab.Land */
export type SubscriptionTier = 
  | 'starter'
  | 'basic'
  | 'premium'
  | 'exclusive'
  | 'elite'
  | 'enterprise';

/** Subscription status */
export type SubscriptionStatus = 
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'trialing';

/**
 * Feature flags that can be gated by tier
 */
export type GatedFeature =
  | 'basic_tgrs'
  | 'background_checks'
  | 'role_composition'
  | 'conviction_engine'
  | 'member_directory'
  | 'pro_miniapps'
  | 'priority_support'
  | 'custom_branding'
  | 'ai_quiz_agent'
  | 'white_label'
  | 'naib_tier_access'
  | 'fedaykin_tier_access'
  | 'stillsuit_channels';

/**
 * Community subscription record
 */
export interface CommunitySubscription {
  id: string;
  communityId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  graceUntil?: Date;
  cancelledAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

/**
 * Entitlement check result
 */
export interface EntitlementResult {
  allowed: boolean;
  reason: 
    | 'tier_sufficient'
    | 'grace_period_active'
    | 'tier_insufficient'
    | 'subscription_expired'
    | 'member_limit_exceeded'
    | 'feature_disabled'
    | 'identity_not_verified';
  tier: SubscriptionTier;
  graceRemaining?: number;
  upgradeRequired?: SubscriptionTier;
  upgradeUrl?: string;
}

/**
 * Subscription tier limits
 */
export interface TierLimits {
  verifiedMembers: number;
  tgrs: number;
  adminBalanceChecks: number;
}

/**
 * Subscription tier details
 */
export interface TierDetails {
  name: string;
  price: number | null;
  priceYearly: number | null;
  limits: TierLimits;
  features: GatedFeature[];
  gracePeriodHours: number;
}

/**
 * Billing portal session
 */
export interface BillingPortalSession {
  url: string;
  expiresAt: Date;
}

/**
 * Checkout session creation params
 */
export interface CreateCheckoutParams {
  tier: SubscriptionTier;
  interval: 'monthly' | 'yearly';
  communityId: string;
  successUrl: string;
  cancelUrl: string;
}

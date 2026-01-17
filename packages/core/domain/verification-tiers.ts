/**
 * Verification Tiers Domain Types
 *
 * Sprint S-25: Shadow Sync Job & Verification Tiers
 *
 * Defines verification tiers that control feature access during
 * shadow and parallel modes of coexistence.
 *
 * @see SDD §7.1 Shadow Mode Architecture
 */

// =============================================================================
// Verification Tier Definitions
// =============================================================================

/**
 * Verification tier levels.
 *
 * - incumbent_only: Shadow mode, only tracking without Arrakis features
 * - arrakis_basic: Parallel mode with basic Arrakis features
 * - arrakis_full: Full Arrakis features (primary mode)
 */
export type VerificationTier = 'incumbent_only' | 'arrakis_basic' | 'arrakis_full';

/**
 * Feature identifiers for gating.
 */
export type Feature =
  // Tier 1: incumbent_only features
  | 'shadow_tracking'
  | 'public_leaderboard_hidden_wallets'
  | 'admin_shadow_digest'
  // Tier 2: arrakis_basic features
  | 'profile_view'
  | 'conviction_preview'
  | 'position_check'
  | 'threshold_check'
  // Tier 3: arrakis_full features
  | 'full_badges'
  | 'tier_progression'
  | 'social_features'
  | 'profile_directory'
  | 'badge_showcase'
  | 'conviction_alerts'
  | 'role_management'
  | 'channel_gating';

/**
 * Feature set definition for a verification tier.
 */
export interface FeatureSet {
  /** Tier identifier */
  tier: VerificationTier;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Features included in this tier */
  features: Feature[];
  /** Features from lower tiers are inherited */
  inheritsFrom: VerificationTier | null;
}

// =============================================================================
// Feature Set Definitions
// =============================================================================

/**
 * Tier 1: incumbent_only feature set.
 *
 * Shadow tracking, public leaderboard (hidden wallets), admin shadow digest.
 * Used during pure shadow mode when incumbent is still active.
 */
export const TIER_1_FEATURES: FeatureSet = {
  tier: 'incumbent_only',
  name: 'Shadow Mode',
  description: 'Track divergences without affecting members. Prove accuracy before migration.',
  features: [
    'shadow_tracking',
    'public_leaderboard_hidden_wallets',
    'admin_shadow_digest',
  ],
  inheritsFrom: null,
};

/**
 * Tier 2: arrakis_basic feature set.
 *
 * Profile view, conviction preview, position check, threshold check.
 * Used during parallel mode when Arrakis runs alongside incumbent.
 */
export const TIER_2_FEATURES: FeatureSet = {
  tier: 'arrakis_basic',
  name: 'Parallel Mode',
  description: 'Basic Arrakis features alongside incumbent provider.',
  features: [
    'profile_view',
    'conviction_preview',
    'position_check',
    'threshold_check',
  ],
  inheritsFrom: 'incumbent_only',
};

/**
 * Tier 3: arrakis_full feature set.
 *
 * Full badges, tier progression, social features, profile directory,
 * badge showcase, conviction alerts, role management, channel gating.
 * Used when Arrakis is the primary provider.
 */
export const TIER_3_FEATURES: FeatureSet = {
  tier: 'arrakis_full',
  name: 'Full Mode',
  description: 'Complete Arrakis experience with all features enabled.',
  features: [
    'full_badges',
    'tier_progression',
    'social_features',
    'profile_directory',
    'badge_showcase',
    'conviction_alerts',
    'role_management',
    'channel_gating',
  ],
  inheritsFrom: 'arrakis_basic',
};

/**
 * All feature sets indexed by tier.
 */
export const FEATURE_SETS: Record<VerificationTier, FeatureSet> = {
  incumbent_only: TIER_1_FEATURES,
  arrakis_basic: TIER_2_FEATURES,
  arrakis_full: TIER_3_FEATURES,
};

// =============================================================================
// Feature Access Utilities
// =============================================================================

/**
 * Get all features available for a given tier (including inherited features).
 *
 * @param tier - Verification tier
 * @returns Array of all available features
 */
export function getFeaturesForTier(tier: VerificationTier): Feature[] {
  const features: Feature[] = [];
  let currentTier: VerificationTier | null = tier;

  while (currentTier) {
    const featureSet: FeatureSet = FEATURE_SETS[currentTier];
    features.push(...featureSet.features);
    currentTier = featureSet.inheritsFrom;
  }

  return features;
}

/**
 * Check if a feature is available at a given tier.
 *
 * @param feature - Feature to check
 * @param tier - Current verification tier
 * @returns True if feature is available
 */
export function isFeatureAvailable(feature: Feature, tier: VerificationTier): boolean {
  return getFeaturesForTier(tier).includes(feature);
}

/**
 * Get the minimum tier required for a feature.
 *
 * @param feature - Feature to check
 * @returns Minimum tier required or null if feature not found
 */
export function getMinimumTierForFeature(feature: Feature): VerificationTier | null {
  // Check tiers in order from lowest to highest
  const tierOrder: VerificationTier[] = ['incumbent_only', 'arrakis_basic', 'arrakis_full'];

  for (const tier of tierOrder) {
    if (FEATURE_SETS[tier].features.includes(feature)) {
      return tier;
    }
  }

  return null;
}

/**
 * Compare two tiers to determine which is higher.
 *
 * @param tier1 - First tier
 * @param tier2 - Second tier
 * @returns Negative if tier1 < tier2, positive if tier1 > tier2, 0 if equal
 */
export function compareTiers(tier1: VerificationTier, tier2: VerificationTier): number {
  const tierOrder: VerificationTier[] = ['incumbent_only', 'arrakis_basic', 'arrakis_full'];
  return tierOrder.indexOf(tier1) - tierOrder.indexOf(tier2);
}

// =============================================================================
// Community Verification Status
// =============================================================================

/**
 * Verification status for a community.
 */
export interface CommunityVerificationStatus {
  /** Community ID */
  communityId: string;
  /** Discord guild ID */
  guildId: string;
  /** Current verification tier */
  tier: VerificationTier;
  /** Days in current tier */
  daysInTier: number;
  /** Shadow mode accuracy (if applicable) */
  shadowAccuracy: number | null;
  /** When tier was last updated */
  tierUpdatedAt: Date;
  /** Requirements for next tier */
  nextTierRequirements: TierUpgradeRequirements | null;
}

/**
 * Requirements to upgrade to the next tier.
 */
export interface TierUpgradeRequirements {
  /** Target tier */
  targetTier: VerificationTier;
  /** Minimum shadow days required */
  minShadowDays: number;
  /** Current shadow days */
  currentShadowDays: number;
  /** Minimum accuracy required (0-1) */
  minAccuracy: number;
  /** Current accuracy */
  currentAccuracy: number;
  /** Whether requirements are met */
  requirementsMet: boolean;
}

/**
 * Default requirements for tier upgrades.
 */
export const DEFAULT_TIER_UPGRADE_REQUIREMENTS = {
  // From incumbent_only to arrakis_basic
  arrakis_basic: {
    minShadowDays: 14,
    minAccuracy: 0.95,
  },
  // From arrakis_basic to arrakis_full
  arrakis_full: {
    minShadowDays: 30,
    minAccuracy: 0.98,
  },
} as const;

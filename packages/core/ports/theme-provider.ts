/**
 * Theme Provider Port Interface
 * Sprint S-17: Theme Interface & BasicTheme
 *
 * Defines the contract for theme implementations in Arrakis.
 * Themes provide tier configurations, badge definitions, and evaluation logic.
 *
 * @see SDD §6.2.2 Theme System
 */

// --------------------------------------------------------------------------
// Subscription Tiers
// --------------------------------------------------------------------------

/** Subscription tier levels */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

// --------------------------------------------------------------------------
// Badge Evaluator Types
// --------------------------------------------------------------------------

/**
 * Badge evaluator type identifiers
 *
 * Basic types (BasicTheme):
 * - join_order: Early member badges (first N joiners)
 * - tenure: Membership duration badges
 * - tier_reached: Achievement badges for reaching tiers
 * - recent_activity: Active member badges
 * - manual_grant: Manually granted badges
 *
 * Advanced types (SietchTheme):
 * - balance_stability: Never dropped balance
 * - market_survival: Survived market downturns
 * - activity_streak: Consecutive activity periods
 * - event_participation: Community event attendance
 * - rank_tenure: Maintained top rank over time
 * - referrals: Member referral counts
 */
export type BadgeEvaluatorType =
  // Basic evaluators (S-17)
  | 'join_order'
  | 'tenure'
  | 'tier_reached'
  | 'recent_activity'
  | 'manual_grant'
  // Advanced evaluators (S-18, SietchTheme)
  | 'balance_stability'
  | 'market_survival'
  | 'activity_streak'
  | 'event_participation'
  | 'rank_tenure'
  | 'referrals';

/**
 * Badge rarity levels
 * Used for display and sorting
 */
export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// --------------------------------------------------------------------------
// Tier Configuration
// --------------------------------------------------------------------------

/**
 * Tier configuration model
 *
 * Defines a single tier in the theme's tier hierarchy.
 * Tiers are ranked by minRank/maxRank which map to Score Service rankings.
 *
 * @example
 * {
 *   id: 'gold',
 *   name: 'Gold',
 *   displayName: 'Gold Member',
 *   minRank: 1,
 *   maxRank: 10,
 *   roleColor: 0xFFD700,
 *   permissions: ['view_analytics', 'priority_support'],
 *   emoji: '🥇'
 * }
 */
export interface TierConfig {
  /** Unique tier identifier */
  id: string;
  /** Internal name */
  name: string;
  /** User-facing display name */
  displayName: string;
  /** Minimum rank (inclusive) for this tier */
  minRank: number;
  /** Maximum rank (inclusive) for this tier */
  maxRank: number;
  /** Discord role color (hex format, e.g., 0xFFD700) */
  roleColor: number;
  /** Permissions granted to this tier */
  permissions: string[];
  /** Optional emoji for display */
  emoji?: string;
}

// --------------------------------------------------------------------------
// Badge Configuration
// --------------------------------------------------------------------------

/**
 * Badge configuration model
 *
 * Defines a badge with its evaluation criteria.
 * The evaluator field determines how the badge is earned.
 *
 * @example
 * {
 *   id: 'early_adopter',
 *   name: 'Early Adopter',
 *   displayName: 'Early Adopter',
 *   description: 'One of the first 100 members',
 *   emoji: '🌟',
 *   evaluator: 'join_order',
 *   parameters: { maxPosition: 100 },
 *   rarity: 'rare'
 * }
 */
export interface BadgeConfig {
  /** Unique badge identifier */
  id: string;
  /** Internal name */
  name: string;
  /** User-facing display name */
  displayName: string;
  /** Description shown to users */
  description: string;
  /** Emoji for display */
  emoji: string;
  /** Evaluator type that determines how badge is earned */
  evaluator: BadgeEvaluatorType;
  /** Parameters for the evaluator */
  parameters: Record<string, unknown>;
  /** Badge rarity for display/sorting */
  rarity: BadgeRarity;
}

// --------------------------------------------------------------------------
// Naming Configuration
// --------------------------------------------------------------------------

/**
 * Naming configuration for theme customization
 *
 * Allows themes to customize labels and terminology.
 *
 * @example BasicTheme:
 * {
 *   tierPrefix: 'Rank',
 *   tierSuffix: '',
 *   communityNoun: 'Members',
 *   leaderboardTitle: 'Top Holders',
 *   scoreLabel: 'Score'
 * }
 *
 * @example SietchTheme:
 * {
 *   tierPrefix: '',
 *   tierSuffix: '',
 *   communityNoun: 'Fremen',
 *   leaderboardTitle: 'Conviction Rankings',
 *   scoreLabel: 'Conviction'
 * }
 */
export interface NamingConfig {
  /** Prefix before tier name (e.g., "Rank" → "Rank Gold") */
  tierPrefix: string;
  /** Suffix after tier name (e.g., "Member" → "Gold Member") */
  tierSuffix: string;
  /** Noun for community members */
  communityNoun: string;
  /** Title for leaderboard displays */
  leaderboardTitle: string;
  /** Label for score/conviction values */
  scoreLabel: string;
}

// --------------------------------------------------------------------------
// Evaluation Types
// --------------------------------------------------------------------------

/**
 * Result of tier evaluation
 *
 * Contains the matched tier and context about the member's position.
 */
export interface TierResult {
  /** The evaluated tier configuration */
  tier: TierConfig;
  /** Member's score value */
  score: number;
  /** Member's rank in the community */
  rank: number;
  /** Percentile position (0-100) */
  percentile: number;
}

/**
 * Earned badge result
 *
 * Contains badge info and when it was earned.
 */
export interface EarnedBadge {
  /** Badge configuration */
  badge: BadgeConfig;
  /** When the badge was earned (null if not time-tracked) */
  earnedAt: Date | null;
  /** Additional metadata about how it was earned */
  metadata?: Record<string, unknown>;
}

// --------------------------------------------------------------------------
// Profile Types (for badge evaluation)
// --------------------------------------------------------------------------

/**
 * Member profile for badge evaluation
 *
 * Contains current state needed for badge evaluators.
 */
export interface Profile {
  /** Member's unique ID */
  userId: string;
  /** Community ID */
  communityId: string;
  /** Current score/conviction */
  score: number;
  /** Current rank */
  rank: number;
  /** Current tier ID */
  tierId: string;
  /** When member joined */
  joinedAt: Date;
  /** Join order position (1 = first member) */
  joinPosition: number;
  /** Manually granted badge IDs */
  manualBadges: string[];
}

/**
 * Profile history for time-based badge evaluators
 *
 * Contains historical data for tenure, activity, and stability badges.
 */
export interface ProfileHistory {
  /** Days since joining */
  tenureDays: number;
  /** Days since last activity */
  daysSinceLastActivity: number;
  /** Consecutive days of activity */
  activityStreakDays: number;
  /** Whether balance ever dropped */
  balanceEverDropped: boolean;
  /** Number of market downturns survived */
  marketDownturnsSurvived: number;
  /** Number of community events attended */
  eventsAttended: number;
  /** Days at current rank or better */
  daysAtRankOrBetter: number;
  /** Number of successful referrals */
  referralCount: number;
  /** Historical tier IDs achieved */
  tiersReached: string[];
}

// --------------------------------------------------------------------------
// Theme Provider Interface
// --------------------------------------------------------------------------

/**
 * Theme Provider Interface
 *
 * Defines the contract for theme implementations.
 * Themes are loaded by the ThemeRegistry and provide tier/badge configuration
 * for communities based on their subscription level.
 *
 * @example
 * const theme: IThemeProvider = new BasicTheme();
 * const tiers = theme.getTierConfig();
 * const result = theme.evaluateTier(1000, 500, 25);
 * console.log(result.tier.name); // "Silver"
 *
 * @see SDD §6.2.2 Theme System
 */
export interface IThemeProvider {
  /** Unique theme identifier */
  readonly id: string;
  /** Theme name for display */
  readonly name: string;
  /** Theme description */
  readonly description: string;
  /** Minimum subscription tier required */
  readonly subscriptionTier: SubscriptionTier;

  /**
   * Get all tier configurations for this theme
   * @returns Array of tier configs, ordered by rank (best tier first)
   */
  getTierConfig(): TierConfig[];

  /**
   * Get all badge configurations for this theme
   * @returns Array of badge configs
   */
  getBadgeConfig(): BadgeConfig[];

  /**
   * Get naming configuration for this theme
   * @returns Naming config with labels and terminology
   */
  getNamingConfig(): NamingConfig;

  /**
   * Evaluate which tier a member belongs to
   *
   * @param score - Member's score/conviction value
   * @param totalMembers - Total members in the community
   * @param rank - Member's rank (1 = highest)
   * @returns Tier result with matched tier and context
   */
  evaluateTier(score: number, totalMembers: number, rank: number): TierResult;

  /**
   * Evaluate which badges a member has earned
   *
   * @param profile - Current member profile
   * @param history - Historical profile data
   * @returns Array of earned badges
   */
  evaluateBadges(profile: Profile, history: ProfileHistory): EarnedBadge[];
}

// --------------------------------------------------------------------------
// Theme Validation
// --------------------------------------------------------------------------

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  /** Whether the theme is valid */
  valid: boolean;
  /** Error messages if invalid */
  errors: string[];
}

/**
 * Validates a theme configuration
 *
 * @param theme - Theme to validate
 * @returns Validation result
 */
export function validateTheme(theme: IThemeProvider): ThemeValidationResult {
  const errors: string[] = [];

  // Check minimum tiers
  const tiers = theme.getTierConfig();
  if (tiers.length < 2) {
    errors.push('Theme must have at least 2 tiers');
  }

  // Check tier rank ranges don't overlap
  const sortedTiers = [...tiers].sort((a, b) => a.minRank - b.minRank);
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    const current = sortedTiers[i]!;
    const next = sortedTiers[i + 1]!;
    if (current.maxRank >= next.minRank) {
      errors.push(
        `Tier rank ranges overlap: ${current.id} (${current.minRank}-${current.maxRank}) ` +
          `and ${next.id} (${next.minRank}-${next.maxRank})`
      );
    }
  }

  // Check for duplicate tier IDs
  const tierIds = new Set<string>();
  for (const tier of tiers) {
    if (tierIds.has(tier.id)) {
      errors.push(`Duplicate tier ID: ${tier.id}`);
    }
    tierIds.add(tier.id);
  }

  // Check badges
  const badges = theme.getBadgeConfig();
  const badgeIds = new Set<string>();
  for (const badge of badges) {
    if (badgeIds.has(badge.id)) {
      errors.push(`Duplicate badge ID: ${badge.id}`);
    }
    badgeIds.add(badge.id);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// --------------------------------------------------------------------------
// Default Configurations
// --------------------------------------------------------------------------

/**
 * Default naming configuration for generic themes
 */
export const DEFAULT_NAMING_CONFIG: NamingConfig = {
  tierPrefix: 'Rank',
  tierSuffix: '',
  communityNoun: 'Members',
  leaderboardTitle: 'Top Holders',
  scoreLabel: 'Score',
};

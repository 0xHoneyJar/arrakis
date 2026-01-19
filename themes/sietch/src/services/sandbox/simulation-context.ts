/**
 * SimulationContext - Core Data Structures for QA Sandbox Testing
 *
 * Sprint 106: SimulationContext Foundation
 *
 * Provides interfaces and factory functions for managing simulated member states
 * within sandbox environments. Enables QA testing of role-based access control
 * and tier-gated features without modifying production data.
 *
 * @see SDD §4.1 Data Structures
 * @module services/sandbox/simulation-context
 */

import { BGT_THRESHOLDS } from '../../packages/adapters/themes/SietchTheme.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Valid tier IDs for the Sietch theme (9 tiers)
 */
export type TierId =
  | 'naib'
  | 'fedaykin'
  | 'usul'
  | 'sayyadina'
  | 'mushtamal'
  | 'sihaya'
  | 'qanat'
  | 'ichwan'
  | 'hajra';

/**
 * Engagement stage for ProgressiveGate system
 */
export type EngagementStage = 'free' | 'engaged' | 'verified';

/**
 * Badge IDs from the Sietch theme
 */
export type BadgeId =
  | 'og'
  | 'veteran'
  | 'elder'
  | 'naib_ascended'
  | 'fedaykin_initiated'
  | 'usul_ascended'
  | 'first_maker'
  | 'desert_active'
  | 'sietch_engaged'
  | 'water_sharer'
  | 'former_naib'
  | 'founding_naib';

// =============================================================================
// Interfaces (SDD §4.1)
// =============================================================================

/**
 * Role assumed by the QA tester
 *
 * Contains all the identity information needed to simulate a member
 * at any tier with any combination of badges.
 */
export interface AssumedRole {
  /** Simulated tier ID */
  tierId: TierId;

  /** Simulated rank within the community (1 = top) */
  rank: number;

  /** Array of badge IDs the simulated member has */
  badges: BadgeId[];

  /** ISO timestamp when role was assumed */
  assumedAt: string;

  /** Optional note explaining the test scenario */
  note?: string;
}

/**
 * Threshold overrides for BGT-based tier evaluation
 *
 * Allows QA to test edge cases around tier boundaries
 * without requiring actual BGT holdings.
 */
export interface ThresholdOverrides {
  /** Override BGT threshold for Hajra tier (default: 6.9) */
  hajra?: number;

  /** Override BGT threshold for Ichwan tier (default: 69) */
  ichwan?: number;

  /** Override BGT threshold for Qanat tier (default: 222) */
  qanat?: number;

  /** Override BGT threshold for Sihaya tier (default: 420) */
  sihaya?: number;

  /** Override BGT threshold for Mushtamal tier (default: 690) */
  mushtamal?: number;

  /** Override BGT threshold for Sayyadina tier (default: 888) */
  sayyadina?: number;

  /** Override BGT threshold for Usul tier (default: 1111) */
  usul?: number;
}

/**
 * Simulated member state within a sandbox
 *
 * Contains all state needed to fully simulate a member's experience
 * including BGT holdings, engagement stage, and activity metrics.
 */
export interface SimulatedMemberState {
  /** Simulated BGT balance (for threshold-based tier calculation) */
  bgtBalance: number;

  /** Simulated conviction score */
  convictionScore: number;

  /** Simulated activity score */
  activityScore: number;

  /** Simulated tenure in days */
  tenureDays: number;

  /** Current engagement stage (FREE/ENGAGED/VERIFIED) */
  engagementStage: EngagementStage;

  /** Engagement points accumulated */
  engagementPoints: number;

  /** Whether the member is verified (wallet connected) */
  isVerified: boolean;

  /** Custom context for badge evaluators */
  customContext?: Record<string, unknown>;
}

/**
 * Complete simulation context for a sandbox session
 *
 * Root data structure stored in Redis for each sandbox.
 * Contains the assumed role, simulated state, and optional threshold overrides.
 */
export interface SimulationContext {
  /** Sandbox ID this context belongs to */
  sandboxId: string;

  /** Discord user ID of the QA tester */
  userId: string;

  /** Currently assumed role (null if no role assumed) */
  assumedRole: AssumedRole | null;

  /** Simulated member state */
  memberState: SimulatedMemberState;

  /** Optional BGT threshold overrides */
  thresholdOverrides: ThresholdOverrides | null;

  /** ISO timestamp when context was created */
  createdAt: string;

  /** ISO timestamp when context was last updated */
  updatedAt: string;

  /** Version for optimistic locking */
  version: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default BGT thresholds (from SietchTheme)
 */
export const DEFAULT_BGT_THRESHOLDS: Required<ThresholdOverrides> = {
  hajra: BGT_THRESHOLDS.hajra,
  ichwan: BGT_THRESHOLDS.ichwan,
  qanat: BGT_THRESHOLDS.qanat,
  sihaya: BGT_THRESHOLDS.sihaya,
  mushtamal: BGT_THRESHOLDS.mushtamal,
  sayyadina: BGT_THRESHOLDS.sayyadina,
  usul: BGT_THRESHOLDS.usul,
};

/**
 * Tier order from lowest to highest
 */
export const TIER_ORDER: TierId[] = [
  'hajra',
  'ichwan',
  'qanat',
  'sihaya',
  'mushtamal',
  'sayyadina',
  'usul',
  'fedaykin',
  'naib',
];

/**
 * Tier display names
 */
export const TIER_DISPLAY_NAMES: Record<TierId, string> = {
  naib: 'Naib',
  fedaykin: 'Fedaykin',
  usul: 'Usul',
  sayyadina: 'Sayyadina',
  mushtamal: 'Mushtamal',
  sihaya: 'Sihaya',
  qanat: 'Qanat',
  ichwan: 'Ichwan',
  hajra: 'Hajra',
};

/**
 * Badge display names
 */
export const BADGE_DISPLAY_NAMES: Record<BadgeId, string> = {
  og: 'OG',
  veteran: 'Sietch Veteran',
  elder: 'Elder',
  naib_ascended: 'Naib Ascended',
  fedaykin_initiated: 'Fedaykin Initiated',
  usul_ascended: 'Usul Ascended',
  first_maker: 'First Maker',
  desert_active: 'Desert Active',
  sietch_engaged: 'Sietch Engaged',
  water_sharer: 'Water Sharer',
  former_naib: 'Former Naib',
  founding_naib: 'Founding Naib',
};

// =============================================================================
// Factory Functions (SDD §4.1.1)
// =============================================================================

/**
 * Create default simulated member state
 *
 * Initializes a member at the lowest engagement level with zero holdings.
 * This represents a brand new community member.
 *
 * @returns Default SimulatedMemberState
 */
export function createDefaultMemberState(): SimulatedMemberState {
  return {
    bgtBalance: 0,
    convictionScore: 0,
    activityScore: 0,
    tenureDays: 0,
    engagementStage: 'free',
    engagementPoints: 0,
    isVerified: false,
    customContext: {},
  };
}

/**
 * Create default threshold overrides (all nulls = use production thresholds)
 *
 * @returns Empty ThresholdOverrides object
 */
export function createDefaultThresholdOverrides(): ThresholdOverrides {
  return {};
}

/**
 * Create a new simulation context for a sandbox session
 *
 * @param sandboxId - The sandbox this context belongs to
 * @param userId - The Discord user ID of the QA tester
 * @returns New SimulationContext with default values
 */
export function createSimulationContext(
  sandboxId: string,
  userId: string
): SimulationContext {
  const now = new Date().toISOString();

  return {
    sandboxId,
    userId,
    assumedRole: null,
    memberState: createDefaultMemberState(),
    thresholdOverrides: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Create an assumed role with the given tier
 *
 * @param tierId - The tier to assume
 * @param options - Optional configuration
 * @returns New AssumedRole
 */
export function createAssumedRole(
  tierId: TierId,
  options?: {
    rank?: number;
    badges?: BadgeId[];
    note?: string;
  }
): AssumedRole {
  return {
    tierId,
    rank: options?.rank ?? getDefaultRankForTier(tierId),
    badges: options?.badges ?? [],
    assumedAt: new Date().toISOString(),
    note: options?.note,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the default rank for a given tier
 *
 * Returns a rank in the middle of the tier's typical range.
 *
 * @param tierId - The tier ID
 * @returns Default rank for that tier
 */
export function getDefaultRankForTier(tierId: TierId): number {
  switch (tierId) {
    case 'naib':
      return 4; // Middle of 1-7
    case 'fedaykin':
      return 35; // Middle of 8-69
    case 'usul':
      return 85; // Middle of 70-100
    case 'sayyadina':
      return 125; // Middle of 101-150
    case 'mushtamal':
      return 175; // Middle of 151-200
    case 'sihaya':
      return 250; // Middle of 201-300
    case 'qanat':
      return 400; // Middle of 301-500
    case 'ichwan':
      return 750; // Middle of 501-1000
    case 'hajra':
      return 1500; // Beyond 1001
    default:
      return 1000;
  }
}

/**
 * Check if a tier ID is valid
 *
 * @param tierId - The tier ID to validate
 * @returns true if valid
 */
export function isValidTierId(tierId: string): tierId is TierId {
  return TIER_ORDER.includes(tierId as TierId);
}

/**
 * Check if a badge ID is valid
 *
 * @param badgeId - The badge ID to validate
 * @returns true if valid
 */
export function isValidBadgeId(badgeId: string): badgeId is BadgeId {
  return badgeId in BADGE_DISPLAY_NAMES;
}

/**
 * Check if an engagement stage is valid
 *
 * @param stage - The engagement stage to validate
 * @returns true if valid
 */
export function isValidEngagementStage(stage: string): stage is EngagementStage {
  return ['free', 'engaged', 'verified'].includes(stage);
}

/**
 * Get effective BGT thresholds (merging overrides with defaults)
 *
 * @param overrides - Optional threshold overrides
 * @returns Complete threshold configuration
 */
export function getEffectiveThresholds(
  overrides: ThresholdOverrides | null
): Required<ThresholdOverrides> {
  if (!overrides) {
    return { ...DEFAULT_BGT_THRESHOLDS };
  }

  return {
    hajra: overrides.hajra ?? DEFAULT_BGT_THRESHOLDS.hajra,
    ichwan: overrides.ichwan ?? DEFAULT_BGT_THRESHOLDS.ichwan,
    qanat: overrides.qanat ?? DEFAULT_BGT_THRESHOLDS.qanat,
    sihaya: overrides.sihaya ?? DEFAULT_BGT_THRESHOLDS.sihaya,
    mushtamal: overrides.mushtamal ?? DEFAULT_BGT_THRESHOLDS.mushtamal,
    sayyadina: overrides.sayyadina ?? DEFAULT_BGT_THRESHOLDS.sayyadina,
    usul: overrides.usul ?? DEFAULT_BGT_THRESHOLDS.usul,
  };
}

/**
 * Calculate tier from BGT balance using thresholds
 *
 * Note: Naib and Fedaykin are rank-based, not BGT-based.
 * This function only handles BGT-based tiers (Usul through Hajra).
 *
 * @param bgtBalance - The BGT balance to evaluate
 * @param thresholds - The threshold configuration to use
 * @returns The tier ID based on BGT holdings
 */
export function calculateTierFromBgt(
  bgtBalance: number,
  thresholds: Required<ThresholdOverrides>
): TierId {
  // Check from highest BGT tier to lowest
  if (bgtBalance >= thresholds.usul) return 'usul';
  if (bgtBalance >= thresholds.sayyadina) return 'sayyadina';
  if (bgtBalance >= thresholds.mushtamal) return 'mushtamal';
  if (bgtBalance >= thresholds.sihaya) return 'sihaya';
  if (bgtBalance >= thresholds.qanat) return 'qanat';
  if (bgtBalance >= thresholds.ichwan) return 'ichwan';
  if (bgtBalance >= thresholds.hajra) return 'hajra';

  // Below minimum threshold - no tier (return lowest as default)
  return 'hajra';
}

/**
 * Compare two tiers
 *
 * @param a - First tier
 * @param b - Second tier
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareTiers(a: TierId, b: TierId): number {
  return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b);
}

/**
 * Check if tier A is at least as high as tier B
 *
 * @param actual - The actual tier
 * @param required - The required tier
 * @returns true if actual >= required
 */
export function tierMeetsRequirement(actual: TierId, required: TierId): boolean {
  return compareTiers(actual, required) >= 0;
}

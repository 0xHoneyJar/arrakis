/**
 * SimulationContext Unit Tests
 *
 * Sprint 106: SimulationContext Foundation
 *
 * Tests for simulation context types, factories, and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type TierId,
  type BadgeId,
  type EngagementStage,
  type SimulationContext,
  type SimulatedMemberState,
  type AssumedRole,
  type ThresholdOverrides,
  // Constants
  DEFAULT_BGT_THRESHOLDS,
  TIER_ORDER,
  TIER_DISPLAY_NAMES,
  BADGE_DISPLAY_NAMES,
  // Factory functions
  createDefaultMemberState,
  createDefaultThresholdOverrides,
  createSimulationContext,
  createAssumedRole,
  // Helpers
  getDefaultRankForTier,
  isValidTierId,
  isValidBadgeId,
  isValidEngagementStage,
  getEffectiveThresholds,
  calculateTierFromBgt,
  compareTiers,
  tierMeetsRequirement,
} from '../../../src/services/sandbox/simulation-context.js';

describe('SimulationContext', () => {
  // ===========================================================================
  // Constants Tests
  // ===========================================================================

  describe('Constants', () => {
    it('should have correct BGT thresholds', () => {
      expect(DEFAULT_BGT_THRESHOLDS).toEqual({
        hajra: 6.9,
        ichwan: 69,
        qanat: 222,
        sihaya: 420,
        mushtamal: 690,
        sayyadina: 888,
        usul: 1111,
      });
    });

    it('should have 9 tiers in correct order', () => {
      expect(TIER_ORDER).toHaveLength(9);
      expect(TIER_ORDER[0]).toBe('hajra'); // Lowest
      expect(TIER_ORDER[8]).toBe('naib'); // Highest
    });

    it('should have display names for all tiers', () => {
      for (const tierId of TIER_ORDER) {
        expect(TIER_DISPLAY_NAMES[tierId]).toBeDefined();
        expect(typeof TIER_DISPLAY_NAMES[tierId]).toBe('string');
      }
    });

    it('should have display names for all badges', () => {
      const badgeIds: BadgeId[] = [
        'og', 'veteran', 'elder',
        'naib_ascended', 'fedaykin_initiated', 'usul_ascended', 'first_maker',
        'desert_active', 'sietch_engaged',
        'water_sharer', 'former_naib', 'founding_naib',
      ];

      for (const badgeId of badgeIds) {
        expect(BADGE_DISPLAY_NAMES[badgeId]).toBeDefined();
        expect(typeof BADGE_DISPLAY_NAMES[badgeId]).toBe('string');
      }
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe('createDefaultMemberState', () => {
    it('should create state with zero values', () => {
      const state = createDefaultMemberState();

      expect(state.bgtBalance).toBe(0);
      expect(state.convictionScore).toBe(0);
      expect(state.activityScore).toBe(0);
      expect(state.tenureDays).toBe(0);
      expect(state.engagementPoints).toBe(0);
    });

    it('should create state with free engagement stage', () => {
      const state = createDefaultMemberState();

      expect(state.engagementStage).toBe('free');
      expect(state.isVerified).toBe(false);
    });

    it('should create state with empty custom context', () => {
      const state = createDefaultMemberState();

      expect(state.customContext).toEqual({});
    });
  });

  describe('createDefaultThresholdOverrides', () => {
    it('should create empty overrides object', () => {
      const overrides = createDefaultThresholdOverrides();

      expect(overrides).toEqual({});
      expect(Object.keys(overrides)).toHaveLength(0);
    });
  });

  describe('createSimulationContext', () => {
    it('should create context with correct IDs', () => {
      const context = createSimulationContext('sandbox-123', 'user-456');

      expect(context.sandboxId).toBe('sandbox-123');
      expect(context.userId).toBe('user-456');
    });

    it('should create context with null assumed role', () => {
      const context = createSimulationContext('sandbox-123', 'user-456');

      expect(context.assumedRole).toBeNull();
    });

    it('should create context with default member state', () => {
      const context = createSimulationContext('sandbox-123', 'user-456');

      expect(context.memberState.bgtBalance).toBe(0);
      expect(context.memberState.engagementStage).toBe('free');
    });

    it('should create context with null threshold overrides', () => {
      const context = createSimulationContext('sandbox-123', 'user-456');

      expect(context.thresholdOverrides).toBeNull();
    });

    it('should create context with ISO timestamps', () => {
      const before = new Date().toISOString();
      const context = createSimulationContext('sandbox-123', 'user-456');
      const after = new Date().toISOString();

      expect(context.createdAt).toBeDefined();
      expect(context.updatedAt).toBeDefined();
      expect(context.createdAt >= before).toBe(true);
      expect(context.createdAt <= after).toBe(true);
      expect(context.createdAt).toBe(context.updatedAt);
    });

    it('should create context with version 1', () => {
      const context = createSimulationContext('sandbox-123', 'user-456');

      expect(context.version).toBe(1);
    });
  });

  describe('createAssumedRole', () => {
    it('should create role with specified tier', () => {
      const role = createAssumedRole('fedaykin');

      expect(role.tierId).toBe('fedaykin');
    });

    it('should use default rank for tier', () => {
      const naibRole = createAssumedRole('naib');
      const hajraRole = createAssumedRole('hajra');

      expect(naibRole.rank).toBe(4); // Middle of 1-7
      expect(hajraRole.rank).toBe(1500); // Beyond 1001
    });

    it('should use custom rank when provided', () => {
      const role = createAssumedRole('naib', { rank: 2 });

      expect(role.rank).toBe(2);
    });

    it('should use empty badges by default', () => {
      const role = createAssumedRole('fedaykin');

      expect(role.badges).toEqual([]);
    });

    it('should use custom badges when provided', () => {
      const role = createAssumedRole('naib', { badges: ['naib_ascended', 'og'] });

      expect(role.badges).toEqual(['naib_ascended', 'og']);
    });

    it('should set assumedAt timestamp', () => {
      const before = new Date().toISOString();
      const role = createAssumedRole('fedaykin');
      const after = new Date().toISOString();

      expect(role.assumedAt >= before).toBe(true);
      expect(role.assumedAt <= after).toBe(true);
    });

    it('should include note when provided', () => {
      const role = createAssumedRole('naib', { note: 'Testing council access' });

      expect(role.note).toBe('Testing council access');
    });
  });

  // ===========================================================================
  // Validation Helper Tests
  // ===========================================================================

  describe('isValidTierId', () => {
    it('should return true for valid tier IDs', () => {
      expect(isValidTierId('naib')).toBe(true);
      expect(isValidTierId('fedaykin')).toBe(true);
      expect(isValidTierId('hajra')).toBe(true);
    });

    it('should return false for invalid tier IDs', () => {
      expect(isValidTierId('invalid')).toBe(false);
      expect(isValidTierId('')).toBe(false);
      expect(isValidTierId('NAIB')).toBe(false); // Case sensitive
    });
  });

  describe('isValidBadgeId', () => {
    it('should return true for valid badge IDs', () => {
      expect(isValidBadgeId('og')).toBe(true);
      expect(isValidBadgeId('naib_ascended')).toBe(true);
      expect(isValidBadgeId('water_sharer')).toBe(true);
    });

    it('should return false for invalid badge IDs', () => {
      expect(isValidBadgeId('invalid')).toBe(false);
      expect(isValidBadgeId('')).toBe(false);
      expect(isValidBadgeId('OG')).toBe(false); // Case sensitive
    });
  });

  describe('isValidEngagementStage', () => {
    it('should return true for valid stages', () => {
      expect(isValidEngagementStage('free')).toBe(true);
      expect(isValidEngagementStage('engaged')).toBe(true);
      expect(isValidEngagementStage('verified')).toBe(true);
    });

    it('should return false for invalid stages', () => {
      expect(isValidEngagementStage('invalid')).toBe(false);
      expect(isValidEngagementStage('')).toBe(false);
      expect(isValidEngagementStage('FREE')).toBe(false); // Case sensitive
    });
  });

  // ===========================================================================
  // Threshold Helper Tests
  // ===========================================================================

  describe('getEffectiveThresholds', () => {
    it('should return defaults when overrides is null', () => {
      const thresholds = getEffectiveThresholds(null);

      expect(thresholds).toEqual(DEFAULT_BGT_THRESHOLDS);
    });

    it('should return defaults when overrides is empty', () => {
      const thresholds = getEffectiveThresholds({});

      expect(thresholds).toEqual(DEFAULT_BGT_THRESHOLDS);
    });

    it('should merge partial overrides with defaults', () => {
      const thresholds = getEffectiveThresholds({ hajra: 10, usul: 2000 });

      expect(thresholds.hajra).toBe(10);
      expect(thresholds.usul).toBe(2000);
      expect(thresholds.ichwan).toBe(69); // Default
      expect(thresholds.sihaya).toBe(420); // Default
    });

    it('should override all values when fully specified', () => {
      const overrides: ThresholdOverrides = {
        hajra: 1,
        ichwan: 2,
        qanat: 3,
        sihaya: 4,
        mushtamal: 5,
        sayyadina: 6,
        usul: 7,
      };

      const thresholds = getEffectiveThresholds(overrides);

      expect(thresholds).toEqual(overrides);
    });
  });

  describe('calculateTierFromBgt', () => {
    const thresholds = DEFAULT_BGT_THRESHOLDS;

    it('should return hajra for balance below hajra threshold', () => {
      expect(calculateTierFromBgt(0, thresholds)).toBe('hajra');
      expect(calculateTierFromBgt(5, thresholds)).toBe('hajra');
    });

    it('should return hajra for balance at hajra threshold', () => {
      expect(calculateTierFromBgt(6.9, thresholds)).toBe('hajra');
    });

    it('should return correct tier for exact thresholds', () => {
      expect(calculateTierFromBgt(69, thresholds)).toBe('ichwan');
      expect(calculateTierFromBgt(222, thresholds)).toBe('qanat');
      expect(calculateTierFromBgt(420, thresholds)).toBe('sihaya');
      expect(calculateTierFromBgt(690, thresholds)).toBe('mushtamal');
      expect(calculateTierFromBgt(888, thresholds)).toBe('sayyadina');
      expect(calculateTierFromBgt(1111, thresholds)).toBe('usul');
    });

    it('should return correct tier for values above threshold', () => {
      expect(calculateTierFromBgt(100, thresholds)).toBe('ichwan');
      expect(calculateTierFromBgt(500, thresholds)).toBe('sihaya');
      expect(calculateTierFromBgt(5000, thresholds)).toBe('usul');
    });

    it('should work with custom thresholds', () => {
      const customThresholds = {
        ...thresholds,
        hajra: 1,
        ichwan: 40,  // Lower ichwan threshold
        usul: 100,
      };

      expect(calculateTierFromBgt(50, customThresholds)).toBe('ichwan');
      expect(calculateTierFromBgt(100, customThresholds)).toBe('usul');
    });
  });

  // ===========================================================================
  // Tier Comparison Tests
  // ===========================================================================

  describe('compareTiers', () => {
    it('should return 0 for same tier', () => {
      expect(compareTiers('naib', 'naib')).toBe(0);
      expect(compareTiers('hajra', 'hajra')).toBe(0);
    });

    it('should return negative for lower tier', () => {
      expect(compareTiers('hajra', 'naib')).toBeLessThan(0);
      expect(compareTiers('ichwan', 'fedaykin')).toBeLessThan(0);
    });

    it('should return positive for higher tier', () => {
      expect(compareTiers('naib', 'hajra')).toBeGreaterThan(0);
      expect(compareTiers('fedaykin', 'ichwan')).toBeGreaterThan(0);
    });
  });

  describe('tierMeetsRequirement', () => {
    it('should return true when actual equals required', () => {
      expect(tierMeetsRequirement('naib', 'naib')).toBe(true);
      expect(tierMeetsRequirement('hajra', 'hajra')).toBe(true);
    });

    it('should return true when actual is higher than required', () => {
      expect(tierMeetsRequirement('naib', 'fedaykin')).toBe(true);
      expect(tierMeetsRequirement('fedaykin', 'hajra')).toBe(true);
    });

    it('should return false when actual is lower than required', () => {
      expect(tierMeetsRequirement('hajra', 'naib')).toBe(false);
      expect(tierMeetsRequirement('ichwan', 'fedaykin')).toBe(false);
    });
  });

  // ===========================================================================
  // Default Rank Tests
  // ===========================================================================

  describe('getDefaultRankForTier', () => {
    it('should return rank within tier boundaries', () => {
      // Naib: 1-7
      const naibRank = getDefaultRankForTier('naib');
      expect(naibRank).toBeGreaterThanOrEqual(1);
      expect(naibRank).toBeLessThanOrEqual(7);

      // Fedaykin: 8-69
      const fedaykinRank = getDefaultRankForTier('fedaykin');
      expect(fedaykinRank).toBeGreaterThanOrEqual(8);
      expect(fedaykinRank).toBeLessThanOrEqual(69);

      // Hajra: 1001+
      const hajraRank = getDefaultRankForTier('hajra');
      expect(hajraRank).toBeGreaterThanOrEqual(1001);
    });

    it('should return unique ranks for each tier', () => {
      const ranks = TIER_ORDER.map((tier) => getDefaultRankForTier(tier));
      const uniqueRanks = new Set(ranks);

      expect(uniqueRanks.size).toBe(9);
    });
  });
});

/**
 * SimulationService Unit Tests
 *
 * Sprint 106: SimulationContext Foundation
 *
 * Tests for the SimulationService CRUD operations and Redis serialization.
 * Uses mock Redis to test without requiring actual Redis connection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SimulationService,
  createSimulationService,
  SimulationErrorCode,
  serializeContext,
  deserializeContext,
  buildContextKey,
  SIMULATION_KEY_PREFIX,
  SIMULATION_KEY_PATTERN,
} from '../../../src/services/sandbox/simulation-service.js';
import {
  createSimulationContext,
  type SimulationContext,
} from '../../../src/services/sandbox/simulation-context.js';
import type { MinimalRedis } from '../../../../../../packages/sandbox/src/types.js';
import { nullLogger } from '../../../src/packages/infrastructure/logging/index.js';

// =============================================================================
// Mock Redis Implementation
// =============================================================================

function createMockRedis(): MinimalRedis & {
  store: Map<string, { value: string; expiry?: number }>;
  reset: () => void;
} {
  const store = new Map<string, { value: string; expiry?: number }>();

  return {
    store,
    reset: () => store.clear(),

    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      // Check expiry (simplified - doesn't track actual time)
      return entry.value;
    },

    async set(
      key: string,
      value: string,
      mode?: 'EX' | 'PX',
      duration?: number
    ): Promise<'OK'> {
      store.set(key, {
        value,
        expiry: mode === 'EX' ? duration : mode === 'PX' ? duration : undefined,
      });
      return 'OK';
    },

    async del(...keys: string[]): Promise<number> {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return count;
    },

    async keys(pattern: string): Promise<string[]> {
      // Simple pattern matching (only handles * at the end)
      const prefix = pattern.replace('*', '');
      return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    },

    async scan(): Promise<[string, string[]]> {
      return ['0', Array.from(store.keys())];
    },

    async exists(...keys: string[]): Promise<number> {
      return keys.filter((k) => store.has(k)).length;
    },

    async hget(): Promise<string | null> {
      return null;
    },

    async hset(): Promise<number> {
      return 1;
    },

    async hdel(): Promise<number> {
      return 0;
    },

    async hgetall(): Promise<Record<string, string>> {
      return {};
    },

    async sadd(): Promise<number> {
      return 1;
    },

    async srem(): Promise<number> {
      return 0;
    },

    async smembers(): Promise<string[]> {
      return [];
    },

    async expire(): Promise<number> {
      return 1;
    },

    async ttl(): Promise<number> {
      return -1;
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('SimulationService', () => {
  let redis: ReturnType<typeof createMockRedis>;
  let service: SimulationService;

  beforeEach(() => {
    redis = createMockRedis();
    service = createSimulationService(redis, nullLogger);
  });

  // ===========================================================================
  // Serialization Tests
  // ===========================================================================

  describe('Serialization', () => {
    describe('serializeContext', () => {
      it('should serialize context to JSON string', () => {
        const context = createSimulationContext('sandbox-123', 'user-456');
        const json = serializeContext(context);

        expect(typeof json).toBe('string');
        expect(() => JSON.parse(json)).not.toThrow();
      });

      it('should include all required fields', () => {
        const context = createSimulationContext('sandbox-123', 'user-456');
        const json = serializeContext(context);
        const parsed = JSON.parse(json);

        expect(parsed.sandboxId).toBe('sandbox-123');
        expect(parsed.userId).toBe('user-456');
        expect(parsed.memberState).toBeDefined();
        expect(parsed.version).toBe(1);
      });
    });

    describe('deserializeContext', () => {
      it('should deserialize valid JSON to context', () => {
        const original = createSimulationContext('sandbox-123', 'user-456');
        const json = serializeContext(original);
        const deserialized = deserializeContext(json);

        expect(deserialized.sandboxId).toBe(original.sandboxId);
        expect(deserialized.userId).toBe(original.userId);
        expect(deserialized.version).toBe(original.version);
      });

      it('should throw for invalid JSON', () => {
        expect(() => deserializeContext('not-json')).toThrow();
      });

      it('should throw for missing sandboxId', () => {
        const invalid = JSON.stringify({ userId: 'user', memberState: {} });
        expect(() => deserializeContext(invalid)).toThrow('sandboxId');
      });

      it('should throw for missing userId', () => {
        const invalid = JSON.stringify({ sandboxId: 'sandbox', memberState: {} });
        expect(() => deserializeContext(invalid)).toThrow('userId');
      });

      it('should throw for missing memberState', () => {
        const invalid = JSON.stringify({ sandboxId: 'sandbox', userId: 'user' });
        expect(() => deserializeContext(invalid)).toThrow('memberState');
      });
    });

    describe('buildContextKey', () => {
      it('should build correct key format', () => {
        const key = buildContextKey('sandbox-123', 'user-456');

        expect(key).toBe(`${SIMULATION_KEY_PREFIX}:sandbox-123:user-456`);
      });

      it('should handle special characters', () => {
        const key = buildContextKey('sandbox_with-special.chars', '12345');

        expect(key).toContain('sandbox_with-special.chars');
        expect(key).toContain('12345');
      });
    });

    describe('SIMULATION_KEY_PATTERN', () => {
      it('should generate pattern for sandbox', () => {
        const pattern = SIMULATION_KEY_PATTERN('sandbox-123');

        expect(pattern).toBe(`${SIMULATION_KEY_PREFIX}:sandbox-123:*`);
      });
    });
  });

  // ===========================================================================
  // CRUD Operation Tests
  // ===========================================================================

  describe('CRUD Operations', () => {
    describe('createContext', () => {
      it('should create new context', async () => {
        const result = await service.createContext('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.sandboxId).toBe('sandbox-123');
        expect(result.data?.userId).toBe('user-456');
      });

      it('should store context in Redis', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const key = buildContextKey('sandbox-123', 'user-456');
        expect(redis.store.has(key)).toBe(true);
      });

      it('should set TTL on stored context', async () => {
        await service.createContext('sandbox-123', 'user-456', {
          ttlSeconds: 3600,
        });

        const key = buildContextKey('sandbox-123', 'user-456');
        const entry = redis.store.get(key);
        expect(entry?.expiry).toBe(3600);
      });

      it('should return existing context if already exists', async () => {
        await service.createContext('sandbox-123', 'user-456');

        // Second create should return existing
        const result = await service.createContext('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.version).toBe(1);
      });
    });

    describe('getContext', () => {
      it('should return null for non-existent context', async () => {
        const result = await service.getContext('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
      });

      it('should return existing context', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.getContext('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.sandboxId).toBe('sandbox-123');
      });
    });

    describe('getOrCreateContext', () => {
      it('should create context if not exists', async () => {
        const result = await service.getOrCreateContext('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.sandboxId).toBe('sandbox-123');
      });

      it('should return existing context', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.getOrCreateContext('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.version).toBe(1);
      });
    });

    describe('updateContext', () => {
      it('should update existing context', async () => {
        const createResult = await service.createContext('sandbox-123', 'user-456');
        const context = createResult.data!;

        const updated: SimulationContext = {
          ...context,
          memberState: {
            ...context.memberState,
            bgtBalance: 1000,
          },
        };

        const result = await service.updateContext(updated);

        expect(result.success).toBe(true);
        expect(result.data?.memberState.bgtBalance).toBe(1000);
        expect(result.data?.version).toBe(2);
      });

      it('should update timestamp on update', async () => {
        const createResult = await service.createContext('sandbox-123', 'user-456');
        const context = createResult.data!;
        const originalUpdatedAt = context.updatedAt;

        // Small delay to ensure different timestamp
        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = await service.updateContext(context);

        expect(result.success).toBe(true);
        expect(result.data?.updatedAt >= originalUpdatedAt).toBe(true);
      });

      it('should fail with version conflict', async () => {
        const createResult = await service.createContext('sandbox-123', 'user-456');
        const context = createResult.data!;

        // Update once
        await service.updateContext(context);

        // Try to update with stale version
        const result = await service.updateContext(context, {
          expectedVersion: 1,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VERSION_CONFLICT);
      });
    });

    describe('deleteContext', () => {
      it('should delete existing context', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.deleteContext('sandbox-123', 'user-456');

        expect(result.success).toBe(true);

        // Verify deleted
        const key = buildContextKey('sandbox-123', 'user-456');
        expect(redis.store.has(key)).toBe(false);
      });

      it('should succeed even if context does not exist', async () => {
        const result = await service.deleteContext('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
      });
    });

    describe('listContexts', () => {
      it('should return empty array for sandbox with no contexts', async () => {
        const result = await service.listContexts('sandbox-123');

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });

      it('should return all contexts in sandbox', async () => {
        await service.createContext('sandbox-123', 'user-1');
        await service.createContext('sandbox-123', 'user-2');
        await service.createContext('sandbox-123', 'user-3');

        const result = await service.listContexts('sandbox-123');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
      });

      it('should not return contexts from other sandboxes', async () => {
        await service.createContext('sandbox-123', 'user-1');
        await service.createContext('sandbox-other', 'user-2');

        const result = await service.listContexts('sandbox-123');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0].userId).toBe('user-1');
      });
    });

    describe('deleteAllContexts', () => {
      it('should delete all contexts in sandbox', async () => {
        await service.createContext('sandbox-123', 'user-1');
        await service.createContext('sandbox-123', 'user-2');
        await service.createContext('sandbox-123', 'user-3');

        const result = await service.deleteAllContexts('sandbox-123');

        expect(result.success).toBe(true);
        expect(result.data).toBe(3);

        // Verify all deleted
        const listResult = await service.listContexts('sandbox-123');
        expect(listResult.data).toHaveLength(0);
      });

      it('should not delete contexts from other sandboxes', async () => {
        await service.createContext('sandbox-123', 'user-1');
        await service.createContext('sandbox-other', 'user-2');

        await service.deleteAllContexts('sandbox-123');

        const otherResult = await service.listContexts('sandbox-other');
        expect(otherResult.data).toHaveLength(1);
      });

      it('should return 0 for sandbox with no contexts', async () => {
        const result = await service.deleteAllContexts('sandbox-123');

        expect(result.success).toBe(true);
        expect(result.data).toBe(0);
      });
    });
  });

  // ===========================================================================
  // Role Operation Tests
  // ===========================================================================

  describe('Role Operations', () => {
    describe('assumeRole', () => {
      it('should set assumed role on context', async () => {
        const result = await service.assumeRole('sandbox-123', 'user-456', 'naib');

        expect(result.success).toBe(true);
        expect(result.data?.assumedRole?.tierId).toBe('naib');
      });

      it('should create context if not exists', async () => {
        const result = await service.assumeRole('sandbox-123', 'user-456', 'fedaykin');

        expect(result.success).toBe(true);
        expect(result.data?.sandboxId).toBe('sandbox-123');
      });

      it('should set custom rank', async () => {
        const result = await service.assumeRole('sandbox-123', 'user-456', 'naib', {
          rank: 1,
        });

        expect(result.success).toBe(true);
        expect(result.data?.assumedRole?.rank).toBe(1);
      });

      it('should set badges', async () => {
        const result = await service.assumeRole('sandbox-123', 'user-456', 'naib', {
          badges: ['naib_ascended', 'og'],
        });

        expect(result.success).toBe(true);
        expect(result.data?.assumedRole?.badges).toEqual(['naib_ascended', 'og']);
      });

      it('should set note', async () => {
        const result = await service.assumeRole('sandbox-123', 'user-456', 'naib', {
          note: 'Testing council access',
        });

        expect(result.success).toBe(true);
        expect(result.data?.assumedRole?.note).toBe('Testing council access');
      });

      it('should fail for invalid tier ID', async () => {
        const result = await service.assumeRole(
          'sandbox-123',
          'user-456',
          'invalid' as any
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });

      it('should fail for invalid badge ID', async () => {
        const result = await service.assumeRole('sandbox-123', 'user-456', 'naib', {
          badges: ['invalid' as any],
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });
    });

    describe('clearRole', () => {
      it('should clear assumed role', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib');

        const result = await service.clearRole('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.assumedRole).toBeNull();
      });

      it('should fail for non-existent context', async () => {
        const result = await service.clearRole('sandbox-123', 'user-456');

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.NOT_FOUND);
      });
    });

    describe('whoami', () => {
      it('should return whoami result with computed tier', async () => {
        // Create context with some BGT
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 500,
        });

        const result = await service.whoami('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.sandboxId).toBe('sandbox-123');
        expect(result.data?.userId).toBe('user-456');
        expect(result.data?.assumedRole).toBeNull();
        expect(result.data?.effectiveTier.source).toBe('computed');
      });

      it('should return assumed tier when role is assumed', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib', {
          rank: 1,
          note: 'Testing naib access',
        });

        const result = await service.whoami('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.assumedRole).not.toBeNull();
        expect(result.data?.assumedRole?.tierId).toBe('naib');
        expect(result.data?.assumedRole?.rank).toBe(1);
        expect(result.data?.assumedRole?.note).toBe('Testing naib access');
        expect(result.data?.effectiveTier.tierId).toBe('naib');
        expect(result.data?.effectiveTier.source).toBe('assumed');
      });

      it('should show computed tier differs from assumed tier', async () => {
        // Set low BGT (computes to hajra) but assume naib
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 5,
        });
        await service.assumeRole('sandbox-123', 'user-456', 'naib');

        const result = await service.whoami('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        // Computed tier should be hajra (bgt=5 < 6.9 threshold)
        expect(result.data?.computedTier.tierId).toBe('hajra');
        // But effective tier should be naib (assumed)
        expect(result.data?.effectiveTier.tierId).toBe('naib');
        expect(result.data?.effectiveTier.source).toBe('assumed');
      });

      it('should create context if not exists', async () => {
        const result = await service.whoami('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.sandboxId).toBe('sandbox-123');
        expect(result.data?.contextVersion).toBe(1);
      });

      it('should include member state in result', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 1000,
          engagementStage: 'verified',
          engagementPoints: 100,
          activityScore: 50,
          convictionScore: 75,
          tenureDays: 30,
        });

        const result = await service.whoami('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.memberState.bgtBalance).toBe(1000);
        expect(result.data?.memberState.engagementStage).toBe('verified');
        expect(result.data?.memberState.engagementPoints).toBe(100);
        expect(result.data?.memberState.activityScore).toBe(50);
        expect(result.data?.memberState.convictionScore).toBe(75);
        expect(result.data?.memberState.tenureDays).toBe(30);
      });

      it('should include threshold overrides in result', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.setThresholdOverrides('sandbox-123', 'user-456', {
          hajra: 1,
          usul: 500,
        });

        const result = await service.whoami('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.thresholdOverrides?.hajra).toBe(1);
        expect(result.data?.thresholdOverrides?.usul).toBe(500);
      });

      it('should calculate tier using custom thresholds', async () => {
        await service.createContext('sandbox-123', 'user-456');
        // Set BGT to 100 which would normally be ichwan (threshold 69)
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 100,
        });
        // But override ichwan threshold to 200, so 100 BGT is only hajra
        await service.setThresholdOverrides('sandbox-123', 'user-456', {
          ichwan: 200,
        });

        const result = await service.whoami('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        // With default thresholds, 100 BGT = ichwan
        // With ichwan threshold raised to 200, 100 BGT = hajra
        expect(result.data?.computedTier.tierId).toBe('hajra');
      });

      it('should include context version for optimistic locking', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 100,
        });

        const result = await service.whoami('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.contextVersion).toBe(2); // Created (v1) + updated (v2)
      });
    });
  });

  // ===========================================================================
  // State Operation Tests (Sprint 108)
  // ===========================================================================

  describe('State Operations', () => {
    describe('getState', () => {
      it('should return member state from context', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 1000,
          engagementStage: 'verified',
          activityScore: 50,
        });

        const result = await service.getState('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.bgtBalance).toBe(1000);
        expect(result.data?.engagementStage).toBe('verified');
        expect(result.data?.activityScore).toBe(50);
      });

      it('should fail for non-existent context', async () => {
        const result = await service.getState('sandbox-123', 'user-456');

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.NOT_FOUND);
      });

      it('should return raw state without computed values', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.getState('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        // Only raw state fields, no computed tier info
        expect(result.data).toHaveProperty('bgtBalance');
        expect(result.data).toHaveProperty('engagementStage');
        expect(result.data).toHaveProperty('activityScore');
        expect(result.data).toHaveProperty('convictionScore');
        expect(result.data).not.toHaveProperty('computedTier');
        expect(result.data).not.toHaveProperty('effectiveTier');
      });
    });

    describe('setState', () => {
      it('should update specified fields and return result', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          bgtBalance: 5000,
        });

        expect(result.success).toBe(true);
        expect(result.data?.updatedFields).toContain('bgtBalance');
        expect(result.data?.newState.bgtBalance).toBe(5000);
      });

      it('should return computed tier based on new state', async () => {
        await service.createContext('sandbox-123', 'user-456');

        // Set BGT to 5000 which should put user in usul tier (threshold 4000)
        const result = await service.setState('sandbox-123', 'user-456', {
          bgtBalance: 5000,
        });

        expect(result.success).toBe(true);
        expect(result.data?.computedTier.tierId).toBe('usul');
      });

      it('should track all updated fields', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          bgtBalance: 1000,
          activityScore: 75,
          tenureDays: 30,
        });

        expect(result.success).toBe(true);
        expect(result.data?.updatedFields).toHaveLength(3);
        expect(result.data?.updatedFields).toContain('bgtBalance');
        expect(result.data?.updatedFields).toContain('activityScore');
        expect(result.data?.updatedFields).toContain('tenureDays');
      });

      it('should include context version in result', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          bgtBalance: 1000,
        });

        expect(result.success).toBe(true);
        expect(result.data?.contextVersion).toBe(2); // Create (v1) + setState (v2)
      });

      it('should update engagement stage', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          engagementStage: 'engaged',
          engagementPoints: 50,
        });

        expect(result.success).toBe(true);
        expect(result.data?.newState.engagementStage).toBe('engaged');
        expect(result.data?.newState.engagementPoints).toBe(50);
      });

      it('should create context if not exists', async () => {
        const result = await service.setState('sandbox-123', 'user-456', {
          bgtBalance: 1000,
        });

        expect(result.success).toBe(true);
        expect(result.data?.newState.bgtBalance).toBe(1000);
      });

      it('should fail for invalid engagement stage', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          engagementStage: 'invalid' as any,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });

      it('should fail for negative bgt value', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          bgtBalance: -100,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });

      it('should fail for negative activity score', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          activityScore: -10,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });

      it('should fail for negative conviction score', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          convictionScore: -5,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });

      it('should fail for negative tenure days', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setState('sandbox-123', 'user-456', {
          tenureDays: -1,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });

      it('should recalculate tier when threshold changes BGT boundary', async () => {
        // Create context with 50 BGT (normally ichwan tier, threshold 69)
        await service.createContext('sandbox-123', 'user-456');
        await service.setThresholdOverrides('sandbox-123', 'user-456', {
          ichwan: 100, // Raise threshold
        });

        // 50 BGT should now be hajra since ichwan threshold is 100
        const result = await service.setState('sandbox-123', 'user-456', {
          bgtBalance: 50,
        });

        expect(result.success).toBe(true);
        expect(result.data?.computedTier.tierId).toBe('hajra');
      });
    });

    describe('updateMemberState', () => {
      it('should update BGT balance', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 1000,
        });

        expect(result.success).toBe(true);
        expect(result.data?.memberState.bgtBalance).toBe(1000);
      });

      it('should update engagement stage', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.updateMemberState('sandbox-123', 'user-456', {
          engagementStage: 'verified',
          isVerified: true,
        });

        expect(result.success).toBe(true);
        expect(result.data?.memberState.engagementStage).toBe('verified');
        expect(result.data?.memberState.isVerified).toBe(true);
      });

      it('should merge multiple updates', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 500,
          convictionScore: 100,
          activityScore: 50,
        });

        expect(result.success).toBe(true);
        expect(result.data?.memberState.bgtBalance).toBe(500);
        expect(result.data?.memberState.convictionScore).toBe(100);
        expect(result.data?.memberState.activityScore).toBe(50);
      });

      it('should create context if not exists', async () => {
        const result = await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 1000,
        });

        expect(result.success).toBe(true);
        expect(result.data?.sandboxId).toBe('sandbox-123');
      });

      it('should fail for invalid engagement stage', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.updateMemberState('sandbox-123', 'user-456', {
          engagementStage: 'invalid' as any,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });

      it('should fail for negative numeric values', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: -100,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });
    });

    describe('resetMemberState', () => {
      it('should reset to default state', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 1000,
          engagementStage: 'verified',
        });

        const result = await service.resetMemberState('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.memberState.bgtBalance).toBe(0);
        expect(result.data?.memberState.engagementStage).toBe('free');
      });

      it('should fail for non-existent context', async () => {
        const result = await service.resetMemberState('sandbox-123', 'user-456');

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.NOT_FOUND);
      });
    });
  });

  // ===========================================================================
  // Threshold Operation Tests
  // ===========================================================================

  describe('Threshold Operations', () => {
    describe('setThresholdOverrides', () => {
      it('should set threshold overrides', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setThresholdOverrides('sandbox-123', 'user-456', {
          hajra: 10,
          usul: 2000,
        });

        expect(result.success).toBe(true);
        expect(result.data?.thresholdOverrides?.hajra).toBe(10);
        expect(result.data?.thresholdOverrides?.usul).toBe(2000);
      });

      it('should create context if not exists', async () => {
        const result = await service.setThresholdOverrides('sandbox-123', 'user-456', {
          hajra: 5,
        });

        expect(result.success).toBe(true);
        expect(result.data?.sandboxId).toBe('sandbox-123');
      });

      it('should fail for non-positive threshold', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setThresholdOverrides('sandbox-123', 'user-456', {
          hajra: 0,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });

      it('should fail for negative threshold', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.setThresholdOverrides('sandbox-123', 'user-456', {
          usul: -100,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.VALIDATION_ERROR);
      });
    });

    describe('clearThresholdOverrides', () => {
      it('should clear overrides', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.setThresholdOverrides('sandbox-123', 'user-456', {
          hajra: 10,
        });

        const result = await service.clearThresholdOverrides('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.thresholdOverrides).toBeNull();
      });

      it('should fail for non-existent context', async () => {
        const result = await service.clearThresholdOverrides('sandbox-123', 'user-456');

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(SimulationErrorCode.NOT_FOUND);
      });
    });
  });

  // ===========================================================================
  // Permission Check Tests (Sprint 109)
  // ===========================================================================

  describe('Permission Check Operations', () => {
    describe('checkChannelAccess', () => {
      it('should grant access to unrestricted channel', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'sietch-lounge'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(true);
        expect(result.data?.requiredTier).toBeNull();
        expect(result.data?.reason).toContain('open to all');
      });

      it('should deny access to naib channel for hajra tier', async () => {
        await service.createContext('sandbox-123', 'user-456');
        // Default state has 0 BGT = hajra tier

        const result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'council-chamber'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(false);
        expect(result.data?.requiredTier).toBe('naib');
        expect(result.data?.effectiveTier).toBe('hajra');
        expect(result.data?.reason).toContain('does not meet');
      });

      it('should grant access to naib channel when role assumed', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib');

        const result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'council-chamber'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(true);
        expect(result.data?.effectiveTier).toBe('naib');
        expect(result.data?.reason).toContain('meets');
      });

      it('should grant access to fedaykin channel for naib tier', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib');

        const result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'war-room'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(true);
        expect(result.data?.requiredTier).toBe('fedaykin');
      });

      it('should return correct blur level based on engagement stage', async () => {
        await service.createContext('sandbox-123', 'user-456');

        // Free stage = heavy blur
        let result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'sietch-lounge'
        );
        expect(result.data?.blurLevel).toBe('heavy');

        // Update to engaged
        await service.updateMemberState('sandbox-123', 'user-456', {
          engagementStage: 'engaged',
        });
        result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'sietch-lounge'
        );
        expect(result.data?.blurLevel).toBe('light');

        // Update to verified
        await service.updateMemberState('sandbox-123', 'user-456', {
          engagementStage: 'verified',
        });
        result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'sietch-lounge'
        );
        expect(result.data?.blurLevel).toBe('none');
      });

      it('should handle unknown channel as unrestricted', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'unknown-channel'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(true);
        expect(result.data?.requiredTier).toBeNull();
        expect(result.data?.reason).toContain('not restricted');
      });

      it('should include permissions in result', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib');

        const result = await service.checkChannelAccess(
          'sandbox-123',
          'user-456',
          'council-chamber'
        );

        expect(result.success).toBe(true);
        expect(result.data?.permissions).toContain('council_access');
        expect(result.data?.permissions).toContain('vote');
      });
    });

    describe('checkFeatureAccess', () => {
      it('should grant feature access when tier has permission', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib');

        const result = await service.checkFeatureAccess(
          'sandbox-123',
          'user-456',
          'council_access'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(true);
        expect(result.data?.reason).toContain('available');
      });

      it('should deny feature access when tier lacks permission', async () => {
        await service.createContext('sandbox-123', 'user-456');
        // Default hajra tier

        const result = await service.checkFeatureAccess(
          'sandbox-123',
          'user-456',
          'council_access'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(false);
        expect(result.data?.requiredTier).toBe('naib');
        expect(result.data?.reason).toContain('requires');
      });

      it('should indicate feature unavailable at any tier', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.checkFeatureAccess(
          'sandbox-123',
          'user-456',
          'non_existent_feature'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(false);
        expect(result.data?.requiredTier).toBeNull();
        expect(result.data?.reason).toContain('not available');
      });

      it('should grant view_basic to ichwan tier', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 70, // ichwan threshold is 69
        });

        const result = await service.checkFeatureAccess(
          'sandbox-123',
          'user-456',
          'view_basic'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(true);
        expect(result.data?.effectiveTier).toBe('ichwan');
      });

      it('should create context if not exists', async () => {
        const result = await service.checkFeatureAccess(
          'sandbox-123',
          'user-456',
          'view_general'
        );

        expect(result.success).toBe(true);
        expect(result.data?.allowed).toBe(true);
        expect(result.data?.effectiveTier).toBe('hajra');
      });
    });

    describe('checkTier', () => {
      it('should return computed tier information', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 5000,
        });

        const result = await service.checkTier('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.tierId).toBe('usul');
        expect(result.data?.tierName).toBe('Usul');
        expect(result.data?.source).toBe('computed');
        expect(result.data?.computedFrom.bgtBalance).toBe(5000);
      });

      it('should return assumed tier information', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib', { rank: 3 });

        const result = await service.checkTier('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.tierId).toBe('naib');
        expect(result.data?.source).toBe('assumed');
        expect(result.data?.rankInTier).toBe(3);
      });

      it('should include role color', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib');

        const result = await service.checkTier('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.roleColor).toBe('#FFD700'); // Gold for naib
      });

      it('should show overridden threshold', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          bgtBalance: 100,
        });
        await service.setThresholdOverrides('sandbox-123', 'user-456', {
          ichwan: 200, // Raise threshold
        });

        const result = await service.checkTier('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.tierId).toBe('hajra'); // 100 BGT < 200 threshold
      });

      it('should create context if not exists', async () => {
        const result = await service.checkTier('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.tierId).toBe('hajra');
        expect(result.data?.computedFrom.bgtBalance).toBe(0);
      });
    });

    describe('checkBadges', () => {
      it('should evaluate tenure badges correctly', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          tenureDays: 100,
        });

        const result = await service.checkBadges('sandbox-123', 'user-456');

        expect(result.success).toBe(true);

        const og = result.data?.find((b) => b.badgeId === 'og');
        const veteran = result.data?.find((b) => b.badgeId === 'veteran');
        const elder = result.data?.find((b) => b.badgeId === 'elder');

        expect(og?.eligible).toBe(false); // 180 days required
        expect(veteran?.eligible).toBe(true); // 90 days required
        expect(elder?.eligible).toBe(true); // 30 days required
      });

      it('should evaluate tier-reached badges correctly', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'fedaykin');

        const result = await service.checkBadges('sandbox-123', 'user-456');

        expect(result.success).toBe(true);

        const naibAscended = result.data?.find((b) => b.badgeId === 'naib_ascended');
        const fedaykinInitiated = result.data?.find((b) => b.badgeId === 'fedaykin_initiated');

        expect(naibAscended?.eligible).toBe(false); // fedaykin doesn't meet naib
        expect(fedaykinInitiated?.eligible).toBe(true); // fedaykin meets fedaykin
      });

      it('should evaluate activity badges correctly', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          activityScore: 30,
        });

        const result = await service.checkBadges('sandbox-123', 'user-456');

        expect(result.success).toBe(true);

        const desertActive = result.data?.find((b) => b.badgeId === 'desert_active');
        const sietchEngaged = result.data?.find((b) => b.badgeId === 'sietch_engaged');

        expect(desertActive?.eligible).toBe(false); // 50 required
        expect(sietchEngaged?.eligible).toBe(true); // 25 required
      });

      it('should evaluate conviction badge correctly', async () => {
        await service.createContext('sandbox-123', 'user-456');
        await service.updateMemberState('sandbox-123', 'user-456', {
          convictionScore: 150,
        });

        const result = await service.checkBadges('sandbox-123', 'user-456');

        expect(result.success).toBe(true);

        const firstMaker = result.data?.find((b) => b.badgeId === 'first_maker');
        expect(firstMaker?.eligible).toBe(true); // 100 required
        expect(firstMaker?.category).toBe('achievement');
      });

      it('should mark water_sharer as requiring custom evaluator', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.checkBadges('sandbox-123', 'user-456');

        expect(result.success).toBe(true);

        const waterSharer = result.data?.find((b) => b.badgeId === 'water_sharer');
        expect(waterSharer?.eligible).toBe(false);
        expect(waterSharer?.reason).toContain('custom evaluator');
        expect(waterSharer?.category).toBe('special');
      });

      it('should categorize badges correctly', async () => {
        await service.createContext('sandbox-123', 'user-456');

        const result = await service.checkBadges('sandbox-123', 'user-456');

        expect(result.success).toBe(true);

        const categories = [...new Set(result.data?.map((b) => b.category))];
        expect(categories).toContain('tenure');
        expect(categories).toContain('achievement');
        expect(categories).toContain('activity');
        expect(categories).toContain('special');
      });

      it('should create context if not exists', async () => {
        const result = await service.checkBadges('sandbox-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data?.length).toBeGreaterThan(0);
      });

      it('should evaluate all badges for a high-tier user', async () => {
        await service.assumeRole('sandbox-123', 'user-456', 'naib', { rank: 1 });
        await service.updateMemberState('sandbox-123', 'user-456', {
          tenureDays: 200,
          activityScore: 100,
          convictionScore: 200,
        });

        const result = await service.checkBadges('sandbox-123', 'user-456');

        expect(result.success).toBe(true);

        const eligible = result.data?.filter((b) => b.eligible) ?? [];
        // Should have: og, veteran, elder, naib_ascended, fedaykin_initiated, usul_ascended,
        // desert_active, sietch_engaged, first_maker
        expect(eligible.length).toBeGreaterThanOrEqual(9);
      });
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe('createSimulationService', () => {
    it('should create service instance', () => {
      const svc = createSimulationService(redis);

      expect(svc).toBeInstanceOf(SimulationService);
    });

    it('should accept custom logger', async () => {
      const customLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const svc = createSimulationService(redis, customLogger);

      // Perform operation to trigger logging (must await)
      await svc.createContext('sandbox', 'user');

      // Logger should have been called
      expect(customLogger.info).toHaveBeenCalled();
    });
  });
});

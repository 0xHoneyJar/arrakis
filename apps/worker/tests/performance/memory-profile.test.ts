/**
 * Memory Profile Performance Tests
 * Sprint S-14: Performance Validation & Documentation
 *
 * Validates memory usage targets from SDD §14.1:
 * - Gateway: <40MB per 1k guilds
 * - Gateway: <200MB at 10k guilds
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PERFORMANCE_TARGETS,
  formatBytes,
  type MemorySnapshot,
} from './types.js';

// Suppress logging during benchmarks
process.env['LOG_LEVEL'] = 'silent';

/**
 * Take memory snapshot
 */
function takeMemorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    rss: usage.rss,
    timestamp: new Date(),
  };
}

/**
 * Force garbage collection if available
 */
function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

/**
 * Simulate guild data structure (matching Twilight gateway)
 */
interface SimulatedGuild {
  id: string;
  name: string;
  memberCount: number;
  channelCount: number;
  roleCount: number;
  emojiCount: number;
  ownerId: string;
  features: string[];
  premiumTier: number;
  preferredLocale: string;
  joinedAt: number;
}

/**
 * Create minimal guild object (as Twilight would store)
 */
function createMinimalGuild(index: number): SimulatedGuild {
  return {
    id: `guild-${index}`,
    name: `Test Guild ${index}`,
    memberCount: 100 + (index % 1000),
    channelCount: 10 + (index % 20),
    roleCount: 5 + (index % 15),
    emojiCount: index % 50,
    ownerId: `owner-${index}`,
    features: index % 10 === 0 ? ['COMMUNITY', 'VERIFIED'] : [],
    premiumTier: index % 4,
    preferredLocale: 'en-US',
    joinedAt: Date.now() - index * 1000,
  };
}

/**
 * Simulate worker in-memory state
 */
interface WorkerState {
  guilds: Map<string, SimulatedGuild>;
  pendingInteractions: Map<string, unknown>;
  rateLimitBuckets: Map<string, number>;
  metrics: {
    processedCount: number;
    errorCount: number;
  };
}

function createWorkerState(): WorkerState {
  return {
    guilds: new Map(),
    pendingInteractions: new Map(),
    rateLimitBuckets: new Map(),
    metrics: {
      processedCount: 0,
      errorCount: 0,
    },
  };
}

describe('Memory Profile Performance', () => {
  let baselineSnapshot: MemorySnapshot;

  beforeEach(() => {
    forceGC();
    baselineSnapshot = takeMemorySnapshot();
  });

  afterEach(() => {
    forceGC();
  });

  describe('Guild Storage Memory', () => {
    it('should use <40MB per 1k guilds (gateway target)', () => {
      const GUILD_COUNT = 1000;
      const guilds = new Map<string, SimulatedGuild>();

      // Simulate loading guilds (as gateway would receive from Discord)
      for (let i = 0; i < GUILD_COUNT; i++) {
        const guild = createMinimalGuild(i);
        guilds.set(guild.id, guild);
      }

      forceGC();
      const afterSnapshot = takeMemorySnapshot();
      const memoryUsed = afterSnapshot.heapUsed - baselineSnapshot.heapUsed;
      const memoryUsedMB = memoryUsed / (1024 * 1024);

      const target = PERFORMANCE_TARGETS.GATEWAY_MEMORY_1K;

      console.log(`\n  Guild Storage (${GUILD_COUNT} guilds):`);
      console.log(`    Heap used: ${formatBytes(memoryUsed)}`);
      console.log(`    Per guild: ${formatBytes(memoryUsed / GUILD_COUNT)}`);
      console.log(`    Target: <${target.threshold}MB`);

      // Clean up
      guilds.clear();

      expect(memoryUsedMB).toBeLessThan(target.threshold);
    });

    it('should use <200MB at 10k guilds (gateway target)', () => {
      const GUILD_COUNT = 10000;
      const guilds = new Map<string, SimulatedGuild>();

      // Simulate loading guilds
      for (let i = 0; i < GUILD_COUNT; i++) {
        const guild = createMinimalGuild(i);
        guilds.set(guild.id, guild);
      }

      forceGC();
      const afterSnapshot = takeMemorySnapshot();
      const memoryUsed = afterSnapshot.heapUsed - baselineSnapshot.heapUsed;
      const memoryUsedMB = memoryUsed / (1024 * 1024);

      const target = PERFORMANCE_TARGETS.GATEWAY_MEMORY_10K;

      console.log(`\n  Guild Storage (${GUILD_COUNT} guilds):`);
      console.log(`    Heap used: ${formatBytes(memoryUsed)}`);
      console.log(`    Per guild: ${formatBytes(memoryUsed / GUILD_COUNT)}`);
      console.log(`    Projected 10k: ${formatBytes((memoryUsed / GUILD_COUNT) * 10000)}`);
      console.log(`    Target: <${target.threshold}MB`);

      // Clean up
      guilds.clear();

      expect(memoryUsedMB).toBeLessThan(target.threshold);
    });

    it('should maintain linear memory growth', () => {
      const measurements: { count: number; memory: number }[] = [];

      for (const count of [100, 500, 1000, 2000, 5000]) {
        forceGC();
        const before = takeMemorySnapshot();

        const guilds = new Map<string, SimulatedGuild>();
        for (let i = 0; i < count; i++) {
          const guild = createMinimalGuild(i);
          guilds.set(guild.id, guild);
        }

        forceGC();
        const after = takeMemorySnapshot();
        const memoryUsed = after.heapUsed - before.heapUsed;

        measurements.push({ count, memory: memoryUsed });

        // Clean up
        guilds.clear();
      }

      console.log('\n  Memory Growth (linear check):');
      for (const { count, memory } of measurements) {
        const perGuild = memory / count;
        console.log(`    ${count} guilds: ${formatBytes(memory)} (${formatBytes(perGuild)}/guild)`);
      }

      // Memory per guild should be roughly constant (within 50% variance)
      const perGuildSizes = measurements.map((m) => m.memory / m.count);
      const avgPerGuild = perGuildSizes.reduce((a, b) => a + b, 0) / perGuildSizes.length;

      for (const size of perGuildSizes) {
        const variance = Math.abs(size - avgPerGuild) / avgPerGuild;
        expect(variance).toBeLessThan(0.5); // Within 50%
      }
    });
  });

  describe('Worker State Memory', () => {
    it('should efficiently manage pending interactions', () => {
      const state = createWorkerState();
      const INTERACTION_COUNT = 100;

      // Simulate pending interactions
      for (let i = 0; i < INTERACTION_COUNT; i++) {
        state.pendingInteractions.set(`interaction-${i}`, {
          id: `interaction-${i}`,
          token: `token-${i}`,
          type: 2,
          data: {
            name: 'profile',
            options: [],
          },
          timestamp: Date.now(),
        });
      }

      forceGC();
      const afterSnapshot = takeMemorySnapshot();
      const memoryUsed = afterSnapshot.heapUsed - baselineSnapshot.heapUsed;

      console.log(`\n  Pending Interactions (${INTERACTION_COUNT}):`);
      console.log(`    Total: ${formatBytes(memoryUsed)}`);
      console.log(`    Per interaction: ${formatBytes(memoryUsed / INTERACTION_COUNT)}`);

      // 100 interactions should use less than 10MB
      expect(memoryUsed / (1024 * 1024)).toBeLessThan(10);
    });

    it('should efficiently manage rate limit buckets', () => {
      const BUCKET_COUNT = 1000;
      const buckets = new Map<string, number>();

      // Simulate rate limit tracking per guild
      for (let i = 0; i < BUCKET_COUNT; i++) {
        buckets.set(`guild-${i}:commands`, Date.now() + 60000);
        buckets.set(`guild-${i}:events`, Date.now() + 5000);
      }

      forceGC();
      const afterSnapshot = takeMemorySnapshot();
      const memoryUsed = afterSnapshot.heapUsed - baselineSnapshot.heapUsed;

      console.log(`\n  Rate Limit Buckets (${BUCKET_COUNT * 2} entries):`);
      console.log(`    Total: ${formatBytes(memoryUsed)}`);
      console.log(`    Per bucket: ${formatBytes(memoryUsed / (BUCKET_COUNT * 2))}`);

      // 2000 rate limit entries should use less than 5MB
      expect(memoryUsed / (1024 * 1024)).toBeLessThan(5);
    });
  });

  describe('Cache Memory Efficiency', () => {
    it('should bound L1 cache memory usage', () => {
      const CACHE_SIZE = 1000;
      const cache = new Map<string, unknown>();

      // Simulate L1 cache entries
      for (let i = 0; i < CACHE_SIZE; i++) {
        cache.set(`user:${i}:profile`, {
          userId: `user-${i}`,
          score: Math.random() * 100000,
          rank: i + 1,
          tier: 'gold',
          badges: Array(5).fill({ id: 'badge-1', name: 'Badge' }),
          cachedAt: Date.now(),
        });
      }

      forceGC();
      const afterSnapshot = takeMemorySnapshot();
      const memoryUsed = afterSnapshot.heapUsed - baselineSnapshot.heapUsed;
      const memoryUsedMB = memoryUsed / (1024 * 1024);

      console.log(`\n  L1 Cache (${CACHE_SIZE} entries):`);
      console.log(`    Total: ${formatBytes(memoryUsed)}`);
      console.log(`    Per entry: ${formatBytes(memoryUsed / CACHE_SIZE)}`);

      // L1 cache with 1000 entries should use less than 20MB
      expect(memoryUsedMB).toBeLessThan(20);

      // Clean up
      cache.clear();
    });
  });

  describe('Tracing Memory Overhead', () => {
    it('should not significantly increase memory with tracing spans', () => {
      const SPAN_COUNT = 1000;
      const spans: unknown[] = [];

      // Simulate span storage (before export)
      for (let i = 0; i < SPAN_COUNT; i++) {
        spans.push({
          traceId: `trace-${i}`.padEnd(32, '0'),
          spanId: `span-${i}`.padEnd(16, '0'),
          name: 'command.process',
          startTime: Date.now(),
          endTime: Date.now() + Math.random() * 100,
          attributes: {
            'service.name': 'arrakis-worker',
            'command.name': 'profile',
            'guild.id': `guild-${i % 100}`,
          },
          events: [],
          status: { code: 1 },
        });
      }

      forceGC();
      const afterSnapshot = takeMemorySnapshot();
      const memoryUsed = afterSnapshot.heapUsed - baselineSnapshot.heapUsed;

      console.log(`\n  Tracing Spans (${SPAN_COUNT} spans in buffer):`);
      console.log(`    Total: ${formatBytes(memoryUsed)}`);
      console.log(`    Per span: ${formatBytes(memoryUsed / SPAN_COUNT)}`);

      // 1000 spans in buffer should use less than 10MB
      expect(memoryUsed / (1024 * 1024)).toBeLessThan(10);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated guild operations', () => {
      const iterations = 10;
      const guildCount = 100;
      const memoryDeltas: number[] = [];

      for (let iter = 0; iter < iterations; iter++) {
        forceGC();
        const before = takeMemorySnapshot();

        // Simulate guild lifecycle
        const guilds = new Map<string, SimulatedGuild>();
        for (let i = 0; i < guildCount; i++) {
          guilds.set(`guild-${i}`, createMinimalGuild(i));
        }

        // Simulate guild leave (clear)
        guilds.clear();

        forceGC();
        const after = takeMemorySnapshot();
        memoryDeltas.push(after.heapUsed - before.heapUsed);
      }

      // Memory should return to roughly the same level after each iteration
      const avgDelta = memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length;
      const lastDelta = memoryDeltas[memoryDeltas.length - 1];

      console.log(`\n  Memory Leak Detection (${iterations} iterations):`);
      console.log(`    Average delta: ${formatBytes(avgDelta)}`);
      console.log(`    Final delta: ${formatBytes(lastDelta)}`);

      // Final delta should not be significantly larger than average
      // (would indicate accumulating memory)
      expect(Math.abs(lastDelta - avgDelta)).toBeLessThan(5 * 1024 * 1024); // 5MB tolerance
    });
  });
});

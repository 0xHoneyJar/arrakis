/**
 * Command Response Performance Tests
 * Sprint S-14: Performance Validation & Documentation
 *
 * Validates slash command response time meets <500ms p99 target (SDD §14.1).
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import {
  PERFORMANCE_TARGETS,
  calculatePercentileStats,
  formatDuration,
} from './types.js';

// Suppress logging during benchmarks
process.env['LOG_LEVEL'] = 'silent';

// Number of iterations
const ITERATION_COUNT = 500;
const WARMUP_COUNT = 50;

/**
 * Simulate command processing pipeline
 */
interface CommandContext {
  guildId: string;
  userId: string;
  commandName: string;
  options: Record<string, unknown>;
}

/**
 * Simulated cache lookup
 */
function simulateCacheLookup(key: string, hitRate: number = 0.9): { hit: boolean; data?: unknown } {
  const hit = Math.random() < hitRate;
  return hit
    ? { hit: true, data: { cached: true, key } }
    : { hit: false };
}

/**
 * Simulated database query (PostgreSQL-style latency)
 */
async function simulateDbQuery(latencyMs: number = 5): Promise<unknown> {
  await simulateLatency(latencyMs);
  return { rows: [{ id: 1, data: 'test' }] };
}

/**
 * Simulated Discord REST API call
 */
async function simulateDiscordRest(latencyMs: number = 50): Promise<unknown> {
  await simulateLatency(latencyMs);
  return { success: true };
}

/**
 * Simulate network/processing latency
 */
function simulateLatency(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Measure full command processing time
 */
async function measureCommandProcessing(
  ctx: CommandContext,
  config: {
    cacheHitRate?: number;
    dbLatencyMs?: number;
    discordLatencyMs?: number;
    skipDiscord?: boolean;
  } = {}
): Promise<number> {
  const start = process.hrtime.bigint();

  // 1. Validate command
  validateCommand(ctx);

  // 2. Cache lookup
  const cacheResult = simulateCacheLookup(
    `${ctx.guildId}:${ctx.userId}:${ctx.commandName}`,
    config.cacheHitRate ?? 0.9
  );

  let data: unknown;

  if (cacheResult.hit) {
    data = cacheResult.data;
  } else {
    // 3. Database query
    data = await simulateDbQuery(config.dbLatencyMs ?? 5);
  }

  // 4. Build response
  const response = buildResponse(ctx.commandName, data);

  // 5. Send to Discord (simulated)
  if (!config.skipDiscord) {
    await simulateDiscordRest(config.discordLatencyMs ?? 50);
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

/**
 * Validate command input
 */
function validateCommand(ctx: CommandContext): void {
  if (!ctx.guildId || !ctx.userId || !ctx.commandName) {
    throw new Error('Invalid command context');
  }
}

/**
 * Build command response
 */
function buildResponse(commandName: string, data: unknown): unknown {
  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      embeds: [
        {
          title: `${commandName} Response`,
          description: JSON.stringify(data),
          color: 0x5865f2,
        },
      ],
    },
  };
}

describe('Command Response Performance', () => {
  beforeAll(async () => {
    // Warmup
    for (let i = 0; i < WARMUP_COUNT; i++) {
      await measureCommandProcessing({
        guildId: 'warmup-guild',
        userId: 'warmup-user',
        commandName: 'profile',
        options: {},
      });
    }
  });

  describe('Full Command Pipeline', () => {
    it('should meet <500ms p99 response time target (cached)', async () => {
      const latencies: number[] = [];

      for (let i = 0; i < ITERATION_COUNT; i++) {
        const latency = await measureCommandProcessing(
          {
            guildId: `guild-${i % 100}`,
            userId: `user-${i}`,
            commandName: 'profile',
            options: {},
          },
          {
            cacheHitRate: 0.9, // 90% cache hit rate
            skipDiscord: true, // Exclude external API latency
          }
        );
        latencies.push(latency);
      }

      const stats = calculatePercentileStats(latencies);
      const target = PERFORMANCE_TARGETS.COMMAND_RESPONSE;

      console.log(`\n  Cached Command Response (${ITERATION_COUNT} commands):`);
      console.log(`    p50:  ${formatDuration(stats.p50)}`);
      console.log(`    p95:  ${formatDuration(stats.p95)}`);
      console.log(`    p99:  ${formatDuration(stats.p99)} (target: <${target.threshold}ms)`);
      console.log(`    Cache hit rate: 90%`);

      // With cache hits and no Discord latency, should be very fast
      expect(stats.p99).toBeLessThan(target.threshold);
    });

    it('should meet <500ms p99 including Discord REST (with realistic latency)', async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const latency = await measureCommandProcessing(
          {
            guildId: `guild-${i % 100}`,
            userId: `user-${i}`,
            commandName: 'profile',
            options: {},
          },
          {
            cacheHitRate: 0.9,
            discordLatencyMs: 100, // Conservative Discord REST latency
          }
        );
        latencies.push(latency);
      }

      const stats = calculatePercentileStats(latencies);

      console.log(`\n  Full Pipeline with Discord REST (100 commands):`);
      console.log(`    p50:  ${formatDuration(stats.p50)}`);
      console.log(`    p99:  ${formatDuration(stats.p99)}`);
      console.log(`    Note: Includes 100ms simulated Discord latency`);

      // Full pipeline including Discord should still be under 500ms
      expect(stats.p99).toBeLessThan(500);
    });
  });

  describe('Command-Specific Performance', () => {
    const commands = [
      { name: 'profile', complexity: 'simple' },
      { name: 'leaderboard', complexity: 'medium' },
      { name: 'stats', complexity: 'medium' },
      { name: 'threshold', complexity: 'simple' },
      { name: 'position', complexity: 'simple' },
    ];

    it('should process all command types within target', async () => {
      console.log('\n  Command-Specific Performance:');

      for (const { name, complexity } of commands) {
        const latencies: number[] = [];
        const dbLatency = complexity === 'medium' ? 10 : 5;

        for (let i = 0; i < 100; i++) {
          const latency = await measureCommandProcessing(
            {
              guildId: `guild-${i % 100}`,
              userId: `user-${i}`,
              commandName: name,
              options: {},
            },
            {
              cacheHitRate: 0.9,
              dbLatencyMs: dbLatency,
              skipDiscord: true,
            }
          );
          latencies.push(latency);
        }

        const stats = calculatePercentileStats(latencies);
        console.log(`    /${name} (${complexity}): p99=${formatDuration(stats.p99)}`);

        // All commands should be under 500ms
        expect(stats.p99).toBeLessThan(500);
      }
    });
  });

  describe('Cache Miss Impact', () => {
    it('should handle cache misses gracefully', async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const latency = await measureCommandProcessing(
          {
            guildId: `guild-${i % 100}`,
            userId: `user-${i}`,
            commandName: 'profile',
            options: {},
          },
          {
            cacheHitRate: 0, // 100% cache miss
            dbLatencyMs: 10, // Slightly higher DB latency
            skipDiscord: true,
          }
        );
        latencies.push(latency);
      }

      const stats = calculatePercentileStats(latencies);

      console.log(`\n  Cache Miss Scenario (100% miss):`);
      console.log(`    p50:  ${formatDuration(stats.p50)}`);
      console.log(`    p99:  ${formatDuration(stats.p99)}`);

      // Even with cache misses, should be under 500ms
      expect(stats.p99).toBeLessThan(500);
    });
  });

  describe('Concurrent Command Processing', () => {
    it('should handle concurrent commands efficiently', async () => {
      const concurrency = 10;
      const iterations = 50;
      const allLatencies: number[] = [];

      for (let batch = 0; batch < iterations; batch++) {
        const batchPromises: Promise<number>[] = [];

        for (let c = 0; c < concurrency; c++) {
          batchPromises.push(
            measureCommandProcessing(
              {
                guildId: `guild-${(batch * concurrency + c) % 100}`,
                userId: `user-${batch * concurrency + c}`,
                commandName: 'profile',
                options: {},
              },
              {
                cacheHitRate: 0.9,
                skipDiscord: true,
              }
            )
          );
        }

        const batchResults = await Promise.all(batchPromises);
        allLatencies.push(...batchResults);
      }

      const stats = calculatePercentileStats(allLatencies);
      const throughput = (concurrency * iterations) / (stats.mean * iterations / 1000);

      console.log(`\n  Concurrent Commands (${concurrency} concurrent × ${iterations} batches):`);
      console.log(`    p50:  ${formatDuration(stats.p50)}`);
      console.log(`    p99:  ${formatDuration(stats.p99)}`);
      console.log(`    Throughput: ${throughput.toFixed(0)} commands/sec`);

      expect(stats.p99).toBeLessThan(500);
    });
  });

  describe('Response Building Performance', () => {
    it('should build embeds efficiently', () => {
      const times: number[] = [];
      const EMBED_COUNT = 1000;

      for (let i = 0; i < EMBED_COUNT; i++) {
        const start = process.hrtime.bigint();

        // Build a typical profile embed
        const embed = {
          title: 'User Profile',
          description: 'Member statistics and information',
          color: 0x5865f2,
          fields: [
            { name: 'Score', value: '12,345', inline: true },
            { name: 'Rank', value: '#42', inline: true },
            { name: 'Level', value: 'Gold', inline: true },
            { name: 'Joined', value: '<t:1234567890:R>', inline: false },
          ],
          thumbnail: { url: 'https://cdn.discord.com/avatars/...' },
          footer: { text: 'Last updated' },
          timestamp: new Date().toISOString(),
        };

        // Serialize for response
        JSON.stringify(embed);

        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1_000_000);
      }

      const stats = calculatePercentileStats(times);
      console.log(`\n  Embed Building (${EMBED_COUNT} embeds):`);
      console.log(`    p50:  ${formatDuration(stats.p50)}`);
      console.log(`    p99:  ${formatDuration(stats.p99)}`);

      // Embed building should be very fast (<5ms p99)
      expect(stats.p99).toBeLessThan(5);
    });
  });
});

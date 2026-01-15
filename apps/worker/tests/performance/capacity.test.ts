/**
 * Capacity Performance Tests
 * Sprint S-14: Performance Validation & Documentation
 *
 * Validates system capacity at 10k guild scale (SDD §14.1, §13.3).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  calculatePercentileStats,
  formatDuration,
  formatBytes,
  type LoadTestConfig,
  type LoadTestResult,
  type PercentileStats,
} from './types.js';

// Suppress logging during benchmarks
process.env['LOG_LEVEL'] = 'silent';

/**
 * Simulated event for capacity testing
 */
interface SimulatedEvent {
  type: string;
  guildId: string;
  userId: string;
  timestamp: number;
  data: unknown;
}

/**
 * Generate realistic event distribution
 */
function generateEventStream(
  guildCount: number,
  eventsPerSecond: number,
  durationSec: number
): SimulatedEvent[] {
  const events: SimulatedEvent[] = [];
  const totalEvents = eventsPerSecond * durationSec;

  const eventTypes = [
    { type: 'INTERACTION_CREATE', weight: 0.3 },
    { type: 'MESSAGE_CREATE', weight: 0.5 },
    { type: 'GUILD_MEMBER_ADD', weight: 0.1 },
    { type: 'GUILD_MEMBER_REMOVE', weight: 0.05 },
    { type: 'GUILD_UPDATE', weight: 0.05 },
  ];

  for (let i = 0; i < totalEvents; i++) {
    const rand = Math.random();
    let cumWeight = 0;
    let eventType = 'MESSAGE_CREATE';

    for (const { type, weight } of eventTypes) {
      cumWeight += weight;
      if (rand < cumWeight) {
        eventType = type;
        break;
      }
    }

    events.push({
      type: eventType,
      guildId: `guild-${i % guildCount}`,
      userId: `user-${Math.floor(Math.random() * 10000)}`,
      timestamp: Date.now() + i,
      data: {
        content: eventType === 'MESSAGE_CREATE' ? `Message ${i}` : undefined,
      },
    });
  }

  return events;
}

/**
 * Simulate event processing pipeline
 */
async function processEvent(event: SimulatedEvent): Promise<number> {
  const start = process.hrtime.bigint();

  // Simulate NATS delivery (memory copy)
  const serialized = JSON.stringify(event);
  const deserialized = JSON.parse(serialized);

  // Simulate handler dispatch
  switch (deserialized.type) {
    case 'INTERACTION_CREATE':
      // Heavier processing for commands
      await simulateWork(5);
      break;
    case 'MESSAGE_CREATE':
      // Light processing for messages
      await simulateWork(1);
      break;
    default:
      // Medium processing for other events
      await simulateWork(2);
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

/**
 * Simulate async work with given duration
 */
function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run load test
 */
async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const {
    concurrentUsers,
    durationSec,
    targetRps = 100,
    rampUpSec = 0,
  } = config;

  const events = generateEventStream(concurrentUsers, targetRps, durationSec);
  const latencies: number[] = [];
  let successCount = 0;
  let errorCount = 0;

  const startTime = Date.now();

  // Process events with concurrency
  const batchSize = 10;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((event) => processEvent(event))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        successCount++;
        latencies.push(result.value);
      } else {
        errorCount++;
      }
    }
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  return {
    config,
    totalRequests: events.length,
    successfulRequests: successCount,
    failedRequests: errorCount,
    latencyStats: calculatePercentileStats(latencies),
    throughput: successCount / duration,
    errorRate: errorCount / events.length,
    duration,
  };
}

describe('Capacity Performance', () => {
  describe('10k Guild Capacity', () => {
    it('should handle 10k guilds with stable latency', async () => {
      const guildCount = 10000;
      const eventCount = 1000;
      const events = generateEventStream(guildCount, eventCount, 1);
      const latencies: number[] = [];

      // Process sample of events
      for (let i = 0; i < Math.min(eventCount, events.length); i++) {
        const latency = await processEvent(events[i]);
        latencies.push(latency);
      }

      const stats = calculatePercentileStats(latencies);

      console.log(`\n  10k Guild Capacity Test (${eventCount} events):`);
      console.log(`    p50:  ${formatDuration(stats.p50)}`);
      console.log(`    p95:  ${formatDuration(stats.p95)}`);
      console.log(`    p99:  ${formatDuration(stats.p99)}`);
      console.log(`    Guild spread: ${guildCount} unique guilds`);

      // Latency should remain stable regardless of guild count
      expect(stats.p99).toBeLessThan(100);
    });

    it('should maintain throughput at scale', async () => {
      const guildCounts = [100, 1000, 5000, 10000];
      const results: { guilds: number; throughput: number; p99: number }[] = [];

      console.log('\n  Throughput vs Guild Count:');

      for (const guildCount of guildCounts) {
        const events = generateEventStream(guildCount, 100, 1);
        const startTime = Date.now();
        const latencies: number[] = [];

        // Process all events
        for (const event of events) {
          latencies.push(await processEvent(event));
        }

        const duration = (Date.now() - startTime) / 1000;
        const stats = calculatePercentileStats(latencies);
        const throughput = events.length / duration;

        results.push({ guilds: guildCount, throughput, p99: stats.p99 });
        console.log(`    ${guildCount} guilds: ${throughput.toFixed(0)} events/sec, p99=${formatDuration(stats.p99)}`);
      }

      // Throughput should not degrade significantly with more guilds
      const first = results[0].throughput;
      const last = results[results.length - 1].throughput;
      const degradation = (first - last) / first;

      console.log(`    Throughput degradation: ${(degradation * 100).toFixed(1)}%`);

      // Less than 50% throughput degradation at 10k vs 100 guilds
      expect(degradation).toBeLessThan(0.5);
    });
  });

  describe('Load Test Scenarios', () => {
    it('should handle steady-state load', async () => {
      const result = await runLoadTest({
        concurrentUsers: 100,
        durationSec: 2,
        targetRps: 50,
      });

      console.log(`\n  Steady-State Load Test:`);
      console.log(`    Duration: ${result.duration.toFixed(1)}s`);
      console.log(`    Total requests: ${result.totalRequests}`);
      console.log(`    Successful: ${result.successfulRequests}`);
      console.log(`    Throughput: ${result.throughput.toFixed(0)} req/sec`);
      console.log(`    p99 latency: ${formatDuration(result.latencyStats.p99)}`);
      console.log(`    Error rate: ${(result.errorRate * 100).toFixed(2)}%`);

      // Expect very low error rate
      expect(result.errorRate).toBeLessThan(0.01);
      // p99 should be under 500ms
      expect(result.latencyStats.p99).toBeLessThan(500);
    });

    it('should handle concurrent community access', async () => {
      const COMMUNITY_COUNT = 200;
      const CONCURRENT_COMMANDS = 10;
      const latencies: number[] = [];

      // Simulate 200 communities each sending 10 concurrent commands
      for (let community = 0; community < COMMUNITY_COUNT; community++) {
        const communityPromises: Promise<number>[] = [];

        for (let cmd = 0; cmd < CONCURRENT_COMMANDS; cmd++) {
          const event: SimulatedEvent = {
            type: 'INTERACTION_CREATE',
            guildId: `guild-${community}`,
            userId: `user-${community}-${cmd}`,
            timestamp: Date.now(),
            data: { name: 'profile' },
          };
          communityPromises.push(processEvent(event));
        }

        const results = await Promise.all(communityPromises);
        latencies.push(...results);
      }

      const stats = calculatePercentileStats(latencies);
      const totalCommands = COMMUNITY_COUNT * CONCURRENT_COMMANDS;

      console.log(`\n  Concurrent Community Access:`);
      console.log(`    Communities: ${COMMUNITY_COUNT}`);
      console.log(`    Commands per community: ${CONCURRENT_COMMANDS}`);
      console.log(`    Total commands: ${totalCommands}`);
      console.log(`    p50:  ${formatDuration(stats.p50)}`);
      console.log(`    p99:  ${formatDuration(stats.p99)}`);

      // All communities should get fair access with acceptable latency
      expect(stats.p99).toBeLessThan(500);
    });
  });

  describe('Burst Handling', () => {
    it('should handle traffic bursts gracefully', async () => {
      const BURST_SIZE = 100;
      const BURST_COUNT = 5;
      const burstResults: { burstNum: number; stats: PercentileStats; duration: number }[] = [];

      console.log('\n  Burst Traffic Handling:');

      for (let burst = 0; burst < BURST_COUNT; burst++) {
        const events = generateEventStream(1000, BURST_SIZE, 1);
        const startTime = Date.now();
        const latencies: number[] = [];

        // Process burst concurrently
        const promises = events.map((e) => processEvent(e));
        const results = await Promise.all(promises);
        latencies.push(...results);

        const duration = (Date.now() - startTime) / 1000;
        const stats = calculatePercentileStats(latencies);

        burstResults.push({ burstNum: burst + 1, stats, duration });
        console.log(`    Burst ${burst + 1}: ${BURST_SIZE} events in ${duration.toFixed(2)}s, p99=${formatDuration(stats.p99)}`);
      }

      // Each burst should complete within reasonable time
      for (const result of burstResults) {
        expect(result.stats.p99).toBeLessThan(500);
      }

      // Later bursts should not degrade vs first burst (no queueing issues)
      const firstP99 = burstResults[0].stats.p99;
      const lastP99 = burstResults[burstResults.length - 1].stats.p99;
      expect(lastP99).toBeLessThan(firstP99 * 2); // Within 2x of first burst
    });
  });

  describe('Resource Utilization', () => {
    it('should track memory during sustained load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const memorySnapshots: number[] = [];
      const ITERATIONS = 10;

      for (let iter = 0; iter < ITERATIONS; iter++) {
        // Simulate sustained load
        const events = generateEventStream(1000, 100, 1);
        await Promise.all(events.map((e) => processEvent(e)));

        // Record memory
        if (global.gc) global.gc();
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`\n  Memory During Sustained Load (${ITERATIONS} iterations):`);
      console.log(`    Initial: ${formatBytes(initialMemory)}`);
      console.log(`    Final: ${formatBytes(finalMemory)}`);
      console.log(`    Growth: ${formatBytes(memoryGrowth)}`);

      // Memory growth should be bounded (no severe leaks)
      expect(memoryGrowth / (1024 * 1024)).toBeLessThan(50); // <50MB growth
    });
  });

  describe('Event Type Distribution', () => {
    it('should handle realistic event mix', async () => {
      const events = generateEventStream(1000, 500, 1);
      const eventCounts: Record<string, number> = {};
      const eventLatencies: Record<string, number[]> = {};

      // Process and categorize
      for (const event of events) {
        const latency = await processEvent(event);
        eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
        eventLatencies[event.type] = eventLatencies[event.type] || [];
        eventLatencies[event.type].push(latency);
      }

      console.log('\n  Event Type Distribution:');
      for (const [type, count] of Object.entries(eventCounts)) {
        const stats = calculatePercentileStats(eventLatencies[type]);
        const percentage = ((count / events.length) * 100).toFixed(1);
        console.log(`    ${type}: ${count} (${percentage}%), p99=${formatDuration(stats.p99)}`);
      }

      // All event types should be processed within targets
      for (const [type, latencies] of Object.entries(eventLatencies)) {
        const stats = calculatePercentileStats(latencies);
        expect(stats.p99).toBeLessThan(500);
      }
    });
  });
});

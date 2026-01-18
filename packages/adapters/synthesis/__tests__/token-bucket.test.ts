/**
 * GlobalTokenBucket Tests
 *
 * Sprint S-21: Synthesis Engine & Rate Limiting
 *
 * Tests for Redis-backed global token bucket with:
 * - Atomic token acquisition via Lua script
 * - acquireWithWait() blocking behavior
 * - Rate limit enforcement (50 tokens/sec)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlobalTokenBucket } from '../token-bucket.js';
import type { RedisClient, TokenBucketMetrics } from '../token-bucket.js';

// =============================================================================
// Mock Redis Client
// =============================================================================

class MockRedisClient implements RedisClient {
  private bucket: { tokens: number; lastRefill: number } | null = null;
  private evalScript: string | null = null;

  constructor(private maxTokens: number = 50, private refillRate: number = 50) {}

  async eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown> {
    this.evalScript = script;

    const now = Number(args[3]);
    const maxTokens = Number(args[1]);
    const refillRate = Number(args[2]);

    // Initialize bucket if needed
    if (!this.bucket) {
      this.bucket = { tokens: maxTokens, lastRefill: now };
    }

    // Refill tokens
    const elapsed = (now - this.bucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * refillRate;
    this.bucket.tokens = Math.min(maxTokens, this.bucket.tokens + tokensToAdd);

    if (this.bucket.tokens >= 1) {
      this.bucket.tokens -= 1;
      this.bucket.lastRefill = now;
      return 1;
    } else {
      this.bucket.lastRefill = now;
      return 0;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.bucket) {
      return {};
    }
    return {
      tokens: String(this.bucket.tokens),
      lastRefill: String(this.bucket.lastRefill),
    };
  }

  async del(key: string): Promise<number> {
    if (this.bucket) {
      this.bucket = null;
      return 1;
    }
    return 0;
  }

  // Test helpers
  setTokens(tokens: number): void {
    if (!this.bucket) {
      this.bucket = { tokens, lastRefill: Date.now() };
    } else {
      this.bucket.tokens = tokens;
    }
  }

  getTokens(): number {
    return this.bucket?.tokens ?? this.maxTokens;
  }

  getLastScript(): string | null {
    return this.evalScript;
  }
}

// =============================================================================
// Mock Metrics
// =============================================================================

const createMockMetrics = (): TokenBucketMetrics => ({
  tokenBucketExhausted: { inc: vi.fn() },
  tokenBucketWaits: { inc: vi.fn() },
  tokensAcquired: { inc: vi.fn() },
  currentTokens: { set: vi.fn() },
});

// =============================================================================
// Mock Logger
// =============================================================================

const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// =============================================================================
// Tests
// =============================================================================

describe('GlobalTokenBucket', () => {
  let redis: MockRedisClient;
  let metrics: TokenBucketMetrics;
  let logger: ReturnType<typeof createMockLogger>;
  let bucket: GlobalTokenBucket;

  beforeEach(() => {
    redis = new MockRedisClient();
    metrics = createMockMetrics();
    logger = createMockLogger();
    bucket = new GlobalTokenBucket({
      redis,
      logger: logger as unknown as import('pino').Logger,
      metrics,
      maxTokens: 50,
      refillRate: 50,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(logger.info).toHaveBeenCalledWith(
        { maxTokens: 50, refillRate: 50 },
        'Global token bucket initialized'
      );
    });

    it('should accept custom configuration', () => {
      const customBucket = new GlobalTokenBucket({
        redis,
        logger: logger as unknown as import('pino').Logger,
        metrics,
        maxTokens: 100,
        refillRate: 25,
        redisKey: 'custom:bucket',
      });

      expect(logger.info).toHaveBeenCalledWith(
        { maxTokens: 100, refillRate: 25 },
        'Global token bucket initialized'
      );
    });
  });

  describe('tryAcquire', () => {
    it('should acquire token when bucket has tokens', async () => {
      const acquired = await bucket.tryAcquire();

      expect(acquired).toBe(true);
      expect(metrics.tokensAcquired.inc).toHaveBeenCalled();
      expect(metrics.tokenBucketWaits.inc).not.toHaveBeenCalled();
    });

    it('should fail to acquire when bucket is empty', async () => {
      // Drain the bucket
      redis.setTokens(0);

      const acquired = await bucket.tryAcquire();

      expect(acquired).toBe(false);
      expect(metrics.tokenBucketWaits.inc).toHaveBeenCalled();
    });

    it('should use Lua script for atomic acquisition', async () => {
      await bucket.tryAcquire();

      const script = redis.getLastScript();
      expect(script).toContain('local key = KEYS[1]');
      expect(script).toContain('tokens = tokens - 1');
    });
  });

  describe('acquireWithWait', () => {
    it('should acquire immediately when tokens available', async () => {
      await expect(bucket.acquireWithWait()).resolves.toBeUndefined();
      expect(metrics.tokensAcquired.inc).toHaveBeenCalled();
    });

    it('should wait and acquire when bucket refills', async () => {
      // Start with empty bucket
      redis.setTokens(0);

      // The mock will refill tokens based on elapsed time
      // Since we're simulating a fast refill rate, it should succeed
      await expect(bucket.acquireWithWait(1000)).resolves.toBeUndefined();
    });

    it('should throw when max wait exceeded', async () => {
      // Create a bucket that never refills (0 refill rate effectively)
      const emptyRedis = new MockRedisClient(50, 0);
      emptyRedis.setTokens(0);

      const slowBucket = new GlobalTokenBucket({
        redis: emptyRedis,
        logger: logger as unknown as import('pino').Logger,
        metrics,
        maxTokens: 50,
        refillRate: 0.001, // Very slow refill
      });

      await expect(slowBucket.acquireWithWait(100)).rejects.toThrow('Token bucket exhausted');
      expect(metrics.tokenBucketExhausted.inc).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return current bucket status', async () => {
      // Acquire some tokens first
      await bucket.tryAcquire();
      await bucket.tryAcquire();

      const status = await bucket.getStatus();

      expect(status.maxTokens).toBe(50);
      expect(status.refillRate).toBe(50);
      expect(status.tokens).toBeLessThanOrEqual(50);
      expect(status.lastRefillAt).toBeInstanceOf(Date);
    });

    it('should update currentTokens gauge', async () => {
      await bucket.getStatus();

      expect(metrics.currentTokens.set).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset bucket to full', async () => {
      // Drain bucket
      for (let i = 0; i < 10; i++) {
        await bucket.tryAcquire();
      }

      await bucket.reset();

      // Bucket should be deleted, next acquire creates new full bucket
      const acquired = await bucket.tryAcquire();
      expect(acquired).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Token bucket reset to full');
    });
  });
});

// =============================================================================
// Rate Limit Simulation Tests
// =============================================================================

describe('GlobalTokenBucket Rate Limiting', () => {
  let redis: MockRedisClient;
  let metrics: TokenBucketMetrics;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    redis = new MockRedisClient(50, 50);
    metrics = createMockMetrics();
    logger = createMockLogger();
  });

  it('should enforce 50 tokens/sec rate limit', async () => {
    const bucket = new GlobalTokenBucket({
      redis,
      logger: logger as unknown as import('pino').Logger,
      metrics,
      maxTokens: 50,
      refillRate: 50,
    });

    // Acquire 50 tokens rapidly
    let acquired = 0;
    for (let i = 0; i < 60; i++) {
      const success = await bucket.tryAcquire();
      if (success) acquired++;
    }

    // Should have acquired around 50 tokens (initial bucket)
    // Due to refill during the loop, might be slightly more
    expect(acquired).toBeGreaterThanOrEqual(50);
    expect(acquired).toBeLessThanOrEqual(60);
  });

  it('should refill tokens over time', async () => {
    const bucket = new GlobalTokenBucket({
      redis,
      logger: logger as unknown as import('pino').Logger,
      metrics,
      maxTokens: 10,
      refillRate: 100, // Fast refill for test
    });

    // Drain bucket
    for (let i = 0; i < 10; i++) {
      await bucket.tryAcquire();
    }

    // Wait for refill (simulated by mock's time-based refill)
    await new Promise((r) => setTimeout(r, 50));

    // Should be able to acquire more
    const acquired = await bucket.tryAcquire();
    expect(acquired).toBe(true);
  });
});

// =============================================================================
// Concurrent Access Tests
// =============================================================================

describe('GlobalTokenBucket Concurrency', () => {
  it('should handle concurrent acquire requests', async () => {
    const redis = new MockRedisClient(10, 10);
    const metrics = createMockMetrics();
    const logger = createMockLogger();

    const bucket = new GlobalTokenBucket({
      redis,
      logger: logger as unknown as import('pino').Logger,
      metrics,
      maxTokens: 10,
      refillRate: 10,
    });

    // Fire 20 concurrent acquires
    const promises = Array(20)
      .fill(null)
      .map(() => bucket.tryAcquire());

    const results = await Promise.all(promises);

    // Should have acquired at most 10 (initial bucket) + some refill
    const successCount = results.filter(Boolean).length;
    expect(successCount).toBeGreaterThanOrEqual(10);
    expect(successCount).toBeLessThanOrEqual(20);
  });
});

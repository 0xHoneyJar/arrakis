/**
 * Pre-Auth IP Rate Limiter
 * Sprint S2-T3: In-memory token bucket per IP, applied before auth processing
 *
 * 100 requests/min per IP with burst capacity of 20.
 * Returns 429 with Retry-After header before any JWT/auth processing.
 * In-memory only — no Redis dependency for this layer.
 *
 * @see SDD §4.5 Pre-Auth IP Rate Limiter
 */

import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface IpRateLimitConfig {
  /** Maximum requests per window (default: 100) */
  maxPerWindow: number;
  /** Window size in milliseconds (default: 60_000) */
  windowMs: number;
  /** Burst capacity — max tokens in bucket (default: 20) */
  burstCapacity: number;
  /** Maximum tracked IPs before LRU eviction (default: 10_000) */
  maxEntries: number;
}

interface TokenBucket {
  tokens: number;
  lastRefillMs: number;
}

// --------------------------------------------------------------------------
// Defaults
// --------------------------------------------------------------------------

const DEFAULT_CONFIG: IpRateLimitConfig = {
  maxPerWindow: 100,
  windowMs: 60_000,
  burstCapacity: 20,
  maxEntries: 10_000,
};

// --------------------------------------------------------------------------
// IP Rate Limiter
// --------------------------------------------------------------------------

export class IpRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly config: IpRateLimitConfig;
  private readonly refillRatePerMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly logger: Logger,
    config?: Partial<IpRateLimitConfig>,
  ) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    if (merged.windowMs <= 0 || merged.maxPerWindow <= 0 || merged.burstCapacity <= 0 || merged.maxEntries <= 0) {
      throw new Error('Invalid IpRateLimitConfig: all values must be > 0');
    }
    this.config = merged;
    this.refillRatePerMs = this.config.maxPerWindow / this.config.windowMs;
    this.startCleanup();
  }

  /**
   * Check if a request from the given IP is allowed.
   * Consumes one token on success.
   */
  check(ip: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    let bucket = this.buckets.get(ip);

    if (!bucket) {
      // Evict LRU if at capacity
      if (this.buckets.size >= this.config.maxEntries) {
        this.evictOldest();
      }
      bucket = { tokens: this.config.burstCapacity, lastRefillMs: now };
      this.buckets.set(ip, bucket);
    } else {
      // Touch entry to maintain LRU order (most recently used at end)
      this.buckets.delete(ip);
      this.buckets.set(ip, bucket);
    }

    // Refill tokens based on elapsed time (clamp to 0 for clock drift)
    const elapsedMs = Math.max(0, now - bucket.lastRefillMs);
    bucket.tokens = Math.min(
      this.config.burstCapacity,
      bucket.tokens + elapsedMs * this.refillRatePerMs,
    );
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) {
      // Denied — compute retry-after
      const deficit = 1 - bucket.tokens;
      const retryAfterMs = Math.ceil(deficit / this.refillRatePerMs);
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: 0,
    };
  }

  /**
   * Create Express middleware that rejects with 429 when rate-limited.
   * Only applies to agent endpoints (path prefix check done by caller via mount point).
   */
  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const result = this.check(ip);

      if (!result.allowed) {
        const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
        res.setHeader('Retry-After', String(retryAfterSec));
        res.setHeader('X-RateLimit-Limit', String(this.config.maxPerWindow));
        res.setHeader('X-RateLimit-Remaining', '0');
        this.logger.warn({ ip, path: req.path, retryAfterSec }, 'Pre-auth IP rate limit exceeded');
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: retryAfterSec,
        });
        return;
      }

      res.setHeader('X-RateLimit-Limit', String(this.config.maxPerWindow));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      next();
    };
  }

  /**
   * Stop cleanup timer (for testing/shutdown).
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private evictOldest(): void {
    // Remove ~10% of oldest entries (by insertion order — Map preserves order)
    const evictCount = Math.max(1, Math.floor(this.config.maxEntries * 0.1));
    const iter = this.buckets.keys();
    for (let i = 0; i < evictCount; i++) {
      const key = iter.next().value;
      if (key !== undefined) this.buckets.delete(key);
    }
  }

  private startCleanup(): void {
    // Clean stale buckets every 2 minutes
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const staleThresholdMs = this.config.windowMs * 2;
      for (const [ip, bucket] of this.buckets) {
        if (now - bucket.lastRefillMs > staleThresholdMs) {
          this.buckets.delete(ip);
        }
      }
    }, 120_000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}

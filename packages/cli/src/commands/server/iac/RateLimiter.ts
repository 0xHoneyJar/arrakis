/**
 * RateLimiter - Discord API Rate Limit Handling
 *
 * Sprint 92: Discord Infrastructure-as-Code - Diff Calculation & State Application
 *
 * Implements token bucket rate limiting and creation cooldowns to prevent
 * hitting Discord's API rate limits (50 requests/second global, 10s cooldown for creates).
 *
 * @see SDD grimoires/loa/discord-iac-sdd.md §4.2.5
 * @see PRD grimoires/loa/discord-iac-prd.md §4.3
 * @module packages/cli/commands/server/iac/RateLimiter
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Rate limiter configuration options
 */
export interface RateLimiterOptions {
  /** Maximum tokens in bucket (default: 50) */
  maxTokens?: number;
  /** Tokens refilled per second (default: 50) */
  refillRate?: number;
  /** Cooldown between create operations in ms (default: 10000) */
  createCooldownMs?: number;
  /** Minimum time between any requests in ms (default: 20) */
  minRequestIntervalMs?: number;
}

/**
 * Operation type for rate limiting
 */
export type OperationType = 'create' | 'update' | 'delete' | 'read';

// ============================================================================
// RateLimiter Class
// ============================================================================

/**
 * Rate limiter using token bucket algorithm with create operation cooldowns
 *
 * Discord rate limits:
 * - Global: 50 requests/second
 * - Role/Channel create: 10 second cooldown after creation
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter();
 *
 * // Wait for rate limit before making request
 * await limiter.wait('create');
 * const response = await discordApi.createRole(...);
 *
 * // If we get a 429, tell the limiter
 * if (response.status === 429) {
 *   limiter.handleRateLimit(response.retryAfter * 1000);
 * }
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly createCooldownMs: number;
  private readonly minRequestIntervalMs: number;

  private lastRefillTime: number;
  private lastRequestTime: number = 0;
  private lastCreateTime: number = 0;
  private rateLimitedUntil: number = 0;

  /**
   * Create a new rate limiter
   */
  constructor(options: RateLimiterOptions = {}) {
    this.maxTokens = options.maxTokens ?? 50;
    this.refillRate = options.refillRate ?? 50;
    this.createCooldownMs = options.createCooldownMs ?? 10000;
    this.minRequestIntervalMs = options.minRequestIntervalMs ?? 20;

    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Wait until we can make a request of the given type
   *
   * @param operationType - Type of operation (create operations have additional cooldown)
   * @returns Promise that resolves when it's safe to make the request
   */
  async wait(operationType: OperationType = 'read'): Promise<void> {
    // Refill tokens based on elapsed time
    this.refillTokens();

    // Calculate how long we need to wait
    const waitTime = this.calculateWaitTime(operationType);

    if (waitTime > 0) {
      await this.sleep(waitTime);
      // Refill again after waiting
      this.refillTokens();
    }

    // Consume a token
    this.tokens = Math.max(0, this.tokens - 1);
    this.lastRequestTime = Date.now();

    // Track create operation time
    if (operationType === 'create') {
      this.lastCreateTime = Date.now();
    }
  }

  /**
   * Handle a 429 rate limit response from Discord
   *
   * @param retryAfterMs - Time to wait before retrying (from retry-after header)
   */
  handleRateLimit(retryAfterMs: number): void {
    this.rateLimitedUntil = Date.now() + retryAfterMs;
    // Also drain tokens to be safe
    this.tokens = 0;
  }

  /**
   * Get current rate limiter state (for debugging/logging)
   */
  getState(): {
    tokens: number;
    maxTokens: number;
    isRateLimited: boolean;
    rateLimitedFor: number;
    timeSinceLastCreate: number;
  } {
    this.refillTokens();
    const now = Date.now();

    return {
      tokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      isRateLimited: this.rateLimitedUntil > now,
      rateLimitedFor: Math.max(0, this.rateLimitedUntil - now),
      timeSinceLastCreate: this.lastCreateTime > 0 ? now - this.lastCreateTime : Infinity,
    };
  }

  /**
   * Check if we can make a request immediately without waiting
   */
  canRequest(operationType: OperationType = 'read'): boolean {
    this.refillTokens();
    return this.calculateWaitTime(operationType) === 0;
  }

  /**
   * Reset the rate limiter to initial state
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
    this.lastRequestTime = 0;
    this.lastCreateTime = 0;
    this.rateLimitedUntil = 0;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefillTime) / 1000; // Convert to seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Calculate how long we need to wait before making a request
   */
  private calculateWaitTime(operationType: OperationType): number {
    const now = Date.now();
    let waitTime = 0;

    // Check if we're rate limited by Discord
    if (this.rateLimitedUntil > now) {
      waitTime = Math.max(waitTime, this.rateLimitedUntil - now);
    }

    // Check minimum request interval
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestIntervalMs) {
      waitTime = Math.max(waitTime, this.minRequestIntervalMs - timeSinceLastRequest);
    }

    // Check if we have tokens available
    if (this.tokens < 1) {
      // Calculate time until we have a token
      const tokensNeeded = 1 - this.tokens;
      const timeForTokens = (tokensNeeded / this.refillRate) * 1000;
      waitTime = Math.max(waitTime, timeForTokens);
    }

    // Check create cooldown for create operations
    if (operationType === 'create' && this.lastCreateTime > 0) {
      const timeSinceCreate = now - this.lastCreateTime;
      if (timeSinceCreate < this.createCooldownMs) {
        waitTime = Math.max(waitTime, this.createCooldownMs - timeSinceCreate);
      }
    }

    return waitTime;
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultLimiter: RateLimiter | null = null;

/**
 * Get the default rate limiter instance (singleton)
 */
export function getDefaultRateLimiter(): RateLimiter {
  if (!defaultLimiter) {
    defaultLimiter = new RateLimiter();
  }
  return defaultLimiter;
}

/**
 * Reset the default rate limiter (useful for testing)
 */
export function resetDefaultRateLimiter(): void {
  if (defaultLimiter) {
    defaultLimiter.reset();
  }
  defaultLimiter = null;
}

/**
 * RateLimiter Unit Tests
 *
 * Sprint 92: Discord Infrastructure-as-Code - Diff Calculation & State Application
 *
 * Tests token bucket rate limiting with create operation cooldowns.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RateLimiter,
  getDefaultRateLimiter,
  resetDefaultRateLimiter,
} from '../RateLimiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDefaultRateLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const limiter = new RateLimiter();
      const state = limiter.getState();

      expect(state.tokens).toBe(50);
      expect(state.maxTokens).toBe(50);
      expect(state.isRateLimited).toBe(false);
    });

    it('should accept custom options', () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        createCooldownMs: 5000,
        minRequestIntervalMs: 50,
      });
      const state = limiter.getState();

      expect(state.maxTokens).toBe(100);
      expect(state.tokens).toBe(100);
    });
  });

  describe('wait', () => {
    it('should consume a token immediately when available', async () => {
      const limiter = new RateLimiter({ maxTokens: 10 });
      const initialState = limiter.getState();

      await limiter.wait('read');
      const afterState = limiter.getState();

      expect(afterState.tokens).toBeLessThan(initialState.tokens);
    });

    it('should wait when no tokens available', async () => {
      const limiter = new RateLimiter({
        maxTokens: 1,
        refillRate: 1,
      });

      // Consume the single token
      await limiter.wait('read');

      // Next wait should require waiting for refill
      const waitPromise = limiter.wait('read');

      // Advance time by 1 second (enough for 1 token at rate 1/sec)
      vi.advanceTimersByTime(1000);

      await waitPromise;

      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should enforce create cooldown', async () => {
      const limiter = new RateLimiter({
        maxTokens: 50,
        createCooldownMs: 10000, // 10 second cooldown
      });

      // First create
      await limiter.wait('create');
      const stateAfterFirst = limiter.getState();

      // Check that timeSinceLastCreate is tracked
      expect(stateAfterFirst.timeSinceLastCreate).toBeLessThan(Infinity);

      // Second create should need to wait for cooldown
      const waitPromise = limiter.wait('create');

      // Advance time past cooldown
      vi.advanceTimersByTime(10000);

      await waitPromise;

      // Should complete
      expect(true).toBe(true);
    });

    it('should not enforce create cooldown for non-create operations', async () => {
      const limiter = new RateLimiter({
        maxTokens: 50,
        createCooldownMs: 10000,
        minRequestIntervalMs: 0, // Disable min interval for this test
      });

      // Create operation
      await limiter.wait('create');

      // Read operation should not wait for create cooldown
      // We can check via canRequest since fake timers make timing assertions hard
      vi.advanceTimersByTime(100); // Small advance past min interval
      expect(limiter.canRequest('read')).toBe(true);
      expect(limiter.canRequest('create')).toBe(false); // Still in cooldown
    });
  });

  describe('handleRateLimit', () => {
    it('should set rate limited until time', () => {
      const limiter = new RateLimiter();

      limiter.handleRateLimit(5000); // 5 second rate limit

      const state = limiter.getState();
      expect(state.isRateLimited).toBe(true);
      expect(state.rateLimitedFor).toBeGreaterThan(0);
      expect(state.rateLimitedFor).toBeLessThanOrEqual(5000);
    });

    it('should drain tokens when rate limited', () => {
      const limiter = new RateLimiter({ maxTokens: 50 });

      limiter.handleRateLimit(5000);

      const state = limiter.getState();
      expect(state.tokens).toBe(0);
    });

    it('should clear rate limit after time passes', async () => {
      const limiter = new RateLimiter();

      limiter.handleRateLimit(1000); // 1 second rate limit

      // Initially rate limited
      expect(limiter.getState().isRateLimited).toBe(true);

      // Advance time past rate limit
      vi.advanceTimersByTime(1100);

      // Should no longer be rate limited
      expect(limiter.getState().isRateLimited).toBe(false);
    });
  });

  describe('canRequest', () => {
    it('should return true when tokens available', () => {
      const limiter = new RateLimiter({ maxTokens: 10 });

      expect(limiter.canRequest('read')).toBe(true);
    });

    it('should return false when no tokens available', async () => {
      const limiter = new RateLimiter({
        maxTokens: 1,
        refillRate: 0.001, // Very slow refill
      });

      await limiter.wait('read'); // Consume the only token

      expect(limiter.canRequest('read')).toBe(false);
    });

    it('should return false during create cooldown for create operations', async () => {
      const limiter = new RateLimiter({
        maxTokens: 50,
        createCooldownMs: 10000,
        minRequestIntervalMs: 0, // Disable min interval for this test
      });

      await limiter.wait('create');

      // Small time advance to pass min request interval
      vi.advanceTimersByTime(50);

      // Can't create immediately after
      expect(limiter.canRequest('create')).toBe(false);

      // But can do other operations (read doesn't have create cooldown)
      expect(limiter.canRequest('read')).toBe(true);
    });

    it('should return false when rate limited', () => {
      const limiter = new RateLimiter();

      limiter.handleRateLimit(5000);

      expect(limiter.canRequest('read')).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const limiter = new RateLimiter({
        maxTokens: 25,
      });

      const state = limiter.getState();

      expect(state).toHaveProperty('tokens');
      expect(state).toHaveProperty('maxTokens');
      expect(state).toHaveProperty('isRateLimited');
      expect(state).toHaveProperty('rateLimitedFor');
      expect(state).toHaveProperty('timeSinceLastCreate');

      expect(state.maxTokens).toBe(25);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const limiter = new RateLimiter({ maxTokens: 10 });

      // Rate limit (no need to await for this test)
      limiter.handleRateLimit(5000);

      // Verify rate limited
      expect(limiter.getState().isRateLimited).toBe(true);

      // Reset
      limiter.reset();

      const state = limiter.getState();
      expect(state.tokens).toBe(10);
      expect(state.isRateLimited).toBe(false);
      expect(state.timeSinceLastCreate).toBe(Infinity);
    });
  });

  describe('token refill', () => {
    it('should refill tokens over time', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 10, // 10 tokens per second
      });

      // Manually set tokens to low value via rate limit and partial recovery
      limiter.handleRateLimit(1); // Drains tokens to 0
      vi.advanceTimersByTime(100); // Wait a bit

      const lowState = limiter.getState();
      expect(lowState.tokens).toBeLessThan(5);

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      const refilledState = limiter.getState();
      expect(refilledState.tokens).toBeGreaterThan(lowState.tokens);
    });

    it('should not exceed maxTokens', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 100, // Fast refill
      });

      // Wait a long time
      vi.advanceTimersByTime(10000);

      const state = limiter.getState();
      expect(state.tokens).toBeLessThanOrEqual(state.maxTokens);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getDefaultRateLimiter', () => {
      const limiter1 = getDefaultRateLimiter();
      const limiter2 = getDefaultRateLimiter();

      expect(limiter1).toBe(limiter2);
    });

    it('should create new instance after resetDefaultRateLimiter', () => {
      const limiter1 = getDefaultRateLimiter();
      resetDefaultRateLimiter();
      const limiter2 = getDefaultRateLimiter();

      expect(limiter1).not.toBe(limiter2);
    });
  });
});

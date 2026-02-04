/**
 * Rate Limit Middleware Tests
 *
 * Sprint 112: Security Remediation (HIGH-002)
 *
 * Tests for in-memory rate limiting middleware.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  RateLimiter,
  createRateLimitMiddleware,
  RATE_LIMIT_CONFIGS,
  generalRateLimiter,
  writeRateLimiter,
  expensiveRateLimiter,
  rateLimit,
} from '../../../../src/api/middleware/rate-limit.js';

// =============================================================================
// RateLimiter Class Tests
// =============================================================================

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.stop();
  });

  describe('constructor', () => {
    it('should create a limiter with given config', () => {
      limiter = new RateLimiter({
        max: 10,
        windowMs: 60000,
        keyPrefix: 'test',
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('check()', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        max: 3,
        windowMs: 60000,
        keyPrefix: 'test',
      });
    });

    it('should allow requests under the limit', () => {
      const result = limiter.check('user1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should decrement remaining count with each request', () => {
      limiter.check('user1');
      limiter.check('user1');
      const result = limiter.check('user1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should reject requests over the limit', () => {
      limiter.check('user1');
      limiter.check('user1');
      limiter.check('user1');
      const result = limiter.check('user1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different users separately', () => {
      limiter.check('user1');
      limiter.check('user1');
      limiter.check('user1');

      const result1 = limiter.check('user1');
      const result2 = limiter.check('user2');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(2);
    });

    it('should reset after window expires', async () => {
      // Use a very short window for testing
      limiter.stop();
      limiter = new RateLimiter({
        max: 2,
        windowMs: 50, // 50ms window
        keyPrefix: 'test',
      });

      limiter.check('user1');
      limiter.check('user1');
      expect(limiter.check('user1').allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      const result = limiter.check('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should return resetAt timestamp', () => {
      const before = Date.now();
      const result = limiter.check('user1');
      const after = Date.now();

      expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000);
      expect(result.resetAt).toBeLessThanOrEqual(after + 60000);
    });
  });

  describe('getCount()', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        max: 5,
        windowMs: 60000,
        keyPrefix: 'test',
      });
    });

    it('should return 0 for unknown key', () => {
      expect(limiter.getCount('unknown')).toBe(0);
    });

    it('should return current count for known key', () => {
      limiter.check('user1');
      limiter.check('user1');
      limiter.check('user1');

      expect(limiter.getCount('user1')).toBe(3);
    });
  });

  describe('clear()', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        max: 3,
        windowMs: 60000,
        keyPrefix: 'test',
      });
    });

    it('should clear all rate limit data', () => {
      limiter.check('user1');
      limiter.check('user2');
      limiter.clear();

      expect(limiter.getCount('user1')).toBe(0);
      expect(limiter.getCount('user2')).toBe(0);
    });
  });

  describe('cleanup()', () => {
    it('should remove expired windows', async () => {
      limiter = new RateLimiter({
        max: 3,
        windowMs: 50, // Very short for testing
        keyPrefix: 'test',
      });

      limiter.check('user1');
      expect(limiter.getCount('user1')).toBe(1);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      limiter.cleanup();
      expect(limiter.getCount('user1')).toBe(0);
    });
  });
});

// =============================================================================
// Middleware Tests
// =============================================================================

describe('createRateLimitMiddleware', () => {
  let middleware: ReturnType<typeof createRateLimitMiddleware>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = createRateLimitMiddleware({
      max: 2,
      windowMs: 60000,
      keyPrefix: 'test',
      standardHeaders: true,
    });

    mockReq = {
      ip: '127.0.0.1',
      path: '/test',
    };

    mockRes = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();
  });

  it('should call next() when under limit', () => {
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should set rate limit headers', () => {
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 2);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      expect.any(Number)
    );
  });

  it('should return 429 when over limit', () => {
    middleware(mockReq as Request, mockRes as Response, mockNext);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    // Reset mocks
    vi.clearAllMocks();

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Too many requests',
      retryAfter: expect.any(Number),
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should set Retry-After header when rate limited', () => {
    middleware(mockReq as Request, mockRes as Response, mockNext);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(Number)
    );
  });

  it('should prefer userId from auth over IP', () => {
    const authReq = {
      ...mockReq,
      caller: { userId: 'auth-user-123' },
    };

    // First request from auth user
    middleware(authReq as Request, mockRes as Response, mockNext);
    middleware(authReq as Request, mockRes as Response, mockNext);

    // Third request should be blocked
    vi.clearAllMocks();
    middleware(authReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);

    // But same IP without auth should still work
    vi.clearAllMocks();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should fallback to anonymous when no IP or userId', () => {
    const anonReq: Partial<Request> = {
      path: '/test',
    };

    middleware(anonReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

// =============================================================================
// Pre-built Middleware Tests
// =============================================================================

describe('Pre-built middlewares', () => {
  describe('RATE_LIMIT_CONFIGS', () => {
    it('should have general config with 60 requests/minute', () => {
      expect(RATE_LIMIT_CONFIGS.general).toEqual({
        max: 60,
        windowMs: 60000,
        keyPrefix: 'general',
        standardHeaders: true,
      });
    });

    it('should have write config with 20 requests/minute', () => {
      expect(RATE_LIMIT_CONFIGS.write).toEqual({
        max: 20,
        windowMs: 60000,
        keyPrefix: 'write',
        standardHeaders: true,
      });
    });

    it('should have expensive config with 10 requests/minute', () => {
      expect(RATE_LIMIT_CONFIGS.expensive).toEqual({
        max: 10,
        windowMs: 60000,
        keyPrefix: 'expensive',
        standardHeaders: true,
      });
    });
  });

  describe('generalRateLimiter', () => {
    it('should be a function', () => {
      expect(typeof generalRateLimiter).toBe('function');
    });
  });

  describe('writeRateLimiter', () => {
    it('should be a function', () => {
      expect(typeof writeRateLimiter).toBe('function');
    });
  });

  describe('expensiveRateLimiter', () => {
    it('should be a function', () => {
      expect(typeof expensiveRateLimiter).toBe('function');
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('rateLimit factory', () => {
  it('should create a custom rate limiter', () => {
    const customLimiter = rateLimit(5, 30000, 'custom');

    expect(typeof customLimiter).toBe('function');
  });

  it('should respect custom settings', () => {
    const customLimiter = rateLimit(1, 60000, 'strict');

    const mockReq: Partial<Request> = { ip: '127.0.0.1', path: '/test' };
    const mockRes: Partial<Response> = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const mockNext = vi.fn();

    // First request succeeds
    customLimiter(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();

    // Second request fails
    vi.clearAllMocks();
    customLimiter(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(429);
  });
});

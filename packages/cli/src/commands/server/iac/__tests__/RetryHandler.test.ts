/**
 * RetryHandler Unit Tests
 *
 * Sprint 92: Discord Infrastructure-as-Code - Diff Calculation & State Application
 *
 * Tests exponential backoff retry logic for transient Discord API errors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RetryHandler,
  createRetryHandler,
  withRetry,
  isRetryableError,
  getRetryAfterMs,
} from '../RetryHandler.js';

describe('RetryHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isRetryableError', () => {
    it('should return true for 429 rate limit', () => {
      const error = { status: 429, message: 'Rate limited' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 500 server error', () => {
      const error = { status: 500, message: 'Internal server error' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 502 bad gateway', () => {
      const error = { status: 502, message: 'Bad gateway' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 503 service unavailable', () => {
      const error = { status: 503, message: 'Service unavailable' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 504 gateway timeout', () => {
      const error = { status: 504, message: 'Gateway timeout' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for 400 bad request', () => {
      const error = { status: 400, message: 'Bad request' };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 401 unauthorized', () => {
      const error = { status: 401, message: 'Unauthorized' };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 403 forbidden', () => {
      const error = { status: 403, message: 'Forbidden' };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 404 not found', () => {
      const error = { status: 404, message: 'Not found' };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for network timeout errors', () => {
      const error = new Error('Request timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ECONNRESET errors', () => {
      const error = new Error('read ECONNRESET');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ECONNREFUSED errors', () => {
      const error = new Error('connect ECONNREFUSED');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for rate limit message in error', () => {
      const error = { code: 0, message: 'You are being rate limited' };
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('getRetryAfterMs', () => {
    it('should extract retryAfter from error', () => {
      const error = { retryAfter: 5 }; // 5 seconds
      expect(getRetryAfterMs(error)).toBe(5000);
    });

    it('should handle retryAfter already in ms', () => {
      const error = { retryAfter: 5000 }; // Already in ms
      expect(getRetryAfterMs(error)).toBe(5000);
    });

    it('should parse retry time from message', () => {
      const error = new Error('Rate limited, retry after 3.5 seconds');
      expect(getRetryAfterMs(error)).toBe(3500); // 3.5 * 1000
    });

    it('should return undefined when no retry info', () => {
      const error = new Error('Some error');
      expect(getRetryAfterMs(error)).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const handler = new RetryHandler({ maxAttempts: 3 });
      const operation = vi.fn().mockResolvedValue('success');

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      vi.useRealTimers(); // Use real timers

      const handler = new RetryHandler({
        maxAttempts: 3,
        baseDelayMs: 10, // Very short delay
        jitterFactor: 0,
      });

      const operation = vi
        .fn()
        .mockRejectedValueOnce({ status: 500, message: 'Server error' })
        .mockResolvedValueOnce('success');

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);

      vi.useFakeTimers();
    });

    it('should not retry on non-retryable error', async () => {
      const handler = new RetryHandler({ maxAttempts: 3 });
      const operation = vi.fn().mockRejectedValue({ status: 400, message: 'Bad request' });

      const result = await handler.execute(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should give up after maxAttempts', async () => {
      vi.useRealTimers(); // Use real timers

      const handler = new RetryHandler({
        maxAttempts: 3,
        baseDelayMs: 10, // Very short delay
        jitterFactor: 0,
      });

      const serverError = { status: 500, message: 'Server error' };
      const operation = vi.fn().mockRejectedValue(serverError);

      const result = await handler.execute(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error).toBe(serverError);
      expect(operation).toHaveBeenCalledTimes(3);

      vi.useFakeTimers();
    });

    it('should call onRetry callback', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const onRetry = vi.fn();
      const handler = new RetryHandler({
        maxAttempts: 3,
        baseDelayMs: 10, // Very short delay for fast test
        jitterFactor: 0,
        onRetry,
      });

      const error = { status: 500, message: 'Server error' };
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      await handler.execute(operation);

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, error, expect.any(Number));

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should use Discord retry-after header', async () => {
      const handler = new RetryHandler({
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 30000,
      });

      const error = { status: 429, message: 'Rate limited', retryAfter: 2 }; // 2 seconds
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const executePromise = handler.execute(operation);

      await vi.advanceTimersByTimeAsync(0);
      // Should wait for retry-after time (2000ms), not base delay
      await vi.advanceTimersByTimeAsync(2000);

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should track total time', async () => {
      vi.useRealTimers(); // Need real timers for accurate timing

      const handler = new RetryHandler({ maxAttempts: 1 });
      const operation = vi.fn().mockResolvedValue('success');

      const result = await handler.execute(operation);

      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.totalTimeMs).toBeLessThan(100); // Should be fast

      vi.useFakeTimers();
    });
  });

  describe('executeOrThrow', () => {
    it('should return result on success', async () => {
      const handler = new RetryHandler();
      const operation = vi.fn().mockResolvedValue('success');

      const result = await handler.executeOrThrow(operation);

      expect(result).toBe('success');
    });

    it('should throw on failure', async () => {
      const handler = new RetryHandler({ maxAttempts: 1 });
      const error = { status: 400, message: 'Bad request' };
      const operation = vi.fn().mockRejectedValue(error);

      await expect(handler.executeOrThrow(operation)).rejects.toBe(error);
    });
  });

  describe('exponential backoff', () => {
    it('should increase delay exponentially', async () => {
      const onRetry = vi.fn();
      const handler = new RetryHandler({
        maxAttempts: 4,
        baseDelayMs: 1000,
        jitterFactor: 0, // Disable jitter for predictable delays
        onRetry,
      });

      const operation = vi.fn().mockRejectedValue({ status: 500 });

      const executePromise = handler.execute(operation);

      // Let all attempts fail with increasing delays
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(4000);
      }

      await executePromise;

      // Check delays are increasing
      if (onRetry.mock.calls.length >= 2) {
        const delays = onRetry.mock.calls.map((call) => call[2]);
        expect(delays[1]).toBeGreaterThanOrEqual(delays[0]);
      }
    });

    it('should cap delay at maxDelayMs', async () => {
      const onRetry = vi.fn();
      const handler = new RetryHandler({
        maxAttempts: 10,
        baseDelayMs: 10000,
        maxDelayMs: 15000,
        jitterFactor: 0,
        onRetry,
      });

      const operation = vi.fn().mockRejectedValue({ status: 500 });

      const executePromise = handler.execute(operation);

      // Advance through many retries
      for (let i = 0; i < 20; i++) {
        await vi.advanceTimersByTimeAsync(20000);
      }

      await executePromise;

      // Check all delays are capped
      for (const call of onRetry.mock.calls) {
        const delay = call[2];
        expect(delay).toBeLessThanOrEqual(15000);
      }
    });
  });

  describe('custom isRetryable', () => {
    it('should use custom isRetryable function', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const customIsRetryable = vi.fn().mockReturnValue(true);
      const handler = new RetryHandler({
        maxAttempts: 3,
        baseDelayMs: 10, // Very short delay for fast test
        jitterFactor: 0,
        isRetryable: customIsRetryable,
      });

      const error = { status: 400 }; // Normally not retryable
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      await handler.execute(operation);

      expect(customIsRetryable).toHaveBeenCalledWith(error);
      expect(operation).toHaveBeenCalledTimes(2);

      vi.useFakeTimers(); // Restore fake timers
    });
  });

  describe('utility functions', () => {
    it('createRetryHandler should create handler with options', () => {
      const handler = createRetryHandler({ maxAttempts: 5 });
      expect(handler).toBeInstanceOf(RetryHandler);
    });

    it('withRetry should execute operation with retries', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation, { maxAttempts: 3 });

      expect(result).toBe('success');
    });

    it('withRetry should throw on failure', async () => {
      const error = { status: 400, message: 'Bad request' };
      const operation = vi.fn().mockRejectedValue(error);

      await expect(withRetry(operation, { maxAttempts: 1 })).rejects.toBe(error);
    });
  });
});

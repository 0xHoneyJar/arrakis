/**
 * Error Sanitizer Tests
 *
 * Sprint 113: Security Remediation (HIGH-004)
 *
 * Tests for error sanitization utility.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateErrorRef,
  sanitizeError,
  sanitizeAndLogError,
  sanitizeValidationErrors,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  rateLimitedError,
} from '../../../../src/api/utils/error-sanitizer.js';
import { SimulationErrorCode } from '../../../../src/services/sandbox/index.js';

// =============================================================================
// generateErrorRef Tests
// =============================================================================

describe('generateErrorRef', () => {
  it('should generate a string starting with ERR-', () => {
    const ref = generateErrorRef();
    expect(ref).toMatch(/^ERR-/);
  });

  it('should include timestamp', () => {
    const before = Math.floor(Date.now() / 1000);
    const ref = generateErrorRef();
    const after = Math.floor(Date.now() / 1000);

    const parts = ref.split('-');
    const timestamp = parseInt(parts[1], 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should include random suffix', () => {
    const ref = generateErrorRef();
    const parts = ref.split('-');

    expect(parts[2]).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should generate unique references', () => {
    const refs = new Set<string>();
    for (let i = 0; i < 100; i++) {
      refs.add(generateErrorRef());
    }
    expect(refs.size).toBe(100);
  });
});

// =============================================================================
// sanitizeError Tests
// =============================================================================

describe('sanitizeError', () => {
  // Store original NODE_ENV
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('basic error handling', () => {
    it('should handle Error instances', () => {
      const error = new Error('Something went wrong');
      const { response, logEntry } = sanitizeError(error);

      expect(response.error).toBeDefined();
      expect(response.errorRef).toMatch(/^ERR-/);
      expect(response.status).toBe(500);
      expect(logEntry.message).toBe('Something went wrong');
      expect(logEntry.stack).toBeDefined();
    });

    it('should handle string errors', () => {
      const { response, logEntry } = sanitizeError('String error message');

      expect(response.error).toBeDefined();
      expect(logEntry.message).toBe('String error message');
    });

    it('should handle error-like objects', () => {
      const errorLike = { message: 'Error message', status: 404 };
      const { response, logEntry } = sanitizeError(errorLike);

      expect(response.status).toBe(404);
      expect(logEntry.message).toBe('Error message');
    });

    it('should handle unknown error types', () => {
      const { response, logEntry } = sanitizeError(null);

      expect(response.error).toBeDefined();
      expect(logEntry.message).toBe('Unknown error');
    });
  });

  describe('simulation error code mapping', () => {
    it('should map NOT_FOUND to 404', () => {
      const error = {
        code: SimulationErrorCode.NOT_FOUND,
        message: 'Context not found',
      };
      const { response } = sanitizeError(error);

      expect(response.status).toBe(404);
      expect(response.error).toBe('The requested resource was not found.');
    });

    it('should map VALIDATION_ERROR to 400', () => {
      const error = {
        code: SimulationErrorCode.VALIDATION_ERROR,
        message: 'Invalid tier ID',
      };
      const { response } = sanitizeError(error);

      expect(response.status).toBe(400);
      expect(response.error).toBe('The request contains invalid data.');
    });

    it('should map VERSION_CONFLICT to 409', () => {
      const error = {
        code: SimulationErrorCode.VERSION_CONFLICT,
        message: 'Version mismatch',
      };
      const { response } = sanitizeError(error);

      expect(response.status).toBe(409);
      expect(response.error).toContain('modified by another request');
    });

    it('should map STORAGE_ERROR to 500', () => {
      const error = {
        code: SimulationErrorCode.STORAGE_ERROR,
        message: 'Redis connection failed',
      };
      const { response } = sanitizeError(error);

      expect(response.status).toBe(500);
      expect(response.error).toContain('temporary error');
    });

    it('should map SANDBOX_INACTIVE to 403', () => {
      const error = {
        code: SimulationErrorCode.SANDBOX_INACTIVE,
        message: 'Sandbox expired',
      };
      const { response } = sanitizeError(error);

      expect(response.status).toBe(403);
      expect(response.error).toContain('not currently active');
    });
  });

  describe('production vs development mode', () => {
    it('should not include details in production', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive internal error');
      const { response } = sanitizeError(error);

      expect(response.details).toBeUndefined();
      expect(response.error).not.toContain('Sensitive');
    });

    it('should include details in development', () => {
      process.env.NODE_ENV = 'development';

      const error = new Error('Sensitive internal error');
      const { response } = sanitizeError(error);

      expect(response.details).toBeDefined();
      expect((response.details as { originalMessage: string }).originalMessage).toBe('Sensitive internal error');
    });

    it('should include details in test mode', () => {
      process.env.NODE_ENV = 'test';

      const error = new Error('Test error');
      const { response } = sanitizeError(error);

      expect(response.details).toBeDefined();
    });
  });

  describe('context handling', () => {
    it('should include request context in log entry', () => {
      const error = new Error('Error');
      const { logEntry } = sanitizeError(error, {
        path: '/api/test',
        method: 'POST',
        userId: 'user-123',
      });

      expect(logEntry.path).toBe('/api/test');
      expect(logEntry.method).toBe('POST');
      expect(logEntry.userId).toBe('user-123');
    });

    it('should include errorRef in both response and log', () => {
      const error = new Error('Error');
      const { response, logEntry } = sanitizeError(error);

      expect(response.errorRef).toBe(logEntry.errorRef);
    });
  });

  describe('sensitive information filtering', () => {
    it('should not expose stack traces in production response', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Error');
      error.stack = 'Error: Error\n    at test.js:123\n    at internal.js:456';

      const { response } = sanitizeError(error);

      expect(JSON.stringify(response)).not.toContain('test.js');
      expect(JSON.stringify(response)).not.toContain('internal.js');
    });

    it('should not expose internal Redis errors', () => {
      process.env.NODE_ENV = 'production';

      const error = {
        code: SimulationErrorCode.STORAGE_ERROR,
        message: 'ECONNREFUSED 127.0.0.1:6379',
      };

      const { response } = sanitizeError(error);

      expect(response.error).not.toContain('ECONNREFUSED');
      expect(response.error).not.toContain('127.0.0.1');
      expect(response.error).not.toContain('6379');
    });
  });
});

// =============================================================================
// sanitizeAndLogError Tests
// =============================================================================

describe('sanitizeAndLogError', () => {
  it('should return sanitized response', () => {
    const error = new Error('Test error');
    const response = sanitizeAndLogError(error);

    expect(response.error).toBeDefined();
    expect(response.errorRef).toMatch(/^ERR-/);
  });

  it('should include context in log', () => {
    const error = new Error('Test error');
    const response = sanitizeAndLogError(error, {
      path: '/test',
      userId: 'user-123',
    });

    expect(response.errorRef).toMatch(/^ERR-/);
  });
});

// =============================================================================
// sanitizeValidationErrors Tests
// =============================================================================

describe('sanitizeValidationErrors', () => {
  it('should convert path array to dot notation', () => {
    const issues = [
      { path: ['body', 'user', 'email'], message: 'Invalid email', code: 'invalid_string' },
    ];

    const result = sanitizeValidationErrors(issues);

    expect(result[0].field).toBe('body.user.email');
  });

  it('should map too_small to generic message', () => {
    const issues = [
      { path: ['password'], message: 'String must contain at least 8 character(s)', code: 'too_small' },
    ];

    const result = sanitizeValidationErrors(issues);

    expect(result[0].message).toBe('Value is too short or too small');
    expect(result[0].message).not.toContain('8 character');
  });

  it('should map too_big to generic message', () => {
    const issues = [
      { path: ['name'], message: 'String must contain at most 100 character(s)', code: 'too_big' },
    ];

    const result = sanitizeValidationErrors(issues);

    expect(result[0].message).toBe('Value is too long or too large');
  });

  it('should map invalid_type to generic message', () => {
    const issues = [
      { path: ['count'], message: 'Expected number, received string', code: 'invalid_type' },
    ];

    const result = sanitizeValidationErrors(issues);

    expect(result[0].message).toBe('Invalid type provided');
  });

  it('should map invalid_enum_value to generic message', () => {
    const issues = [
      { path: ['status'], message: "Invalid enum value. Expected 'active' | 'inactive', received 'pending'", code: 'invalid_enum_value' },
    ];

    const result = sanitizeValidationErrors(issues);

    expect(result[0].message).toBe('Value is not one of the allowed options');
    expect(result[0].message).not.toContain('active');
    expect(result[0].message).not.toContain('pending');
  });

  it('should not leak regex patterns for invalid_string', () => {
    const issues = [
      { path: ['id'], message: "Invalid string: does not match pattern /^[a-z0-9-]+$/", code: 'invalid_string' },
    ];

    const result = sanitizeValidationErrors(issues);

    expect(result[0].message).toBe('Invalid format');
    expect(result[0].message).not.toContain('pattern');
    expect(result[0].message).not.toContain('[a-z0-9-]');
  });

  it('should handle multiple issues', () => {
    const issues = [
      { path: ['email'], message: 'Invalid email', code: 'invalid_string' },
      { path: ['password'], message: 'Too short', code: 'too_small' },
      { path: ['age'], message: 'Expected number', code: 'invalid_type' },
    ];

    const result = sanitizeValidationErrors(issues);

    expect(result).toHaveLength(3);
    expect(result[0].field).toBe('email');
    expect(result[1].field).toBe('password');
    expect(result[2].field).toBe('age');
  });
});

// =============================================================================
// HTTP Error Helper Tests
// =============================================================================

describe('HTTP Error Helpers', () => {
  describe('unauthorizedError', () => {
    it('should return 401 status', () => {
      const response = unauthorizedError();
      expect(response.status).toBe(401);
    });

    it('should have authentication message', () => {
      const response = unauthorizedError();
      expect(response.error).toContain('Authentication');
    });

    it('should include error reference', () => {
      const response = unauthorizedError();
      expect(response.errorRef).toMatch(/^ERR-/);
    });
  });

  describe('forbiddenError', () => {
    it('should return 403 status', () => {
      const response = forbiddenError();
      expect(response.status).toBe(403);
    });

    it('should have permission message', () => {
      const response = forbiddenError();
      expect(response.error).toContain('permission');
    });
  });

  describe('notFoundError', () => {
    it('should return 404 status', () => {
      const response = notFoundError();
      expect(response.status).toBe(404);
    });

    it('should have not found message', () => {
      const response = notFoundError();
      expect(response.error).toContain('not found');
    });
  });

  describe('rateLimitedError', () => {
    it('should return 429 status', () => {
      const response = rateLimitedError(60);
      expect(response.status).toBe(429);
    });

    it('should include retry after in message', () => {
      const response = rateLimitedError(30);
      expect(response.error).toContain('30 seconds');
    });

    it('should have rate limit message', () => {
      const response = rateLimitedError(60);
      expect(response.error).toContain('Too many requests');
    });
  });
});

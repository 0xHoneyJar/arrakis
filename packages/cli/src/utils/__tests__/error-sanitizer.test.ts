/**
 * Error Sanitizer Tests
 *
 * Sprint 149: Critical CLI Security Fixes (H-2)
 *
 * Tests for error message sanitization to prevent sensitive data exposure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeError,
  redactSensitiveData,
  formatErrorForConsole,
  ErrorCodes,
} from '../error-sanitizer.js';

describe('error-sanitizer', () => {
  describe('redactSensitiveData', () => {
    it('should redact Bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';
      const redacted = redactSensitiveData(text);

      expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(redacted).toContain('[REDACTED]');
    });

    it('should redact API keys', () => {
      const text = 'api_key: sk_live_1234567890abcdef';
      const redacted = redactSensitiveData(text);

      expect(redacted).not.toContain('sk_live_1234567890abcdef');
      expect(redacted).toContain('[REDACTED]');
    });

    it('should redact API keys with different formats', () => {
      expect(redactSensitiveData('apikey: abc123def456')).toContain('[REDACTED]');
      expect(redactSensitiveData('api-key: abc123def456')).toContain('[REDACTED]');
    });

    it('should redact passwords in URLs', () => {
      const text = 'Connecting to https://user:secret_password@api.example.com';
      const redacted = redactSensitiveData(text);

      expect(redacted).not.toContain('secret_password');
    });

    it('should redact JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const text = `Token: ${jwt}`;
      const redacted = redactSensitiveData(text);

      expect(redacted).not.toContain(jwt);
      expect(redacted).toContain('[REDACTED]');
    });

    it('should redact session tokens', () => {
      const text = 'session_token: abcd1234efgh5678ijkl9012';
      const redacted = redactSensitiveData(text);

      expect(redacted).toContain('[REDACTED]');
    });

    it('should redact secret keys', () => {
      const text = 'secret_key: my_super_secret_value_12345';
      const redacted = redactSensitiveData(text);

      expect(redacted).toContain('[REDACTED]');
    });

    it('should preserve non-sensitive text', () => {
      const text = 'Connection failed to https://api.example.com';
      const redacted = redactSensitiveData(text);

      expect(redacted).toBe(text);
    });

    it('should handle multiple sensitive patterns', () => {
      const text = 'Bearer abc123 and api_key: xyz789';
      const redacted = redactSensitiveData(text);

      expect(redacted).not.toContain('abc123');
      expect(redacted).not.toContain('xyz789');
    });
  });

  describe('sanitizeError', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    describe('network errors', () => {
      it('should sanitize fetch failed errors', () => {
        const error = new TypeError('fetch failed');
        const sanitized = sanitizeError(error);

        expect(sanitized.code).toBe(ErrorCodes.NETWORK_ERROR);
        expect(sanitized.message).toContain('Failed to connect to server');
      });
    });

    describe('HTTP errors', () => {
      it('should sanitize 401 errors', () => {
        const error = new Error('Request failed with status 401');
        const sanitized = sanitizeError(error);

        expect(sanitized.code).toBe(ErrorCodes.AUTH_FAILED);
        expect(sanitized.message).toContain('Authentication failed');
      });

      it('should sanitize 403 errors', () => {
        const error = new Error('HTTP status: 403 Forbidden');
        const sanitized = sanitizeError(error);

        expect(sanitized.code).toBe(ErrorCodes.AUTH_FAILED);
        expect(sanitized.message).toContain('Authentication failed');
      });

      it('should sanitize 500 errors', () => {
        const error = new Error('HTTP status 500');
        const sanitized = sanitizeError(error);

        expect(sanitized.code).toBe(ErrorCodes.SERVER_ERROR);
        expect(sanitized.message).toContain('Server error');
      });

      it('should sanitize 400 errors', () => {
        const error = new Error('HTTP status 400 Bad Request');
        const sanitized = sanitizeError(error);

        expect(sanitized.code).toBe(ErrorCodes.INVALID_INPUT);
        expect(sanitized.message).toContain('Invalid request');
      });
    });

    describe('production mode', () => {
      it('should not include original error in production', () => {
        process.env.NODE_ENV = 'production';

        const error = new Error('Sensitive internal error with token: Bearer abc123');
        const sanitized = sanitizeError(error);

        expect(sanitized.originalError).toBeUndefined();
        expect(sanitized.message).not.toContain('Bearer');
        expect(sanitized.message).not.toContain('abc123');
      });

      it('should return generic message for unknown errors', () => {
        process.env.NODE_ENV = 'production';

        const error = new Error('Some detailed internal error');
        const sanitized = sanitizeError(error);

        expect(sanitized.message).toBe('An unexpected error occurred.');
        expect(sanitized.code).toBe(ErrorCodes.UNKNOWN_ERROR);
      });
    });

    describe('development mode', () => {
      it('should include original error in development', () => {
        process.env.NODE_ENV = 'development';

        const error = new Error('Debug error');
        const sanitized = sanitizeError(error);

        expect(sanitized.originalError).toBeDefined();
      });

      it('should redact sensitive data even in development', () => {
        process.env.NODE_ENV = 'development';

        const error = new Error('Error with Bearer token123abc');
        const sanitized = sanitizeError(error);

        expect(sanitized.message).toContain('[REDACTED]');
      });

      it('should include context in development', () => {
        process.env.NODE_ENV = 'development';

        const error = new Error('Some error');
        const sanitized = sanitizeError(error, 'Login');

        expect(sanitized.message).toContain('Login:');
      });
    });

    describe('validation errors', () => {
      it('should preserve validation error messages', () => {
        const error = new Error('Invalid email format');
        error.name = 'ValidationError';
        const sanitized = sanitizeError(error);

        expect(sanitized.code).toBe(ErrorCodes.VALIDATION_ERROR);
        expect(sanitized.message).toBe('Invalid email format');
      });
    });
  });

  describe('formatErrorForConsole', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should output JSON when json option is true', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      formatErrorForConsole(
        { message: 'Test error', code: ErrorCodes.NETWORK_ERROR },
        { json: true }
      );

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Test error');
      expect(parsed.code).toBe(ErrorCodes.NETWORK_ERROR);

      logSpy.mockRestore();
    });

    it('should output colored text when json option is false', () => {
      formatErrorForConsole(
        { message: 'Test error', code: ErrorCodes.NETWORK_ERROR },
        { json: false }
      );

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should hide error code when showCode is false', () => {
      formatErrorForConsole(
        { message: 'Test error', code: ErrorCodes.NETWORK_ERROR },
        { showCode: false }
      );

      // Should only call once for the error message, not twice for code
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });
  });
});

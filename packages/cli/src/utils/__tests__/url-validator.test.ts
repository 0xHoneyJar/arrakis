/**
 * URL Validator Tests
 *
 * Sprint 149: Critical CLI Security Fixes (H-1)
 *
 * Tests for HTTPS enforcement on API server URLs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateServerUrl,
  getValidatedServerUrl,
  isSecureUrl,
  isLocalhostHostname,
  ServerUrlError,
} from '../url-validator.js';

describe('url-validator', () => {
  describe('isLocalhostHostname', () => {
    it('should return true for localhost', () => {
      expect(isLocalhostHostname('localhost')).toBe(true);
    });

    it('should return true for 127.0.0.1', () => {
      expect(isLocalhostHostname('127.0.0.1')).toBe(true);
    });

    it('should return true for ::1', () => {
      expect(isLocalhostHostname('::1')).toBe(true);
    });

    it('should return false for other hostnames', () => {
      expect(isLocalhostHostname('api.example.com')).toBe(false);
      expect(isLocalhostHostname('production.api.io')).toBe(false);
    });
  });

  describe('validateServerUrl', () => {
    describe('HTTPS URLs', () => {
      it('should accept HTTPS URLs', () => {
        expect(() => validateServerUrl('https://api.example.com')).not.toThrow();
      });

      it('should accept HTTPS with port', () => {
        expect(() => validateServerUrl('https://api.example.com:8443')).not.toThrow();
      });

      it('should accept HTTPS localhost', () => {
        expect(() => validateServerUrl('https://localhost:3000')).not.toThrow();
      });
    });

    describe('HTTP localhost', () => {
      it('should accept HTTP localhost by default', () => {
        expect(() => validateServerUrl('http://localhost:3000')).not.toThrow();
      });

      it('should accept HTTP 127.0.0.1', () => {
        expect(() => validateServerUrl('http://127.0.0.1:3000')).not.toThrow();
      });

      it('should accept HTTP [::1]', () => {
        expect(() => validateServerUrl('http://[::1]:3000')).not.toThrow();
      });

      it('should reject HTTP localhost when allowLocalhostHttp is false', () => {
        expect(() =>
          validateServerUrl('http://localhost:3000', { allowLocalhostHttp: false })
        ).toThrow(ServerUrlError);
      });
    });

    describe('HTTP non-localhost', () => {
      it('should reject HTTP production URLs', () => {
        expect(() => validateServerUrl('http://api.example.com')).toThrow(ServerUrlError);
      });

      it('should reject HTTP with error message about HTTPS', () => {
        expect(() => validateServerUrl('http://api.example.com')).toThrow(
          /Production API servers must use HTTPS/
        );
      });

      it('should warn instead of error when warnOnly is true', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(() =>
          validateServerUrl('http://api.example.com', { warnOnly: true })
        ).not.toThrow();

        expect(consoleSpy).toHaveBeenCalled();
        const warningMessage = consoleSpy.mock.calls[0][0];
        expect(warningMessage).toContain('Insecure HTTP connection');

        consoleSpy.mockRestore();
      });
    });

    describe('Invalid URLs', () => {
      it('should reject invalid URL format', () => {
        expect(() => validateServerUrl('not-a-url')).toThrow(ServerUrlError);
        expect(() => validateServerUrl('not-a-url')).toThrow(/Invalid server URL/);
      });

      it('should reject non-HTTP/HTTPS protocols', () => {
        expect(() => validateServerUrl('ftp://api.example.com')).toThrow(ServerUrlError);
        expect(() => validateServerUrl('ws://api.example.com')).toThrow(ServerUrlError);
      });

      it('should include the protocol in error message', () => {
        expect(() => validateServerUrl('ftp://api.example.com')).toThrow(/ftp:/);
      });
    });
  });

  describe('getValidatedServerUrl', () => {
    it('should return env URL when provided', () => {
      expect(getValidatedServerUrl('https://api.example.com', 'http://localhost:3000')).toBe(
        'https://api.example.com'
      );
    });

    it('should return default URL when env is undefined', () => {
      expect(getValidatedServerUrl(undefined, 'http://localhost:3000')).toBe(
        'http://localhost:3000'
      );
    });

    it('should validate the returned URL', () => {
      expect(() =>
        getValidatedServerUrl('http://production.api.com', 'http://localhost:3000')
      ).toThrow(ServerUrlError);
    });
  });

  describe('isSecureUrl', () => {
    it('should return true for HTTPS URLs', () => {
      expect(isSecureUrl('https://api.example.com')).toBe(true);
    });

    it('should return true for HTTP localhost', () => {
      expect(isSecureUrl('http://localhost:3000')).toBe(true);
      expect(isSecureUrl('http://127.0.0.1:3000')).toBe(true);
    });

    it('should return false for HTTP non-localhost', () => {
      expect(isSecureUrl('http://api.example.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isSecureUrl('not-a-url')).toBe(false);
    });

    it('should return false for non-HTTP protocols', () => {
      expect(isSecureUrl('ftp://api.example.com')).toBe(false);
    });
  });
});

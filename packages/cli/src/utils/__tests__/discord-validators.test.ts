/**
 * Discord Validators Tests
 *
 * Sprint 149: Critical CLI Security Fixes (M-4)
 *
 * Tests for Discord ID validation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  validateDiscordId,
  validateGuildId,
  validateUserId,
  validateChannelId,
  validateRoleId,
  isValidDiscordId,
  isValidGuildId,
  formatDiscordId,
  getDiscordIdHelpMessage,
  DiscordIdValidationError,
} from '../discord-validators.js';

describe('discord-validators', () => {
  describe('validateGuildId', () => {
    describe('valid IDs', () => {
      it('should accept 17-digit IDs', () => {
        expect(() => validateGuildId('12345678901234567')).not.toThrow();
      });

      it('should accept 18-digit IDs', () => {
        expect(() => validateGuildId('123456789012345678')).not.toThrow();
      });

      it('should accept 19-digit IDs', () => {
        expect(() => validateGuildId('1234567890123456789')).not.toThrow();
      });
    });

    describe('invalid IDs', () => {
      it('should reject empty string', () => {
        expect(() => validateGuildId('')).toThrow(DiscordIdValidationError);
        expect(() => validateGuildId('')).toThrow(/required/i);
      });

      it('should reject too short IDs (16 digits)', () => {
        expect(() => validateGuildId('1234567890123456')).toThrow(DiscordIdValidationError);
        expect(() => validateGuildId('1234567890123456')).toThrow(/17-19 digit/);
      });

      it('should reject too long IDs (20 digits)', () => {
        expect(() => validateGuildId('12345678901234567890')).toThrow(DiscordIdValidationError);
      });

      it('should reject non-numeric characters', () => {
        expect(() => validateGuildId('123456789012345abc')).toThrow(DiscordIdValidationError);
      });

      it('should reject SQL injection patterns', () => {
        expect(() => validateGuildId("123456789012345'; DROP TABLE--")).toThrow(
          DiscordIdValidationError
        );
      });

      it('should reject XSS patterns', () => {
        expect(() => validateGuildId('<script>alert(1)</script>')).toThrow(
          DiscordIdValidationError
        );
      });

      it('should reject special characters', () => {
        expect(() => validateGuildId('123-456-789-012-345')).toThrow(DiscordIdValidationError);
        expect(() => validateGuildId('123.456.789.012.345')).toThrow(DiscordIdValidationError);
        expect(() => validateGuildId('123 456 789 012 345')).toThrow(DiscordIdValidationError);
      });
    });
  });

  describe('validateDiscordId with different types', () => {
    it('should validate user IDs', () => {
      expect(() => validateUserId('123456789012345678')).not.toThrow();
      expect(() => validateUserId('invalid')).toThrow(DiscordIdValidationError);
    });

    it('should validate channel IDs', () => {
      expect(() => validateChannelId('123456789012345678')).not.toThrow();
      expect(() => validateChannelId('invalid')).toThrow(DiscordIdValidationError);
    });

    it('should validate role IDs', () => {
      expect(() => validateRoleId('123456789012345678')).not.toThrow();
      expect(() => validateRoleId('invalid')).toThrow(DiscordIdValidationError);
    });

    it('should include ID type in error message', () => {
      try {
        validateDiscordId('invalid', 'channel');
      } catch (error) {
        expect(error).toBeInstanceOf(DiscordIdValidationError);
        expect((error as DiscordIdValidationError).message).toContain('channel');
        expect((error as DiscordIdValidationError).idType).toBe('channel');
      }
    });
  });

  describe('isValidDiscordId', () => {
    it('should return true for valid IDs', () => {
      expect(isValidDiscordId('123456789012345678')).toBe(true);
      expect(isValidDiscordId('12345678901234567')).toBe(true);
      expect(isValidDiscordId('1234567890123456789')).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(isValidDiscordId('12345')).toBe(false);
      expect(isValidDiscordId('abc')).toBe(false);
      expect(isValidDiscordId('')).toBe(false);
      expect(isValidDiscordId('123456789012345678901')).toBe(false);
    });
  });

  describe('isValidGuildId', () => {
    it('should work the same as isValidDiscordId', () => {
      expect(isValidGuildId('123456789012345678')).toBe(true);
      expect(isValidGuildId('invalid')).toBe(false);
    });
  });

  describe('DiscordIdValidationError', () => {
    it('should include ID type and invalid ID', () => {
      const error = new DiscordIdValidationError('Test error', 'guild', '123');
      expect(error.idType).toBe('guild');
      expect(error.invalidId).toBe('123');
      expect(error.name).toBe('DiscordIdValidationError');
    });

    it('should be instanceof Error', () => {
      const error = new DiscordIdValidationError('Test', 'guild', '123');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('formatDiscordId', () => {
    it('should return ID unchanged when under max length', () => {
      expect(formatDiscordId('123456789012345678')).toBe('123456789012345678');
    });

    it('should truncate long IDs', () => {
      const longId = '1234567890123456789012345678901234567890';
      const formatted = formatDiscordId(longId, 15);
      expect(formatted).toBe('123456...7890');
      expect(formatted.length).toBeLessThan(longId.length);
    });

    it('should handle empty string', () => {
      expect(formatDiscordId('')).toBe('(none)');
    });
  });

  describe('getDiscordIdHelpMessage', () => {
    it('should return help for guild IDs', () => {
      const help = getDiscordIdHelpMessage('guild');
      expect(help).toContain('17-19 digit');
      expect(help).toContain('123456789012345678');
      expect(help).toContain('server');
    });

    it('should return help for user IDs', () => {
      const help = getDiscordIdHelpMessage('user');
      expect(help).toContain('user');
      expect(help).toContain('Developer Mode');
    });

    it('should return help for channel IDs', () => {
      const help = getDiscordIdHelpMessage('channel');
      expect(help).toContain('channel');
    });

    it('should return help for role IDs', () => {
      const help = getDiscordIdHelpMessage('role');
      expect(help).toContain('role');
    });
  });
});

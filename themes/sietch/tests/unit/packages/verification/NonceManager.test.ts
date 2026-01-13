/**
 * NonceManager Tests
 *
 * Unit tests for cryptographic nonce generation and validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NonceManager } from '../../../../src/packages/verification/NonceManager.js';
import type { Nonce } from '../../../../src/packages/verification/types.js';

describe('NonceManager', () => {
  let manager: NonceManager;

  beforeEach(() => {
    manager = new NonceManager();
  });

  describe('constructor', () => {
    it('should create with default TTL of 15 minutes', () => {
      expect(manager.getTtlMinutes()).toBe(15);
      expect(manager.getTtlMs()).toBe(15 * 60 * 1000);
    });

    it('should accept custom TTL', () => {
      const customManager = new NonceManager(30);
      expect(customManager.getTtlMinutes()).toBe(30);
      expect(customManager.getTtlMs()).toBe(30 * 60 * 1000);
    });

    it('should reject TTL of 0', () => {
      expect(() => new NonceManager(0)).toThrow('TTL must be greater than 0');
    });

    it('should reject negative TTL', () => {
      expect(() => new NonceManager(-5)).toThrow('TTL must be greater than 0');
    });
  });

  describe('generate', () => {
    it('should generate a nonce with UUIDv4 format', () => {
      const nonce = manager.generate();
      // UUIDv4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(nonce.value).toMatch(uuidV4Regex);
    });

    it('should set createdAt to current time', () => {
      const before = new Date();
      const nonce = manager.generate();
      const after = new Date();

      expect(nonce.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(nonce.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set expiresAt to createdAt + TTL', () => {
      const nonce = manager.generate();
      const expectedExpiry = nonce.createdAt.getTime() + manager.getTtlMs();
      expect(nonce.expiresAt.getTime()).toBe(expectedExpiry);
    });

    it('should initialize used as false', () => {
      const nonce = manager.generate();
      expect(nonce.used).toBe(false);
    });

    it('should generate unique nonces', () => {
      const nonces = Array.from({ length: 100 }, () => manager.generate());
      const values = nonces.map((n) => n.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(100);
    });
  });

  describe('isValid', () => {
    it('should return true for fresh nonce', () => {
      const nonce = manager.generate();
      expect(manager.isValid(nonce)).toBe(true);
    });

    it('should return false for used nonce', () => {
      const nonce = manager.generate();
      const usedNonce = manager.markUsed(nonce);
      expect(manager.isValid(usedNonce)).toBe(false);
    });

    it('should return false for expired nonce', () => {
      const nonce: Nonce = {
        value: 'test-nonce',
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        used: false,
      };
      expect(manager.isValid(nonce)).toBe(false);
    });

    it('should return false for used AND expired nonce', () => {
      const nonce: Nonce = {
        value: 'test-nonce',
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
        used: true,
      };
      expect(manager.isValid(nonce)).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('should return false for fresh nonce', () => {
      const nonce = manager.generate();
      expect(manager.isExpired(nonce)).toBe(false);
    });

    it('should return true for expired nonce', () => {
      const nonce: Nonce = {
        value: 'test-nonce',
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
        used: false,
      };
      expect(manager.isExpired(nonce)).toBe(true);
    });

    it('should return true when exactly at expiry time', () => {
      const now = Date.now();
      const nonce: Nonce = {
        value: 'test-nonce',
        createdAt: new Date(now - 15 * 60 * 1000),
        expiresAt: new Date(now),
        used: false,
      };
      expect(manager.isExpired(nonce)).toBe(true);
    });
  });

  describe('markUsed', () => {
    it('should return a new nonce with used=true', () => {
      const nonce = manager.generate();
      const usedNonce = manager.markUsed(nonce);

      expect(usedNonce.used).toBe(true);
      expect(usedNonce.value).toBe(nonce.value);
      expect(usedNonce.createdAt).toBe(nonce.createdAt);
      expect(usedNonce.expiresAt).toBe(nonce.expiresAt);
    });

    it('should not mutate original nonce', () => {
      const nonce = manager.generate();
      manager.markUsed(nonce);
      expect(nonce.used).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return positive value for fresh nonce', () => {
      const nonce = manager.generate();
      const remaining = manager.getRemainingTime(nonce);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(manager.getTtlMs());
    });

    it('should return 0 for expired nonce', () => {
      const nonce: Nonce = {
        value: 'test-nonce',
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
        used: false,
      };
      expect(manager.getRemainingTime(nonce)).toBe(0);
    });

    it('should decrease over time', async () => {
      const nonce = manager.generate();
      const remaining1 = manager.getRemainingTime(nonce);

      // Wait a small amount of time
      await new Promise((resolve) => setTimeout(resolve, 10));

      const remaining2 = manager.getRemainingTime(nonce);
      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe('TTL edge cases', () => {
    it('should handle very short TTL (1 minute)', () => {
      const shortManager = new NonceManager(1);
      const nonce = shortManager.generate();
      expect(shortManager.getTtlMs()).toBe(60 * 1000);
      expect(shortManager.isValid(nonce)).toBe(true);
    });

    it('should handle very long TTL (24 hours)', () => {
      const longManager = new NonceManager(24 * 60);
      const nonce = longManager.generate();
      expect(longManager.getTtlMs()).toBe(24 * 60 * 60 * 1000);
      expect(longManager.isValid(nonce)).toBe(true);
    });

    it('should handle fractional TTL', () => {
      const fractionalManager = new NonceManager(0.5);
      expect(fractionalManager.getTtlMs()).toBe(30 * 1000); // 30 seconds
    });
  });
});

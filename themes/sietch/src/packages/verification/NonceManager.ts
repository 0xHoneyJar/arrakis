/**
 * NonceManager
 *
 * Generates and validates cryptographically secure nonces for wallet verification.
 * Nonces are UUIDv4 with configurable TTL (default 15 minutes).
 */

import { randomUUID } from 'crypto';
import type { Nonce } from './types.js';

/**
 * Default TTL for nonces in minutes
 */
const DEFAULT_TTL_MINUTES = 15;

/**
 * Manages cryptographically secure nonces for verification sessions.
 *
 * Nonces are:
 * - Cryptographically random (UUIDv4)
 * - Time-limited (configurable TTL)
 * - Single-use (tracked via `used` flag)
 */
export class NonceManager {
  private readonly ttlMs: number;

  /**
   * Create a new NonceManager
   * @param ttlMinutes - Time-to-live for nonces in minutes (default: 15)
   */
  constructor(ttlMinutes: number = DEFAULT_TTL_MINUTES) {
    if (ttlMinutes <= 0) {
      throw new Error('TTL must be greater than 0');
    }
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate a new cryptographically random nonce
   * @returns A new Nonce object with value, creation time, and expiry
   */
  generate(): Nonce {
    const now = new Date();
    return {
      value: randomUUID(),
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      used: false,
    };
  }

  /**
   * Check if a nonce is valid (not expired and not used)
   * @param nonce - The nonce to validate
   * @returns true if the nonce is valid, false otherwise
   */
  isValid(nonce: Nonce): boolean {
    if (nonce.used) {
      return false;
    }
    return new Date() < nonce.expiresAt;
  }

  /**
   * Check if a nonce has expired
   * @param nonce - The nonce to check
   * @returns true if the nonce has expired
   */
  isExpired(nonce: Nonce): boolean {
    return new Date() >= nonce.expiresAt;
  }

  /**
   * Get the TTL in milliseconds
   * @returns The configured TTL in milliseconds
   */
  getTtlMs(): number {
    return this.ttlMs;
  }

  /**
   * Get the TTL in minutes
   * @returns The configured TTL in minutes
   */
  getTtlMinutes(): number {
    return this.ttlMs / 60 / 1000;
  }

  /**
   * Mark a nonce as used
   * @param nonce - The nonce to mark as used
   * @returns A new Nonce object with used=true
   */
  markUsed(nonce: Nonce): Nonce {
    return {
      ...nonce,
      used: true,
    };
  }

  /**
   * Calculate remaining time until expiry
   * @param nonce - The nonce to check
   * @returns Remaining time in milliseconds (0 if expired)
   */
  getRemainingTime(nonce: Nonce): number {
    const remaining = nonce.expiresAt.getTime() - Date.now();
    return Math.max(0, remaining);
  }
}

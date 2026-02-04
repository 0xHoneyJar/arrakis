/**
 * Login Rate Limiter for CLI
 *
 * Sprint 150: CLI Security Enhancements (M-2, M-3)
 *
 * Implements exponential backoff and lockout after failed login attempts.
 * Stores attempt data in ~/.config/gaib/login-attempts.json
 *
 * @see grimoires/loa/a2a/audits/2026-01-20/SECURITY-AUDIT-REPORT-CLI.md
 * @module packages/cli/utils/rate-limiter
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// =============================================================================
// Types
// =============================================================================

/**
 * Login attempt record
 */
interface LoginAttemptRecord {
  /** Timestamp of last failed attempt */
  lastFailedAttempt: number;
  /** Number of consecutive failed attempts */
  failedCount: number;
  /** Timestamp when lockout expires (if locked) */
  lockoutUntil?: number;
}

/**
 * Rate limiter storage format
 */
interface RateLimiterStorage {
  version: '1.0';
  attempts: Record<string, LoginAttemptRecord>;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Seconds until allowed (if blocked) */
  retryAfter?: number;
  /** Number of failed attempts */
  failedAttempts: number;
  /** Whether account is locked out */
  isLocked: boolean;
  /** Human-readable message */
  message?: string;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum failed attempts before lockout */
  maxAttempts: number;
  /** Base lockout duration in seconds */
  baseLockoutSeconds: number;
  /** Maximum lockout duration in seconds */
  maxLockoutSeconds: number;
  /** Time window to consider for failed attempts (seconds) */
  attemptWindowSeconds: number;
  /** Storage file path (optional, defaults to ~/.config/gaib/login-attempts.json) */
  storagePath?: string;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxAttempts: 3,
  baseLockoutSeconds: 300, // 5 minutes
  maxLockoutSeconds: 3600, // 1 hour max
  attemptWindowSeconds: 900, // 15-minute window
};

// =============================================================================
// Rate Limiter Class
// =============================================================================

/**
 * Login rate limiter
 *
 * Tracks failed login attempts and implements lockout protection.
 */
export class LoginRateLimiter {
  private config: RateLimiterConfig;
  private storagePath: string;
  private storage: RateLimiterStorage;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storagePath = this.config.storagePath || this.getDefaultStoragePath();
    this.storage = this.loadStorage();
  }

  /**
   * Get default storage path
   */
  private getDefaultStoragePath(): string {
    const configDir = join(homedir(), '.config', 'gaib');
    return join(configDir, 'login-attempts.json');
  }

  /**
   * Ensure config directory exists
   */
  private ensureConfigDir(): void {
    const configDir = join(homedir(), '.config', 'gaib');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load storage from disk
   */
  private loadStorage(): RateLimiterStorage {
    try {
      if (existsSync(this.storagePath)) {
        const content = readFileSync(this.storagePath, 'utf-8');
        const data = JSON.parse(content) as RateLimiterStorage;
        if (data.version === '1.0' && data.attempts) {
          return data;
        }
      }
    } catch {
      // Ignore errors, start fresh
    }
    return { version: '1.0', attempts: {} };
  }

  /**
   * Save storage to disk
   */
  private saveStorage(): void {
    try {
      this.ensureConfigDir();
      writeFileSync(this.storagePath, JSON.stringify(this.storage, null, 2), {
        mode: 0o600,
      });
    } catch {
      // Ignore save errors (non-critical)
    }
  }

  /**
   * Get normalized key for server URL
   */
  private getKey(serverUrl: string): string {
    try {
      const url = new URL(serverUrl);
      return url.host.toLowerCase();
    } catch {
      return serverUrl.toLowerCase();
    }
  }

  /**
   * Check if login attempt is allowed
   *
   * @param serverUrl - API server URL
   * @returns Rate limit result
   */
  check(serverUrl: string): RateLimitResult {
    const key = this.getKey(serverUrl);
    const record = this.storage.attempts[key];
    const now = Date.now();

    // No record = allowed
    if (!record) {
      return {
        allowed: true,
        failedAttempts: 0,
        isLocked: false,
      };
    }

    // Check if lockout has expired
    if (record.lockoutUntil && record.lockoutUntil > now) {
      const retryAfter = Math.ceil((record.lockoutUntil - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        failedAttempts: record.failedCount,
        isLocked: true,
        message: `Too many failed login attempts. Try again in ${this.formatDuration(retryAfter)}.`,
      };
    }

    // Check if attempts are within window
    const windowStart = now - this.config.attemptWindowSeconds * 1000;
    if (record.lastFailedAttempt < windowStart) {
      // Old attempts, reset
      delete this.storage.attempts[key];
      this.saveStorage();
      return {
        allowed: true,
        failedAttempts: 0,
        isLocked: false,
      };
    }

    // Within window but not locked
    return {
      allowed: true,
      failedAttempts: record.failedCount,
      isLocked: false,
    };
  }

  /**
   * Record a failed login attempt
   *
   * @param serverUrl - API server URL
   * @returns Updated rate limit result
   */
  recordFailure(serverUrl: string): RateLimitResult {
    const key = this.getKey(serverUrl);
    const now = Date.now();

    // Get or create record
    let record = this.storage.attempts[key];
    if (!record) {
      record = {
        lastFailedAttempt: now,
        failedCount: 0,
      };
    }

    // Increment failure count
    record.failedCount++;
    record.lastFailedAttempt = now;

    // Check if lockout threshold reached
    if (record.failedCount >= this.config.maxAttempts) {
      // Calculate lockout duration with exponential backoff
      const lockoutMultiplier = Math.pow(2, record.failedCount - this.config.maxAttempts);
      const lockoutSeconds = Math.min(
        this.config.baseLockoutSeconds * lockoutMultiplier,
        this.config.maxLockoutSeconds
      );
      record.lockoutUntil = now + lockoutSeconds * 1000;
    }

    this.storage.attempts[key] = record;
    this.saveStorage();

    if (record.lockoutUntil && record.lockoutUntil > now) {
      const retryAfter = Math.ceil((record.lockoutUntil - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        failedAttempts: record.failedCount,
        isLocked: true,
        message: `Account locked. Try again in ${this.formatDuration(retryAfter)}.`,
      };
    }

    const remainingAttempts = this.config.maxAttempts - record.failedCount;
    return {
      allowed: true,
      failedAttempts: record.failedCount,
      isLocked: false,
      message: remainingAttempts > 0
        ? `${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before lockout.`
        : undefined,
    };
  }

  /**
   * Record a successful login (resets counter)
   *
   * @param serverUrl - API server URL
   */
  recordSuccess(serverUrl: string): void {
    const key = this.getKey(serverUrl);
    if (this.storage.attempts[key]) {
      delete this.storage.attempts[key];
      this.saveStorage();
    }
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.storage = { version: '1.0', attempts: {} };
    this.saveStorage();
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} second${seconds === 1 ? '' : 's'}`;
    }
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let rateLimiterInstance: LoginRateLimiter | null = null;

/**
 * Get the rate limiter singleton instance
 *
 * @param config - Optional configuration override
 * @returns Rate limiter instance
 */
export function getRateLimiter(config?: Partial<RateLimiterConfig>): LoginRateLimiter {
  if (!rateLimiterInstance || config) {
    rateLimiterInstance = new LoginRateLimiter(config);
  }
  return rateLimiterInstance;
}

/**
 * Check if login is allowed for server
 *
 * Convenience function using singleton.
 *
 * @param serverUrl - API server URL
 * @returns Rate limit result
 */
export function checkLoginRateLimit(serverUrl: string): RateLimitResult {
  return getRateLimiter().check(serverUrl);
}

/**
 * Record failed login attempt
 *
 * Convenience function using singleton.
 *
 * @param serverUrl - API server URL
 * @returns Updated rate limit result
 */
export function recordLoginFailure(serverUrl: string): RateLimitResult {
  return getRateLimiter().recordFailure(serverUrl);
}

/**
 * Record successful login
 *
 * Convenience function using singleton.
 *
 * @param serverUrl - API server URL
 */
export function recordLoginSuccess(serverUrl: string): void {
  getRateLimiter().recordSuccess(serverUrl);
}

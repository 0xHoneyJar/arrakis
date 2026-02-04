/**
 * CLI Utilities
 *
 * Sprint 149: Critical CLI Security Fixes
 *
 * Shared utility functions for CLI commands.
 *
 * @module packages/cli/utils
 */

// URL Validation (H-1: HTTPS Enforcement)
export {
  validateServerUrl,
  getValidatedServerUrl,
  isSecureUrl,
  isLocalhostHostname,
  ServerUrlError,
  type UrlValidationOptions,
} from './url-validator.js';

// Error Sanitization (H-2: Error Message Sanitization)
export {
  sanitizeError,
  redactSensitiveData,
  formatErrorForConsole,
  handleErrorAndExit,
  ErrorCodes,
  type ErrorCode,
  type SanitizedError,
  type FormatErrorOptions,
} from './error-sanitizer.js';

// Discord ID Validation (M-4: Guild ID Validation Standardization)
export {
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
  type DiscordIdType,
} from './discord-validators.js';

// Rate Limiting (M-2, M-3: Login Protection)
export {
  LoginRateLimiter,
  getRateLimiter,
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
  type RateLimiterConfig,
  type RateLimitResult,
} from './rate-limiter.js';

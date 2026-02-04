/**
 * Error Sanitization for CLI Commands
 *
 * Sprint 149: Critical CLI Security Fixes (H-2)
 *
 * Prevents sensitive data from being exposed in error messages.
 * Provides safe error messages for production use.
 *
 * @see grimoires/loa/a2a/audits/2026-01-20/remediation/H-2-Error-Sanitization.md
 * @module packages/cli/utils/error-sanitizer
 */

import chalk from 'chalk';

// =============================================================================
// Types
// =============================================================================

/**
 * Safe error codes for user-facing messages
 */
export const ErrorCodes = {
  NETWORK_ERROR: 'CLI_NETWORK_001',
  AUTH_FAILED: 'CLI_AUTH_002',
  INVALID_INPUT: 'CLI_INPUT_003',
  SERVER_ERROR: 'CLI_SERVER_004',
  UNKNOWN_ERROR: 'CLI_UNKNOWN_005',
  VALIDATION_ERROR: 'CLI_VALIDATION_006',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Sanitized error result
 */
export interface SanitizedError {
  /** User-safe error message */
  message: string;
  /** Error code for support/debugging */
  code: ErrorCode;
  /** Original error (only in development) */
  originalError?: unknown;
}

// =============================================================================
// Sensitive Data Patterns
// =============================================================================

/**
 * Sensitive patterns to redact from error messages
 *
 * These patterns match common sensitive data formats that should never
 * be exposed in user-visible error messages.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  // API keys (various formats)
  /api[_-]?key[:\s]*[A-Za-z0-9\-._~+/]+=*/gi,
  // Passwords in URLs
  /:\/\/[^:]+:([^@]+)@/g,
  // JWT tokens (eyJ... format)
  /eyJ[A-Za-z0-9\-._~+/]+=*/g,
  // Session tokens (common formats)
  /session[_-]?token[:\s]*[A-Za-z0-9\-._~+/]+=*/gi,
  // Secret keys
  /secret[_-]?key[:\s]*[A-Za-z0-9\-._~+/]+=*/gi,
  // Authorization headers
  /Authorization:\s*[^\s]+/gi,
];

// =============================================================================
// Redaction
// =============================================================================

/**
 * Redact sensitive data from a string
 *
 * Replaces sensitive patterns with redacted versions that preserve
 * some context (first/last chars) while hiding the sensitive portion.
 *
 * @param text - Text that may contain sensitive data
 * @returns Text with sensitive data redacted
 */
export function redactSensitiveData(text: string): string {
  let sanitized = text;

  for (const pattern of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;

    sanitized = sanitized.replace(pattern, (match) => {
      // Keep first and last 4 chars for context, redact middle
      if (match.length > 12) {
        return `${match.slice(0, 4)}...[REDACTED]...${match.slice(-4)}`;
      }
      return '[REDACTED]';
    });
  }

  return sanitized;
}

// =============================================================================
// Error Sanitization
// =============================================================================

/**
 * Check if we're running in development mode
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Sanitize an error for safe display
 *
 * Converts raw errors into user-safe messages with appropriate error codes.
 * In development, includes more detail; in production, returns generic messages.
 *
 * @param error - Original error
 * @param context - Additional context about where error occurred
 * @returns Sanitized error safe for display
 */
export function sanitizeError(
  error: unknown,
  context?: string
): SanitizedError {
  const inDevelopment = isDevelopment();

  // Network errors (fetch failed)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: 'Failed to connect to server. Please check your connection and server URL.',
      code: ErrorCodes.NETWORK_ERROR,
      originalError: inDevelopment ? error : undefined,
    };
  }

  // HTTP errors
  if (error instanceof Error) {
    // Check for HTTP status codes in error message
    const statusMatch = error.message.match(/status[:\s]+(\d+)/i);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : null;

    if (status === 401 || status === 403) {
      return {
        message: 'Authentication failed. Please check your credentials.',
        code: ErrorCodes.AUTH_FAILED,
        originalError: inDevelopment ? error : undefined,
      };
    }

    if (status && status >= 500) {
      return {
        message: 'Server error. Please try again later.',
        code: ErrorCodes.SERVER_ERROR,
        originalError: inDevelopment ? error : undefined,
      };
    }

    if (status === 400) {
      return {
        message: 'Invalid request. Please check your input.',
        code: ErrorCodes.INVALID_INPUT,
        originalError: inDevelopment ? error : undefined,
      };
    }
  }

  // Validation errors (safe to show message)
  if (error instanceof Error && error.name === 'ValidationError') {
    return {
      message: error.message,
      code: ErrorCodes.VALIDATION_ERROR,
      originalError: inDevelopment ? error : undefined,
    };
  }

  // Default: scrub error message and return generic message
  let message = 'An unexpected error occurred.';

  if (inDevelopment && error instanceof Error) {
    // In development, show sanitized error message
    message = redactSensitiveData(error.message);
    if (context) {
      message = `${context}: ${message}`;
    }
  }

  return {
    message,
    code: ErrorCodes.UNKNOWN_ERROR,
    originalError: inDevelopment ? error : undefined,
  };
}

// =============================================================================
// Console Output
// =============================================================================

/**
 * Options for formatting errors to console
 */
export interface FormatErrorOptions {
  /** Output as JSON */
  json?: boolean;
  /** Show error code */
  showCode?: boolean;
}

/**
 * Format error for console output
 *
 * Outputs sanitized error in either human-readable or JSON format.
 *
 * @param sanitized - Sanitized error
 * @param options - Display options
 */
export function formatErrorForConsole(
  sanitized: SanitizedError,
  options: FormatErrorOptions = {}
): void {
  const { json = false, showCode = true } = options;

  if (json) {
    console.log(
      JSON.stringify({
        success: false,
        error: sanitized.message,
        code: sanitized.code,
      })
    );
  } else {
    console.error(chalk.red(`Error: ${sanitized.message}`));
    if (showCode) {
      console.error(chalk.dim(`Error code: ${sanitized.code}`));
    }

    // Show original error in development
    if (sanitized.originalError && isDevelopment()) {
      console.error(chalk.dim('\nOriginal error (development only):'));
      console.error(sanitized.originalError);
    }
  }
}

/**
 * Handle error with sanitization and exit
 *
 * Convenience function for command error handling.
 * Sanitizes the error, outputs it, and exits with appropriate code.
 *
 * @param error - Original error
 * @param options - Display options
 * @param exitCode - Exit code (default: 1)
 */
export function handleErrorAndExit(
  error: unknown,
  options: FormatErrorOptions = {},
  exitCode: number = 1
): never {
  const sanitized = sanitizeError(error);
  formatErrorForConsole(sanitized, options);
  process.exit(exitCode);
}

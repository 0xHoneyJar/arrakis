/**
 * URL Validation for API Server Connections
 *
 * Sprint 149: Critical CLI Security Fixes (H-1)
 *
 * Ensures that production API servers use HTTPS protocol.
 * Allows HTTP only for localhost/development environments.
 *
 * @see grimoires/loa/a2a/audits/2026-01-20/remediation/H-1-HTTPS-Enforcement.md
 * @module packages/cli/utils/url-validator
 */

import chalk from 'chalk';

// =============================================================================
// Types
// =============================================================================

/**
 * Error class for server URL validation failures
 */
export class ServerUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerUrlError';
  }
}

/**
 * Options for URL validation
 */
export interface UrlValidationOptions {
  /** Allow HTTP for localhost (default: true) */
  allowLocalhostHttp?: boolean;
  /** Warn instead of error for HTTP (default: false) */
  warnOnly?: boolean;
}

// =============================================================================
// Localhost Detection
// =============================================================================

/**
 * Hostnames that are considered localhost
 */
const LOCALHOST_HOSTNAMES = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Check if a hostname is localhost
 *
 * Note: IPv6 localhost can appear as '::1' or '[::1]' depending on context.
 * The URL parser returns '[::1]' with brackets when parsing URLs.
 *
 * @param hostname - Hostname to check
 * @returns true if localhost
 */
export function isLocalhostHostname(hostname: string): boolean {
  return LOCALHOST_HOSTNAMES.includes(hostname);
}

// =============================================================================
// URL Validation
// =============================================================================

/**
 * Validate server URL enforces HTTPS for non-localhost connections
 *
 * Security: Session tokens and sensitive data are transmitted to the API server.
 * Using HTTP for non-localhost connections exposes this data to MITM attacks.
 *
 * @param url - Server URL to validate
 * @param options - Validation options
 * @throws ServerUrlError if URL is invalid or insecure
 */
export function validateServerUrl(
  url: string,
  options: UrlValidationOptions = {}
): void {
  const { allowLocalhostHttp = true, warnOnly = false } = options;

  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ServerUrlError(`Invalid server URL: ${url}`);
  }

  // Check protocol
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ServerUrlError(
      `Server URL must use HTTP or HTTPS protocol. Got: ${parsed.protocol}`
    );
  }

  // Enforce HTTPS for non-localhost
  if (parsed.protocol === 'http:') {
    const isLocalhost = isLocalhostHostname(parsed.hostname);

    if (!isLocalhost || !allowLocalhostHttp) {
      const message = [
        'Insecure HTTP connection detected!',
        `Server: ${parsed.hostname}`,
        '',
        'Production API servers must use HTTPS to protect session tokens.',
        'HTTP is only allowed for localhost development.',
      ].join('\n');

      if (warnOnly) {
        console.warn(chalk.yellow('⚠ WARNING: ' + message));
      } else {
        throw new ServerUrlError(message);
      }
    }
  }
}

/**
 * Get and validate server URL from environment or default
 *
 * Combines URL resolution with validation in a single utility function.
 *
 * @param envUrl - URL from environment variable (e.g., GAIB_API_URL)
 * @param defaultUrl - Default URL (should be localhost HTTP for development)
 * @param options - Validation options
 * @returns Validated server URL
 * @throws ServerUrlError if URL is invalid or insecure
 */
export function getValidatedServerUrl(
  envUrl: string | undefined,
  defaultUrl: string,
  options: UrlValidationOptions = {}
): string {
  const url = envUrl || defaultUrl;
  validateServerUrl(url, options);
  return url;
}

/**
 * Check if a URL is secure (HTTPS or localhost HTTP)
 *
 * Non-throwing version for conditional logic.
 *
 * @param url - URL to check
 * @returns true if URL is secure or localhost HTTP
 */
export function isSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // HTTPS is always secure
    if (parsed.protocol === 'https:') {
      return true;
    }

    // HTTP is only secure for localhost
    if (parsed.protocol === 'http:') {
      return isLocalhostHostname(parsed.hostname);
    }

    return false;
  } catch {
    return false;
  }
}

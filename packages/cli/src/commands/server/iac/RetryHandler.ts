/**
 * RetryHandler - Exponential Backoff Retry Logic
 *
 * Sprint 92: Discord Infrastructure-as-Code - Diff Calculation & State Application
 *
 * Implements exponential backoff with jitter for retrying transient errors
 * from the Discord API (429 rate limits and 5xx server errors).
 *
 * @see SDD grimoires/loa/discord-iac-sdd.md §8.3
 * @module packages/cli/commands/server/iac/RetryHandler
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Retry handler configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Jitter factor 0-1 (default: 0.1) */
  jitterFactor?: number;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback invoked before each retry */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Result of a retried operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result value if successful */
  result?: T;
  /** Final error if all retries failed */
  error?: unknown;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent retrying in ms */
  totalTimeMs: number;
}

/**
 * Discord API error structure (subset)
 */
export interface DiscordHttpError {
  status?: number;
  code?: number;
  message?: string;
  retryAfter?: number;
}

// ============================================================================
// Default Retryable Check
// ============================================================================

/**
 * Default check for retryable errors
 *
 * Retryable errors:
 * - 429 (Rate Limited)
 * - 500 (Internal Server Error)
 * - 502 (Bad Gateway)
 * - 503 (Service Unavailable)
 * - 504 (Gateway Timeout)
 */
export function isRetryableError(error: unknown): boolean {
  // Check for HTTP status-like errors
  if (error && typeof error === 'object') {
    const httpError = error as DiscordHttpError;

    // Check status code
    if (httpError.status !== undefined) {
      return (
        httpError.status === 429 ||
        httpError.status >= 500
      );
    }

    // Check Discord error code (10xxx are not found, 50xxx are permissions)
    if (httpError.code !== undefined) {
      // Rate limit specific code
      if (httpError.code === 0 && httpError.message?.includes('rate limit')) {
        return true;
      }
    }

    // Check for network errors
    const errorMessage = (error as Error).message?.toLowerCase() ?? '';
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('network')
    ) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// RetryHandler Class
// ============================================================================

/**
 * Execute operations with exponential backoff retry logic
 *
 * @example
 * ```typescript
 * const handler = new RetryHandler({ maxAttempts: 3 });
 *
 * const result = await handler.execute(async () => {
 *   return await discordApi.createRole(guildId, roleData);
 * });
 *
 * if (result.success) {
 *   console.log('Role created:', result.result);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error);
 * }
 * ```
 */
export class RetryHandler {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterFactor: number;
  private readonly isRetryable: (error: unknown) => boolean;
  private readonly onRetry?: (attempt: number, error: unknown, delayMs: number) => void;

  /**
   * Create a new retry handler
   */
  constructor(options: RetryOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.jitterFactor = options.jitterFactor ?? 0.1;
    this.isRetryable = options.isRetryable ?? isRetryableError;
    this.onRetry = options.onRetry;
  }

  /**
   * Execute an operation with retry logic
   *
   * @param operation - Async function to execute
   * @returns Result with success status, value/error, and metadata
   */
  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: unknown;
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      attempts++;

      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts,
          totalTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempts >= this.maxAttempts || !this.isRetryable(error)) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempts, error);

        // Notify callback if provided
        if (this.onRetry) {
          this.onRetry(attempts, error, delay);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Execute an operation, throwing on failure
   *
   * @param operation - Async function to execute
   * @returns Result value
   * @throws Last error if all retries fail
   */
  async executeOrThrow<T>(operation: () => Promise<T>): Promise<T> {
    const result = await this.execute(operation);

    if (!result.success) {
      throw result.error;
    }

    return result.result as T;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, error: unknown): number {
    // Check for retry-after header from Discord
    if (error && typeof error === 'object') {
      const httpError = error as DiscordHttpError;
      if (httpError.retryAfter !== undefined && httpError.retryAfter > 0) {
        // Use Discord's suggested retry time (convert to ms if needed)
        const retryAfterMs = httpError.retryAfter < 1000
          ? httpError.retryAfter * 1000
          : httpError.retryAfter;
        return Math.min(retryAfterMs, this.maxDelayMs);
      }
    }

    // Calculate exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt - 1);

    // Add jitter: delay * (1 - jitter + random * 2 * jitter)
    const jitter = 1 - this.jitterFactor + Math.random() * 2 * this.jitterFactor;
    const delayWithJitter = exponentialDelay * jitter;

    // Cap at max delay
    return Math.min(Math.round(delayWithJitter), this.maxDelayMs);
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a retry handler with default options
 */
export function createRetryHandler(options?: RetryOptions): RetryHandler {
  return new RetryHandler(options);
}

/**
 * Execute an operation with default retry behavior
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const handler = new RetryHandler(options);
  return handler.executeOrThrow(operation);
}

/**
 * Extract retry-after value from Discord error response
 */
export function getRetryAfterMs(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const httpError = error as DiscordHttpError;

    // Direct retryAfter field
    if (httpError.retryAfter !== undefined) {
      return httpError.retryAfter < 1000
        ? httpError.retryAfter * 1000
        : httpError.retryAfter;
    }

    // Check for rate limit message
    const message = (error as Error).message ?? '';
    const match = message.match(/retry after (\d+(?:\.\d+)?)/i);
    if (match) {
      const seconds = parseFloat(match[1]);
      return Math.ceil(seconds * 1000);
    }
  }

  return undefined;
}

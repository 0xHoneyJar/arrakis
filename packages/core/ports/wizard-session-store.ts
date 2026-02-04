/**
 * IWizardSessionStore Interface
 *
 * Sprint S-20: Wizard Session Store & State Model
 *
 * Port interface for wizard session management.
 * Defines the contract for Redis-backed session storage with:
 * - 15-minute TTL
 * - Guild indexing for lookup
 * - IP binding for session security
 * - State machine transition validation
 *
 * @see SDD §6.3.3 Session Store (Redis)
 */

import type {
  WizardSession,
  WizardState,
  WizardSessionData,
  NewWizardSession,
} from '../domain/wizard.js';

// =============================================================================
// Session Validation Result
// =============================================================================

/**
 * Result of session validation.
 */
export interface SessionValidationResult {
  /** Whether session is valid */
  valid: boolean;
  /** Reason for invalidity (if applicable) */
  reason?: 'not_found' | 'expired' | 'ip_mismatch' | 'invalid_state';
  /** The session if valid */
  session?: WizardSession;
}

// =============================================================================
// State Transition Result
// =============================================================================

/**
 * Result of a state transition attempt.
 */
export interface StateTransitionResult {
  /** Whether transition succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Updated session if successful */
  session?: WizardSession;
}

// =============================================================================
// Session Statistics
// =============================================================================

/**
 * Statistics about active wizard sessions.
 */
export interface SessionStats {
  /** Total active sessions */
  activeSessions: number;
  /** Sessions by state */
  sessionsByState: Record<WizardState, number>;
  /** Average session duration (seconds) */
  averageDurationSeconds: number;
  /** Sessions created in last hour */
  createdLastHour: number;
  /** Sessions completed in last hour */
  completedLastHour: number;
}

// =============================================================================
// IWizardSessionStore Interface
// =============================================================================

/**
 * Port interface for wizard session storage.
 *
 * Implementation requirements:
 * - Sessions stored in Redis with configurable TTL (default 15 minutes)
 * - Guild index for quick lookup by Discord guild ID
 * - IP binding support for session security
 * - State machine validation on transitions
 * - Atomic operations for concurrent access safety
 */
export interface IWizardSessionStore {
  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Session TTL in seconds.
   * Default: 900 (15 minutes)
   */
  readonly ttlSeconds: number;

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new wizard session.
   *
   * @param session - Session data (id, timestamps generated automatically)
   * @returns Created session with generated fields
   * @throws Error if session for guild already exists
   */
  create(session: NewWizardSession): Promise<WizardSession>;

  /**
   * Get a session by ID.
   *
   * @param sessionId - Session UUID
   * @returns Session or null if not found/expired
   */
  get(sessionId: string): Promise<WizardSession | null>;

  /**
   * Get a session by guild ID.
   *
   * @param guildId - Discord guild ID
   * @returns Session or null if not found/expired
   */
  getByGuild(guildId: string): Promise<WizardSession | null>;

  /**
   * Update session fields.
   * Refreshes expiration on update.
   *
   * @param sessionId - Session UUID
   * @param updates - Fields to update
   * @returns Updated session or null if not found
   */
  update(sessionId: string, updates: Partial<WizardSession>): Promise<WizardSession | null>;

  /**
   * Delete a session.
   *
   * @param sessionId - Session UUID
   * @returns True if deleted, false if not found
   */
  delete(sessionId: string): Promise<boolean>;

  /**
   * Delete session by guild ID.
   *
   * @param guildId - Discord guild ID
   * @returns True if deleted, false if not found
   */
  deleteByGuild(guildId: string): Promise<boolean>;

  // ===========================================================================
  // State Machine Operations
  // ===========================================================================

  /**
   * Transition session to a new state.
   * Validates transition is allowed per state machine rules.
   *
   * @param sessionId - Session UUID
   * @param newState - Target state
   * @param data - Data to merge with session data
   * @returns Transition result with updated session or error
   */
  transition(
    sessionId: string,
    newState: WizardState,
    data?: Partial<WizardSessionData>
  ): Promise<StateTransitionResult>;

  // ===========================================================================
  // Security Operations
  // ===========================================================================

  /**
   * Validate session for a request.
   * Checks existence, expiration, and IP binding.
   *
   * @param sessionId - Session UUID
   * @param ipAddress - Client IP address
   * @returns Validation result
   */
  validateSession(sessionId: string, ipAddress: string): Promise<SessionValidationResult>;

  /**
   * Bind session to an IP address.
   * SECURITY: Once bound, requests from different IPs will be rejected.
   *
   * @param sessionId - Session UUID
   * @param ipAddress - IP address to bind
   * @returns Updated session or null if not found
   */
  bindToIp(sessionId: string, ipAddress: string): Promise<WizardSession | null>;

  // ===========================================================================
  // Utility Operations
  // ===========================================================================

  /**
   * Refresh session TTL.
   * Extends expiration by ttlSeconds from now.
   *
   * @param sessionId - Session UUID
   * @returns True if refreshed, false if not found
   */
  refresh(sessionId: string): Promise<boolean>;

  /**
   * Check if a session exists for a guild.
   *
   * @param guildId - Discord guild ID
   * @returns True if session exists
   */
  existsForGuild(guildId: string): Promise<boolean>;

  /**
   * Get session statistics.
   * For monitoring and observability.
   *
   * @returns Session statistics
   */
  getStats(): Promise<SessionStats>;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Close the session store.
   * Releases any resources (e.g., Redis connections).
   */
  close(): Promise<void>;
}

// =============================================================================
// Factory Function Type
// =============================================================================

/**
 * Factory function type for creating wizard session stores.
 */
export type CreateWizardSessionStore = (options: {
  /** Redis connection URL or client */
  redis: unknown;
  /** Logger instance */
  logger: unknown;
  /** Custom TTL in seconds (optional) */
  ttlSeconds?: number;
}) => IWizardSessionStore;

// =============================================================================
// Constants
// =============================================================================

/**
 * Default session TTL in seconds (15 minutes).
 */
export const DEFAULT_SESSION_TTL_SECONDS = 15 * 60;

/**
 * Maximum session TTL in seconds (1 hour).
 */
export const MAX_SESSION_TTL_SECONDS = 60 * 60;

/**
 * Redis key prefixes for session storage.
 */
export const SESSION_KEY_PREFIXES = {
  /** Session by ID: wizard:session:{id} */
  SESSION: 'wizard:session:',
  /** Guild index: wizard:guild:{guildId} */
  GUILD: 'wizard:guild:',
  /** Stats: wizard:stats */
  STATS: 'wizard:stats',
} as const;

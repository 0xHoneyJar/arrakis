/**
 * Discord ID Validation
 *
 * Sprint 149: Critical CLI Security Fixes (M-4)
 *
 * Validates Discord snowflake IDs (guild IDs, user IDs, channel IDs, etc.)
 * according to Discord's specifications.
 *
 * @see https://discord.com/developers/docs/reference#snowflakes
 * @see grimoires/loa/a2a/audits/2026-01-20/remediation/M-4-Guild-ID-Validation.md
 * @module packages/cli/utils/discord-validators
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Types of Discord IDs for error messaging
 */
export type DiscordIdType = 'guild' | 'user' | 'channel' | 'role';

/**
 * Validation error for Discord IDs
 */
export class DiscordIdValidationError extends Error {
  constructor(
    message: string,
    public readonly idType: DiscordIdType,
    public readonly invalidId: string
  ) {
    super(message);
    this.name = 'DiscordIdValidationError';
  }
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Discord Snowflake ID format
 *
 * Discord snowflakes are 64-bit unsigned integers represented as strings.
 * They are 17-19 digits in decimal format.
 *
 * - 17 digits: Earliest possible IDs (Discord epoch)
 * - 18 digits: Most current IDs
 * - 19 digits: Future IDs (64-bit max is ~20 digits)
 *
 * Note: Some older code uses 17-20, but 20 digits exceeds 64-bit max.
 */
const SNOWFLAKE_REGEX = /^\d{17,19}$/;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate a Discord snowflake ID
 *
 * @param id - Discord ID to validate
 * @param type - Type of ID for error messages
 * @returns true if valid
 * @throws DiscordIdValidationError if invalid
 */
export function validateDiscordId(
  id: string,
  type: DiscordIdType = 'guild'
): boolean {
  if (!id) {
    throw new DiscordIdValidationError(
      `${capitalize(type)} ID is required`,
      type,
      id ?? ''
    );
  }

  if (!SNOWFLAKE_REGEX.test(id)) {
    throw new DiscordIdValidationError(
      `Invalid ${type} ID format. Discord IDs must be 17-19 digit numbers.\nGot: ${id}`,
      type,
      id
    );
  }

  return true;
}

/**
 * Validate a guild ID specifically
 *
 * @param guildId - Discord guild (server) ID
 * @returns true if valid
 * @throws DiscordIdValidationError if invalid
 */
export function validateGuildId(guildId: string): boolean {
  return validateDiscordId(guildId, 'guild');
}

/**
 * Validate a user ID
 *
 * @param userId - Discord user ID
 * @returns true if valid
 * @throws DiscordIdValidationError if invalid
 */
export function validateUserId(userId: string): boolean {
  return validateDiscordId(userId, 'user');
}

/**
 * Validate a channel ID
 *
 * @param channelId - Discord channel ID
 * @returns true if valid
 * @throws DiscordIdValidationError if invalid
 */
export function validateChannelId(channelId: string): boolean {
  return validateDiscordId(channelId, 'channel');
}

/**
 * Validate a role ID
 *
 * @param roleId - Discord role ID
 * @returns true if valid
 * @throws DiscordIdValidationError if invalid
 */
export function validateRoleId(roleId: string): boolean {
  return validateDiscordId(roleId, 'role');
}

// =============================================================================
// Non-Throwing Validators
// =============================================================================

/**
 * Check if a string is a valid Discord ID (without throwing)
 *
 * @param id - Potential Discord ID
 * @returns true if valid format, false otherwise
 */
export function isValidDiscordId(id: string): boolean {
  if (!id) return false;
  return SNOWFLAKE_REGEX.test(id);
}

/**
 * Check if a string is a valid guild ID (without throwing)
 *
 * @param guildId - Potential guild ID
 * @returns true if valid format, false otherwise
 */
export function isValidGuildId(guildId: string): boolean {
  return isValidDiscordId(guildId);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a Discord ID for display (truncate if needed)
 *
 * @param id - Discord ID
 * @param maxLength - Maximum length to display
 * @returns Formatted ID
 */
export function formatDiscordId(id: string, maxLength = 20): string {
  if (!id) return '(none)';
  if (id.length <= maxLength) {
    return id;
  }
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

/**
 * Get a user-friendly error message for invalid Discord IDs
 *
 * @param idType - Type of ID
 * @returns Help message for the user
 */
export function getDiscordIdHelpMessage(idType: DiscordIdType = 'guild'): string {
  const messages: Record<DiscordIdType, string> = {
    guild: 'Get it by right-clicking the server → Copy Server ID (enable Developer Mode in Discord settings)',
    user: 'Get it by right-clicking the user → Copy User ID (enable Developer Mode in Discord settings)',
    channel: 'Get it by right-clicking the channel → Copy Channel ID (enable Developer Mode in Discord settings)',
    role: 'Get it from Server Settings → Roles → right-click role → Copy Role ID',
  };

  return [
    `Discord ${idType} IDs are 17-19 digit numbers`,
    'Example: 123456789012345678',
    messages[idType],
  ].join('\n');
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

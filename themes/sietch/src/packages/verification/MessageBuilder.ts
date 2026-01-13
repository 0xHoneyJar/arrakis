/**
 * MessageBuilder
 *
 * Constructs standardized EIP-191 signing messages for wallet verification.
 * Messages include community name, wallet address, Discord user, nonce, and timestamp.
 */

import type { MessageParams } from './types.js';

/**
 * Default message template with placeholders.
 * Uses human-readable format that clearly indicates:
 * - What the user is signing for
 * - That this is NOT a transaction
 * - Session-specific details (nonce, timestamp)
 */
const DEFAULT_TEMPLATE = `Welcome to {{communityName}}!

By signing this message, you are verifying that you own the wallet address:
{{walletAddress}}

This signature request is for Discord user: {{discordUsername}}

IMPORTANT: This signature does NOT authorize any blockchain transactions or transfer of funds. It only proves wallet ownership.

Session Details:
Nonce: {{nonce}}
Timestamp: {{timestamp}}`;

/**
 * Builds standardized signing messages for wallet verification.
 *
 * The message format follows best practices:
 * - Clear statement of purpose
 * - Explicit "no transaction" disclaimer
 * - Session-specific data to prevent replay attacks
 */
export class MessageBuilder {
  private readonly template: string;

  /**
   * Create a new MessageBuilder
   * @param customTemplate - Optional custom template with {{placeholder}} syntax
   */
  constructor(customTemplate?: string) {
    this.template = customTemplate ?? DEFAULT_TEMPLATE;
  }

  /**
   * Build a signing message with the given parameters
   *
   * @param params - Message parameters
   * @returns Formatted signing message
   */
  build(params: MessageParams): string {
    const { communityName, walletAddress, discordUsername, nonce, timestamp } = params;

    // Format timestamp in ISO format for consistency
    const formattedTimestamp = this.formatTimestamp(timestamp);

    return this.template
      .replace(/\{\{communityName\}\}/g, this.sanitize(communityName))
      .replace(/\{\{walletAddress\}\}/g, this.sanitize(walletAddress))
      .replace(/\{\{discordUsername\}\}/g, this.sanitize(discordUsername))
      .replace(/\{\{nonce\}\}/g, this.sanitize(nonce))
      .replace(/\{\{timestamp\}\}/g, formattedTimestamp);
  }

  /**
   * Build a message with custom template and parameters
   *
   * @param template - Custom template string with {{placeholder}} syntax
   * @param params - Key-value pairs for placeholder replacement
   * @returns Formatted message
   */
  buildCustom(template: string, params: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(placeholder, this.sanitize(value));
    }
    return result;
  }

  /**
   * Get the default template
   * @returns The default message template
   */
  getTemplate(): string {
    return this.template;
  }

  /**
   * Check if a message contains all required placeholders
   *
   * @param template - Template to validate
   * @returns List of missing placeholders (empty if all present)
   */
  validateTemplate(template: string): string[] {
    const required = ['communityName', 'walletAddress', 'discordUsername', 'nonce', 'timestamp'];
    const missing: string[] = [];

    for (const placeholder of required) {
      if (!template.includes(`{{${placeholder}}}`)) {
        missing.push(placeholder);
      }
    }

    return missing;
  }

  /**
   * Build a minimal message from nonce and discord username only.
   * Used for signature verification when the original message parameters
   * are not stored (wallet address is unknown until signature is submitted).
   *
   * Note: This builds a simpler message format for backward compatibility
   * with sessions that don't store full message context.
   *
   * @param nonce - Session nonce
   * @param discordUsername - Discord username
   * @returns Formatted signing message
   */
  buildFromNonce(nonce: string, discordUsername: string): string {
    // Build a simplified message that matches what we can reconstruct
    // from stored session data. The wallet address will be verified
    // against the signature's recovered address.
    return `Verify wallet ownership for Discord user: ${this.sanitize(discordUsername)}

This signature does NOT authorize any blockchain transactions.

Nonce: ${this.sanitize(nonce)}`;
  }

  /**
   * Extract nonce from a formatted message
   *
   * @param message - The formatted message
   * @returns The nonce value if found, undefined otherwise
   */
  extractNonce(message: string): string | undefined {
    const nonceMatch = message.match(/Nonce: ([^\n]+)/);
    return nonceMatch?.[1]?.trim();
  }

  /**
   * Extract wallet address from a formatted message
   *
   * @param message - The formatted message
   * @returns The wallet address if found, undefined otherwise
   */
  extractWalletAddress(message: string): string | undefined {
    const addressMatch = message.match(/wallet address:\s*\n?(0x[a-fA-F0-9]{40})/i);
    return addressMatch?.[1];
  }

  /**
   * Format a timestamp for the message
   *
   * @param date - Date to format
   * @returns ISO formatted timestamp
   */
  private formatTimestamp(date: Date): string {
    return date.toISOString();
  }

  /**
   * Sanitize user input to prevent injection
   * Removes control characters and trims whitespace
   *
   * @param value - Value to sanitize
   * @returns Sanitized value
   */
  private sanitize(value: string): string {
    // Remove control characters except newlines
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  }
}

/**
 * Export the default template for reference
 */
export { DEFAULT_TEMPLATE };

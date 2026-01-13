/**
 * Wallet Verification Types
 *
 * Type definitions for the native wallet verification package.
 * Supports EIP-191 signature verification for Discord wallet linking.
 */

import type { Address, Hex } from 'viem';

/**
 * Cryptographic nonce for verification sessions
 */
export interface Nonce {
  /** UUIDv4 nonce value */
  value: string;
  /** When the nonce was created */
  createdAt: Date;
  /** When the nonce expires */
  expiresAt: Date;
  /** Whether the nonce has been used */
  used: boolean;
}

/**
 * Result of signature verification
 */
export interface VerificationResult {
  /** Whether the signature is valid */
  valid: boolean;
  /** The address recovered from the signature (only if valid) */
  recoveredAddress?: Address;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Parameters for building a signing message
 */
export interface MessageParams {
  /** Name of the community */
  communityName: string;
  /** Wallet address being verified */
  walletAddress: string;
  /** Discord username of the verifying user */
  discordUsername: string;
  /** Session nonce */
  nonce: string;
  /** Session creation timestamp */
  timestamp: Date;
}

/**
 * Verification session status
 */
export type VerificationSessionStatus = 'pending' | 'completed' | 'expired' | 'failed';

/**
 * Verification session stored in the database
 */
export interface VerificationSession {
  /** Session UUID */
  id: string;
  /** Community UUID */
  communityId: string;
  /** Discord user ID */
  discordUserId: string;
  /** Discord guild/server ID */
  discordGuildId: string;
  /** Discord username at time of session creation */
  discordUsername: string;
  /** Cryptographic nonce for this session */
  nonce: string;
  /** Wallet address (set after verification) */
  walletAddress?: string;
  /** Session status */
  status: VerificationSessionStatus;
  /** When the session was created */
  createdAt: Date;
  /** When the session expires */
  expiresAt: Date;
  /** When verification completed (if applicable) */
  completedAt?: Date;
  /** Number of verification attempts */
  attempts: number;
  /** IP address of the verifying client */
  ipAddress?: string;
  /** User agent of the verifying client */
  userAgent?: string;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Parameters for creating a new verification session
 */
export interface CreateSessionParams {
  communityId: string;
  discordUserId: string;
  discordGuildId: string;
  discordUsername: string;
  nonce: string;
  expiresAt: Date;
}

/**
 * Result of creating a verification session
 */
export interface CreateSessionResult {
  session: VerificationSession;
  verifyUrl: string;
}

/**
 * Parameters for verifying a signature
 */
export interface VerifySignatureParams {
  sessionId: string;
  signature: Hex;
  walletAddress: Address;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Result of signature verification with eligibility info
 */
export interface VerifyResult {
  success: boolean;
  walletAddress?: string;
  eligible?: boolean;
  role?: string;
  error?: string;
}

/**
 * Audit event types for wallet verification
 */
export type VerificationAuditEvent =
  | 'wallet_verification_session_created'
  | 'wallet_verification_signature_submitted'
  | 'wallet_verification_completed'
  | 'wallet_verification_failed'
  | 'wallet_verification_expired'
  | 'wallet_verification_reset';

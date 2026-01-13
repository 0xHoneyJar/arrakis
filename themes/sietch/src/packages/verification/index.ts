/**
 * Wallet Verification Package
 *
 * Native wallet verification for Arrakis communities.
 * Implements EIP-191 signature verification for Discord wallet linking.
 *
 * @module packages/verification
 */

// Core classes
export { NonceManager } from './NonceManager.js';
export { SignatureVerifier } from './SignatureVerifier.js';
export { MessageBuilder, DEFAULT_TEMPLATE } from './MessageBuilder.js';

// Types
export type {
  Nonce,
  VerificationResult,
  MessageParams,
  VerificationSessionStatus,
  VerificationSession,
  CreateSessionParams,
  CreateSessionResult,
  VerifySignatureParams,
  VerifyResult,
  VerificationAuditEvent,
} from './types.js';

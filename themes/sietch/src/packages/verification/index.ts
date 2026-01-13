/**
 * Wallet Verification Package
 *
 * Native wallet verification for Arrakis communities.
 * Implements EIP-191 signature verification for Discord wallet linking.
 *
 * @module packages/verification
 */

// Core classes (Sprint 77)
export { NonceManager } from './NonceManager.js';
export { SignatureVerifier } from './SignatureVerifier.js';
export { MessageBuilder, DEFAULT_TEMPLATE } from './MessageBuilder.js';

// Session management (Sprint 78)
export { SessionManager } from './SessionManager.js';
export type {
  CreateSessionParams as SessionCreateParams,
  CreateSessionResult as SessionCreateResult,
  CompleteSessionParams,
  FailSessionParams,
  SessionManagerOptions,
} from './SessionManager.js';

// Orchestration service (Sprint 78)
export { WalletVerificationService } from './VerificationService.js';
export type {
  CreateVerificationSessionParams,
  CreateVerificationSessionResult,
  VerifySignatureParams as VerifyWalletSignatureParams,
  VerifySignatureResult,
  VerificationErrorCode,
  SessionInfo,
  VerificationAuditEventType,
  AuditEventCallback,
  WalletLinkCallback,
  VerificationServiceOptions,
} from './VerificationService.js';

// Types (Sprint 77)
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

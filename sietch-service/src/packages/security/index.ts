/**
 * Security Package - Kill Switch, MFA, Audit Logs & API Keys
 *
 * Sprint 47: Kill Switch & MFA for Arrakis SaaS
 * Sprint 50: Post-Audit Hardening (P0)
 *
 * @module packages/security
 */

// Types
export * from './types.js';

// MFA Service
export { MFAService, MFAError } from './MFAService.js';
export type { MFAServiceConfig } from './MFAService.js';

// Kill Switch Protocol
export { KillSwitchProtocol, KillSwitchError } from './KillSwitchProtocol.js';
export type { KillSwitchProtocolConfig } from './KillSwitchProtocol.js';

// Security Guard
export { NaibSecurityGuard, SecurityGuardError, DEFAULT_PROTECTED_OPERATIONS } from './NaibSecurityGuard.js';

// Audit Log Persistence (Sprint 50)
export { AuditLogPersistence, createAuditLogPersistence } from './AuditLogPersistence.js';
export type {
  AuditLogPersistenceConfig,
  AuditLogEntry,
  SignedAuditLogEntry,
  AuditLogQueryOptions,
  AuditLogQueryResult,
  ArchivalResult,
} from './AuditLogPersistence.js';

// API Key Manager (Sprint 50)
export { ApiKeyManager, createApiKeyManager } from './ApiKeyManager.js';
export type {
  ApiKeyManagerConfig,
  ApiKeyRecord,
  KeyRotationResult,
  KeyValidationResult,
} from './ApiKeyManager.js';

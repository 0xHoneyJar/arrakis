/**
 * Security Adapters Module
 *
 * Sprint S-22: Vault Integration & Kill Switch
 *
 * Exports:
 * - VaultClient - HashiCorp Vault Transit client
 * - KillSwitch - MFA-protected emergency shutdown
 * - MfaVerifier - TOTP-based MFA verification
 * - OAuthTokenEncryption - Discord OAuth token encryption
 * - WalletVerification - HSM-backed wallet challenge signing
 * - Metrics - Prometheus metrics for security operations
 */

// Vault Client
export {
  VaultClient,
  createVaultClient,
  type VaultClientOptions,
  type VaultHttpClient,
  type VaultResponse,
  type VaultHealthResponse,
  type AppRoleLoginResponse,
} from './vault-client.js';

// Kill Switch
export {
  KillSwitch,
  createKillSwitch,
  type KillSwitchOptions,
  type RedisClient,
  type NatsClient,
  type NotificationService,
} from './kill-switch.js';

// MFA Verifier
export {
  MfaVerifier,
  createMfaVerifier,
  type MfaVerifierOptions,
} from './mfa-verifier.js';

// OAuth Token Encryption
export {
  OAuthTokenEncryption,
  createOAuthTokenEncryption,
  type OAuthTokenEncryptionOptions,
} from './oauth-token-encryption.js';

// Wallet Verification
export {
  WalletVerification,
  createWalletVerification,
  type WalletVerificationOptions,
} from './wallet-verification.js';

// Metrics
export {
  type VaultMetrics,
  type CounterMetric,
  type GaugeMetric,
  type HistogramMetric,
  VAULT_METRIC_DEFINITIONS,
  createNoOpVaultMetrics,
  VaultMetricsHelper,
} from './metrics.js';

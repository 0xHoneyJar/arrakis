/**
 * Vault Client Port Interface
 *
 * Sprint S-22: Vault Integration & Kill Switch
 *
 * Defines the contract for HashiCorp Vault Transit operations:
 * - HSM-backed signing and verification
 * - Data encryption and decryption
 * - KV secrets management
 * - Key rotation
 *
 * @see SDD §6.4.2 Vault Client
 */

// =============================================================================
// Vault Configuration
// =============================================================================

/**
 * Configuration for Vault client.
 */
export interface VaultConfig {
  /** Vault server endpoint URL */
  endpoint: string;
  /** Static token for dev environments */
  token?: string;
  /** AppRole role_id for production auth */
  roleId?: string;
  /** AppRole secret_id for production auth */
  secretId?: string;
  /** Vault namespace (enterprise) */
  namespace?: string;
  /** Transit engine mount path */
  transitPath?: string;
  /** KV v2 engine mount path */
  kvPath?: string;
}

/**
 * Vault health status.
 */
export interface VaultHealthStatus {
  /** Whether Vault is sealed */
  sealed: boolean;
  /** Whether Vault is initialized */
  initialized: boolean;
  /** Vault version */
  version?: string;
  /** Cluster name */
  clusterName?: string;
}

/**
 * Transit key metadata.
 */
export interface TransitKeyInfo {
  /** Key name */
  name: string;
  /** Key type (e.g., 'ed25519', 'ecdsa-p256', 'aes256-gcm96') */
  type: string;
  /** Current key version */
  latestVersion: number;
  /** Minimum decryption version */
  minDecryptionVersion: number;
  /** Whether key supports encryption */
  supportsEncryption: boolean;
  /** Whether key supports decryption */
  supportsDecryption: boolean;
  /** Whether key supports signing */
  supportsSigning: boolean;
  /** Whether key is exportable */
  exportable: boolean;
  /** Whether key is deletable */
  deletionAllowed: boolean;
}

// =============================================================================
// Vault Client Interface
// =============================================================================

/**
 * IVaultClient port interface.
 *
 * Provides HSM-backed cryptographic operations via HashiCorp Vault Transit engine.
 * All operations are audited and use non-exportable keys.
 *
 * @see SDD §6.4.2
 */
export interface IVaultClient {
  // ===========================================================================
  // Transit Operations (HSM-backed)
  // ===========================================================================

  /**
   * Sign data using Transit engine.
   *
   * @param keyName - Transit key name
   * @param data - Data to sign (will be base64 encoded)
   * @returns Vault signature string (vault:v1:...)
   * @throws Error if signing fails
   */
  sign(keyName: string, data: string): Promise<string>;

  /**
   * Verify a signature using Transit engine.
   *
   * @param keyName - Transit key name
   * @param data - Original data that was signed
   * @param signature - Vault signature to verify
   * @returns True if signature is valid
   * @throws Error if verification fails
   */
  verify(keyName: string, data: string, signature: string): Promise<boolean>;

  /**
   * Encrypt data using Transit engine.
   *
   * @param keyName - Transit key name
   * @param plaintext - Data to encrypt
   * @returns Vault ciphertext string (vault:v1:...)
   * @throws Error if encryption fails
   */
  encrypt(keyName: string, plaintext: string): Promise<string>;

  /**
   * Decrypt data using Transit engine.
   *
   * @param keyName - Transit key name
   * @param ciphertext - Vault ciphertext to decrypt
   * @returns Original plaintext
   * @throws Error if decryption fails
   */
  decrypt(keyName: string, ciphertext: string): Promise<string>;

  /**
   * Rotate a Transit key.
   * Creates a new key version while keeping old versions for decryption.
   *
   * @param keyName - Transit key name
   * @throws Error if rotation fails
   */
  rotateKey(keyName: string): Promise<void>;

  /**
   * Get Transit key information.
   *
   * @param keyName - Transit key name
   * @returns Key metadata
   * @throws Error if key doesn't exist
   */
  getKeyInfo(keyName: string): Promise<TransitKeyInfo>;

  // ===========================================================================
  // KV v2 Secrets Operations
  // ===========================================================================

  /**
   * Get secret from KV v2 engine.
   *
   * @param path - Secret path
   * @returns Secret data as key-value pairs
   * @throws Error if secret doesn't exist
   */
  getSecret(path: string): Promise<Record<string, string>>;

  /**
   * Store secret in KV v2 engine.
   *
   * @param path - Secret path
   * @param data - Secret data as key-value pairs
   * @throws Error if write fails
   */
  putSecret(path: string, data: Record<string, string>): Promise<void>;

  /**
   * Delete secret from KV v2 engine.
   *
   * @param path - Secret path
   * @throws Error if deletion fails
   */
  deleteSecret(path: string): Promise<void>;

  // ===========================================================================
  // Health & Lifecycle
  // ===========================================================================

  /**
   * Check Vault health status.
   */
  health(): Promise<VaultHealthStatus>;

  /**
   * Renew the current token.
   * Should be called periodically for long-running services.
   */
  renewToken(): Promise<void>;

  /**
   * Revoke the current token.
   * Used during graceful shutdown.
   */
  revokeToken(): Promise<void>;
}

// =============================================================================
// Kill Switch Interface
// =============================================================================

/**
 * Kill switch state.
 */
export interface KillSwitchState {
  /** Whether kill switch is active */
  active: boolean;
  /** Admin who activated (if active) */
  activatedBy?: string;
  /** Activation timestamp (if active) */
  activatedAt?: Date;
  /** Reason for activation (if active) */
  reason?: string;
}

/**
 * Kill switch activation request.
 */
export interface KillSwitchRequest {
  /** Admin user ID requesting activation */
  adminId: string;
  /** MFA token for verification */
  mfaToken: string;
  /** Reason for activation */
  reason: string;
}

/**
 * IKillSwitch port interface.
 *
 * MFA-protected emergency shutdown mechanism that:
 * - Revokes signing permissions
 * - Pauses synthesis operations
 * - Broadcasts shutdown to all workers
 *
 * @see SDD §6.4.3
 */
export interface IKillSwitch {
  /**
   * Activate kill switch.
   * Requires MFA verification.
   *
   * @param request - Activation request with admin ID, MFA token, and reason
   * @throws Error if MFA verification fails
   */
  activate(request: KillSwitchRequest): Promise<void>;

  /**
   * Deactivate kill switch.
   * Requires MFA verification.
   *
   * @param adminId - Admin user ID
   * @param mfaToken - MFA token for verification
   * @throws Error if MFA verification fails
   */
  deactivate(adminId: string, mfaToken: string): Promise<void>;

  /**
   * Check if kill switch is currently active.
   */
  isActive(): Promise<boolean>;

  /**
   * Get current kill switch state.
   */
  getState(): Promise<KillSwitchState>;
}

// =============================================================================
// MFA Verification Interface
// =============================================================================

/**
 * MFA verification result.
 */
export interface MfaVerificationResult {
  /** Whether verification succeeded */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Timestamp of verification */
  verifiedAt: Date;
}

/**
 * IMfaVerifier port interface.
 *
 * Verifies TOTP tokens for kill switch activation.
 */
export interface IMfaVerifier {
  /**
   * Verify a TOTP token.
   *
   * @param userId - User ID to verify
   * @param token - 6-digit TOTP token
   * @returns Verification result
   */
  verify(userId: string, token: string): Promise<MfaVerificationResult>;

  /**
   * Generate a new TOTP secret for a user.
   *
   * @param userId - User ID
   * @returns Base32 encoded secret
   */
  generateSecret(userId: string): Promise<string>;

  /**
   * Get TOTP URI for QR code generation.
   *
   * @param userId - User ID
   * @param secret - Base32 encoded secret
   * @returns otpauth:// URI
   */
  getTotpUri(userId: string, secret: string): string;
}

// =============================================================================
// OAuth Token Encryption Interface
// =============================================================================

/**
 * Encrypted OAuth tokens.
 */
export interface EncryptedOAuthTokens {
  /** Encrypted access token */
  accessToken: string;
  /** Encrypted refresh token */
  refreshToken: string;
  /** Token type (e.g., 'Bearer') */
  tokenType: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Scope string */
  scope: string;
}

/**
 * Decrypted OAuth tokens.
 */
export interface DecryptedOAuthTokens {
  /** Plaintext access token */
  accessToken: string;
  /** Plaintext refresh token */
  refreshToken: string;
  /** Token type (e.g., 'Bearer') */
  tokenType: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Scope string */
  scope: string;
}

/**
 * IOAuthTokenEncryption port interface.
 *
 * Encrypts and decrypts Discord OAuth tokens using Vault Transit.
 * No plaintext tokens should be stored in the database.
 *
 * @see SDD §6.4.2 (S-22.4)
 */
export interface IOAuthTokenEncryption {
  /**
   * Encrypt OAuth tokens.
   *
   * @param tokens - Plaintext tokens to encrypt
   * @returns Encrypted tokens
   */
  encrypt(tokens: DecryptedOAuthTokens): Promise<EncryptedOAuthTokens>;

  /**
   * Decrypt OAuth tokens.
   *
   * @param tokens - Encrypted tokens to decrypt
   * @returns Plaintext tokens
   */
  decrypt(tokens: EncryptedOAuthTokens): Promise<DecryptedOAuthTokens>;
}

// =============================================================================
// Wallet Verification Interface
// =============================================================================

/**
 * Wallet verification challenge.
 */
export interface WalletChallenge {
  /** Challenge nonce */
  nonce: string;
  /** Challenge message to sign */
  message: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** HSM signature of challenge (for verification) */
  signature: string;
}

/**
 * IWalletVerification port interface.
 *
 * Creates HSM-backed challenges for wallet verification.
 * Prevents challenge replay and tampering.
 *
 * @see SDD §6.4.2 (S-22.5)
 */
export interface IWalletVerification {
  /**
   * Create a new wallet verification challenge.
   *
   * @param userId - User requesting verification
   * @param walletAddress - Wallet address to verify
   * @returns Signed challenge
   */
  createChallenge(userId: string, walletAddress: string): Promise<WalletChallenge>;

  /**
   * Verify a challenge signature.
   *
   * @param challenge - Original challenge
   * @returns True if challenge is valid and not expired
   */
  verifyChallenge(challenge: WalletChallenge): Promise<boolean>;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default Vault configuration.
 */
export const VAULT_CONFIG_DEFAULTS = {
  /** Default Transit engine path */
  TRANSIT_PATH: 'transit',
  /** Default KV v2 engine path */
  KV_PATH: 'secret',
  /** Token renewal threshold (renew when 50% TTL remaining) */
  TOKEN_RENEWAL_THRESHOLD: 0.5,
  /** Token renewal interval check (5 minutes) */
  TOKEN_RENEWAL_INTERVAL_MS: 5 * 60 * 1000,
} as const;

/**
 * Vault Transit key names.
 */
export const VAULT_KEY_NAMES = {
  /** Key for signing wallet verification challenges */
  WALLET_VERIFICATION: 'arrakis-wallet-verification',
  /** Key for encrypting OAuth tokens */
  OAUTH_TOKENS: 'arrakis-oauth-tokens',
  /** Key for service-to-service signing */
  SERVICE_SIGNING: 'arrakis-service-signing',
  /** Key for sensitive config encryption */
  CONFIG_ENCRYPTION: 'arrakis-config-encryption',
} as const;

/**
 * Kill switch Redis keys.
 */
export const KILL_SWITCH_KEYS = {
  /** Kill switch state key */
  STATE: 'arrakis:killswitch:active',
  /** Synthesis pause key */
  SYNTHESIS_PAUSED: 'synthesis:paused',
} as const;

/**
 * Vault metrics prefix.
 */
export const VAULT_METRICS_PREFIX = 'arrakis_vault_' as const;

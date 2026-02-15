/**
 * Identity Trust Configuration
 *
 * Graduated trust model for billing operations:
 * - Below threshold: basic auth sufficient
 * - Above threshold: identity anchor required
 * - Feature flag disabled: all operations pass regardless
 *
 * Sprint refs: Task 3.1
 *
 * @module packages/core/protocol/identity-trust
 */

// =============================================================================
// Configuration
// =============================================================================

export interface IdentityTrustConfig {
  /** Master feature flag — when false, all checks are skipped */
  enabled: boolean;
  /** Micro-USD threshold above which anchor is required */
  highValueThresholdMicro: bigint;
  /** Whether to require anchor above threshold (vs advisory-only) */
  requireAnchorAboveThreshold: boolean;
}

/** Default configuration — feature flag OFF for backward compatibility */
export const DEFAULT_IDENTITY_TRUST: IdentityTrustConfig = {
  enabled: false,
  highValueThresholdMicro: 100_000_000n, // $100 USD
  requireAnchorAboveThreshold: true,
};

// =============================================================================
// Check Result
// =============================================================================

export interface IdentityCheckResult {
  /** Whether the operation is allowed to proceed */
  allowed: boolean;
  /** If not allowed, the denial reason code */
  reason?: string;
  /** Whether identity was actually checked (false if feature flag off or below threshold) */
  checked: boolean;
}

// =============================================================================
// Identity Check Logic
// =============================================================================

/**
 * Evaluate whether an operation should be allowed based on identity trust.
 *
 * @param config - Trust configuration
 * @param amountMicro - Operation amount in micro-USD
 * @param hasAnchor - Whether the account has a stored identity anchor
 * @param isPurchaseRoute - Whether this is a credit pack purchase (exempt)
 */
export function evaluateIdentityTrust(
  config: IdentityTrustConfig,
  amountMicro: bigint,
  hasAnchor: boolean,
  isPurchaseRoute = false,
): IdentityCheckResult {
  // Feature flag off — always allow
  if (!config.enabled) {
    return { allowed: true, checked: false };
  }

  // Purchase routes are exempt from anchor check
  if (isPurchaseRoute) {
    return { allowed: true, checked: false };
  }

  // Below threshold — basic auth sufficient
  if (amountMicro <= config.highValueThresholdMicro) {
    return { allowed: true, checked: false };
  }

  // Above threshold — anchor required
  if (!hasAnchor && config.requireAnchorAboveThreshold) {
    return {
      allowed: false,
      reason: 'identity_anchor_required_for_high_value',
      checked: true,
    };
  }

  return { allowed: true, checked: true };
}

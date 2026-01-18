/**
 * IFeatureGate Interface
 *
 * Sprint S-25: Shadow Sync Job & Verification Tiers
 *
 * Port interface for feature gating based on verification tiers.
 * Enforces tier-based access control at the service layer.
 *
 * @see SDD §7.1 Shadow Mode Architecture
 */

import type { Feature, VerificationTier, FeatureSet } from '../domain/verification-tiers.js';

// =============================================================================
// Feature Gate Types
// =============================================================================

/**
 * Result of a feature access check.
 */
export interface FeatureAccessResult {
  /** Whether access is granted */
  allowed: boolean;
  /** Current verification tier */
  currentTier: VerificationTier;
  /** Minimum tier required for feature */
  requiredTier: VerificationTier | null;
  /** Reason for denial (if not allowed) */
  denialReason?: string;
  /** Upgrade path suggestion */
  upgradeSuggestion?: string;
}

/**
 * Context for feature access check.
 */
export interface FeatureAccessContext {
  /** Community ID */
  communityId: string;
  /** Discord guild ID */
  guildId: string;
  /** User ID (optional, for user-level feature checks) */
  userId?: string;
  /** Feature being checked */
  feature: Feature;
}

/**
 * Feature gate configuration override.
 */
export interface FeatureOverride {
  /** Community ID */
  communityId: string;
  /** Feature being overridden */
  feature: Feature;
  /** Override action */
  action: 'allow' | 'deny';
  /** Reason for override */
  reason: string;
  /** When override expires (null = never) */
  expiresAt: Date | null;
  /** Who created the override */
  createdBy: string;
  /** When override was created */
  createdAt: Date;
}

// =============================================================================
// IFeatureGate Interface
// =============================================================================

/**
 * Port interface for feature gating.
 */
export interface IFeatureGate {
  // ===========================================================================
  // Access Control
  // ===========================================================================

  /**
   * Check if a feature is accessible for a community.
   *
   * @param context - Feature access context
   * @returns Access result with tier info
   */
  checkAccess(context: FeatureAccessContext): Promise<FeatureAccessResult>;

  /**
   * Check if multiple features are accessible.
   * More efficient than checking one at a time.
   *
   * @param communityId - Community ID
   * @param features - Features to check
   * @returns Map of feature to access result
   */
  checkMultiple(
    communityId: string,
    features: Feature[]
  ): Promise<Map<Feature, FeatureAccessResult>>;

  /**
   * Guard method that throws if feature is not accessible.
   * Use in service methods to enforce access control.
   *
   * @param context - Feature access context
   * @throws FeatureAccessDeniedError if not accessible
   */
  requireAccess(context: FeatureAccessContext): Promise<void>;

  // ===========================================================================
  // Tier Operations
  // ===========================================================================

  /**
   * Get current verification tier for a community.
   *
   * @param communityId - Community ID
   * @returns Current tier or null if not found
   */
  getTier(communityId: string): Promise<VerificationTier | null>;

  /**
   * Get feature set for a tier.
   *
   * @param tier - Verification tier
   * @returns Feature set definition
   */
  getFeatureSet(tier: VerificationTier): FeatureSet;

  /**
   * Get all features available for a community based on current tier.
   *
   * @param communityId - Community ID
   * @returns Array of available features
   */
  getAvailableFeatures(communityId: string): Promise<Feature[]>;

  /**
   * Get features locked for a community (available at higher tiers).
   *
   * @param communityId - Community ID
   * @returns Array of locked features with required tier
   */
  getLockedFeatures(communityId: string): Promise<Array<{
    feature: Feature;
    requiredTier: VerificationTier;
  }>>;

  // ===========================================================================
  // Override Management
  // ===========================================================================

  /**
   * Add a feature override for a community.
   * Allows granting or denying features regardless of tier.
   *
   * @param override - Override configuration
   * @returns Created override
   */
  addOverride(override: Omit<FeatureOverride, 'createdAt'>): Promise<FeatureOverride>;

  /**
   * Remove a feature override.
   *
   * @param communityId - Community ID
   * @param feature - Feature to remove override for
   * @returns True if override was removed
   */
  removeOverride(communityId: string, feature: Feature): Promise<boolean>;

  /**
   * Get all overrides for a community.
   *
   * @param communityId - Community ID
   * @returns Array of active overrides
   */
  getOverrides(communityId: string): Promise<FeatureOverride[]>;

  /**
   * Clean up expired overrides.
   *
   * @returns Number of overrides removed
   */
  cleanupExpiredOverrides(): Promise<number>;

  // ===========================================================================
  // Middleware Support
  // ===========================================================================

  /**
   * Create middleware function for Express/Koa style handlers.
   * Injects feature gate into context for easy access.
   *
   * @param feature - Feature to require
   * @returns Middleware function
   */
  createMiddleware(feature: Feature): FeatureGateMiddleware;
}

/**
 * Middleware function type for feature gating.
 */
export type FeatureGateMiddleware = (
  communityId: string,
  guildId: string,
  next: () => Promise<void>
) => Promise<void>;

// =============================================================================
// Errors
// =============================================================================

/**
 * Error thrown when feature access is denied.
 */
export class FeatureAccessDeniedError extends Error {
  readonly feature: Feature;
  readonly currentTier: VerificationTier;
  readonly requiredTier: VerificationTier | null;

  constructor(
    feature: Feature,
    currentTier: VerificationTier,
    requiredTier: VerificationTier | null,
    message?: string
  ) {
    super(message ?? `Feature '${feature}' requires tier '${requiredTier}', current tier is '${currentTier}'`);
    this.name = 'FeatureAccessDeniedError';
    this.feature = feature;
    this.currentTier = currentTier;
    this.requiredTier = requiredTier;
  }
}

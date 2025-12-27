/**
 * =============================================================================
 * SIETCH UNIFIED - GATEKEEPER SERVICE
 * =============================================================================
 * 
 * The Gatekeeper service is responsible for checking if a community/user has
 * access to specific features based on their subscription tier and payment status.
 * 
 * Flow:
 * 1. Check AccountKit for identity verification
 * 2. Check Redis cache for entitlements (fast path)
 * 3. Fall back to PostgreSQL for cache miss
 * 4. Apply grace period logic
 * 5. Return access decision with context
 * 
 * This service sits between all feature requests and the actual feature logic.
 * 
 * @module services/billing/gatekeeper.service
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import Stripe from 'stripe';
import { CollabLandClient } from '../collabland/collabland-client.service';
import { loadConfig } from '../../utils/config';

// =============================================================================
// TYPES
// =============================================================================

export type TierName = 'starter' | 'basic' | 'premium' | 'exclusive' | 'elite' | 'enterprise';

export type Feature = 
  | 'basic_tgrs'
  | 'background_checks'
  | 'role_composition'
  | 'conviction_engine'
  | 'member_directory'
  | 'pro_miniapps'
  | 'priority_support'
  | 'custom_branding'
  | 'ai_quiz_agent'
  | 'white_label'
  | 'naib_tier_access'
  | 'fedaykin_tier_access'
  | 'stillsuit_channels';

export interface AccessResult {
  allowed: boolean;
  reason: AccessReason;
  tier: TierName;
  graceRemaining?: number; // seconds
  upgradeRequired?: TierName;
  upgradeUrl?: string;
}

export type AccessReason = 
  | 'tier_sufficient'
  | 'grace_period_active'
  | 'tier_insufficient'
  | 'subscription_expired'
  | 'member_limit_exceeded'
  | 'feature_disabled'
  | 'identity_not_verified'
  | 'fee_waiver_active';  // NEW

export interface Entitlement {
  communityId: string;
  tier: TierName;
  tierSource: 'waiver' | 'subscription' | 'boosts' | 'free';  // NEW
  features: Feature[];
  limits: {
    verifiedMembers: number;
    tgrs: number;
    adminBalanceChecks: number;
  };
  subscription: {
    id: string;
    status: 'active' | 'past_due' | 'cancelled' | 'trialing';
    currentPeriodEnd: Date;
    graceUntil?: Date;
  } | null;
  waiver?: {  // NEW
    id: string;
    reason: string;
    grantedBy: string;
    expiresAt?: Date;
  };
  boosts?: {  // NEW
    totalBoosts: number;
    boostLevel: number;
    activeBoosterCount: number;
  };
  cached: boolean;
  cachedAt?: Date;
}

interface TierConfig {
  name: string;
  limits: {
    verified_members: number;
    tgrs: number;
    admin_balance_checks_monthly: number;
  };
  features: Record<string, boolean>;
  grace_period_hours: number;
}

// =============================================================================
// TIER HIERARCHY
// =============================================================================

const TIER_HIERARCHY: Record<TierName, number> = {
  starter: 0,
  basic: 1,
  premium: 2,
  exclusive: 3,
  elite: 4,
  enterprise: 5,
};

const FEATURE_MINIMUM_TIER: Record<Feature, TierName> = {
  basic_tgrs: 'starter',
  background_checks: 'basic',
  role_composition: 'premium',
  conviction_engine: 'premium',
  member_directory: 'premium',
  pro_miniapps: 'premium',
  priority_support: 'premium',
  custom_branding: 'exclusive',
  ai_quiz_agent: 'elite',
  white_label: 'enterprise',
  naib_tier_access: 'premium',
  fedaykin_tier_access: 'premium',
  stillsuit_channels: 'exclusive',
};

// =============================================================================
// GATEKEEPER SERVICE
// =============================================================================

export class GatekeeperService {
  private prisma: PrismaClient;
  private redis: Redis;
  private stripe: Stripe;
  private collabland: CollabLandClient;
  private tierConfig: Record<TierName, TierConfig>;

  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'entitlement:';

  constructor(deps: {
    prisma: PrismaClient;
    redis: Redis;
    stripe: Stripe;
    collabland: CollabLandClient;
  }) {
    this.prisma = deps.prisma;
    this.redis = deps.redis;
    this.stripe = deps.stripe;
    this.collabland = deps.collabland;
    
    // Load tier configuration
    this.tierConfig = this.loadTierConfig();
  }

  /**
   * Check if a community has access to a specific feature.
   * This is the main entry point for all feature gates.
   */
  async checkAccess(communityId: string, feature: Feature): Promise<AccessResult> {
    // 1. Get entitlements (cached or fresh)
    const entitlement = await this.getEntitlement(communityId);
    
    if (!entitlement) {
      return {
        allowed: false,
        reason: 'identity_not_verified',
        tier: 'starter',
        upgradeUrl: 'https://cc.collab.land',
      };
    }

    // 2. Check tier hierarchy
    const requiredTier = FEATURE_MINIMUM_TIER[feature];
    const hasTier = TIER_HIERARCHY[entitlement.tier] >= TIER_HIERARCHY[requiredTier];

    // 3. Check if feature is explicitly enabled
    const featureEnabled = entitlement.features.includes(feature);

    // 4. Check for fee waiver (complimentary access)
    if (entitlement.waiver && hasTier && featureEnabled) {
      return {
        allowed: true,
        reason: 'fee_waiver_active',
        tier: entitlement.tier,
      };
    }

    // 5. Apply grace period logic
    const now = new Date();
    const inGracePeriod = entitlement.subscription?.graceUntil 
      && entitlement.subscription.graceUntil > now;

    // 6. Make decision
    if (hasTier && featureEnabled) {
      return {
        allowed: true,
        reason: 'tier_sufficient',
        tier: entitlement.tier,
      };
    }

    if (inGracePeriod && featureEnabled) {
      const graceRemaining = Math.floor(
        (entitlement.subscription!.graceUntil!.getTime() - now.getTime()) / 1000
      );
      return {
        allowed: true,
        reason: 'grace_period_active',
        tier: entitlement.tier,
        graceRemaining,
      };
    }

    return {
      allowed: false,
      reason: hasTier ? 'feature_disabled' : 'tier_insufficient',
      tier: entitlement.tier,
      upgradeRequired: requiredTier,
      upgradeUrl: `https://cc.collab.land/pricing?upgrade=${requiredTier}`,
    };
  }

  /**
   * Check if a community has room for more verified members.
   */
  async checkMemberLimit(communityId: string, currentCount: number): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    warningThreshold: boolean;
  }> {
    const entitlement = await this.getEntitlement(communityId);
    
    if (!entitlement) {
      return {
        allowed: currentCount < 25,
        limit: 25,
        remaining: Math.max(0, 25 - currentCount),
        warningThreshold: currentCount >= 20,
      };
    }

    const limit = entitlement.limits.verifiedMembers;
    const unlimited = limit === -1;
    
    return {
      allowed: unlimited || currentCount < limit,
      limit: unlimited ? Infinity : limit,
      remaining: unlimited ? Infinity : Math.max(0, limit - currentCount),
      warningThreshold: !unlimited && currentCount >= limit * 0.8,
    };
  }

  /**
   * Get the subscription tier for a community.
   */
  async getSubscriptionTier(communityId: string): Promise<TierName> {
    const entitlement = await this.getEntitlement(communityId);
    return entitlement?.tier ?? 'starter';
  }

  /**
   * Check if a specific feature is enabled for a community.
   */
  async isFeatureEnabled(communityId: string, feature: Feature): Promise<boolean> {
    const result = await this.checkAccess(communityId, feature);
    return result.allowed;
  }

  /**
   * Get remaining grace period in seconds.
   */
  async getRemainingGracePeriod(communityId: string): Promise<number> {
    const entitlement = await this.getEntitlement(communityId);
    
    if (!entitlement?.subscription?.graceUntil) {
      return 0;
    }

    const now = new Date();
    const remaining = entitlement.subscription.graceUntil.getTime() - now.getTime();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Get full entitlement data for a community.
   * Priority: Fee Waiver > Subscription > Free Tier
   * Uses Redis cache with PostgreSQL fallback.
   */
  async getEntitlement(communityId: string): Promise<Entitlement | null> {
    // 1. Check Redis cache
    const cacheKey = `${this.CACHE_PREFIX}${communityId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      const entitlement = JSON.parse(cached) as Entitlement;
      entitlement.cached = true;
      return entitlement;
    }

    // 2. Check for active fee waiver FIRST (owner-granted complimentary access)
    const waiver = await this.prisma.feeWaiver.findUnique({
      where: { communityId },
    });

    if (waiver && waiver.isActive) {
      // Check if waiver has expired
      if (waiver.expiresAt && waiver.expiresAt < new Date()) {
        // Waiver expired - mark as inactive
        await this.prisma.feeWaiver.update({
          where: { id: waiver.id },
          data: { isActive: false },
        });
      } else {
        // Active waiver - return full access based on waiver tier
        const tier = waiver.tier as TierName;
        const tierConfig = this.tierConfig[tier];
        
        const waiverEntitlement: Entitlement = {
          communityId,
          tier,
          tierSource: 'waiver',
          features: Object.entries(tierConfig.features)
            .filter(([_, enabled]) => enabled)
            .map(([feature]) => feature as Feature),
          limits: {
            verifiedMembers: tierConfig.limits.verified_members,
            tgrs: tierConfig.limits.tgrs,
            adminBalanceChecks: tierConfig.limits.admin_balance_checks_monthly,
          },
          subscription: null,
          waiver: {
            id: waiver.id,
            reason: waiver.reason,
            grantedBy: waiver.grantedBy,
            expiresAt: waiver.expiresAt ?? undefined,
          },
          cached: false,
          cachedAt: new Date(),
        };

        // Cache the waiver entitlement
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(waiverEntitlement));
        return waiverEntitlement;
      }
    }

    // 3. No waiver - check subscription AND boosts, use highest tier
    const subscription = await this.prisma.communitySubscription.findUnique({
      where: { communityId },
    });

    // 3b. Check community boosts
    const boostLevel = await this.prisma.communityBoostLevel.findUnique({
      where: { communityId },
    });

    // Determine effective tier (highest of subscription vs boosts)
    const subscriptionTier = subscription?.tier as TierName | undefined;
    const boostTier = boostLevel?.effectiveTier as TierName | undefined;
    
    let effectiveTier: TierName = 'starter';
    let tierSource: 'subscription' | 'boosts' | 'free' = 'free';

    if (subscriptionTier && boostTier) {
      // Both exist - use higher tier
      const subLevel = TIER_HIERARCHY[subscriptionTier];
      const boostLevelVal = TIER_HIERARCHY[boostTier];
      if (subLevel >= boostLevelVal) {
        effectiveTier = subscriptionTier;
        tierSource = 'subscription';
      } else {
        effectiveTier = boostTier;
        tierSource = 'boosts';
      }
    } else if (subscriptionTier) {
      effectiveTier = subscriptionTier;
      tierSource = 'subscription';
    } else if (boostTier && boostLevel && boostLevel.totalBoosts > 0) {
      effectiveTier = boostTier;
      tierSource = 'boosts';
    }

    if (tierSource === 'free') {
      // No subscription and no boosts = free tier
      const freeEntitlement: Entitlement = {
        communityId,
        tier: 'starter',
        tierSource: 'free',
        features: ['basic_tgrs'],
        limits: {
          verifiedMembers: 25,
          tgrs: 10,
          adminBalanceChecks: 0,
        },
        subscription: null,
        cached: false,
      };
      
      // Cache free tier too
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(freeEntitlement));
      return freeEntitlement;
    }

    // 4. Build entitlement from effective tier
    const tierConfig = this.tierConfig[effectiveTier];
    
    const entitlement: Entitlement = {
      communityId,
      tier: effectiveTier,
      tierSource,
      features: Object.entries(tierConfig.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature]) => feature as Feature),
      limits: {
        verifiedMembers: tierConfig.limits.verified_members,
        tgrs: tierConfig.limits.tgrs,
        adminBalanceChecks: tierConfig.limits.admin_balance_checks_monthly,
      },
      subscription: subscription ? {
        id: subscription.stripeSubscriptionId,
        status: subscription.status as 'active' | 'past_due' | 'cancelled' | 'trialing',
        currentPeriodEnd: subscription.currentPeriodEnd,
        graceUntil: subscription.graceUntil ?? undefined,
      } : null,
      boosts: boostLevel && boostLevel.totalBoosts > 0 ? {
        totalBoosts: boostLevel.totalBoosts,
        boostLevel: boostLevel.boostLevel,
        activeBoosterCount: boostLevel.activeBoosterCount,
      } : undefined,
      cached: false,
      cachedAt: new Date(),
    };

    // 5. Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(entitlement));

    return entitlement;
  }

  /**
   * Invalidate cached entitlements for a community.
   * Call this after subscription changes.
   */
  async invalidateCache(communityId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${communityId}`;
    await this.redis.del(cacheKey);
  }

  /**
   * Handle Stripe webhook for subscription updates.
   * Updates local state and invalidates cache.
   */
  async handleSubscriptionUpdate(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const communityId = subscription.metadata.communityId;

    if (!communityId) {
      console.warn('Subscription missing communityId metadata:', subscription.id);
      return;
    }

    const tierConfig = this.getTierFromPriceId(subscription.items.data[0].price.id);
    
    switch (event.type) {
      case 'invoice.paid':
        await this.prisma.communitySubscription.update({
          where: { communityId },
          data: {
            status: 'active',
            graceUntil: null,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;

      case 'invoice.payment_failed':
        const gracePeriodHours = this.tierConfig[tierConfig]?.grace_period_hours ?? 24;
        const graceUntil = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);
        
        await this.prisma.communitySubscription.update({
          where: { communityId },
          data: {
            status: 'past_due',
            graceUntil,
          },
        });
        break;

      case 'customer.subscription.deleted':
        await this.prisma.communitySubscription.update({
          where: { communityId },
          data: {
            status: 'cancelled',
            tier: 'starter',
            graceUntil: null,
          },
        });
        break;

      case 'customer.subscription.updated':
        await this.prisma.communitySubscription.update({
          where: { communityId },
          data: {
            tier: tierConfig,
            status: subscription.status === 'active' ? 'active' : subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;
    }

    // Always invalidate cache after any subscription change
    await this.invalidateCache(communityId);
  }

  /**
   * Start a grace period for a community.
   * Called when payment fails.
   */
  async startGracePeriod(communityId: string): Promise<Date> {
    const tier = await this.getSubscriptionTier(communityId);
    const gracePeriodHours = this.tierConfig[tier]?.grace_period_hours ?? 24;
    const graceUntil = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);

    await this.prisma.communitySubscription.update({
      where: { communityId },
      data: {
        status: 'past_due',
        graceUntil,
      },
    });

    await this.invalidateCache(communityId);
    return graceUntil;
  }

  /**
   * Get Stripe Customer Portal URL for self-service management.
   */
  async getCustomerPortalUrl(communityId: string, returnUrl: string): Promise<string | null> {
    const subscription = await this.prisma.communitySubscription.findUnique({
      where: { communityId },
    });

    if (!subscription?.stripeCustomerId) {
      return null;
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  // ===========================================================================
  // FEE WAIVER MANAGEMENT (Owner Only)
  // ===========================================================================

  /**
   * Grant a fee waiver to a community (complimentary access).
   * Only the platform owner should call this.
   */
  async grantWaiver(params: {
    communityId: string;
    tier?: TierName;
    reason: string;
    grantedBy: string;
    expiresAt?: Date;
    internalNotes?: string;
  }): Promise<{ id: string; tier: TierName; expiresAt?: Date }> {
    const { communityId, tier = 'enterprise', reason, grantedBy, expiresAt, internalNotes } = params;

    // Check if waiver already exists
    const existing = await this.prisma.feeWaiver.findUnique({
      where: { communityId },
    });

    if (existing && existing.isActive) {
      throw new Error('Active waiver already exists for this community');
    }

    // Create or reactivate waiver
    const waiver = existing
      ? await this.prisma.feeWaiver.update({
          where: { id: existing.id },
          data: {
            tier,
            reason,
            grantedBy,
            expiresAt,
            internalNotes,
            isActive: true,
            revokedAt: null,
            revokedBy: null,
            revocationReason: null,
          },
        })
      : await this.prisma.feeWaiver.create({
          data: {
            communityId,
            tier,
            reason,
            grantedBy,
            expiresAt,
            internalNotes,
          },
        });

    // Log the action
    await this.prisma.auditLog.create({
      data: {
        action: 'fee_waiver_granted',
        actor: grantedBy,
        metadata: {
          communityId,
          waiverId: waiver.id,
          tier,
          reason,
          expiresAt: expiresAt?.toISOString(),
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(communityId);

    return {
      id: waiver.id,
      tier: waiver.tier as TierName,
      expiresAt: waiver.expiresAt ?? undefined,
    };
  }

  /**
   * Revoke a fee waiver from a community.
   */
  async revokeWaiver(params: {
    communityId: string;
    revokedBy: string;
    reason: string;
  }): Promise<void> {
    const { communityId, revokedBy, reason } = params;

    const waiver = await this.prisma.feeWaiver.findUnique({
      where: { communityId },
    });

    if (!waiver) {
      throw new Error('No waiver found for this community');
    }

    if (!waiver.isActive) {
      throw new Error('Waiver is already inactive');
    }

    await this.prisma.feeWaiver.update({
      where: { id: waiver.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
        revocationReason: reason,
      },
    });

    // Log the action
    await this.prisma.auditLog.create({
      data: {
        action: 'fee_waiver_revoked',
        actor: revokedBy,
        metadata: {
          communityId,
          waiverId: waiver.id,
          reason,
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(communityId);
  }

  /**
   * List all active fee waivers.
   */
  async listWaivers(params?: {
    includeExpired?: boolean;
    includeRevoked?: boolean;
  }): Promise<Array<{
    id: string;
    communityId: string;
    tier: TierName;
    reason: string;
    grantedBy: string;
    expiresAt?: Date;
    isActive: boolean;
    createdAt: Date;
  }>> {
    const { includeExpired = false, includeRevoked = false } = params ?? {};

    const where: any = {};
    
    if (!includeRevoked) {
      where.isActive = true;
    }
    
    if (!includeExpired) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    const waivers = await this.prisma.feeWaiver.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return waivers.map(w => ({
      id: w.id,
      communityId: w.communityId,
      tier: w.tier as TierName,
      reason: w.reason,
      grantedBy: w.grantedBy,
      expiresAt: w.expiresAt ?? undefined,
      isActive: w.isActive,
      createdAt: w.createdAt,
    }));
  }

  /**
   * Get waiver details for a specific community.
   */
  async getWaiver(communityId: string): Promise<{
    id: string;
    tier: TierName;
    reason: string;
    grantedBy: string;
    expiresAt?: Date;
    internalNotes?: string;
    isActive: boolean;
    createdAt: Date;
  } | null> {
    const waiver = await this.prisma.feeWaiver.findUnique({
      where: { communityId },
    });

    if (!waiver) return null;

    return {
      id: waiver.id,
      tier: waiver.tier as TierName,
      reason: waiver.reason,
      grantedBy: waiver.grantedBy,
      expiresAt: waiver.expiresAt ?? undefined,
      internalNotes: waiver.internalNotes ?? undefined,
      isActive: waiver.isActive,
      createdAt: waiver.createdAt,
    };
  }

  /**
   * Check if a community has an active fee waiver.
   */
  async hasActiveWaiver(communityId: string): Promise<boolean> {
    const waiver = await this.prisma.feeWaiver.findUnique({
      where: { communityId },
    });

    if (!waiver || !waiver.isActive) return false;
    
    // Check expiration
    if (waiver.expiresAt && waiver.expiresAt < new Date()) {
      // Mark as expired
      await this.prisma.feeWaiver.update({
        where: { id: waiver.id },
        data: { isActive: false },
      });
      await this.invalidateCache(communityId);
      return false;
    }

    return true;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private loadTierConfig(): Record<TierName, TierConfig> {
    // In production, load from config/subscription-tiers.yaml
    // For now, return hardcoded defaults
    return {
      starter: {
        name: 'Starter',
        limits: { verified_members: 25, tgrs: 10, admin_balance_checks_monthly: 0 },
        features: { basic_tgrs: true },
        grace_period_hours: 0,
      },
      basic: {
        name: 'Basic',
        limits: { verified_members: 500, tgrs: 50, admin_balance_checks_monthly: 0 },
        features: { basic_tgrs: true, background_checks: true },
        grace_period_hours: 24,
      },
      premium: {
        name: 'Premium',
        limits: { verified_members: 1000, tgrs: 100, admin_balance_checks_monthly: 0 },
        features: {
          basic_tgrs: true,
          background_checks: true,
          role_composition: true,
          conviction_engine: true,
          member_directory: true,
          pro_miniapps: true,
          priority_support: true,
          naib_tier_access: true,
          fedaykin_tier_access: true,
        },
        grace_period_hours: 24,
      },
      exclusive: {
        name: 'Exclusive',
        limits: { verified_members: 2500, tgrs: 250, admin_balance_checks_monthly: 5 },
        features: {
          basic_tgrs: true,
          background_checks: true,
          role_composition: true,
          conviction_engine: true,
          member_directory: true,
          pro_miniapps: true,
          priority_support: true,
          custom_branding: true,
          naib_tier_access: true,
          fedaykin_tier_access: true,
          stillsuit_channels: true,
        },
        grace_period_hours: 48,
      },
      elite: {
        name: 'Elite',
        limits: { verified_members: 7500, tgrs: 500, admin_balance_checks_monthly: 20 },
        features: {
          basic_tgrs: true,
          background_checks: true,
          role_composition: true,
          conviction_engine: true,
          member_directory: true,
          pro_miniapps: true,
          priority_support: true,
          custom_branding: true,
          ai_quiz_agent: true,
          naib_tier_access: true,
          fedaykin_tier_access: true,
          stillsuit_channels: true,
        },
        grace_period_hours: 72,
      },
      enterprise: {
        name: 'Enterprise',
        limits: { verified_members: -1, tgrs: -1, admin_balance_checks_monthly: -1 },
        features: {
          basic_tgrs: true,
          background_checks: true,
          role_composition: true,
          conviction_engine: true,
          member_directory: true,
          pro_miniapps: true,
          priority_support: true,
          custom_branding: true,
          ai_quiz_agent: true,
          white_label: true,
          naib_tier_access: true,
          fedaykin_tier_access: true,
          stillsuit_channels: true,
        },
        grace_period_hours: 168,
      },
    };
  }

  private getTierFromPriceId(priceId: string): TierName {
    // Map Stripe price IDs to tier names
    // In production, load from config
    const priceToTier: Record<string, TierName> = {
      'price_basic_monthly': 'basic',
      'price_basic_yearly': 'basic',
      'price_premium_monthly': 'premium',
      'price_premium_yearly': 'premium',
      'price_exclusive_monthly': 'exclusive',
      'price_exclusive_yearly': 'exclusive',
      'price_elite_monthly': 'elite',
      'price_elite_yearly': 'elite',
    };

    return priceToTier[priceId] ?? 'starter';
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let gatekeeperInstance: GatekeeperService | null = null;

export function getGatekeeperService(deps: {
  prisma: PrismaClient;
  redis: Redis;
  stripe: Stripe;
  collabland: CollabLandClient;
}): GatekeeperService {
  if (!gatekeeperInstance) {
    gatekeeperInstance = new GatekeeperService(deps);
  }
  return gatekeeperInstance;
}

/**
 * =============================================================================
 * SIETCH UNIFIED - COMMUNITY BOOST SERVICE
 * =============================================================================
 * 
 * Discord-style community boosting where members collectively fund features.
 * Individual users purchase boosts ($2.99/month each) to unlock higher tiers
 * for the entire community.
 * 
 * Boost Levels:
 * - Level 0: 0 boosts     → Starter tier
 * - Level 1: 2 boosts     → Basic tier
 * - Level 2: 7 boosts     → Premium tier  
 * - Level 3: 14 boosts    → Exclusive tier
 * - Level 4: 30 boosts    → Elite tier
 * 
 * Tier Priority: Fee Waiver > Direct Subscription > Boosts > Free
 * 
 * @module services/billing/boost.service
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import Stripe from 'stripe';
import type { TierName } from './gatekeeper.service';

// =============================================================================
// TYPES
// =============================================================================

export interface BoostLevel {
  level: number;
  name: string;
  requiredBoosts: number;
  effectiveTier: TierName;
  perks: string[];
}

export interface CommunityBoostStatus {
  communityId: string;
  totalBoosts: number;
  activeBoosterCount: number;
  currentLevel: BoostLevel;
  nextLevel: BoostLevel | null;
  boostsToNextLevel: number;
  effectiveTier: TierName;
  topBoosters: Array<{
    odentityId: string visibleName: string;
    boostCount: number;
  }>;
}

export interface UserBoostInfo {
  isBooster: boolean;
  boostCount: number;
  status: 'active' | 'past_due' | 'cancelled' | 'none';
  currentPeriodEnd?: Date;
  canBoost: boolean;
}

export interface BoostPurchaseResult {
  success: boolean;
  checkoutUrl?: string;
  boostId?: string;
  error?: string;
}

// =============================================================================
// BOOST LEVEL CONFIGURATION
// =============================================================================

export const BOOST_LEVELS: BoostLevel[] = [
  {
    level: 0,
    name: 'No Boosts',
    requiredBoosts: 0,
    effectiveTier: 'starter',
    perks: [],
  },
  {
    level: 1,
    name: 'Level 1',
    requiredBoosts: 2,
    effectiveTier: 'basic',
    perks: [
      'Background checks enabled',
      '500 verified members',
      '50 TGRs',
      'Booster badge for contributors',
    ],
  },
  {
    level: 2,
    name: 'Level 2',
    requiredBoosts: 7,
    effectiveTier: 'premium',
    perks: [
      'Role Composition (AND/OR logic)',
      'Conviction Engine',
      'Member Directory',
      'PRO Miniapps',
      'Sietch Score Badge (free for all)',
      '1,000 verified members',
    ],
  },
  {
    level: 3,
    name: 'Level 3',
    requiredBoosts: 14,
    effectiveTier: 'exclusive',
    perks: [
      'Custom branding',
      'Admin balance checks',
      'Stillsuit channels',
      '2,500 verified members',
    ],
  },
  {
    level: 4,
    name: 'Level 4 (Max)',
    requiredBoosts: 30,
    effectiveTier: 'elite',
    perks: [
      'AI Quiz Agent',
      '7,500 verified members',
      'Priority support',
      'All features unlocked',
    ],
  },
];

// Boost pricing
const BOOST_PRICE_USD = 299; // $2.99/month per boost
const SUSTAIN_PERIOD_DAYS = 7; // Grace period when boost level drops
const BOOST_PRODUCT_NAME = 'Sietch Community Boost';

// =============================================================================
// BOOST SERVICE
// =============================================================================

export class BoostService {
  private prisma: PrismaClient;
  private redis: Redis;
  private stripe: Stripe;

  private readonly CACHE_PREFIX = 'boost:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(deps: {
    prisma: PrismaClient;
    redis: Redis;
    stripe: Stripe;
  }) {
    this.prisma = deps.prisma;
    this.redis = deps.redis;
    this.stripe = deps.stripe;
  }

  // ===========================================================================
  // BOOST LEVEL CALCULATIONS
  // ===========================================================================

  /**
   * Get the boost level for a given number of boosts.
   */
  getBoostLevel(totalBoosts: number): BoostLevel {
    // Find highest level that meets boost requirement
    for (let i = BOOST_LEVELS.length - 1; i >= 0; i--) {
      if (totalBoosts >= BOOST_LEVELS[i].requiredBoosts) {
        return BOOST_LEVELS[i];
      }
    }
    return BOOST_LEVELS[0];
  }

  /**
   * Get the next boost level (or null if at max).
   */
  getNextBoostLevel(currentLevel: number): BoostLevel | null {
    const nextIndex = currentLevel + 1;
    return nextIndex < BOOST_LEVELS.length ? BOOST_LEVELS[nextIndex] : null;
  }

  /**
   * Calculate effective tier from boosts.
   */
  getEffectiveTierFromBoosts(totalBoosts: number): TierName {
    return this.getBoostLevel(totalBoosts).effectiveTier;
  }

  // ===========================================================================
  // COMMUNITY BOOST STATUS
  // ===========================================================================

  /**
   * Get full boost status for a community.
   */
  async getCommunityBoostStatus(communityId: string): Promise<CommunityBoostStatus> {
    // Check cache
    const cacheKey = `${this.CACHE_PREFIX}status:${communityId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Calculate from database
    const boosts = await this.prisma.communityBoost.findMany({
      where: {
        communityId,
        status: 'active',
      },
      include: {
        identity: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        boostCount: 'desc',
      },
    });

    const totalBoosts = boosts.reduce((sum, b) => sum + b.boostCount, 0);
    const activeBoosterCount = boosts.length;
    const currentLevel = this.getBoostLevel(totalBoosts);
    const nextLevel = this.getNextBoostLevel(currentLevel.level);

    const status: CommunityBoostStatus = {
      communityId,
      totalBoosts,
      activeBoosterCount,
      currentLevel,
      nextLevel,
      boostsToNextLevel: nextLevel 
        ? nextLevel.requiredBoosts - totalBoosts 
        : 0,
      effectiveTier: currentLevel.effectiveTier,
      topBoosters: boosts.slice(0, 10).map(b => ({
        identityId: b.unifiedIdentityId,
        visibleName: b.identity.profile?.nym || 'Anonymous Booster',
        boostCount: b.boostCount,
      })),
    };

    // Check for sustain period - if level dropped, maintain previous tier for 7 days
    const previousLevel = await this.prisma.communityBoostLevel.findUnique({
      where: { communityId },
    });
    
    if (previousLevel && previousLevel.boostLevel > currentLevel.level) {
      // Level dropped - check if we're in sustain period
      const sustainEndDate = new Date(previousLevel.levelDroppedAt || Date.now());
      sustainEndDate.setDate(sustainEndDate.getDate() + SUSTAIN_PERIOD_DAYS);
      
      if (Date.now() < sustainEndDate.getTime()) {
        // Still in sustain period - maintain previous effective tier
        const previousBoostLevel = BOOST_LEVELS[previousLevel.boostLevel] || currentLevel;
        status.effectiveTier = previousBoostLevel.effectiveTier;
        (status as any).inSustainPeriod = true;
        (status as any).sustainEndsAt = sustainEndDate;
        (status as any).sustainedTier = previousBoostLevel.effectiveTier;
        console.log(`🛡️ Community ${communityId} in sustain period until ${sustainEndDate.toISOString()}`);
      }
    }

    // Update cached level in database
    await this.prisma.communityBoostLevel.upsert({
      where: { communityId },
      update: {
        totalBoosts,
        activeBoosterCount,
        boostLevel: currentLevel.level,
        effectiveTier: currentLevel.effectiveTier,
        lastCalculatedAt: new Date(),
        ...(currentLevel.level >= 1 && !await this.hasReachedLevel(communityId, 1) 
          ? { reachedLevel1At: new Date() } : {}),
        ...(currentLevel.level >= 2 && !await this.hasReachedLevel(communityId, 2)
          ? { reachedLevel2At: new Date() } : {}),
        ...(currentLevel.level >= 3 && !await this.hasReachedLevel(communityId, 3)
          ? { reachedLevel3At: new Date() } : {}),
      },
      create: {
        communityId,
        totalBoosts,
        activeBoosterCount,
        boostLevel: currentLevel.level,
        effectiveTier: currentLevel.effectiveTier,
        ...(currentLevel.level >= 1 ? { reachedLevel1At: new Date() } : {}),
        ...(currentLevel.level >= 2 ? { reachedLevel2At: new Date() } : {}),
        ...(currentLevel.level >= 3 ? { reachedLevel3At: new Date() } : {}),
      },
    });

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(status));

    return status;
  }

  /**
   * Check if community has ever reached a level.
   */
  private async hasReachedLevel(communityId: string, level: number): Promise<boolean> {
    const boostLevel = await this.prisma.communityBoostLevel.findUnique({
      where: { communityId },
    });
    
    if (!boostLevel) return false;
    
    switch (level) {
      case 1: return boostLevel.reachedLevel1At != null;
      case 2: return boostLevel.reachedLevel2At != null;
      case 3: return boostLevel.reachedLevel3At != null;
      default: return false;
    }
  }

  /**
   * Get effective tier from boosts (for Gatekeeper integration).
   * Returns null if no boosts, so Gatekeeper can fall back to other sources.
   */
  async getBoostTier(communityId: string): Promise<TierName | null> {
    const status = await this.getCommunityBoostStatus(communityId);
    
    // Only return tier if there are active boosts
    if (status.totalBoosts === 0) {
      return null;
    }
    
    return status.effectiveTier;
  }

  // ===========================================================================
  // USER BOOST INFO
  // ===========================================================================

  /**
   * Get boost info for a specific user in a community.
   */
  async getUserBoostInfo(
    communityId: string,
    unifiedIdentityId: string
  ): Promise<UserBoostInfo> {
    const boost = await this.prisma.communityBoost.findUnique({
      where: {
        communityId_unifiedIdentityId: {
          communityId,
          unifiedIdentityId,
        },
      },
    });

    if (!boost) {
      return {
        isBooster: false,
        boostCount: 0,
        status: 'none',
        canBoost: true,
      };
    }

    return {
      isBooster: boost.status === 'active',
      boostCount: boost.boostCount,
      status: boost.status as UserBoostInfo['status'],
      currentPeriodEnd: boost.currentPeriodEnd,
      canBoost: boost.status !== 'active', // Can add more boosts if not already boosting
    };
  }

  /**
   * Check if a user is a booster (for badge display).
   */
  async isUserBooster(communityId: string, unifiedIdentityId: string): Promise<boolean> {
    const boost = await this.prisma.communityBoost.findUnique({
      where: {
        communityId_unifiedIdentityId: {
          communityId,
          unifiedIdentityId,
        },
      },
    });

    return boost?.status === 'active';
  }

  // ===========================================================================
  // BOOST PURCHASE FLOW
  // ===========================================================================

  /**
   * Create a Stripe checkout session for boost purchase.
   */
  async createBoostCheckout(params: {
    communityId: string;
    unifiedIdentityId: string;
    boostCount?: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<BoostPurchaseResult> {
    const { communityId, unifiedIdentityId, boostCount = 1, successUrl, cancelUrl } = params;

    // Check if user already has active boost
    const existingBoost = await this.prisma.communityBoost.findUnique({
      where: {
        communityId_unifiedIdentityId: {
          communityId,
          unifiedIdentityId,
        },
      },
    });

    if (existingBoost?.status === 'active') {
      return {
        success: false,
        error: 'You already have an active boost for this community. Use the portal to modify.',
      };
    }

    // Get user info
    const identity = await this.prisma.unifiedIdentity.findUnique({
      where: { id: unifiedIdentityId },
      include: { accounts: true },
    });

    if (!identity) {
      return { success: false, error: 'User not found' };
    }

    try {
      // Create Stripe checkout session
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: BOOST_PRODUCT_NAME,
                description: `Boost this community to unlock premium features for everyone! ${boostCount} boost${boostCount > 1 ? 's' : ''}/month`,
                images: ['https://sietch.io/boost-icon.png'],
              },
              unit_amount: BOOST_PRICE_USD,
              recurring: {
                interval: 'month',
              },
            },
            quantity: boostCount,
          },
        ],
        metadata: {
          type: 'community_boost',
          communityId,
          unifiedIdentityId,
          boostCount: String(boostCount),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            type: 'community_boost',
            communityId,
            unifiedIdentityId,
            boostCount: String(boostCount),
          },
        },
      });

      return {
        success: true,
        checkoutUrl: session.url!,
      };
    } catch (error) {
      console.error('Failed to create boost checkout:', error);
      return {
        success: false,
        error: 'Failed to create checkout session',
      };
    }
  }

  /**
   * Handle successful boost purchase from Stripe webhook.
   */
  async handleBoostPurchase(subscription: Stripe.Subscription): Promise<void> {
    const { communityId, unifiedIdentityId, boostCount } = subscription.metadata;

    if (!communityId || !unifiedIdentityId) {
      console.warn('Invalid boost subscription metadata:', subscription.metadata);
      return;
    }

    const count = parseInt(boostCount || '1', 10);

    // Create or update boost record
    await this.prisma.communityBoost.upsert({
      where: {
        communityId_unifiedIdentityId: {
          communityId,
          unifiedIdentityId,
        },
      },
      update: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        boostCount: count,
        status: 'active',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelledAt: null,
      },
      create: {
        communityId,
        unifiedIdentityId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        boostCount: count,
        status: 'active',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // Log the boost
    await this.prisma.auditLog.create({
      data: {
        action: 'community_boost_purchased',
        actor: unifiedIdentityId,
        metadata: {
          communityId,
          boostCount: count,
          subscriptionId: subscription.id,
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(communityId);
  }

  /**
   * Handle boost subscription update (renewal, payment failed, cancelled).
   */
  async handleBoostUpdate(subscription: Stripe.Subscription, eventType: string): Promise<void> {
    const boost = await this.prisma.communityBoost.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!boost) {
      console.warn('Boost not found for subscription:', subscription.id);
      return;
    }

    switch (eventType) {
      case 'invoice.paid':
        await this.prisma.communityBoost.update({
          where: { id: boost.id },
          data: {
            status: 'active',
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;

      case 'invoice.payment_failed':
        await this.prisma.communityBoost.update({
          where: { id: boost.id },
          data: { status: 'past_due' },
        });
        break;

      case 'customer.subscription.deleted':
        await this.prisma.communityBoost.update({
          where: { id: boost.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
          },
        });
        break;
    }

    // Invalidate cache to recalculate level
    await this.invalidateCache(boost.communityId);
  }

  // ===========================================================================
  // CACHE MANAGEMENT
  // ===========================================================================

  /**
   * Invalidate boost cache for a community.
   */
  async invalidateCache(communityId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}status:${communityId}`;
    await this.redis.del(cacheKey);
  }

  // ===========================================================================
  // BOOST MANAGEMENT (Admin)
  // ===========================================================================

  /**
   * Get Stripe customer portal URL for boost management.
   */
  async getBoostPortalUrl(
    communityId: string,
    unifiedIdentityId: string,
    returnUrl: string
  ): Promise<string | null> {
    const boost = await this.prisma.communityBoost.findUnique({
      where: {
        communityId_unifiedIdentityId: {
          communityId,
          unifiedIdentityId,
        },
      },
    });

    if (!boost?.stripeCustomerId) {
      return null;
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: boost.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * List all boosters for a community.
   */
  async listBoosters(communityId: string): Promise<Array<{
    identityId: string;
    visibleName: string;
    boostCount: number;
    status: string;
    since: Date;
  }>> {
    const boosts = await this.prisma.communityBoost.findMany({
      where: { communityId },
      include: {
        identity: {
          include: { profile: true },
        },
      },
      orderBy: [
        { boostCount: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return boosts.map(b => ({
      identityId: b.unifiedIdentityId,
      visibleName: b.identity.profile?.nym || 'Anonymous',
      boostCount: b.boostCount,
      status: b.status,
      since: b.createdAt,
    }));
  }

  /**
   * Grant free boost (admin/owner action).
   */
  async grantFreeBoost(params: {
    communityId: string;
    unifiedIdentityId: string;
    boostCount: number;
    grantedBy: string;
    reason: string;
    expiresAt?: Date;
  }): Promise<{ id: string }> {
    const { communityId, unifiedIdentityId, boostCount, grantedBy, reason, expiresAt } = params;

    const boost = await this.prisma.communityBoost.upsert({
      where: {
        communityId_unifiedIdentityId: {
          communityId,
          unifiedIdentityId,
        },
      },
      update: {
        boostCount,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
      },
      create: {
        communityId,
        unifiedIdentityId,
        boostCount,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Log
    await this.prisma.auditLog.create({
      data: {
        action: 'boost_granted_free',
        actor: grantedBy,
        metadata: {
          communityId,
          unifiedIdentityId,
          boostCount,
          reason,
          expiresAt: expiresAt?.toISOString(),
        },
      },
    });

    await this.invalidateCache(communityId);

    return { id: boost.id };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let boostServiceInstance: BoostService | null = null;

export function getBoostService(deps: {
  prisma: PrismaClient;
  redis: Redis;
  stripe: Stripe;
}): BoostService {
  if (!boostServiceInstance) {
    boostServiceInstance = new BoostService(deps);
  }
  return boostServiceInstance;
}

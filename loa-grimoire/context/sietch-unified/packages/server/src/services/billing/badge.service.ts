/**
 * =============================================================================
 * SIETCH UNIFIED - BADGE SERVICE
 * =============================================================================
 * 
 * Manages the Sietch Score Badge feature:
 * - Badge entitlement checking (tier-included vs individual purchase)
 * - Badge purchase flow via Stripe
 * - Badge display settings
 * - Badge cache for fast bot lookups
 * 
 * Access Rules:
 * - Premium+ tiers: Badge included free
 * - Lower tiers: Users can purchase individually
 * - Fee waiver communities: Badge included free
 * 
 * @module services/billing/badge.service
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import Stripe from 'stripe';
import type { GatekeeperService, TierName } from './gatekeeper.service';

// =============================================================================
// TYPES
// =============================================================================

export type BadgeType = 'sietch_score';
export type BadgeStyle = 'default' | 'minimal' | 'detailed';
export type PurchaseMethod = 'stripe' | 'tier_included' | 'waiver_granted' | 'admin_granted';

export interface BadgeEntitlement {
  hasBadge: boolean;
  source: 'tier_included' | 'waiver_granted' | 'purchased' | 'admin_granted' | 'none';
  isDisplayEnabled: boolean;
  displayOnDiscord: boolean;
  displayOnTelegram: boolean;
  badgeStyle: BadgeStyle;
  expiresAt?: Date;
  purchaseAvailable: boolean;
  purchasePrice?: number; // In cents
}

export interface BadgeDisplayInfo {
  displayText: string;
  emoji: string;
  score: number;
  tier: string;
  style: BadgeStyle;
}

export interface BadgePurchaseResult {
  success: boolean;
  checkoutUrl?: string;
  badgeId?: string;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Tiers that include badge for free
const BADGE_INCLUDED_TIERS: TierName[] = ['premium', 'exclusive', 'elite', 'enterprise'];

// Badge pricing (in cents)
const BADGE_PRICE_USD = 499; // $4.99 one-time

// Badge display templates
const BADGE_TEMPLATES = {
  default: (score: number, tier: string) => `⚡ ${score} | ${tier}`,
  minimal: (score: number, _tier: string) => `⚡${score}`,
  detailed: (score: number, tier: string) => `Sietch Score: ${score} | Rank: ${tier}`,
};

const TIER_EMOJI: Record<string, string> = {
  fedaykin: '🏆',
  naib: '⭐',
  none: '⚡',
};

// =============================================================================
// BADGE SERVICE
// =============================================================================

export class BadgeService {
  private prisma: PrismaClient;
  private redis: Redis;
  private stripe: Stripe;
  private gatekeeper: GatekeeperService;

  private readonly CACHE_PREFIX = 'badge:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(deps: {
    prisma: PrismaClient;
    redis: Redis;
    stripe: Stripe;
    gatekeeper: GatekeeperService;
  }) {
    this.prisma = deps.prisma;
    this.redis = deps.redis;
    this.stripe = deps.stripe;
    this.gatekeeper = deps.gatekeeper;
  }

  // ===========================================================================
  // ENTITLEMENT CHECKING
  // ===========================================================================

  /**
   * Check if a user has badge entitlement and how they got it.
   */
  async checkBadgeEntitlement(
    unifiedIdentityId: string,
    communityId: string
  ): Promise<BadgeEntitlement> {
    // 1. Check if community tier includes badge
    const entitlement = await this.gatekeeper.getEntitlement(communityId);
    const tierIncludesBadge = entitlement && BADGE_INCLUDED_TIERS.includes(entitlement.tier);
    
    // 2. Check if community has fee waiver (always includes badge)
    const hasWaiver = entitlement?.waiver != null;

    // 3. Check if user has purchased badge individually
    const purchase = await this.prisma.userBadgePurchase.findUnique({
      where: {
        unifiedIdentityId_badgeType: {
          unifiedIdentityId,
          badgeType: 'sietch_score',
        },
      },
    });

    // Determine source
    let source: BadgeEntitlement['source'] = 'none';
    let hasBadge = false;

    if (hasWaiver) {
      source = 'waiver_granted';
      hasBadge = true;
    } else if (tierIncludesBadge) {
      source = 'tier_included';
      hasBadge = true;
    } else if (purchase?.isActive) {
      // Check expiration
      if (purchase.expiresAt && purchase.expiresAt < new Date()) {
        // Expired - mark inactive
        await this.prisma.userBadgePurchase.update({
          where: { id: purchase.id },
          data: { isActive: false },
        });
      } else {
        source = purchase.purchaseMethod === 'admin_granted' ? 'admin_granted' : 'purchased';
        hasBadge = true;
      }
    }

    return {
      hasBadge,
      source,
      isDisplayEnabled: purchase?.isDisplayEnabled ?? true,
      displayOnDiscord: purchase?.displayOnDiscord ?? true,
      displayOnTelegram: purchase?.displayOnTelegram ?? true,
      badgeStyle: (purchase?.badgeStyle as BadgeStyle) ?? 'default',
      expiresAt: purchase?.expiresAt ?? undefined,
      purchaseAvailable: !hasBadge && !tierIncludesBadge && !hasWaiver,
      purchasePrice: BADGE_PRICE_USD,
    };
  }

  /**
   * Quick check if badge should be displayed for a platform user.
   * Used by bots for fast lookups.
   */
  async shouldDisplayBadge(
    platform: 'discord' | 'telegram',
    platformId: string
  ): Promise<boolean> {
    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}display:${platform}:${platformId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached !== null) {
      return cached === 'true';
    }

    // Look up user
    const account = await this.prisma.linkedAccount.findUnique({
      where: {
        platform_platformId: { platform, platformId },
      },
      include: {
        unifiedIdentity: {
          include: {
            badgePurchases: {
              where: { badgeType: 'sietch_score', isActive: true },
            },
          },
        },
      },
    });

    if (!account?.unifiedIdentity) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, 'false');
      return false;
    }

    const purchase = account.unifiedIdentity.badgePurchases[0];
    
    // Check platform-specific display setting
    const shouldDisplay = purchase != null && 
      purchase.isDisplayEnabled &&
      (platform === 'discord' ? purchase.displayOnDiscord : purchase.displayOnTelegram);

    await this.redis.setex(cacheKey, this.CACHE_TTL, shouldDisplay ? 'true' : 'false');
    return shouldDisplay;
  }

  // ===========================================================================
  // BADGE DISPLAY
  // ===========================================================================

  /**
   * Get badge display info for a user.
   */
  async getBadgeDisplay(
    platform: 'discord' | 'telegram',
    platformId: string
  ): Promise<BadgeDisplayInfo | null> {
    // Check cache
    const cacheKey = `${this.CACHE_PREFIX}info:${platform}:${platformId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Look up user with conviction data
    const account = await this.prisma.linkedAccount.findUnique({
      where: {
        platform_platformId: { platform, platformId },
      },
      include: {
        unifiedIdentity: {
          include: {
            badgePurchases: {
              where: { badgeType: 'sietch_score', isActive: true },
            },
          },
        },
      },
    });

    if (!account?.unifiedIdentity) {
      return null;
    }

    const identity = account.unifiedIdentity;
    const purchase = identity.badgePurchases[0];

    if (!purchase?.isDisplayEnabled) {
      return null;
    }

    // Check platform-specific setting
    if (platform === 'discord' && !purchase.displayOnDiscord) return null;
    if (platform === 'telegram' && !purchase.displayOnTelegram) return null;

    // Get conviction score (from cached value on identity)
    const score = identity.rank ?? 0;
    const tier = identity.tier;
    const style = (purchase.badgeStyle as BadgeStyle) || 'default';

    const displayInfo: BadgeDisplayInfo = {
      displayText: BADGE_TEMPLATES[style](score, tier),
      emoji: TIER_EMOJI[tier] || '⚡',
      score,
      tier,
      style,
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(displayInfo));

    return displayInfo;
  }

  /**
   * Update badge display cache after score change.
   */
  async refreshBadgeCache(unifiedIdentityId: string): Promise<void> {
    const identity = await this.prisma.unifiedIdentity.findUnique({
      where: { id: unifiedIdentityId },
      include: {
        accounts: true,
        badgePurchases: {
          where: { badgeType: 'sietch_score', isActive: true },
        },
      },
    });

    if (!identity) return;

    // Invalidate all platform caches for this user
    for (const account of identity.accounts) {
      const displayKey = `${this.CACHE_PREFIX}display:${account.platform}:${account.platformId}`;
      const infoKey = `${this.CACHE_PREFIX}info:${account.platform}:${account.platformId}`;
      await this.redis.del(displayKey, infoKey);
    }
  }

  // ===========================================================================
  // PURCHASE FLOW
  // ===========================================================================

  /**
   * Create a Stripe checkout session for badge purchase.
   */
  async createPurchaseCheckout(params: {
    unifiedIdentityId: string;
    communityId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<BadgePurchaseResult> {
    const { unifiedIdentityId, communityId, successUrl, cancelUrl } = params;

    // Verify user doesn't already have badge
    const entitlement = await this.checkBadgeEntitlement(unifiedIdentityId, communityId);
    
    if (entitlement.hasBadge) {
      return {
        success: false,
        error: `Badge already owned via ${entitlement.source}`,
      };
    }

    if (!entitlement.purchaseAvailable) {
      return {
        success: false,
        error: 'Badge purchase not available for this community tier',
      };
    }

    // Get user info for Stripe
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
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Sietch Score Badge',
                description: 'Display your conviction score in Discord and Telegram chats',
                images: ['https://sietch.io/badge-preview.png'], // Placeholder
              },
              unit_amount: BADGE_PRICE_USD,
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: 'badge_purchase',
          badgeType: 'sietch_score',
          unifiedIdentityId,
          communityId,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return {
        success: true,
        checkoutUrl: session.url!,
      };
    } catch (error) {
      console.error('Failed to create badge checkout:', error);
      return {
        success: false,
        error: 'Failed to create checkout session',
      };
    }
  }

  /**
   * Handle successful badge purchase from Stripe webhook.
   */
  async handlePurchaseComplete(session: Stripe.Checkout.Session): Promise<void> {
    const { unifiedIdentityId, badgeType } = session.metadata || {};

    if (!unifiedIdentityId || badgeType !== 'sietch_score') {
      console.warn('Invalid badge purchase metadata:', session.metadata);
      return;
    }

    // Create badge purchase record
    await this.prisma.userBadgePurchase.upsert({
      where: {
        unifiedIdentityId_badgeType: {
          unifiedIdentityId,
          badgeType: 'sietch_score',
        },
      },
      update: {
        stripePaymentId: session.payment_intent as string,
        amountPaid: session.amount_total,
        currency: session.currency || 'usd',
        purchaseMethod: 'stripe',
        isActive: true,
        expiresAt: null, // Permanent
      },
      create: {
        unifiedIdentityId,
        badgeType: 'sietch_score',
        stripePaymentId: session.payment_intent as string,
        amountPaid: session.amount_total,
        currency: session.currency || 'usd',
        purchaseMethod: 'stripe',
      },
    });

    // Log the purchase
    await this.prisma.auditLog.create({
      data: {
        action: 'badge_purchased',
        actor: unifiedIdentityId,
        metadata: {
          badgeType: 'sietch_score',
          amount: session.amount_total,
          stripeSessionId: session.id,
        },
      },
    });

    // Refresh cache
    await this.refreshBadgeCache(unifiedIdentityId);
  }

  // ===========================================================================
  // BADGE MANAGEMENT
  // ===========================================================================

  /**
   * Update badge display settings.
   */
  async updateDisplaySettings(
    unifiedIdentityId: string,
    settings: {
      isDisplayEnabled?: boolean;
      displayOnDiscord?: boolean;
      displayOnTelegram?: boolean;
      badgeStyle?: BadgeStyle;
    }
  ): Promise<void> {
    await this.prisma.userBadgePurchase.updateMany({
      where: {
        unifiedIdentityId,
        badgeType: 'sietch_score',
      },
      data: settings,
    });

    // Refresh cache
    await this.refreshBadgeCache(unifiedIdentityId);
  }

  /**
   * Grant badge to user (admin/owner action).
   */
  async grantBadge(params: {
    unifiedIdentityId: string;
    grantedBy: string;
    reason: string;
    expiresAt?: Date;
  }): Promise<{ id: string }> {
    const { unifiedIdentityId, grantedBy, reason, expiresAt } = params;

    const badge = await this.prisma.userBadgePurchase.upsert({
      where: {
        unifiedIdentityId_badgeType: {
          unifiedIdentityId,
          badgeType: 'sietch_score',
        },
      },
      update: {
        purchaseMethod: 'admin_granted',
        isActive: true,
        expiresAt,
      },
      create: {
        unifiedIdentityId,
        badgeType: 'sietch_score',
        purchaseMethod: 'admin_granted',
        expiresAt,
      },
    });

    // Log
    await this.prisma.auditLog.create({
      data: {
        action: 'badge_granted',
        actor: grantedBy,
        metadata: {
          unifiedIdentityId,
          badgeType: 'sietch_score',
          reason,
          expiresAt: expiresAt?.toISOString(),
        },
      },
    });

    await this.refreshBadgeCache(unifiedIdentityId);

    return { id: badge.id };
  }

  /**
   * Revoke badge from user.
   */
  async revokeBadge(params: {
    unifiedIdentityId: string;
    revokedBy: string;
    reason: string;
  }): Promise<void> {
    const { unifiedIdentityId, revokedBy, reason } = params;

    await this.prisma.userBadgePurchase.updateMany({
      where: {
        unifiedIdentityId,
        badgeType: 'sietch_score',
      },
      data: {
        isActive: false,
      },
    });

    // Log
    await this.prisma.auditLog.create({
      data: {
        action: 'badge_revoked',
        actor: revokedBy,
        metadata: {
          unifiedIdentityId,
          badgeType: 'sietch_score',
          reason,
        },
      },
    });

    await this.refreshBadgeCache(unifiedIdentityId);
  }

  /**
   * Auto-grant badges for users in tier-included communities.
   * Called when community upgrades to Premium+.
   */
  async autoGrantForCommunity(communityId: string): Promise<number> {
    // This would need community-to-user mapping
    // For now, just return 0 - actual implementation depends on how users are linked to communities
    console.log(`Auto-grant badges for community ${communityId} - implement based on community structure`);
    return 0;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let badgeServiceInstance: BadgeService | null = null;

export function getBadgeService(deps: {
  prisma: PrismaClient;
  redis: Redis;
  stripe: Stripe;
  gatekeeper: GatekeeperService;
}): BadgeService {
  if (!badgeServiceInstance) {
    badgeServiceInstance = new BadgeService(deps);
  }
  return badgeServiceInstance;
}

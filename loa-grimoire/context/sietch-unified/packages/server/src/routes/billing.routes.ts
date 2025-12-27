/**
 * =============================================================================
 * SIETCH UNIFIED - BILLING ROUTES
 * =============================================================================
 * 
 * Handles subscription management, checkout, and billing portal.
 * 
 * Endpoints:
 * - GET /subscription - Get current subscription status
 * - POST /checkout - Create Stripe checkout session
 * - GET /portal - Get Stripe customer portal URL
 * - GET /plans - Get available subscription plans
 * - POST /usage - Report usage metrics
 * 
 * @module routes/billing
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import type { GatekeeperService } from '../services/billing/gatekeeper.service';

// =============================================================================
// SCHEMAS
// =============================================================================

const checkoutSchema = z.object({
  tier: z.enum(['basic', 'premium', 'exclusive', 'elite']),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
  communityId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const usageReportSchema = z.object({
  communityId: z.string().min(1),
  metrics: z.object({
    verifiedMembers: z.number().int().min(0),
    tgrs: z.number().int().min(0).optional(),
    balanceChecks: z.number().int().min(0).optional(),
  }),
});

// =============================================================================
// PRICE MAPPING
// =============================================================================

const TIER_PRICES: Record<string, Record<string, string>> = {
  basic: {
    monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || 'price_basic_monthly',
    yearly: process.env.STRIPE_PRICE_BASIC_YEARLY || 'price_basic_yearly',
  },
  premium: {
    monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly',
    yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY || 'price_premium_yearly',
  },
  exclusive: {
    monthly: process.env.STRIPE_PRICE_EXCLUSIVE_MONTHLY || 'price_exclusive_monthly',
    yearly: process.env.STRIPE_PRICE_EXCLUSIVE_YEARLY || 'price_exclusive_yearly',
  },
  elite: {
    monthly: process.env.STRIPE_PRICE_ELITE_MONTHLY || 'price_elite_monthly',
    yearly: process.env.STRIPE_PRICE_ELITE_YEARLY || 'price_elite_yearly',
  },
};

const TIER_DETAILS = {
  starter: {
    name: 'Starter',
    price: 0,
    limits: { verifiedMembers: 25, tgrs: 10 },
    features: ['Basic TGRs', '24hr balance checks'],
  },
  basic: {
    name: 'Basic',
    price: 15,
    limits: { verifiedMembers: 500, tgrs: 50 },
    features: ['Background checks', 'All Starter features'],
  },
  premium: {
    name: 'Premium',
    price: 35,
    limits: { verifiedMembers: 1000, tgrs: 100 },
    features: ['Role Composition (AND/OR)', 'Conviction Engine', 'Member Directory', 'Priority support'],
  },
  exclusive: {
    name: 'Exclusive',
    price: 149,
    limits: { verifiedMembers: 2500, tgrs: 250, adminBalanceChecks: 5 },
    features: ['Custom branding', 'Stillsuit channels', 'SmartTag', '5 admin balance checks/mo'],
  },
  elite: {
    name: 'Elite',
    price: 449,
    limits: { verifiedMembers: 7500, tgrs: 500, adminBalanceChecks: 20 },
    features: ['AI Quiz Agent', '20 admin balance checks/mo', 'All Exclusive features'],
  },
  enterprise: {
    name: 'Enterprise',
    price: null,
    limits: { verifiedMembers: -1, tgrs: -1, adminBalanceChecks: -1 },
    features: ['Unlimited everything', 'White-label', 'Dedicated Slack support', 'Custom features'],
  },
};

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface BillingRouteDeps {
  stripe: Stripe;
  gatekeeper: GatekeeperService;
  prisma: PrismaClient;
}

export function createBillingRoutes({ stripe, gatekeeper, prisma }: BillingRouteDeps): Hono {
  const router = new Hono();

  /**
   * GET /subscription
   * Get current subscription status for a community
   */
  router.get('/subscription', async (c) => {
    const communityId = c.req.header('x-community-id') || c.req.query('communityId');

    if (!communityId) {
      return c.json({
        success: false,
        error: 'Community ID required',
      }, 400);
    }

    try {
      const entitlement = await gatekeeper.getEntitlement(communityId);

      if (!entitlement) {
        return c.json({
          success: true,
          subscription: {
            tier: 'starter',
            status: 'active',
            features: TIER_DETAILS.starter.features,
            limits: TIER_DETAILS.starter.limits,
          },
        });
      }

      const tierDetails = TIER_DETAILS[entitlement.tier as keyof typeof TIER_DETAILS];

      return c.json({
        success: true,
        subscription: {
          tier: entitlement.tier,
          status: entitlement.subscription?.status || 'active',
          currentPeriodEnd: entitlement.subscription?.currentPeriodEnd,
          graceUntil: entitlement.subscription?.graceUntil,
          features: tierDetails?.features || [],
          limits: entitlement.limits,
        },
      });
    } catch (error) {
      console.error('Failed to get subscription:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve subscription',
      }, 500);
    }
  });

  /**
   * POST /checkout
   * Create Stripe checkout session for subscription
   */
  router.post(
    '/checkout',
    zValidator('json', checkoutSchema),
    async (c) => {
      const { tier, interval, communityId, successUrl, cancelUrl } = c.req.valid('json');
      const adminUserId = c.req.header('x-user-id');

      const priceId = TIER_PRICES[tier]?.[interval];
      if (!priceId) {
        return c.json({
          success: false,
          error: 'Invalid tier or interval',
        }, 400);
      }

      try {
        // Check if community already has a subscription
        const existing = await prisma.communitySubscription.findUnique({
          where: { communityId },
        });

        let customerId: string | undefined;

        if (existing?.stripeCustomerId) {
          customerId = existing.stripeCustomerId;
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer: customerId,
          line_items: [{
            price: priceId,
            quantity: 1,
          }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          allow_promotion_codes: true,
          metadata: {
            communityId,
            adminUserId: adminUserId || 'unknown',
            tier,
          },
          subscription_data: {
            metadata: {
              communityId,
            },
          },
        });

        return c.json({
          success: true,
          checkoutUrl: session.url,
          sessionId: session.id,
        });
      } catch (error) {
        console.error('Failed to create checkout:', error);
        return c.json({
          success: false,
          error: 'Failed to create checkout session',
        }, 500);
      }
    }
  );

  /**
   * GET /portal
   * Get Stripe customer portal URL for self-service management
   */
  router.get('/portal', async (c) => {
    const communityId = c.req.header('x-community-id') || c.req.query('communityId');
    const returnUrl = c.req.query('returnUrl') || process.env.APP_URL || 'https://your-domain.com';

    if (!communityId) {
      return c.json({
        success: false,
        error: 'Community ID required',
      }, 400);
    }

    try {
      const portalUrl = await gatekeeper.getCustomerPortalUrl(communityId, returnUrl);

      if (!portalUrl) {
        return c.json({
          success: false,
          error: 'No subscription found for this community',
        }, 404);
      }

      return c.json({
        success: true,
        portalUrl,
      });
    } catch (error) {
      console.error('Failed to get portal URL:', error);
      return c.json({
        success: false,
        error: 'Failed to generate portal URL',
      }, 500);
    }
  });

  /**
   * GET /plans
   * Get available subscription plans
   */
  router.get('/plans', async (c) => {
    const plans = Object.entries(TIER_DETAILS).map(([key, details]) => ({
      id: key,
      name: details.name,
      price: details.price,
      priceYearly: details.price ? Math.floor(details.price * 10) : null, // ~17% discount
      limits: details.limits,
      features: details.features,
      recommended: key === 'premium', // Highlight Premium as recommended
    }));

    return c.json({
      success: true,
      plans,
      currency: 'usd',
    });
  });

  /**
   * POST /usage
   * Report usage metrics for a community (for alerting on limits)
   */
  router.post(
    '/usage',
    zValidator('json', usageReportSchema),
    async (c) => {
      const { communityId, metrics } = c.req.valid('json');

      try {
        const limitCheck = await gatekeeper.checkMemberLimit(
          communityId,
          metrics.verifiedMembers
        );

        const response: any = {
          success: true,
          usage: metrics,
          limits: {
            verifiedMembers: limitCheck.limit,
            remaining: limitCheck.remaining,
          },
          warnings: [],
        };

        // Add warnings if approaching limits
        if (limitCheck.warningThreshold) {
          response.warnings.push({
            type: 'member_limit',
            message: `Approaching verified member limit (${metrics.verifiedMembers}/${limitCheck.limit})`,
            action: 'Consider upgrading to increase your limit',
          });
        }

        if (!limitCheck.allowed) {
          response.warnings.push({
            type: 'member_limit_exceeded',
            message: 'Verified member limit exceeded',
            action: 'Upgrade required to add more members',
          });
        }

        return c.json(response);
      } catch (error) {
        console.error('Failed to report usage:', error);
        return c.json({
          success: false,
          error: 'Failed to process usage report',
        }, 500);
      }
    }
  );

  /**
   * GET /invoices
   * Get invoice history for a community
   */
  router.get('/invoices', async (c) => {
    const communityId = c.req.header('x-community-id') || c.req.query('communityId');

    if (!communityId) {
      return c.json({
        success: false,
        error: 'Community ID required',
      }, 400);
    }

    try {
      const invoices = await prisma.paymentHistory.findMany({
        where: { communityId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      return c.json({
        success: true,
        invoices: invoices.map(inv => ({
          id: inv.id,
          stripeInvoiceId: inv.stripeInvoiceId,
          amount: inv.amount / 100, // Convert cents to dollars
          currency: inv.currency,
          status: inv.status,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt,
        })),
      });
    } catch (error) {
      console.error('Failed to get invoices:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve invoices',
      }, 500);
    }
  });

  return router;
}

/**
 * Billing API Routes (v4.0 - Sprint 23)
 *
 * Handles billing-related endpoints:
 * - POST /checkout - Create Stripe Checkout session
 * - POST /portal - Create Stripe Customer Portal session
 * - GET /subscription - Get current subscription status
 * - POST /webhook - Handle Stripe webhooks
 *
 * All routes except webhook require authentication.
 * Webhook uses Stripe signature verification.
 */

import { Router } from 'express';
import { z } from 'zod';
import type { Response, Request } from 'express';
import type { AuthenticatedRequest, RawBodyRequest } from './middleware.js';
import {
  memberRateLimiter,
  requireApiKey,
  ValidationError,
  NotFoundError,
} from './middleware.js';
import { config, isBillingEnabled, SUBSCRIPTION_TIERS } from '../config.js';
import { stripeService, webhookService } from '../services/billing/index.js';
import {
  getSubscriptionByCommunityId,
  getActiveFeeWaiver,
  getEffectiveTier,
  logBillingAuditEvent,
} from '../db/billing-queries.js';
import { logger } from '../utils/logger.js';
import type {
  SubscriptionTier,
  BillingStatusResponse,
  EntitlementsResponse,
  CheckoutResult,
  PortalResult,
  Feature,
} from '../types/billing.js';

// =============================================================================
// Router Setup
// =============================================================================

export const billingRouter = Router();

// Apply rate limiting to all routes
billingRouter.use(memberRateLimiter);

// =============================================================================
// Middleware: Check Billing Enabled
// =============================================================================

/**
 * Middleware to check if billing is enabled
 */
function requireBillingEnabled(req: Request, res: Response, next: Function) {
  if (!isBillingEnabled()) {
    res.status(503).json({
      error: 'Billing system not enabled',
      message: 'The billing system is currently disabled',
    });
    return;
  }
  next();
}

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * Checkout session creation schema
 */
const createCheckoutSchema = z.object({
  tier: z.enum(['basic', 'premium', 'exclusive', 'elite']),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
  community_id: z.string().default('default'),
});

/**
 * Portal session creation schema
 */
const createPortalSchema = z.object({
  return_url: z.string().url(),
  community_id: z.string().default('default'),
});

/**
 * Subscription query schema
 */
const subscriptionQuerySchema = z.object({
  community_id: z.string().default('default'),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /billing/checkout
 * Create a Stripe Checkout session for subscription purchase
 */
billingRouter.post(
  '/checkout',
  requireBillingEnabled,
  requireApiKey,
  async (req: AuthenticatedRequest, res: Response) => {
    const result = createCheckoutSchema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message).join(', ');
      throw new ValidationError(errors);
    }

    const { tier, success_url, cancel_url, community_id } = result.data;

    try {
      const checkout: CheckoutResult = await stripeService.createCheckoutSession({
        communityId: community_id,
        tier: tier as SubscriptionTier,
        successUrl: success_url,
        cancelUrl: cancel_url,
      });

      logBillingAuditEvent(
        'subscription_created',
        {
          tier,
          communityId: community_id,
          sessionId: checkout.sessionId,
        },
        community_id,
        req.adminName
      );

      res.json({
        session_id: checkout.sessionId,
        url: checkout.url,
      });
    } catch (error) {
      logger.error({ error, tier, communityId: community_id }, 'Failed to create checkout session');
      throw error;
    }
  }
);

/**
 * POST /billing/portal
 * Create a Stripe Customer Portal session
 */
billingRouter.post(
  '/portal',
  requireBillingEnabled,
  requireApiKey,
  async (req: AuthenticatedRequest, res: Response) => {
    const result = createPortalSchema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message).join(', ');
      throw new ValidationError(errors);
    }

    const { return_url, community_id } = result.data;

    try {
      const portal: PortalResult = await stripeService.createPortalSession({
        communityId: community_id,
        returnUrl: return_url,
      });

      res.json({
        url: portal.url,
      });
    } catch (error) {
      logger.error({ error, communityId: community_id }, 'Failed to create portal session');
      throw error;
    }
  }
);

/**
 * GET /billing/subscription
 * Get current subscription status
 */
billingRouter.get(
  '/subscription',
  requireBillingEnabled,
  requireApiKey,
  (req: AuthenticatedRequest, res: Response) => {
    const result = subscriptionQuerySchema.safeParse(req.query);

    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message).join(', ');
      throw new ValidationError(errors);
    }

    const { community_id } = result.data;

    const subscription = getSubscriptionByCommunityId(community_id);
    const waiver = getActiveFeeWaiver(community_id);
    const { tier: effectiveTier, source } = getEffectiveTier(community_id);

    const tierInfo = SUBSCRIPTION_TIERS[effectiveTier as keyof typeof SUBSCRIPTION_TIERS];

    const response: BillingStatusResponse = {
      enabled: true,
      subscription: subscription
        ? {
            tier: subscription.tier,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
            inGracePeriod: !!(
              subscription.graceUntil && subscription.graceUntil > new Date()
            ),
          }
        : undefined,
      waiver: waiver
        ? {
            tier: waiver.tier,
            expiresAt: waiver.expiresAt?.toISOString(),
          }
        : undefined,
      effectiveTier,
      maxMembers: tierInfo?.maxMembers ?? 100,
    };

    res.json(response);
  }
);

/**
 * GET /billing/entitlements
 * Get feature entitlements for a community
 */
billingRouter.get(
  '/entitlements',
  requireBillingEnabled,
  requireApiKey,
  (req: AuthenticatedRequest, res: Response) => {
    const result = subscriptionQuerySchema.safeParse(req.query);

    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message).join(', ');
      throw new ValidationError(errors);
    }

    const { community_id } = result.data;

    const { tier, source } = getEffectiveTier(community_id);
    const tierInfo = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
    const subscription = getSubscriptionByCommunityId(community_id);

    // Determine features based on tier
    const features = getFeaturesByTier(tier);

    const inGracePeriod = !!(
      subscription?.graceUntil && subscription.graceUntil > new Date()
    );

    const response: EntitlementsResponse = {
      communityId: community_id,
      tier,
      tierName: tierInfo?.name ?? 'Unknown',
      maxMembers: tierInfo?.maxMembers ?? 100,
      features,
      source,
      inGracePeriod,
      graceUntil: subscription?.graceUntil?.toISOString(),
    };

    res.json(response);
  }
);

/**
 * POST /billing/webhook
 * Handle Stripe webhooks
 *
 * Note: This endpoint needs raw body for signature verification.
 * Configure Express with a raw body parser for this route.
 */
billingRouter.post('/webhook', async (req: Request, res: Response) => {
  // Webhook doesn't require billing to be fully enabled
  // (we want to process events even if feature flags are off)

  const signature = req.headers['stripe-signature'];

  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  try {
    // Verify webhook signature and get event
    // Note: req.body should be raw Buffer for signature verification
    // The raw body middleware is configured in server.ts
    const rawBody = (req as RawBodyRequest).rawBody;

    if (!rawBody) {
      logger.error('Webhook received without raw body - check middleware configuration');
      res.status(500).json({
        error: 'Internal server error',
        message: 'Server misconfiguration - raw body not available',
      });
      return;
    }

    const event = webhookService.verifySignature(rawBody, signature);

    // Process the event through WebhookService (handles idempotency, locking, etc.)
    const result = await webhookService.processEvent(event);

    // Return appropriate response
    res.json({
      received: true,
      status: result.status,
      eventId: result.eventId,
      eventType: result.eventType,
      message: result.message,
    });
  } catch (error) {
    logger.warn({ error }, 'Webhook processing failed at handler level');
    res.status(400).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Note: Webhook event processing is now handled by WebhookService
// (Sprint 24) for better separation of concerns and testability

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get features available for a tier
 */
function getFeaturesByTier(tier: SubscriptionTier): Feature[] {
  const features: Feature[] = [];

  // Starter features (all tiers)
  features.push('discord_bot', 'basic_onboarding', 'member_profiles');

  if (['basic', 'premium', 'exclusive', 'elite', 'enterprise'].includes(tier)) {
    features.push('stats_leaderboard', 'position_alerts', 'custom_nym');
  }

  if (['premium', 'exclusive', 'elite', 'enterprise'].includes(tier)) {
    features.push(
      'nine_tier_system',
      'custom_pfp',
      'weekly_digest',
      'activity_tracking',
      'score_badge'
    );
  }

  if (['exclusive', 'elite', 'enterprise'].includes(tier)) {
    features.push('admin_analytics', 'naib_dynamics', 'water_sharer_badge');
  }

  if (['elite', 'enterprise'].includes(tier)) {
    features.push('custom_branding', 'priority_support', 'api_access');
  }

  if (tier === 'enterprise') {
    features.push('white_label', 'dedicated_support', 'custom_integrations');
  }

  return features;
}

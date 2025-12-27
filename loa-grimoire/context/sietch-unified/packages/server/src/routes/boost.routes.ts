/**
 * =============================================================================
 * SIETCH UNIFIED - BOOST ROUTES
 * =============================================================================
 * 
 * Endpoints for Discord-style community boosting:
 * - GET /status/:communityId - Get community boost status and level
 * - GET /levels - Get all boost levels and requirements
 * - GET /user - Get user's boost info for a community
 * - POST /purchase - Create boost checkout
 * - GET /portal - Get Stripe portal URL for boost management
 * - GET /boosters/:communityId - List all boosters
 * - POST /grant - Admin: Grant free boost
 * 
 * @module routes/boost
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { BoostService } from '../services/billing/boost.service';
import { BOOST_LEVELS } from '../services/billing/boost.service';

// =============================================================================
// SCHEMAS
// =============================================================================

const purchaseSchema = z.object({
  communityId: z.string(),
  boostCount: z.number().min(1).max(10).optional().default(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const grantSchema = z.object({
  communityId: z.string(),
  unifiedIdentityId: z.string().uuid(),
  boostCount: z.number().min(1).max(100),
  reason: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface BoostRouteDeps {
  boostService: BoostService;
}

export function createBoostRoutes({ boostService }: BoostRouteDeps): Hono {
  const router = new Hono();

  /**
   * GET /levels
   * Get all boost levels and their requirements
   */
  router.get('/levels', (c) => {
    return c.json({
      success: true,
      levels: BOOST_LEVELS.map(level => ({
        level: level.level,
        name: level.name,
        requiredBoosts: level.requiredBoosts,
        effectiveTier: level.effectiveTier,
        perks: level.perks,
      })),
      pricing: {
        perBoost: {
          amount: 299,
          currency: 'usd',
          interval: 'month',
          formatted: '$2.99/month',
        },
        note: 'Users can purchase multiple boosts to help reach higher levels faster',
      },
    });
  });

  /**
   * GET /status/:communityId
   * Get boost status for a community
   */
  router.get('/status/:communityId', async (c) => {
    const communityId = c.req.param('communityId');

    try {
      const status = await boostService.getCommunityBoostStatus(communityId);

      return c.json({
        success: true,
        status: {
          totalBoosts: status.totalBoosts,
          activeBoosterCount: status.activeBoosterCount,
          currentLevel: {
            level: status.currentLevel.level,
            name: status.currentLevel.name,
            effectiveTier: status.currentLevel.effectiveTier,
            perks: status.currentLevel.perks,
          },
          nextLevel: status.nextLevel ? {
            level: status.nextLevel.level,
            name: status.nextLevel.name,
            requiredBoosts: status.nextLevel.requiredBoosts,
            boostsNeeded: status.boostsToNextLevel,
            effectiveTier: status.nextLevel.effectiveTier,
            perks: status.nextLevel.perks,
          } : null,
          topBoosters: status.topBoosters,
        },
      });
    } catch (error) {
      console.error('Failed to get boost status:', error);
      return c.json({
        success: false,
        error: 'Failed to get boost status',
      }, 500);
    }
  });

  /**
   * GET /user
   * Get current user's boost info for a community
   */
  router.get('/user', async (c) => {
    const communityId = c.req.header('x-community-id');
    const unifiedIdentityId = c.req.header('x-identity-id');

    if (!communityId || !unifiedIdentityId) {
      return c.json({
        success: false,
        error: 'Missing required headers: x-community-id, x-identity-id',
      }, 400);
    }

    try {
      const info = await boostService.getUserBoostInfo(communityId, unifiedIdentityId);

      return c.json({
        success: true,
        boost: info,
      });
    } catch (error) {
      console.error('Failed to get user boost info:', error);
      return c.json({
        success: false,
        error: 'Failed to get boost info',
      }, 500);
    }
  });

  /**
   * POST /purchase
   * Create Stripe checkout for boost purchase
   */
  router.post(
    '/purchase',
    zValidator('json', purchaseSchema),
    async (c) => {
      const unifiedIdentityId = c.req.header('x-identity-id');

      if (!unifiedIdentityId) {
        return c.json({
          success: false,
          error: 'Missing required header: x-identity-id',
        }, 400);
      }

      const { communityId, boostCount, successUrl, cancelUrl } = c.req.valid('json');

      try {
        const result = await boostService.createBoostCheckout({
          communityId,
          unifiedIdentityId,
          boostCount,
          successUrl,
          cancelUrl,
        });

        if (!result.success) {
          return c.json({
            success: false,
            error: result.error,
          }, 400);
        }

        return c.json({
          success: true,
          checkoutUrl: result.checkoutUrl,
        });
      } catch (error) {
        console.error('Failed to create boost checkout:', error);
        return c.json({
          success: false,
          error: 'Failed to create checkout',
        }, 500);
      }
    }
  );

  /**
   * GET /portal
   * Get Stripe customer portal URL for boost management
   */
  router.get('/portal', async (c) => {
    const communityId = c.req.header('x-community-id');
    const unifiedIdentityId = c.req.header('x-identity-id');
    const returnUrl = c.req.query('returnUrl');

    if (!communityId || !unifiedIdentityId) {
      return c.json({
        success: false,
        error: 'Missing required headers: x-community-id, x-identity-id',
      }, 400);
    }

    if (!returnUrl) {
      return c.json({
        success: false,
        error: 'Missing required query param: returnUrl',
      }, 400);
    }

    try {
      const url = await boostService.getBoostPortalUrl(
        communityId,
        unifiedIdentityId,
        returnUrl
      );

      if (!url) {
        return c.json({
          success: false,
          error: 'No active boost subscription found',
        }, 404);
      }

      return c.json({
        success: true,
        portalUrl: url,
      });
    } catch (error) {
      console.error('Failed to get boost portal:', error);
      return c.json({
        success: false,
        error: 'Failed to get portal URL',
      }, 500);
    }
  });

  /**
   * GET /boosters/:communityId
   * List all boosters for a community
   */
  router.get('/boosters/:communityId', async (c) => {
    const communityId = c.req.param('communityId');

    try {
      const boosters = await boostService.listBoosters(communityId);

      return c.json({
        success: true,
        boosters,
        total: boosters.length,
        totalBoosts: boosters.reduce((sum, b) => sum + b.boostCount, 0),
      });
    } catch (error) {
      console.error('Failed to list boosters:', error);
      return c.json({
        success: false,
        error: 'Failed to list boosters',
      }, 500);
    }
  });

  /**
   * POST /grant
   * Admin: Grant free boost to user
   */
  router.post(
    '/grant',
    zValidator('json', grantSchema),
    async (c) => {
      const adminKey = c.req.header('x-api-key');
      
      if (adminKey !== process.env.ADMIN_API_KEY) {
        return c.json({
          success: false,
          error: 'Unauthorized',
        }, 401);
      }

      const { communityId, unifiedIdentityId, boostCount, reason, expiresAt } = c.req.valid('json');
      const grantedBy = c.req.header('x-admin-id') || 'admin';

      try {
        const result = await boostService.grantFreeBoost({
          communityId,
          unifiedIdentityId,
          boostCount,
          grantedBy,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });

        return c.json({
          success: true,
          boostId: result.id,
          message: `Granted ${boostCount} boost(s) to user`,
        });
      } catch (error) {
        console.error('Failed to grant boost:', error);
        return c.json({
          success: false,
          error: 'Failed to grant boost',
        }, 500);
      }
    }
  );

  /**
   * GET /is-booster/:communityId/:identityId
   * Quick check if user is a booster (for badge display)
   */
  router.get('/is-booster/:communityId/:identityId', async (c) => {
    const communityId = c.req.param('communityId');
    const identityId = c.req.param('identityId');

    try {
      const isBooster = await boostService.isUserBooster(communityId, identityId);

      return c.json({
        success: true,
        isBooster,
      });
    } catch (error) {
      return c.json({
        success: true,
        isBooster: false,
      });
    }
  });

  return router;
}

/**
 * =============================================================================
 * SIETCH UNIFIED - BADGE ROUTES
 * =============================================================================
 * 
 * Endpoints for Sietch Score Badge feature:
 * - GET /entitlement - Check badge entitlement status
 * - POST /purchase - Create purchase checkout
 * - GET /display/:platform/:platformId - Get badge display info (for bots)
 * - PUT /settings - Update display settings
 * - POST /grant - Admin: Grant badge to user
 * - DELETE /revoke - Admin: Revoke badge from user
 * 
 * @module routes/badge
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { BadgeService, BadgeStyle } from '../services/billing/badge.service';

// =============================================================================
// SCHEMAS
// =============================================================================

const purchaseSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const settingsSchema = z.object({
  isDisplayEnabled: z.boolean().optional(),
  displayOnDiscord: z.boolean().optional(),
  displayOnTelegram: z.boolean().optional(),
  badgeStyle: z.enum(['default', 'minimal', 'detailed']).optional(),
});

const grantSchema = z.object({
  unifiedIdentityId: z.string().uuid(),
  reason: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

const revokeSchema = z.object({
  unifiedIdentityId: z.string().uuid(),
  reason: z.string().min(1),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface BadgeRouteDeps {
  badgeService: BadgeService;
}

export function createBadgeRoutes({ badgeService }: BadgeRouteDeps): Hono {
  const router = new Hono();

  /**
   * GET /entitlement
   * Check badge entitlement for current user
   */
  router.get('/entitlement', async (c) => {
    const unifiedIdentityId = c.req.header('x-identity-id');
    const communityId = c.req.header('x-community-id');

    if (!unifiedIdentityId || !communityId) {
      return c.json({
        success: false,
        error: 'Missing required headers: x-identity-id, x-community-id',
      }, 400);
    }

    try {
      const entitlement = await badgeService.checkBadgeEntitlement(
        unifiedIdentityId,
        communityId
      );

      return c.json({
        success: true,
        entitlement,
      });
    } catch (error) {
      console.error('Failed to check badge entitlement:', error);
      return c.json({
        success: false,
        error: 'Failed to check entitlement',
      }, 500);
    }
  });

  /**
   * POST /purchase
   * Create Stripe checkout for badge purchase
   */
  router.post(
    '/purchase',
    zValidator('json', purchaseSchema),
    async (c) => {
      const unifiedIdentityId = c.req.header('x-identity-id');
      const communityId = c.req.header('x-community-id');

      if (!unifiedIdentityId || !communityId) {
        return c.json({
          success: false,
          error: 'Missing required headers: x-identity-id, x-community-id',
        }, 400);
      }

      const { successUrl, cancelUrl } = c.req.valid('json');

      try {
        const result = await badgeService.createPurchaseCheckout({
          unifiedIdentityId,
          communityId,
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
        console.error('Failed to create badge checkout:', error);
        return c.json({
          success: false,
          error: 'Failed to create checkout',
        }, 500);
      }
    }
  );

  /**
   * GET /display/:platform/:platformId
   * Get badge display info for bots
   * Public endpoint - used by Discord/Telegram bots
   */
  router.get('/display/:platform/:platformId', async (c) => {
    const platform = c.req.param('platform') as 'discord' | 'telegram';
    const platformId = c.req.param('platformId');

    if (!['discord', 'telegram'].includes(platform)) {
      return c.json({
        success: false,
        error: 'Invalid platform. Must be discord or telegram.',
      }, 400);
    }

    try {
      // First check if should display
      const shouldDisplay = await badgeService.shouldDisplayBadge(platform, platformId);
      
      if (!shouldDisplay) {
        return c.json({
          success: true,
          display: null,
          message: 'Badge not enabled for this user',
        });
      }

      const display = await badgeService.getBadgeDisplay(platform, platformId);

      return c.json({
        success: true,
        display,
      });
    } catch (error) {
      console.error('Failed to get badge display:', error);
      return c.json({
        success: false,
        error: 'Failed to get display info',
      }, 500);
    }
  });

  /**
   * PUT /settings
   * Update badge display settings
   */
  router.put(
    '/settings',
    zValidator('json', settingsSchema),
    async (c) => {
      const unifiedIdentityId = c.req.header('x-identity-id');

      if (!unifiedIdentityId) {
        return c.json({
          success: false,
          error: 'Missing required header: x-identity-id',
        }, 400);
      }

      const settings = c.req.valid('json');

      try {
        await badgeService.updateDisplaySettings(unifiedIdentityId, settings);

        return c.json({
          success: true,
          message: 'Badge settings updated',
        });
      } catch (error) {
        console.error('Failed to update badge settings:', error);
        return c.json({
          success: false,
          error: 'Failed to update settings',
        }, 500);
      }
    }
  );

  /**
   * POST /grant
   * Admin: Grant badge to user
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

      const { unifiedIdentityId, reason, expiresAt } = c.req.valid('json');
      const grantedBy = c.req.header('x-admin-id') || 'admin';

      try {
        const result = await badgeService.grantBadge({
          unifiedIdentityId,
          grantedBy,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });

        return c.json({
          success: true,
          badgeId: result.id,
          message: `Badge granted to user ${unifiedIdentityId}`,
        });
      } catch (error) {
        console.error('Failed to grant badge:', error);
        return c.json({
          success: false,
          error: 'Failed to grant badge',
        }, 500);
      }
    }
  );

  /**
   * DELETE /revoke
   * Admin: Revoke badge from user
   */
  router.delete(
    '/revoke',
    zValidator('json', revokeSchema),
    async (c) => {
      const adminKey = c.req.header('x-api-key');
      
      if (adminKey !== process.env.ADMIN_API_KEY) {
        return c.json({
          success: false,
          error: 'Unauthorized',
        }, 401);
      }

      const { unifiedIdentityId, reason } = c.req.valid('json');
      const revokedBy = c.req.header('x-admin-id') || 'admin';

      try {
        await badgeService.revokeBadge({
          unifiedIdentityId,
          revokedBy,
          reason,
        });

        return c.json({
          success: true,
          message: `Badge revoked from user ${unifiedIdentityId}`,
        });
      } catch (error) {
        console.error('Failed to revoke badge:', error);
        return c.json({
          success: false,
          error: 'Failed to revoke badge',
        }, 500);
      }
    }
  );

  /**
   * GET /styles
   * Get available badge styles (public)
   */
  router.get('/styles', (c) => {
    return c.json({
      success: true,
      styles: [
        {
          id: 'default',
          name: 'Default',
          preview: '⚡ 847 | Fedaykin',
          description: 'Shows score and tier',
        },
        {
          id: 'minimal',
          name: 'Minimal',
          preview: '⚡847',
          description: 'Just the score',
        },
        {
          id: 'detailed',
          name: 'Detailed',
          preview: 'Sietch Score: 847 | Rank: Fedaykin',
          description: 'Full format with labels',
        },
      ],
      price: {
        amount: 499,
        currency: 'usd',
        formatted: '$4.99',
        note: 'One-time purchase. Free for Premium+ communities.',
      },
    });
  });

  return router;
}

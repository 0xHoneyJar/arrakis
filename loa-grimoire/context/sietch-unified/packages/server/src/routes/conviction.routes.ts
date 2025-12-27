/**
 * =============================================================================
 * SIETCH UNIFIED - CONVICTION ROUTES
 * =============================================================================
 * 
 * Handles conviction scoring, tier evaluation, and rankings.
 * 
 * Endpoints:
 * - GET /:wallet - Get conviction score for wallet
 * - GET /tier/:wallet - Get tier (Naib/Fedaykin/None) for wallet
 * - GET /leaderboard - Get top ranked members
 * - POST /refresh - Force refresh conviction cache (admin)
 * 
 * @module routes/conviction
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { ConvictionEngineService } from '../services/conviction/conviction-engine.service';
import type { GatekeeperService } from '../services/billing/gatekeeper.service';

// =============================================================================
// SCHEMAS
// =============================================================================

const walletParamSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  tier: z.enum(['naib', 'fedaykin', 'all']).optional().default('all'),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface ConvictionRouteDeps {
  convictionService: ConvictionEngineService;
  gatekeeper: GatekeeperService | null;
}

export function createConvictionRoutes({ convictionService, gatekeeper }: ConvictionRouteDeps): Hono {
  const router = new Hono();

  /**
   * GET /:wallet
   * Get full conviction breakdown for a wallet address
   */
  router.get('/:wallet', async (c) => {
    const wallet = c.req.param('wallet');

    // Validate wallet format
    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return c.json({
        success: false,
        error: 'Invalid wallet address format',
      }, 400);
    }

    // Check feature access if gatekeeper available
    const communityId = c.req.header('x-community-id');
    if (gatekeeper && communityId) {
      const access = await gatekeeper.checkAccess(communityId, 'conviction_engine');
      if (!access.allowed) {
        return c.json({
          success: false,
          error: 'Conviction engine requires Premium tier',
          upgradeUrl: access.upgradeUrl,
        }, 403);
      }
    }

    try {
      const conviction = await convictionService.evaluateConviction(wallet);

      return c.json({
        success: true,
        conviction: {
          wallet,
          score: conviction.score,
          rank: conviction.rank,
          tier: conviction.tier,
          breakdown: {
            holdings: conviction.components.holdings,
            governance: conviction.components.governance,
            engagement: conviction.components.engagement,
          },
          badges: conviction.badges,
          lastUpdated: conviction.lastUpdated,
        },
      });
    } catch (error) {
      console.error('Failed to evaluate conviction:', error);
      return c.json({
        success: false,
        error: 'Failed to evaluate conviction',
      }, 500);
    }
  });

  /**
   * GET /tier/:wallet
   * Get just the tier for a wallet (lightweight check)
   */
  router.get('/tier/:wallet', async (c) => {
    const wallet = c.req.param('wallet');

    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return c.json({
        success: false,
        error: 'Invalid wallet address format',
      }, 400);
    }

    try {
      const tier = await convictionService.getTier(wallet);

      return c.json({
        success: true,
        wallet,
        tier: tier.name,
        rank: tier.rank,
        eligible: tier.eligible,
      });
    } catch (error) {
      console.error('Failed to get tier:', error);
      return c.json({
        success: false,
        error: 'Failed to determine tier',
      }, 500);
    }
  });

  /**
   * GET /leaderboard
   * Get ranked leaderboard of members
   */
  router.get('/leaderboard', async (c) => {
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const tier = c.req.query('tier') || 'all';

    // Check feature access
    const communityId = c.req.header('x-community-id');
    if (gatekeeper && communityId) {
      const access = await gatekeeper.checkAccess(communityId, 'member_directory');
      if (!access.allowed) {
        return c.json({
          success: false,
          error: 'Leaderboard requires Premium tier',
          upgradeUrl: access.upgradeUrl,
        }, 403);
      }
    }

    try {
      const leaderboard = await convictionService.getLeaderboard({
        limit: Math.min(limit, 100),
        offset,
        tier: tier === 'all' ? undefined : tier as 'naib' | 'fedaykin',
      });

      return c.json({
        success: true,
        leaderboard: leaderboard.entries.map((entry, index) => ({
          rank: offset + index + 1,
          wallet: entry.wallet,
          nym: entry.nym,
          score: entry.score,
          tier: entry.tier,
          badges: entry.badges,
        })),
        pagination: {
          total: leaderboard.total,
          limit,
          offset,
          hasMore: offset + limit < leaderboard.total,
        },
      });
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve leaderboard',
      }, 500);
    }
  });

  /**
   * GET /badges/:wallet
   * Get badges earned by a wallet
   */
  router.get('/badges/:wallet', async (c) => {
    const wallet = c.req.param('wallet');

    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return c.json({
        success: false,
        error: 'Invalid wallet address format',
      }, 400);
    }

    try {
      const badges = await convictionService.getBadges(wallet);

      return c.json({
        success: true,
        wallet,
        badges: badges.map(badge => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          earnedAt: badge.earnedAt,
          metadata: badge.metadata,
        })),
      });
    } catch (error) {
      console.error('Failed to get badges:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve badges',
      }, 500);
    }
  });

  /**
   * GET /history/:wallet
   * Get conviction score history for a wallet
   */
  router.get('/history/:wallet', async (c) => {
    const wallet = c.req.param('wallet');
    const days = parseInt(c.req.query('days') || '30', 10);

    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return c.json({
        success: false,
        error: 'Invalid wallet address format',
      }, 400);
    }

    try {
      const history = await convictionService.getScoreHistory(wallet, days);

      return c.json({
        success: true,
        wallet,
        history: history.map(entry => ({
          date: entry.date,
          score: entry.score,
          rank: entry.rank,
          tier: entry.tier,
        })),
      });
    } catch (error) {
      console.error('Failed to get history:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve history',
      }, 500);
    }
  });

  return router;
}

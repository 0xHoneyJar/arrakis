/**
 * =============================================================================
 * SIETCH UNIFIED - DIRECTORY ROUTES
 * =============================================================================
 * 
 * Handles member directory browsing with privacy controls.
 * 
 * Endpoints:
 * - GET / - Browse member directory
 * - GET /search - Search members by nym
 * - GET /stats - Get directory statistics
 * 
 * Requires Premium tier for access.
 * 
 * @module routes/directory
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import type { GatekeeperService } from '../services/billing/gatekeeper.service';

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface DirectoryRouteDeps {
  prisma: PrismaClient;
  gatekeeper: GatekeeperService | null;
}

export function createDirectoryRoutes({ prisma, gatekeeper }: DirectoryRouteDeps): Hono {
  const router = new Hono();

  /**
   * Middleware: Check directory access (Premium feature)
   */
  router.use('*', async (c, next) => {
    const communityId = c.req.header('x-community-id');
    
    if (gatekeeper && communityId) {
      const access = await gatekeeper.checkAccess(communityId, 'member_directory');
      
      if (!access.allowed) {
        return c.json({
          success: false,
          error: 'Member directory requires Premium tier',
          upgradeRequired: access.upgradeRequired,
          upgradeUrl: access.upgradeUrl,
        }, 403);
      }
      
      // Add grace period warning if applicable
      if (access.reason === 'grace_period_active') {
        c.header('X-Grace-Period-Remaining', String(access.graceRemaining));
      }
    }
    
    await next();
  });

  /**
   * GET /
   * Browse member directory with pagination and filters
   */
  router.get('/', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const tier = c.req.query('tier'); // 'naib', 'fedaykin', or undefined for all
    const sortBy = c.req.query('sort') || 'rank'; // 'rank', 'nym', 'recent'

    try {
      // Build where clause
      const where: any = {
        profile: {
          // Only show members who opted into directory
          preferences: {
            path: ['showInDirectory'],
            equals: true,
          },
        },
      };

      if (tier) {
        where.tier = tier;
      }

      // Build order clause
      let orderBy: any = { rank: 'asc' };
      switch (sortBy) {
        case 'nym':
          orderBy = { profile: { nym: 'asc' } };
          break;
        case 'recent':
          orderBy = { createdAt: 'desc' };
          break;
      }

      // Get total count
      const total = await prisma.unifiedIdentity.count({
        where: {
          ...where,
          tier: tier ? tier : { in: ['naib', 'fedaykin'] },
        },
      });

      // Get members
      const members = await prisma.unifiedIdentity.findMany({
        where: {
          ...where,
          tier: tier ? tier : { in: ['naib', 'fedaykin'] },
        },
        include: {
          profile: true,
        },
        orderBy,
        skip: offset,
        take: limit,
      });

      return c.json({
        success: true,
        directory: members.map(member => ({
          id: member.id,
          nym: member.profile?.nym || `Member-${member.id.slice(0, 8)}`,
          tier: member.tier,
          rank: member.rank,
          badges: (member.profile?.badges as string[]) || [],
          // Don't expose wallet unless member opted in
          wallet: (member.profile?.preferences as any)?.showWallet 
            ? member.primaryWallet 
            : null,
          joinedAt: member.createdAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error('Failed to get directory:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve directory',
      }, 500);
    }
  });

  /**
   * GET /search
   * Search members by nym
   */
  router.get('/search', async (c) => {
    const query = c.req.query('q');
    const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50);

    if (!query || query.length < 2) {
      return c.json({
        success: false,
        error: 'Search query must be at least 2 characters',
      }, 400);
    }

    try {
      const members = await prisma.unifiedIdentity.findMany({
        where: {
          profile: {
            nym: {
              contains: query,
              mode: 'insensitive',
            },
            preferences: {
              path: ['showInDirectory'],
              equals: true,
            },
          },
          tier: { in: ['naib', 'fedaykin'] },
        },
        include: {
          profile: true,
        },
        take: limit,
        orderBy: { rank: 'asc' },
      });

      return c.json({
        success: true,
        results: members.map(member => ({
          id: member.id,
          nym: member.profile?.nym,
          tier: member.tier,
          rank: member.rank,
        })),
        query,
      });
    } catch (error) {
      console.error('Failed to search directory:', error);
      return c.json({
        success: false,
        error: 'Failed to search directory',
      }, 500);
    }
  });

  /**
   * GET /stats
   * Get directory statistics
   */
  router.get('/stats', async (c) => {
    try {
      // Count by tier
      const [naibCount, fedaykinCount, totalCount] = await Promise.all([
        prisma.unifiedIdentity.count({ where: { tier: 'naib' } }),
        prisma.unifiedIdentity.count({ where: { tier: 'fedaykin' } }),
        prisma.unifiedIdentity.count(),
      ]);

      // Get recent activity
      const recentJoins = await prisma.unifiedIdentity.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      });

      // Get public directory count
      const publicCount = await prisma.unifiedIdentity.count({
        where: {
          profile: {
            preferences: {
              path: ['showInDirectory'],
              equals: true,
            },
          },
        },
      });

      return c.json({
        success: true,
        stats: {
          total: totalCount,
          byTier: {
            naib: naibCount,
            fedaykin: fedaykinCount,
            none: totalCount - naibCount - fedaykinCount,
          },
          publicProfiles: publicCount,
          recentJoins,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to get stats:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve statistics',
      }, 500);
    }
  });

  return router;
}

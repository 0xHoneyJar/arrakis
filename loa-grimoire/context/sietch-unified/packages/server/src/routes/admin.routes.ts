/**
 * =============================================================================
 * SIETCH UNIFIED - ADMIN ROUTES
 * =============================================================================
 * 
 * Protected management endpoints for platform owners and community admins.
 * 
 * Endpoints:
 * - POST /refresh-rankings - Force refresh conviction rankings
 * - GET /stats - Get community statistics
 * - POST /decay - Trigger manual decay cycle
 * - GET /audit-log - Get audit log entries
 * - POST /cache/invalidate - Invalidate caches
 * - GET /health/deep - Deep health check
 * 
 * Fee Waiver Management (Owner Only):
 * - POST /waivers - Grant fee waiver (complimentary access)
 * - GET /waivers - List all fee waivers
 * - GET /waivers/:communityId - Get waiver details
 * - DELETE /waivers/:communityId - Revoke fee waiver
 * 
 * Requires admin API key authentication.
 * 
 * @module routes/admin
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import type { ConvictionEngineService } from '../services/conviction/conviction-engine.service';
import type { GatekeeperService } from '../services/billing/gatekeeper.service';

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface AdminRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  convictionService: ConvictionEngineService;
  gatekeeper: GatekeeperService | null;
}

export function createAdminRoutes({ prisma, redis, convictionService, gatekeeper }: AdminRouteDeps): Hono {
  const router = new Hono();

  /**
   * Middleware: Verify admin API key
   */
  router.use('*', async (c, next) => {
    const apiKey = c.req.header('x-api-key');
    const adminKey = process.env.ADMIN_API_KEY;

    if (!apiKey || apiKey !== adminKey) {
      return c.json({
        success: false,
        error: 'Unauthorized - Invalid API key',
      }, 401);
    }

    await next();
  });

  /**
   * POST /refresh-rankings
   * Force refresh conviction rankings for all members
   */
  router.post('/refresh-rankings', async (c) => {
    const communityId = c.req.header('x-community-id');

    // Check if admin balance check is allowed (tier-gated)
    if (gatekeeper && communityId) {
      // This is an admin-initiated balance check, count against quota
      const entitlement = await gatekeeper.getEntitlement(communityId);
      if (entitlement && entitlement.limits.adminBalanceChecks === 0) {
        return c.json({
          success: false,
          error: 'Admin balance checks require Exclusive tier or higher',
        }, 403);
      }
    }

    try {
      const startTime = Date.now();
      
      // Get all identities that need refresh
      const identities = await prisma.unifiedIdentity.findMany({
        select: { primaryWallet: true },
      });

      let processed = 0;
      let errors = 0;

      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < identities.length; i += batchSize) {
        const batch = identities.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (identity) => {
            try {
              await convictionService.evaluateConviction(identity.primaryWallet);
              processed++;
            } catch {
              errors++;
            }
          })
        );
      }

      const duration = Date.now() - startTime;

      // Log the action
      await prisma.auditLog.create({
        data: {
          action: 'refresh_rankings',
          actor: 'admin',
          metadata: {
            processed,
            errors,
            duration,
          },
        },
      });

      return c.json({
        success: true,
        result: {
          processed,
          errors,
          duration: `${duration}ms`,
        },
      });
    } catch (error) {
      console.error('Failed to refresh rankings:', error);
      return c.json({
        success: false,
        error: 'Failed to refresh rankings',
      }, 500);
    }
  });

  /**
   * GET /stats
   * Get comprehensive community statistics
   */
  router.get('/stats', async (c) => {
    try {
      // Get member counts
      const [totalMembers, naibCount, fedaykinCount, verifiedLast24h] = await Promise.all([
        prisma.unifiedIdentity.count(),
        prisma.unifiedIdentity.count({ where: { tier: 'naib' } }),
        prisma.unifiedIdentity.count({ where: { tier: 'fedaykin' } }),
        prisma.unifiedIdentity.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      // Get platform distribution
      const [discordAccounts, telegramAccounts] = await Promise.all([
        prisma.linkedAccount.count({ where: { platform: 'discord' } }),
        prisma.linkedAccount.count({ where: { platform: 'telegram' } }),
      ]);

      // Get wallet count
      const walletCount = await prisma.linkedWallet.count();

      // Get recent activity
      const recentSessions = await prisma.verificationSession.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      // Get subscription stats if gatekeeper available
      let subscriptionStats = null;
      if (gatekeeper) {
        const subscriptions = await prisma.communitySubscription.groupBy({
          by: ['tier'],
          _count: true,
        });
        subscriptionStats = subscriptions.reduce((acc, sub) => {
          acc[sub.tier] = sub._count;
          return acc;
        }, {} as Record<string, number>);
      }

      return c.json({
        success: true,
        stats: {
          members: {
            total: totalMembers,
            byTier: {
              naib: naibCount,
              fedaykin: fedaykinCount,
              none: totalMembers - naibCount - fedaykinCount,
            },
            verifiedLast24h,
          },
          platforms: {
            discord: discordAccounts,
            telegram: telegramAccounts,
          },
          wallets: {
            total: walletCount,
          },
          activity: {
            verificationSessionsLast24h: recentSessions,
          },
          subscriptions: subscriptionStats,
          generatedAt: new Date().toISOString(),
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

  /**
   * POST /decay
   * Trigger manual activity decay cycle
   */
  router.post('/decay', async (c) => {
    try {
      const startTime = Date.now();
      
      // Run decay on all members with activity
      const result = await convictionService.runDecayCycle();
      
      const duration = Date.now() - startTime;

      // Log the action
      await prisma.auditLog.create({
        data: {
          action: 'manual_decay',
          actor: 'admin',
          metadata: {
            affected: result.affected,
            duration,
          },
        },
      });

      return c.json({
        success: true,
        result: {
          affected: result.affected,
          decayRate: result.decayRate,
          duration: `${duration}ms`,
        },
      });
    } catch (error) {
      console.error('Failed to run decay:', error);
      return c.json({
        success: false,
        error: 'Failed to run decay cycle',
      }, 500);
    }
  });

  /**
   * GET /audit-log
   * Get audit log entries
   */
  router.get('/audit-log', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const action = c.req.query('action');

    try {
      const where: any = {};
      if (action) {
        where.action = action;
      }

      const [entries, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return c.json({
        success: true,
        auditLog: entries.map(entry => ({
          id: entry.id,
          action: entry.action,
          actor: entry.actor,
          metadata: entry.metadata,
          createdAt: entry.createdAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error('Failed to get audit log:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve audit log',
      }, 500);
    }
  });

  /**
   * POST /cache/invalidate
   * Invalidate caches
   */
  router.post('/cache/invalidate', async (c) => {
    const target = c.req.query('target'); // 'all', 'entitlements', 'conviction', or specific communityId

    try {
      let keysDeleted = 0;

      if (target === 'all' || target === 'entitlements') {
        const keys = await redis.keys('entitlement:*');
        if (keys.length > 0) {
          keysDeleted += await redis.del(...keys);
        }
      }

      if (target === 'all' || target === 'conviction') {
        const keys = await redis.keys('conviction:*');
        if (keys.length > 0) {
          keysDeleted += await redis.del(...keys);
        }
      }

      // If target is a specific community ID
      if (target && target !== 'all' && target !== 'entitlements' && target !== 'conviction') {
        if (gatekeeper) {
          await gatekeeper.invalidateCache(target);
        }
        const keys = await redis.keys(`*:${target}:*`);
        if (keys.length > 0) {
          keysDeleted += await redis.del(...keys);
        }
        keysDeleted++; // Count the gatekeeper invalidation
      }

      // Log the action
      await prisma.auditLog.create({
        data: {
          action: 'cache_invalidate',
          actor: 'admin',
          metadata: {
            target,
            keysDeleted,
          },
        },
      });

      return c.json({
        success: true,
        result: {
          target,
          keysDeleted,
        },
      });
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
      return c.json({
        success: false,
        error: 'Failed to invalidate cache',
      }, 500);
    }
  });

  /**
   * GET /health/deep
   * Deep health check with all dependencies
   */
  router.get('/health/deep', async (c) => {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // Database check
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      checks.database = { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    // Redis check
    try {
      const start = Date.now();
      await redis.ping();
      checks.redis = { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      checks.redis = { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    // Determine overall status
    const allHealthy = Object.values(checks).every(c => c.status === 'healthy');

    return c.json({
      success: allHealthy,
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    }, allHealthy ? 200 : 503);
  });

  // ===========================================================================
  // FEE WAIVER MANAGEMENT (Owner Only)
  // ===========================================================================

  /**
   * POST /waivers
   * Grant a fee waiver to a community (complimentary full access)
   */
  router.post('/waivers', async (c) => {
    if (!gatekeeper) {
      return c.json({
        success: false,
        error: 'Billing not configured',
      }, 503);
    }

    try {
      const body = await c.req.json();
      const { communityId, tier, reason, expiresAt, internalNotes } = body;

      if (!communityId || !reason) {
        return c.json({
          success: false,
          error: 'communityId and reason are required',
        }, 400);
      }

      const grantedBy = c.req.header('x-admin-id') || 'owner';

      const waiver = await gatekeeper.grantWaiver({
        communityId,
        tier: tier || 'enterprise',
        reason,
        grantedBy,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        internalNotes,
      });

      return c.json({
        success: true,
        waiver,
        message: `Fee waiver granted to community ${communityId}`,
      });
    } catch (error) {
      console.error('Failed to grant waiver:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to grant waiver',
      }, 400);
    }
  });

  /**
   * GET /waivers
   * List all fee waivers
   */
  router.get('/waivers', async (c) => {
    if (!gatekeeper) {
      return c.json({
        success: false,
        error: 'Billing not configured',
      }, 503);
    }

    try {
      const includeExpired = c.req.query('includeExpired') === 'true';
      const includeRevoked = c.req.query('includeRevoked') === 'true';

      const waivers = await gatekeeper.listWaivers({
        includeExpired,
        includeRevoked,
      });

      return c.json({
        success: true,
        waivers,
        total: waivers.length,
      });
    } catch (error) {
      console.error('Failed to list waivers:', error);
      return c.json({
        success: false,
        error: 'Failed to list waivers',
      }, 500);
    }
  });

  /**
   * GET /waivers/:communityId
   * Get waiver details for a specific community
   */
  router.get('/waivers/:communityId', async (c) => {
    if (!gatekeeper) {
      return c.json({
        success: false,
        error: 'Billing not configured',
      }, 503);
    }

    const communityId = c.req.param('communityId');

    try {
      const waiver = await gatekeeper.getWaiver(communityId);

      if (!waiver) {
        return c.json({
          success: false,
          error: 'No waiver found for this community',
        }, 404);
      }

      return c.json({
        success: true,
        waiver,
      });
    } catch (error) {
      console.error('Failed to get waiver:', error);
      return c.json({
        success: false,
        error: 'Failed to get waiver',
      }, 500);
    }
  });

  /**
   * DELETE /waivers/:communityId
   * Revoke a fee waiver from a community
   */
  router.delete('/waivers/:communityId', async (c) => {
    if (!gatekeeper) {
      return c.json({
        success: false,
        error: 'Billing not configured',
      }, 503);
    }

    const communityId = c.req.param('communityId');

    try {
      const body = await c.req.json().catch(() => ({}));
      const reason = body.reason || 'Waiver revoked by admin';
      const revokedBy = c.req.header('x-admin-id') || 'owner';

      await gatekeeper.revokeWaiver({
        communityId,
        revokedBy,
        reason,
      });

      return c.json({
        success: true,
        message: `Fee waiver revoked for community ${communityId}`,
      });
    } catch (error) {
      console.error('Failed to revoke waiver:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke waiver',
      }, 400);
    }
  });

  return router;
}

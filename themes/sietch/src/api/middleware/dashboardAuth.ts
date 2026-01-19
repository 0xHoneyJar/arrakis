/**
 * Dashboard Authentication Middleware
 *
 * Sprint 115: Session & Auth Middleware
 *
 * Provides authentication middleware for dashboard API endpoints.
 *
 * Middleware Stack (for write operations):
 * 1. requireDashboardAuth - Validates session cookie
 * 2. liveAdminCheck - Re-verifies Discord admin status
 *
 * @module api/middleware/dashboardAuth
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';
import {
  getSession,
  storeSession,
  SESSION_COOKIE_NAME,
  hasAdminPermissions,
  type DashboardSession,
} from '../routes/dashboard/auth.routes.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Request with authenticated dashboard session
 */
export interface AuthenticatedDashboardRequest extends Request {
  dashboardSession: DashboardSession;
  serverId?: string;
}

/**
 * Dependencies for dashboard auth middleware
 */
export interface DashboardAuthMiddlewareDeps {
  redis?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
    del: (key: string) => Promise<void>;
  };
  guildId: string;
}

// =============================================================================
// Constants
// =============================================================================

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Cache live admin check results for 5 minutes
const LIVE_ADMIN_CHECK_CACHE = new Map<
  string,
  {
    isAdmin: boolean;
    checkedAt: number;
  }
>();
const LIVE_ADMIN_CHECK_TTL = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Middleware Factory
// =============================================================================

/**
 * Create dashboard authentication middleware
 */
export function createDashboardAuthMiddleware(deps: DashboardAuthMiddlewareDeps) {
  const { redis, guildId } = deps;

  /**
   * Require authenticated dashboard session
   *
   * Validates the session cookie and attaches session to request.
   * Returns 401 if not authenticated.
   *
   * @example
   * router.get('/config', requireDashboardAuth, handler);
   */
  async function requireDashboardAuth(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.cookies[SESSION_COOKIE_NAME];

      if (!sessionId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const session = await getSession(sessionId, redis);

      if (!session) {
        // Clear invalid cookie
        res.clearCookie(SESSION_COOKIE_NAME);
        res.status(401).json({
          error: 'SESSION_EXPIRED',
          message: 'Session expired. Please log in again.',
        });
        return;
      }

      // Check if session is too old (24 hours)
      const sessionAge = Date.now() - session.createdAt;
      const maxAge = 24 * 60 * 60 * 1000;

      if (sessionAge > maxAge) {
        res.clearCookie(SESSION_COOKIE_NAME);
        res.status(401).json({
          error: 'SESSION_EXPIRED',
          message: 'Session expired. Please log in again.',
        });
        return;
      }

      // Update last activity
      session.lastActivity = Date.now();
      await storeSession(sessionId, session, redis);

      // Attach session to request
      (req as AuthenticatedDashboardRequest).dashboardSession = session;

      next();
    } catch (error) {
      logger.error({ error }, 'Dashboard auth middleware error');
      res.status(500).json({
        error: 'AUTH_ERROR',
        message: 'Authentication check failed',
      });
    }
  }

  /**
   * Live admin check middleware
   *
   * Re-verifies that the user still has admin permissions in Discord.
   * Should be used for write operations to prevent stale permission usage.
   *
   * @example
   * router.post('/config', requireDashboardAuth, liveAdminCheck, handler);
   */
  async function liveAdminCheck(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dashboardReq = req as AuthenticatedDashboardRequest;
      const { dashboardSession } = dashboardReq;

      if (!dashboardSession) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const serverId = req.params.serverId || guildId;
      const cacheKey = `${dashboardSession.userId}:${serverId}`;

      // Check cache first
      const cached = LIVE_ADMIN_CHECK_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.checkedAt < LIVE_ADMIN_CHECK_TTL) {
        if (!cached.isAdmin) {
          res.status(403).json({
            error: 'PERMISSION_REVOKED',
            message: 'You no longer have admin access to this server',
          });
          return;
        }
        dashboardReq.serverId = serverId;
        return next();
      }

      // Fetch current guild membership
      const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
        headers: {
          Authorization: `Bearer ${dashboardSession.accessToken}`,
        },
      });

      if (!response.ok) {
        // Token might be expired
        if (response.status === 401) {
          res.status(401).json({
            error: 'TOKEN_EXPIRED',
            message: 'Discord token expired. Please log in again.',
          });
          return;
        }
        throw new Error(`Discord API error: ${response.status}`);
      }

      interface GuildResponse {
        id: string;
        permissions: string;
      }

      const guilds = (await response.json()) as GuildResponse[];
      const targetGuild = guilds.find((g) => g.id === serverId);

      const isAdmin = targetGuild ? hasAdminPermissions(targetGuild.permissions) : false;

      // Update cache
      LIVE_ADMIN_CHECK_CACHE.set(cacheKey, {
        isAdmin,
        checkedAt: Date.now(),
      });

      if (!isAdmin) {
        logger.warn(
          { userId: dashboardSession.userId, serverId },
          'Live admin check failed - permission revoked'
        );
        res.status(403).json({
          error: 'PERMISSION_REVOKED',
          message: 'You no longer have admin access to this server',
        });
        return;
      }

      dashboardReq.serverId = serverId;
      next();
    } catch (error) {
      logger.error({ error }, 'Live admin check error');
      res.status(500).json({
        error: 'ADMIN_CHECK_ERROR',
        message: 'Failed to verify admin permissions',
      });
    }
  }

  /**
   * Invalidate live admin check cache for a user
   */
  function invalidateAdminCheckCache(userId: string, serverId?: string): void {
    if (serverId) {
      LIVE_ADMIN_CHECK_CACHE.delete(`${userId}:${serverId}`);
    } else {
      // Clear all entries for user
      for (const key of LIVE_ADMIN_CHECK_CACHE.keys()) {
        if (key.startsWith(`${userId}:`)) {
          LIVE_ADMIN_CHECK_CACHE.delete(key);
        }
      }
    }
  }

  /**
   * Session refresh middleware
   *
   * Extends session on activity. Optionally refreshes Discord token
   * if it's close to expiry.
   */
  async function sessionRefresh(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dashboardReq = req as AuthenticatedDashboardRequest;
      const { dashboardSession } = dashboardReq;

      if (!dashboardSession) {
        return next();
      }

      const sessionId = req.cookies[SESSION_COOKIE_NAME];
      if (!sessionId) {
        return next();
      }

      // Update last activity timestamp
      dashboardSession.lastActivity = Date.now();

      // Check if Discord token needs refresh (within 30 minutes of expiry)
      const refreshThreshold = 30 * 60 * 1000;
      const shouldRefreshToken =
        dashboardSession.tokenExpiresAt - Date.now() < refreshThreshold;

      if (shouldRefreshToken) {
        try {
          await refreshDiscordToken(dashboardSession);
        } catch (error) {
          // Log but don't fail the request - token refresh will be retried
          logger.warn({ error, userId: dashboardSession.userId }, 'Token refresh failed');
        }
      }

      // Save updated session
      await storeSession(sessionId, dashboardSession, redis);

      next();
    } catch (error) {
      logger.error({ error }, 'Session refresh error');
      // Don't fail the request on refresh errors
      next();
    }
  }

  /**
   * Refresh Discord access token
   */
  async function refreshDiscordToken(session: DashboardSession): Promise<void> {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Discord credentials');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    interface TokenResponse {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }

    const tokens = (await response.json()) as TokenResponse;

    session.accessToken = tokens.access_token;
    session.refreshToken = tokens.refresh_token;
    session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

    logger.debug({ userId: session.userId }, 'Discord token refreshed');
  }

  return {
    requireDashboardAuth,
    liveAdminCheck,
    sessionRefresh,
    invalidateAdminCheckCache,
  };
}

// =============================================================================
// Exports
// =============================================================================

export type DashboardAuthMiddleware = ReturnType<typeof createDashboardAuthMiddleware>;

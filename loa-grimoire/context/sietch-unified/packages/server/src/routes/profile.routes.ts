/**
 * =============================================================================
 * SIETCH UNIFIED - PROFILE ROUTES
 * =============================================================================
 * 
 * Handles user profiles, pseudonyms (nyms), and preferences.
 * 
 * Endpoints:
 * - GET /discord/:discordId - Get profile by Discord ID
 * - GET /telegram/:telegramId - Get profile by Telegram ID
 * - GET /wallet/:wallet - Get profile by wallet address
 * - PUT /nym - Update user's pseudonym (nym)
 * - PUT /preferences - Update profile preferences
 * - GET /badges - Get user's badges
 * 
 * @module routes/profile
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import type { GatekeeperService } from '../services/billing/gatekeeper.service';

// =============================================================================
// SCHEMAS
// =============================================================================

const updateNymSchema = z.object({
  nym: z.string()
    .min(3, 'Nym must be at least 3 characters')
    .max(32, 'Nym cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nym can only contain letters, numbers, underscores, and hyphens'),
});

const updatePreferencesSchema = z.object({
  showInDirectory: z.boolean().optional(),
  showRank: z.boolean().optional(),
  showBadges: z.boolean().optional(),
  notifications: z.object({
    rankChanges: z.boolean().optional(),
    badgeEarned: z.boolean().optional(),
    tierChanges: z.boolean().optional(),
  }).optional(),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface ProfileRouteDeps {
  prisma: PrismaClient;
  gatekeeper: GatekeeperService | null;
}

export function createProfileRoutes({ prisma, gatekeeper }: ProfileRouteDeps): Hono {
  const router = new Hono();

  /**
   * GET /discord/:discordId
   * Get profile by Discord ID
   */
  router.get('/discord/:discordId', async (c) => {
    const discordId = c.req.param('discordId');

    try {
      const account = await prisma.linkedAccount.findUnique({
        where: {
          platform_platformId: {
            platform: 'discord',
            platformId: discordId,
          },
        },
        include: {
          unifiedIdentity: {
            include: {
              profile: true,
              wallets: true,
            },
          },
        },
      });

      if (!account) {
        return c.json({
          success: false,
          error: 'Profile not found',
          verified: false,
        }, 404);
      }

      const identity = account.unifiedIdentity;
      const profile = identity.profile;

      return c.json({
        success: true,
        profile: {
          id: identity.id,
          nym: profile?.nym || null,
          tier: identity.tier,
          rank: identity.rank,
          primaryWallet: identity.primaryWallet,
          preferences: profile?.preferences || {},
          badges: profile?.badges || [],
          createdAt: identity.createdAt,
        },
      });
    } catch (error) {
      console.error('Failed to get profile:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve profile',
      }, 500);
    }
  });

  /**
   * GET /telegram/:telegramId
   * Get profile by Telegram ID
   */
  router.get('/telegram/:telegramId', async (c) => {
    const telegramId = c.req.param('telegramId');

    try {
      const account = await prisma.linkedAccount.findUnique({
        where: {
          platform_platformId: {
            platform: 'telegram',
            platformId: telegramId,
          },
        },
        include: {
          unifiedIdentity: {
            include: {
              profile: true,
              wallets: true,
            },
          },
        },
      });

      if (!account) {
        return c.json({
          success: false,
          error: 'Profile not found',
          verified: false,
        }, 404);
      }

      const identity = account.unifiedIdentity;
      const profile = identity.profile;

      return c.json({
        success: true,
        profile: {
          id: identity.id,
          nym: profile?.nym || null,
          tier: identity.tier,
          rank: identity.rank,
          primaryWallet: identity.primaryWallet,
          preferences: profile?.preferences || {},
          badges: profile?.badges || [],
          createdAt: identity.createdAt,
        },
      });
    } catch (error) {
      console.error('Failed to get profile:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve profile',
      }, 500);
    }
  });

  /**
   * GET /wallet/:wallet
   * Get profile by wallet address
   */
  router.get('/wallet/:wallet', async (c) => {
    const wallet = c.req.param('wallet');

    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return c.json({
        success: false,
        error: 'Invalid wallet address format',
      }, 400);
    }

    try {
      const identity = await prisma.unifiedIdentity.findUnique({
        where: { primaryWallet: wallet.toLowerCase() },
        include: {
          profile: true,
          wallets: true,
          accounts: true,
        },
      });

      if (!identity) {
        return c.json({
          success: false,
          error: 'Profile not found',
        }, 404);
      }

      const profile = identity.profile;

      return c.json({
        success: true,
        profile: {
          id: identity.id,
          nym: profile?.nym || null,
          tier: identity.tier,
          rank: identity.rank,
          primaryWallet: identity.primaryWallet,
          wallets: identity.wallets.map(w => ({
            address: w.address,
            chain: w.chain,
            isPrimary: w.isPrimary,
          })),
          platforms: identity.accounts.map(a => a.platform),
          preferences: profile?.preferences || {},
          badges: profile?.badges || [],
          createdAt: identity.createdAt,
        },
      });
    } catch (error) {
      console.error('Failed to get profile:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve profile',
      }, 500);
    }
  });

  /**
   * PUT /nym
   * Update user's pseudonym
   */
  router.put(
    '/nym',
    zValidator('json', updateNymSchema),
    async (c) => {
      const platform = c.req.header('x-platform');
      const platformId = c.req.header('x-platform-id');

      if (!platform || !platformId) {
        return c.json({
          success: false,
          error: 'Missing platform headers',
        }, 400);
      }

      const { nym } = c.req.valid('json');

      try {
        // Check if nym is already taken
        const existingNym = await prisma.userProfile.findFirst({
          where: {
            nym: { equals: nym, mode: 'insensitive' },
          },
        });

        if (existingNym) {
          return c.json({
            success: false,
            error: 'Nym is already taken',
          }, 409);
        }

        // Get identity
        const account = await prisma.linkedAccount.findUnique({
          where: {
            platform_platformId: {
              platform,
              platformId,
            },
          },
          include: {
            unifiedIdentity: true,
          },
        });

        if (!account) {
          return c.json({
            success: false,
            error: 'Identity not found',
          }, 404);
        }

        // Update or create profile
        const profile = await prisma.userProfile.upsert({
          where: { unifiedIdentityId: account.unifiedIdentityId },
          update: { nym },
          create: {
            unifiedIdentityId: account.unifiedIdentityId,
            nym,
          },
        });

        return c.json({
          success: true,
          nym: profile.nym,
        });
      } catch (error) {
        console.error('Failed to update nym:', error);
        return c.json({
          success: false,
          error: 'Failed to update nym',
        }, 500);
      }
    }
  );

  /**
   * PUT /preferences
   * Update profile preferences
   */
  router.put(
    '/preferences',
    zValidator('json', updatePreferencesSchema),
    async (c) => {
      const platform = c.req.header('x-platform');
      const platformId = c.req.header('x-platform-id');

      if (!platform || !platformId) {
        return c.json({
          success: false,
          error: 'Missing platform headers',
        }, 400);
      }

      const preferences = c.req.valid('json');

      try {
        const account = await prisma.linkedAccount.findUnique({
          where: {
            platform_platformId: {
              platform,
              platformId,
            },
          },
          include: {
            unifiedIdentity: {
              include: { profile: true },
            },
          },
        });

        if (!account) {
          return c.json({
            success: false,
            error: 'Identity not found',
          }, 404);
        }

        // Merge with existing preferences
        const existingPrefs = (account.unifiedIdentity.profile?.preferences as object) || {};
        const mergedPrefs = { ...existingPrefs, ...preferences };

        // Update or create profile
        const profile = await prisma.userProfile.upsert({
          where: { unifiedIdentityId: account.unifiedIdentityId },
          update: { preferences: mergedPrefs },
          create: {
            unifiedIdentityId: account.unifiedIdentityId,
            preferences: mergedPrefs,
          },
        });

        return c.json({
          success: true,
          preferences: profile.preferences,
        });
      } catch (error) {
        console.error('Failed to update preferences:', error);
        return c.json({
          success: false,
          error: 'Failed to update preferences',
        }, 500);
      }
    }
  );

  return router;
}

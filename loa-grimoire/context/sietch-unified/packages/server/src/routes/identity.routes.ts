/**
 * =============================================================================
 * SIETCH UNIFIED - IDENTITY ROUTES
 * =============================================================================
 * 
 * Handles identity verification and wallet linking via Collab.Land AccountKit.
 * 
 * Endpoints:
 * - POST /session - Create verification session
 * - POST /session/:id/complete - Complete verification
 * - GET /me - Get current user identity
 * - POST /link - Link additional wallet
 * - DELETE /link/:walletId - Unlink wallet
 * 
 * @module routes/identity
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { IdentityBridgeService } from '../services/identity/identity-bridge.service';
import type { GatekeeperService } from '../services/billing/gatekeeper.service';

// =============================================================================
// SCHEMAS
// =============================================================================

const createSessionSchema = z.object({
  platform: z.enum(['discord', 'telegram']),
  platformId: z.string().min(1),
  redirectUrl: z.string().url().optional(),
});

const completeSessionSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().min(1),
  message: z.string().min(1),
});

const linkWalletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(['ethereum', 'solana', 'polygon', 'base', 'berachain']).default('ethereum'),
  signature: z.string().min(1),
  message: z.string().min(1),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface IdentityRouteDeps {
  identityService: IdentityBridgeService;
  gatekeeper: GatekeeperService | null;
}

export function createIdentityRoutes({ identityService, gatekeeper }: IdentityRouteDeps): Hono {
  const router = new Hono();

  /**
   * POST /session
   * Create a new verification session for wallet linking
   */
  router.post(
    '/session',
    zValidator('json', createSessionSchema),
    async (c) => {
      const { platform, platformId, redirectUrl } = c.req.valid('json');

      try {
        const session = await identityService.createVerificationSession({
          platform,
          platformId,
          redirectUrl,
        });

        return c.json({
          success: true,
          session: {
            id: session.id,
            verifyUrl: session.verifyUrl,
            expiresAt: session.expiresAt,
          },
        }, 201);
      } catch (error) {
        console.error('Failed to create session:', error);
        return c.json({
          success: false,
          error: 'Failed to create verification session',
        }, 500);
      }
    }
  );

  /**
   * POST /session/:id/complete
   * Complete wallet verification with signed message
   */
  router.post(
    '/session/:id/complete',
    zValidator('json', completeSessionSchema),
    async (c) => {
      const sessionId = c.req.param('id');
      const { walletAddress, signature, message } = c.req.valid('json');

      try {
        const identity = await identityService.completeVerification({
          sessionId,
          walletAddress,
          signature,
          message,
        });

        return c.json({
          success: true,
          identity: {
            id: identity.id,
            primaryWallet: identity.primaryWallet,
            tier: identity.tier,
            rank: identity.rank,
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('expired')) {
          return c.json({
            success: false,
            error: 'Session expired',
          }, 410);
        }
        if (error instanceof Error && error.message.includes('signature')) {
          return c.json({
            success: false,
            error: 'Invalid signature',
          }, 400);
        }
        console.error('Failed to complete verification:', error);
        return c.json({
          success: false,
          error: 'Failed to complete verification',
        }, 500);
      }
    }
  );

  /**
   * GET /me
   * Get identity for authenticated user
   */
  router.get('/me', async (c) => {
    const platform = c.req.header('x-platform');
    const platformId = c.req.header('x-platform-id');

    if (!platform || !platformId) {
      return c.json({
        success: false,
        error: 'Missing platform headers',
      }, 400);
    }

    try {
      const identity = await identityService.getIdentityByPlatform(
        platform as 'discord' | 'telegram',
        platformId
      );

      if (!identity) {
        return c.json({
          success: false,
          error: 'Identity not found',
          verified: false,
        }, 404);
      }

      return c.json({
        success: true,
        identity: {
          id: identity.id,
          primaryWallet: identity.primaryWallet,
          tier: identity.tier,
          rank: identity.rank,
          wallets: identity.wallets,
          accounts: identity.accounts,
        },
      });
    } catch (error) {
      console.error('Failed to get identity:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve identity',
      }, 500);
    }
  });

  /**
   * POST /link
   * Link additional wallet to existing identity
   */
  router.post(
    '/link',
    zValidator('json', linkWalletSchema),
    async (c) => {
      const platform = c.req.header('x-platform');
      const platformId = c.req.header('x-platform-id');

      if (!platform || !platformId) {
        return c.json({
          success: false,
          error: 'Missing platform headers',
        }, 400);
      }

      const { walletAddress, chain, signature, message } = c.req.valid('json');

      try {
        const wallet = await identityService.linkAdditionalWallet({
          platform: platform as 'discord' | 'telegram',
          platformId,
          walletAddress,
          chain,
          signature,
          message,
        });

        return c.json({
          success: true,
          wallet: {
            id: wallet.id,
            address: wallet.address,
            chain: wallet.chain,
          },
        }, 201);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already linked')) {
          return c.json({
            success: false,
            error: 'Wallet already linked to another identity',
          }, 409);
        }
        console.error('Failed to link wallet:', error);
        return c.json({
          success: false,
          error: 'Failed to link wallet',
        }, 500);
      }
    }
  );

  /**
   * DELETE /link/:walletId
   * Unlink wallet from identity (cannot unlink primary)
   */
  router.delete('/link/:walletId', async (c) => {
    const walletId = c.req.param('walletId');
    const platform = c.req.header('x-platform');
    const platformId = c.req.header('x-platform-id');

    if (!platform || !platformId) {
      return c.json({
        success: false,
        error: 'Missing platform headers',
      }, 400);
    }

    try {
      await identityService.unlinkWallet({
        platform: platform as 'discord' | 'telegram',
        platformId,
        walletId,
      });

      return c.json({
        success: true,
        message: 'Wallet unlinked successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('primary')) {
        return c.json({
          success: false,
          error: 'Cannot unlink primary wallet',
        }, 400);
      }
      console.error('Failed to unlink wallet:', error);
      return c.json({
        success: false,
        error: 'Failed to unlink wallet',
      }, 500);
    }
  });

  return router;
}

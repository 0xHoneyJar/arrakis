/**
 * =============================================================================
 * SIETCH UNIFIED - IDENTITY BRIDGE SERVICE
 * =============================================================================
 * 
 * The "Global Embassy" - Uses Collab.Land AccountKit to bridge Discord UIDs 
 * and Telegram UIDs to a single verified wallet address.
 * 
 * @module services/identity/identity-bridge.service
 */

import { createHmac, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import type { CollabLandClient } from '../collabland/collabland-client.service';

// =============================================================================
// TYPES
// =============================================================================

export type Platform = 'discord' | 'telegram';

export interface VerificationSession {
  id: string;
  platform: Platform;
  platformId: string;
  verifyUrl: string;
  expiresAt: Date;
}

export interface IdentityWithRelations {
  id: string;
  primaryWallet: string;
  tier: string;
  rank: number | null;
  wallets: Array<{
    id: string;
    address: string;
    chain: string;
    isPrimary: boolean;
  }>;
  accounts: Array<{
    id: string;
    platform: string;
    platformId: string;
    username: string | null;
  }>;
  profile?: {
    nym: string | null;
    preferences: unknown;
    badges: unknown;
  } | null;
  createdAt: Date;
}

// =============================================================================
// IDENTITY BRIDGE SERVICE
// =============================================================================

interface IdentityBridgeServiceDeps {
  prisma: PrismaClient;
  redis: Redis;
  collabland: CollabLandClient;
}

export class IdentityBridgeService {
  private prisma: PrismaClient;
  private redis: Redis;
  private collabland: CollabLandClient;

  private readonly SESSION_TTL = 600;
  private readonly CACHE_TTL = 300;

  constructor(deps: IdentityBridgeServiceDeps) {
    this.prisma = deps.prisma;
    this.redis = deps.redis;
    this.collabland = deps.collabland;
  }

  /**
   * Create a new verification session for wallet linking
   */
  async createVerificationSession(params: {
    platform: Platform;
    platformId: string;
    redirectUrl?: string;
  }): Promise<VerificationSession> {
    const { platform, platformId, redirectUrl } = params;
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.SESSION_TTL * 1000);

    await this.prisma.verificationSession.create({
      data: {
        id: sessionId,
        platform,
        platformId,
        status: 'pending',
        expiresAt,
        metadata: redirectUrl ? { redirectUrl } : undefined,
      },
    });

    const verifyUrl = `${process.env.APP_URL || 'https://your-domain.com'}/verify?session=${sessionId}`;

    return { id: sessionId, platform, platformId, verifyUrl, expiresAt };
  }

  /**
   * Complete wallet verification with signed message
   */
  async completeVerification(params: {
    sessionId: string;
    walletAddress: string;
    signature: string;
    message: string;
  }): Promise<IdentityWithRelations> {
    const { sessionId, walletAddress, signature, message } = params;

    const session = await this.prisma.verificationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new Error('Session not found');
    if (session.status !== 'pending') throw new Error('Session already completed');
    if (session.expiresAt < new Date()) throw new Error('Session expired');

    const isValid = await this.collabland.verifyWalletSignature(walletAddress, message, signature);
    if (!isValid) throw new Error('Invalid signature');

    const identity = await this.createOrUpdateIdentity({
      platform: session.platform as Platform,
      platformId: session.platformId,
      walletAddress: walletAddress.toLowerCase(),
    });

    await this.prisma.verificationSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        walletAddress: walletAddress.toLowerCase(),
        completedAt: new Date(),
        unifiedIdentityId: identity.id,
      },
    });

    return identity;
  }

  /**
   * Get identity by platform and platform ID
   */
  async getIdentityByPlatform(platform: Platform, platformId: string): Promise<IdentityWithRelations | null> {
    const cacheKey = `identity:${platform}:${platformId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const account = await this.prisma.linkedAccount.findUnique({
      where: { platform_platformId: { platform, platformId } },
      include: {
        unifiedIdentity: {
          include: { wallets: true, accounts: true, profile: true },
        },
      },
    });

    if (!account) return null;

    const identity = this.mapToIdentityWithRelations(account.unifiedIdentity);
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(identity));
    return identity;
  }

  /**
   * Link additional wallet to existing identity
   */
  async linkAdditionalWallet(params: {
    platform: Platform;
    platformId: string;
    walletAddress: string;
    chain: string;
    signature: string;
    message: string;
  }): Promise<{ id: string; address: string; chain: string }> {
    const { platform, platformId, walletAddress, chain, signature, message } = params;

    const isValid = await this.collabland.verifyWalletSignature(walletAddress, message, signature);
    if (!isValid) throw new Error('Invalid signature');

    const identity = await this.getIdentityByPlatform(platform, platformId);
    if (!identity) throw new Error('Identity not found');

    const existingWallet = await this.prisma.linkedWallet.findUnique({
      where: { address: walletAddress.toLowerCase() },
    });

    if (existingWallet) {
      if (existingWallet.unifiedIdentityId === identity.id) {
        return { id: existingWallet.id, address: existingWallet.address, chain: existingWallet.chain };
      }
      throw new Error('Wallet already linked to another identity');
    }

    const wallet = await this.prisma.linkedWallet.create({
      data: {
        address: walletAddress.toLowerCase(),
        chain,
        isPrimary: false,
        verifiedAt: new Date(),
        verificationMethod: 'signature',
        unifiedIdentityId: identity.id,
      },
    });

    await this.invalidateCaches(identity);
    return { id: wallet.id, address: wallet.address, chain: wallet.chain };
  }

  /**
   * Unlink wallet from identity
   */
  async unlinkWallet(params: { platform: Platform; platformId: string; walletId: string }): Promise<void> {
    const { platform, platformId, walletId } = params;

    const identity = await this.getIdentityByPlatform(platform, platformId);
    if (!identity) throw new Error('Identity not found');

    const wallet = await this.prisma.linkedWallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.unifiedIdentityId !== identity.id) throw new Error('Wallet not found');
    if (wallet.isPrimary) throw new Error('Cannot unlink primary wallet');

    await this.prisma.linkedWallet.delete({ where: { id: walletId } });
    await this.invalidateCaches(identity);
  }

  /**
   * Update identity tier and rank
   */
  async updateTierAndRank(walletAddress: string, tier: string, rank: number): Promise<void> {
    await this.prisma.unifiedIdentity.update({
      where: { primaryWallet: walletAddress.toLowerCase() },
      data: { tier, rank },
    });

    const identity = await this.prisma.unifiedIdentity.findUnique({
      where: { primaryWallet: walletAddress.toLowerCase() },
      include: { accounts: true, wallets: true, profile: true },
    });

    if (identity) {
      await this.invalidateCaches(this.mapToIdentityWithRelations(identity as any));
    }
  }

  private async createOrUpdateIdentity(params: {
    platform: Platform;
    platformId: string;
    walletAddress: string;
  }): Promise<IdentityWithRelations> {
    const { platform, platformId, walletAddress } = params;

    let identity = await this.prisma.unifiedIdentity.findUnique({
      where: { primaryWallet: walletAddress },
      include: { wallets: true, accounts: true, profile: true },
    });

    if (identity) {
      const hasAccount = identity.accounts.some(
        a => a.platform === platform && a.platformId === platformId
      );

      if (!hasAccount) {
        await this.prisma.linkedAccount.create({
          data: {
            platform,
            platformId,
            linkedAt: new Date(),
            verifiedAt: new Date(),
            unifiedIdentityId: identity.id,
          },
        });

        identity = await this.prisma.unifiedIdentity.findUnique({
          where: { id: identity.id },
          include: { wallets: true, accounts: true, profile: true },
        });
      }
    } else {
      identity = await this.prisma.unifiedIdentity.create({
        data: {
          primaryWallet: walletAddress,
          tier: 'none',
          wallets: {
            create: {
              address: walletAddress,
              chain: 'ethereum',
              isPrimary: true,
              verifiedAt: new Date(),
              verificationMethod: 'signature',
            },
          },
          accounts: {
            create: {
              platform,
              platformId,
              linkedAt: new Date(),
              verifiedAt: new Date(),
            },
          },
        },
        include: { wallets: true, accounts: true, profile: true },
      });
    }

    return this.mapToIdentityWithRelations(identity!);
  }

  private mapToIdentityWithRelations(identity: any): IdentityWithRelations {
    return {
      id: identity.id,
      primaryWallet: identity.primaryWallet,
      tier: identity.tier,
      rank: identity.rank,
      wallets: identity.wallets.map((w: any) => ({
        id: w.id,
        address: w.address,
        chain: w.chain,
        isPrimary: w.isPrimary,
      })),
      accounts: identity.accounts.map((a: any) => ({
        id: a.id,
        platform: a.platform,
        platformId: a.platformId,
        username: a.username,
      })),
      profile: identity.profile
        ? { nym: identity.profile.nym, preferences: identity.profile.preferences, badges: identity.profile.badges }
        : null,
      createdAt: identity.createdAt,
    };
  }

  private async invalidateCaches(identity: IdentityWithRelations): Promise<void> {
    const keys = [
      `identity:wallet:${identity.primaryWallet}`,
      ...identity.accounts.map(a => `identity:${a.platform}:${a.platformId}`),
    ];
    for (const key of keys) await this.redis.del(key);
  }
}

/**
 * Verify Telegram Mini App initData
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string
): { valid: boolean; userId?: string; username?: string } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const checkHash = createHmac('sha256', secretKey).update(sortedParams).digest('hex');

    if (hash !== checkHash) return { valid: false };

    const userParam = params.get('user');
    if (userParam) {
      const user = JSON.parse(userParam);
      return { valid: true, userId: user.id?.toString(), username: user.username };
    }

    return { valid: true };
  } catch {
    return { valid: false };
  }
}

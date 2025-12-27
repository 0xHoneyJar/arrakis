/**
 * =============================================================================
 * SIETCH UNIFIED - CONVICTION ENGINE SERVICE
 * =============================================================================
 * 
 * Multi-factor conviction scoring engine that evaluates:
 * - BGT Holdings (40%)
 * - Governance Participation (30%)
 * - Engagement Activity (30%)
 * 
 * Includes demurrage (activity decay) at 10% per 6 hours.
 * 
 * @module services/conviction/conviction-engine.service
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

export type TierName = 'naib' | 'fedaykin' | 'none';

export interface ConvictionResult {
  wallet: string;
  score: number;
  rank: number;
  tier: TierName;
  components: {
    holdings: number;
    governance: number;
    engagement: number;
  };
  badges: string[];
  lastUpdated: Date;
}

export interface TierResult {
  name: TierName;
  rank: number;
  eligible: boolean;
}

export interface LeaderboardEntry {
  wallet: string;
  nym: string | null;
  score: number;
  tier: TierName;
  badges: string[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  earnedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ScoreHistoryEntry {
  date: Date;
  score: number;
  rank: number;
  tier: TierName;
}

interface ConvictionConfig {
  weights: {
    holdings: number;
    governance: number;
    engagement: number;
  };
  tiers: {
    naib: { minRank: number; maxRank: number };
    fedaykin: { minRank: number; maxRank: number };
  };
  demurrage: {
    rate: number;
    intervalHours: number;
  };
  badges: Array<{
    id: string;
    name: string;
    description: string;
    condition: string;
  }>;
}

// =============================================================================
// CONVICTION ENGINE SERVICE
// =============================================================================

interface ConvictionEngineServiceDeps {
  prisma: PrismaClient;
  redis: Redis;
  duneApiKey: string;
}

export class ConvictionEngineService {
  private prisma: PrismaClient;
  private redis: Redis;
  private duneApiKey: string;
  private config: ConvictionConfig;

  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly SCORE_CACHE_PREFIX = 'conviction:';

  constructor(deps: ConvictionEngineServiceDeps) {
    this.prisma = deps.prisma;
    this.redis = deps.redis;
    this.duneApiKey = deps.duneApiKey;
    this.config = this.loadConfig();
  }

  // ---------------------------------------------------------------------------
  // CONVICTION EVALUATION
  // ---------------------------------------------------------------------------

  /**
   * Evaluate full conviction score for a wallet
   */
  async evaluateConviction(walletAddress: string): Promise<ConvictionResult> {
    const wallet = walletAddress.toLowerCase();
    const cacheKey = `${this.SCORE_CACHE_PREFIX}${wallet}`;

    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch component scores
    const [holdings, governance, engagement] = await Promise.all([
      this.calculateHoldingsScore(wallet),
      this.calculateGovernanceScore(wallet),
      this.calculateEngagementScore(wallet),
    ]);

    // Apply weights
    const { weights } = this.config;
    const score = Math.round(
      holdings * weights.holdings +
      governance * weights.governance +
      engagement * weights.engagement
    );

    // Calculate rank
    const rank = await this.calculateRank(wallet, score);

    // Determine tier
    const tier = this.determineTier(rank);

    // Calculate badges
    const badges = await this.evaluateBadges(wallet, { holdings, governance, engagement, score });

    const result: ConvictionResult = {
      wallet,
      score,
      rank,
      tier,
      components: { holdings, governance, engagement },
      badges,
      lastUpdated: new Date(),
    };

    // Cache result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    // Update database
    await this.updateStoredScore(wallet, result);

    return result;
  }

  /**
   * Get just the tier for a wallet (lightweight)
   */
  async getTier(walletAddress: string): Promise<TierResult> {
    const wallet = walletAddress.toLowerCase();

    // Check if we have cached conviction
    const cached = await this.redis.get(`${this.SCORE_CACHE_PREFIX}${wallet}`);
    if (cached) {
      const conviction: ConvictionResult = JSON.parse(cached);
      return {
        name: conviction.tier,
        rank: conviction.rank,
        eligible: conviction.tier !== 'none',
      };
    }

    // Check database
    const identity = await this.prisma.unifiedIdentity.findUnique({
      where: { primaryWallet: wallet },
      select: { tier: true, rank: true },
    });

    if (identity) {
      return {
        name: identity.tier as TierName,
        rank: identity.rank || 0,
        eligible: identity.tier !== 'none',
      };
    }

    // Full evaluation needed
    const conviction = await this.evaluateConviction(wallet);
    return {
      name: conviction.tier,
      rank: conviction.rank,
      eligible: conviction.tier !== 'none',
    };
  }

  // ---------------------------------------------------------------------------
  // LEADERBOARD
  // ---------------------------------------------------------------------------

  /**
   * Get ranked leaderboard
   */
  async getLeaderboard(params: {
    limit: number;
    offset: number;
    tier?: TierName;
  }): Promise<{ entries: LeaderboardEntry[]; total: number }> {
    const { limit, offset, tier } = params;

    const where: any = tier ? { tier } : { tier: { in: ['naib', 'fedaykin'] } };

    const [entries, total] = await Promise.all([
      this.prisma.unifiedIdentity.findMany({
        where,
        include: { profile: true },
        orderBy: { rank: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.unifiedIdentity.count({ where }),
    ]);

    return {
      entries: entries.map(e => ({
        wallet: e.primaryWallet,
        nym: e.profile?.nym || null,
        score: 0, // Would need to fetch from cache or recalculate
        tier: e.tier as TierName,
        badges: (e.profile?.badges as string[]) || [],
      })),
      total,
    };
  }

  // ---------------------------------------------------------------------------
  // BADGES
  // ---------------------------------------------------------------------------

  /**
   * Get badges for a wallet
   */
  async getBadges(walletAddress: string): Promise<Badge[]> {
    const wallet = walletAddress.toLowerCase();

    const profile = await this.prisma.userProfile.findFirst({
      where: {
        unifiedIdentity: { primaryWallet: wallet },
      },
    });

    if (!profile?.badges) return [];

    const badgeIds = profile.badges as string[];
    return badgeIds.map(id => {
      const badgeConfig = this.config.badges.find(b => b.id === id);
      return {
        id,
        name: badgeConfig?.name || id,
        description: badgeConfig?.description || '',
        earnedAt: new Date(), // Would need to track actual earn date
      };
    });
  }

  /**
   * Get score history for a wallet
   */
  async getScoreHistory(walletAddress: string, days: number): Promise<ScoreHistoryEntry[]> {
    const wallet = walletAddress.toLowerCase();

    const history = await this.prisma.convictionSnapshot.findMany({
      where: {
        walletAddress: wallet,
        createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'asc' },
    });

    return history.map(h => ({
      date: h.createdAt,
      score: h.score,
      rank: h.rank,
      tier: h.tier as TierName,
    }));
  }

  // ---------------------------------------------------------------------------
  // DEMURRAGE (ACTIVITY DECAY)
  // ---------------------------------------------------------------------------

  /**
   * Run decay cycle for all members
   */
  async runDecayCycle(): Promise<{ affected: number; decayRate: number }> {
    const { rate, intervalHours } = this.config.demurrage;

    // Get all activity scores
    const activities = await this.prisma.activityScore.findMany({
      where: {
        lastActivityAt: {
          lt: new Date(Date.now() - intervalHours * 60 * 60 * 1000),
        },
      },
    });

    let affected = 0;

    for (const activity of activities) {
      const newScore = Math.floor(activity.score * (1 - rate));

      if (newScore !== activity.score) {
        await this.prisma.activityScore.update({
          where: { id: activity.id },
          data: {
            score: newScore,
            lastDecayAt: new Date(),
          },
        });
        affected++;
      }
    }

    // Invalidate affected caches
    if (affected > 0) {
      const keys = await this.redis.keys(`${this.SCORE_CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }

    return { affected, decayRate: rate };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private loadConfig(): ConvictionConfig {
    const configPath = process.env.CONVICTION_CONFIG_PATH ||
      path.join(process.cwd(), 'config', 'conviction-metrics.yaml');

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = yaml.load(content) as any;

      return {
        weights: {
          holdings: parsed.weights?.holdings || 0.4,
          governance: parsed.weights?.governance || 0.3,
          engagement: parsed.weights?.engagement || 0.3,
        },
        tiers: {
          naib: { minRank: 1, maxRank: parsed.tiers?.naib?.max_rank || 7 },
          fedaykin: { minRank: 8, maxRank: parsed.tiers?.fedaykin?.max_rank || 69 },
        },
        demurrage: {
          rate: parsed.demurrage?.rate || 0.1,
          intervalHours: parsed.demurrage?.interval_hours || 6,
        },
        badges: parsed.badges || [],
      };
    } catch (error) {
      console.warn('Failed to load conviction config, using defaults:', error);
      return {
        weights: { holdings: 0.4, governance: 0.3, engagement: 0.3 },
        tiers: {
          naib: { minRank: 1, maxRank: 7 },
          fedaykin: { minRank: 8, maxRank: 69 },
        },
        demurrage: { rate: 0.1, intervalHours: 6 },
        badges: [],
      };
    }
  }

  private async calculateHoldingsScore(wallet: string): Promise<number> {
    // Query Dune Analytics for BGT holdings
    if (!this.duneApiKey) return 0;

    try {
      const queryId = process.env.DUNE_BGT_HOLDERS_QUERY_ID;
      if (!queryId) return 0;

      const response = await fetch(
        `https://api.dune.com/api/v1/query/${queryId}/results?filters=wallet_address=${wallet}`,
        { headers: { 'X-Dune-API-Key': this.duneApiKey } }
      );

      if (!response.ok) return 0;

      const data = await response.json();
      const row = data.result?.rows?.[0];

      if (!row) return 0;

      // Normalize to 0-100 scale based on holdings
      const bgtBalance = parseFloat(row.bgt_balance || '0');
      return Math.min(100, bgtBalance / 1000 * 100);
    } catch (error) {
      console.error('Failed to fetch holdings score:', error);
      return 0;
    }
  }

  private async calculateGovernanceScore(wallet: string): Promise<number> {
    // Query for governance participation
    if (!this.duneApiKey) return 0;

    try {
      const queryId = process.env.DUNE_GOVERNANCE_QUERY_ID;
      if (!queryId) return 0;

      const response = await fetch(
        `https://api.dune.com/api/v1/query/${queryId}/results?filters=voter=${wallet}`,
        { headers: { 'X-Dune-API-Key': this.duneApiKey } }
      );

      if (!response.ok) return 0;

      const data = await response.json();
      const row = data.result?.rows?.[0];

      if (!row) return 0;

      // Score based on vote count and recency
      const voteCount = parseInt(row.vote_count || '0');
      return Math.min(100, voteCount * 10);
    } catch (error) {
      console.error('Failed to fetch governance score:', error);
      return 0;
    }
  }

  private async calculateEngagementScore(wallet: string): Promise<number> {
    // Get stored activity score
    const identity = await this.prisma.unifiedIdentity.findUnique({
      where: { primaryWallet: wallet },
    });

    if (!identity) return 0;

    const activity = await this.prisma.activityScore.findUnique({
      where: { unifiedIdentityId: identity.id },
    });

    return activity?.score || 0;
  }

  private async calculateRank(wallet: string, score: number): Promise<number> {
    // Count wallets with higher scores
    const higherCount = await this.prisma.convictionSnapshot.count({
      where: {
        score: { gt: score },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return higherCount + 1;
  }

  private determineTier(rank: number): TierName {
    const { tiers } = this.config;

    if (rank >= tiers.naib.minRank && rank <= tiers.naib.maxRank) {
      return 'naib';
    }
    if (rank >= tiers.fedaykin.minRank && rank <= tiers.fedaykin.maxRank) {
      return 'fedaykin';
    }
    return 'none';
  }

  private async evaluateBadges(
    wallet: string,
    scores: { holdings: number; governance: number; engagement: number; score: number }
  ): Promise<string[]> {
    const badges: string[] = [];

    // Check each badge condition
    for (const badge of this.config.badges) {
      if (this.evaluateBadgeCondition(badge.condition, scores)) {
        badges.push(badge.id);
      }
    }

    // Check for never-redeemed (Diamond Hands)
    const hasRedeemed = await this.checkIfRedeemed(wallet);
    if (!hasRedeemed && scores.holdings > 0) {
      badges.push('diamond_hands');
    }

    // Check for OG status
    const identity = await this.prisma.unifiedIdentity.findUnique({
      where: { primaryWallet: wallet },
    });

    if (identity) {
      const launchDate = new Date(process.env.LAUNCH_DATE || '2024-01-01');
      if (identity.createdAt <= launchDate) {
        badges.push('og');
      }
    }

    return badges;
  }

  private evaluateBadgeCondition(condition: string, scores: Record<string, number>): boolean {
    try {
      // Simple condition evaluation
      const fn = new Function('scores', `return ${condition}`);
      return fn(scores);
    } catch {
      return false;
    }
  }

  private async checkIfRedeemed(wallet: string): Promise<boolean> {
    if (!this.duneApiKey) return false;

    try {
      const queryId = process.env.DUNE_BGT_REDEEMERS_QUERY_ID;
      if (!queryId) return false;

      const response = await fetch(
        `https://api.dune.com/api/v1/query/${queryId}/results?filters=wallet=${wallet}`,
        { headers: { 'X-Dune-API-Key': this.duneApiKey } }
      );

      if (!response.ok) return false;

      const data = await response.json();
      return (data.result?.rows?.length || 0) > 0;
    } catch {
      return false;
    }
  }

  private async updateStoredScore(wallet: string, result: ConvictionResult): Promise<void> {
    // Update identity
    await this.prisma.unifiedIdentity.updateMany({
      where: { primaryWallet: wallet },
      data: { tier: result.tier, rank: result.rank },
    });

    // Store snapshot
    await this.prisma.convictionSnapshot.create({
      data: {
        walletAddress: wallet,
        score: result.score,
        rank: result.rank,
        tier: result.tier,
        components: result.components,
      },
    });
  }
}

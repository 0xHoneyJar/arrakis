/**
 * Sietch Unified - Scheduled Tasks (trigger.dev)
 * 
 * Automated background jobs for:
 * - Activity decay (demurrage model) - every 6 hours
 * - Eligibility sync - every 6 hours
 * - Badge evaluation - daily at midnight UTC
 * - Re-verification check - daily at noon UTC
 */

import { cronTrigger, eventTrigger } from "@trigger.dev/sdk";
import { client } from "./trigger-client";
import { PrismaClient } from "@prisma/client";
import { ConvictionEngine, DuneClient } from "../services/conviction/conviction-engine.service";
import { IdentityBridgeService } from "../services/identity/identity-bridge.service";
import type { TierName, BadgeType } from "@sietch/shared/types";

// =============================================================================
// CONFIGURATION
// =============================================================================

const prisma = new PrismaClient();

const DECAY_RATE = 0.10; // 10% decay
const BADGE_CRITERIA = {
  first_wave: { daysFromLaunch: 30 },
  veteran: { tenureDays: 90 },
  diamond_hands: { tenureDays: 180 },
  engaged: { minActivityScore: 100 },
  contributor: { minActivityScore: 500 },
  pillar: { minActivityScore: 1000 },
  streak_master: { streakDays: 30 },
};

// =============================================================================
// ACTIVITY DECAY (Every 6 hours)
// =============================================================================

/**
 * Activity Decay Job
 * 
 * Implements the demurrage model - activity scores decay by 10% every 6 hours.
 * This rewards consistent engagement over one-time bursts.
 */
client.defineJob({
  id: "activity-decay",
  name: "Activity Decay (Demurrage)",
  version: "1.0.0",
  trigger: cronTrigger({
    cron: "0 */6 * * *", // Every 6 hours
  }),
  run: async (payload, io, ctx) => {
    await io.logger.info("Starting activity decay job");

    // Get all profiles with activity > 0
    const profiles = await io.runTask("fetch-profiles", async () => {
      return prisma.userProfile.findMany({
        where: { activityScore: { gt: 0 } },
        select: { id: true, activityScore: true },
      });
    });

    await io.logger.info(`Processing ${profiles.length} profiles`);

    let processed = 0;
    let errors = 0;

    // Process in batches of 100
    const batches = chunk(profiles, 100);

    for (const batch of batches) {
      await io.runTask(`decay-batch-${processed}`, async () => {
        const updates = batch.map(async (profile) => {
          try {
            const newScore = Math.max(0, profile.activityScore * (1 - DECAY_RATE));
            
            await prisma.$transaction([
              prisma.userProfile.update({
                where: { id: profile.id },
                data: { activityScore: newScore },
              }),
              prisma.activityDecayLog.create({
                data: {
                  profileId: profile.id,
                  previousScore: profile.activityScore,
                  newScore,
                  decayRate: DECAY_RATE,
                },
              }),
            ]);
            
            processed++;
          } catch (error) {
            errors++;
            await io.logger.error(`Failed to decay profile ${profile.id}`, { error });
          }
        });

        await Promise.all(updates);
      });
    }

    await io.logger.info(`Activity decay complete: ${processed} processed, ${errors} errors`);

    return { processed, errors };
  },
});

// =============================================================================
// ELIGIBILITY SYNC (Every 6 hours)
// =============================================================================

/**
 * Eligibility Sync Job
 * 
 * Re-evaluates all members' conviction and updates roles accordingly.
 * Members who fall out of top 69 or redeem BGT lose access immediately.
 */
client.defineJob({
  id: "eligibility-sync",
  name: "Eligibility Sync",
  version: "1.0.0",
  trigger: cronTrigger({
    cron: "0 */6 * * *", // Every 6 hours (offset by 30 mins from decay)
  }),
  run: async (payload, io, ctx) => {
    await io.logger.info("Starting eligibility sync");

    // Initialize conviction engine
    const convictionEngine = await io.runTask("init-conviction-engine", async () => {
      // This would load config and initialize properly
      // Simplified for example
      return new ConvictionEngine({
        convictionConfig: {} as any, // Would load from file
        duneClient: new DuneClient({
          apiKey: process.env.DUNE_API_KEY!,
          baseUrl: "https://api.dune.com/api/v1",
          rateLimit: { requestsPerMinute: 60, burst: 10 },
        }),
        rpcUrl: process.env.BERACHAIN_RPC_URL!,
        redis: createRedisWrapper(),
      });
    });

    // Refresh global rankings from Dune
    await io.runTask("refresh-rankings", async () => {
      await convictionEngine.refreshRankings();
    });

    // Get all current members
    const members = await io.runTask("fetch-members", async () => {
      return prisma.userProfile.findMany({
        include: {
          unifiedIdentity: {
            include: { accounts: true },
          },
        },
      });
    });

    await io.logger.info(`Syncing ${members.length} members`);

    const changes: Array<{ profileId: string; oldTier: string; newTier: string }> = [];
    const demotions: Array<{ profileId: string; reason: string }> = [];

    for (const member of members) {
      await io.runTask(`sync-member-${member.id}`, async () => {
        const walletAddress = member.unifiedIdentity.primaryWallet;
        const result = await convictionEngine.evaluate(walletAddress);

        if (result.tier !== member.tier) {
          // Tier changed
          changes.push({
            profileId: member.id,
            oldTier: member.tier,
            newTier: result.tier,
          });

          // Update profile
          await prisma.userProfile.update({
            where: { id: member.id },
            data: {
              tier: result.tier,
              rank: result.rank,
            },
          });

          // Log the event
          await prisma.roleSyncEvent.create({
            data: {
              unifiedIdentityId: member.unifiedIdentityId,
              previousTier: member.tier,
              newTier: result.tier,
              platforms: member.unifiedIdentity.accounts.map(a => a.platform),
              reason: "eligibility_change",
            },
          });

          // Check for demotion
          if (result.tier === "none" && member.tier !== "none") {
            demotions.push({
              profileId: member.id,
              reason: result.disqualificationReason || "Fell out of top 69",
            });
          }

          // Trigger role sync on Discord/Telegram
          await client.sendEvent({
            name: "role.sync",
            payload: {
              unifiedIdentityId: member.unifiedIdentityId,
              oldTier: member.tier,
              newTier: result.tier,
              accounts: member.unifiedIdentity.accounts,
            },
          });
        }
      });
    }

    await io.logger.info(`Eligibility sync complete`, {
      processed: members.length,
      changes: changes.length,
      demotions: demotions.length,
    });

    return { processed: members.length, changes, demotions };
  },
});

// =============================================================================
// BADGE EVALUATION (Daily at midnight UTC)
// =============================================================================

/**
 * Badge Evaluation Job
 * 
 * Checks all members for badge eligibility and awards new badges.
 */
client.defineJob({
  id: "badge-evaluation",
  name: "Badge Evaluation",
  version: "1.0.0",
  trigger: cronTrigger({
    cron: "0 0 * * *", // Daily at midnight UTC
  }),
  run: async (payload, io, ctx) => {
    await io.logger.info("Starting badge evaluation");

    const launchDate = new Date(process.env.LAUNCH_DATE || "2024-01-01");
    const now = new Date();

    // Get all profiles with their badges
    const profiles = await io.runTask("fetch-profiles", async () => {
      return prisma.userProfile.findMany({
        include: { badges: true },
      });
    });

    await io.logger.info(`Evaluating ${profiles.length} profiles`);

    const newBadges: Array<{ profileId: string; badge: string }> = [];

    for (const profile of profiles) {
      await io.runTask(`evaluate-${profile.id}`, async () => {
        const existingBadges = new Set(profile.badges.map(b => b.badgeType));
        const earnedBadges: BadgeType[] = [];

        // Tenure badges
        const tenureDays = Math.floor(
          (now.getTime() - profile.joinedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysSinceLaunch = Math.floor(
          (profile.joinedAt.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLaunch <= BADGE_CRITERIA.first_wave.daysFromLaunch) {
          earnedBadges.push("first_wave");
        }
        if (tenureDays >= BADGE_CRITERIA.veteran.tenureDays) {
          earnedBadges.push("veteran");
        }
        if (tenureDays >= BADGE_CRITERIA.diamond_hands.tenureDays) {
          earnedBadges.push("diamond_hands");
        }

        // Activity badges
        if (profile.activityScore >= BADGE_CRITERIA.engaged.minActivityScore) {
          earnedBadges.push("engaged");
        }
        if (profile.activityScore >= BADGE_CRITERIA.contributor.minActivityScore) {
          earnedBadges.push("contributor");
        }
        if (profile.activityScore >= BADGE_CRITERIA.pillar.minActivityScore) {
          earnedBadges.push("pillar");
        }

        // Tier-based badges
        if (profile.tier === "naib") {
          earnedBadges.push("council");
        }

        // Award new badges
        for (const badge of earnedBadges) {
          if (!existingBadges.has(badge)) {
            await prisma.userBadge.create({
              data: {
                profileId: profile.id,
                badgeType: badge,
                name: getBadgeName(badge),
                description: getBadgeDescription(badge),
                earnedAt: now,
              },
            });
            newBadges.push({ profileId: profile.id, badge });
          }
        }
      });
    }

    await io.logger.info(`Badge evaluation complete: ${newBadges.length} new badges awarded`);

    return { evaluated: profiles.length, newBadges };
  },
});

// =============================================================================
// RE-VERIFICATION CHECK (Daily at noon UTC)
// =============================================================================

/**
 * Re-verification Check Job
 * 
 * Checks for expired verifications and prompts users to re-verify.
 */
client.defineJob({
  id: "reverification-check",
  name: "Re-verification Check",
  version: "1.0.0",
  trigger: cronTrigger({
    cron: "0 12 * * *", // Daily at noon UTC
  }),
  run: async (payload, io, ctx) => {
    await io.logger.info("Starting re-verification check");

    const verificationTtl = parseInt(process.env.VERIFICATION_TTL || "604800"); // 7 days
    const cutoffDate = new Date(Date.now() - verificationTtl * 1000);

    // Find accounts needing re-verification
    const expiredAccounts = await io.runTask("find-expired", async () => {
      return prisma.linkedAccount.findMany({
        where: {
          verifiedAt: { lt: cutoffDate },
        },
        include: {
          unifiedIdentity: true,
        },
      });
    });

    await io.logger.info(`Found ${expiredAccounts.length} accounts needing re-verification`);

    for (const account of expiredAccounts) {
      await io.runTask(`notify-${account.id}`, async () => {
        // Send notification to user
        await client.sendEvent({
          name: "reverification.required",
          payload: {
            platform: account.platform,
            platformId: account.platformId,
            unifiedIdentityId: account.unifiedIdentityId,
          },
        });
      });
    }

    return { notified: expiredAccounts.length };
  },
});

// =============================================================================
// EVENT-TRIGGERED JOBS
// =============================================================================

/**
 * Role Sync Event Handler
 * 
 * Triggered when a user's tier changes, syncs roles across platforms.
 */
client.defineJob({
  id: "role-sync-handler",
  name: "Role Sync Handler",
  version: "1.0.0",
  trigger: eventTrigger({
    name: "role.sync",
  }),
  run: async (payload, io, ctx) => {
    const { unifiedIdentityId, oldTier, newTier, accounts } = payload;

    await io.logger.info(`Syncing roles for ${unifiedIdentityId}: ${oldTier} -> ${newTier}`);

    for (const account of accounts) {
      if (account.platform === "discord") {
        await io.runTask(`sync-discord-${account.platformId}`, async () => {
          // Call Discord role manager
          // In production, this would call the Discord bot API
          await io.logger.info(`Discord role sync: ${account.platformId} -> ${newTier}`);
        });
      }

      if (account.platform === "telegram") {
        await io.runTask(`sync-telegram-${account.platformId}`, async () => {
          // Call Telegram bot to update user's badge/status
          await io.logger.info(`Telegram sync: ${account.platformId} -> ${newTier}`);
        });
      }
    }

    return { synced: accounts.length };
  },
});

// =============================================================================
// HELPERS
// =============================================================================

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function getBadgeName(badge: BadgeType): string {
  const names: Record<BadgeType, string> = {
    first_wave: "First Wave",
    veteran: "Veteran",
    diamond_hands: "Diamond Hands",
    council: "Council",
    survivor: "Survivor",
    streak_master: "Streak Master",
    engaged: "Engaged",
    contributor: "Contributor",
    pillar: "Pillar",
  };
  return names[badge] || badge;
}

function getBadgeDescription(badge: BadgeType): string {
  const descriptions: Record<BadgeType, string> = {
    first_wave: "Joined in the first 30 days",
    veteran: "3+ months membership",
    diamond_hands: "6+ months membership",
    council: "Reached Naib tier",
    survivor: "Survived a demotion and returned",
    streak_master: "30-day activity streak",
    engaged: "Activity score > 100",
    contributor: "Activity score > 500",
    pillar: "Activity score > 1000",
  };
  return descriptions[badge] || "";
}

function createRedisWrapper() {
  // Simplified Redis wrapper for the job context
  // In production, this would use a proper Redis client
  const cache = new Map<string, { value: string; expiresAt: number }>();
  
  return {
    async get(key: string): Promise<string | null> {
      const entry = cache.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        cache.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string, ttl?: number): Promise<void> {
      cache.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : 0,
      });
    },
    async del(key: string): Promise<void> {
      cache.delete(key);
    },
  };
}

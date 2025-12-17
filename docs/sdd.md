# Software Design Document: Sietch

**Version**: 2.0
**Date**: December 18, 2025
**Status**: Draft
**PRD Reference**: `docs/prd.md`

---

## 1. Executive Summary

Sietch is a privacy-first, token-gated Discord community service for the top 69 BGT holders who have never redeemed their tokens. Version 2.0 introduces a comprehensive **Social Layer** with pseudonymous member profiles, reputation badges, exclusive access perks, and a member directory.

The system consists of:

1. **Sietch Service** - A TypeScript/Node.js application that:
   - Queries Berachain RPC via viem for eligibility data
   - Manages pseudonymous member profiles and badges
   - Tracks member activity with a novel demurrage-based decay system
   - Uses trigger.dev for scheduled tasks
   - Exposes a REST API for Collab.Land and profile operations
   - Manages Discord bot interactions including slash commands, button UIs, and DM-based onboarding

2. **Collab.Land Integration** - Token gating that queries the Sietch Service API for wallet verification and role assignment.

3. **Discord Server** - The community platform with role-based channel access, including dynamically earned channels.

### 1.1 Key Design Principles

- **Privacy First**: Wallet addresses never exposed publicly; nyms completely unlinked from on-chain identity
- **Cypherpunk Ethos**: Cryptographic hashing for avatar generation; no correlation between identity and holdings
- **Progressive Engagement**: Dynamic role assignment based on activity, not just holdings
- **Low Friction**: Mandatory but streamlined onboarding; unlimited nym changes

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Sietch Service v2.0                                  │
│                            (TypeScript/Node.js)                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐     │
│  │  trigger.dev  │  │   REST API    │  │  Discord Bot  │  │    SQLite     │     │
│  │  (Scheduler)  │  │   (Express)   │  │  (discord.js) │  │    Cache      │     │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘     │
│          │                  │                  │                  │              │
│  ┌───────┴──────────────────┴──────────────────┴──────────────────┴───────┐     │
│  │                         Core Services                                    │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │     │
│  │  │   Chain     │  │  Profile    │  │   Badge     │  │  Activity   │    │     │
│  │  │  Service    │  │  Service    │  │  Service    │  │  Service    │    │     │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  │                  ▼
┌─────────────────┐         │         ┌─────────────────┐
│  Berachain RPC  │         │         │  Discord API    │
│  (viem queries) │         │         │  (Notifications)│
└─────────────────┘         │         └─────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │   Collab.Land   │
                   │  (Role Gating)  │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Discord Server │
                   │    (Sietch)     │
                   └─────────────────┘
```

### 2.2 Component Interaction Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     New Member Onboarding Flow                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  [Wallet Verification via Collab.Land]                                        │
│              │                                                                 │
│              ▼                                                                 │
│  [Collab.Land queries GET /eligibility]                                       │
│              │                                                                 │
│              ├── Not in top 69 ──▶ Access Denied                              │
│              │                                                                 │
│              ├── In top 69 ──▶ Assign base role (Naib/Fedaykin)               │
│              │                                                                 │
│              ▼                                                                 │
│  [Bot detects new member with role]                                           │
│              │                                                                 │
│              ▼                                                                 │
│  [Bot sends DM: Onboarding Wizard]                                            │
│              │                                                                 │
│  ┌───────────┼───────────────────────────────────────────────────┐            │
│  │           ▼                                                    │            │
│  │   Step 1: Choose Nym ──▶ Validate uniqueness                  │            │
│  │           │                                                    │            │
│  │           ▼                                                    │            │
│  │   Step 2: Profile Picture ──▶ Upload/Generate/Skip            │            │
│  │           │                                                    │            │
│  │           ▼                                                    │            │
│  │   Step 3: Bio (Optional) ──▶ Save profile                     │            │
│  │           │                                                    │            │
│  └───────────┼───────────────────────────────────────────────────┘            │
│              ▼                                                                 │
│  [Profile created in member_profiles table]                                   │
│              │                                                                 │
│              ▼                                                                 │
│  [Assign "Onboarded" role ──▶ Channel access granted]                         │
│              │                                                                 │
│              ▼                                                                 │
│  [Award initial badges: Founding Fedaykin (if applicable)]                    │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                     Activity Tracking & Badge Award Flow                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  [Member sends message or reacts in tracked channel]                          │
│              │                                                                 │
│              ▼                                                                 │
│  [Activity Service records event]                                             │
│              │                                                                 │
│              ├── Increment activity_balance                                    │
│              │                                                                 │
│              ▼                                                                 │
│  [Every 6 hours: Decay Scheduled Task]                                        │
│              │                                                                 │
│              ├── activity_balance *= DECAY_RATE (0.9)                         │
│              │                                                                 │
│              ▼                                                                 │
│  [Badge Service evaluates thresholds]                                         │
│              │                                                                 │
│              ├── Activity balance > 50 ──▶ Award "Consistent" badge          │
│              ├── Activity balance > 200 ──▶ Award "Dedicated" badge          │
│              ├── Activity balance > 500 ──▶ Award "Devoted" badge            │
│              │                                                                 │
│              ▼                                                                 │
│  [Role Service checks badge count]                                            │
│              │                                                                 │
│              ├── 5+ badges ──▶ Assign "Engaged" role ──▶ #deep-desert access │
│              ├── Tenure 90+ days ──▶ Assign "Veteran" role ──▶ #stillsuit    │
│              │                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Runtime** | Node.js 20 LTS | Stable, async-native, large ecosystem |
| **Language** | TypeScript 5.x | Type safety, better maintainability |
| **Web Framework** | Express.js | Simple, well-documented, minimal overhead |
| **Database** | SQLite (better-sqlite3) | Zero config, file-based, supports queries |
| **Discord Library** | discord.js v14 | Official library, full API coverage, slash commands |
| **Scheduler** | trigger.dev v3 | Managed scheduling, same pattern as existing |
| **Chain Client** | viem | Type-safe Ethereum client, Berachain support |
| **Image Processing** | sharp | High-performance image compression |
| **Avatar Generation** | Custom (crypto hash + ASCII art) | Privacy-preserving, unique identifiers |
| **Process Manager** | PM2 | Auto-restart, log management, monitoring |
| **Reverse Proxy** | nginx | SSL termination, rate limiting |

### 3.1 Project Structure (Extended)

```
sietch-service/
├── src/
│   ├── index.ts              # Application entry point
│   ├── config.ts             # Environment configuration
│   ├── api/
│   │   ├── routes.ts         # Express route definitions
│   │   ├── middleware.ts     # Auth, rate limiting, error handling
│   │   └── handlers/
│   │       ├── eligibility.ts
│   │       ├── health.ts
│   │       ├── admin.ts
│   │       ├── profile.ts    # NEW: Profile CRUD operations
│   │       ├── directory.ts  # NEW: Member directory
│   │       └── badges.ts     # NEW: Badge endpoints
│   ├── services/
│   │   ├── chain.ts          # viem client for Berachain RPC
│   │   ├── eligibility.ts    # Core eligibility logic
│   │   ├── discord.ts        # Discord bot & notifications (extended)
│   │   ├── profile.ts        # NEW: Profile management
│   │   ├── badge.ts          # NEW: Badge award logic
│   │   ├── activity.ts       # NEW: Activity tracking & decay
│   │   ├── avatar.ts         # NEW: Hash-based avatar generation
│   │   └── onboarding.ts     # NEW: DM onboarding wizard
│   ├── db/
│   │   ├── schema.ts         # SQLite schema definitions (extended)
│   │   ├── migrations/       # Schema migrations
│   │   └── queries.ts        # Database access layer
│   ├── discord/
│   │   ├── commands/         # NEW: Slash command definitions
│   │   │   ├── profile.ts
│   │   │   ├── directory.ts
│   │   │   ├── badges.ts
│   │   │   ├── stats.ts
│   │   │   ├── leaderboard.ts
│   │   │   └── admin-badge.ts
│   │   ├── interactions/     # NEW: Button/menu handlers
│   │   │   ├── onboarding.ts
│   │   │   ├── directory.ts
│   │   │   └── profile.ts
│   │   └── embeds/           # NEW: Embed builders
│   │       ├── profile.ts
│   │       ├── badge.ts
│   │       └── directory.ts
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   └── utils/
│       ├── logger.ts         # Structured logging
│       ├── errors.ts         # Custom error classes
│       └── image.ts          # NEW: Image compression utilities
├── trigger/
│   ├── syncEligibility.ts    # Eligibility sync task
│   ├── activityDecay.ts      # NEW: Activity balance decay task
│   └── badgeCheck.ts         # NEW: Automatic badge award task
├── trigger.config.ts
├── tests/
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 4. Component Design

### 4.1 Profile Service

**Purpose**: Manage pseudonymous member profiles with strict privacy separation.

```typescript
// src/services/profile.ts

interface MemberProfile {
  id: string;                    // UUID, never exposed externally
  discordUserId: string;         // PRIVATE - never in public API
  walletAddress: string;         // PRIVATE - never in public API
  nym: string;                   // Public identifier
  pfpUrl: string | null;         // Discord CDN URL
  bio: string | null;            // Max 200 chars, no links
  createdAt: Date;
  updatedAt: Date;
  nymLastChanged: Date | null;   // For historical tracking (no cooldown enforced)
  onboardingComplete: boolean;
}

class ProfileService {
  /**
   * Create a new profile during onboarding
   * Links Discord user to wallet (private) and creates public nym
   */
  async createProfile(params: {
    discordUserId: string;
    walletAddress: string;
    nym: string;
    pfpUrl?: string;
    bio?: string;
  }): Promise<MemberProfile> {
    // Validate nym uniqueness
    if (await this.nymExists(params.nym)) {
      throw new NymTakenError(params.nym);
    }

    // Validate nym format (3-32 chars, alphanumeric + limited special)
    if (!this.isValidNym(params.nym)) {
      throw new InvalidNymError(params.nym);
    }

    // Generate UUID for internal tracking
    const id = crypto.randomUUID();

    // Store profile with private data separated
    return db.createProfile({
      id,
      ...params,
      createdAt: new Date(),
      updatedAt: new Date(),
      onboardingComplete: true,
    });
  }

  /**
   * Get public profile by nym (privacy-filtered)
   * NEVER returns wallet address, discord ID, or exact timestamps
   */
  async getPublicProfile(nym: string): Promise<PublicProfile | null> {
    const profile = await db.getProfileByNym(nym);
    if (!profile) return null;

    const badges = await badgeService.getMemberBadges(profile.id);
    const tier = await eligibilityService.getMemberTier(profile.walletAddress);
    const tenureCategory = this.calculateTenureCategory(profile.createdAt);

    return {
      nym: profile.nym,
      pfpUrl: profile.pfpUrl ?? avatarService.generateAvatar(profile.id),
      bio: profile.bio,
      tier,                    // 'naib' | 'fedaykin'
      badges,                  // Array of badge objects
      tenureCategory,          // 'OG' | 'Veteran' | 'Elder' | 'Member'
      // NO wallet, NO discord ID, NO exact dates
    };
  }

  /**
   * Update profile (own profile only)
   * No cooldown on nym changes per user preference
   */
  async updateProfile(
    discordUserId: string,
    updates: { nym?: string; bio?: string }
  ): Promise<MemberProfile> {
    const profile = await db.getProfileByDiscordId(discordUserId);
    if (!profile) throw new ProfileNotFoundError();

    if (updates.nym && updates.nym !== profile.nym) {
      if (await this.nymExists(updates.nym)) {
        throw new NymTakenError(updates.nym);
      }
      if (!this.isValidNym(updates.nym)) {
        throw new InvalidNymError(updates.nym);
      }
    }

    if (updates.bio && updates.bio.length > 200) {
      throw new BioTooLongError();
    }

    // Strip any URLs from bio (prevents doxing)
    if (updates.bio) {
      updates.bio = this.stripUrls(updates.bio);
    }

    return db.updateProfile(profile.id, {
      ...updates,
      nymLastChanged: updates.nym ? new Date() : undefined,
      updatedAt: new Date(),
    });
  }

  private calculateTenureCategory(createdAt: Date): string {
    const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) return 'OG';      // First 30 days of launch
    if (days <= 90) return 'Veteran';
    if (days <= 180) return 'Elder';
    return 'Member';
  }

  private isValidNym(nym: string): boolean {
    return /^[a-zA-Z0-9_\-\.]{3,32}$/.test(nym);
  }

  private stripUrls(text: string): string {
    return text.replace(/https?:\/\/[^\s]+/gi, '[link removed]');
  }
}
```

### 4.2 Avatar Service

**Purpose**: Generate cryptographically-derived ASCII-art-style avatars.

```typescript
// src/services/avatar.ts

import { createHash } from 'crypto';

/**
 * Avatar generation inspired by SSH randomart but modernized.
 * Uses member's internal UUID (never wallet) to generate unique patterns.
 */
class AvatarService {
  private readonly GRID_SIZE = 9;
  private readonly CHAR_PALETTE = ' .,:;+*#@█';

  /**
   * Generate a deterministic avatar from member ID
   * Based on the "drunken bishop" algorithm used in SSH fingerprint visualization
   */
  generateAvatar(memberId: string): string {
    const hash = createHash('sha256').update(memberId).digest();
    const grid = this.createGrid();

    // Walk the grid based on hash bytes (drunken bishop algorithm)
    let x = Math.floor(this.GRID_SIZE / 2);
    let y = Math.floor(this.GRID_SIZE / 2);

    for (const byte of hash) {
      for (let i = 0; i < 4; i++) {
        const direction = (byte >> (i * 2)) & 0x03;

        // Move based on 2-bit direction
        switch (direction) {
          case 0: x = Math.max(0, x - 1); y = Math.max(0, y - 1); break;
          case 1: x = Math.min(this.GRID_SIZE - 1, x + 1); y = Math.max(0, y - 1); break;
          case 2: x = Math.max(0, x - 1); y = Math.min(this.GRID_SIZE - 1, y + 1); break;
          case 3: x = Math.min(this.GRID_SIZE - 1, x + 1); y = Math.min(this.GRID_SIZE - 1, y + 1); break;
        }

        grid[y][x]++;
      }
    }

    // Convert grid to ASCII art
    return this.gridToAscii(grid);
  }

  /**
   * Generate avatar as an image buffer for Discord upload
   * Renders ASCII art to a modern visual representation
   */
  async generateAvatarImage(memberId: string): Promise<Buffer> {
    const hash = createHash('sha256').update(memberId).digest();

    // Use sharp to create a pixel-art style image from the hash
    // Color palette derived from hash for uniqueness
    const hue = hash[0] / 255 * 360;
    const saturation = 50 + (hash[1] / 255) * 30;

    // Create 256x256 image with hash-based pattern
    return sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([
      // Render the pattern as overlaid shapes
      ...this.generatePatternOverlays(hash, hue, saturation)
    ])
    .png()
    .toBuffer();
  }

  private createGrid(): number[][] {
    return Array(this.GRID_SIZE).fill(null)
      .map(() => Array(this.GRID_SIZE).fill(0));
  }

  private gridToAscii(grid: number[][]): string {
    const maxVal = Math.max(...grid.flat());
    return grid.map(row =>
      row.map(val => {
        const idx = Math.floor((val / maxVal) * (this.CHAR_PALETTE.length - 1));
        return this.CHAR_PALETTE[idx];
      }).join('')
    ).join('\n');
  }
}

export const avatarService = new AvatarService();
```

### 4.3 Activity Service

**Purpose**: Track member activity with demurrage-based decay system.

```typescript
// src/services/activity.ts

/**
 * Activity tracking with demurrage (decay)
 *
 * Instead of traditional streaks that reset on inactivity,
 * activity balance decays continuously every 6 hours.
 * This creates a more forgiving but still engagement-rewarding system.
 *
 * DECAY_RATE = 0.9 means 10% decay every 6 hours
 * - After 1 day (4 cycles): balance * 0.9^4 = 65.6% remaining
 * - After 1 week (28 cycles): balance * 0.9^28 = 5.4% remaining
 *
 * Activity points awarded:
 * - Message sent: +1 point
 * - Reaction given: +0.5 points
 * - Reaction received: +0.25 points
 */

const DECAY_RATE = 0.9;
const DECAY_INTERVAL_HOURS = 6;
const ACTIVITY_POINTS = {
  MESSAGE: 1.0,
  REACTION_GIVEN: 0.5,
  REACTION_RECEIVED: 0.25,
};

interface MemberActivity {
  memberId: string;
  activityBalance: number;       // Cumulative with decay
  lastActivityAt: Date;
  lastDecayAt: Date;
  totalMessages: number;         // Lifetime stats (don't decay)
  totalReactionsGiven: number;
  totalReactionsReceived: number;
}

class ActivityService {
  /**
   * Record a message activity
   */
  async recordMessage(discordUserId: string, channelId: string): Promise<void> {
    const profile = await db.getProfileByDiscordId(discordUserId);
    if (!profile) return; // Not onboarded yet

    // Check if channel is tracked (not all channels count)
    if (!this.isTrackedChannel(channelId)) return;

    await this.addActivity(profile.id, ACTIVITY_POINTS.MESSAGE, 'message');
  }

  /**
   * Record a reaction activity (giving or receiving)
   */
  async recordReaction(
    discordUserId: string,
    type: 'given' | 'received'
  ): Promise<void> {
    const profile = await db.getProfileByDiscordId(discordUserId);
    if (!profile) return;

    const points = type === 'given'
      ? ACTIVITY_POINTS.REACTION_GIVEN
      : ACTIVITY_POINTS.REACTION_RECEIVED;

    await this.addActivity(profile.id, points, `reaction_${type}`);
  }

  /**
   * Add activity points (applies pending decay first)
   */
  private async addActivity(
    memberId: string,
    points: number,
    type: string
  ): Promise<void> {
    const activity = await db.getMemberActivity(memberId) ?? {
      memberId,
      activityBalance: 0,
      lastActivityAt: new Date(),
      lastDecayAt: new Date(),
      totalMessages: 0,
      totalReactionsGiven: 0,
      totalReactionsReceived: 0,
    };

    // Apply pending decay before adding new points
    const decayedBalance = this.applyDecay(
      activity.activityBalance,
      activity.lastDecayAt
    );

    // Update balance and stats
    const newActivity: MemberActivity = {
      ...activity,
      activityBalance: decayedBalance + points,
      lastActivityAt: new Date(),
      lastDecayAt: new Date(),
      totalMessages: activity.totalMessages + (type === 'message' ? 1 : 0),
      totalReactionsGiven: activity.totalReactionsGiven + (type === 'reaction_given' ? 1 : 0),
      totalReactionsReceived: activity.totalReactionsReceived + (type === 'reaction_received' ? 1 : 0),
    };

    await db.upsertMemberActivity(newActivity);

    // Check if new badges should be awarded
    await badgeService.checkActivityBadges(memberId, newActivity.activityBalance);
  }

  /**
   * Apply decay based on time since last decay
   */
  private applyDecay(balance: number, lastDecayAt: Date): number {
    const hoursSinceDecay = (Date.now() - lastDecayAt.getTime()) / (1000 * 60 * 60);
    const decayCycles = Math.floor(hoursSinceDecay / DECAY_INTERVAL_HOURS);

    if (decayCycles <= 0) return balance;

    // Apply exponential decay
    return balance * Math.pow(DECAY_RATE, decayCycles);
  }

  /**
   * Scheduled task: Apply decay to all members
   * Run every 6 hours via trigger.dev
   */
  async runDecayTask(): Promise<{ processed: number; decayed: number }> {
    const allActivity = await db.getAllMemberActivity();
    let decayed = 0;

    for (const activity of allActivity) {
      const newBalance = this.applyDecay(activity.activityBalance, activity.lastDecayAt);

      if (newBalance !== activity.activityBalance) {
        await db.updateActivityBalance(activity.memberId, newBalance);
        decayed++;
      }
    }

    return { processed: allActivity.length, decayed };
  }

  /**
   * Get member's activity stats (own stats only - privacy)
   */
  async getOwnStats(discordUserId: string): Promise<ActivityStats | null> {
    const profile = await db.getProfileByDiscordId(discordUserId);
    if (!profile) return null;

    const activity = await db.getMemberActivity(profile.id);
    if (!activity) return null;

    // Apply current decay for accurate display
    const currentBalance = this.applyDecay(
      activity.activityBalance,
      activity.lastDecayAt
    );

    return {
      activityBalance: Math.floor(currentBalance),
      totalMessages: activity.totalMessages,
      totalReactionsGiven: activity.totalReactionsGiven,
      totalReactionsReceived: activity.totalReactionsReceived,
      lastActiveAt: activity.lastActivityAt,
    };
  }

  private isTrackedChannel(channelId: string): boolean {
    return config.discord.trackedChannels.includes(channelId);
  }
}

export const activityService = new ActivityService();
```

### 4.4 Badge Service

**Purpose**: Award and manage badges based on tenure, activity, and admin grants.

```typescript
// src/services/badge.ts

interface Badge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  category: 'tenure' | 'streak' | 'contribution' | 'special';
  isAutomatic: boolean;
}

interface MemberBadge {
  badge: Badge;
  awardedAt: Date;
  awardedBy: string | null;  // null = automatic, admin ID = manual
}

const BADGE_DEFINITIONS: Badge[] = [
  // Tenure badges (automatic)
  { id: 'og', name: 'OG', description: 'Member in first 30 days', category: 'tenure', isAutomatic: true, iconUrl: '/badges/og.png' },
  { id: 'veteran', name: 'Veteran', description: '90+ days as member', category: 'tenure', isAutomatic: true, iconUrl: '/badges/veteran.png' },
  { id: 'elder', name: 'Elder', description: '180+ days as member', category: 'tenure', isAutomatic: true, iconUrl: '/badges/elder.png' },

  // Activity badges (automatic via demurrage balance)
  { id: 'consistent', name: 'Consistent', description: 'Maintain 50+ activity balance', category: 'streak', isAutomatic: true, iconUrl: '/badges/consistent.png' },
  { id: 'dedicated', name: 'Dedicated', description: 'Maintain 200+ activity balance', category: 'streak', isAutomatic: true, iconUrl: '/badges/dedicated.png' },
  { id: 'devoted', name: 'Devoted', description: 'Maintain 500+ activity balance', category: 'streak', isAutomatic: true, iconUrl: '/badges/devoted.png' },

  // Contribution badges (admin-granted)
  { id: 'helper', name: 'Helper', description: 'Recognized for helping others', category: 'contribution', isAutomatic: false, iconUrl: '/badges/helper.png' },
  { id: 'thought_leader', name: 'Thought Leader', description: 'Consistent quality contributions', category: 'contribution', isAutomatic: false, iconUrl: '/badges/thought_leader.png' },

  // Special badges (event-triggered)
  { id: 'founding_fedaykin', name: 'Founding Fedaykin', description: 'Original top 69 at launch', category: 'special', isAutomatic: true, iconUrl: '/badges/founding.png' },
  { id: 'promoted', name: 'Promoted', description: 'Rose from Fedaykin to Naib', category: 'special', isAutomatic: true, iconUrl: '/badges/promoted.png' },
];

const ACTIVITY_BADGE_THRESHOLDS = {
  consistent: 50,
  dedicated: 200,
  devoted: 500,
};

class BadgeService {
  /**
   * Get all badges for a member (public - shown on profile)
   */
  async getMemberBadges(memberId: string): Promise<MemberBadge[]> {
    return db.getMemberBadges(memberId);
  }

  /**
   * Check and award tenure badges
   * Run periodically (daily)
   */
  async checkTenureBadges(memberId: string): Promise<Badge[]> {
    const profile = await db.getProfileById(memberId);
    if (!profile) return [];

    const awarded: Badge[] = [];
    const existingBadges = await db.getMemberBadgeIds(memberId);
    const tenure = Math.floor((Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // OG badge - only awarded if joined in first 30 days of Sietch launch
    // (This is checked at onboarding time, not here)

    // Veteran badge - 90+ days
    if (tenure >= 90 && !existingBadges.includes('veteran')) {
      await this.awardBadge(memberId, 'veteran', null);
      awarded.push(BADGE_DEFINITIONS.find(b => b.id === 'veteran')!);
    }

    // Elder badge - 180+ days
    if (tenure >= 180 && !existingBadges.includes('elder')) {
      await this.awardBadge(memberId, 'elder', null);
      awarded.push(BADGE_DEFINITIONS.find(b => b.id === 'elder')!);
    }

    return awarded;
  }

  /**
   * Check activity badges based on current balance
   */
  async checkActivityBadges(memberId: string, activityBalance: number): Promise<Badge[]> {
    const awarded: Badge[] = [];
    const existingBadges = await db.getMemberBadgeIds(memberId);

    for (const [badgeId, threshold] of Object.entries(ACTIVITY_BADGE_THRESHOLDS)) {
      if (activityBalance >= threshold && !existingBadges.includes(badgeId)) {
        await this.awardBadge(memberId, badgeId, null);
        awarded.push(BADGE_DEFINITIONS.find(b => b.id === badgeId)!);
      }
    }

    // Note: Badges are NOT removed if balance drops below threshold
    // Once earned, you keep them (but may lose associated perks)

    return awarded;
  }

  /**
   * Award a badge (automatic or admin-granted)
   */
  async awardBadge(
    memberId: string,
    badgeId: string,
    awardedBy: string | null  // null = automatic
  ): Promise<void> {
    const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (!badge) throw new BadgeNotFoundError(badgeId);

    await db.awardBadge({
      memberId,
      badgeId,
      awardedAt: new Date(),
      awardedBy,
    });

    // Log audit event
    await logAuditEvent('badge_awarded', {
      memberId,
      badgeId,
      badgeName: badge.name,
      awardedBy: awardedBy ?? 'system',
    });

    // Notify member via DM
    await discordService.notifyBadgeAwarded(memberId, badge);

    // Check if this triggers role upgrades
    await this.checkRoleUpgrades(memberId);
  }

  /**
   * Admin: Award contribution badge via slash command or API
   */
  async adminAwardBadge(
    memberNym: string,
    badgeId: string,
    adminId: string
  ): Promise<void> {
    const profile = await db.getProfileByNym(memberNym);
    if (!profile) throw new ProfileNotFoundError();

    const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (!badge) throw new BadgeNotFoundError(badgeId);

    if (badge.isAutomatic) {
      throw new BadgeNotManualError(badgeId);
    }

    await this.awardBadge(profile.id, badgeId, adminId);
  }

  /**
   * Check if badge count triggers role upgrades
   */
  private async checkRoleUpgrades(memberId: string): Promise<void> {
    const badges = await db.getMemberBadges(memberId);
    const badgeCount = badges.length;

    const profile = await db.getProfileById(memberId);
    if (!profile) return;

    // 5+ badges → Engaged role
    if (badgeCount >= 5) {
      await discordService.assignRole(profile.discordUserId, 'engaged');
    }

    // Check tenure for Veteran role
    const tenure = Math.floor((Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (tenure >= 90) {
      await discordService.assignRole(profile.discordUserId, 'veteran');
    }
  }
}

export const badgeService = new BadgeService();
```

### 4.5 Onboarding Service

**Purpose**: DM-based wizard for mandatory profile setup.

```typescript
// src/services/onboarding.ts

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
} from 'discord.js';

type OnboardingStep = 'welcome' | 'nym' | 'pfp' | 'bio' | 'complete';

interface OnboardingState {
  discordUserId: string;
  walletAddress: string;
  currentStep: OnboardingStep;
  nym?: string;
  pfpUrl?: string;
  bio?: string;
  startedAt: Date;
}

class OnboardingService {
  private activeOnboarding = new Map<string, OnboardingState>();

  /**
   * Start onboarding for a new member
   * Called when Collab.Land assigns a base role
   */
  async startOnboarding(discordUserId: string, walletAddress: string): Promise<void> {
    // Check if already onboarded
    const existingProfile = await db.getProfileByDiscordId(discordUserId);
    if (existingProfile?.onboardingComplete) {
      return; // Already onboarded
    }

    // Initialize state
    const state: OnboardingState = {
      discordUserId,
      walletAddress,
      currentStep: 'welcome',
      startedAt: new Date(),
    };
    this.activeOnboarding.set(discordUserId, state);

    // Send welcome DM
    await this.sendWelcomeMessage(discordUserId);
  }

  /**
   * Send the welcome message with privacy assurances
   */
  private async sendWelcomeMessage(discordUserId: string): Promise<void> {
    const member = await discordService.getMemberById(discordUserId);
    if (!member) return;

    const embed = new EmbedBuilder()
      .setTitle('Welcome to Sietch, traveler.')
      .setDescription(
        `You've proven yourself worthy by your BGT holdings.\n` +
        `But here, **your wallet doesn't define you**.\n\n` +
        `In Sietch, you choose who you want to be. Your wallet ` +
        `address will **NEVER** be shown to other members. Your ` +
        `balance is private. Your rank is private.\n\n` +
        `Let's create your anonymous identity...`
      )
      .setColor(0xf5a623)
      .setFooter({ text: 'Step 1 of 3 • Your privacy is protected' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('onboarding_start')
        .setLabel('Begin Setup')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🏜️')
    );

    try {
      await member.send({ embeds: [embed], components: [row] });
    } catch (error) {
      // DMs disabled - fallback to ephemeral in bot channel
      await this.sendEphemeralFallback(discordUserId, embed, row);
    }
  }

  /**
   * Handle nym input step
   */
  async handleNymStep(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
    const state = this.activeOnboarding.get(interaction.user.id);
    if (!state) return;

    if (interaction.isButton() && interaction.customId === 'onboarding_start') {
      // Show modal for nym input
      const modal = new ModalBuilder()
        .setCustomId('onboarding_nym_modal')
        .setTitle('Choose Your Nym');

      const nymInput = new TextInputBuilder()
        .setCustomId('nym_input')
        .setLabel('Pick a name you\'ll be known by in Sietch')
        .setPlaceholder('e.g., CryptoNomad, SpiceTrader, DuneSurfer')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(32)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nymInput)
      );

      await interaction.showModal(modal);
    } else if (interaction.isModalSubmit() && interaction.customId === 'onboarding_nym_modal') {
      const nym = interaction.fields.getTextInputValue('nym_input');

      // Validate nym
      if (!profileService.isValidNym(nym)) {
        await interaction.reply({
          content: 'Invalid nym format. Use 3-32 characters: letters, numbers, underscores, hyphens, or periods.',
          ephemeral: true,
        });
        return;
      }

      if (await profileService.nymExists(nym)) {
        await interaction.reply({
          content: `The nym "${nym}" is already taken. Please choose another.`,
          ephemeral: true,
        });
        return;
      }

      // Save and proceed to next step
      state.nym = nym;
      state.currentStep = 'pfp';
      await this.sendPfpStep(interaction);
    }
  }

  /**
   * Handle PFP step
   */
  private async sendPfpStep(interaction: ModalSubmitInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('Choose Your Avatar')
      .setDescription(
        `Your avatar is your visual identity in Sietch.\n\n` +
        `• **Upload** a custom image (max 2MB)\n` +
        `• **Generate** a unique crypto-art avatar based on your ID\n` +
        `• **Skip** and use the generated avatar later`
      )
      .setColor(0xf5a623)
      .setFooter({ text: 'Step 2 of 3 • Your privacy is protected' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('onboarding_pfp_upload')
        .setLabel('Upload')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📤'),
      new ButtonBuilder()
        .setCustomId('onboarding_pfp_generate')
        .setLabel('Generate')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎨'),
      new ButtonBuilder()
        .setCustomId('onboarding_pfp_skip')
        .setLabel('Skip')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  /**
   * Handle PFP generation
   */
  async handlePfpGenerate(interaction: ButtonInteraction): Promise<void> {
    const state = this.activeOnboarding.get(interaction.user.id);
    if (!state || !state.nym) return;

    await interaction.deferReply({ ephemeral: true });

    // Generate temporary ID for avatar (will be replaced with real profile ID)
    const tempId = crypto.randomUUID();
    const avatarBuffer = await avatarService.generateAvatarImage(tempId);

    // Upload to Discord CDN
    const attachment = new AttachmentBuilder(avatarBuffer, { name: 'avatar.png' });
    const reply = await interaction.editReply({
      content: 'Here\'s your generated avatar:',
      files: [attachment],
    });

    // Store the CDN URL
    const attachmentUrl = reply.attachments.first()?.url;
    if (attachmentUrl) {
      state.pfpUrl = attachmentUrl;
    }

    state.currentStep = 'bio';
    await this.sendBioStep(interaction);
  }

  /**
   * Handle bio step (optional)
   */
  private async sendBioStep(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('Add a Bio (Optional)')
      .setDescription(
        `Tell other members a bit about yourself.\n\n` +
        `• Max 200 characters\n` +
        `• No links allowed (for privacy)\n` +
        `• This is optional - skip if you prefer`
      )
      .setColor(0xf5a623)
      .setFooter({ text: 'Step 3 of 3 • Your privacy is protected' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('onboarding_bio_add')
        .setLabel('Add Bio')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('onboarding_bio_skip')
        .setLabel('Skip')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
  }

  /**
   * Complete onboarding and create profile
   */
  async completeOnboarding(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
    const state = this.activeOnboarding.get(interaction.user.id);
    if (!state || !state.nym) {
      await interaction.reply({
        content: 'Onboarding session expired. Please start again.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Create the profile
      const profile = await profileService.createProfile({
        discordUserId: state.discordUserId,
        walletAddress: state.walletAddress,
        nym: state.nym,
        pfpUrl: state.pfpUrl,
        bio: state.bio,
      });

      // Assign "Onboarded" role (unlocks channel access)
      await discordService.assignRole(state.discordUserId, 'onboarded');

      // Award initial badges
      await this.awardInitialBadges(profile.id);

      // Clear onboarding state
      this.activeOnboarding.delete(state.discordUserId);

      // Send completion message
      const embed = new EmbedBuilder()
        .setTitle(`✨ Your identity is ready, ${state.nym}.`)
        .setDescription(
          `You are now part of the Sietch. No one knows your wallet.\n` +
          `No one knows your balance. You are simply **${state.nym}**.\n\n` +
          `**Explore:**\n` +
          `• \`/directory\` - Browse other members\n` +
          `• \`/badges\` - See available badges\n` +
          `• \`/profile\` - View or edit your profile\n\n` +
          `*The spice must flow.*`
        )
        .setColor(0x2ecc71)
        .setThumbnail(state.pfpUrl ?? null);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Enter Sietch')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${config.discord.guildId}/${config.discord.channels.general}`)
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    } catch (error) {
      if (error instanceof NymTakenError) {
        await interaction.reply({
          content: `The nym "${state.nym}" was just taken by someone else. Please start over.`,
          ephemeral: true,
        });
      } else {
        throw error;
      }
    }
  }

  private async awardInitialBadges(memberId: string): Promise<void> {
    // Check if within first 30 days of Sietch launch
    const launchDate = new Date(config.sietch.launchDate);
    const now = new Date();
    const daysSinceLaunch = Math.floor((now.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLaunch <= 30) {
      await badgeService.awardBadge(memberId, 'founding_fedaykin', null);
    }

    // OG badge for joining in first 30 days (of their membership, not launch)
    await badgeService.awardBadge(memberId, 'og', null);
  }

  /**
   * Fallback for users with DMs disabled
   */
  private async sendEphemeralFallback(
    discordUserId: string,
    embed: EmbedBuilder,
    row: ActionRowBuilder<ButtonBuilder>
  ): Promise<void> {
    const botChannel = await discordService.getBotChannel();
    if (!botChannel) return;

    // Send ephemeral message to bot-commands channel
    // Note: This requires the user to be in the channel and interact first
    // We'll ping them to come complete onboarding
    await botChannel.send({
      content: `<@${discordUserId}> - Please complete your Sietch onboarding to access the community. ` +
               `You have DMs disabled, so please enable them temporarily or use the button below.`,
      embeds: [embed],
      components: [row],
    });
  }
}

export const onboardingService = new OnboardingService();
```

---

## 5. Data Architecture

### 5.1 Extended SQLite Schema

```sql
-- =============================================================================
-- EXISTING TABLES (from v1.0)
-- =============================================================================

-- (Existing tables: eligibility_snapshots, current_eligibility, admin_overrides,
--  audit_log, health_status, wallet_mappings, cached_claim_events, cached_burn_events)
-- See existing schema.ts for full definitions

-- =============================================================================
-- NEW TABLES (v2.0 Social Layer)
-- =============================================================================

-- Member profiles (pseudonymous identity)
-- PRIVACY: wallet_address and discord_user_id are NEVER exposed via public API
CREATE TABLE IF NOT EXISTS member_profiles (
  id TEXT PRIMARY KEY,  -- UUID, internal use only
  discord_user_id TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL COLLATE NOCASE,
  nym TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pfp_url TEXT,
  bio TEXT CHECK (length(bio) <= 200),
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  nym_last_changed TEXT,
  onboarding_complete INTEGER DEFAULT 0 NOT NULL,
  FOREIGN KEY (discord_user_id) REFERENCES wallet_mappings(discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_profiles_nym
  ON member_profiles(nym);

CREATE INDEX IF NOT EXISTS idx_member_profiles_discord
  ON member_profiles(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_member_profiles_wallet
  ON member_profiles(wallet_address);

-- Badge definitions
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('tenure', 'streak', 'contribution', 'special')),
  is_automatic INTEGER DEFAULT 0 NOT NULL
);

-- Member badges (awarded badges)
CREATE TABLE IF NOT EXISTS member_badges (
  member_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  awarded_at TEXT DEFAULT (datetime('now')) NOT NULL,
  awarded_by TEXT,  -- NULL = automatic, admin discord ID = manual
  PRIMARY KEY (member_id, badge_id),
  FOREIGN KEY (member_id) REFERENCES member_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id)
);

CREATE INDEX IF NOT EXISTS idx_member_badges_member
  ON member_badges(member_id);

CREATE INDEX IF NOT EXISTS idx_member_badges_badge
  ON member_badges(badge_id);

-- Member activity (for demurrage-based engagement tracking)
CREATE TABLE IF NOT EXISTS member_activity (
  member_id TEXT PRIMARY KEY,
  activity_balance REAL DEFAULT 0 NOT NULL,  -- Current balance with decay applied
  last_activity_at TEXT,
  last_decay_at TEXT DEFAULT (datetime('now')) NOT NULL,
  total_messages INTEGER DEFAULT 0 NOT NULL,
  total_reactions_given INTEGER DEFAULT 0 NOT NULL,
  total_reactions_received INTEGER DEFAULT 0 NOT NULL,
  FOREIGN KEY (member_id) REFERENCES member_profiles(id) ON DELETE CASCADE
);

-- Member perks/roles (earned access levels)
CREATE TABLE IF NOT EXISTS member_perks (
  member_id TEXT NOT NULL,
  perk_level TEXT NOT NULL CHECK (perk_level IN ('base', 'engaged', 'trusted', 'inner_circle')),
  unlocked_at TEXT DEFAULT (datetime('now')) NOT NULL,
  PRIMARY KEY (member_id, perk_level),
  FOREIGN KEY (member_id) REFERENCES member_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_member_perks_level
  ON member_perks(perk_level);

-- =============================================================================
-- SEED DATA: Badge Definitions
-- =============================================================================

INSERT OR IGNORE INTO badges (id, name, description, icon_url, category, is_automatic) VALUES
  -- Tenure badges
  ('og', 'OG', 'Member in first 30 days of Sietch launch', '/badges/og.png', 'tenure', 1),
  ('veteran', 'Veteran', '90+ days as member', '/badges/veteran.png', 'tenure', 1),
  ('elder', 'Elder', '180+ days as member', '/badges/elder.png', 'tenure', 1),

  -- Activity/Streak badges (demurrage-based)
  ('consistent', 'Consistent', 'Maintain 50+ activity balance', '/badges/consistent.png', 'streak', 1),
  ('dedicated', 'Dedicated', 'Maintain 200+ activity balance', '/badges/dedicated.png', 'streak', 1),
  ('devoted', 'Devoted', 'Maintain 500+ activity balance', '/badges/devoted.png', 'streak', 1),

  -- Contribution badges (admin-granted)
  ('helper', 'Helper', 'Recognized for helping others', '/badges/helper.png', 'contribution', 0),
  ('thought_leader', 'Thought Leader', 'Consistent quality contributions', '/badges/thought_leader.png', 'contribution', 0),

  -- Special badges
  ('founding_fedaykin', 'Founding Fedaykin', 'Original top 69 at launch', '/badges/founding.png', 'special', 1),
  ('promoted', 'Promoted', 'Rose from Fedaykin to Naib', '/badges/promoted.png', 'special', 1);
```

### 5.2 Data Privacy Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Data Privacy Separation                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                     PRIVATE STORE (Admin Only)                       │     │
│  │  - wallet_address                                                    │     │
│  │  - discord_user_id                                                   │     │
│  │  - exact_bgt_balance                                                 │     │
│  │  - exact_rank_position                                               │     │
│  │  - member_profiles.id (internal UUID)                                │     │
│  │  - created_at (exact timestamp)                                      │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              ║                                                │
│                              ║ NEVER JOINED IN PUBLIC API                    │
│                              ║                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                     PUBLIC STORE (Member Visible)                    │     │
│  │  - nym                                                               │     │
│  │  - pfp_url                                                           │     │
│  │  - bio                                                               │     │
│  │  - tier (naib/fedaykin) - derived, not stored                        │     │
│  │  - badges[] - array of badge names/icons                             │     │
│  │  - tenure_category (OG/Veteran/Elder) - derived from days            │     │
│  │  - badge_count - for leaderboard                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                     SELF-ONLY (Own Profile View)                     │     │
│  │  - activity_balance                                                  │     │
│  │  - total_messages                                                    │     │
│  │  - total_reactions_given                                             │     │
│  │  - total_reactions_received                                          │     │
│  │  - last_active_at                                                    │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                     NEVER EXPOSED (Internal Only)                    │     │
│  │  - Wallet-nym correlation                                            │     │
│  │  - Discord username-nym correlation                                  │     │
│  │  - Exact BGT balance amounts                                         │     │
│  │  - Exact rank positions (1-69)                                       │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. API Design

### 6.1 Extended API Endpoints

#### Profile Endpoints

```
# Get own profile (authenticated via Discord OAuth or session)
GET /api/profile
Authorization: Bearer <session_token>

Response 200:
{
  "nym": "CryptoNomad",
  "pfpUrl": "https://cdn.discordapp.com/...",
  "bio": "Just here for the spice",
  "tier": "fedaykin",
  "badges": [
    { "id": "og", "name": "OG", "iconUrl": "/badges/og.png" },
    { "id": "consistent", "name": "Consistent", "iconUrl": "/badges/consistent.png" }
  ],
  "tenureCategory": "OG",
  "stats": {
    "activityBalance": 127,
    "totalMessages": 234,
    "totalReactionsGiven": 89,
    "totalReactionsReceived": 156
  }
}

# Update own profile
PUT /api/profile
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "nym": "NewNym",
  "bio": "Updated bio"
}

Response 200:
{
  "nym": "NewNym",
  "bio": "Updated bio",
  "updatedAt": "2025-12-18T12:00:00Z"
}

# Upload profile picture
POST /api/profile/pfp
Authorization: Bearer <session_token>
Content-Type: multipart/form-data

file: <image file, max 2MB>

Response 200:
{
  "pfpUrl": "https://cdn.discordapp.com/..."
}
```

#### Public Profile Endpoints

```
# Get public profile by nym (privacy-filtered)
GET /api/members/:nym

Response 200:
{
  "nym": "CryptoNomad",
  "pfpUrl": "https://cdn.discordapp.com/...",
  "bio": "Just here for the spice",
  "tier": "fedaykin",
  "badges": [
    { "id": "og", "name": "OG", "iconUrl": "/badges/og.png" }
  ],
  "tenureCategory": "OG"
  // NO wallet, NO discord ID, NO stats
}

Response 404:
{
  "error": "Member not found"
}
```

#### Directory Endpoints

```
# Browse member directory (privacy-filtered)
GET /api/directory?page=1&limit=20&tier=fedaykin&badge=og&sort=nym

Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 20, max: 50)
- tier: Filter by tier (naib | fedaykin)
- badge: Filter by badge ID
- tenure: Filter by tenure category (og | veteran | elder)
- sort: Sort field (nym | tenure | badges)

Response 200:
{
  "members": [
    {
      "nym": "CryptoNomad",
      "pfpUrl": "...",
      "tier": "fedaykin",
      "badges": ["og", "consistent"],
      "badgeCount": 2,
      "tenureCategory": "OG"
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 69,
    "totalPages": 4
  }
}
```

#### Badge Endpoints

```
# Get all available badges
GET /api/badges

Response 200:
{
  "badges": [
    {
      "id": "og",
      "name": "OG",
      "description": "Member in first 30 days of Sietch launch",
      "iconUrl": "/badges/og.png",
      "category": "tenure",
      "isAutomatic": true
    },
    ...
  ]
}

# Get member's badges by nym
GET /api/members/:nym/badges

Response 200:
{
  "nym": "CryptoNomad",
  "badges": [
    {
      "id": "og",
      "name": "OG",
      "iconUrl": "/badges/og.png",
      "awardedAt": "2025-12-01"  // Month/Year only for privacy
    }
  ]
}
```

#### Leaderboard Endpoint

```
# Get engagement leaderboard (rankings + badge counts only)
GET /api/leaderboard?limit=20

Response 200:
{
  "leaderboard": [
    {
      "rank": 1,
      "nym": "SpiceTrader",
      "pfpUrl": "...",
      "badgeCount": 8,
      "tier": "naib"
    },
    {
      "rank": 2,
      "nym": "DuneSurfer",
      "pfpUrl": "...",
      "badgeCount": 7,
      "tier": "fedaykin"
    },
    ...
  ]
  // NO activity stats, NO wallet info
}
```

#### Admin Endpoints (Extended)

```
# Award badge to member (admin only)
POST /api/admin/badges/award
X-API-Key: <admin_api_key>
Content-Type: application/json

{
  "memberNym": "CryptoNomad",
  "badgeId": "helper",
  "reason": "Consistently helpful in #support channel"
}

Response 200:
{
  "success": true,
  "badge": {
    "id": "helper",
    "name": "Helper",
    "awardedTo": "CryptoNomad",
    "awardedBy": "admin1"
  }
}

# Revoke badge (admin only)
DELETE /api/admin/badges/:memberId/:badgeId
X-API-Key: <admin_api_key>

Response 200:
{
  "success": true
}
```

---

## 7. Discord Bot Design

### 7.1 Slash Commands

| Command | Description | Privacy | Response Type |
|---------|-------------|---------|---------------|
| `/profile` | View your own profile | Private | Ephemeral embed |
| `/profile view [nym]` | View another member's profile | Public | Public embed |
| `/profile edit` | Open profile editing wizard | Private | DM-based |
| `/badges` | View your badges | Private | Ephemeral embed |
| `/badges [nym]` | View another member's badges | Public | Public embed |
| `/directory` | Open member directory browser | Interactive | Ephemeral + buttons |
| `/stats` | View your engagement stats | Private | Ephemeral embed |
| `/leaderboard` | View engagement leaderboard | Public | Public embed |
| `/admin-badge award [nym] [badge]` | Award badge (admin) | Admin | Ephemeral |
| `/admin-badge revoke [nym] [badge]` | Revoke badge (admin) | Admin | Ephemeral |

### 7.2 Command Implementations

```typescript
// src/discord/commands/profile.ts

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const profileCommand = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View and manage your Sietch profile')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View a profile')
        .addStringOption(opt =>
          opt.setName('nym')
            .setDescription('Member\'s nym (leave empty for your own)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('edit')
        .setDescription('Edit your profile')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const targetNym = interaction.options.getString('nym');

      if (!targetNym) {
        // Own profile (private, ephemeral)
        await this.showOwnProfile(interaction);
      } else {
        // Other's profile (public)
        await this.showPublicProfile(interaction, targetNym);
      }
    } else if (subcommand === 'edit') {
      // Start edit wizard in DM
      await this.startEditWizard(interaction);
    }
  },

  async showOwnProfile(interaction: ChatInputCommandInteraction) {
    const profile = await profileService.getOwnProfile(interaction.user.id);

    if (!profile) {
      await interaction.reply({
        content: 'You haven\'t completed onboarding yet. Check your DMs!',
        ephemeral: true,
      });
      return;
    }

    const stats = await activityService.getOwnStats(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle(profile.nym)
      .setThumbnail(profile.pfpUrl ?? avatarService.generateAvatarUrl(profile.id))
      .setDescription(profile.bio ?? '*No bio set*')
      .setColor(profile.tier === 'naib' ? 0xf5a623 : 0x3498db)
      .addFields(
        { name: 'Tier', value: profile.tier === 'naib' ? 'Naib' : 'Fedaykin', inline: true },
        { name: 'Tenure', value: profile.tenureCategory, inline: true },
        { name: 'Badges', value: profile.badges.map(b => b.name).join(', ') || 'None yet', inline: false },
        { name: 'Activity Balance', value: `${stats?.activityBalance ?? 0}`, inline: true },
        { name: 'Messages', value: `${stats?.totalMessages ?? 0}`, inline: true },
      )
      .setFooter({ text: 'Your wallet and balance are private' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async showPublicProfile(interaction: ChatInputCommandInteraction, nym: string) {
    const profile = await profileService.getPublicProfile(nym);

    if (!profile) {
      await interaction.reply({
        content: `Member "${nym}" not found.`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(profile.nym)
      .setThumbnail(profile.pfpUrl)
      .setDescription(profile.bio ?? '*No bio set*')
      .setColor(profile.tier === 'naib' ? 0xf5a623 : 0x3498db)
      .addFields(
        { name: 'Tier', value: profile.tier === 'naib' ? 'Naib' : 'Fedaykin', inline: true },
        { name: 'Tenure', value: profile.tenureCategory, inline: true },
        { name: 'Badges', value: profile.badges.map(b => b.name).join(', ') || 'None yet', inline: false },
      );

    await interaction.reply({ embeds: [embed] });  // Public response
  },
};
```

### 7.3 Interactive Components

```typescript
// src/discord/interactions/directory.ts

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} from 'discord.js';

/**
 * Directory browser with pagination and filters
 */
export async function handleDirectoryCommand(interaction: ChatInputCommandInteraction) {
  const page = 1;
  const filters = { tier: null, badge: null, tenure: null };

  await showDirectoryPage(interaction, page, filters);
}

async function showDirectoryPage(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  page: number,
  filters: DirectoryFilters
) {
  const result = await profileService.getDirectory({
    page,
    limit: 10,
    ...filters,
  });

  const embed = new EmbedBuilder()
    .setTitle('Sietch Member Directory')
    .setColor(0xf5a623)
    .setDescription(
      result.members.map((m, i) => {
        const rank = (page - 1) * 10 + i + 1;
        const badges = m.badges.slice(0, 3).map(b => b.emoji).join(' ');
        return `**${rank}.** ${m.nym} · ${m.tier === 'naib' ? 'Naib' : 'Fedaykin'} ${badges}`;
      }).join('\n')
    )
    .setFooter({ text: `Page ${page} of ${result.totalPages} · ${result.total} members` });

  // Filter dropdown
  const filterRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('directory_filter')
      .setPlaceholder('Filter by...')
      .addOptions([
        { label: 'All Members', value: 'all' },
        { label: 'Naib Only', value: 'tier:naib' },
        { label: 'Fedaykin Only', value: 'tier:fedaykin' },
        { label: 'Has OG Badge', value: 'badge:og' },
        { label: 'Veterans (90+ days)', value: 'tenure:veteran' },
      ])
  );

  // Pagination buttons
  const paginationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`directory_prev:${page}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`directory_page:${page}`)
      .setLabel(`${page}/${result.totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`directory_next:${page}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= result.totalPages),
  );

  const replyOptions = {
    embeds: [embed],
    components: [filterRow, paginationRow],
    ephemeral: true,
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(replyOptions);
  } else {
    await interaction.reply(replyOptions);
  }
}
```

### 7.4 Discord Roles Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Discord Role Hierarchy                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  ADMIN ROLES (Manual Assignment)                                     │     │
│  │  - @Admin                                                            │     │
│  │  - @Moderator                                                        │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  ELIGIBILITY ROLES (Collab.Land Managed)                            │     │
│  │  - @Naib (top 7) - Highest tier, council access                     │     │
│  │  - @Fedaykin (top 8-69) - Base eligible tier                        │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  ONBOARDING ROLE (Bot Managed)                                       │     │
│  │  - @Onboarded - Granted after completing profile setup               │     │
│  │    → Without this, can't see main channels                          │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  ENGAGEMENT ROLES (Bot Managed, Dynamic)                             │     │
│  │  - @Engaged - 5+ badges OR activity balance > 200                   │     │
│  │    → Access to #deep-desert                                         │     │
│  │  - @Veteran - 90+ days tenure                                       │     │
│  │    → Access to #stillsuit-lounge                                    │     │
│  │  - @Trusted - 10+ badges OR Helper badge                            │     │
│  │    → Early event access                                             │     │
│  │  - @Inner-Circle - Admin granted only                               │     │
│  │    → Preview features, special events                               │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  COSMETIC ROLES (Bot Managed, Badge Rewards)                         │     │
│  │  - Custom color roles (unlocked at 10+ badges)                      │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Security Architecture

### 8.1 Privacy Controls

| Data | API Exposure | Log Exposure | Database Access |
|------|--------------|--------------|-----------------|
| Wallet Address | Never | Admin only (encrypted) | Admin only |
| Discord User ID | Never | Admin only | Admin only |
| Exact BGT Balance | Never | Never | Admin only |
| Exact Rank | Never | Never | Admin only |
| Nym | Public | Safe to log | Public |
| Bio | Public | Safe to log | Public |
| Badges | Public | Safe to log | Public |
| Activity Stats | Self only | Per-member | Admin only |

### 8.2 API Authentication

```typescript
// src/api/middleware.ts

/**
 * Authentication strategy:
 * - Public endpoints: No auth, rate limited
 * - Profile endpoints: Discord OAuth session
 * - Admin endpoints: API key
 */

// Discord OAuth session middleware
const sessionAuthMiddleware = async (req, res, next) => {
  const sessionToken = req.cookies.sietch_session;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const session = await sessionStore.get(sessionToken);
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Session expired' });
  }

  req.discordUserId = session.discordUserId;
  next();
};

// Admin API key middleware (unchanged from v1)
const adminAuthMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const admin = validateApiKey(apiKey);
  if (!admin) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  req.admin = admin;
  next();
};
```

### 8.3 Rate Limiting

```typescript
// Extended rate limiting for new endpoints
const rateLimits = {
  // Public endpoints
  eligibility: rateLimit({ windowMs: 60000, max: 100 }),
  directory: rateLimit({ windowMs: 60000, max: 50 }),
  publicProfile: rateLimit({ windowMs: 60000, max: 100 }),

  // Authenticated endpoints
  ownProfile: rateLimit({ windowMs: 60000, max: 30 }),
  profileUpdate: rateLimit({ windowMs: 60000, max: 10 }),
  pfpUpload: rateLimit({ windowMs: 60000, max: 3 }),

  // Admin endpoints
  adminBadge: rateLimit({ windowMs: 60000, max: 30 }),
};
```

### 8.4 Image Upload Security

```typescript
// src/utils/image.ts

import sharp from 'sharp';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const OUTPUT_SIZE = 256; // 256x256 output

/**
 * Process and validate uploaded profile image
 * - Validates file type (PNG, JPG, GIF, WebP)
 * - Resizes to 256x256
 * - Compresses to under 1MB for Discord CDN
 * - Strips EXIF data (privacy)
 */
export async function processProfileImage(buffer: Buffer): Promise<Buffer> {
  // Validate size
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new ImageTooLargeError();
  }

  // Process with sharp
  const processed = await sharp(buffer)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'cover',
      position: 'center',
    })
    .removeAlpha() // Remove alpha for smaller size
    .jpeg({ quality: 85 }) // Compress as JPEG
    .toBuffer();

  // Final size check
  if (processed.length > 1024 * 1024) {
    // Re-compress with lower quality
    return sharp(buffer)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  return processed;
}
```

---

## 9. Scheduled Tasks

### 9.1 trigger.dev Tasks

```typescript
// trigger/activityDecay.ts

import { schedules, logger } from "@trigger.dev/sdk/v3";
import { activityService } from "../src/services/activity";

/**
 * Activity Decay Task
 * Runs every 6 hours to apply demurrage to activity balances
 */
export const activityDecay = schedules.task({
  id: "activity-decay",
  cron: "0 */6 * * *", // Every 6 hours
  maxDuration: 120,    // 2 minutes max
  run: async (payload, { ctx }) => {
    logger.info("Starting activity decay", { runId: ctx.run.id });

    const result = await activityService.runDecayTask();

    logger.info("Activity decay completed", result);
    return result;
  },
});

// trigger/badgeCheck.ts

import { schedules, logger } from "@trigger.dev/sdk/v3";
import { badgeService } from "../src/services/badge";

/**
 * Badge Check Task
 * Runs daily to check and award tenure badges
 */
export const badgeCheck = schedules.task({
  id: "badge-check",
  cron: "0 0 * * *", // Daily at midnight
  maxDuration: 300,  // 5 minutes max
  run: async (payload, { ctx }) => {
    logger.info("Starting badge check", { runId: ctx.run.id });

    const allMembers = await db.getAllMemberIds();
    let awarded = 0;

    for (const memberId of allMembers) {
      const badges = await badgeService.checkTenureBadges(memberId);
      awarded += badges.length;
    }

    logger.info("Badge check completed", { checked: allMembers.length, awarded });
    return { checked: allMembers.length, awarded };
  },
});
```

---

## 10. Deployment Architecture

### 10.1 Extended Environment Configuration

```bash
# /opt/sietch/.env (extended for v2.0)

# =============================================================================
# Existing v1.0 Configuration
# =============================================================================
BERACHAIN_RPC_URLS=https://rpc.berachain.com,https://bera-rpc.publicnode.com
BGT_ADDRESS=0x...
REWARD_VAULT_ADDRESSES=0x...,0x...,0x...

TRIGGER_PROJECT_ID=sietch-service
TRIGGER_SECRET_KEY=your_trigger_secret_key

DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_guild_id
DISCORD_CHANNEL_THE_DOOR=channel_id
DISCORD_CHANNEL_CENSUS=channel_id
DISCORD_ROLE_NAIB=role_id
DISCORD_ROLE_FEDAYKIN=role_id

API_PORT=3000
API_HOST=127.0.0.1
ADMIN_API_KEYS=key1:admin1,key2:admin2

DATABASE_PATH=/opt/sietch/data/sietch.db
LOG_LEVEL=info

# =============================================================================
# New v2.0 Configuration
# =============================================================================

# Sietch launch date (for OG badge calculation)
SIETCH_LAUNCH_DATE=2025-12-18

# Additional Discord roles
DISCORD_ROLE_ONBOARDED=role_id
DISCORD_ROLE_ENGAGED=role_id
DISCORD_ROLE_VETERAN=role_id
DISCORD_ROLE_TRUSTED=role_id
DISCORD_ROLE_INNER_CIRCLE=role_id

# Additional Discord channels
DISCORD_CHANNEL_GENERAL=channel_id
DISCORD_CHANNEL_BOT_COMMANDS=channel_id
DISCORD_CHANNEL_DEEP_DESERT=channel_id
DISCORD_CHANNEL_STILLSUIT_LOUNGE=channel_id

# Tracked channels for activity (comma-separated)
DISCORD_TRACKED_CHANNELS=channel_id1,channel_id2,channel_id3

# Activity decay configuration
ACTIVITY_DECAY_RATE=0.9
ACTIVITY_DECAY_INTERVAL_HOURS=6

# Session configuration (for web API auth)
SESSION_SECRET=your_session_secret
SESSION_EXPIRY_HOURS=24
```

---

## 11. Migration Plan

### 11.1 v1.0 to v2.0 Migration

```typescript
// src/db/migrations/002_social_layer.ts

export async function up(db: Database): Promise<void> {
  // Run new table creation SQL
  db.exec(SOCIAL_LAYER_SCHEMA_SQL);

  // Migrate existing members
  const existingMappings = db.prepare(`
    SELECT discord_user_id, wallet_address, verified_at
    FROM wallet_mappings
  `).all();

  for (const mapping of existingMappings) {
    // Check if in current eligibility
    const eligibility = db.prepare(`
      SELECT address FROM current_eligibility WHERE address = ?
    `).get(mapping.wallet_address);

    if (eligibility) {
      // Create placeholder profile (onboarding not complete)
      db.prepare(`
        INSERT INTO member_profiles (
          id, discord_user_id, wallet_address, nym,
          created_at, updated_at, onboarding_complete
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(
        crypto.randomUUID(),
        mapping.discord_user_id,
        mapping.wallet_address,
        `Member_${mapping.discord_user_id.slice(-6)}`, // Temporary nym
        mapping.verified_at,
        new Date().toISOString()
      );
    }
  }

  logger.info(`Migrated ${existingMappings.length} members to v2.0 schema`);
}

export async function down(db: Database): Promise<void> {
  // Drop new tables (careful - data loss!)
  db.exec(`
    DROP TABLE IF EXISTS member_perks;
    DROP TABLE IF EXISTS member_activity;
    DROP TABLE IF EXISTS member_badges;
    DROP TABLE IF EXISTS badges;
    DROP TABLE IF EXISTS member_profiles;
  `);
}
```

### 11.2 Existing Member Onboarding

Existing members (from v1.0) will be prompted to complete their profile:

1. On bot startup, check for profiles with `onboarding_complete = 0`
2. Send them a DM prompting them to complete setup
3. They can access channels but will see a persistent reminder
4. After completing onboarding, they get their full profile and any retroactive badges

---

## 12. Technical Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Privacy leak (wallet-nym correlation) | Low | Critical | Strict data separation, security audit, never join in API |
| Nym collision race condition | Low | Medium | Database UNIQUE constraint, transaction isolation |
| Avatar generation performance | Low | Low | Pre-generate on profile creation, cache result |
| Activity tracking spam | Medium | Medium | Rate limit messages, diminishing returns on rapid activity |
| Discord CDN image deletion | Low | Medium | Store original in DB, regenerate if CDN fails |
| Onboarding drop-off | Medium | Medium | Reminders, simplified flow, ephemeral fallback |
| Badge gaming | Low | Medium | Demurrage system naturally prevents, admin review for contribution badges |

---

## 13. Future Considerations

### 13.1 Potential Enhancements

| Enhancement | Complexity | Value | Notes |
|-------------|------------|-------|-------|
| Web dashboard | High | High | Full profile management outside Discord |
| NFT badges | Medium | Medium | On-chain proof of achievements |
| Cross-server identity | High | Low | Portability to other communities |
| Governance integration | Medium | Medium | Badge-weighted voting |
| API for external tools | Low | Medium | Let community build on profiles |

### 13.2 Technical Debt Awareness

- **Discord CDN dependency**: If Discord changes CDN policies, need fallback storage
- **SQLite scale**: Still appropriate for 69 members, but monitor if expanding
- **Demurrage tuning**: May need to adjust decay rate based on community feedback

---

## 14. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-17 | Initial MVP - eligibility, API, Discord notifications |
| 2.0 | 2025-12-18 | Social Layer - profiles, badges, directory, activity tracking |

---

*Document generated by Architecture Designer*

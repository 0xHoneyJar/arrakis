# Arrakis Coexistence Architecture

## Shadow Mode & Incumbent Migration System

**Version:** 0.1.0-DRAFT  
**Status:** Architecture Specification  
**Target Sprint:** TBD (Post v5.2)  
**Author:** Claude + Jani  
**Date:** 2024-12-30

---

## Executive Summary

This document specifies the architecture for Arrakis to coexist alongside incumbent token-gating solutions (Collab.Land, Matrica, Guild.xyz) with a graceful migration path. The design philosophy is:

> **"Low-friction entry, high-value destination"**

Communities can install Arrakis with near-zero risk, observe its capabilities in shadow mode, and migrate at their own pace with full rollback capability.

---

## Design Principles

### 1. Zero-Risk Installation
- Arrakis never touches incumbent-managed roles in shadow mode
- All Arrakis roles are namespaced (`@arrakis-*`) until explicit migration
- Admin can remove Arrakis at any time with no cleanup required

### 2. Progressive Trust Building
- Shadow mode proves accuracy over time
- Metrics dashboard shows "what Arrakis would do" vs. incumbent
- Migration happens when admin confidence is earned, not demanded

### 3. Feature Differentiation First
- Lead with capabilities incumbents can't offer (conviction scoring, BGT-specific logic)
- Social layer preview creates FOMO without requiring commitment
- "Glimpse mode" shows value waiting on the other side

### 4. Graceful Degradation
- If incumbent fails, Arrakis can step up (with admin approval)
- Rollback is always one click away
- No vendor lock-in tactics

---

## System Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARRAKIS OPERATING MODES                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   SHADOW    │───▶│  PARALLEL   │───▶│   PRIMARY   │───▶│  EXCLUSIVE  │  │
│  │    MODE     │    │    MODE     │    │    MODE     │    │    MODE     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
│  Observe only       Arrakis roles      Arrakis is         Incumbent        │
│  No role changes    alongside CL       source of truth    removed          │
│  Build confidence   Users see both     CL as backup       Full features    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mode Definitions

| Mode | Role Management | Channel Management | Social Layer | Incumbent Status |
|------|-----------------|-------------------|--------------|------------------|
| **Shadow** | None - observe only | None | Glimpse only | Active, untouched |
| **Parallel** | `@arrakis-*` roles | Optional parallel channels | Glimpse only | Active, untouched |
| **Primary** | `@arrakis-*` roles (authoritative) | Full channel management | Full features | Optional backup |
| **Exclusive** | Takes over incumbent roles | Full channel management | Full features | Removed |

---

## Phase 1: Shadow Mode

### 1.1 Installation Flow

```typescript
interface ShadowInstallation {
  // Step 1: Bot joins server
  onGuildCreate(guild: Guild): Promise<void>;
  
  // Step 2: Auto-detect incumbent
  detectIncumbent(guild: Guild): Promise<IncumbentInfo>;
  
  // Step 3: Configure shadow tracking
  initializeShadowLedger(guild: Guild): Promise<ShadowLedger>;
  
  // Step 4: Start observation (no Discord changes)
  startShadowSync(guild: Guild): Promise<void>;
}
```

**Admin Experience:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  🌙 ARRAKIS SHADOW MODE SETUP                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✓ Detected: Collab.Land (Bot ID: 704521096837464076)              │
│  ✓ Found verification channel: #collabland-join                    │
│  ✓ Detected token-gated roles:                                     │
│      • @Holder (234 members)                                       │
│      • @Whale (12 members)                                         │
│      • @OG (45 members)                                            │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Arrakis will now observe your community in Shadow Mode.      │ │
│  │                                                                │ │
│  │  • We will NOT change any roles                               │ │
│  │  • We will NOT create any channels                            │ │
│  │  • We will NOT interfere with Collab.Land                     │ │
│  │                                                                │ │
│  │  What we WILL do:                                             │ │
│  │  • Track what roles we WOULD assign                           │ │
│  │  • Calculate conviction scores for verified members           │ │
│  │  • Generate comparison reports (Arrakis vs Collab.Land)       │ │
│  │  • Alert you if we detect incumbent issues                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [Continue to Shadow Mode →]                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Incumbent Detection

```typescript
interface IncumbentInfo {
  provider: 'collabland' | 'matrica' | 'guild.xyz' | 'vulcan' | 'other' | null;
  confidence: number;  // 0-1, how sure we are
  
  bot: {
    id: string;
    username: string;
    joinedAt: Date;
  } | null;
  
  channels: {
    verification: string | null;   // #collabland-join, #matrica-verify
    config: string | null;         // #collabland-config
  };
  
  roles: {
    id: string;
    name: string;
    memberCount: number;
    likelyTokenGated: boolean;
    confidence: number;
  }[];
  
  capabilities: {
    hasBalanceCheck: boolean;      // Periodic re-verification
    hasConvictionScoring: boolean; // Usually false for incumbents
    hasTierSystem: boolean;        // Multiple levels
    hasSocialLayer: boolean;       // Profiles, badges
  };
}

// Detection heuristics
const KNOWN_INCUMBENTS = {
  collabland: {
    botIds: ['704521096837464076'],
    channelPatterns: ['collabland-join', 'collabland-config'],
    rolePatterns: ['holder', 'verified', 'whale'],
  },
  matrica: {
    botIds: [], // Add known Matrica bot IDs
    channelPatterns: ['matrica-verify', 'matrica'],
    rolePatterns: ['verified', 'holder'],
  },
  'guild.xyz': {
    botIds: [], // Add known Guild.xyz bot IDs
    channelPatterns: ['guild-join'],
    rolePatterns: ['guild-member'],
  },
};
```

### 1.3 Shadow Ledger

The Shadow Ledger tracks what Arrakis *would* do without actually doing it.

```typescript
// Database schema (PostgreSQL)
interface ShadowLedgerSchema {
  // Core state table
  shadow_member_state: {
    id: string;                     // UUID
    guild_id: string;
    discord_id: string;
    
    // Incumbent observation
    incumbent_roles: string[];      // Current Discord role IDs
    incumbent_last_change: Date;
    
    // Arrakis calculation (if user verified with Arrakis)
    arrakis_wallet: string | null;
    arrakis_eligibility: 'none' | 'naib' | 'fedaykin';
    arrakis_conviction: number;     // 0-100
    arrakis_would_assign: string[]; // Role names we'd give
    arrakis_would_revoke: string[]; // Role names we'd remove
    
    // Comparison status
    divergence_status: 'match' | 'arrakis_higher' | 'arrakis_lower' | 'unknown';
    
    updated_at: Date;
  };
  
  // Divergence history
  shadow_divergences: {
    id: string;
    guild_id: string;
    discord_id: string;
    
    divergence_type: 'promotion' | 'demotion' | 'addition' | 'removal';
    incumbent_state: string;        // e.g., "@Holder"
    arrakis_state: string;          // e.g., "Fedaykin (conviction: 92)"
    reason: string;
    
    detected_at: Date;
    resolved_at: Date | null;       // When/if incumbent caught up
    resolution: 'incumbent_matched' | 'arrakis_wrong' | 'still_divergent' | null;
  };
  
  // Prediction accuracy tracking
  shadow_predictions: {
    id: string;
    guild_id: string;
    discord_id: string;
    
    prediction_type: 'will_lose_role' | 'will_gain_role' | 'will_be_promoted';
    predicted_at: Date;
    prediction_details: jsonb;
    
    outcome: 'correct' | 'incorrect' | 'pending';
    outcome_at: Date | null;
  };
}
```

### 1.4 Shadow Sync Job

```typescript
// Runs every 6 hours (matching Collab.Land's typical balance check interval)
class ShadowSyncJob {
  async execute(guildId: string): Promise<ShadowSyncResult> {
    const guild = await this.client.guilds.fetch(guildId);
    const config = await this.getGuildConfig(guildId);
    const ledger = await this.getShadowLedger(guildId);
    
    // 1. Snapshot current Discord state
    const members = await guild.members.fetch();
    const incumbentRoleIds = config.incumbent.detectedRoles;
    
    const results: MemberSyncResult[] = [];
    
    for (const [memberId, member] of members) {
      // Skip bots
      if (member.user.bot) continue;
      
      // 2. Record incumbent state
      const incumbentRoles = member.roles.cache
        .filter(r => incumbentRoleIds.includes(r.id))
        .map(r => ({ id: r.id, name: r.name }));
      
      // 3. Calculate Arrakis state (if user has verified)
      const wallet = await this.walletRegistry.getWalletForDiscord(memberId);
      let arrakisState: ArrakisState = { eligibility: 'unknown', conviction: 0 };
      
      if (wallet) {
        const eligibility = await this.chainProvider.evaluateEligibility(wallet, guildId);
        arrakisState = {
          eligibility: eligibility.tier,
          conviction: eligibility.conviction,
          wouldAssign: this.mapTierToRoles(eligibility.tier),
          wouldRevoke: this.calculateRevocations(incumbentRoles, eligibility),
        };
      }
      
      // 4. Detect divergence
      const divergence = this.detectDivergence(incumbentRoles, arrakisState);
      
      if (divergence) {
        await this.recordDivergence(ledger, memberId, divergence);
      }
      
      // 5. Update shadow state (NO DISCORD CHANGES)
      await this.updateShadowState(ledger, memberId, {
        incumbentRoles,
        arrakisState,
        divergenceStatus: divergence?.type || 'match',
      });
      
      results.push({ memberId, divergence });
    }
    
    // 6. Check for predictions that came true
    await this.validatePredictions(guildId);
    
    // 7. Generate admin digest (if configured)
    if (config.notifications.shadowDigest) {
      await this.sendShadowDigest(guildId, results);
    }
    
    return { processed: results.length, divergences: results.filter(r => r.divergence) };
  }
}
```

### 1.5 Verification Strategy: Tiered Access

Users with existing incumbent verification get basic access; re-verifying with Arrakis unlocks rich features.

```typescript
interface VerificationTier {
  tier: 'incumbent_only' | 'arrakis_basic' | 'arrakis_full';
  
  // What each tier enables
  features: {
    // Tier 1: Incumbent Only (user has CL @Holder but hasn't touched Arrakis)
    incumbent_only: {
      shadowTracking: true;           // We track their state
      publicLeaderboard: true;        // They appear (wallet hidden)
      profileView: false;             // Can't see profiles
      badgesEarn: false;              // Can't earn badges
      convictionScore: false;         // No conviction data
      tierProgression: false;         // No Naib/Fedaykin
    };
    
    // Tier 2: Arrakis Basic (verified wallet, but incumbent still active)
    arrakis_basic: {
      shadowTracking: true;
      publicLeaderboard: true;        // Full leaderboard presence
      profileView: true;              // Can view others' profiles
      badgesEarn: false;              // Badges gated to full mode
      convictionScore: true;          // See their own score
      tierProgression: 'preview';     // See what tier they'd be
    };
    
    // Tier 3: Arrakis Full (post-migration or parallel mode active)
    arrakis_full: {
      shadowTracking: false;          // No longer needed
      publicLeaderboard: true;
      profileView: true;
      badgesEarn: true;               // Full badge system
      convictionScore: true;
      tierProgression: true;          // Active tier with roles
    };
  };
}
```

**Verification Flow:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER VERIFICATION EXPERIENCE                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User has @Holder from Collab.Land                                  │
│  ↓                                                                  │
│  User runs /arrakis verify                                          │
│  ↓                                                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  👋 Welcome! We see you're already verified with Collab.Land  │ │
│  │                                                                │ │
│  │  You can:                                                      │ │
│  │                                                                │ │
│  │  [Quick Start - Use Existing Verification]                     │ │
│  │  • See the public leaderboard                                 │ │
│  │  • Track your position                                        │ │
│  │  • No wallet connection needed                                │ │
│  │                                                                │ │
│  │  [Full Experience - Connect Wallet]                            │ │
│  │  • Unlock your Conviction Score                               │ │
│  │  • See your tier preview (Naib/Fedaykin)                      │ │
│  │  • View member profiles                                       │ │
│  │  • Ready for full features when community migrates            │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  After wallet connection:                                           │
│  ↓                                                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ✓ Wallet connected: 0x1234...5678                            │ │
│  │                                                                │ │
│  │  Your Arrakis Preview:                                        │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  Conviction Score: 87 / 100                             │  │ │
│  │  │  ████████████████████░░░                                │  │ │
│  │  │                                                          │  │ │
│  │  │  You would be: FEDAYKIN                                  │  │ │
│  │  │  (Top 15% of holders by conviction)                     │  │ │
│  │  │                                                          │  │ │
│  │  │  🔒 Badges & Profile unlock after community migration   │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  [View Leaderboard]  [What is Conviction?]                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 2: Parallel Mode

### 2.1 Parallel Role Strategy

Arrakis creates its own namespaced roles that coexist with incumbent roles.

```typescript
interface ParallelRoleConfig {
  // Arrakis role definitions (never conflict with incumbent)
  roles: {
    namespace: 'arrakis';  // All roles prefixed with "arrakis-"
    
    definitions: [
      {
        name: 'arrakis-verified',
        color: '#808080',
        description: 'Verified with Arrakis',
        grantCondition: 'wallet_connected',
      },
      {
        name: 'arrakis-naib',
        color: '#C0C0C0',
        description: 'Arrakis Naib tier',
        grantCondition: 'tier >= naib',
      },
      {
        name: 'arrakis-fedaykin',
        color: '#FFD700',
        description: 'Arrakis Fedaykin tier',
        grantCondition: 'tier >= fedaykin',
      },
      {
        name: 'arrakis-diamond',
        color: '#00FFFF',
        description: 'Diamond hands (conviction 90+)',
        grantCondition: 'conviction >= 90',
      },
    ];
  };
  
  // Position in role hierarchy
  positioning: {
    strategy: 'below_incumbent';  // Never above incumbent roles
    belowRole: string | null;     // Specific role to position under
  };
}

async function setupParallelRoles(guild: Guild, config: ParallelRoleConfig): Promise<void> {
  // Find incumbent's highest role for positioning
  const incumbentInfo = await detectIncumbent(guild);
  const incumbentHighestRole = guild.roles.cache
    .filter(r => incumbentInfo.roles.some(ir => ir.id === r.id))
    .sort((a, b) => b.position - a.position)
    .first();
  
  // Create Arrakis roles below incumbent
  for (const roleDef of config.roles.definitions) {
    const existingRole = guild.roles.cache.find(r => r.name === roleDef.name);
    
    if (!existingRole) {
      await guild.roles.create({
        name: roleDef.name,
        color: roleDef.color,
        reason: 'Arrakis parallel mode setup',
        position: incumbentHighestRole 
          ? incumbentHighestRole.position - 1 
          : 1,
        permissions: [],  // No special permissions
        hoist: false,     // Don't display separately
        mentionable: false,
      });
    }
  }
}
```

### 2.2 Parallel Channel Strategy

Admin chooses their channel strategy:

```typescript
type ChannelStrategy = 
  | 'none'              // No channels, roles only
  | 'additive_only'     // Only channels for Arrakis-unique features
  | 'parallel_mirror'   // Mirror incumbent channels
  | 'custom';           // Admin defines manually

interface ChannelConfig {
  strategy: ChannelStrategy;
  
  // For 'additive_only' - channels incumbents CAN'T offer
  additiveChannels: [
    {
      name: 'conviction-lounge',
      description: 'For members with conviction score 80+',
      requirement: { type: 'conviction', min: 80 },
    },
    {
      name: 'diamond-hands',
      description: 'Held through the dip? This is your space.',
      requirement: { type: 'conviction', min: 95 },
    },
    {
      name: 'fedaykin-strategy',
      description: 'Top tier holders discuss alpha',
      requirement: { type: 'tier', value: 'fedaykin' },
    },
    {
      name: 'arrakis-profiles',
      description: 'Customize your community profile',
      requirement: { type: 'role', value: 'arrakis-verified' },
    },
  ];
  
  // For 'parallel_mirror' - mirrors of incumbent channels
  parallelChannels: [
    {
      mirrorOf: 'alpha-chat',
      arrakisName: 'arrakis-alpha',
      requirement: { type: 'role', value: 'arrakis-fedaykin' },
    },
  ];
}
```

**Admin Setup Flow:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  PARALLEL MODE CHANNEL SETUP                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  How would you like to handle channels?                             │
│                                                                     │
│  ○ No new channels                                                  │
│    Arrakis manages roles only. Use existing Collab.Land channels.   │
│                                                                     │
│  ● Arrakis-exclusive features only (Recommended)                    │
│    Create channels for features Collab.Land can't offer:           │
│    • #conviction-lounge (conviction 80+)                           │
│    • #diamond-hands (conviction 95+)                                │
│    • #arrakis-profiles (profile customization)                     │
│                                                                     │
│  ○ Mirror existing channels                                         │
│    Create Arrakis versions alongside Collab.Land channels.         │
│    Users can compare access between systems.                       │
│                                                                     │
│  ○ Custom setup                                                     │
│    Define your own channel structure.                              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  💡 We recommend "Arrakis-exclusive features only"            │ │
│  │                                                                │ │
│  │  This showcases what makes Arrakis different without          │ │
│  │  duplicating what Collab.Land already does well.              │ │
│  │                                                                │ │
│  │  Your community gets new value immediately, and you can       │ │
│  │  evaluate Arrakis based on its unique capabilities.           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [← Back]                              [Continue with Selected →]   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Social Layer (Glimpse Mode)

### 3.1 Glimpse Mode Concept

Before full migration, users see a "preview" of social features without full functionality.

```typescript
interface GlimpseMode {
  // What users CAN see
  visible: {
    leaderboard: true;              // Public ranking
    otherProfiles: 'blurred';       // See that profiles exist, content obscured
    badgeShowcase: 'locked';        // See badges exist, can't earn
    convictionScore: 'own_only';    // See own score, not others
    tierPreview: true;              // "You would be Fedaykin"
  };
  
  // What users CAN'T do
  locked: {
    editProfile: true;
    earnBadges: true;
    viewFullProfiles: true;
    accessDirectory: true;
    compareConviction: true;
  };
  
  // Messaging
  lockedMessage: "🔐 Full profiles unlock when your community completes migration";
  ctaMessage: "Ask your admin about Arrakis migration to unlock all features";
}
```

**Glimpse UI Example:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  COMMUNITY DIRECTORY (GLIMPSE MODE)                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🔒 Full Directory unlocks after migration                  │   │
│  │                                                              │   │
│  │  Preview of what's waiting for your community:              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │ ░░░░░░░░░ │  │ ░░░░░░░░░ │  │ ░░░░░░░░░ │  │ ░░░░░░░░░ │       │
│  │ ░░░░░░░░░ │  │ ░░░░░░░░░ │  │ ░░░░░░░░░ │  │ ░░░░░░░░░ │       │
│  │           │  │           │  │           │  │           │       │
│  │ @alice    │  │ @bob      │  │ @carol    │  │ @dave     │       │
│  │ Fedaykin  │  │ Fedaykin  │  │ Naib      │  │ Naib      │       │
│  │ 🔒🔒🔒🔒  │  │ 🔒🔒🔒    │  │ 🔒🔒      │  │ 🔒        │       │
│  │           │  │           │  │           │  │           │       │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘       │
│                                                                     │
│  📊 23 Fedaykin · 156 Naib · 412 Verified                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Your Preview Profile:                                       │   │
│  │                                                              │   │
│  │  @yourname                                                   │   │
│  │  Would be: FEDAYKIN                                          │   │
│  │  Conviction: 87                                              │   │
│  │  Badges ready to claim: 3                                    │   │
│  │                                                              │   │
│  │  [Tell Admin to Migrate →]                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Post-Migration Social Layer

After migration completes, full social features unlock:

```typescript
interface FullSocialLayer {
  profiles: {
    customBio: true;
    avatarFrame: true;              // Tier-based frame
    badgeDisplay: true;             // Up to 5 featured badges
    walletDisplay: 'optional';      // User chooses to show
    convictionHistory: true;        // Graph over time
    achievementTimeline: true;
  };
  
  directory: {
    searchable: true;
    filterByTier: true;
    filterByConviction: true;
    filterByBadges: true;
    sortByHoldDuration: true;
  };
  
  badges: {
    categories: ['tier', 'conviction', 'community', 'special'];
    earnableInParallel: false;      // Only after migration
    retroactiveGrant: true;         // Grant badges for past behavior
  };
  
  leaderboard: {
    public: true;
    anonymousOption: true;          // Hide wallet, show rank only
    convictionRanking: true;
    holdDurationRanking: true;
    badgeCountRanking: true;
  };
}
```

---

## Phase 4: Migration & Cutover

### 4.1 Migration Strategies

```typescript
type MigrationStrategy = 
  | 'instant'           // Remove CL, Arrakis takes over immediately
  | 'gradual'           // Arrakis handles new members, CL handles existing
  | 'parallel_forever'  // Both systems coexist indefinitely
  | 'arrakis_primary';  // Arrakis is authoritative, CL optional backup

interface MigrationPlan {
  strategy: MigrationStrategy;
  
  // Prerequisites
  prerequisites: {
    minShadowDays: number;          // e.g., 14 days in shadow mode
    minAccuracyPercent: number;     // e.g., 95% agreement with incumbent
    adminApproval: boolean;
    memberNotification: boolean;
  };
  
  // For 'gradual' strategy
  gradual?: {
    startDate: Date;
    newMembersToArrakis: boolean;
    migrateExistingOver: number;    // Days
    requireReverification: boolean;
  };
  
  // Safety rails
  rollback: {
    enabled: boolean;
    autoTrigger: {
      enabled: boolean;
      conditions: [
        { metric: 'access_loss_percent', threshold: 5, window: '1h' },
        { metric: 'error_rate', threshold: 0.1, window: '15m' },
        { metric: 'admin_report', threshold: 1, window: 'any' },
      ];
    };
    notifyAdmin: boolean;
    preserveIncumbentRoles: boolean;  // Keep CL roles during rollback
  };
  
  // Post-migration incumbent handling
  incumbent: {
    action: 'remove' | 'keep_backup' | 'keep_disabled';
    removeRoles: boolean;
    archiveChannels: boolean;
  };
}
```

### 4.2 Admin Migration Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  MIGRATION CONTROL CENTER                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  READINESS CHECK                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ✓ Shadow mode active for 21 days (min: 14)               │    │
│  │  ✓ Accuracy vs Collab.Land: 96.2% (min: 95%)              │    │
│  │  ✓ 234 / 412 members verified with Arrakis (57%)          │    │
│  │  ✓ Zero divergence incidents in past 7 days               │    │
│  │                                                             │    │
│  │  Status: READY FOR MIGRATION                               │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  CHOOSE MIGRATION STRATEGY                                          │
│                                                                     │
│  ○ Instant Cutover                                                  │
│    Arrakis takes over immediately. Collab.Land removed.            │
│    ⚠️ Higher risk, but clean break.                                │
│                                                                     │
│  ● Gradual Migration (Recommended)                                  │
│    New members → Arrakis immediately                               │
│    Existing members → migrate over 14 days                         │
│    Collab.Land remains as backup                                   │
│                                                                     │
│  ○ Arrakis Primary                                                  │
│    Arrakis is source of truth                                      │
│    Collab.Land stays for emergency backup                          │
│                                                                     │
│  ○ Parallel Forever                                                 │
│    Both systems run indefinitely                                   │
│    Users choose which roles to use                                 │
│                                                                     │
│  SAFETY CONFIGURATION                                               │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ☑ Enable automatic rollback                               │    │
│  │    Trigger if: >5% lose access in 1 hour                  │    │
│  │                                                             │    │
│  │  ☑ Notify me before any automatic actions                  │    │
│  │                                                             │    │
│  │  ☑ Preserve Collab.Land roles during rollback              │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [Preview Migration]  [Schedule Migration]  [Start Now →]          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Role Takeover (Manual Process)

When admin is ready to remove namespacing and take over incumbent roles:

```typescript
interface RoleTakeover {
  // This is a MANUAL, explicit admin action
  trigger: 'admin_command';  // /arrakis takeover
  
  // Confirmation steps
  confirmation: {
    step1: 'Type community name to confirm';
    step2: 'Acknowledge incumbent will be replaced';
    step3: 'Confirm rollback plan understood';
  };
  
  // What happens
  actions: [
    // 1. Rename arrakis roles to take over
    {
      action: 'rename_role',
      from: 'arrakis-fedaykin',
      to: 'Fedaykin',  // Or admin-chosen name
    },
    
    // 2. Remove incumbent roles from members
    {
      action: 'remove_role',
      role: 'incumbent_holder',
      fromAll: true,
    },
    
    // 3. Optionally delete incumbent roles
    {
      action: 'delete_role',
      role: 'incumbent_holder',
      if: 'admin_approved',
    },
    
    // 4. Update channel permissions
    {
      action: 'update_channel_perms',
      channel: '#alpha-chat',
      removeRole: 'incumbent_holder',
      addRole: 'Fedaykin',
    },
  ];
  
  // Incentive: This action qualifies for pricing discount
  incentive: {
    type: 'pricing_discount';
    discountPercent: 20;
    duration: '1_year';
    message: "Thanks for going all-in with Arrakis! Enjoy 20% off your first year.";
  };
}
```

---

## Phase 5: Incumbent Failure Handling

### 5.1 Incumbent Health Monitoring

```typescript
interface IncumbentHealthMonitor {
  checks: [
    {
      name: 'role_update_freshness',
      description: 'Time since incumbent last updated any role',
      alertThreshold: '48h',
      criticalThreshold: '72h',
    },
    {
      name: 'balance_check_running',
      description: 'Is incumbent balance check functioning',
      method: 'detect_role_changes',
      alertThreshold: '72h',
    },
    {
      name: 'bot_online',
      description: 'Is incumbent bot online in guild',
      method: 'presence_check',
      alertThreshold: '1h',
    },
    {
      name: 'verification_channel_active',
      description: 'Is verification channel functional',
      method: 'channel_activity_check',
      alertThreshold: '168h',  // 1 week
    },
  ];
}

class IncumbentHealthCheck {
  async run(guildId: string): Promise<HealthReport> {
    const incumbent = await this.getIncumbentInfo(guildId);
    const issues: HealthIssue[] = [];
    
    // Check 1: Is the bot online?
    const botMember = await this.guild.members.fetch(incumbent.bot.id);
    if (!botMember || botMember.presence?.status === 'offline') {
      issues.push({
        severity: 'warning',
        issue: 'incumbent_bot_offline',
        message: `${incumbent.provider} bot appears to be offline`,
        detectedAt: new Date(),
      });
    }
    
    // Check 2: Have roles been updated recently?
    const lastRoleChange = await this.getLastIncumbentRoleChange(guildId);
    const hoursSinceChange = (Date.now() - lastRoleChange.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceChange > 72) {
      issues.push({
        severity: 'critical',
        issue: 'incumbent_stale',
        message: `${incumbent.provider} hasn't updated roles in ${Math.floor(hoursSinceChange)} hours`,
        detectedAt: new Date(),
      });
    } else if (hoursSinceChange > 48) {
      issues.push({
        severity: 'warning',
        issue: 'incumbent_slow',
        message: `${incumbent.provider} hasn't updated roles in ${Math.floor(hoursSinceChange)} hours`,
        detectedAt: new Date(),
      });
    }
    
    // Check 3: Are new verifications working?
    const recentVerifications = await this.getRecentIncumbentVerifications(guildId);
    if (recentVerifications.count === 0 && recentVerifications.expected > 0) {
      issues.push({
        severity: 'warning',
        issue: 'incumbent_verification_stalled',
        message: `No new ${incumbent.provider} verifications in 7 days`,
        detectedAt: new Date(),
      });
    }
    
    return { guildId, incumbent, issues, checkedAt: new Date() };
  }
}
```

### 5.2 Admin Alert System

```typescript
interface IncumbentFailureAlert {
  // Alert configuration (Q5: Option B)
  alertAdmin: {
    channels: ['dm', 'audit_channel'];
    throttle: '4h';  // Don't spam
  };
  
  // Offer to step in (Q5: Option C offered, not automatic)
  offerStepIn: {
    showOffer: true;
    autoActivate: false;  // Never auto-promote without consent
    buttonLabel: "Activate Arrakis as Backup";
    confirmationRequired: true;
  };
}
```

**Alert Message:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️ INCUMBENT HEALTH ALERT                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Arrakis detected potential issues with Collab.Land:                │
│                                                                     │
│  🔴 CRITICAL: No role updates in 73 hours                          │
│     Last update: 2024-12-27 14:32 UTC                              │
│     Expected: Every 24-48 hours                                    │
│                                                                     │
│  🟡 WARNING: Bot showing as offline                                 │
│     Last seen: 2024-12-30 02:15 UTC                                │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  What this means:                                                   │
│  • Members who sold tokens may still have access                   │
│  • New verifications may not be processing                         │
│  • Your community access control may be stale                      │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Arrakis is ready to step in if needed.                            │
│                                                                     │
│  Current Arrakis status:                                           │
│  • Shadow mode active ✓                                            │
│  • 234 members verified ✓                                          │
│  • Parallel roles ready ✓                                          │
│  • Last sync: 2 hours ago ✓                                        │
│                                                                     │
│  [Activate Arrakis as Backup]  [Dismiss Alert]  [Check CL Status]  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Emergency Backup Activation

```typescript
async function activateEmergencyBackup(guildId: string, adminId: string): Promise<void> {
  // Require explicit confirmation
  const confirmed = await requestConfirmation(adminId, {
    title: "Activate Arrakis as Emergency Backup",
    message: [
      "This will:",
      "• Activate Arrakis parallel roles immediately",
      "• Start assigning @arrakis-* roles to all verified members",
      "• NOT remove any Collab.Land roles",
      "• NOT remove the Collab.Land bot",
      "",
      "You can deactivate at any time.",
    ].join('\n'),
    confirmButton: "Activate Backup",
    cancelButton: "Cancel",
  });
  
  if (!confirmed) return;
  
  // Log this critical action
  await auditLog.record({
    guildId,
    action: 'emergency_backup_activated',
    actor: adminId,
    reason: 'incumbent_failure',
    metadata: await getIncumbentHealthReport(guildId),
  });
  
  // Transition from shadow to parallel mode
  await updateGuildConfig(guildId, {
    mode: 'parallel',
    activatedAt: new Date(),
    activatedBy: adminId,
    activationReason: 'emergency_incumbent_failure',
  });
  
  // Immediately sync all roles
  await parallelRoleSync.executeNow(guildId);
  
  // Notify admin of completion
  await notifyAdmin(adminId, {
    title: "✓ Arrakis Backup Activated",
    message: [
      "Arrakis is now managing parallel roles.",
      "",
      `Roles assigned: ${stats.rolesAssigned}`,
      `Members covered: ${stats.membersCovered}`,
      "",
      "Collab.Land roles are preserved. When CL recovers,",
      "you can decide whether to keep both or migrate fully.",
    ].join('\n'),
  });
}
```

---

## Configuration Schema

### Manifest Extension

```yaml
# arrakis-manifest.yaml - Coexistence configuration

coexistence:
  mode: shadow | parallel | primary | exclusive
  
  incumbent:
    detection: auto | manual
    provider: collabland | matrica | guild.xyz | other
    botId: "704521096837464076"  # If manual
    
  shadow:
    enabled: true
    syncInterval: 6h
    trackConviction: true
    trackDivergences: true
    
  parallel:
    roleNamespace: "arrakis"
    channelStrategy: additive_only | parallel_mirror | none
    additiveChannels:
      - name: conviction-lounge
        requirement:
          type: conviction
          min: 80
      - name: diamond-hands
        requirement:
          type: conviction
          min: 95
          
  verification:
    trustIncumbent: true           # Accept existing verification
    gateFullFeatures: true         # Require Arrakis verify for full access
    incentivize: true              # Show preview to encourage re-verify
    
  socialLayer:
    mode: glimpse | full | disabled
    glimpse:
      showLeaderboard: true
      showProfilesBlurred: true
      showBadgesLocked: true
      
  migration:
    readinessChecks:
      minShadowDays: 14
      minAccuracyPercent: 95
    rollback:
      enabled: true
      autoTriggerThreshold: 5%
      
  incumbentMonitoring:
    enabled: true
    alertThresholds:
      roleUpdateFreshness: 48h
      botOffline: 1h
    alertChannels:
      - admin_dm
      - audit_log
    offerBackupActivation: true
```

---

## Implementation Roadmap

### Sprint Allocation (Estimated)

| Sprint | Focus | Deliverables |
|--------|-------|--------------|
| 55 | Shadow Foundation | Incumbent detection, shadow ledger, basic sync |
| 56 | Shadow Analytics | Divergence tracking, prediction engine, admin dashboard |
| 57 | Parallel Roles | Namespaced role management, parallel role sync |
| 58 | Parallel Channels | Additive channel creation, conviction-gated access |
| 59 | Verification Tiers | Trust incumbent, tiered feature access, preview mode |
| 60 | Glimpse Mode | Blurred profiles, locked badges, upgrade CTAs |
| 61 | Migration Engine | Strategy selection, gradual migration, rollback system |
| 62 | Incumbent Monitoring | Health checks, alerting, backup activation |
| 63 | Full Social Layer | Post-migration profile unlock, badge system, directory |
| 64 | Polish & Incentives | Pricing integration, takeover incentives, docs |

---

## Open Questions

1. **Pricing Integration**: How do migration incentives tie into the SaaS pricing model? Discount codes? Free tier extension?

2. **Multi-Incumbent**: What if a community has BOTH Collab.Land and Matrica? Priority handling?

3. **Partial Migration**: Can a community migrate some roles to Arrakis while keeping others on incumbent?

4. **Cross-Guild Identity**: If a user verifies with Arrakis in Guild A, should that carry to Guild B (also using Arrakis)?

5. **Conviction Calculation**: Is conviction based on this community's tokens only, or global BGT/BERA holdings?

---

## Appendix A: Competitor Capability Matrix

| Feature | Collab.Land | Matrica | Guild.xyz | Arrakis |
|---------|-------------|---------|-----------|---------|
| Basic token gating | ✅ | ✅ | ✅ | ✅ |
| Multi-wallet support | ✅ | ✅ | ✅ | ✅ |
| Balance check refresh | 24-48h | ~24h | Varies | Configurable |
| Conviction scoring | ❌ | ❌ | ❌ | ✅ |
| Hold duration tracking | ❌ | ❌ | ❌ | ✅ |
| Tier progression | Limited | Limited | ❌ | ✅ |
| Profile system | ❌ | Basic | Basic | ✅ |
| Badge system | ❌ | ❌ | ✅ | ✅ |
| Telegram support | ✅ | ✅ | ❌ | Planned |
| Berachain native | ❌ | ❌ | ❌ | ✅ |
| BGT-specific logic | ❌ | ❌ | ❌ | ✅ |
| API for bulk export | Limited | ✅ | ❓ | ✅ |
| Webhook events | ❌ | ❓ | ✅ | Planned |

---

## Appendix B: Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Incumbent legal action | We never touch their roles; namespacing avoids conflict |
| User confusion (two systems) | Clear messaging, visual differentiation, glimpse mode |
| Admin abandons migration | Parallel mode works indefinitely; no pressure |
| Arrakis miscalculates eligibility | Shadow mode proves accuracy before any action |
| Rollback needed post-migration | Incumbent roles preserved, one-click restore |
| Incumbent recovers mid-backup | Admin decides; both can coexist |

---

*End of Architecture Specification*

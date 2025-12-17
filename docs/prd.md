# Product Requirements Document: Sietch

**Version**: 2.0
**Date**: December 18, 2025
**Status**: Draft

---

## 1. Executive Summary

### 1.1 Product Overview

**Sietch** is a privacy-first, token-gated Discord community for the top 69 BGT (Berachain Governance Token) holders who have never redeemed (burned) any of their BGT holdings.

Version 2.0 introduces a comprehensive **Social Layer** with pseudonymous member profiles, reputation badges, exclusive access perks, and a member directory - all built with a cypherpunk privacy-first mindset where wallet addresses and on-chain identities are never publicly linked to member identities.

### 1.2 Problem Statement

The Sietch MVP successfully established the token-gated community, but lacks:
1. **Member identity and expression** - No way for members to create personalized identities
2. **Recognition and engagement** - No system to reward participation and tenure
3. **Member discovery** - No way to browse or find other community members
4. **Progressive rewards** - No exclusive perks for engaged members

### 1.3 Vision

Sietch becomes a privacy-respecting digital sanctuary where top BGT holders can:
- Express themselves through pseudonymous identities (nyms) completely unlinked from their wallets
- Earn recognition through a reputation and badge system
- Discover and connect with other members without compromising privacy
- Unlock exclusive access and perks based on engagement, not just holdings

**Core Design Principle**: Every feature assumes a cypherpunk threat model - wallets are transparent on-chain, but within Sietch, members can be completely pseudonymous.

### 1.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Profile completion rate | >80% of members | Members with custom nym, PFP, and bio |
| Badge engagement | >50% earn 3+ badges | Members with multiple badges |
| Member retention | >85% at 30 days | Members who remain active and engaged |
| Feature adoption | >60% use directory | Members who browse member directory |
| Member satisfaction | NPS >50 | Periodic community surveys |

---

## 2. User & Stakeholder Context

### 2.1 Target Users

**Primary**: Top 69 BGT holders who have never redeemed any BGT

**User Personas**:

| Persona | Profile | Privacy Needs |
|---------|---------|---------------|
| **The Whale** | Large BGT holder, wants to engage but stay anonymous | Maximum privacy - doesn't want holdings associated with identity |
| **The Builder** | Active protocol participant, wants recognition | Wants to be known for contributions, not wallet size |
| **The Lurker** | Prefers to observe, occasional participation | Wants to browse without being tracked |
| **The Networker** | Wants to connect with specific members | Needs discovery features while respecting others' privacy |

### 2.2 Privacy Threat Model

Members should be protected from:
1. **Wallet-identity correlation** - No one should link a member's nym to their wallet address
2. **Holdings exposure** - Exact BGT balances should never be visible
3. **Rank identification** - Specific leaderboard position should be private
4. **Discord identity leak** - Server-specific identity should be independent of Discord username

**What IS allowed**:
- Tier visibility (Naib/Fedaykin) - this is public by role anyway
- Self-disclosed information
- Aggregate statistics (e.g., "member since Month Year")

---

## 3. Functional Requirements

### 3.1 Pseudonymous Identity System

#### 3.1.1 Nym (Server-Specific Name)

- **Unique identifier** within Sietch, completely unlinked to wallet or Discord username
- **Format**: 3-32 characters, alphanumeric + limited special chars
- **Uniqueness**: Enforced server-wide
- **Changeability**: Can be changed (with cooldown period to prevent confusion)

#### 3.1.2 Custom Profile Picture (PFP)

- **Upload option**: Members can upload custom images
- **Size limits**: Max 2MB, 256x256 minimum resolution
- **Generation option**: Random avatar generator for quick setup
- **Default**: Procedurally generated based on internal ID (not wallet)

#### 3.1.3 Bio/Tagline

- **Short bio**: Max 200 characters
- **Optional**: Not required for profile completion
- **Content**: Free text, no links (prevents doxing)

#### 3.1.4 Profile Data Model

```
Member Profile:
├── internal_id (UUID, never exposed)
├── nym (public within server)
├── pfp_url (public within server)
├── bio (public within server, optional)
├── created_at (private)
├── tier (Naib/Fedaykin - public)
├── badges[] (public)
├── tenure_category (e.g., "OG", "Veteran" - public)
├── [PRIVATE - never exposed]
│   ├── discord_user_id
│   ├── wallet_address
│   ├── exact_bgt_balance
│   └── exact_rank_position
```

### 3.2 DM-Based Onboarding Flow

New members receive a private DM wizard to set up their pseudonymous identity.

#### 3.2.1 Flow Steps

```
[Member gains access via Collab.Land]
            │
            ▼
[Bot DM: Welcome to Sietch!]
"You've verified your eligibility. Let's set up your
anonymous identity. Nothing you choose here will be
linked to your wallet."
            │
            ▼
[Step 1: Choose Your Nym]
"Pick a name you'll be known by in Sietch:"
[Text input or "Suggest Random" button]
            │
            ▼
[Step 2: Profile Picture]
"Choose your avatar:"
[Upload] [Generate Random] [Skip for now]
            │
            ▼
[Step 3: Bio (Optional)]
"Add a short bio (optional):"
[Text input] [Skip]
            │
            ▼
[Confirmation]
"Welcome, {nym}! Your identity is set.
You can change these anytime with /profile edit"
[View Profile] [Go to #general]
```

#### 3.2.2 Privacy Assurances

At each step, display privacy reassurances:
- "Your wallet address will never be shown publicly"
- "Your BGT balance is private"
- "Only you and admins can see your wallet connection"

### 3.3 Reputation & Badge System

#### 3.3.1 Badge Categories

| Category | Badge | Criteria | Icon Suggestion |
|----------|-------|----------|-----------------|
| **Tenure** | OG | Member in first 30 days of Sietch launch | Ancient spice harvester |
| **Tenure** | Veteran | 90+ days as member | Weathered stillsuit |
| **Tenure** | Elder | 180+ days as member | Naib staff |
| **Streak** | Consistent | Active 7 days in a row | Water drops |
| **Streak** | Dedicated | Active 30 days in a row | Full water pouch |
| **Streak** | Devoted | Active 90 days in a row | Maker hook |
| **Contribution** | Helper | Recognized by admins for helping others | Guiding hand |
| **Contribution** | Thought Leader | Consistent quality contributions | Third-stage guild navigator |
| **Special** | Founding Fedaykin | Original top 69 at launch | Golden crysknife |
| **Special** | Promoted | Rose from Fedaykin to Naib | Rising sun |

#### 3.3.2 Badge Award Mechanisms

- **Automatic**: Tenure and streak badges awarded by system
- **Admin-granted**: Helper and Thought Leader badges
- **Event-triggered**: Founding badges, promotion badges

#### 3.3.3 Badge Display

- Badges visible on member profiles
- Top 3 badges shown in member directory preview
- Full badge showcase on profile view

### 3.4 Member Directory

#### 3.4.1 Directory Features

- **Browse**: Paginated list of all members (by nym, never wallet)
- **Filter**: By tier, badges, tenure category
- **Search**: By nym only (no wallet search)
- **Sort**: By nym (alphabetical), tenure, badge count

#### 3.4.2 Directory Entry Display

```
┌────────────────────────────────────┐
│ [PFP] CryptoNomad                  │
│ ═══════════════════                │
│ Fedaykin · OG · Veteran            │
│ "Just here for the spice"          │
│                                    │
│ [View Profile]                     │
└────────────────────────────────────┘
```

#### 3.4.3 Privacy in Directory

- NO wallet address shown
- NO exact BGT balance
- NO exact rank position
- ONLY: Nym, PFP, tier, badges, bio snippet, tenure category

### 3.5 Exclusive Access & Perks

#### 3.5.1 Perk Tiers

| Perk Level | Unlock Criteria | Benefits |
|------------|-----------------|----------|
| **Base** | Verified member | Standard access |
| **Engaged** | 5+ badges OR 30+ day streak | Access to #deep-desert channel |
| **Trusted** | 10+ badges OR Helper badge | Access to exclusive events |
| **Inner Circle** | Admin-granted | Early access to features, special events |

#### 3.5.2 Private Channels (Earned Access)

- **#deep-desert**: Unlocked by engagement, for focused discussions
- **#stillsuit-lounge**: Unlocked by tenure (90+ days), chill space

#### 3.5.3 Special Events

- **AMAs**: Priority access for Trusted+ members
- **Calls**: Exclusive voice events for engaged members
- **Early Access**: New features shown to Inner Circle first

#### 3.5.4 Custom Perks

- **Custom color role**: Unlocked at 10+ badges
- **Custom emoji slots**: Unlocked at Trusted tier
- **Profile flair**: Special frames/borders based on achievements

### 3.6 Discord Bot Commands

#### 3.6.1 Slash Commands

| Command | Description | Privacy |
|---------|-------------|---------|
| `/profile` | View your own profile | Private response |
| `/profile view @nym` | View another member's profile | Public embed |
| `/profile edit` | Open profile editing wizard | DM-based |
| `/badges` | View your badges | Private response |
| `/badges @nym` | View another member's badges | Public embed |
| `/directory` | Open member directory browser | Interactive embed |
| `/stats` | View your engagement stats | Private response |
| `/leaderboard` | View engagement leaderboard (by nym) | Public embed |

#### 3.6.2 Button/Menu Interactions

- **Profile cards**: Expandable with buttons
- **Directory pagination**: Next/Previous buttons
- **Filter menus**: Dropdown selectors
- **Onboarding wizard**: Button-driven flow

---

## 4. Technical Requirements

### 4.1 Updated System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Berachain     │────▶│  Sietch Service │────▶│   Collab.Land   │
│   RPC Nodes     │     │   (Extended)    │     │  (Discord Bot)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               │ API + Discord.js
                               ▼
                        ┌─────────────────┐
                        │  Discord Server │
                        │    (Sietch)     │
                        └─────────────────┘
```

### 4.2 Database Schema Extensions

```sql
-- Member profiles (pseudonymous identity)
CREATE TABLE member_profiles (
    id TEXT PRIMARY KEY,  -- UUID
    discord_user_id TEXT NOT NULL UNIQUE,  -- FK to discord user (private)
    wallet_address TEXT NOT NULL,  -- (private, never exposed via API)
    nym TEXT NOT NULL UNIQUE,
    pfp_url TEXT,
    bio TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    nym_last_changed INTEGER,  -- cooldown tracking
    FOREIGN KEY (discord_user_id) REFERENCES eligibility(discord_user_id)
);

-- Badges
CREATE TABLE badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    category TEXT NOT NULL,  -- tenure, streak, contribution, special
    is_automatic INTEGER DEFAULT 0
);

-- Member badges (many-to-many)
CREATE TABLE member_badges (
    member_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    awarded_at INTEGER NOT NULL,
    awarded_by TEXT,  -- null for automatic, admin id for manual
    PRIMARY KEY (member_id, badge_id),
    FOREIGN KEY (member_id) REFERENCES member_profiles(id),
    FOREIGN KEY (badge_id) REFERENCES badges(id)
);

-- Engagement tracking (for streaks and stats)
CREATE TABLE member_activity (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    activity_date TEXT NOT NULL,  -- YYYY-MM-DD
    message_count INTEGER DEFAULT 0,
    reaction_count INTEGER DEFAULT 0,
    UNIQUE(member_id, activity_date),
    FOREIGN KEY (member_id) REFERENCES member_profiles(id)
);

-- Perk unlocks
CREATE TABLE member_perks (
    member_id TEXT NOT NULL,
    perk_level TEXT NOT NULL,  -- base, engaged, trusted, inner_circle
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (member_id, perk_level),
    FOREIGN KEY (member_id) REFERENCES member_profiles(id)
);
```

### 4.3 API Endpoints (Extended)

```
# Profile endpoints (authenticated, user sees own data)
GET  /api/profile          → Own profile with all private data
PUT  /api/profile          → Update own profile
POST /api/profile/pfp      → Upload profile picture

# Public profile view (privacy-filtered)
GET  /api/members/:nym     → Public profile (no wallet, no balance)

# Directory
GET  /api/directory        → Paginated member list (privacy-filtered)
     ?tier=naib|fedaykin
     ?badge=badge_id
     ?tenure=og|veteran|elder
     ?page=1&limit=20

# Badges
GET  /api/badges           → All available badges
GET  /api/members/:nym/badges → Member's badges

# Stats (own only)
GET  /api/stats            → Own engagement statistics

# Admin endpoints
POST /api/admin/badges/award → Award badge to member
```

### 4.4 Privacy Implementation Requirements

#### 4.4.1 Data Separation

- **Private Store**: wallet_address, discord_user_id, exact_bgt_balance, exact_rank
- **Public Store**: nym, pfp, bio, tier, badges, tenure_category
- **Never join these in public API responses**

#### 4.4.2 Logging Requirements

- **DO log**: nym-based actions, badge awards, profile updates
- **DO NOT log**: wallet addresses in any user-visible logs
- **Admin logs**: May include correlation for debugging, encrypted at rest

#### 4.4.3 Discord Message Privacy

- Bot NEVER mentions wallet addresses in server channels
- Bot NEVER shows exact BGT amounts publicly
- Bot NEVER correlates nym to Discord username publicly

### 4.5 Non-Functional Requirements

| Requirement | Specification |
|-------------|---------------|
| Availability | 99.5% uptime for API and bot |
| Latency | API response < 200ms, bot response < 1s |
| Storage | PFP images stored with CDN, max 2MB each |
| Privacy | Zero wallet-identity correlation in public APIs |
| Auditability | All badge awards logged with timestamps |

---

## 5. Scope

### 5.1 In Scope (v2.0)

- [x] Pseudonymous identity system (nym, PFP, bio)
- [x] DM-based onboarding wizard
- [x] Badge and reputation system (10+ badge types)
- [x] Member directory with filters
- [x] Exclusive access tiers and perks
- [x] Private channels for engaged members
- [x] Slash commands and button interactions
- [x] Engagement tracking for streaks
- [x] Activity leaderboard (by nym, privacy-preserving)

### 5.2 Out of Scope (Future)

- Web dashboard / app (designed for future expansion)
- NFT badge representations
- Token rewards or airdrops
- Cross-server identity portability
- On-chain badge proofs
- Governance voting through profiles

### 5.3 Migration from v1.0

- Existing members auto-enrolled in new system
- Prompted to complete profile setup on first interaction
- Eligibility system unchanged
- Existing channels and structure preserved

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Privacy leak (wallet-nym correlation) | Medium | Critical | Strict data separation, security audit, encrypted logs |
| Complexity overwhelming users | Medium | High | Gradual feature introduction, clear onboarding |
| Low adoption of profiles | Medium | Medium | Make profile setup part of access flow, showcase benefits |
| Badge gaming/farming | Low | Medium | Manual badges for high-value recognition, anti-gaming cooldowns |
| Storage costs (PFPs) | Low | Low | Image size limits, CDN caching, cleanup of inactive profiles |
| Bot performance under load | Low | Medium | Rate limiting, efficient queries, caching |

---

## 7. Dependencies

### 7.1 New Dependencies

| Service | Purpose | Notes |
|---------|---------|-------|
| Image hosting (CDN) | PFP storage | Could use Discord CDN or external |
| Discord.js v14+ | Slash commands, buttons, modals | Already in use |

### 7.2 Existing Dependencies (Unchanged)

- Berachain RPC nodes
- Collab.Land
- Discord
- SQLite database
- VPS hosting

---

## 8. Updated Server Structure

```
SIETCH
├── 📜 STILLSUIT (Info Category)
│   ├── #water-discipline ── Welcome, rules, Chatham House reminder
│   ├── #census ──────────── Live leaderboard (by nym, not wallet)
│   └── #the-door ────────── Member joins/departures (nym only)
│
├── 🔥 NAIB COUNCIL (Top 7 Only)
│   └── #council-rock ────── Private Naib discussion
│
├── 💬 SIETCH-COMMONS (All Members)
│   ├── #general ─────────── Main discussion
│   ├── #spice ───────────── Market insights, alpha
│   ├── #water-shares ────── Ideas and proposals
│   └── #introductions ───── NEW: Members introduce their nyms
│
├── 🏜️ DEEP DESERT (Engaged Members - 5+ badges OR 30-day streak)
│   └── #deep-desert ─────── Focused discussions for engaged members
│
├── 🧘 STILLSUIT LOUNGE (Veterans - 90+ days tenure)
│   └── #stillsuit-lounge ── Chill space for long-term members
│
└── 🛠️ WINDTRAP (Operations)
    ├── #support ─────────── Technical help
    └── #bot-commands ────── Bot interaction channel
```

---

## 9. Appendix

### 9.1 Badge Icon Concepts (Dune-Themed)

| Badge | Visual Concept |
|-------|---------------|
| OG | Ancient crysknife with patina |
| Veteran | Worn stillsuit with repairs |
| Elder | Naib ceremonial staff |
| Consistent | Three water drops |
| Dedicated | Full water pouch with seal |
| Devoted | Golden maker hook |
| Helper | Open hand with water offering |
| Thought Leader | Guild navigator eyes (blue-in-blue) |
| Founding Fedaykin | Golden crysknife on black |
| Promoted | Sun rising over sand dune |

### 9.2 Privacy Decision Matrix

| Data Point | Public | Members Only | Admin Only | Never Exposed |
|------------|--------|--------------|------------|---------------|
| Nym | ✓ | | | |
| PFP | ✓ | | | |
| Bio | ✓ | | | |
| Tier (Naib/Fedaykin) | ✓ | | | |
| Badges | ✓ | | | |
| Tenure category | ✓ | | | |
| Engagement stats | | Self only | | |
| Discord username | | | ✓ | |
| Wallet address | | | ✓ | |
| Exact BGT balance | | | | ✓ |
| Exact rank position | | | | ✓ |

### 9.3 Onboarding Message Templates

**Welcome DM**:
```
🏜️ Welcome to Sietch, traveler.

You've proven yourself worthy by your BGT holdings.
But here, your wallet doesn't define you.

In Sietch, you choose who you want to be. Your wallet
address will NEVER be shown to other members. Your
balance is private. Your rank is private.

Let's create your anonymous identity...

[Begin Setup]
```

**Profile Complete**:
```
✨ Your identity is ready, {nym}.

You are now part of the Sietch. No one knows your wallet.
No one knows your balance. You are simply {nym}.

Explore:
• /directory - Browse other members
• /badges - See available badges
• /profile - View or edit your profile

The spice must flow.

[Enter Sietch]
```

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-17 | Initial MVP - token gating, eligibility, basic server |
| 2.0 | 2025-12-18 | Social Layer - profiles, badges, directory, perks |

---

*Document generated by PRD Architect*

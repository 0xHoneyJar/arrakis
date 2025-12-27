# Sietch

[![Version](https://img.shields.io/badge/version-4.1.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](LICENSE.md)

A privacy-first, token-gated community for the top 69 BGT (Berachain Governance Token) holders who have never redeemed any of their BGT holdings.

**Version 4.1 "The Crossing"** - Multi-platform expansion with Telegram bot integration.

## Overview

Sietch provides a dedicated space for a specific, highly curated subset of the Berachain community—high-conviction participants demonstrated through on-chain actions over time. Eligibility is determined entirely on-chain: only wallets that have claimed BGT from reward vaults and never burned (redeemed) any BGT qualify.

### What's New in v4.1

- **Telegram Bot** - Full-featured bot with 8 commands mirroring Discord functionality
- **Inline Queries** - Quick stats lookup via `@SietchBot score` in any chat
- **Alert Preferences** - Configurable notification settings per platform
- **Cross-Platform Identity** - Link same wallet to Discord and Telegram

### Previous Features (v4.0)

- **Stripe Billing** - SaaS foundation with subscription management
- **Payment Webhooks** - Secure payment event handling

### v3.0 Features

- **9-Tier Progression** - From Traveler to Naib based on BGT holdings and rank
- **Personal Stats** - Track your tier progress, BGT history, and time in tiers
- **Weekly Digest** - Automated Monday community updates
- **Story Fragments** - Dune-themed narrative posts for elite promotions
- **Water Sharer Badge** - Shareable badge system with lineage tracking
- **Notification System** - Tier promotion DMs, badge awards, at-risk alerts

### v2.0 Features

- **Pseudonymous Profiles** - Create a unique identity (nym) completely unlinked to your wallet
- **Badge System** - Earn badges for tenure, activity, and achievements
- **Member Directory** - Browse and discover other members with privacy-respecting filters
- **Activity Tracking** - Demurrage-based system that rewards consistent engagement
- **DM Onboarding** - Private wizard to set up your identity before accessing channels

## How It Works

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│   Berachain     │────▶│          Sietch Service             │
│   RPC Nodes     │     │  ┌─────────────┐  ┌─────────────┐   │
└─────────────────┘     │  │  Chain Svc  │  │  Profile    │   │
                        │  │  (viem)     │  │  Service    │   │
                        │  └─────────────┘  └─────────────┘   │
                        │  ┌─────────────┐  ┌─────────────┐   │
                        │  │  Badge Svc  │  │  Identity   │   │
                        │  │  (10 types) │  │  Service    │   │
                        │  └─────────────┘  └─────────────┘   │
                        └──────────┬──────────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
┌─────────────┐             ┌─────────────┐             ┌─────────────┐
│ Discord Bot │             │ Telegram Bot│             │  REST API   │
│ (discord.js)│             │  (grammy)   │             │ (Collab.Land│
└──────┬──────┘             └──────┬──────┘             │  + Public)  │
       │                           │                    └─────────────┘
       ▼                           ▼
┌─────────────┐             ┌─────────────┐
│   Discord   │             │  Telegram   │
│   Server    │             │   Users     │
└─────────────┘             └─────────────┘
```

1. **Berachain RPC** - Direct on-chain queries for BGT balances via viem
2. **Sietch Service** - Manages eligibility, profiles, badges, and identity
3. **Discord Bot** - Handles onboarding, slash commands, and notifications
4. **Telegram Bot** - Mirrors Discord functionality with inline queries
5. **REST API** - Collab.Land integration for token gating
6. **Identity Service** - Cross-platform wallet linking (Discord + Telegram)

## Eligibility Criteria

To be eligible, a wallet must:

1. Have claimed BGT from Berachain reward vaults
2. Never have burned (transferred to 0x0) any BGT
3. Rank in the top 69 by total BGT held

## Tier System

Sietch uses a 9-tier progression system based on BGT holdings and rank:

| Tier | Requirement | Role Color |
|------|-------------|------------|
| **Naib** | Rank 1-7 | Gold |
| **Fedaykin** | Rank 8-21 | Purple |
| **Usul** | 1111+ BGT | Blue |
| **Reverend Mother** | 420+ BGT | Teal |
| **Sandrider** | 111+ BGT | Orange |
| **Sayyadina** | 69+ BGT | Pink |
| **Fremen** | 21+ BGT | Green |
| **Acolyte** | 1+ BGT | Gray |
| **Traveler** | 0 BGT | Default |

Tier roles update automatically as rankings change. Members who fall out of the top 69 or redeem any BGT lose access immediately.

### Achievement Roles (Badge-Based)

| Role | Criteria |
|------|----------|
| **OG** | Joined within first 30 days |
| **Diamond Hands** | 6+ months tenure |
| **Usul Ascended** | Reached Usul tier (1111+ BGT) |

Achievement roles are earned through badges and cannot be lost.

## Badge System

Members can earn 10 different badges across three categories:

### Tenure Badges
| Badge | Criteria |
|-------|----------|
| First Wave | Joined in first 30 days |
| Veteran | 3+ months membership |
| Diamond Hands | 6+ months membership |

### Achievement Badges
| Badge | Criteria |
|-------|----------|
| Council | Reached Naib tier |
| Survivor | Survived a demotion and returned |
| Streak Master | 30-day activity streak |

### Activity Badges
| Badge | Criteria |
|-------|----------|
| Engaged | Activity score > 100 |
| Contributor | Activity score > 500 |
| Pillar | Activity score > 1000 |

Activity uses a demurrage model—scores decay by 10% every 6 hours, rewarding consistent engagement over one-time bursts.

## Discord Structure

```
SIETCH
├── STILLSUIT (Info)
│   ├── #water-discipline ── Rules, Chatham House reminder
│   ├── #census ──────────── Live top 69 leaderboard
│   └── #the-door ────────── Join/departure log
│
├── NAIB COUNCIL (Top 7 Only)
│   └── #council-rock ────── Private council discussion
│
├── SIETCH-COMMONS (All Members)
│   ├── #general ─────────── Main discussion
│   ├── #spice ───────────── Market insights, alpha
│   └── #water-shares ────── Capital allocation ideas
│
└── WINDTRAP (Operations)
    └── #support ─────────── Verification help
```

## Chatham House Rules

All discussions operate under Chatham House Rules:
- Use information freely
- Never reveal speaker identity or affiliation
- No attribution of statements

## Bot Commands

### Discord Commands

| Command | Description |
|---------|-------------|
| `/onboard` | Start onboarding flow |
| `/profile` | View your member profile |
| `/stats` | View personal stats with tier progress |
| `/leaderboard` | Top badge holders or tier progression |
| `/water-share` | Share or check Water Sharer badge |
| `/admin-stats` | Admin analytics dashboard |

### Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and quick actions |
| `/verify` | Link wallet via signature verification |
| `/score` | View conviction score with tier and rank |
| `/badges` | View earned badges |
| `/stats` | Community statistics |
| `/leaderboard` | Top 10 members by badges |
| `/alerts` | Configure notification preferences |
| `/help` | Command reference |

### Telegram Inline Queries

Type `@SietchBot` followed by:
- `score` - Your conviction score
- `rank` - Your current rank
- `leaderboard` - Top 5 members
- `help` - Usage instructions

## API

### Public Endpoints

```
GET /health
{ "status": "healthy", "version": "4.1.0" }

GET /api/v1/eligibility
[{ "address": "0x...", "bgtHeld": "1234567890", "rank": 42, "role": "fedaykin" }]

GET /api/v1/eligibility/:wallet
{ "eligible": true, "tier": "fedaykin", "rank": 42, "bgtHeld": "1234567890" }
```

### Stats & Analytics (Authenticated)

```
GET /me/stats
{ "tier": "fedaykin", "bgt": 1234.56, "rank": 42, "daysInTier": 30, "tierProgress": 0.75 }

GET /me/tier-progress
{ "currentTier": "fedaykin", "nextTier": "usul", "bgtNeeded": 500, "progress": 0.68 }

GET /stats/tiers
{ "naib": 7, "fedaykin": 14, "usul": 20, "reverend_mother": 15, ... }

GET /stats/community
{ "totalMembers": 69, "totalBadges": 234, "avgTenure": 45, "weeklyActive": 52 }

GET /admin/analytics
{ "memberStats": {...}, "tierDistribution": {...}, "badgeStats": {...}, "activityTrends": {...} }
```

### Admin Endpoints (API Key Required)

```
POST /admin/sync                    # Trigger eligibility sync
POST /admin/badges/check            # Run badge evaluation
GET  /admin/water-share/lineage     # Badge sharing tree
POST /admin/water-share/revoke/:id  # Revoke member's grants
```

## Technical Details

- **Stack**: Node.js 20, TypeScript, Express, Discord.js v14, Grammy, SQLite, viem
- **Discord Bot**: discord.js v14 with slash commands
- **Telegram Bot**: Grammy framework with webhooks
- **Refresh Cadence**: Eligibility sync every 6 hours via trigger.dev
- **Weekly Digest**: Monday 9:00 UTC via trigger.dev cron
- **Activity Decay**: 10% decay every 6 hours (demurrage model)
- **Badge Checks**: Daily evaluation at midnight UTC
- **Grace Period**: 24 hours during RPC outages (no revocations)
- **Wallet Verification**: Collab.Land (Discord), signature verification (Telegram)
- **Privacy**: Rounded BGT values, ephemeral responses for sensitive data
- **Tests**: Unit + integration test suites (100+ tests)

## Naming Reference

Names from Frank Herbert's *Dune*:

| Term | Meaning | Usage |
|------|---------|-------|
| **Sietch** | Hidden desert community | Server name |
| **Naib** | Leader of a sietch | Top 7 council tier |
| **Fedaykin** | Elite death commandos | Rank 8-21 tier |
| **Usul** | Fremen name for Paul | 1111+ BGT tier |
| **Reverend Mother** | Bene Gesserit adept | 420+ BGT tier |
| **Sandrider** | One who rides sandworms | 111+ BGT tier |
| **Sayyadina** | Fremen priestess | 69+ BGT tier |
| **Fremen** | Desert people | 21+ BGT tier |
| **Stillsuit** | Water-preserving gear | Info category |
| **Spice** | Most valuable substance | Alpha channel |

## Documentation

| Document | Description |
|----------|-------------|
| [sietch-service/README.md](sietch-service/README.md) | Service setup & development |
| [loa-grimoire/prd.md](loa-grimoire/prd.md) | Product Requirements Document |
| [loa-grimoire/sdd.md](loa-grimoire/sdd.md) | Software Design Document |
| [loa-grimoire/sprint.md](loa-grimoire/sprint.md) | Sprint Plan (33 sprints complete) |
| [sietch-service/docs/deployment/](sietch-service/docs/deployment/) | Deployment guides & runbooks |

## Built With

This project was built using [Loa](https://github.com/0xHoneyJar/loa), an agent-driven development framework for orchestrating product development lifecycle.

## License

AGPL-3.0 - See [LICENSE.md](LICENSE.md) for details.

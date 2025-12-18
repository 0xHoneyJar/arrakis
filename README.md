# Sietch

A privacy-first, token-gated Discord community for the top 69 BGT (Berachain Governance Token) holders who have never redeemed any of their BGT holdings.

**Version 2.0** - Now with Social Layer: pseudonymous profiles, reputation badges, member directory, and more.

## Overview

Sietch provides a dedicated space for a specific, highly curated subset of the Berachain community—high-conviction participants demonstrated through on-chain actions over time. Eligibility is determined entirely on-chain: only wallets that have claimed BGT from reward vaults and never burned (redeemed) any BGT qualify.

### What's New in v2.0

- **Pseudonymous Profiles** - Create a unique identity (nym) completely unlinked to your wallet
- **Badge System** - Earn 10 different badges for tenure, activity, and achievements
- **Member Directory** - Browse and discover other members with privacy-respecting filters
- **Activity Tracking** - Demurrage-based system that rewards consistent engagement
- **DM Onboarding** - Private wizard to set up your identity before accessing channels
- **Dynamic Roles** - Earn exclusive roles based on badges and tenure, not just holdings

## How It Works

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│   Berachain     │────▶│          Sietch Service             │
│   RPC Nodes     │     │  ┌─────────────┐  ┌─────────────┐   │
└─────────────────┘     │  │  Chain Svc  │  │  Profile    │   │
                        │  │  (viem)     │  │  Service    │   │
                        │  └─────────────┘  └─────────────┘   │
                        │  ┌─────────────┐  ┌─────────────┐   │
                        │  │  Badge Svc  │  │  Activity   │   │
                        │  │  (10 types) │  │  Service    │   │
                        │  └─────────────┘  └─────────────┘   │
                        └──────────┬──────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
       │ Discord Bot │      │  REST API   │      │ trigger.dev │
       │ (discord.js)│      │ (Collab.Land│      │ (Scheduled) │
       └──────┬──────┘      │  + Public)  │      └─────────────┘
              │             └─────────────┘
              ▼
       ┌─────────────┐
       │   Discord   │
       │   Server    │
       └─────────────┘
```

1. **Berachain RPC** - Direct on-chain queries for BGT balances via viem
2. **Sietch Service** - Manages eligibility, profiles, badges, and activity
3. **Discord Bot** - Handles onboarding, slash commands, and notifications
4. **REST API** - Collab.Land integration for token gating
5. **trigger.dev** - Scheduled tasks (eligibility sync, activity decay, badge checks)

## Eligibility Criteria

To be eligible, a wallet must:

1. Have claimed BGT from Berachain reward vaults
2. Never have burned (transferred to 0x0) any BGT
3. Rank in the top 69 by total BGT held

## Roles

### Tier Roles (Token-Gated)

| Role | Criteria | Access |
|------|----------|--------|
| **Naib** | Top 7 by BGT held | Council channel + all public channels |
| **Fedaykin** | Top 8-69 by BGT held | All public channels |

### Achievement Roles (Badge-Based)

| Role | Criteria |
|------|----------|
| **OG** | Joined within first 30 days |
| **Diamond Hands** | 6+ months tenure |
| **Engaged** | High activity score |

Tier roles update automatically as rankings change. Members who fall out of the top 69 or redeem any BGT lose access immediately. Achievement roles are earned through badges and cannot be lost.

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

## API

### Public Endpoints

```
GET /health
{ "status": "healthy", "version": "2.0.0" }

GET /eligibility/:address
{ "eligible": true, "tier": "fedaykin", "rank": 42 }
```

### Directory & Profiles (Authenticated)

```
GET /api/directory?tier=naib&badge=diamond_hands&page=1
{
  "members": [
    { "nym": "SandRider", "tier": "naib", "badges": ["first_wave", "council"], "tenure": "OG" }
  ],
  "total": 69, "page": 1
}

GET /api/profile/:discordId
{ "nym": "SandRider", "bio": "...", "badges": [...], "activityScore": 450 }

PUT /api/profile
{ "nym": "NewNym", "bio": "Updated bio" }
```

### Admin Endpoints (API Key Required)

```
POST /admin/sync              # Trigger eligibility sync
POST /admin/badges/check      # Run badge evaluation
POST /admin/activity/decay    # Apply activity decay
```

## Technical Details

- **Stack**: Node.js 20, TypeScript, Express, Discord.js v14, SQLite, viem
- **Refresh Cadence**: Eligibility sync every 6 hours via trigger.dev
- **Activity Decay**: 10% decay every 6 hours (demurrage model)
- **Badge Checks**: Daily evaluation at midnight UTC
- **Grace Period**: 24 hours during RPC outages (no revocations)
- **Wallet Verification**: Collab.Land signature flow
- **Hosting**: OVH VPS with PM2, nginx, Let's Encrypt SSL
- **Tests**: 141 passing (unit + integration)

## Naming Reference

Names from Frank Herbert's *Dune*:

| Term | Meaning | Usage |
|------|---------|-------|
| **Sietch** | Hidden desert community | Server name |
| **Naib** | Leader of a sietch | Top 7 council role |
| **Fedaykin** | Elite death commandos | Top 69 member role |
| **Stillsuit** | Water-preserving gear | Info category |
| **Spice** | Most valuable substance | Alpha channel |

## Documentation

- **[docs/prd.md](docs/prd.md)** - Product Requirements Document
- **[docs/sdd.md](docs/sdd.md)** - Software Design Document
- **[docs/sprint.md](docs/sprint.md)** - Sprint Plan (all 10 sprints complete)
- **[docs/deployment/](docs/deployment/)** - Deployment guides and runbooks

## Built With

This project was built using [agentic-base](https://github.com/0xHoneyJar/agentic-base), an agent-driven development framework for orchestrating product development lifecycle.

## License

MIT

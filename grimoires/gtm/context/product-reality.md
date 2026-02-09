# Product Reality

**Source:** SDD v5.2 "The Transformation"
**Extracted:** 2026-01-03

---

> **Purpose:** This document grounds all GTM claims in technical reality.
> All positioning, messaging, and marketing materials MUST align with these capabilities.
> Do not claim features that aren't marked as "Production" status.

---

## Technical Architecture

### System Overview

Arrakis v5.0 is a **multi-tenant, chain-agnostic SaaS platform** for token-gated community management.

**Architecture Pattern:** Hexagonal Architecture (Ports and Adapters) + Event-Driven Synthesis

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARRAKIS PLATFORM v5.0                         │
├─────────────────────────────────────────────────────────────────┤
│  DOMAIN LAYER                                                    │
│  Asset | Community | Role | Eligibility                         │
├─────────────────────────────────────────────────────────────────┤
│  SERVICE LAYER                                                   │
│  WizardEngine | SyncService | ThemeEngine | TierEval            │
├─────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER                                            │
│  TwoTierChainProvider | DiscordAdapter | DrizzleStorage         │
│  Redis (Sessions) | BullMQ (Queue) | Vault (Signing)            │
└─────────────────────────────────────────────────────────────────┘
```

### Software Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20.x LTS |
| Language | TypeScript | 5.x |
| Framework | Hono | 4.x |
| ORM | Drizzle | 0.30.x |
| Queue | BullMQ | 5.x |
| Discord | discord.js | 14.x |
| Blockchain | viem | Latest |

### Infrastructure

| Service | Technology |
|---------|------------|
| Cloud | AWS (EKS) |
| Database | PostgreSQL 15 (RDS) |
| Cache/Sessions | Redis 7 (ElastiCache) |
| Object Storage | S3 |
| Secrets | HCP Vault |
| Monitoring | Datadog |

---

## Current Capabilities

### Token-Gating (Production)

**Two-Tier Chain Provider:**

| Tier | Purpose | Availability |
|------|---------|--------------|
| **Tier 1: Native Reader** | Binary checks (hasBalance, ownsNFT) | Always available (direct RPC) |
| **Tier 2: Score Service** | Complex queries (rank, activity, history) | Circuit breaker with fallback |

**Degradation Matrix:**

| Query Type | Score DOWN | Fallback Behavior |
|------------|------------|-------------------|
| Token Balance | Works | Native Reader |
| NFT Ownership | Works | Native Reader |
| Rank Threshold | Degraded | Balance check (permissive) |
| Activity Score | Unavailable | Return 0 or cached |

**GTM Claim Validation:**
- CAN claim: "Token-gating that never goes down"
- CAN claim: "Multi-chain support via Score Service"
- CANNOT claim: 100% feature parity when Score Service is down

### Theme System (Production)

**Available Themes:**

| Theme | Tiers | Badges | Pricing |
|-------|-------|--------|---------|
| BasicTheme | 3 (Gold/Silver/Bronze) | 5 | Free |
| SietchTheme | 9 (Naib→Outsider) | 10+ | Premium |
| Custom | Unlimited | Unlimited | Enterprise |

**SietchTheme Tiers (Premium):**

| Tier | Rank Range | Role Color |
|------|------------|------------|
| Naib | 1-7 | #FFD700 (Gold) |
| Fedaykin Elite | 8-15 | #E6BE8A |
| Fedaykin | 16-30 | #C4A35A |
| Fremen | 31-45 | #A67C52 |
| Wanderer | 46-55 | #8B7355 |
| Initiate | 56-62 | #6B5344 |
| Aspirant | 63-66 | #5D4E37 |
| Observer | 67-69 | #4A3728 |
| Outsider | 70+ | #333333 |

**GTM Claim Validation:**
- CAN claim: "9-tier progression system"
- CAN claim: "Gamification beyond simple token-gating"
- CANNOT claim: Custom themes (Enterprise tier required)

### Badge System (Production)

**Badge Categories:**
- Tenure: First Wave, Veteran, Diamond Hands
- Achievement: Council (Naib reached)
- Activity: Streak Master, Engaged
- Special: Water Sharer (lineage badges)

**Badge Count:** 10+ types with lineage tracking

**GTM Claim Validation:**
- CAN claim: "10+ badge types"
- CAN claim: "Badge lineage (members can award badges)"
- CAN claim: "Achievement-based gamification"

### Self-Service Wizard (Production)

**8-Step Flow:**
1. INIT - Welcome, community name
2. CHAIN_SELECT - Select blockchain(s)
3. ASSET_CONFIG - Enter contract address
4. ELIGIBILITY_RULES - Configure thresholds
5. ROLE_MAPPING - Define tier roles
6. CHANNEL_STRUCTURE - Select template
7. REVIEW - Preview manifest
8. DEPLOY - Execute synthesis

**Technical Constraints:**
- Sessions stored in Redis (15-min TTL)
- Must respond within Discord's 3-second limit
- `/resume {session_id}` recovers interrupted sessions

**GTM Claim Validation:**
- CAN claim: "Set up in 15 minutes"
- CAN claim: "No code required"
- CAN claim: "Resume if interrupted"
- CANNOT claim: "Instant setup" (deployment takes up to 5 minutes)

### Multi-Tenant Isolation (Production)

**Row-Level Security:**
- All tables have `community_id` column
- RLS policies enforce tenant isolation
- Cross-tenant access returns empty results

**GTM Claim Validation:**
- CAN claim: "Enterprise-grade security"
- CAN claim: "Complete data isolation"
- CAN claim: "Multi-tenant by design"

---

## In-Progress Capabilities

### Coexistence Mode (Sprints 56-65)

**Status:** In active development

**Operating Modes:**

| Mode | Description | Status |
|------|-------------|--------|
| Shadow | Observe only, prove accuracy | Sprint 56-57 |
| Parallel | Namespaced roles coexist | Sprint 58-59 |
| Primary | Arrakis authoritative | Sprint 62 |
| Exclusive | Takes over incumbent roles | Sprint 63 |

**GTM Claim Validation:**
- CAN claim: "Low-risk adoption path" (after Sprint 57)
- CAN claim: "Shadow mode proves accuracy before commitment"
- CANNOT yet claim: Full coexistence features (in progress)

### Hardening Requirements (P0)

**Critical items before production:**
- [ ] Audit log persistence (PostgreSQL, not in-memory)
- [ ] RLS penetration testing validation
- [ ] API key rotation mechanism

**GTM Implication:** Some enterprise claims require hardening completion.

---

## Integrations

| Service | Purpose | Type | Status |
|---------|---------|------|--------|
| Score Service | On-chain data | REST API | Production |
| Discord | Community platform | Gateway + REST | Production |
| Telegram | Alternative platform | REST | Production |
| Stripe | Billing | REST | Production |
| HCP Vault | Cryptography | REST | Production |

**External Dependencies:**
- Score Service (closed-source, THJ-owned)
- Discord API rate limits (global 50 req/sec bucket)

---

## Limitations

### Technical Limitations

1. **Score Service Dependency:** Advanced features require Score Service
2. **Discord Rate Limits:** Global token bucket limits synthesis speed
3. **3-Second Modal Limit:** Discord modals must respond within 3 seconds
4. **Synthesis Time:** Full community setup takes up to 5 minutes

### Feature Limitations

1. **No Web Dashboard:** Admin via Discord commands only (Phase 7+)
2. **No Mobile App:** Out of scope for v5.0
3. **No Fiat Payments:** Crypto-only for subscriptions
4. **No White-Label:** Custom branding is Enterprise-only

---

## Performance

### Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Basic eligibility check | <100ms | Native Reader |
| Advanced eligibility check | <500ms | Score Service |
| Wizard step response | <3s | Discord limit |
| Synthesis completion | <5 min | Full community |
| Uptime | 99.9% | SLA target |

### Scalability

| Metric | Target |
|--------|--------|
| Concurrent tenants | 1,000+ |
| Communities per tenant | 100 |
| Members per community | 100,000 |
| Synthesis throughput | 10 ops/sec |

---

## Marketing Claim Reference

### Safe Claims (Grounded)

| Claim | Grounding |
|-------|-----------|
| "Token-gating that never goes down" | Two-tier provider with native fallback |
| "9-tier progression system" | SietchTheme (Premium) |
| "10+ badge types" | Badge system (Production) |
| "Set up in 15 minutes" | WizardEngine (Production) |
| "No code required" | Discord modal flow |
| "Enterprise-grade security" | PostgreSQL RLS |
| "Multi-chain support" | Score Service API |
| "Top Dune Analytics team" | Team credential |

### Claims Requiring Qualification

| Claim | Qualification |
|-------|---------------|
| "Replace Collab.Land" | After coexistence mode complete |
| "Custom themes" | Enterprise tier only |
| "Web dashboard" | Phase 7+ (future) |
| "Instant setup" | Up to 5 minutes for synthesis |

### Claims to Avoid

| Claim | Reason |
|-------|--------|
| "100% uptime" | Target is 99.9% |
| "Real-time updates" | 6-hour reconciliation cycle |
| "Free forever" | BasicTheme is free; premium features require subscription |

---

*Grounding document for GTM claims - all positioning must align with these technical realities.*

# Product Brief (Adopted)

**Source Documents:**
- `loa-grimoire/prd.md` (v5.2)
- `loa-grimoire/sdd.md` (v5.2)
- GTM Setup Wizard (2026-01-03)

**Adopted:** 2026-01-03

---

## Product Overview

**Name:** Arrakis v5.0 "The Transformation"

**Type:** Multi-tenant, chain-agnostic SaaS platform for token-gated community management

**Tagline:** "Shopify for token-gated communities"

### Problem Statement

**Current Pain Points:**
- Web3 communities rely on fragmented bots (Collab.Land for token-gating, MEE6 for moderation, Guild.xyz for roles)
- Existing solutions lack deep on-chain intelligence
- No unified view of member value across on-chain activity
- Complex setup processes requiring technical knowledge
- Single-chain limitations lock communities into one ecosystem

**Solution:**
Arrakis is an all-in-one Discord/Telegram bot that combines token-gating, tiered progression, badge gamification, and rich on-chain analytics. Built by the top-starred team on Dune Analytics, it identifies "diamonds in the rough" - high-value community members based on on-chain behavior.

### What Makes It Unique

1. **On-chain Intelligence:** Powered by the #1 Dune Analytics team with unmatched data capabilities
2. **Conviction Scoring:** Proprietary scoring system based on on-chain activity (not just token balance)
3. **9-Tier Progression System:** Dune-themed gamification (Naib → Outsider) driving engagement
4. **Two-Tier Resilience:** Native RPC + Score Service with circuit breaker for 99.9% uptime
5. **Self-Service Wizard:** 15-minute setup via guided Discord modals (no code required)
6. **Coexistence Mode:** Shadow mode proves accuracy before replacing incumbents (low-risk adoption)

---

## Technical Reality

### Current Capabilities (from SDD v5.2)

| Capability | Status | Notes |
|------------|--------|-------|
| Token-gating (ERC20, NFT) | ✅ Production | Two-tier provider with fallback |
| 9-tier progression | ✅ Production | SietchTheme (premium) |
| Badge system (10+ types) | ✅ Production | Tenure, achievement, activity |
| Multi-chain support | ✅ Production | Via Score Service API |
| Self-service wizard | ✅ Production | 8-step Discord modal flow |
| PostgreSQL + RLS | ✅ Production | Multi-tenant isolation |
| Coexistence mode | 🚧 In Progress | Shadow/Parallel modes (Sprint 56-65) |
| Web dashboard | ❌ Future | Phase 7+ |

### Architecture Highlights

```
Platform Support:   Discord (primary), Telegram (secondary)
Database:           PostgreSQL 15 with Row-Level Security
Caching:            Redis 7 (sessions, rate limiting)
Queue:              BullMQ for async synthesis
Infrastructure:     AWS EKS (Kubernetes)
Rate Limiting:      Global token bucket (50 req/sec)
```

### Performance Targets

| Metric | Target |
|--------|--------|
| Basic eligibility check | <100ms |
| Advanced eligibility check | <500ms |
| Wizard step response | <3s |
| Uptime SLA | 99.9% |

---

## Target Users

### Primary: Community Operator
- Token project founder or community lead
- Has Discord/Telegram server, wants token-gating
- Non-technical (cannot deploy code)
- Wants quick setup without developer dependency

**Jobs to Be Done:**
- Set up token-gated access in minutes, not hours
- Create tiered experiences that reward top holders
- Understand which members are most valuable (beyond just balance)
- Replace multiple bots with one unified solution

### Secondary: Enterprise Admin
- Multi-community operator (DAO, NFT collective)
- Needs multi-tenant management
- Compliance requirements (audit trails)
- Custom theme requirements

### Tertiary: Platform Developer
- Building integrations on Arrakis
- Needs API access and extensibility
- Wants to contribute themes/adapters

---

## Key Capabilities

### Tier 1: Token-Gating (Free)
- Binary eligibility checks (has balance, owns NFT)
- BasicTheme: Gold/Silver/Bronze (3 tiers, 5 badges)
- Direct RPC - always works even if Score Service is down

### Tier 2: Advanced Features (Premium)
- Conviction scoring based on on-chain history
- SietchTheme: 9-tier Dune progression
- Rank-based tiers (not just balance)
- 10+ badges with lineage tracking
- Cross-chain aggregation

### Tier 3: Enterprise
- Custom themes
- Multi-community dashboard
- Full audit trail
- Dedicated support

---

## Competitive Landscape (Technical Reality)

| Feature | Arrakis | Collab.Land | Guild.xyz | MEE6 |
|---------|---------|-------------|-----------|------|
| Token-gating | ✅ | ✅ | ✅ | ❌ |
| Multi-chain | ✅ Score API | Partial | ✅ | N/A |
| Tiered progression | ✅ 9 tiers | ❌ | Partial | ❌ |
| On-chain analytics | ✅ Dune-powered | ❌ | ❌ | ❌ |
| Conviction scoring | ✅ Unique | ❌ | ❌ | ❌ |
| Self-service wizard | ✅ | ✅ | ✅ | ✅ |
| Coexistence mode | ✅ Shadow/Parallel | ❌ | ❌ | N/A |
| Badge gamification | ✅ 10+ types | ❌ | Partial | ✅ |
| Telegram support | ✅ | ✅ | ❌ | ❌ |

---

## Pricing Strategy (from PRD)

| Tier | Theme | Price | Target |
|------|-------|-------|--------|
| Free | BasicTheme | $0 | <1,000 members |
| Premium | SietchTheme | TBD | 1,000-10,000 members |
| Enterprise | Custom | TBD | 10,000+ or multi-community |

**Pricing Research Needed:** Competitive pricing analysis against Collab.Land ($49-499/mo) and Guild.xyz (free).

---

## Constraints

### Timeline
- **Launch Window:** 1-3 months
- **Current Status:** Coexistence architecture in progress (Sprints 56-65)
- **Hardening:** Post-audit requirements in flight (P0 before production)

### Resources
- **Budget:** Bootstrapped (minimal marketing budget)
- **Team Size:** Small team (1-3 people)
- **Approach:** Lean GTM, organic growth, community-first

### Technical Constraints
- Score Service is closed-source (dependency)
- Discord 3-second modal response limit
- Rate limiting across all tenants (50 req/sec global)

---

## Launch Goals

### 3-Month Targets

| Metric | Target | Source |
|--------|--------|--------|
| Active Servers | 100+ | GTM Setup |
| MRR | $1,000+ | GTM Setup |
| Onboarding completion rate | >80% | PRD |
| Score Service resilience | <1% degraded | PRD |
| Discord 429 rate | 0 global bans | PRD |

### Success Metrics (from PRD v5.2)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Communities onboarded | 100 in 6 months | Database count |
| SietchTheme parity | 100% identical to v4.1 | Regression tests |
| Tenant isolation | 100% RLS coverage | Security audit |

---

## Gaps for GTM

- [ ] **Competitive pricing research** - Need to benchmark against Collab.Land, Guild.xyz pricing
- [ ] **Market sizing** - Total addressable market for token-gated communities
- [ ] **ICP development** - Detailed ideal customer profiles beyond personas
- [ ] **Positioning statement** - Clear positioning vs incumbents
- [ ] **Launch content calendar** - Blog posts, Twitter threads, community posts
- [ ] **Partnership pipeline** - Key communities for early adoption
- [ ] **Pricing model validation** - Test willingness to pay
- [ ] **Developer relations strategy** - API documentation, SDK, examples

---

*Adopted via /gtm-adopt from loa-grimoire/prd.md (v5.2), loa-grimoire/sdd.md (v5.2) on 2026-01-03*

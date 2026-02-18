# Infrastructure as Product — GTM Plan

**Status:** Draft (Living Document)
**Author:** Team
**Date:** 2026-02-18
**Source:** [loa-finn #66 comment](https://github.com/0xHoneyJar/loa-finn/issues/66#issuecomment-3919225824)
**Parent RFC:** [Launch Readiness Gap Analysis (#66)](https://github.com/0xHoneyJar/loa-finn/issues/66)

---

## Context

52 global sprints across 20 development cycles produced a complete multi-model inference platform (4 repos, 82k+ lines, 2190+ tests). The infrastructure is 96% complete. The question is no longer "can we build it" but "how do we ship it as a product."

From the [source comment](https://github.com/0xHoneyJar/loa-finn/issues/66#issuecomment-3919225824):

> - how can we expose the twilio style infra product via apis and excellent developer tooling, cli, documentation
> - next product is the dNFT for dixie so our team itself can reason about the systems
> - open up the dNFT infra more widely

This document maps those three bullets into a concrete product plan.

---

## Three Pillars

```
Pillar 1                    Pillar 2                    Pillar 3
PLATFORM                    DOGFOOD                     OPEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Twilio-style API product    dNFT for dixie              Open dNFT infra
Developer CLI + SDK         (internal reasoning tool)   (external developers)
Documentation portal        Validates the platform      Multi-tenant platform

          ←── builds on ──→          ←── proves ──→
```

---

## Pillar 1: Twilio-Style API Platform

### What Already Exists

The agent gateway (`packages/adapters/agent/`) already implements a full request lifecycle with production-grade capabilities. This is not vaporware — it's running code.

#### API Surface (Deployed Today)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/agents/invoke` | POST | JWT | Synchronous agent invocation |
| `/api/agents/stream` | POST | JWT | SSE streaming invocation (resume via `Last-Event-ID`) |
| `/api/agents/models` | GET | JWT | Available models for caller's tier |
| `/api/agents/budget` | GET | JWT | Budget status (limit, spend, remaining) |
| `/api/agents/health` | GET | None | Gateway health check |
| `/.well-known/jwks.json` | GET | None | JWKS for JWT verification |
| `/api/billing/topup` | POST | JWT | USDC top-up (x402) |
| `/api/billing/balance` | GET | JWT | Credit balance across pools |
| `/api/billing/history` | GET | JWT | Paginated usage ledger |
| `/api/billing/pricing` | GET | None | Public pricing data |
| `/api/admin/.../byok/keys` | CRUD | Admin | BYOK key management |
| `/api/admin/.../agent-config` | GET/PUT | Admin | Community AI configuration |

**Source:** `themes/sietch/src/api/routes/agents.routes.ts`, `billing-routes.ts`, `admin/`

#### Port Interfaces (Hexagonal Architecture)

The platform boundary is already defined via TypeScript interfaces in `packages/core/ports/`:

| Port | Interface | What It Abstracts |
|------|-----------|-------------------|
| Agent Gateway | `IAgentGateway` | Multi-model invocation, streaming, budget, health |
| Chain Provider | `IChainProvider` | Blockchain data (RPC, Dune Sim, hybrid) |
| Storage | `IStorageProvider` | Multi-tenant persistence (PostgreSQL + RLS) |
| Score Service | `IScoreService` | On-chain conviction scoring |
| Vault | `IVaultClient` | Secrets management |
| Feature Gate | `IFeatureGate` | Feature flag system |

**Source:** `packages/core/ports/index.ts`

#### Wire Contracts (Cross-Language)

NATS schema package (`packages/shared/nats-schemas/`) provides neutral wire format contracts validated by both Rust (gateway) and TypeScript (workers) via committed JSON fixtures.

#### CLI Tool (gaib)

`packages/cli/` — Commander.js CLI with auth, sandbox, server IaC commands. Currently internal-facing.

#### Capabilities Already Production-Ready

| Capability | Implementation | Key File |
|------------|---------------|----------|
| 5-pool model routing | cheap, fast-code, reviewer, reasoning, native | `pool-mapping.ts` |
| 3-tier access control | free, pro, enterprise | `agent-gateway.ts` |
| 9-level conviction scoring | BGT holdings → tier 1-9 | `scoring-service` |
| 4-dimensional rate limiting | community, user, channel, burst | `agent-rate-limiter.ts` |
| Ensemble orchestration | best_of_n, consensus, fallback | `ensemble-accounting.ts` |
| Per-model cost attribution | BigInt micro-USD, zero precision loss | `ensemble-accounting.ts` |
| BYOK (Bring Your Own Key) | Key never seen by infra, deny-by-default redaction | `byok-proxy-handler.ts` |
| Budget atomicity | Two-counter Lua scripts in Redis | `budget-manager.ts` |
| Stream resume | Monotonic event IDs, `Last-Event-ID` | `request-lifecycle.ts` |
| Circuit breaking | Fleet-wide Redis circuit breaker | `redis-circuit-breaker.ts` |
| Idempotency | `X-Idempotency-Key` header | Agent routes |

### What Needs to Be Built (Platform Gaps)

#### Gap 1: Public API Documentation

**Current state:** Types exist in TypeScript. No OpenAPI spec, no hosted docs.

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| OpenAPI 3.1 spec | Generated from Zod schemas (routes already use Zod validation) | P0 |
| Hosted API reference | Interactive docs (Mintlify, Redocly, or Scalar) | P0 |
| Authentication guide | JWT flow, API key provisioning, JWKS verification | P0 |
| Quick-start tutorial | "First agent call in 5 minutes" | P0 |
| Rate limit documentation | Tier tables, header semantics, retry guidance | P1 |
| Ensemble guide | When to use best_of_n vs consensus vs fallback | P1 |
| BYOK integration guide | Key registration, rotation, cost separation | P1 |

**Approach:** Use `zod-to-openapi` to generate the spec from the existing Zod schemas in `themes/sietch/src/api/routes/`. The validation layer is already there — it just needs to be exposed as documentation.

#### Gap 2: Developer SDK / Client Library

**Current state:** Raw HTTP. No published client libraries.

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| TypeScript SDK | Typed client wrapping the REST API + SSE streaming | P0 |
| Python SDK | For ML/data science integrations | P1 |
| SDK package publishing | npm (`@thj/arrakis-sdk`) + PyPI | P0 |
| Retry + backoff logic | Built into SDK, respects `Retry-After` headers | P0 |
| Stream helpers | Async iterator wrappers for SSE events | P0 |

**Approach:** The TypeScript SDK can be extracted from the existing `loa-finn-client.ts` (`packages/adapters/agent/loa-finn-client.ts`) which already implements the full invocation protocol. The types from `packages/core/ports/agent-gateway.ts` become the SDK's public surface.

#### Gap 3: Developer CLI (gaib evolution)

**Current state:** `gaib` CLI exists (`packages/cli/`) with auth, sandbox, server commands. Needs external developer ergonomics.

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| `gaib login` → API key flow | OAuth or API key auth for external devs | P0 |
| `gaib agent invoke` | CLI-based agent invocation (like `curl` but typed) | P0 |
| `gaib agent stream` | Streaming invocation in terminal | P0 |
| `gaib budget status` | Check remaining budget | P1 |
| `gaib models list` | Available models for current tier | P1 |
| `gaib keys create/rotate/list` | BYOK management from CLI | P1 |
| npm global install | `npx @thj/gaib` or `npm install -g @thj/gaib` | P0 |

**Approach:** Extend existing Commander.js structure. The auth and sandbox commands already work — add agent-facing commands that hit the REST API.

#### Gap 4: Developer Portal / Dashboard

**Current state:** Admin dashboard exists for community config. No self-service developer portal.

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| API key self-service | Create, rotate, revoke API keys | P0 |
| Usage dashboard | Real-time spend, model breakdown, request history | P0 |
| Budget controls | Set monthly limits, configure alerts | P1 |
| Team management | Invite team members, assign roles | P2 |
| Webhook configuration | Event subscriptions for usage alerts | P2 |

#### Gap 5: Self-Service Onboarding

**Current state:** Communities onboard via Discord bot wizard (`packages/adapters/wizard/`). No API-first onboarding.

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| `POST /api/v1/communities` | Programmatic community creation | P1 |
| API key provisioning | Auto-generate keys on signup | P0 |
| Sandbox environment | Free-tier sandbox for testing (gaib sandbox exists) | P1 |
| Billing self-service | Credit card / crypto payment without admin | P1 |

### The Twilio Analogy — Mapped

| Twilio Concept | Arrakis Equivalent | Status |
|----------------|-------------------|--------|
| Account SID + Auth Token | Community ID + JWT (ES256) | Exists |
| Programmable Voice/SMS | Programmable AI Agents (invoke/stream) | Exists |
| Phone numbers | Model pools (cheap, reasoning, native...) | Exists |
| Usage records | Per-model cost attribution + JSONL ledger | Exists |
| Rate limits + quotas | 4-dimensional rate limiting + budget atomicity | Exists |
| Twilio CLI | gaib CLI | Exists (needs expansion) |
| Helper libraries | TypeScript/Python SDKs | Gap |
| Console (dashboard) | Developer portal | Gap |
| OpenAPI spec | Auto-generated from Zod | Gap |
| Docs site | Hosted API reference | Gap |

**Bottom line:** The infrastructure *is* the Twilio equivalent. The gaps are entirely in developer experience — docs, SDKs, CLI, portal — not in capability.

---

## Pillar 2: dNFT for Dixie (Internal Dogfooding)

### Purpose

Build the next product — dynamic NFTs for the dixie team — using the platform APIs built in Pillar 1. This serves two goals:

1. **Validate the platform.** If our own team can't build on it efficiently, external developers won't either.
2. **Reason about the systems.** The dNFT gives the team a concrete artifact that exercises the full stack: agent invocation, personality routing, budget tracking, tier access.

### What "dNFT for Dixie" Means

A dynamic NFT whose metadata (image, traits, behavior) evolves based on agent interactions routed through the arrakis platform:

```
NFT Holder ──→ Platform API ──→ Agent Gateway ──→ Multi-Model Pool
                                     │
                                     ├── Personality (BEAUVOIR.md)
                                     ├── Session memory
                                     ├── Tool use (on-chain reads)
                                     └── Cost tracking
                                     │
                                     ▼
                               dNFT Metadata Update
                               (traits, image, behavior)
```

### What This Exercises

| Platform Capability | How dNFT Uses It |
|--------------------|--------------------|
| Agent invocation API | Every interaction with the NFT hits `/api/agents/invoke` or `/stream` |
| Personality routing | Each NFT has a BEAUVOIR.md personality → pool routing config |
| Budget management | Team budget tracked per-community, per-model |
| Tier access | Different NFT rarity tiers map to different model access |
| BYOK | Team can use own API keys, separated from platform budget |
| Ensemble strategies | NFT responses can use consensus for high-stakes decisions |
| Streaming | Real-time NFT interactions via SSE |
| Tool use | On-chain data reads (holdings, activity) via chain provider |

### Infrastructure Already in Place (from Issue #27)

| Component | Status | Reference |
|-----------|--------|-----------|
| NFT routing config (personality → task → pool) | Built | Hounfour router |
| BEAUVOIR.md personality loader | Built | Pi SDK agent runtime |
| Token-gated tier access | Built | Conviction scoring |
| Session management with resume | Built | Gateway WebSocket |
| Tool sandbox (read/write/bash/edit) | Built | Agent runtime |
| ERC-6551 Token Bound Account binding | Route exists | `agent/tba` routes |
| Agent governance (proposals, voting) | Route exists | `agent/governance` routes |

### What Needs to Be Built for Dixie

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| dNFT metadata service | Serves evolving metadata (traits, image URI) | P0 |
| Personality generation pipeline | Create unique BEAUVOIR.md per NFT mint | P0 |
| Interaction → trait evolution | Map agent conversations to trait changes | P1 |
| On-chain metadata update | Write updated traits to contract/IPFS | P1 |
| Internal developer experience report | Document friction points for Pillar 1 feedback | P0 |

### Success Criteria

- [ ] Dixie team builds dNFT product using **only** the public API (no internal shortcuts)
- [ ] All friction points documented and fed back into Pillar 1 (SDK, CLI, docs improvements)
- [ ] dNFT exercises at least 6 of 8 platform capabilities listed above
- [ ] Team can reason about costs, model routing, and budget via dashboard/CLI

---

## Pillar 3: Open dNFT Infrastructure

### Purpose

Once validated internally (Pillar 2), open the platform to external developers who want to build their own AI-powered NFT experiences (or any agent-driven product) on top of the infrastructure.

### Multi-Tenant Architecture (Already Exists)

The platform is already multi-tenant by design:

| Multi-Tenancy Feature | Implementation | Source |
|----------------------|----------------|--------|
| Per-community isolation | `tenantId` in every request context | `agent-gateway.ts` |
| Row-Level Security | PostgreSQL RLS via `tenant-context.ts` | `packages/adapters/storage/` |
| Per-community budgets | Independent budget counters per tenant | `budget-manager.ts` |
| Per-community rate limits | Scoped rate limit buckets | `agent-rate-limiter.ts` |
| Per-community BYOK | Keys stored per community | `byok-proxy-handler.ts` |
| Per-community agent config | Model access, tier overrides, pricing | Admin routes |

### What "Open" Looks Like — Phases

#### Phase 1: Managed Platform (Hosted SaaS)

External developers sign up, get API keys, build on the hosted platform.

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| Self-service signup | Create account → get API key → first call | P0 |
| Free tier | Rate-limited free access to `cheap` pool | P0 |
| Paid tiers | Pro ($X/mo), Enterprise (custom) | P0 |
| Usage-based billing | Pay per token (metered via existing budget engine) | P0 |
| SLA + uptime commitment | 99.9% for paid tiers | P1 |
| Multi-region | Deploy to EU + APAC (Terraform IaC exists) | P2 |

#### Phase 2: White-Label / Embedded

Communities embed the platform in their own products.

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| Embeddable chat widget | `<script src="...">` drop-in | P1 |
| Custom domain support | `agents.yourcommunity.com` | P2 |
| Custom branding | Theme the widget/dashboard per tenant | P2 |
| Webhook integrations | Event push for usage, budget, errors | P1 |

#### Phase 3: Self-Hosted (Enterprise)

Enterprise customers run their own instance.

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| Docker Compose bundle | `docker compose up` for full stack | P1 |
| Helm chart | Kubernetes deployment | P2 |
| Terraform modules | Reusable IaC (already exists for AWS) | P1 |
| Air-gapped support | No external dependencies | P3 |

### Competitive Moat (From Issue #66 Analysis)

These are capabilities **no competitor offers together**:

```
1. Token-gated model access      — On-chain conviction → AI capability tier
2. NFT-bound persistent identity  — Personality travels with the token
3. Confused deputy prevention     — Independently verified pool authorization
4. Ensemble multi-model           — 3 strategies with atomic budget tracking
5. BYOK with deny-by-default      — User keys never seen by infrastructure
6. Protocol-first design          — Shared contract package (versioned, tested)
```

### Pricing Model (Strawman)

| Tier | Monthly | Models | Rate Limit | Budget | Support |
|------|---------|--------|------------|--------|---------|
| Free | $0 | cheap only | 100 req/day | $5 platform credit | Community |
| Builder | $49 | cheap + fast-code + reviewer | 10k req/day | $50 included | Email |
| Pro | $199 | All 5 pools | 100k req/day | $200 included | Priority |
| Enterprise | Custom | All + ensemble + BYOK | Custom | Custom | Dedicated |

Usage beyond included budget billed at per-token rates (already tracked via `ensemble-accounting.ts`).

---

## Sequencing

```
Phase 0: DOCUMENT (Now)
├── This living document
├── Inventory what exists vs gaps
└── Align on priorities

Phase 1: DEVELOPER EXPERIENCE (Pillar 1 — Foundation)
├── OpenAPI spec generation from Zod schemas
├── TypeScript SDK (extract from loa-finn-client.ts)
├── gaib CLI agent commands
├── Hosted API docs (quick-start, auth guide)
└── API key self-service

Phase 2: DOGFOOD (Pillar 2 — Validation)
├── dNFT for dixie built on public APIs
├── Friction report → feeds back into Phase 1
├── Personality generation pipeline
└── Internal developer experience validated

Phase 3: OPEN (Pillar 3 — Growth)
├── Self-service signup + free tier
├── Paid tier billing (usage-based)
├── Embeddable widget
├── Marketing site + case study (dixie dNFT)
└── Community + ecosystem
```

---

## Decisions Required

These are architectural decisions that must be resolved before implementation begins. Surfaced via cross-model adversarial review (GPT-5.2, 2026-02-18).

### D1: Authentication Model — API Keys vs JWT

**Problem:** The plan references both JWT (ES256 + JWKS) for existing endpoints and "API keys" for external developer access. These are different auth primitives with different ergonomics, rotation semantics, and SDK implications.

**Options:**

| Option | How It Works | Pros | Cons |
|--------|-------------|------|------|
| **A: API key primary** | Developer gets API key at signup. Gateway exchanges key for short-lived JWT internally. JWKS used only for S2S (loa-finn ↔ arrakis). | Simple DX (one string in header). Matches Twilio/Stripe. Easy SDK integration. | Requires new key→JWT exchange layer. API keys need rotation/revocation infra. |
| **B: OAuth/OIDC primary** | Developer authenticates via OAuth flow. API keys are optional "personal access tokens" minted via portal. | Standard. Supports scoped permissions. Good for team/org scenarios. | More complex for CLI/SDK. Overkill for MVP. |
| **C: Hybrid (Recommended)** | API key for server-to-server (SDK, CLI, backend). OAuth for portal/dashboard. Gateway accepts both, resolves to internal JWT. | Best DX per context. Familiar pattern (GitHub, Stripe). | Two auth paths to maintain. |

**Decision:** `[ ] A` `[ ] B` `[ ] C` `[ ] Other` — Owner: Engineering + Product

### D2: Account Hierarchy — What Is a "Tenant"?

**Problem:** The platform currently uses "community" (Discord/Telegram server) as the tenant boundary. For external developers who aren't running chat communities, this model doesn't fit. A developer building a dApp needs a project, not a community.

**Proposed Hierarchy:**

```
Account (billing owner, one per signup)
  └── Project (API keys, environments, budgets)
       └── Community (optional — for Discord/TG integrations)
            └── End-user (wallet address / userId)
```

| Entity | Maps To Today | What Changes |
|--------|--------------|--------------|
| Account | (doesn't exist) | New: signup identity, billing, team membership |
| Project | communityId | Rename/alias. API keys + budgets attach here |
| Community | communityId | Becomes optional sub-resource of Project |
| End-user | userId + walletAddress | No change |

**Impact:** Budgets/rate limits attach to Project (not Community). `POST /api/v1/projects` replaces `POST /api/v1/communities` as the primary onboarding endpoint. Communities become an opt-in integration for chat-platform users.

**Decision:** `[ ] Accept proposed hierarchy` `[ ] Keep community-first` `[ ] Other` — Owner: Product + Engineering

### D3: Billing Primitive — Prepaid Credits vs Postpaid Metered

**Problem:** The plan references prepaid USDC top-ups (x402), Paddle subscriptions, and NOWPayments — but doesn't define how overages work, what the ledger source of truth is, or the enforcement model.

**Options:**

| Option | How It Works | Enforcement | Pros | Cons |
|--------|-------------|-------------|------|------|
| **A: Prepaid credits only** | Top-up required. Hard stop at $0. Optional auto-top-up. | Gateway rejects at zero balance | Simple. No invoicing. No bad debt. Crypto-native. | Friction (must top-up before use). Bad UX for enterprise. |
| **B: Subscription + metered overage** | Monthly plan includes credits. Overage billed at end of month via Stripe/Paddle. | Soft limit (warn at 80%, hard at 200%) | Familiar SaaS model. Enterprise-friendly. | Requires invoicing, chargebacks, credit risk. |
| **C: Prepaid MVP → Postpaid later (Recommended)** | Launch with prepaid (simpler). Existing budget engine enforces hard stops. Add postpaid for Enterprise tier later. | Prepaid: hard stop. Enterprise: soft limit + invoice. | Ship faster. Crypto-native MVP. Enterprise path clear. | Two billing paths eventually. |

**Existing infra that supports this:**
- Budget engine with two-counter atomicity (`budget-manager.ts`) — already enforces hard stops
- USDC top-up endpoint (`/api/billing/topup`) — prepaid crypto path exists
- Paddle integration (`FEATURE_BILLING_ENABLED`) — subscription path stubbed
- Per-model cost attribution (`ensemble-accounting.ts`) — metering exists

**Decision:** `[ ] A` `[ ] B` `[ ] C` `[ ] Other` — Owner: Product + Finance

### D4: Pillar 2 Entry Gate — What "Public API" Means for Dogfooding

**Problem:** Pillar 2 success criterion says "dixie team builds using only the public API." But if Pillar 2 starts before Pillar 1 is complete, they'll use internal routes and miss the real DX issues.

**Proposed: Public API MVP Gate (minimum before Pillar 2 starts)**

| Requirement | Why |
|-------------|-----|
| Stable auth (API key → invoke) | Can't dogfood without real auth flow |
| Key provisioning (CLI or portal) | Can't get started without a key |
| One quickstart doc | Can't onboard without instructions |
| SDK/CLI for invoke + stream | Can't exercise the platform via raw curl |
| Usage/budget view (CLI or API) | Can't reason about costs without visibility |

Everything else (full portal, Python SDK, webhook config, team management) is P1+ and can be informed by Pillar 2 feedback.

**Sequencing becomes:**

```
Phase 1.0: Public API MVP (gate) ──→ Phase 2: Dogfood ──→ Phase 1.1: DX iteration ──→ Phase 3: Open
```

**Decision:** `[ ] Accept MVP gate` `[ ] Dogfood on internal APIs first` `[ ] Other` — Owner: Engineering

### D5: API Contract Source of Truth

**Problem:** Multiple contract layers exist: Zod schemas (routes), TypeScript port interfaces (`packages/core/ports/`), NATS wire schemas, and loa-hounfour protocol contracts. Generating OpenAPI from the wrong layer risks drift between docs and runtime.

**Proposed:** REST Zod schemas are canonical for external API. CI conformance test validates that:
1. OpenAPI spec matches Zod schemas (generation step)
2. Integration tests run against deployed gateway using the spec
3. NATS schemas remain internal-only (not exposed to external developers)
4. Port interfaces are the internal contract; SDK types are generated from OpenAPI

**Decision:** `[ ] Accept (Zod → OpenAPI → SDK)` `[ ] OpenAPI source-controlled, Zod validates against it` `[ ] Other` — Owner: Engineering

### D6: SLA Definition

**Problem:** The plan mentions "99.9% SLA for paid tiers" without defining what counts as uptime, how it's measured, or what operational controls are required.

**Proposed: Defer SLA to Phase 3, launch with SLO**

- Phase 1-2: Publish **SLO targets** (not contractual SLA): 99.5% gateway availability, <500ms p95 invoke latency
- Phase 3: Upgrade to contractual **SLA** after 90 days of SLO measurement proves achievable
- Required for SLA: status page, SLO dashboard, oncall rotation, incident response playbook, provider failover policy
- SLA excludes upstream model provider outages (document this explicitly)

**Decision:** `[ ] SLO now, SLA at Phase 3` `[ ] SLA from Phase 1 (higher bar)` `[ ] No uptime commitment` `[ ] Other` — Owner: Product + Ops

### D7: BYOK Metering Model

**Problem:** BYOK promises "key never seen by infrastructure" but the platform needs to meter usage for budget enforcement and billing. These are in tension.

**Proposed: Proxy mode with token metering (content-redacted)**

| What Platform Sees | What Platform Does Not See |
|-------------------|---------------------------|
| Token counts (input/output) | API key material |
| Model ID + provider | Prompt/completion content (redacted) |
| Latency, error codes | User data within messages |
| Cost estimate (from token counts) | Raw request/response bodies |

**How it works today:** `byok-proxy-handler.ts` proxies requests. `ensemble-accounting.ts` counts tokens from provider response headers/usage fields. Content redaction is deny-by-default (`byok-redaction`). Budget enforcement uses token-estimated costs.

**What needs to be documented:** Explicit data handling policy for BYOK customers. What is logged, what is redacted, how costs are computed. This becomes a trust document for the platform.

**Decision:** `[ ] Proxy + token metering (current model, document it)` `[ ] Pass-through with provider-side reconciliation` `[ ] Other` — Owner: Engineering + Legal

---

## Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| Q1 | What's the target developer persona? (Web3 native? Traditional SaaS? Both?) | Product | Open |
| Q2 | Pricing validation — is usage-based or seat-based better for this market? | Product | Open |
| Q3 | Should the SDK be a thin HTTP wrapper or include agent-building primitives? | Engineering | Open |
| Q4 | dNFT for dixie — what's the NFT contract? ERC-721 + ERC-6551 TBA? | Engineering | Open |
| Q5 | Self-hosted (Phase 3) — how much demand vs managed platform? | Product | Open |
| Q6 | Should we publish `@thj/arrakis-sdk` or use a product-specific brand name? | Marketing | Open |
| Q7 | Which model providers at launch? (Anthropic + OpenAI? Add Groq/DeepSeek?) | Engineering | Open |
| Q8 | Is the finnNFT launch (Issue #66 Sprint A-D) a prerequisite or parallel track? | Product | Open |

---

## Appendix A: Existing Codebase Inventory

### Repositories

| Repo | Purpose | Lines | Tests |
|------|---------|-------|-------|
| arrakis | User-facing layer (Discord, Telegram, API, CLI) | ~50k | ~1200 |
| loa-finn | Inference engine (Hounfour router, Gateway, Agent runtime) | ~32k | ~990 |
| loa-hounfour | Shared protocol contracts (v7.0.0) | ~5k | ~91 vectors |
| loa (upstream) | Framework + eval sandbox | — | — |

### Package Architecture

```
packages/
├── core/                    # Ports (interfaces) — the platform contract
│   └── ports/               # IAgentGateway, IChainProvider, IStorageProvider, ...
├── adapters/                # Implementations — the platform internals
│   ├── agent/               # Agent Gateway (32 KB, full lifecycle)
│   ├── chain/               # Blockchain data (RPC/Dune/hybrid)
│   ├── storage/             # PostgreSQL + Drizzle + RLS
│   ├── synthesis/           # BullMQ queue for Discord API
│   ├── wizard/              # 8-step onboarding
│   ├── security/            # Vault, KillSwitch, MFA
│   └── coexistence/         # Shadow mode migration
├── shared/
│   └── nats-schemas/        # Cross-language wire contracts
└── cli/                     # gaib CLI tool
```

### Infrastructure (Terraform)

```
infrastructure/terraform/
├── main.tf                  # ECS Fargate + RDS + ElastiCache + ALB
├── agent-monitoring.tf      # CloudWatch dashboards + alarms
└── variables.tf             # Configurable per-environment
```

Estimated monthly cost: ~$150-200 (production).

### Key Configuration Points

| Variable | Purpose | Current |
|----------|---------|---------|
| `CHAIN_PROVIDER` | Blockchain data mode | `hybrid` |
| `POOL_PROVIDER_HINTS` | Pool → provider routing | JSON config |
| `DUNE_SIM_API_KEY` | Dune Sim API access | Required for hybrid |
| `LOA_FINN_URL` | Inference engine endpoint | Internal |
| `FEATURE_BILLING_ENABLED` | Paddle billing | Flag |
| `FEATURE_CRYPTO_PAYMENTS_ENABLED` | NOWPayments | Flag |

---

## Appendix B: Competitive Landscape (from Issue #66)

```
                        AGENT SIMPLICITY
                              ^
                              |
              nanobot ────────┤── 9 channels, lightweight, personal
                              |   No cost governance, no token-gating
                              |
     SELF-IMPROVING ──────────┼──────────────── TOKEN-GATED
                              |
              hive ───────────┤── Dynamic agents, goal-driven
                              |   No NFT identity, no on-chain gating
                              |
              arrakis ────────┤── Capability market for AI model access
              + loa-finn      |   Token-gated, multi-model, NFT-bound
                              |   2 channels today (Discord/TG), static agents
                              v
                        INFRASTRUCTURE DEPTH
```

**Our position:** Infrastructure depth + token-gating + cost governance. The platform play doubles down on this — we're not competing on channel breadth, we're competing on programmability.

---

*This is a living document. Update it as decisions are made and priorities shift.*

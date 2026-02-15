# PRD: The Stillsuit — Cross-System Integration & Revenue Rules

**Version:** 1.0.0
**Status:** Draft
**Cycle:** 026
**Created:** 2026-02-15
**Author:** Claude Opus 4.6 + Human (Merlin)

**References:**
- RFC #66 (loa-finn): Launch Readiness Gap Analysis
- RFC #62 (arrakis): Billing & Payments Path to Revenue
- RFC #31 (loa-finn): The Hounfour Multi-Model Provider Abstraction
- PR #63 (arrakis): Billing & Credit Ledger System (Cycle 025)
- PR #1 (loa-hounfour): Protocol Types v3.0.0
- PR #2 (loa-hounfour): The Agent Economy v4.6.0
- Bridgebuilder Review: bridge-20260215-b5db9a (Iteration 1, FLATLINE)

---

## 1. Problem Statement

Cycle 025 delivered a production-grade billing system with 109 tests, revenue rules governance, agent wallets, and S2S contract types. The Bridgebuilder review achieved FLATLINE — 3 PRAISE findings, 3 LOW findings, 0 blockers. But the billing system exists in isolation.

**The billing system cannot collect real money until three bridges are built:**

1. **Protocol bridge**: Arrakis defines its own billing types locally while loa-hounfour v3.0.0/v4.6.0 provides shared protocol types with formal state machines and cross-language constraints. These must converge.

2. **Trust bridge**: The S2S finalize contract (`s2s-billing.ts`) has Zod schemas but no cross-system verification. loa-finn needs to call arrakis with real JWTs, and arrakis needs to verify the caller's identity and the agent's identity anchor.

3. **Operations bridge**: The Revenue Rules governance system (Sprint 8) has a state machine and database constraints, but no admin workflow for actually changing revenue splits. The bridge also flagged a non-atomic Redis counter (get-then-set race condition) that must be resolved before production concurrency.

**Without these bridges, the billing system is a cathedral with no doors.**

### Constraint: Excellence Without Perfectionism

This cycle targets production readiness for the bridges identified by the Bridgebuilder review. We are NOT re-architecting the billing system — it already achieved FLATLINE. We are connecting it to the outside world and hardening the operational surface.

---

## 2. Goals

| ID | Priority | Goal | Success Metric |
|----|----------|------|----------------|
| G-1 | P0 | Adopt loa-hounfour protocol types in arrakis billing | `validateCompatibility()` passes, 0 local type duplicates |
| G-2 | P0 | Cross-system E2E smoke test (arrakis ↔ loa-finn) | End-to-end reserve → inference → finalize completes with real JWT |
| G-3 | P0 | Revenue Rules admin workflow with state machine guards | Rule can be proposed, approved, cooled, activated via API |
| G-4 | P1 | Atomic Redis counter primitive (INCRBY) | Concurrent daily spending updates don't lose writes |
| G-5 | P1 | Identity anchor cross-system verification | Agent wallet binding verified across trust boundary |
| G-6 | P1 | Admin contract extraction (billing-admin-routes) | All admin Zod schemas extracted to contracts file |
| G-7 | P2 | Revenue Rules change notification system | Stakeholders notified on rule state transitions |

---

## 3. Stakeholders

| Role | Interaction with This Cycle |
|------|---------------------------|
| **Foundation** | Configures revenue rules, monitors distribution changes |
| **Community Admin** | Views revenue share changes, receives notifications |
| **loa-finn Service** | Calls S2S finalize with real JWT, verified against protocol types |
| **Agent** | Identity anchor verified cross-system, daily spending atomic |
| **Developer** | Uses shared protocol types, no local duplicates |

---

## 4. What Already Exists (Cycle 025 Deliverables)

### Billing Infrastructure (PR #63)

| Component | Status | Files | Tests |
|-----------|--------|-------|-------|
| Credit Ledger (FIFO, BigInt, pools) | Production-ready | `CreditLedgerAdapter.ts`, migration 030 | 40+ tests |
| Revenue Distribution (zero-sum) | Production-ready | `RevenueDistributionService.ts` | 12 tests |
| Revenue Rules Governance | State machine + DB constraints | `RevenueRulesAdapter.ts`, migration 035 | 16 tests |
| Agent Wallet (ERC-6551 prototype) | Prototype with Redis fallback | `AgentWalletPrototype.ts` | 10 tests |
| S2S Finalize Contract | Typed + Zod schemas | `s2s-billing.ts` | 5 tests |
| Confused Deputy Prevention | S2S accountId verification | `billing-routes.ts:358-378` | Tested |
| Reconciliation + Generation Counter | Operational | `daily-reconciliation.ts` | 5 tests |
| Billing Admin Routes | Basic CRUD + audit | `billing-admin-routes.ts` | Tests exist |
| ADRs | 5 decisions documented | `billing-adrs.md` | N/A |

### Bridgebuilder Findings (bridge-20260215-b5db9a)

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| praise-1 | PRAISE | Revenue rules state machine with DB enforcement | No action needed |
| praise-2 | PRAISE | Confused deputy prevention on S2S finalize | No action needed |
| praise-3 | PRAISE | ADRs document the 'why' not just the 'what' | No action needed |
| low-1 | LOW | getRemainingDailyBudget sync→async breaking change | **G-4: Document + provide both variants** |
| low-2 | LOW | Redis daily spending lacks atomic increment | **G-4: Implement INCRBY** |
| low-3 | LOW | S2S contract types not consumed by billing-admin-routes | **G-6: Extract admin contracts** |

### loa-hounfour Protocol Types (PR #1 + PR #2)

| Feature | Version | Status |
|---------|---------|--------|
| Agent billing config types | v3.0.0 | PR #1 OPEN |
| BigInt micro-USD arithmetic | v3.0.0 | PR #1 OPEN |
| Guard result types | v3.0.0 | PR #1 OPEN |
| Version compatibility validator | v3.0.0 | PR #1 OPEN |
| Unified state machines (escrow, stake, credit) | v4.6.0 | PR #2 OPEN |
| Aggregate boundaries (5 DDD) | v4.6.0 | PR #2 OPEN |
| Temporal properties (6 safety + 3 liveness) | v4.6.0 | PR #2 OPEN |
| Cross-language constraints (31 rules) | v4.6.0 | PR #2 OPEN |
| Economy flow verification | v4.6.0 | PR #2 OPEN |

---

## 5. Functional Requirements

### FR-1: loa-hounfour Protocol Adoption (G-1)

**Context**: Arrakis billing defines local TypeScript interfaces (`ICreditLedgerService`, `IRevenueRulesService`, etc.) while loa-hounfour provides shared protocol types with formal verification. These must be aligned.

**Integration Mode: Vendored Snapshot (Hard Dependency)**

loa-hounfour PRs #1 (v3.0.0) and #2 (v4.6.0) are still OPEN. To avoid blocking this cycle on upstream merges, arrakis will **vendor a pinned snapshot** of the protocol types package. This means:
- Copy the published types from loa-hounfour into `packages/core/protocol/` as a vendored dependency
- Pin to a specific commit hash (not a moving branch target)
- When loa-hounfour PRs merge and publish to npm, replace vendored copy with the npm package
- No "graceful degradation" — vendored types are always available at build time

**Requirements:**

1. **Vendor loa-hounfour types** from a pinned commit into `packages/core/protocol/`
2. **Map local types to protocol types**: Each local billing interface must either extend or implement the corresponding loa-hounfour type
3. **Import shared state machines**: Revenue rules state machine in `035_revenue_rules.ts` must validate against the vendored `STATE_MACHINES.credit`
4. **Call `validateCompatibility(CONTRACT_VERSION)`** as a cross-service check (arrakis ↔ loa-finn protocol version agreement), not a dependency-present check
5. **Replace local billing arithmetic** with shared BigInt micro-USD helpers from vendored types
6. **Remove local duplicates**: Any type that exists in both arrakis and the vendored protocol should import from protocol

**Acceptance Criteria:**
- `validateCompatibility()` returns `{ compatible: true }` when arrakis and loa-finn exchange version info
- No local type definitions duplicate vendored protocol exports
- All existing 109 tests continue to pass
- Protocol version logged at service start
- Vendored types pinned to specific commit hash with upgrade path documented

### FR-2: Cross-System E2E Smoke Test (G-2)

**Context**: RFC #66 identifies this as P0. The S2S finalize contract exists in TypeScript but has never been tested with a real JWT exchange between arrakis and loa-finn.

**Deployment Contract:**
- **SQLite** lives inside the arrakis container only (not a Compose service). Mounted volume for persistence between test runs.
- **Redis** is a Compose service shared by both containers on the Compose network.
- **Two distinct JWT flows** (do not conflate):
  1. **Tenant JWT** (arrakis → loa-finn): arrakis issues a tenant JWT with `tenant_id`, `nft_id`, `tier` claims. loa-finn validates against arrakis's public key. This authorizes inference.
  2. **S2S Service JWT** (loa-finn → arrakis): loa-finn issues an S2S JWT with `service_id`, `account_id` claims. arrakis validates against loa-finn's public key. This authorizes finalize.
- **Key provisioning**: ES256 keypairs generated at Compose build time. Public keys mounted as read-only volumes into the verifying container. Private keys mounted only into the signing container.
- **Health checks**: Both containers expose `/health` with readiness probes. Test script waits for both to be healthy before running.
- **Test data seeding**: Deterministic seed script creates test account, deposits credits, so tests are idempotent.

**Requirements:**

1. **Docker Compose manifest** with arrakis container (includes SQLite) + loa-finn container + Redis service
2. **Key generation script**: `scripts/e2e-keygen.sh` generates ES256 keypairs for both JWT flows
3. **Tenant JWT flow**: arrakis issues tenant JWT → loa-finn validates with arrakis public key → inference runs
4. **S2S finalize flow**: loa-finn issues S2S JWT with `service_id` + `account_id` → arrakis validates with loa-finn public key → verifies accountId ownership → finalizes reservation
5. **Revenue distribution verification**: After finalize, verify commons/community/foundation entries exist with correct bps splits
6. **Overrun handling**: Test case where actual cost > reserved amount, verify billing mode behavior

**Acceptance Criteria:**
- `docker compose up` starts both services with health check gates
- E2E test script completes: create account → deposit → reserve → (inference via tenant JWT) → finalize (via S2S JWT) → verify distribution
- JWT validation uses ES256 with mounted public keys (not shared secrets)
- Overrun test passes for shadow, soft, and live modes
- Test runs in CI (GitHub Actions) with keygen in CI setup step
- SQLite state is internal to arrakis container; Redis is shared on Compose network

### FR-3: Revenue Rules Admin Workflow (G-3)

**Context**: The revenue rules governance system has a state machine (`draft → pending_approval → cooling_down → active → superseded`) but no admin API workflow for proposing and managing rule changes. billing-admin-routes.ts has basic CRUD but not the full lifecycle.

**Admin Identity Model:**

All admin API calls are authenticated via scoped JWTs issued by arrakis's admin auth system (ADR-003: separate admin JWT secret). The JWT `sub` claim is the stable `actor_id` used in audit logs. Key requirements:
- **Actor identity**: The `actor_id` in audit logs MUST come from the authenticated JWT `sub` claim, never from the request body (prevents spoofing)
- **Scoped authorization**: Each endpoint requires specific JWT scopes (`admin:rules:write`, `admin:rules:approve`, `admin:rules:emergency`)
- **Four-eyes enforcement**: The `approve` endpoint compares the JWT `sub` of the approver against the `created_by` field of the rule. Same actor → 403 Forbidden.
- **Request correlation**: Every audit entry includes a `correlation_id` (from `X-Request-Id` header or generated UUID) for forensic tracing

**Audit Log Immutability:**

The `revenue_rule_audit_log` table enforces append-only at the database level:
- **SQLite trigger**: `BEFORE UPDATE ON revenue_rule_audit_log` → raises error ("audit log is immutable")
- **SQLite trigger**: `BEFORE DELETE ON revenue_rule_audit_log` → raises error ("audit log is immutable")
- Application code only INSERTs into audit log; no UPDATE/DELETE queries exist

**Requirements:**

1. **POST `/admin/billing/revenue-rules`** — Create a new rule in `draft` status
   - Validates bps_sum_100 (commons + community + foundation = 10000 bps)
   - Requires `admin:rules:write` scope
   - `created_by` set from JWT `sub` (not request body)
   - Returns rule ID

2. **POST `/admin/billing/revenue-rules/:id/submit`** — Transition `draft → pending_approval`
   - Only the creator (JWT `sub` == `created_by`) can submit their own draft
   - Creates audit log entry with `actor_id` from JWT `sub`

3. **POST `/admin/billing/revenue-rules/:id/approve`** — Transition `pending_approval → cooling_down`
   - Starts 48-hour cooldown timer
   - Four-eyes: JWT `sub` MUST differ from rule's `created_by` → 403 if same
   - Requires `admin:rules:approve` scope
   - Creates audit log entry with approver ID

4. **POST `/admin/billing/revenue-rules/:id/activate`** — Transition `cooling_down → active`
   - Only after cooldown period expires
   - Supersedes current active rule (if any)
   - Creates audit log entry
   - Triggers notification (G-7)

5. **POST `/admin/billing/revenue-rules/:id/reject`** — Transition `pending_approval|cooling_down → rejected`
   - Requires rejection reason
   - Creates audit log entry with reason

6. **POST `/admin/billing/revenue-rules/:id/emergency-activate`** — Override cooldown
   - Requires `admin:rules:emergency` scope
   - Requires written justification
   - Creates audit log with emergency flag
   - Triggers urgent notification

7. **GET `/admin/billing/revenue-rules`** — List all rules with status filter
8. **GET `/admin/billing/revenue-rules/:id/audit`** — Full audit trail for a rule

**Acceptance Criteria:**
- Full lifecycle test: create → submit → approve → (wait cooldown) → activate
- Four-eyes principle enforced (creator cannot approve own rule)
- Emergency override creates distinguished audit entry
- Rejected rules cannot be resubmitted (create new draft instead)
- Only one active rule at any time (database constraint enforced)

### FR-4: Atomic Daily Spending Counter (G-4)

**Context**: Bridgebuilder finding low-2 identified a get-then-set race condition in `AgentWalletPrototype.ts` for daily spending. Under concurrent finalization, two operations can interleave and lose an update.

**Correctness Model: SQLite-Authoritative with Redis Acceleration**

Daily spending enforcement is **correctness-critical** (spending limits prevent real-money loss). Therefore:
- **SQLite is the authoritative source** for daily spending totals, updated transactionally during finalize
- **Redis INCRBY is an acceleration layer** for fast reads and atomic increments in the hot path
- **On Redis failure**: Fall back to SQLite read (higher latency, still correct). Do NOT fall back to in-memory Map for enforcement decisions.
- **In-memory Map**: Retained only for unit tests and prototype mode (no Redis, no SQLite spending table). Production mode MUST use SQLite or Redis.
- **Reconciliation**: Periodic job syncs Redis counter to SQLite total. On mismatch, SQLite wins.

This resolves the contradiction between "Redis is cache only" and "zero lost updates" — Redis is acceleration, SQLite is truth.

**Requirements:**

1. **Add `daily_agent_spending` table** to SQLite (agent_account_id, date, total_spent_micro, updated_at)
2. **Update finalize to write SQLite spending** transactionally (same transaction as ledger entries)
3. **Use Redis INCRBY** for atomic counter updates in the hot path
   - Use `INCRBY` + `EXPIRE` for new keys (set TTL at midnight UTC)
4. **Daily cap check reads Redis first, falls back to SQLite** (not in-memory)
5. **Provide both sync and async `getRemainingDailyBudget`** (Bridgebuilder low-1)
   - `getRemainingDailyBudgetSync()` — reads in-memory Map only (test/prototype mode)
   - `getRemainingDailyBudget()` — reads Redis first, falls back to SQLite (production mode)
6. **Document the breaking change** in a migration note
7. **Redis client interface update** — add `incrby` to `AgentRedisClient`

**Acceptance Criteria:**
- Concurrent finalization test: 10 parallel finalizations, daily spending = sum of all costs
- SQLite `daily_agent_spending` table is authoritative and updated transactionally
- Redis INCRBY used for hot-path acceleration
- Redis failure falls back to SQLite read (not in-memory)
- Both sync and async budget queries available
- Existing tests continue to pass

### FR-5: Identity Anchor Cross-System Verification (G-5)

**Context**: Bridgebuilder strategic finding identified the identity-economy bridge. Agent wallets have identity anchors from loa-hounfour's sybil resistance, but verification only happens locally in `AgentWalletPrototype.verifyIdentityBinding()`.

**Trust Model:**

The identity anchor is a hash derived from the agent's NFT identity (tokenId + owner address + optional loa-hounfour attestation). The trust chain is:

1. **Binding**: When an agent wallet is created in arrakis, the identity anchor is computed and stored in the `agent_wallets` table (or equivalent). This is the **authoritative source of truth** — arrakis DB is canonical.
2. **Attestation**: The anchor is included in the **S2S finalize request body** (not JWT claims — the JWT authenticates the service, the body carries the payload). The anchor is signed implicitly by the S2S JWT signature over the request.
3. **Verification**: On finalize, arrakis verifies: (a) S2S JWT is valid (loa-finn's service identity), (b) `account_id` in body matches a real account, (c) if account has an identity anchor stored, the `identity_anchor` in the request body MUST match. Mismatch → reject with 403.
4. **Uniqueness**: Identity anchors have a UNIQUE constraint in the DB. One anchor = one agent wallet. No collision, no reuse.
5. **Rotation**: Anchor rotation requires admin approval (same four-eyes pattern as revenue rules). Old anchor is invalidated, new anchor bound.

**Requirements:**

1. **Include identity anchor in S2S finalize request body** (not JWT claims) — the JWT authenticates the service; the body carries agent-specific data
2. **Verify identity anchor on finalize** — arrakis checks request body `identity_anchor` against stored anchor for the `account_id`; mismatch → 403 Forbidden
3. **UNIQUE constraint on identity anchors** in the database — prevents anchor collision/reuse
4. **Anchor rotation endpoint** — `POST /admin/billing/agents/:id/rotate-anchor` with four-eyes approval
5. **Sybil detection query** — admin endpoint to check anchor distribution patterns

**Acceptance Criteria:**
- Finalize with correct anchor succeeds; finalize with wrong anchor returns 403
- Duplicate anchor creation rejected by DB constraint
- Anchor rotation creates audit log entry
- E2E smoke test includes identity anchor verification flow
- Anchor travels in request body only (not duplicated in JWT claims)

### FR-6: Admin Contract Extraction (G-6)

**Context**: Bridgebuilder finding low-3 noted that billing-admin-routes.ts defines inline Zod schemas while billing-routes.ts imports from the contracts file.

**Requirements:**

1. **Create `admin-billing.ts`** in `packages/core/contracts/`
2. **Extract all admin Zod schemas** from billing-admin-routes.ts
3. **Import extracted schemas** in billing-admin-routes.ts
4. **Export TypeScript types** derived from the Zod schemas

**Acceptance Criteria:**
- Zero inline Zod schema definitions in billing-admin-routes.ts
- All admin endpoints use imported schemas from contracts file
- Types exported for cross-service consumption
- Existing admin tests pass without modification

### FR-7: Revenue Rules Change Notifications (G-7)

**Context**: When revenue splits change, stakeholders (community admins, foundation) need to be informed.

**Requirements:**

1. **Event emission** on rule state transitions (activated, emergency-activated, rejected)
2. **Notification targets**: In-database notification records (webhook delivery is future work)
3. **Notification schema**: rule_id, transition, old_splits, new_splits, timestamp, actor_id
4. **Admin view**: GET endpoint to list recent notifications

**Acceptance Criteria:**
- Rule activation creates notification records for affected stakeholders
- Emergency activation creates urgent notification with justification
- Notifications include before/after bps splits for transparency
- Admin can query notification history

---

## 6. Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Redis INCRBY atomicity | Zero lost updates under 100 concurrent ops | Production concurrency safety |
| E2E smoke test duration | < 30 seconds | CI pipeline friendliness |
| Protocol compatibility check | < 100ms at startup | No startup latency impact |
| Revenue rule cooldown | 48 hours (configurable) | Governance safety margin |
| Audit log immutability | Append-only, no updates/deletes | Financial compliance |
| Test coverage | 100% of new code paths | Maintain cycle-025 quality bar |

---

## 7. Technical Constraints

1. **SQLite single-writer**: All billing writes go through SQLite's write lock. SQLite is the authoritative source for financial state.
2. **Redis role**: Acceleration layer for hot-path reads and atomic counters (INCRBY). NOT authoritative — SQLite wins on conflict. Daily spending enforcement falls back to SQLite on Redis failure (not in-memory).
3. **loa-hounfour dependency**: Vendored snapshot (hard dependency at build time). No graceful degradation needed — types are always available.
4. **Existing test suite**: All 109 existing tests must continue passing
5. **Branch strategy**: Continue on `feature/billing-payments-release` (PR #63) or create new branch
6. **No Stripe/Paddle**: BVI entity constraint remains. Crypto-native only.
7. **Admin auth**: JWT `sub` is the canonical actor identity. Audit log actor_id MUST come from authenticated JWT, never from request body.

---

## 8. Out of Scope

| Item | Reason |
|------|--------|
| NOWPayments sandbox testing | Requires external account creation (human dependency) |
| x402 micropayment integration | Requires Coinbase CDP account (human dependency) |
| On-chain TBA interaction | ERC-6551 V2 scope |
| Credit marketplace | V2 scope |
| Kubernetes deployment | Current infra is Fly.io |
| UI/dashboard for revenue rules | API-first, UI is future cycle |

---

## 9. Sprint Structure (Proposed)

| Sprint | Focus | Priority | Dependencies |
|--------|-------|----------|-------------|
| 1 | loa-hounfour protocol adoption + type alignment | P0 (G-1) | loa-hounfour PR #1 types available |
| 2 | Revenue Rules admin workflow (full lifecycle API) | P0 (G-3) | Sprint 1 (protocol types) |
| 3 | Atomic Redis counter + sync/async budget variants | P1 (G-4) | None |
| 4 | Admin contract extraction + notification system | P1 (G-6, G-7) | Sprint 2 (admin routes) |
| 5 | Identity anchor cross-system verification | P1 (G-5) | Sprint 1 (protocol types) |
| 6 | Cross-system E2E smoke test (Docker compose) | P0 (G-2) | Sprints 1, 2, 5 |

**Estimated new tests:** 60-80
**Estimated files changed:** 25-35

---

## 10. Success Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| S-1 | `validateCompatibility()` passes at service startup | Unit test + startup log |
| S-2 | Revenue rule full lifecycle completes via API | Integration test |
| S-3 | Concurrent Redis counter test passes (10 parallel ops) | Concurrency test |
| S-4 | E2E smoke test completes in Docker Compose | CI green |
| S-5 | Identity anchor verified across arrakis ↔ loa-finn | E2E test |
| S-6 | All 109 existing tests + 60+ new tests pass | Test suite |
| S-7 | Zero local type duplicates of loa-hounfour exports | Code audit |

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| loa-hounfour PRs not merged | Medium | High | Use git submodule or vendored types as fallback |
| Protocol version mismatch between repos | Medium | Medium | `validateCompatibility()` at startup prevents silent drift |
| Docker Compose E2E flaky in CI | Medium | Low | Retry logic + health check waits |
| Revenue rules cooldown too aggressive for testing | Low | Low | Configurable cooldown (0 for tests, 48h for production) |
| Identity anchor adds latency to S2S flow | Low | Low | Anchor verification is a string comparison, negligible |

---

## 12. Appendix: Bridgebuilder FLATLINE Context

The Bridgebuilder review of PR #63 (Iteration 1) achieved FLATLINE with the following assessment:

> "This PR has grown from a credit ledger prototype into a production-grade billing system with 109 passing tests across 9 test files. The three findings above are all LOW severity — the architecture is sound, the invariants are database-enforced, and the governance model is ready for real revenue rule changes."

The three LOW findings directly inform this cycle:
- **low-1** (sync→async breaking change) → G-4
- **low-2** (Redis non-atomic counter) → G-4
- **low-3** (admin contract extraction) → G-6

The two strategic findings from the deep review inform the remaining goals:
- **Identity-economy bridge** → G-5
- **Redis primitive extraction** → G-4

This cycle completes what the Bridgebuilder called "building the doors for the cathedral."

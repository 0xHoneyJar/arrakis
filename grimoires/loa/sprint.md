# Sprint Plan: The Stillsuit — Cross-System Integration & Revenue Rules

**Version:** 1.0.0
**Cycle:** 026
**PRD:** [The Stillsuit PRD v1.0.0](prd.md)
**SDD:** [The Stillsuit SDD v1.0.0](sdd.md)
**Sprints:** 6
**Estimated New Tests:** 70

---

## Sprint 1: Protocol Adoption — Vendored loa-hounfour Types

**Goals:** G-1
**SDD Refs:** §2.1
**Dependencies:** None

### Tasks

#### Task 1.1: Create vendored protocol directory
- Create `themes/sietch/src/packages/core/protocol/` directory structure
- Copy billing types from loa-hounfour (pinned commit): `billing-types.ts`, `guard-types.ts`, `state-machines.ts`, `arithmetic.ts`, `compatibility.ts`
- Create `index.ts` re-export barrel
- Create `VENDORED.md` with pinned commit hash and upgrade instructions
- **AC:** Directory exists with all type files. `VENDORED.md` documents commit hash.

#### Task 1.2: Map local types to protocol types
- Update `ICreditLedgerService` to extend/import `CreditBalance` from protocol types
- Update `IRevenueRulesService` to use protocol state machine definitions
- Update `IPaymentService` to use shared `GuardResult` type
- Ensure all adapters compile against updated port interfaces
- **AC:** All 6 port interfaces import from `protocol/` where applicable. Zero local duplicates of protocol exports.

#### Task 1.3: Replace local arithmetic with shared helpers
- Replace any local BigInt micro-USD helpers with `protocol/arithmetic.ts` exports
- Update `RevenueDistributionService` to use shared arithmetic
- Update `CreditLedgerAdapter` lot calculations
- **AC:** No local BigInt arithmetic that duplicates protocol helpers. Existing tests pass.

#### Task 1.4: Implement cross-service compatibility check
- loa-finn `/health` is a **public endpoint** (no auth required — standard health check convention)
- `/health` response includes `{ protocol_version: "4.6.0" }` field
- Add `validateCompatibility()` call at startup: fetch loa-finn `/health`, extract `protocol_version`, compare against vendored version
- Log protocol version at startup
- Graceful handling if loa-finn is unreachable (log warning, don't crash — compatibility is validated on first authenticated S2S call using the S2S JWT trust boundary)
- **Note:** The `/health` check validates version agreement only. The actual S2S trust boundary (ES256 JWT validation) is tested separately in Sprint 6 E2E.
- **AC:** Startup log shows protocol version. `validateCompatibility()` test passes with matching versions, fails with mismatched. Unreachable loa-finn logs warning without crashing.

#### Task 1.5: Protocol adoption tests
- Test type compatibility (local types satisfy protocol interfaces)
- Test arithmetic helpers match existing behavior
- Test compatibility validator with matching and mismatched versions
- **AC:** 8 new tests pass. All 109 existing tests still pass.

---

## Sprint 2: Revenue Rules Admin Workflow

**Goals:** G-3
**SDD Refs:** §2.2, §2.6, §4.1
**Dependencies:** Sprint 1 (protocol types for state machine definitions)

### Tasks

#### Task 2.1: Audit log immutability triggers
- Create migration `038_audit_immutability.ts`
- Pre-check: verify `revenue_rule_audit_log` table exists (created in 035_revenue_rules)
- Add `BEFORE UPDATE` trigger on `revenue_rule_audit_log` → ABORT with "audit log is immutable"
- Add `BEFORE DELETE` trigger on `revenue_rule_audit_log` → ABORT with "audit log is immutable"
- **Note:** Migration runner uses numeric prefix ordering (030 → 032 → 035 → 036 → 037 → 038 → 039). All base tables exist before triggers are applied.
- **AC:** Attempting UPDATE/DELETE on audit log raises SQLite error.

#### Task 2.2: Revenue rules lifecycle endpoints
- POST `/admin/billing/revenue-rules` — create draft (validate bps_sum_100, set `created_by` from JWT `sub`)
- POST `/admin/billing/revenue-rules/:id/submit` — transition to pending_approval
- POST `/admin/billing/revenue-rules/:id/approve` — transition to cooling_down (four-eyes: JWT `sub` != `created_by`)
- POST `/admin/billing/revenue-rules/:id/activate` — transition to active (cooldown expired check)
- POST `/admin/billing/revenue-rules/:id/reject` — transition to rejected (requires reason)
- POST `/admin/billing/revenue-rules/:id/emergency-activate` — override cooldown (requires `admin:rules:emergency` scope + justification)
- GET `/admin/billing/revenue-rules` — list with status filter
- GET `/admin/billing/revenue-rules/:id/audit` — full audit trail
- **AC:** All 8 endpoints respond correctly. State machine transitions enforced. Invalid transitions return 409.

#### Task 2.3: Four-eyes enforcement
- Approve endpoint: compare JWT `sub` against `created_by` field
- Same actor → 403 `four_eyes_violation`
- Different actor → proceed
- Audit log records both `created_by` and `approved_by` with correlation ID
- **AC:** Test: same-actor approve returns 403. Different-actor approve succeeds. Audit log has both IDs.

#### Task 2.4: Admin JWT validation hardening
- Validate `iss` = `arrakis-admin`, `aud` = `arrakis-billing-admin`, `exp` present, `sub` present
- Reject JWTs missing any required claim
- Ensure admin secret is separate from S2S secret (already ADR-003, verify in tests)
- **AC:** JWT missing `iss`, `aud`, `exp`, or `sub` returns 401. Wrong `iss`/`aud` returns 401.

#### Task 2.5: Notification system
- Create migration `039_billing_notifications.ts` (separate from audit triggers to avoid coupling)
- `billing_notifications` table with: id, rule_id, transition, old_splits, new_splits, actor_id, urgency, created_at
- Create notifications on `activate` and `emergency-activate` transitions
- Emergency activations → `urgency = 'urgent'`
- GET `/admin/billing/notifications` endpoint
- **AC:** Migration runs. Activation creates notification. Emergency creates urgent notification. GET returns history.

#### Task 2.6: Revenue rules admin tests
- Full lifecycle: create → submit → approve → (mock cooldown) → activate
- Four-eyes violation test
- Emergency override test
- Rejection test
- Audit immutability trigger test
- Notification creation tests
- **AC:** 15 new tests pass.

---

## Sprint 3: Atomic Daily Spending Counter

**Goals:** G-4
**SDD Refs:** §2.3, §3.1
**Dependencies:** None (can run parallel with Sprint 2)
**Note:** Sprint 6 (E2E) depends on this sprint for cap enforcement behavior.

### Tasks

#### Task 3.1: Create daily_agent_spending migration
- Create migration `036_daily_agent_spending.ts`
- Table: `daily_agent_spending(agent_account_id, spending_date, total_spent_micro, updated_at)`
- Primary key: `(agent_account_id, spending_date)`
- Foreign key to `credit_accounts(id)`
- **AC:** Migration runs. Table exists with correct schema.

#### Task 3.2: Update finalize to write SQLite spending
- In `AgentWalletPrototype.finalizeInference()`:
  - Within `BEGIN IMMEDIATE` transaction (same as ledger entries)
  - UPSERT `daily_agent_spending` with atomic increment: `ON CONFLICT DO UPDATE SET total_spent_micro = total_spent_micro + excluded.total_spent_micro`
  - Cap enforcement: if total + actual > dailyCap, cap to remaining budget
- **AC:** Finalize updates daily spending table. Capping works when budget exceeded.

#### Task 3.3: Redis INCRBY with atomic TTL
- Extend `AgentRedisClient` with `incrby` and `eval` methods
- After SQLite commit, run Lua script: `INCRBY` + `EXPIREAT` on first write (detect new key by comparing return to increment)
- TTL set to next midnight UTC
- **AC:** Redis key created with correct TTL. INCRBY returns correct accumulated value.

#### Task 3.4: Update read path (Redis → SQLite fallback)
- `reserveForInference`: try Redis GET, fall back to SQLite SELECT (not in-memory)
- `getRemainingDailyBudget()`: Redis first, SQLite fallback
- `getRemainingDailyBudgetSync()`: in-memory Map only (test/prototype mode)
- Remove in-memory Map from production enforcement path
- **AC:** Redis failure falls back to SQLite. In-memory only used in sync variant.

#### Task 3.5: Concurrent spending tests
- 10 parallel finalizations test: total daily spending = sum of all costs
- Redis failure fallback test: spending enforcement works via SQLite
- Cap enforcement at finalize: actual cost capped when budget exceeded
- Sync vs async budget query tests
- **AC:** 8 new tests pass. Existing agent wallet tests pass.

---

## Sprint 4: Admin Contract Extraction & Notifications

**Goals:** G-6, G-7
**SDD Refs:** §2.5, §2.7
**Dependencies:** Sprint 2 (admin routes exist)

### Tasks

#### Task 4.1: Create admin-billing.ts contracts file
- Create `packages/core/contracts/admin-billing.ts`
- Extract all Zod schemas from `billing-admin-routes.ts`:
  - `createRuleSchema`, `rejectRuleSchema`, `emergencyActivateSchema`
  - `batchGrantSchema`, `adminMintSchema`
  - Revenue rules query/filter schemas
- Export TypeScript types via `z.infer<>`
- **AC:** All Zod schemas in admin contracts file. Zero inline schemas in billing-admin-routes.ts.

#### Task 4.2: Update billing-admin-routes.ts to import contracts
- Replace all inline Zod schema definitions with imports from `admin-billing.ts`
- Verify all endpoints use imported schemas
- **AC:** `billing-admin-routes.ts` has zero inline Zod `z.object()` definitions. All imports from contracts file.

#### Task 4.3: Contract type exports for cross-service
- Export `CreateRuleRequest`, `RejectRuleRequest`, `EmergencyActivateRequest` types
- Export `BatchGrantRequest`, `AdminMintRequest` types
- **AC:** Types importable from contracts file. TypeScript compilation succeeds.

#### Task 4.4: Admin contract tests
- Schema validation tests (valid inputs pass, invalid reject)
- Type compatibility tests
- **AC:** 6 new tests pass. All existing admin tests pass.

---

## Sprint 5: Identity Anchor Cross-System Verification

**Goals:** G-5
**SDD Refs:** §2.4, §4.2
**Dependencies:** Sprint 1 (protocol types)

### Tasks

#### Task 5.1: Create agent identity migration
- Create migration `037_agent_identity.ts`
- Table: `agent_identity_anchors(agent_account_id, identity_anchor, created_by, created_at, rotated_at, rotated_by)`
- `created_by` TEXT NOT NULL — actor who bound the anchor (admin JWT `sub` or system for auto-creation)
- UNIQUE constraint on `identity_anchor`
- Foreign key to `credit_accounts(id)`
- **AC:** Migration runs. UNIQUE constraint enforced (duplicate anchor insert fails). `created_by` is required.

#### Task 5.2: Persist identity anchor on wallet creation
- Update `AgentWalletPrototype.createAgentWallet()` to INSERT anchor into `agent_identity_anchors` when config has `identityAnchor`
- Idempotent: if anchor already exists for account, skip insert
- **AC:** Creating wallet with anchor persists to DB. Duplicate creation is idempotent.

#### Task 5.3: S2S finalize identity verification
- Update S2S finalize handler in `billing-routes.ts`:
  - Derive `accountId` from `reservationId` (not from request body)
  - Look up stored anchor for derived account
  - If stored anchor exists and request omits `identity_anchor` → 403
  - If stored anchor exists and request anchor doesn't match → 403
  - If no stored anchor → skip verification (non-agent accounts)
- Update `s2sFinalizeRequestSchema`: remove `accountId`, keep optional `identity_anchor`
- **AC:** Correct anchor → 200. Wrong anchor → 403. Missing anchor when required → 403. No anchor stored → skip.

#### Task 5.4: Anchor rotation endpoint
- POST `/admin/billing/agents/:id/rotate-anchor`
- Requires `admin:rules:write` scope
- Four-eyes: JWT `sub` (rotator) must differ from `created_by` in `agent_identity_anchors` table
- Same actor → 403 `four_eyes_violation`
- Updates `identity_anchor`, `rotated_at`, `rotated_by` in `agent_identity_anchors`
- Creates audit log entry with old_anchor_hash (truncated) and new_anchor
- **AC:** Rotation succeeds with different actor. Same-actor rotation returns 403. Audit log records rotation with both actor IDs.

#### Task 5.5: Identity anchor tests
- Anchor persistence on wallet creation
- UNIQUE constraint violation test
- S2S finalize with correct/wrong/missing anchor
- Anchor rotation with audit trail
- **AC:** 8 new tests pass.

---

## Sprint 6: Cross-System E2E Smoke Test

**Goals:** G-2
**SDD Refs:** §1.3, §6.3
**Dependencies:** Sprints 1, 2, 3, 5 (protocol types, admin API, daily spending cap enforcement, identity anchors)

### Tasks

#### Task 6.1: Docker Compose infrastructure
- Create `docker-compose.e2e.yml` with:
  - `arrakis` container (includes SQLite, ES256 private key for tenant JWT, loa-finn public key)
  - `loa-finn` container (ES256 private key for S2S JWT, arrakis public key)
  - `redis` service (shared on Compose network)
- Health check probes on `/health` for both services
- Volume mounts for ES256 keys (read-only for public keys)
- Compose env vars: `REDIS_URL`, `BILLING_MODE`, `CHAIN_PROVIDER=rpc` configured in `.env.e2e`
- **AC:** `docker compose -f docker-compose.e2e.yml up` starts all services. Arrakis logs confirm Redis spending backend enabled.

#### Task 6.2: Key generation script
- Create `scripts/e2e-keygen.sh`
- Generates ES256 keypairs for arrakis (tenant JWT) and loa-finn (S2S JWT)
- Outputs to `e2e/keys/` directory
- **AC:** Script generates 4 files: arrakis private/public, loa-finn private/public.

#### Task 6.3: Test data seeding script
- Create deterministic seed script: creates test account, deposits credits
- Idempotent (can run multiple times)
- **AC:** After seeding, test account exists with known balance.

#### Task 6.4: E2E smoke test script
- **Verification method**: Use existing admin API endpoints for assertions (GET `/admin/billing/reconciliation` for ledger state, GET `/admin/billing/revenue-rules` for rule state). For shadow_finalize verification, query `GET /api/billing/history?accountId={id}` which returns ledger entries with `entry_type` field.
- **Happy path**: create account → deposit → reserve → tenant JWT to loa-finn → S2S finalize back to arrakis → GET history → verify `finalize`, `commons_contribution`, `revenue_share` entries exist with correct amounts
- **Overrun (shadow mode)**: set BILLING_MODE=shadow → reserve 1M → finalize 1.5M → GET history → verify `shadow_finalize` entry with actualCostMicro=1500000
- **Overrun (live mode)**: set BILLING_MODE=live → reserve 1M → finalize 1.5M → GET history → verify `finalize` entry capped at reservedMicro=1000000
- **Identity anchor**: finalize with correct anchor → 200; wrong anchor → 403 response body contains `identity_anchor_mismatch`
- **JWT validation**: expired/invalid JWT → 401 response
- **AC:** All 5 E2E test scenarios pass. Each scenario uses API responses (not log scraping) for assertions.

#### Task 6.5: CI integration
- GitHub Actions workflow for E2E tests
- Key generation in setup step
- Docker Compose up with health check wait
- Run test script
- Tear down
- **AC:** E2E tests run in CI and pass.

---

## Sprint Summary

| Sprint | Focus | Goals | New Tests | Dependencies |
|--------|-------|-------|-----------|-------------|
| 1 | Protocol adoption | G-1 | 8 | None |
| 2 | Revenue rules admin | G-3 | 15 | Sprint 1 |
| 3 | Atomic daily spending | G-4 | 8 | None |
| 4 | Admin contracts + notifications | G-6, G-7 | 6 | Sprint 2 |
| 5 | Identity anchor verification | G-5 | 8 | Sprint 1 |
| 6 | E2E smoke test | G-2 | 5 (E2E) | Sprints 1, 2, 3, 5 |
| **Total** | | | **~70** | |

**Migration ordering:** Numeric prefix (036 → 037 → 038 → 039). All base tables from 030/032/035 exist before new migrations. Audit triggers (038) and notifications (039) are separate migrations to avoid coupling.

**Parallelization:** Sprints 1 and 3 can run in parallel. Sprints 2 and 5 can run in parallel (both depend on Sprint 1). Sprint 4 depends on Sprint 2. Sprint 6 is the integration gate requiring all prior sprints.

**Critical path:** Sprint 1 → Sprint 2 → Sprint 4 → Sprint 6
**Parallel path:** Sprint 1 → Sprint 5 → Sprint 6
**Independent path:** Sprint 3 → Sprint 6

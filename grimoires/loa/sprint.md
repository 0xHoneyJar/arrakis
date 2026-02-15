# Sprint Plan: Billing & Payments — Path to Revenue

**Cycle:** 025
**PRD:** [Billing & Payments PRD v1.3.0](prd.md)
**SDD:** [Billing & Payments SDD v1.2.0](sdd.md)
**Date:** 2026-02-14
**Global Sprint Range:** 230–238

---

## Overview

6 sprints building the complete billing and payments system on top of the existing Arrakis platform. No new services or deployments — all billing logic lives inside the Sietch API (Express) using existing SQLite/Redis/PostgreSQL infrastructure.

| Sprint | Focus | Priority | New Files | Modified Files | Est. Tests |
|--------|-------|----------|-----------|----------------|------------|
| 1 | Credit Ledger Foundation + NOWPayments Smoke | P0 | 8 | 3 | ~25 |
| 2 | x402 Integration + Payment Wiring | P0 | 5 | 4 | ~15 |
| 3 | Shadow Billing + Feature Flag Activation | P0 | 6 | 2 | ~15 |
| 4 | Campaign Engine + Discount System | P1 | 4 | 2 | ~10 |
| 5 | Collab.Land Displacement + GTM Infrastructure | P2 | 3 | 2 | ~5 |
| 6 | Agent Wallet Exploration — ERC-6551 (parallel) | P2 | 2 | 1 | ~5 |
| 7 | Security Hardening & Correctness Fixes | P0 | 2 | 4 | ~12 |
| 8 | Revenue Rules Governance System | P1 | 4 | 2 | ~14 |
| 9 | Documentation, Integration & Agent Identity | P1 | 3 | 3 | ~8 |

**Dependency chain:** Sprint 1 → Sprint 2 → Sprint 3 → Sprint 5. Sprint 4 depends on Sprint 1 only. Sprint 6 is independent. Sprint 7 depends on Sprint 5 (fixes Sprint 5 endpoints). Sprint 8 depends on Sprint 3 (extends revenue distribution). Sprint 9 depends on Sprint 6 (agent identity binding).

**Total estimated tests:** ~109 new tests (conformance, integration, smoke, prototype).

---

## Sprint 1: Credit Ledger Foundation + NOWPayments Smoke

**Global ID:** 230
**Goal:** Core financial infrastructure — the credit ledger that all other sprints build on — plus NOWPayments sandbox validation.
**PRD refs:** §4.1 (Credit Ledger), §4.2 (NOWPayments), §8 Sprint 1
**SDD refs:** §3.2 Migration 030, §3.5 Drizzle Schema, §1.4 CreditLedgerService, §1.5.1 FIFO Algorithm, §1.5.2 Reservation State Machine, §3.1 SQLite Write Throughput SLOs

### Task 1.1: Migration 030 — Credit Ledger Tables

**Description:** Create SQLite migration with all core financial tables: `credit_accounts`, `credit_lots` (with `consumed_micro` + CHECK constraints), `credit_balances`, `credit_ledger`, `credit_account_seq`, `credit_reservations`, `reservation_lots`, `credit_debts`.

**File:** `themes/sietch/src/db/migrations/030_credit_ledger.ts`

**Acceptance Criteria:**
- [ ] All 8 tables created with correct schema matching SDD §3.2
- [ ] `lot_invariant` CHECK: `available_micro + reserved_micro + consumed_micro = original_micro`
- [ ] `lot_balance` CHECK: all three fields >= 0
- [ ] Partial unique index `idx_credit_lots_source` on `(source_type, source_id) WHERE source_id IS NOT NULL`
- [ ] Partial index `idx_credit_reservations_expiry` on `(expires_at) WHERE status = 'pending'`
- [ ] `credit_account_seq` table with `(account_id, pool_id)` PK
- [ ] `credit_reservations` with status CHECK `('pending', 'finalized', 'released', 'expired')`
- [ ] `credit_debts` with `positive_debt` CHECK `(debt_micro > 0)`
- [ ] Migration runs cleanly on fresh SQLite database
- [ ] **Rollback/down path**: DOWN function drops all 8 tables in reverse dependency order; documented restore-from-backup steps (SDD §3.3 pattern)
- [ ] **Idempotency table**: `billing_idempotency_keys` table with `(scope TEXT, idempotency_key TEXT, response_hash TEXT, created_at, expires_at)` and `UNIQUE(scope, idempotency_key)` constraint, TTL 24h default

**Estimated effort:** Medium
**Dependencies:** None
**Testing:** Migration applied + rollback verified in conformance test setup

### Task 1.2: Drizzle Schema Definitions

**Description:** Create Drizzle ORM schema for all billing tables using `integer(name, { mode: 'bigint' })` for monetary columns.

**File:** `themes/sietch/src/db/schema/billing.ts`

**Acceptance Criteria:**
- [ ] `microUSD` helper: `const microUSD = (name: string) => integer(name, { mode: 'bigint' })`
- [ ] All 8 tables defined matching SDD §3.5
- [ ] Comments documenting partial indexes created via migration-only (not in Drizzle)
- [ ] All table exports available for import
- [ ] TypeScript compiles with no errors

**Estimated effort:** Small
**Dependencies:** Task 1.1
**Testing:** Type-checks verified in conformance tests

### Task 1.3: BigInt Safety Utilities

**Description:** Create runtime utilities for BigInt precision safety: `assertMicroUSD()` guard, Zod schemas with `z.coerce.bigint()`, BigInt-to-string JSON serialization helper.

**File:** `themes/sietch/src/packages/core/utils/micro-usd.ts`

**Acceptance Criteria:**
- [ ] `assertMicroUSD(value: bigint)` rejects negative and values > ceiling (default 1_000_000_000_000n)
- [ ] `serializeBigInt(obj)` converts all bigint values to strings for JSON responses
- [ ] `microUsdSchema` Zod schema validates bigint from string input
- [ ] Ceiling configurable via `BILLING_CEILING_MICRO` env var (default 1_000_000_000_000n); Sprint 3 adds `billing_config` override
- [ ] Unit tests for all edge cases (0n, negative, MAX_SAFE_INTEGER boundary, ceiling)

**Estimated effort:** Small
**Dependencies:** None
**Testing:** ~5 unit tests

### Task 1.4: ICreditLedgerService Port Definition

**Description:** Define the core credit ledger service interface following existing Ports & Adapters pattern.

**File:** `themes/sietch/src/packages/core/ports/ICreditLedgerService.ts`

**Acceptance Criteria:**
- [ ] `reserve(accountId, poolId, amountMicro, options)` → `ReservationResult`
- [ ] `finalize(reservationId, actualCostMicro)` → `FinalizeResult`
- [ ] `release(reservationId)` → `ReleaseResult`
- [ ] `getBalance(accountId, poolId?)` → `BalanceResult`
- [ ] `getHistory(accountId, options)` → `LedgerEntry[]`
- [ ] `createAccount(entityType, entityId)` → `CreditAccount` (idempotent: returns existing if already exists)
- [ ] `getOrCreateAccount(entityType, entityId)` → `CreditAccount` (convenience wrapper for auto-provisioning)
- [ ] `mintLot(accountId, amountMicro, source, options)` → `CreditLot`
- [ ] All types use `bigint` for monetary values
- [ ] All methods accept `idempotencyKey` option
- [ ] **Pool taxonomy defined**: `PoolId` type with known pools: `'general'` (default, unrestricted), `'campaign:{campaignId}'` (restricted to campaign grants), `'agent:{agentId}'` (future agent wallets). Pool creation/ownership rules documented in type comments. Default pool is `'general'` when `poolId` omitted.

**Estimated effort:** Small
**Dependencies:** Task 1.3
**Testing:** Interface-level type tests

### Task 1.4b: Cost Estimation & Pricing Configuration

**Description:** Define the pricing table and cost estimation logic that `reserve()` needs to calculate `amountMicro`. Without this, Sprint 3 billing middleware cannot operate.

**File:** `themes/sietch/src/packages/core/utils/cost-estimator.ts`

**Acceptance Criteria:**
- [ ] `estimateCost(model, maxTokens, poolId?)` → `{ estimatedMicro: bigint, safetyMultiplier: number }`
- [ ] Pricing table: per-model token rates stored as `price_per_1k_input_micro` / `price_per_1k_output_micro`
- [ ] Safety multiplier (default 1.2x) ensures reserve covers worst-case token usage
- [ ] Rounding: `ceil()` on all cost calculations (never under-reserve)
- [ ] Pricing data loaded from `BILLING_PRICING_JSON` env var (Sprint 3 switches to `billing_config` table)
- [ ] Default pricing for at least: gpt-4o, claude-sonnet-4-5, claude-opus-4-5

**Estimated effort:** Small
**Dependencies:** Task 1.3 (microUSD utilities)
**Testing:** ~3 unit tests (estimation accuracy, rounding, safety multiplier)

### Task 1.5: CreditLedgerAdapter Implementation

**Description:** Implement the credit ledger service with SQLite writes and Redis balance cache. This is the largest task in Sprint 1 — the core financial logic.

**File:** `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts`

**Acceptance Criteria:**
- [ ] `reserve()`: FIFO lot selection per SDD §1.5.1 SQL ordering (pool-restricted first, expiring first, oldest first)
- [ ] `reserve()`: `BEGIN IMMEDIATE` transaction wrapping lot selection + reservation creation + lot updates
- [ ] `reserve()`: Creates `credit_reservations` record (status='pending') + `reservation_lots` records
- [ ] `reserve()`: Entry_seq allocation via `credit_account_seq` counter (UPDATE + SELECT within same `BEGIN IMMEDIATE` transaction; avoids RETURNING clause for SQLite compat)
- [ ] `finalize()`: Transitions reservation to 'finalized', converts reserved→consumed on lots
- [ ] `finalize()`: Idempotent — duplicate finalize with same reservation_id returns existing result (keyed on `(account_id, 'finalize', reservation_id)` in `billing_idempotency_keys` table)
- [ ] `finalize()`: Conflicting finalize (different actual_cost_micro) returns 409
- [ ] `finalize()`: Cost overrun handling per billing mode (SDD §1.5.3)
- [ ] `release()`: Transitions reservation to 'released', returns reserved→available on lots
- [ ] `release()`: Rejects release of non-pending reservations
- [ ] Redis balance cache write-through on every write operation (best-effort: SQLite is sole source of truth for enforcement decisions)
- [ ] **Redis failure handling**: 500ms connect timeout, 200ms command timeout; on Redis failure, skip cache update + mark stale + log warning; enforcement reads fall back to SQLite `SUM(credit_lots)` query
- [ ] SQLite BUSY retry with exponential backoff (10ms, 50ms, 200ms — max 3 attempts)
- [ ] **WAL mode** enabled with `PRAGMA busy_timeout = 5000` for write concurrency
- [ ] All monetary arithmetic uses `BigInt` — no `Number` conversions

**Estimated effort:** Large
**Dependencies:** Tasks 1.1–1.4
**Testing:** ~15 conformance tests (Task 1.7)

### Task 1.6: Reservation Sweeper

**Description:** BullMQ background job that releases expired reservations.

**File:** `themes/sietch/src/jobs/reservation-sweeper.ts`

**Acceptance Criteria:**
- [ ] Runs every 60 seconds via BullMQ repeatable job
- [ ] Only sweeps reservations with `status='pending'` AND `expires_at < now()`
- [ ] Transitions expired reservations to 'expired' status
- [ ] Returns reserved amounts to lot `available_micro`
- [ ] Updates Redis balance cache after release
- [ ] Logs each sweep result: `{ event: 'billing.sweep', expired_count, duration_ms }`

**Estimated effort:** Small
**Dependencies:** Task 1.5
**Testing:** 1 conformance test (`reservation-ttl-sweep`)

### Task 1.7: Conformance Test Suite

**Description:** Financial invariant tests verifying correctness of the credit ledger.

**File:** `tests/conformance/credit-ledger.test.ts`

**Acceptance Criteria:**
- [ ] `reserve-fifo-order`: Pool-restricted first, expiring first, oldest first
- [ ] `reserve-atomic-lot-selection`: 10 concurrent reserves produce no balance corruption
- [ ] `reserve-sqlite-busy-retry`: SQLITE_BUSY triggers backoff, succeeds within 3 retries
- [ ] `finalize-deterministic`: Finalize allocates across lots in same FIFO order
- [ ] `finalize-surplus-release`: Y < X releases surplus correctly
- [ ] `finalize-overrun-shadow`: Y > X in shadow mode logs without impact
- [ ] `finalize-overrun-soft`: Y > X in soft mode allows negative balance
- [ ] `finalize-overrun-live`: Y > X in live mode caps at reserved amount
- [ ] `entry-seq-monotonic`: Strictly increasing per (account_id, pool_id)
- [ ] `idempotency-reserve`: Duplicate reservation returns existing
- [ ] `idempotency-finalize`: Duplicate finalize returns success, no double debit
- [ ] `lot-invariant`: `available + reserved + consumed = original` always holds
- [ ] `balance-cache-consistency`: credit_balances matches SUM(credit_lots)
- [ ] `zero-sum-distribution`: Revenue entries sum to zero (placeholder for Sprint 3)
- [ ] `reservation-ttl-sweep`: Expired reservations released by sweeper

**Estimated effort:** Large
**Dependencies:** Tasks 1.5, 1.6
**Testing:** ~15 conformance tests

### Task 1.8: NOWPayments Sandbox Smoke Tests

**Description:** Validate NOWPayments sandbox integration including webhook HMAC verification.

**File:** `tests/smoke/nowpayments-sandbox.test.ts`

**Acceptance Criteria:**
- [ ] `create-payment`: Payment created, returns pay_address and amount
- [ ] `webhook-signature-verify`: Determine which HMAC strategy (A: raw body, B: sorted-key) the sandbox uses and **implement the chosen strategy** in `NOWPaymentsAdapter` (single-strategy enforcement per SDD §1.8)
- [ ] `webhook-to-deposit`: Finished webhook creates credit_lot + ledger entry
- [ ] `duplicate-webhook`: Second finished webhook is idempotent
- [ ] `refund-webhook`: Refunded webhook triggers clawback
- [ ] Chosen HMAC strategy locked in code with `NOWPAYMENTS_HMAC_STRATEGY` env var (A or B) — Sprint 2 Task 2.2 depends on this
- [ ] All tests require `NOWPAYMENTS_SANDBOX_API_KEY` and `NOWPAYMENTS_SANDBOX_IPN_SECRET` env vars
- [ ] Tests are skipped (not failed) when env vars missing

**Estimated effort:** Medium
**Dependencies:** Task 1.5 (ledger adapter for deposit creation)
**Testing:** ~5 smoke tests

### Task 1.9: SQLite Write Throughput Load Test

**Description:** Validate SQLite write performance meets SDD §3.1 SLOs before proceeding to Sprint 2.

**File:** `tests/performance/sqlite-billing-throughput.test.ts`

**Acceptance Criteria:**
- [ ] Run 50 concurrent reserve/finalize cycles
- [ ] **Include concurrent background job writes** (sweeper + reconciler simulation) alongside reserve/finalize traffic
- [ ] **Include concurrent webhook deposit writes** (5 parallel deposit creations)
- [ ] Measure p50 and p99 latency for reserve and finalize
- [ ] Measure max sustained write TPS
- [ ] **Pass criteria:** p99 reserve < 100ms, p99 finalize < 100ms under mixed load
- [ ] If p99 > 100ms: flag for dedicated writer queue implementation before Sprint 2 (SDD §3.1 escalation step 1)
- [ ] Verify WAL mode + `busy_timeout=5000` is active during test
- [ ] Results logged to stdout for CI visibility

**Estimated effort:** Small
**Dependencies:** Task 1.5
**Testing:** 1 performance test

### Sprint 1 Files

| File | Action | Purpose |
|------|--------|---------|
| `themes/sietch/src/db/migrations/030_credit_ledger.ts` | Create | Core ledger tables |
| `themes/sietch/src/db/schema/billing.ts` | Create | Drizzle schema definitions |
| `themes/sietch/src/packages/core/utils/micro-usd.ts` | Create | BigInt safety utilities |
| `themes/sietch/src/packages/core/ports/ICreditLedgerService.ts` | Create | Credit ledger port |
| `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts` | Create | Ledger implementation |
| `themes/sietch/src/jobs/reservation-sweeper.ts` | Create | Expired reservation cleanup |
| `tests/conformance/credit-ledger.test.ts` | Create | ~15 conformance tests |
| `tests/smoke/nowpayments-sandbox.test.ts` | Create | ~5 smoke tests |
| `tests/performance/sqlite-billing-throughput.test.ts` | Create | Throughput validation |
| `themes/sietch/src/db/schema/index.ts` | Modify | Export billing schema |
| `themes/sietch/src/types/billing.ts` | Modify | Add credit account/lot/ledger types |
| `themes/sietch/package.json` | Modify | Add loa-hounfour v3.0.0 |

**Sprint 1 exit criteria:** All 15 conformance tests pass. 5 smoke tests pass (or skipped if sandbox unavailable). Concurrent reserve test (10 parallel) shows no corruption. Performance test p99 < 100ms.

---

## Sprint 2: x402 Integration + Payment Wiring

**Global ID:** 231
**Goal:** Connect both payment providers (NOWPayments + x402) to the credit ledger. First real money flows.
**PRD refs:** §4.2 (NOWPayments wiring), §4.3 (x402), §8 Sprint 2
**SDD refs:** §3.2 Migration 031, §3.3 Migration 031 Rollback, §1.8 x402 Verification, §5.3 Top-Up Endpoint, §5.7 Auth Model

### Task 2.1: Migration 031 — Crypto Payments V2

**Description:** Extend existing `crypto_payments` table with new columns for credit ledger integration using SQLite table recreation pattern.

**File:** `themes/sietch/src/db/migrations/031_crypto_payments_v2.ts`

**Acceptance Criteria:**
- [ ] Table recreation with `PRAGMA foreign_keys = OFF/ON` wrapping
- [ ] `payment_id TEXT` normal column (NOT generated) populated via `INSERT...SELECT` during migration for backward compat; trigger `trg_payment_id_sync` keeps `payment_id = provider_payment_id` on INSERT/UPDATE (avoids SQLite generated column version dependency)
- [ ] New columns: `account_id`, `amount_usd_micro`, `lot_id`, `raw_payload`
- [ ] `UNIQUE(provider, provider_payment_id)` constraint
- [ ] All migration 021 indexes recreated + new indexes
- [ ] Post-migration verification: row count match, no NULL payment_ids
- [ ] **Pre-migration backup step documented in migration comments** (SDD §3.3 rollback procedure)
- [ ] Data migration via `INSERT...SELECT` preserves all existing records

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (credit_accounts table for FK)
**Testing:** Migration verification in integration tests

### Task 2.2: IPaymentService Port + PaymentServiceAdapter

**Description:** Payment orchestration port and adapter that delegates to NOWPayments and x402.

**Files:**
- `themes/sietch/src/packages/core/ports/IPaymentService.ts`
- `themes/sietch/src/packages/adapters/billing/PaymentServiceAdapter.ts`

**Acceptance Criteria:**
- [ ] `processWebhook(provider, rawBody, signature)` → validates + creates lot
- [ ] `createTopUp(accountId, amountUsd, x402Payment)` → verifies + creates lot
- [ ] `getStatus(paymentId)` → returns payment status
- [ ] `refund(paymentId)` → triggers clawback + debt creation if partially consumed
- [ ] **Refund accounting policy**: Clawback in LIFO order (most recently consumed lots first); creates reversing ledger entries (not lot mutation); `credit_debts` created for `consumed_micro` portion; debt blocks new reserves until repaid (enforcement check in `reserve()`)
- [ ] Payment state machine with allowed transitions (SDD §5.4)
- [ ] Only one HMAC verification strategy deployed (Strategy A or B, determined by Sprint 1 smoke tests)
- [ ] State machine rejects regression transitions (e.g., `finished` → `confirming`)
- [ ] Forward jumps allowed (e.g., `waiting` → `finished`)

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (ICreditLedgerService)
**Testing:** ~5 integration tests

### Task 2.3: X402PaymentAdapter

**Description:** x402 payment verification and top-up processing using `@x402/server`.

**File:** `themes/sietch/src/packages/adapters/billing/X402PaymentAdapter.ts`

**Acceptance Criteria:**
- [ ] Wraps `@x402/server` `verifyPayment()` function
- [ ] 8-point verification per SDD §1.8: chainId=8453, USDC contract, recipient=facilitator, amount match, 12 confirmations, tx status=1, tx hash uniqueness, Transfer event log verification
- [ ] Under-payment rejected; over-payment credits full amount
- [ ] Tx hash stored as `provider_payment_id` with `provider='x402'`
- [ ] `X402_FACILITATOR_ADDRESS`, `X402_USDC_CONTRACT`, `X402_MIN_CONFIRMATIONS` env vars

**Estimated effort:** Medium
**Dependencies:** `@x402/server` package
**Testing:** ~3 integration tests (mock chain data)

### Task 2.4: x402 Express Middleware

**Description:** Express middleware for x402 top-up gate on billing routes.

**File:** `themes/sietch/src/api/middleware/x402-middleware.ts`

**Acceptance Criteria:**
- [ ] Parses `X-402-Payment` header
- [ ] Delegates to `X402PaymentAdapter` for verification
- [ ] Returns 402 with facilitator details if payment missing/insufficient
- [ ] Passes verified payment to next middleware on success

**Estimated effort:** Small
**Dependencies:** Task 2.3
**Testing:** ~2 integration tests

### Task 2.5: Billing Routes Module + POST /api/billing/topup Endpoint

**Description:** Create the full billing routes module with topup endpoint implemented and stub routes for balance/history/pricing/finalize (returning 501 Not Implemented). Sprint 5 replaces stubs with real implementations.

**File:** `themes/sietch/src/api/routes/billing-routes.ts` (Create)

**Acceptance Criteria:**
- [ ] `POST /api/billing/topup` — fully implemented (see below)
- [ ] `GET /api/billing/balance` — stub returning 501 (implemented in Sprint 5)
- [ ] `GET /api/billing/history` — stub returning 501 (implemented in Sprint 5)
- [ ] `GET /api/billing/pricing` — stub returning 501 (implemented in Sprint 5)
- [ ] `POST /api/internal/billing/finalize` — stub returning 501 (implemented in Sprint 5)
- [ ] Topup: Requires JWT auth (existing middleware)
- [ ] Topup: Validates request body with Zod schema
- [ ] Topup: Calls `IPaymentService.createTopUp()`
- [ ] Topup: Returns BigInt-as-string JSON response (SDD §5.3)
- [ ] Rate limited: 10 per minute per account
- [ ] `Idempotency-Key` header support

**Estimated effort:** Small
**Dependencies:** Tasks 2.2, 2.4
**Testing:** ~2 integration tests

### Task 2.6: Wire NOWPayments Webhook to Credit Ledger

**Description:** Extend existing NOWPayments webhook to create credit lots on `finished` status.

**File:** `themes/sietch/src/packages/adapters/billing/NOWPaymentsAdapter.ts` (modify)

**Acceptance Criteria:**
- [ ] On `finished`: Convert `price_amount` to micro-USD, create lot + deposit ledger entry
- [ ] On `refunded`: Clawback lot, create `credit_debts` if partially consumed
- [ ] Deposit idempotency enforced by `idx_credit_lots_source` partial unique index
- [ ] `amount_usd_micro` stored on crypto_payments record
- [ ] Existing webhook behavior preserved for non-billing flows

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (ledger), Task 2.1 (migration 031)
**Testing:** ~3 integration tests

### Task 2.7: Upgrade loa-hounfour to v3.0.0

**Description:** Upgrade shared protocol types package for BigInt billing schemas.

**File:** `themes/sietch/package.json` (modify)

**Acceptance Criteria:**
- [ ] `@0xhoneyjar/loa-hounfour` upgraded from current to v3.0.0
- [ ] `validateCompatibility()` called on startup
- [ ] All existing imports still resolve correctly
- [ ] No type errors from upgrade

**Estimated effort:** Small
**Dependencies:** loa-hounfour PR #1 merged
**Testing:** Existing 109 conformance tests still pass

### Sprint 2 Files

| File | Action | Purpose |
|------|--------|---------|
| `themes/sietch/src/db/migrations/031_crypto_payments_v2.ts` | Create | Extend crypto_payments |
| `themes/sietch/src/packages/core/ports/IPaymentService.ts` | Create | Payment orchestration port |
| `themes/sietch/src/packages/adapters/billing/PaymentServiceAdapter.ts` | Create | Payment orchestration |
| `themes/sietch/src/packages/adapters/billing/X402PaymentAdapter.ts` | Create | x402 verification |
| `themes/sietch/src/api/middleware/x402-middleware.ts` | Create | x402 Express middleware |
| `themes/sietch/src/api/routes/billing-routes.ts` | Create | Balance, history, topup endpoints |
| `themes/sietch/src/packages/adapters/billing/NOWPaymentsAdapter.ts` | Modify | Wire to credit ledger |
| `themes/sietch/package.json` | Modify | Upgrade loa-hounfour |
| `tests/integration/billing-payments.test.ts` | Create | ~15 integration tests |
| `.env.example` | Modify | Add X402_*, BILLING_* vars |

**Sprint 2 exit criteria:** NOWPayments webhook creates lot + deposit. x402 top-up creates lot + deposit. State machine rejects invalid transitions. Refund creates debt record for partially consumed lots. loa-hounfour v3.0.0 integrated.

---

## Sprint 3: Shadow Billing + Feature Flag Activation

**Global ID:** 232
**Goal:** Enable billing in observation mode — shadow charges logged for 7+ days without affecting real balances. Revenue distribution engine operational.
**PRD refs:** §4.4 (Shadow Billing), §4.1.4 (Revenue Distribution), §8 Sprint 3
**SDD refs:** §1.4 BillingMiddleware, §1.5.3 Cost Overrun, §1.4 RevenueDistributionService, §1.4 Background Jobs

### Task 3.1: BillingMiddleware (Mode-Aware)

**Description:** Express middleware stack for billing enforcement on `/invoke` routes. Mode-aware: shadow logs hypothetical charges, soft allows negative balance, live enforces hard limits.

**File:** `themes/sietch/src/api/middleware/billing-guard.ts`

**Acceptance Criteria:**
- [ ] Reads `BILLING_MODE` env var (shadow/soft/live)
- [ ] Shadow mode: logs `shadow_reserve` + `shadow_finalize` entries, proceeds regardless of balance
- [ ] Soft mode: reserves from lots, allows negative balance on overrun
- [ ] Live mode: reserves from lots, rejects if insufficient balance (402)
- [ ] Integrates with `ICreditLedgerService.reserve()` before inference
- [ ] Integrates with `ICreditLedgerService.finalize()` after inference
- [ ] Cost overrun handling per mode (SDD §1.5.3)
- [ ] Overrun alert if > `overrun_alert_threshold_pct` (default 5%)

**Estimated effort:** Medium
**Dependencies:** Sprint 2 (payment wiring complete)
**Testing:** ~4 conformance tests (overrun modes)

### Task 3.2: Shadow Billing Hook

**Description:** Lightweight shadow billing logger for shadow mode that captures hypothetical charges without blocking inference.

**File:** `themes/sietch/src/api/middleware/shadow-billing.ts`

**Acceptance Criteria:**
- [ ] Logs shadow charges with full context (model, tokens, cost, pool)
- [ ] Creates `shadow_reserve` and `shadow_finalize` ledger entries
- [ ] Never blocks or fails the inference request
- [ ] Captures timing data for billing overhead measurement

**Estimated effort:** Small
**Dependencies:** Task 3.1
**Testing:** ~2 integration tests

### Task 3.3: RevenueDistributionService

**Description:** Posts zero-sum revenue distribution entries after every finalization.

**File:** `themes/sietch/src/packages/adapters/billing/RevenueDistributionService.ts`

**Acceptance Criteria:**
- [ ] Calculates: `commons_share = (charge_micro * commons_rate_bps) / 10000n`
- [ ] Calculates: `community_share = (charge_micro * community_rate_bps) / 10000n`
- [ ] Calculates: `foundation_share = charge_micro - commons_share - community_share`
- [ ] All three entries posted in a single SQLite transaction (atomic with finalize)
- [ ] **Wired into `CreditLedgerAdapter.finalize()`** — called within the same `BEGIN IMMEDIATE` transaction; distribution rows absent if finalize rolls back
- [ ] Zero-sum invariant: `commons + community + foundation = charge` (always exact)
- [ ] Rates read from `billing_config` table (basis points) — seeded by Task 3.5
- [ ] **Distribution recipient accounts** (foundation, commons, community) created by Task 3.5 seed step; their `account_id` values stored in `billing_config` as `foundation_account_id`, `commons_account_id`, `community_account_id`
- [ ] Foundation absorbs integer truncation remainder

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (ledger)
**Testing:** ~3 conformance tests

### Task 3.4: Balance Reconciliation Job

**Description:** Periodic job comparing Redis balance cache to SQLite source of truth.

**File:** `themes/sietch/src/jobs/balance-reconciler.ts`

**Acceptance Criteria:**
- [ ] Runs every 5 minutes via BullMQ
- [ ] Compares Redis `balance:{account_id}:{pool_id}` to `SUM(credit_lots)` for top-100 active accounts
- [ ] Corrects drift by overwriting Redis with SQLite values
- [ ] Logs drift events at `warn` level with before/after values
- [ ] Metrics: `{ event: 'billing.reconcile', accounts_checked, drift_found, duration_ms }`

**Estimated effort:** Small
**Dependencies:** Sprint 1 (Redis cache)
**Testing:** ~2 conformance tests

### Task 3.5: DLQ Table + Processor

**Description:** Migration 032 tables (DLQ, audit log, config) + DLQ processor job. Note: Renumbered from SDD §3.2 "Migration 033" to preserve chronological ordering (032 ships in Sprint 3 before 033 ships in Sprint 4).

**Files:**
- `themes/sietch/src/db/migrations/032_billing_ops.ts`
- `themes/sietch/src/jobs/dlq-processor.ts`

**Acceptance Criteria:**
- [ ] Migration 032: `billing_dlq`, `admin_audit_log`, `billing_config` tables created
- [ ] Default config seeded: rates (bps), safety multiplier, reserve TTL, billing mode, ceiling_micro
- [ ] **Distribution account seeding:** Creates 3 `credit_accounts` rows (entity_type='system') for foundation, commons, community; stores their `account_id` values in `billing_config` as `foundation_account_id`, `commons_account_id`, `community_account_id` (idempotent — skips if already exist)
- [ ] DLQ processor: exponential backoff (1min, 5min, 30min), max 3 retries
- [ ] Failed operations moved to `manual_review` status after max retries
- [ ] Logs all DLQ processing attempts

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (ledger)
**Testing:** ~2 integration tests

### Task 3.6: Daily Reconciliation Job

**Description:** Comprehensive daily validation of billing system health.

**File:** `themes/sietch/src/jobs/daily-reconciliation.ts`

**Acceptance Criteria:**
- [ ] Lot balance match: `SUM(available + reserved + consumed) = SUM(original)` across all lots
- [ ] Orphan reservations: no `pending` reservations older than 2x TTL
- [ ] Zero-sum invariant: all distribution triads sum to zero
- [ ] Webhook deposit match: all `finished` crypto_payments have corresponding lots
- [ ] Results stored in `billing_config` for admin endpoint

**Estimated effort:** Small
**Dependencies:** Tasks 3.3, 3.5
**Testing:** ~2 integration tests

### Task 3.7: Feature Flag Activation + Server Wiring

**Description:** Wire billing middleware into Express server and enable with feature flag.

**File:** `themes/sietch/src/api/server.ts` (modify)

**Acceptance Criteria:**
- [ ] `FEATURE_BILLING_ENABLED=true` activates billing middleware on `/invoke` routes
- [ ] `BILLING_MODE=shadow` is the initial deployment mode
- [ ] Billing routes mounted: `/api/billing/*`
- [ ] BullMQ jobs registered: sweeper, reconciler, DLQ processor, daily reconciliation
- [ ] Graceful degradation: billing middleware skips if ledger unavailable
- [ ] Health check includes billing system status

**Estimated effort:** Small
**Dependencies:** All Sprint 3 tasks
**Testing:** ~2 integration tests

### Sprint 3 Files

| File | Action | Purpose |
|------|--------|---------|
| `themes/sietch/src/api/middleware/billing-guard.ts` | Create | Mode-aware billing enforcement |
| `themes/sietch/src/api/middleware/shadow-billing.ts` | Create | Shadow mode logging |
| `themes/sietch/src/packages/adapters/billing/RevenueDistributionService.ts` | Create | Zero-sum posting |
| `themes/sietch/src/jobs/balance-reconciler.ts` | Create | Redis ↔ SQLite sync |
| `themes/sietch/src/db/migrations/032_billing_ops.ts` | Create | DLQ, audit, config tables |
| `themes/sietch/src/jobs/dlq-processor.ts` | Create | Failed operation retry |
| `themes/sietch/src/jobs/daily-reconciliation.ts` | Create | Daily health validation |
| `themes/sietch/src/api/server.ts` | Modify | Mount billing routes + jobs |
| `themes/sietch/src/packages/adapters/billing/index.ts` | Modify | Export new adapters |
| `tests/integration/billing-shadow.test.ts` | Create | ~15 integration tests |

**Sprint 3 exit criteria:** Shadow billing logs charges for all `/invoke` requests. Zero-sum invariant holds for all distributions. Reconciliation detects and corrects drift. DLQ processes failed operations. `FEATURE_BILLING_ENABLED=true` + `BILLING_MODE=shadow` deployed.

---

## Sprint 4: Campaign Engine + Discount System

**Global ID:** 233
**Goal:** Reverse Airdrop infrastructure — grant credits to affected users based on loss data.
**PRD refs:** §4.5 (Reverse Airdrop), §4.6 (Gamification/Discounts), §8 Sprint 4
**SDD refs:** §3.2 Migration 033 (renumbered from SDD's 032 to preserve ordering), §1.4 CampaignService, §5.5 Admin Endpoints, §5.7 Auth Model

### Task 4.1: Migration 032 — Campaign Engine Tables

**Description:** Create campaign and grants tables.

**File:** `themes/sietch/src/db/migrations/033_campaigns.ts`

**Acceptance Criteria:**
- [ ] `credit_campaigns` table with status lifecycle (draft → active → paused → completed → expired)
- [ ] `credit_grants` table with `UNIQUE(campaign_id, account_id)` preventing duplicate grants
- [ ] Indexes on campaign_id and account_id for grant lookups
- [ ] Migration runs cleanly on database with 030+031 already applied

**Estimated effort:** Small
**Dependencies:** Sprint 1 (credit_accounts FK)
**Testing:** Migration verification in integration tests

### Task 4.2: ICampaignService Port + CampaignAdapter

**Description:** Campaign management and batch grant execution.

**Files:**
- `themes/sietch/src/packages/core/ports/ICampaignService.ts`
- `themes/sietch/src/packages/adapters/billing/CampaignAdapter.ts`

**Acceptance Criteria:**
- [ ] `createCampaign(config)` → creates draft campaign
- [ ] `activateCampaign(campaignId)` → transitions to active
- [ ] `batchGrant(campaignId, grants[])` → creates lots with pool restrictions + expiry
- [ ] Grant formula evaluation: `proportional_loss`, `fixed_amount`, `tiered`
- [ ] Budget enforcement: rejects batch if `spent_micro + batch_total > budget_micro`
- [ ] Per-wallet cap enforcement (default $5)
- [ ] Batch size limit: max 1000 per request
- [ ] Each grant creates a lot via `ICreditLedgerService.mintLot()`

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (ledger), Task 4.1
**Testing:** ~5 integration tests

### Task 4.3: Admin Endpoints

**Description:** Admin billing routes with scoped auth, rate limiting, and audit logging.

**File:** `themes/sietch/src/api/routes/billing-admin-routes.ts`

**Acceptance Criteria:**
- [ ] `POST /admin/billing/campaigns/:id/grants/batch` — batch grant creation
- [ ] `POST /admin/billing/accounts/:id/mint` — admin credit mint
- [ ] `GET /admin/billing/reconciliation` — reconciliation status
- [ ] Auth: scoped bearer tokens per SDD §5.7 (JTI replay protection, 1h TTL)
- [ ] **JWT implementation**: HS256 signing with `BILLING_ADMIN_JWT_SECRET` env var; JTI stored in Redis SET with TTL matching token expiry; strict `aud=arrakis-billing-admin` / `iss` validation; clock skew tolerance 30s
- [ ] **Key rotation**: `BILLING_ADMIN_JWT_SECRET_PREV` env var for graceful rotation (accept both during transition)
- [ ] All actions write to `admin_audit_log` with before/after balance snapshots
- [ ] Audit log is **append-only** (no UPDATE/DELETE permissions); includes `actor`, `ip`, `user_agent`, `correlation_id` fields
- [ ] Rate limits enforced per SDD §5.1 rate limits table
- [ ] BigInt-as-string JSON responses

**Estimated effort:** Medium
**Dependencies:** Tasks 4.1, 4.2, Sprint 3 (DLQ + audit tables)
**Testing:** ~5 integration tests

### Task 4.4: Gamified Discount Engine

**Description:** Community membership → discount percentage for inference costs.

**File:** Added to `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts` (extend)

**Acceptance Criteria:**
- [ ] Discount percentage calculated from community membership tier
- [ ] Applied during `reserve()` to reduce reserved amount
- [ ] Discount logged in ledger entry metadata
- [ ] No discount in shadow mode (shadow logs full price)

**Estimated effort:** Small
**Dependencies:** Sprint 1 (ledger)
**Testing:** ~2 integration tests

### Sprint 4 Files

| File | Action | Purpose |
|------|--------|---------|
| `themes/sietch/src/db/migrations/033_campaigns.ts` | Create | Campaign + grants tables |
| `themes/sietch/src/packages/core/ports/ICampaignService.ts` | Create | Campaign port |
| `themes/sietch/src/packages/adapters/billing/CampaignAdapter.ts` | Create | Campaign implementation |
| `themes/sietch/src/api/routes/billing-admin-routes.ts` | Create | Admin endpoints |
| `themes/sietch/src/api/server.ts` | Modify | Mount admin routes |
| `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts` | Modify | Add discount logic |
| `tests/integration/billing-campaigns.test.ts` | Create | ~10 integration tests |

**Sprint 4 exit criteria:** Batch grant creates lots with pool restrictions and expiry. Budget enforcement rejects over-budget batches. Per-wallet cap works. Admin audit log records all actions. Discount engine applies correct discounts.

---

## Sprint 5: Collab.Land Displacement + GTM Infrastructure

**Global ID:** 234
**Goal:** Competitive positioning and operational tooling for go-to-market.
**PRD refs:** §4.7 (Collab.Land Displacement), §8 Sprint 5
**SDD refs:** §5.2 Balance/History Endpoints, §5.5 Reconciliation Endpoint

### Task 5.1: S2S Finalize Endpoint

**Description:** Server-to-server endpoint for loa-finn to report actual usage after inference.

**File:** Added to `themes/sietch/src/api/routes/billing-routes.ts` (extend)

**Acceptance Criteria:**
- [ ] `POST /api/internal/billing/finalize` — accepts reservation_id + actual_cost_micro
- [ ] Auth: Internal JWT per SDD §5.7 (iss=loa-finn, aud=arrakis-internal, 5min TTL)
- [ ] Idempotent on reservation_id
- [ ] Rate limited: 200 per minute per service
- [ ] Returns finalized_micro, released_micro, billing_mode
- [ ] BigInt-as-string JSON response

**Estimated effort:** Small
**Dependencies:** Sprint 3 (billing middleware)
**Testing:** ~3 integration tests

### Task 5.2: Billing Dashboard Data Endpoints

**Description:** Read-only endpoints powering the future billing dashboard with shadow billing summary data.

**File:** Added to `themes/sietch/src/api/routes/billing-routes.ts` (extend)

**Acceptance Criteria:**
- [ ] `GET /api/billing/balance` — caller's credit balance across pools (BigInt-as-string)
- [ ] `GET /api/billing/history` — paginated ledger entries with filters
- [ ] `GET /api/billing/pricing` — public pricing page data (pool rates, tier discounts)
- [ ] All responses use BigInt-as-string serialization

**Estimated effort:** Small
**Dependencies:** Sprint 1 (ledger)
**Testing:** ~3 integration tests

### Task 5.3: Operational Runbook

**Description:** Production operations documentation for the billing system.

**File:** `grimoires/loa/deployment/billing-runbook.md`

**Acceptance Criteria:**
- [ ] Migration procedure (backup, apply, verify, rollback)
- [ ] Feature flag progression (shadow → soft → live)
- [ ] Monitoring alerts setup (overrun rate, DLQ depth, reconciliation drift)
- [ ] Incident response for billing failures
- [ ] Redis cache reset procedure
- [ ] NOWPayments webhook retry handling

**Estimated effort:** Small
**Dependencies:** Sprint 3 (shadow billing operational)
**Testing:** N/A (documentation)

### Sprint 5 Files

| File | Action | Purpose |
|------|--------|---------|
| `themes/sietch/src/api/routes/billing-routes.ts` | Modify | Add S2S + dashboard endpoints |
| `themes/sietch/src/api/server.ts` | Modify | Mount internal routes |
| `grimoires/loa/deployment/billing-runbook.md` | Create | Operational documentation |
| `tests/integration/billing-s2s.test.ts` | Create | ~5 integration tests |

**Sprint 5 exit criteria:** loa-finn can finalize usage via S2S endpoint. Dashboard endpoints return shadow billing data. Operational runbook complete.

---

## Sprint 6: Agent Wallet Exploration — ERC-6551 (Parallel Track)

**Global ID:** 235
**Goal:** Prototype agent-owned wallets for future autonomous spending. This is an exploration track — no production deliverables required.
**PRD refs:** §4.8 (Agent Wallets), §8 Sprint 6
**SDD refs:** §8 Sprint 6

### Task 6.1: ERC-6551 Token-Bound Account Research

**Description:** Technical feasibility analysis of ERC-6551 for agent-owned wallets that can hold USDC and pay for inference autonomously.

**File:** `grimoires/loa/research/erc6551-agent-wallets.md`

**Acceptance Criteria:**
- [ ] ERC-6551 specification summary (token-bound accounts)
- [ ] Integration requirements with arrakis finnNFT
- [ ] Gas cost analysis on Base chain
- [ ] lobster.cash API evaluation (if available)
- [ ] Comparison: ERC-6551 vs simple smart contract wallet vs Gnosis Safe
- [ ] Recommended approach for V2

**Estimated effort:** Medium
**Dependencies:** None (independent track)
**Testing:** N/A (research)

### Task 6.2: Agent Account Prototype

**Description:** Minimal prototype showing an agent holding USDC and paying for its own inference.

**File:** `themes/sietch/src/packages/adapters/billing/AgentWalletPrototype.ts`

**Acceptance Criteria:**
- [ ] Create `entity_type: 'agent'` credit account
- [ ] Prototype deposit flow from ERC-6551 TBA to credit account
- [ ] Demonstrate agent self-funding for inference
- [ ] Write feasibility report with go/no-go recommendation

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (credit accounts support agent entity_type)
**Testing:** ~5 prototype tests

### Sprint 6 Files

| File | Action | Purpose |
|------|--------|---------|
| `grimoires/loa/research/erc6551-agent-wallets.md` | Create | Feasibility research |
| `themes/sietch/src/packages/adapters/billing/AgentWalletPrototype.ts` | Create | Agent wallet prototype |
| `themes/sietch/src/types/billing.ts` | Modify | Add agent wallet types |
| `tests/prototype/agent-wallet.test.ts` | Create | ~5 prototype tests |

**Sprint 6 exit criteria:** Technical feasibility report complete. Go/no-go recommendation for V2. Prototype demonstrates agent self-funding (if feasible).

---

## Sprint 7: Security Hardening & Correctness Fixes

**Global ID:** 236
**Goal:** Address all security and correctness findings from the Bridgebuilder review of PR #63. Harden the S2S boundary, ensure BigInt safety at the database binding layer, add missing operational jobs, and resolve code scanning alerts.
**PRD refs:** §4.1 (Credit Ledger), §8 Sprint 5
**SDD refs:** §1.4 CreditLedgerService, §5.7 Auth Model, §3.2 Migration
**Source:** [PR #63 Bridgebuilder Review](https://github.com/0xHoneyJar/arrakis/pull/63)

### Task 7.1: Confused Deputy Prevention in S2S Finalize

**Description:** The S2S finalize endpoint accepts a `reservationId` but does not verify that the calling service's context matches the reservation's `account_id`. A compromised or misconfigured service could finalize another account's reservation. Add account ownership verification to the finalize path.

**File:** `themes/sietch/src/api/routes/billing-routes.ts` (modify)

**Acceptance Criteria:**
- [ ] `POST /internal/finalize` accepts optional `accountId` field in request body
- [ ] If `accountId` is provided, verify it matches the reservation's `account_id` before finalizing
- [ ] Mismatch returns 403 Forbidden with `"Account mismatch: reservation belongs to a different account"`
- [ ] If `accountId` is omitted, behavior is unchanged (backward compatible)
- [ ] `finalizeSchema` Zod schema updated to include optional `accountId` field
- [ ] Existing tests still pass; 2 new tests for mismatch and match scenarios

**Estimated effort:** Small
**Dependencies:** Sprint 5 (S2S finalize endpoint exists)
**Testing:** 2 new integration tests

### Task 7.2: BigInt Safety — safeIntegers() on Monetary Read Paths

**Description:** `better-sqlite3` returns JavaScript `number` by default for INTEGER columns, which silently truncates values above 2^53 (~$9.2 billion micro-USD). While unlikely at current scale, a financial system must not have silent precision loss. Add `.safeIntegers(true)` to prepared statements that read monetary columns.

**File:** `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts` (modify)

**Acceptance Criteria:**
- [ ] All prepared statements reading `available_micro`, `reserved_micro`, `consumed_micro`, `original_micro` chain `.safeIntegers(true)` — specifically: lot selection in `reserve()`, balance aggregation in `getBalance()`, lot reads in `finalize()` and `release()`
- [ ] `BigInt()` wrapping on row fields is retained (no-op when value is already BigInt)
- [ ] No breakage on non-monetary columns (version, counts) — these remain as `number`
- [ ] Add conformance test: insert a lot with `original_micro` = `9_100_000_000_000_000n` (~$9.1 billion), verify exact round-trip precision
- [ ] All existing 84 billing tests pass

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (CreditLedgerAdapter)
**Testing:** 1 new conformance test (BigInt precision round-trip)

### Task 7.3: Idempotency Key Cleanup Sweeper

**Description:** The `billing_idempotency_keys` table has `expires_at` but no cleanup job. Over time this table grows unboundedly. Add a sweeper job similar to the existing `reservation-sweeper.ts` pattern.

**File:** `themes/sietch/src/jobs/idempotency-sweeper.ts` (create)

**Acceptance Criteria:**
- [ ] New `IdempotencySweeper` class following the same pattern as `ReservationSweeper`
- [ ] Deletes rows where `expires_at < datetime('now')`
- [ ] Runs on configurable interval (default: 1 hour)
- [ ] Logs `billing.idempotency.sweep` event with `deleted_count` and `duration_ms`
- [ ] Batch deletes in chunks of 1000 to avoid long-held locks
- [ ] Registered in job initialization alongside existing sweeper
- [ ] Idempotent: running twice in a row with no new expired keys produces `deleted_count: 0`

**Estimated effort:** Small
**Dependencies:** Sprint 1 (idempotency table)
**Testing:** 3 new integration tests (sweep expired, skip valid, idempotent)

### Task 7.4: Code Scanning Alert Cleanup

**Description:** Resolve code scanning alerts flagged on the billing codebase: unused variables/imports/functions (13+ instances) and tighten outbound network request data handling (16 instances).

**File:** Multiple billing source files (modify)

**Acceptance Criteria:**
- [ ] Audit all billing source files for unused imports, variables, functions, and classes
- [ ] Remove all genuinely unused code; add `_` prefix for intentionally-unused callback parameters
- [ ] Review 16 "File data in outbound network request" alerts — verify each is intentional (webhook payloads, API responses) and add `// eslint-disable-next-line` with justification comment where appropriate
- [ ] Zero new code scanning alerts introduced
- [ ] All existing tests pass

**Estimated effort:** Small
**Dependencies:** None
**Testing:** Existing tests (no new tests needed)

### Task 7.5: Pre/Post Balance Audit Trail

**Description:** Add `pre_balance_micro` and `post_balance_micro` columns to `credit_ledger` entries for a verifiable audit trail. Each ledger entry will record the account's balance before and after the operation, enabling independent verification without replaying the full history.

**File:** `themes/sietch/src/db/migrations/034_audit_balance.ts` (create), `CreditLedgerAdapter.ts` (modify)

**Acceptance Criteria:**
- [ ] Migration 034 adds `pre_balance_micro INTEGER` and `post_balance_micro INTEGER` to `credit_ledger` table (nullable for backward compatibility with existing rows)
- [ ] All new ledger entry inserts populate both columns using a single SQL aggregation query against `credit_lots` within the same `BEGIN IMMEDIATE` transaction (NOT via Redis, NOT via separate `getBalance()` call) — ensures snapshot consistency
- [ ] Pre-balance computed before the lot mutation; post-balance computed after
- [ ] `getHistory()` response includes both fields when present (null for pre-migration rows)
- [ ] No non-negative CHECK on `post_balance_micro` — soft billing mode allows overrun which can produce negative available balance; this is intentional per Sprint 3 design
- [ ] Existing rows with NULL values handled gracefully in API responses (omitted or null)
- [ ] Add test for soft-mode scenario: finalize with overrun produces negative `post_balance_micro` — verify no constraint violation
- [ ] Migration rollback drops both columns cleanly

**Estimated effort:** Medium
**Dependencies:** Sprint 1 (ledger adapter — modifies `credit_ledger` writes), Sprint 3 (finalize + distribution wiring, soft-mode overrun behavior), Sprint 5 (history endpoint — must tolerate NULL columns for pre-migration rows)
**Backward compatibility:** Migration 034 adds nullable columns; existing rows have NULL `pre_balance_micro`/`post_balance_micro`. All Sprint 5 `getHistory()` and API endpoints MUST tolerate NULLs without error. Run E2E-BILLING suite after 7.5 to verify no regression across Sprints 1–6.
**Testing:** 3 new integration tests (deposit trail, reserve trail, finalize trail) + E2E-BILLING regression run

### Sprint 7 Files

| File | Action | Purpose |
|------|--------|---------|
| `themes/sietch/src/api/routes/billing-routes.ts` | Modify | Confused deputy prevention |
| `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts` | Modify | safeIntegers + audit trail |
| `themes/sietch/src/jobs/idempotency-sweeper.ts` | Create | Expired key cleanup |
| `themes/sietch/src/db/migrations/034_audit_balance.ts` | Create | Pre/post balance columns |
| `tests/integration/billing-hardening.test.ts` | Create | ~12 tests |

**Sprint 7 exit criteria:** S2S finalize verifies account ownership. Monetary queries use safeIntegers(). Idempotency keys auto-expire. Code scanning alerts resolved. Ledger entries carry balance snapshots. All tests green (96+ total).

---

## Sprint 8: Revenue Rules Governance System

**Global ID:** 237
**Goal:** Implement the "Revenue Rules" internal system for managing revenue distribution changes with approval workflows, time-delayed governance, audit trails, and cooldown periods. This directly addresses the Bridgebuilder finding that revenue split changes are governance decisions masquerading as configuration values.
**PRD refs:** §4.1 (Credit Ledger), §4.5 (Revenue Distribution)
**SDD refs:** §1.4 CreditLedgerService, §3.2 Migrations
**Source:** [PR #63 Bridgebuilder Review — Revenue Distribution Governance](https://github.com/0xHoneyJar/arrakis/pull/63#issuecomment-3902866015), Stripe Revenue Rules parallel

### Task 8.1: Revenue Rules Data Model — Migration 035

**Description:** Create the data model for revenue rule management. Revenue rules define how finalized charges are distributed across system accounts (commons, community, foundation). Rules have lifecycle states and mandatory cooldown periods before activation.

**File:** `themes/sietch/src/db/migrations/035_revenue_rules.ts` (create)

**Acceptance Criteria:**
- [ ] `revenue_rules` table with columns: `id` (UUID PK), `name` (TEXT), `status` (TEXT CHECK: 'draft', 'pending_approval', 'cooling_down', 'active', 'superseded', 'rejected'), `commons_bps` (INTEGER, basis points 0-10000), `community_bps` (INTEGER), `foundation_bps` (INTEGER), `proposed_by` (TEXT), `approved_by` (TEXT NULL), `proposed_at` (TEXT), `approved_at` (TEXT NULL), `activates_at` (TEXT NULL), `activated_at` (TEXT NULL), `superseded_at` (TEXT NULL), `superseded_by` (TEXT NULL reference to revenue_rules.id), `notes` (TEXT NULL), `created_at` (TEXT), `updated_at` (TEXT)
- [ ] **Canonical state machine**: `draft → pending_approval → cooling_down → active → superseded`. Terminal states: `rejected`, `superseded`. Approve moves directly to `cooling_down` (sets `activates_at = now + cooldown_hours`). No intermediate `approved` state — approval implies cooldown start.
- [ ] **Allowed transitions**: `draft→pending_approval` (submit), `pending_approval→cooling_down` (approve), `pending_approval→rejected` (reject), `cooling_down→active` (auto-activate after cooldown), `cooling_down→rejected` (reject during cooldown), `cooling_down→active` (emergency override skipping remaining cooldown), `active→superseded` (new rule activates)
- [ ] CHECK constraint: `commons_bps + community_bps + foundation_bps = 10000` (must sum to 100%)
- [ ] CHECK constraint: `commons_bps >= 0 AND community_bps >= 0 AND foundation_bps >= 0`
- [ ] `revenue_rule_audit_log` table: `id` (UUID PK), `rule_id` (TEXT FK), `action` (TEXT CHECK: 'proposed', 'submitted', 'approved', 'rejected', 'activated', 'superseded', 'cooldown_overridden'), `actor` (TEXT), `reason` (TEXT NULL), `previous_status` (TEXT), `new_status` (TEXT), `created_at` (TEXT)
- [ ] Index on `revenue_rules(status)` for active rule lookup
- [ ] Unique active rule enforcement: `CREATE UNIQUE INDEX revenue_rules_one_active ON revenue_rules(1) WHERE status = 'active';` — SQLite expression index on constant column ensures at most one active rule at the database level
- [ ] Activator job uses `BEGIN IMMEDIATE` + predicate check: `UPDATE revenue_rules SET status='active' WHERE id=? AND status='cooling_down' AND NOT EXISTS (SELECT 1 FROM revenue_rules WHERE status='active')` — concurrent activations fail safely
- [ ] Integration test: simulate two concurrent activations, assert exactly one active rule
- [ ] Seed initial active rule matching current hardcoded split: commons=500bps, community=7000bps, foundation=2500bps
- [ ] Migration rollback drops both tables

**Estimated effort:** Medium
**Dependencies:** Sprint 3 (RevenueDistributionService exists)
**Testing:** Migration verified in test setup

### Task 8.2: IRevenueRulesService Port + RevenueRulesAdapter

**Description:** Define the port interface and implement the adapter for revenue rule lifecycle management. Revenue rules follow a strict state machine with mandatory cooldown.

**File:** `themes/sietch/src/packages/core/ports/IRevenueRulesService.ts` (create), `themes/sietch/src/packages/adapters/billing/RevenueRulesAdapter.ts` (create)

**Acceptance Criteria:**
- [ ] `IRevenueRulesService` interface with methods:
  - `proposeRule(proposal: RuleProposal): Promise<RevenueRule>` — creates draft rule
  - `approveRule(ruleId: string, approvedBy: string): Promise<RevenueRule>` — moves to cooling_down
  - `rejectRule(ruleId: string, rejectedBy: string, reason: string): Promise<RevenueRule>`
  - `getActiveRule(): Promise<RevenueRule>` — returns the currently active rule
  - `getPendingRules(): Promise<RevenueRule[]>` — returns all non-terminal rules
  - `getRuleHistory(limit?: number): Promise<RevenueRule[]>` — audit trail
  - `overrideCooldown(ruleId: string, actor: string, reason: string): Promise<RevenueRule>` — emergency override (requires explicit reason)
- [ ] `RevenueRulesAdapter` implementing canonical state machine: `draft → pending_approval → cooling_down → active → superseded` (terminal: `rejected`, `superseded`)
- [ ] `submitForApproval(ruleId, actor)`: `draft → pending_approval` (logs 'submitted')
- [ ] `approveRule(ruleId, approvedBy)`: `pending_approval → cooling_down` (sets `approved_at`, `activates_at = now + cooldown_hours`, logs 'approved')
- [ ] `rejectRule(ruleId, rejectedBy, reason)`: `pending_approval → rejected` OR `cooling_down → rejected` (logs 'rejected')
- [ ] `overrideCooldown(ruleId, actor, reason)`: `cooling_down → active` (immediate activation, bypasses remaining cooldown, logs 'cooldown_overridden')
- [ ] Cooldown duration: 48 hours (configurable via `billing_config` key `revenue_rule_cooldown_hours`)
- [ ] When a rule activates (auto or override), the previously active rule transitions to `superseded` within the same `BEGIN IMMEDIATE` transaction
- [ ] `activateReadyRules()` method for background job: checks `cooling_down` rules where `activates_at <= datetime('now')`, transitions them to `active` using predicate-guarded UPDATE
- [ ] `getPendingRules()` returns rules in non-terminal states: `draft`, `pending_approval`, `cooling_down`
- [ ] All state transitions logged to `revenue_rule_audit_log` with actor, reason, previous/new status
- [ ] Invalid transitions throw `InvalidStateError` (reuse from CreditLedgerAdapter)
- [ ] Transition validation table hardcoded as constant: `ALLOWED_TRANSITIONS: Record<Status, Status[]>`

**Estimated effort:** Large
**Dependencies:** Task 8.1 (migration)
**Testing:** 6 new integration tests (propose, approve, reject, cooldown activate, supersede, override)

### Task 8.3: Revenue Rules Admin API Endpoints

**Description:** Admin endpoints for managing revenue rules. Uses the existing admin JWT auth and rate limiter from Sprint 4.

**File:** `themes/sietch/src/api/routes/billing-admin-routes.ts` (modify)

**Acceptance Criteria:**
- [ ] `POST /admin/billing/revenue-rules` — propose a new rule (requires admin JWT)
- [ ] `PATCH /admin/billing/revenue-rules/:id/approve` — approve a pending rule
- [ ] `PATCH /admin/billing/revenue-rules/:id/reject` — reject with reason
- [ ] `PATCH /admin/billing/revenue-rules/:id/override-cooldown` — emergency cooldown override (requires `reason` in body)
- [ ] `GET /admin/billing/revenue-rules` — list all rules (with status filter query param)
- [ ] `GET /admin/billing/revenue-rules/active` — get the currently active rule
- [ ] `GET /admin/billing/revenue-rules/:id/audit` — audit log for a specific rule
- [ ] All endpoints use `requireAdminAuth` middleware + `adminRateLimiter` (existing from Sprint 4)
- [ ] All BigInt-as-string serialization via `serializeBigInt()`
- [ ] Zod validation on all request bodies

**Estimated effort:** Medium
**Dependencies:** Task 8.2 (service), Sprint 4 (admin auth)
**Testing:** 4 new integration tests (CRUD + audit trail)

### Task 8.4: Revenue Rules Activation Job

**Description:** Background job that checks for rules in `cooling_down` state whose cooldown has elapsed, and activates them. Similar pattern to ReservationSweeper.

**File:** `themes/sietch/src/jobs/revenue-rules-activator.ts` (create)

**Acceptance Criteria:**
- [ ] `RevenueRulesActivator` class checking every 5 minutes for rules ready to activate
- [ ] When activating: sets `status = 'active'`, `activated_at = now()`, supersedes previous active rule
- [ ] Logs `billing.revenue_rules.activated` event with `rule_id`, `commons_bps`, `community_bps`, `foundation_bps`
- [ ] If no rules ready, job completes silently
- [ ] Integration with `RevenueDistributionService`: after activation, distribution uses the new active rule's basis points instead of `billing_config` values

**Estimated effort:** Medium
**Dependencies:** Task 8.2 (service)
**Testing:** 2 new integration tests (auto-activate after cooldown, no-op when nothing pending)

### Task 8.5: Wire RevenueDistributionService to Revenue Rules

**Description:** Modify the existing `RevenueDistributionService` to read the active revenue rule from `revenue_rules` table instead of `billing_config`. Fall back to `billing_config` if no active rule exists (backward compatible).

**File:** `themes/sietch/src/packages/adapters/billing/RevenueDistributionService.ts` (modify)

**Acceptance Criteria:**
- [ ] `distribute()` method reads active rule via `getActiveRule()` first
- [ ] If active rule exists, use its `commons_bps / community_bps / foundation_bps`
- [ ] If no active rule, fall back to `billing_config` values (existing behavior)
- [ ] Basis points → micro-USD conversion: `share = (charge * bps) / 10000n`
- [ ] Foundation still absorbs remainder (zero-sum invariant maintained)
- [ ] Existing distribution tests still pass with seeded active rule
- [ ] Log which source was used: `billing.distribution.source: 'revenue_rule'` or `'billing_config'`

**Estimated effort:** Medium
**Dependencies:** Task 8.2, Sprint 3 (distribution service)
**Testing:** 2 new integration tests (distribution from rule, fallback to config)

### Sprint 8 Files

| File | Action | Purpose |
|------|--------|---------|
| `themes/sietch/src/db/migrations/035_revenue_rules.ts` | Create | Revenue rules + audit log tables |
| `themes/sietch/src/packages/core/ports/IRevenueRulesService.ts` | Create | Revenue rules port interface |
| `themes/sietch/src/packages/adapters/billing/RevenueRulesAdapter.ts` | Create | Revenue rules state machine |
| `themes/sietch/src/jobs/revenue-rules-activator.ts` | Create | Cooldown activation job |
| `themes/sietch/src/api/routes/billing-admin-routes.ts` | Modify | Admin endpoints |
| `themes/sietch/src/packages/adapters/billing/RevenueDistributionService.ts` | Modify | Wire to active rule |
| `tests/integration/billing-revenue-rules.test.ts` | Create | ~14 tests |

**Sprint 8 exit criteria:** Revenue rule lifecycle fully operational (propose → approve → cooldown → activate). Distribution reads from active rule. Admin can propose, approve, reject, and override. All transitions audited. 48h cooldown enforced. All tests green (110+ total).

---

## Sprint 9: Documentation, Integration & Agent Identity

**Global ID:** 238
**Goal:** Close all remaining Bridgebuilder findings: architectural decision records, cross-system S2S contract alignment, agent identity binding, persistent agent spending tracking, and reconciliation hardening.
**PRD refs:** §4.8 (Agent Wallets), §4.1 (Credit Ledger)
**SDD refs:** §1.4 CreditLedgerService, §5.7 Auth Model, §8 Sprint 6
**Source:** [PR #63 Bridgebuilder Addendum](https://github.com/0xHoneyJar/arrakis/pull/63#issuecomment-3902873812)

### Task 9.1: Architectural Decision Records (ADRs)

**Description:** Document the 5 key architectural decisions identified by the Bridgebuilder review. These serve as breadcrumbs for future agents and developers encountering this codebase.

**File:** `grimoires/loa/decisions/billing-adrs.md` (create)

**Acceptance Criteria:**
- [ ] ADR-001: Why SQLite over PostgreSQL for the credit ledger (operational simplicity, single-process write model, WAL mode, existing infrastructure)
- [ ] ADR-002: Why FIFO over LIFO for lot consumption (campaign credit expiry, financial policy alignment, AWS Credits parallel)
- [ ] ADR-003: Why separate JWT secrets for admin vs S2S (defense in depth, blast radius reduction, different audience claims)
- [ ] ADR-004: Why HS256 over RS256 for internal JWTs (symmetric simplicity for internal services, no public key distribution needed, single secret rotation)
- [ ] ADR-005: Why foundation absorbs truncation remainder in revenue distribution (zero-sum invariant, foundation is the system operator, simplest guarantee against rounding drift)
- [ ] Each ADR follows format: Context → Decision → Consequences → Alternatives Considered
- [ ] Cross-references to SDD sections and sprint implementation files

**Estimated effort:** Small
**Dependencies:** None
**Testing:** N/A (documentation)

### Task 9.2: S2S Contract Types for loa-hounfour

**Description:** Define the S2S finalize request/response contract as shared TypeScript types that can be consumed by both arrakis and loa-finn. This prevents schema drift between the two services. For now, create the types locally with a clear migration path to loa-hounfour.

**File:** `themes/sietch/src/packages/core/contracts/s2s-billing.ts` (create)

**Acceptance Criteria:**
- [ ] `S2SFinalizeRequest` type: `{ reservationId: string, actualCostMicro: string, accountId?: string }`
- [ ] `S2SFinalizeResponse` type: `{ reservationId: string, accountId: string, finalizedMicro: string, releasedMicro: string, overrunMicro: string, billingMode: string, finalizedAt: string }`
- [ ] `S2SFinalizeError` type: `{ error: string, message?: string }`
- [ ] Zod schemas for runtime validation (replacing inline schemas in billing-routes.ts)
- [ ] `billing-routes.ts` updated to import from contract file instead of inline Zod
- [ ] README section in contracts directory: "These types are candidates for migration to loa-hounfour. See issue #62."
- [ ] Types exported from package index

**Estimated effort:** Small
**Dependencies:** Sprint 5 (S2S endpoint), Task 7.1 (accountId field)
**Testing:** Existing S2S tests validate contracts implicitly

### Task 9.3: Agent Identity Binding — identity_anchor Integration

**Description:** Bind the agent credit account to the `identity_anchor` concept from loa-hounfour's sybil resistance system. This ensures agent wallets are tied to verified NFT identities, not arbitrary entity IDs.

**File:** `themes/sietch/src/packages/adapters/billing/AgentWalletPrototype.ts` (modify)

**Acceptance Criteria:**
- [ ] `AgentWalletConfig` extended with optional `identityAnchor: string` field (NFT-based identity hash)
- [ ] `createAgentWallet()` stores `identity_anchor` as metadata on the credit account (via new `metadata` JSON column or `description` field)
- [ ] `verifyIdentityBinding(wallet, anchor)` method: verifies the wallet's identity anchor matches the expected value
- [ ] If `identityAnchor` is provided, it is included in the simulated TBA address derivation
- [ ] Existing tests pass without identity anchor (backward compatible)
- [ ] 2 new tests: wallet creation with anchor, anchor verification

**Estimated effort:** Small
**Dependencies:** Sprint 6 (agent wallet prototype)
**Testing:** 2 new prototype tests

### Task 9.4: Persistent Agent Daily Spending — Redis

**Description:** Replace the ephemeral in-memory `dailySpent` Map in `AgentWalletPrototype` with Redis-backed persistent tracking. This prevents agents from getting full daily budgets after server restart (the "Uber surge amnesia" bug).

**File:** `themes/sietch/src/packages/adapters/billing/AgentWalletPrototype.ts` (modify)

**Acceptance Criteria:**
- [ ] Daily spending tracked in Redis with key pattern `billing:agent:daily:{accountId}:{YYYY-MM-DD}`
- [ ] Redis TTL auto-expires at end of day (86400 seconds from midnight UTC)
- [ ] Falls back to in-memory Map if Redis unavailable (existing behavior)
- [ ] `getRemainingDailyBudget()` reads from Redis first, then in-memory
- [ ] Existing daily cap tests pass
- [ ] 2 new tests: Redis-backed daily tracking, fallback behavior

**Estimated effort:** Medium
**Dependencies:** Sprint 6 (agent wallet), Sprint 1 (Redis interface)
**Testing:** 2 new prototype tests

### Task 9.5: Reconciliation Generation Counter

**Description:** Add a generation counter to the reconciliation system to detect stalled reconciler instances. If the generation hasn't advanced after expected interval, monitoring can alert.

**File:** `themes/sietch/src/jobs/daily-reconciliation.ts` (modify)

**Acceptance Criteria:**
- [ ] New `billing_config` key: `reconciliation_generation` (INTEGER, starts at 0)
- [ ] Each successful reconciliation run increments the generation counter
- [ ] `runReconciliation()` returns `{ ...existing, generation: number }` in result
- [ ] Log includes `generation` in the `billing.daily_reconciliation` event
- [ ] Existing reconciliation tests pass
- [ ] 1 new test: verify generation increments on each run

**Estimated effort:** Small
**Dependencies:** Sprint 3 (reconciliation job)
**Testing:** 1 new integration test

### Sprint 9 Files

| File | Action | Purpose |
|------|--------|---------|
| `grimoires/loa/decisions/billing-adrs.md` | Create | 5 architectural decision records |
| `themes/sietch/src/packages/core/contracts/s2s-billing.ts` | Create | Shared S2S contract types |
| `themes/sietch/src/packages/adapters/billing/AgentWalletPrototype.ts` | Modify | Identity binding + Redis spending |
| `themes/sietch/src/api/routes/billing-routes.ts` | Modify | Import contracts from shared types |
| `themes/sietch/src/jobs/daily-reconciliation.ts` | Modify | Generation counter |
| `tests/integration/billing-integration-gaps.test.ts` | Create | ~5 tests |
| `tests/prototype/agent-wallet.test.ts` | Modify | +4 tests |

**Sprint 9 exit criteria:** All 5 ADRs documented. S2S contract types extracted and reusable. Agent wallets bound to identity anchors. Daily spending persisted in Redis. Reconciliation generation tracked. All Bridgebuilder findings from PR #63 fully resolved. All tests green (118+ total).

---

## Appendix A: Goal Traceability

| Goal ID | Goal | Sprint Coverage | Validation |
|---------|------|----------------|------------|
| G-1 | Accept crypto payments (NOWPayments) | Sprint 1 (smoke), Sprint 2 (wiring) | Webhook → lot → deposit verified |
| G-2 | Accept x402 USDC micropayments | Sprint 2 (x402 adapter + middleware) | Top-up endpoint functional |
| G-3 | Credit ledger with BigInt precision | Sprint 1 (foundation) | 15 conformance tests pass |
| G-4 | Reserve-finalize billing pattern | Sprint 1 (adapter), Sprint 3 (middleware) | Concurrent reserve test |
| G-5 | Shadow/soft/live billing modes | Sprint 3 (middleware) | 7+ days shadow data |
| G-6 | Revenue distribution (zero-sum) | Sprint 3 (distribution service) | Zero-sum invariant tests |
| G-7 | Reverse Airdrop campaigns | Sprint 4 (campaign engine) | Batch grant + budget enforcement |
| G-8 | Gamified discount engine | Sprint 4 (discount engine) | Discount applied in reserve |
| G-9 | Collab.Land displacement | Sprint 5 (GTM infrastructure) | Dashboard + pricing endpoints |
| G-10 | Revenue target ($690/community/month) | Sprint 3 (shadow data) | Shadow billing validates |
| G-11 | Agent wallet exploration | Sprint 6 (ERC-6551) | Feasibility report |
| G-12 | Resolve all PR #63 Bridgebuilder findings | Sprint 7 (hardening), Sprint 9 (integration) | All 15 findings addressed |
| G-13 | Revenue Rules governance system | Sprint 8 (Revenue Rules) | Time-delayed rule activation with audit trail |
| G-14 | Agent identity binding (identity_anchor) | Sprint 9 (integration) | Wallet ↔ NFT identity verified |

## Appendix B: E2E Validation Task

**Task ID:** E2E-BILLING
**Sprint:** Sprint 5 (after all P0/P1 features complete)
**Description:** End-to-end validation that the complete billing pipeline works: payment → credit → reserve → inference → finalize → distribution → reconciliation.

**Validation steps:**
1. Create a NOWPayments payment → receive webhook → verify lot created
2. Top up via x402 → verify lot created
3. Reserve credits for inference → verify lots consumed FIFO
4. Finalize after inference → verify distribution posted (zero-sum)
5. Sweep expired reservation → verify credits returned
6. Run reconciliation → verify no drift
7. Create batch grant → verify lots with pool restriction and expiry
8. All BigInt values serialized as strings in API responses

---

## Appendix C: Flatline Sprint Review — Blocker Overrides

| Blocker | Severity | Decision | Rationale |
|---------|----------|----------|-----------|
| SKP-004 (HMAC dual verification) | 780 | **Override** | SDD §1.8 mandates single-strategy enforcement ("no permissive fallback"). Task 1.8 already implements chosen strategy with env var lock. Dual verification contradicts this design decision. |
| SKP-006 (Distribution atomicity coupling) | 740 | **Override** | SDD requires atomic distribution within finalize transaction for zero-sum invariant. Task 3.3 mitigates coupling risk by pre-validating config/recipient accounts at startup and measuring added lock time in Task 1.9 performance tests. Outbox approach would break zero-sum audit guarantee. |

## Appendix D: Flatline Sprint Review — Accepted Blockers

| Blocker | Severity | Integration |
|---------|----------|-------------|
| SKP-001 (SQLite write contention) | 930 | Task 1.9 expanded: mixed-load test with background jobs + webhooks; WAL + busy_timeout verified |
| SKP-002 (Redis cache reliability) | 880 | Task 1.5 updated: Redis best-effort with timeouts, fallback to SQLite for enforcement |
| SKP-003 (Idempotency enforcement) | 860 | Task 1.1 updated: `billing_idempotency_keys` table added; Task 1.5 keying specified |
| SKP-005 (Refund/clawback accounting) | 770 | Task 2.2 updated: LIFO clawback, reversing entries, debt blocks reserves |
| SKP-007 (Security model details) | 720 | Task 4.3 updated: JWT signing/rotation/JTI storage; audit log append-only |

---

## Appendix E: Bridgebuilder Findings Resolution Map

**Bridgebuilder Findings (13 from PR #63 review):**

| # | Finding | Severity | Resolution Sprint | Task |
|---|---------|----------|-------------------|------|
| 1 | Missing rate limiters on dashboard endpoints | High | **FIXED** (commit 9d7ca7b) | — |
| 2 | Confused deputy prevention in S2S finalize | Medium | Sprint 7 | 7.1 |
| 3 | BigInt safety (safeIntegers) | Medium | Sprint 7 | 7.2 |
| 4 | Idempotency key cleanup sweeper | Medium | Sprint 7 | 7.3 |
| 5 | Code scanning alerts (unused vars, outbound data) | Info | Sprint 7 | 7.4 |
| 6 | Pre/post balance audit trail | Low | Sprint 7 | 7.5 |
| 7 | Revenue distribution governance model | Medium | Sprint 8 | 8.1–8.5 |
| 8 | No ADR documentation for 5 key decisions | Medium | Sprint 9 | 9.1 |
| 9 | S2S contract not shared / defined in two places | Medium | Sprint 9 | 9.2 |
| 10 | Agent identity binding (identity_anchor) | Medium | Sprint 9 | 9.3 |
| 11 | Ephemeral dailySpent Map (Uber surge amnesia) | Low | Sprint 9 | 9.4 |
| 12 | Reconciliation generation counter | Low | Sprint 9 | 9.5 |
| 13 | Revenue distribution governance — no approval workflow | Medium | Sprint 8 | 8.1–8.5 |

**User-Requested Feature (not a Bridgebuilder finding):**

| # | Feature | Resolution Sprint | Task |
|---|---------|-------------------|------|
| F-1 | Revenue Rules governance system (Stripe Revenue Rules parallel) | Sprint 8 | 8.1–8.5 |

*Note: Findings #7 and #13 both relate to revenue governance but from different angles (#7 = missing cooldown/time-delay, #13 = missing approval workflow). Both resolved by the Revenue Rules system in Sprint 8.*

---

*Sprint plan generated from PRD v1.3.0 and SDD v1.2.0. Sprints 1–6 grounded in cycle-025 "Billing & Payments — Path to Revenue". Sprints 7–9 address 14 Bridgebuilder findings from PR #63 plus the Revenue Rules governance system (Stripe Revenue Rules parallel). Global sprint range extended to 230–238.*

# SDD: Billing & Payments — Path to Revenue

**Version:** 1.2.0
**Cycle:** 025
**Date:** 2026-02-14
**PRD:** [Billing & Payments PRD v1.3.0](grimoires/loa/prd.md)

---

## 1. Project Architecture

### 1.1 System Overview

Add a credit ledger, payment processing, and revenue distribution layer to the existing Arrakis platform. The billing system is a **new vertical slice** through the existing modular monolith — new ports, adapters, services, migrations, and endpoints, following established Ports & Adapters patterns.

No new services, no new deployments. All billing logic lives inside the Sietch API (Express) and the existing Redis/SQLite/PostgreSQL infrastructure.

### 1.2 Architectural Pattern

**Pattern:** Modular Monolith with Ports & Adapters (Hexagonal)

**Justification:** The codebase already uses this pattern (IBillingProvider, ICryptoPaymentProvider, budget-manager). New billing components follow the same port/adapter separation. This avoids microservice overhead for a feature that shares the same database and runtime.

### 1.3 Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           SIETCH API (Express)                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │ billingRouter    │  │ cryptoBillingRtr  │  │ billingAdminRouter        │  │
│  │ /api/billing/*   │  │ /api/crypto/*     │  │ /admin/billing/*          │  │
│  └────────┬─────────┘  └────────┬──────────┘  └────────────┬─────────────┘  │
│           │                     │                           │                │
│           └──────────┬──────────┘───────────────────────────┘                │
│                      ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     BILLING MIDDLEWARE LAYER                          │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐  │   │
│  │  │ x402Middleware  │  │ billingGuard   │  │ shadowBillingHook     │  │   │
│  │  │ (top-up gate)   │  │ (balance gate) │  │ (mode-aware logging)  │  │   │
│  │  └────────┬────────┘  └────────┬───────┘  └───────────┬──────────┘  │   │
│  │           └──────────┬─────────┘──────────────────────┘              │   │
│  └──────────────────────┼───────────────────────────────────────────────┘   │
│                         ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        CORE SERVICES (Ports)                         │   │
│  │                                                                      │   │
│  │  ┌─────────────────────┐  ┌──────────────────┐  ┌────────────────┐  │   │
│  │  │ ICreditLedgerService│  │ IPaymentService   │  │ ICampaignSvc   │  │   │
│  │  │ reserve()           │  │ processWebhook()  │  │ createGrant()  │  │   │
│  │  │ finalize()          │  │ createTopUp()     │  │ batchGrant()   │  │   │
│  │  │ release()           │  │ getStatus()       │  │ getStatus()    │  │   │
│  │  │ getBalance()        │  │ refund()          │  │                │  │   │
│  │  │ getHistory()        │  │                   │  │                │  │   │
│  │  └──────────┬──────────┘  └────────┬──────────┘  └───────┬────────┘  │   │
│  │             │                      │                      │           │   │
│  └─────────────┼──────────────────────┼──────────────────────┼───────────┘   │
│                ▼                      ▼                      ▼               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      ADAPTERS (Implementations)                      │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │   │
│  │  │ CreditLedger    │  │ NOWPayments      │  │ x402Payment        │  │   │
│  │  │ Adapter         │  │ Adapter          │  │ Adapter            │  │   │
│  │  │ (SQLite/Drizzle)│  │ (existing, ext.) │  │ (@x402/server)     │  │   │
│  │  └────────┬────────┘  └────────┬─────────┘  └────────┬───────────┘  │   │
│  │           │                    │                      │              │   │
│  └───────────┼────────────────────┼──────────────────────┼──────────────┘   │
│              ▼                    ▼                      ▼                   │
│  ┌─────────────────┐  ┌────────────────────┐  ┌───────────────────────┐    │
│  │ SQLite/Turso     │  │ NOWPayments API    │  │ Coinbase Facilitator  │    │
│  │ (credit ledger)  │  │ (sandbox/prod)     │  │ (x402 USDC on Base)  │    │
│  └────────┬─────────┘  └────────────────────┘  └───────────────────────┘    │
│           │                                                                  │
│  ┌────────┴─────────┐  ┌────────────────────┐  ┌───────────────────────┐    │
│  │ Redis (ioredis)   │  │ BullMQ             │  │ PostgreSQL            │    │
│  │ (balance cache,   │  │ (DLQ, sweeper,     │  │ (global tables,       │    │
│  │  Lua scripts)     │  │  reconciliation)   │  │  user_identities)     │    │
│  └───────────────────┘  └────────────────────┘  └───────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 System Components

#### CreditLedgerService

- **Purpose:** Single source of truth for all monetary state. Manages credit accounts, lots, balances, and the append-only ledger.
- **Responsibilities:** Account CRUD, lot creation, FIFO lot selection, reserve/finalize/release lifecycle, balance cache maintenance, entry_seq allocation.
- **Port:** `ICreditLedgerService` (new)
- **Adapter:** `CreditLedgerAdapter` — SQLite/Drizzle for writes, Redis for balance cache reads.
- **Dependencies:** SQLite (Drizzle), Redis (ioredis), existing `budget-manager.ts` Lua script patterns.

#### PaymentService

- **Purpose:** Orchestrates payment processing across providers (NOWPayments, x402). Maps external payment events to internal credit operations.
- **Responsibilities:** Webhook verification, state machine transitions, lot minting on `finished`, refund/clawback, x402 top-up verification.
- **Port:** `IPaymentService` (new)
- **Adapter:** `PaymentServiceAdapter` — delegates to `NOWPaymentsAdapter` (existing, extended) and `X402PaymentAdapter` (new).
- **Dependencies:** `ICreditLedgerService`, `ICryptoPaymentProvider` (existing port), `crypto_payments` table.

#### BillingMiddleware

- **Purpose:** Express middleware stack for billing enforcement on `/invoke` and `/topup` routes.
- **Responsibilities:** Balance check, reserve-before-inference, finalize-after-inference, x402 top-up gate for first-time users, shadow/soft/live mode branching.
- **Dependencies:** `ICreditLedgerService`, `IPaymentService`, `BILLING_MODE` env var.

#### CampaignService

- **Purpose:** Manages Reverse Airdrop campaigns, grant formulas, and batch grant operations.
- **Responsibilities:** Campaign lifecycle (draft → active → completed), grant formula evaluation, batch grant with budget enforcement, per-wallet cap enforcement.
- **Port:** `ICampaignService` (new)
- **Dependencies:** `ICreditLedgerService` (for lot creation), `credit_campaigns`/`credit_grants` tables.

#### RevenueDistributionService

- **Purpose:** Posts zero-sum revenue distribution entries after every finalization.
- **Responsibilities:** Commons contribution calculation, community revenue share, foundation remainder. All entries in a single SQLite transaction.
- **Port:** Part of `ICreditLedgerService.finalize()` — distribution is atomic with finalization.
- **Dependencies:** Configurable rates (commons_rate, community_rate) from system config.

#### Background Jobs

- **Purpose:** Periodic maintenance tasks for billing health.
- **Jobs:**
  - `ReservationSweeper` — every 60s, releases expired reservations (TTL = 5min default)
  - `BalanceReconciler` — every 5min, compares Redis to SQLite for top-100 active accounts
  - `DLQProcessor` — processes failed webhooks/distributions with exponential backoff
  - `DailyReconciliation` — validates lot sums, zero-sum invariants, orphan detection
- **Implementation:** BullMQ (existing dependency) with Redis-backed queues.

### 1.5 Data Flow

**Payment → Credits:**
```
NOWPayments webhook → verifyHMAC → upsert crypto_payments → state transition
  → if 'finished': create credit_lot + deposit ledger entry + update balance cache
  → if 'refunded': clawback lot + refund ledger entry

x402 top-up → verify x402 payment → create crypto_payments (status: finished)
  → create credit_lot + deposit ledger entry + update balance cache
```

**Inference → Billing:**
```
POST /invoke → billingGuard middleware
  → [shadow mode]: log shadow_reserve, proceed, log shadow_finalize
  → [soft/live mode]: reserve X from lots → inference → finalize Y
    → if Y < X: release surplus
    → if Y > X: per-mode overrun handling (see §1.5.3)
  → revenue distribution (commons + community + foundation)
```

#### 1.5.1 FIFO Lot Selection Algorithm

Lot selection for `reserve()` uses a deterministic ordering to ensure consistent, auditable consumption:

```sql
-- Select lots for reservation (within BEGIN IMMEDIATE transaction)
SELECT id, available_micro
FROM credit_lots
WHERE account_id = :account_id
  AND (pool_id = :pool_id OR pool_id IS NULL)  -- pool-restricted first, then unrestricted
  AND available_micro > 0
  AND (expires_at IS NULL OR expires_at > datetime('now'))
ORDER BY
  CASE WHEN pool_id = :pool_id THEN 0 ELSE 1 END ASC,  -- pool-restricted first
  CASE WHEN expires_at IS NOT NULL THEN 0 ELSE 1 END ASC,  -- expiring first
  expires_at ASC NULLS LAST,  -- soonest-expiring first
  created_at ASC;  -- oldest first (true FIFO within same tier)
```

The algorithm then iterates over lots, deducting `available_micro` and adding to `reserved_micro` until the requested amount is fully reserved. Each lot touched is recorded in `reservation_lots` for finalize/release to reverse precisely.

**Finalize** consumes in the same lot order as the reservation (using `reservation_lots` records), converting `reserved_micro` to `consumed_micro`.

#### 1.5.2 Reservation State Machine

```
                  ┌───────────┐
                  │  CREATED   │ (reserve() called)
                  └─────┬─────┘
                        │
                        ▼
                  ┌───────────┐
          ┌──────│  PENDING   │──────┐
          │      └─────┬─────┘      │
          │            │            │
   TTL expires    finalize()    release()
          │            │            │
          ▼            ▼            ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │  EXPIRED   │ │ FINALIZED │ │  RELEASED  │
   └───────────┘ └───────────┘ └───────────┘
```

**Transition rules:**
- `pending → finalized`: Only by the account owner, with `reservation_id` + `actual_cost_micro`. Idempotent: duplicate finalize with same reservation_id returns the existing result.
- `pending → released`: Only by the account owner, or by the sweeper (on TTL expiry).
- `pending → expired`: Only by the ReservationSweeper when `expires_at < now()`. Logically equivalent to release.
- **No transitions from terminal states** (finalized, released, expired).
- **Conflicting finalize**: If `actual_cost_micro` differs from a previous finalize for the same `reservation_id`, return 409 Conflict (do not re-finalize with different amount).

**loa-finn failure modes:**
- **finn timeout during inference**: Reservation remains `pending`; sweeper releases after TTL (default 5 min). User is not charged. Finn should implement client-side timeout < reservation TTL.
- **finn sends finalize twice (same amount)**: Idempotent — second call returns existing result.
- **finn sends finalize twice (different amount)**: 409 Conflict — first finalize wins. Logged for investigation.
- **finn sends finalize after TTL expiry**: 409 Conflict (`reservation_id` status is `expired`). Logged with `warn` level. Revenue not captured — this is a known loss mode mitigated by TTL > expected inference time.
- **Inference succeeds but finalize network fails**: Finn retries finalize with exponential backoff (3 attempts). If all fail, the reservation expires and credits return to user. Inference cost is absorbed as platform loss (logged, alerted at >$1).

#### 1.5.3 Cost Overrun Behavior

When `actual_cost_micro > total_reserved_micro` (finalize amount exceeds reservation):

| Billing Mode | Behavior | Balance Impact |
|-------------|----------|----------------|
| `shadow` | Log overrun with `shadow_finalize` entry showing both reserved and actual amounts. No balance impact. | None |
| `soft` | Finalize the full `actual_cost_micro`. If this exceeds available+reserved, allow temporary negative balance. Log overrun at `warn` level. | May go negative |
| `live` | **Cap finalize at `total_reserved_micro`**. The surplus `(actual - reserved)` is **absorbed as platform cost** and logged as an `overrun_absorbed` event at `warn` level. Alert if overrun exceeds `overrun_alert_threshold_pct` (default 5%). | Capped at reserved |

**Rationale for live mode capping:** Recording debt for overruns would add complexity (new debt source, paydown logic, user confusion) for a scenario that should be rare given the 1.5x safety multiplier. Instead, we optimize the multiplier based on observed overrun rates. If overrun rate exceeds 5% for 7 consecutive days, an alert fires and the `reserve_safety_multiplier_pct` should be increased.

**No debt is recorded for live-mode overruns.** The platform absorbs the loss. This is a deliberate product decision: users should not be surprised by charges exceeding their reservation.

### 1.6 External Integrations

| Service | Purpose | API Type | Authentication |
|---------|---------|----------|----------------|
| NOWPayments | Crypto subscriptions, credit packs | REST | `x-api-key` header |
| NOWPayments IPN | Payment status webhooks | Webhook | HMAC-SHA512 signature |
| Coinbase CDP | x402 USDC facilitator | x402 protocol | On-chain verification |
| loa-hounfour v3.0.0 | Shared billing types | npm package | `validateCompatibility()` |
| loa-finn | Inference execution | JWT-authenticated REST | req_hash + circuit breaker |

### 1.7 Deployment Architecture

No new deployments. All billing logic deploys within the existing Sietch API container. Infrastructure additions:

- **SQLite tables:** 4 new migrations (030-033) applied via `drizzle-kit push`
- **Redis keys:** New `balance:*` keys alongside existing `agent:budget:*` keys
- **BullMQ queues:** `billing:sweeper`, `billing:reconciler`, `billing:dlq`
- **Environment variables:** `BILLING_MODE`, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `X402_FACILITATOR_ADDRESS`

### 1.8 Security Architecture

- **Webhook verification:** HMAC-SHA512 (NOWPayments) with `crypto.timingSafeEqual()`, raw body preservation via existing Express middleware (lines 217-223 in server.ts). **Single verification strategy per environment** — test both Strategy A (raw body) and Strategy B (sorted-key) against the NOWPayments sandbox during Sprint 1 smoke tests; deploy **only the verified strategy** to production. Do not ship a permissive fallback. Log and alert on any signature verification failure. Add replay protection via `payment_id` uniqueness (already enforced by `UNIQUE(provider, provider_payment_id)`).
- **Admin endpoints:** Scoped bearer tokens with full auth model (see §5.7 below).
- **Financial data:** Append-only ledger (no UPDATE/DELETE), idempotency keys on all entries
- **x402 on-chain verification:** Explicit verification rules for USDC top-ups on Base:
  1. **Chain ID:** Must be Base (chainId = 8453). Reject all other chains.
  2. **Token contract:** Must be USDC contract address on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`). Configured via `X402_USDC_CONTRACT` env var.
  3. **Recipient:** Transfer `to` address must equal `X402_FACILITATOR_ADDRESS` (Coinbase facilitator).
  4. **Amount:** Transfer amount must match requested `amount_usd` (converted to USDC decimals = 6). Reject under-payment; for over-payment, credit the full transferred amount.
  5. **Confirmations:** Require minimum 12 block confirmations before crediting (configurable via `X402_MIN_CONFIRMATIONS`, default 12). Credit is final — no provisional/rollback model.
  6. **Tx status:** Must be `success` (receipt status = 1).
  7. **Tx hash uniqueness:** `UNIQUE(provider='x402', provider_payment_id=tx_hash)` prevents replay of the same transaction across accounts.
  8. **Log-based verification:** Validate via Transfer event logs, not just tx value (prevents value-spoofing via internal transactions).
- **Redis:** Balance cache is advisory only — all spending decisions read from SQLite within write transactions

---

## 2. Software Stack

### 2.1 Existing Technologies (No Changes)

| Category | Technology | Version | Role |
|----------|------------|---------|------|
| Runtime | Node.js | >=22 | Server runtime |
| Framework | Express | 4.21.1 | HTTP server, routers already mounted |
| ORM | Drizzle | 0.45.1 | SQLite + PostgreSQL schema management |
| SQLite | better-sqlite3 | 11.6.0 | Local state (ledger, lots, balances) |
| PostgreSQL | postgres/pg | 3.4.8/8.16.3 | Global tables (user_identities) |
| Redis | ioredis | 5.9.1 | Balance cache, budget counters, Lua scripts |
| Queue | BullMQ | 5.66.4 | Background job processing |
| Validation | Zod | 3.23.8 | Runtime input validation |
| HTTP Client | axios | 1.7.9 | NOWPayments API calls |
| Logging | Pino | 9.5.0 | Structured JSON logging |
| Testing | Vitest | 2.1.5 | Unit + integration tests |

### 2.2 New Dependencies

| Package | Version | Purpose | Justification |
|---------|---------|---------|---------------|
| `@x402/server` | latest | x402 payment verification | Framework-agnostic x402 (NOT `@x402/hono` — stack is Express) |
| `@0xhoneyjar/loa-hounfour` | v3.0.0 | Shared billing types (BigInt, validators) | Upgrade from v1.1.0 — PR #1 adds billing schemas |

**No other new dependencies.** The billing system is built entirely on existing infrastructure.

### 2.3 Key Design Constraint: Express, Not Hono

The PRD references `@x402/hono` but the Sietch API runs Express (v4.21.1). The correct package is `@x402/server` which provides framework-agnostic verification. The x402 middleware will be an Express middleware wrapping `@x402/server`'s `verifyPayment()` function.

---

## 3. Database Design

### 3.1 Database Technology

**Credit Ledger:** SQLite via better-sqlite3 / Drizzle ORM
- Existing SQLite instance used for community-scoped data
- `BEGIN IMMEDIATE` for write serialization (single-writer guarantee)
- Drizzle schema definitions + drizzle-kit migrations

**SQLite Write Throughput SLOs:**

Single-writer SQLite serializes all write transactions. Under concurrent inference load, this is the primary throughput constraint for billing.

| Metric | Target | Measurement |
|--------|--------|-------------|
| Reserve latency (p50) | < 5ms | `BEGIN IMMEDIATE` → lot selection → `COMMIT` |
| Reserve latency (p99) | < 50ms | Including SQLITE_BUSY retry |
| Finalize latency (p50) | < 3ms | `BEGIN IMMEDIATE` → lot update → ledger entry → `COMMIT` |
| Max sustained write TPS | 50-100 | Single-writer bottleneck on NVMe SSD |
| SQLITE_BUSY retry budget | 3 attempts | Exponential backoff: 10ms, 50ms, 200ms |

**Mitigation strategy if throughput ceiling is reached:**
1. **First:** Profile actual transaction durations; minimize round-trips within `BEGIN IMMEDIATE` blocks (single compound SQL statement preferred).
2. **Second:** Implement a dedicated writer queue — single Node.js async worker processes all billing writes sequentially, with callers awaiting a promise. This eliminates SQLITE_BUSY entirely by removing write contention.
3. **Third (if queue insufficient):** Accept finalize asynchronously — return `202 Accepted` with a finalize receipt, process via durable BullMQ queue, notify via callback/polling. This decouples billing write latency from the inference response path.
4. **Last resort:** Migrate hot-path tables (credit_lots, credit_reservations, credit_ledger) to PostgreSQL. This is a significant effort and only warranted if sustained write TPS exceeds ~200.

**Load test requirement (Sprint 1):** Run 50 concurrent reserve/finalize cycles against a test SQLite database. Measure p50/p99 latency and max TPS. If p99 > 100ms, implement the writer queue before Sprint 2.

**Global Tables:** PostgreSQL via postgres/pg / Drizzle ORM
- User identities, eligibility data (existing)
- No new PostgreSQL tables for billing — all billing state in SQLite

**Cache Layer:** Redis via ioredis
- Balance cache keys: `balance:{account_id}:{pool_id}`
- Existing budget counter keys: `agent:budget:*`

### 3.2 Migration Plan

Four new SQLite migrations, numbered to follow the existing sequence (last is 021_crypto_payments):

#### Migration 030: Credit Ledger Foundation

Creates the core financial tables: `credit_accounts`, `credit_lots`, `credit_balances`, `credit_ledger`, `reservation_lots`.

```sql
-- credit_accounts: Entity-level billing accounts
CREATE TABLE credit_accounts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'agent', 'person', 'community', 'mod', 'protocol', 'foundation', 'commons'
  )),
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id)
);

-- credit_lots: Individual credit buckets with pool restrictions and expiry
CREATE TABLE credit_lots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'deposit', 'grant', 'purchase', 'transfer_in', 'commons_dividend'
  )),
  source_id TEXT,
  original_micro INTEGER NOT NULL,
  available_micro INTEGER NOT NULL DEFAULT 0,
  reserved_micro INTEGER NOT NULL DEFAULT 0,
  consumed_micro INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT lot_balance CHECK (available_micro >= 0 AND reserved_micro >= 0 AND consumed_micro >= 0),
  CONSTRAINT lot_invariant CHECK (available_micro + reserved_micro + consumed_micro = original_micro)
);

CREATE INDEX idx_credit_lots_redemption
  ON credit_lots(account_id, pool_id, expires_at)
  WHERE available_micro > 0;

CREATE INDEX idx_credit_lots_account
  ON credit_lots(account_id);

-- Prevents double-crediting: one lot per external payment event
CREATE UNIQUE INDEX idx_credit_lots_source
  ON credit_lots(source_type, source_id)
  WHERE source_id IS NOT NULL;

-- credit_balances: Derived cache (rebuilt from lots)
CREATE TABLE credit_balances (
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT,
  available_micro INTEGER NOT NULL DEFAULT 0,
  reserved_micro INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(account_id, pool_id)
);

-- credit_ledger: Append-only financial event log
CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT,
  lot_id TEXT REFERENCES credit_lots(id),
  reservation_id TEXT,
  entry_seq INTEGER NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'deposit', 'reserve', 'finalize', 'release', 'refund',
    'grant', 'shadow_charge', 'shadow_reserve', 'shadow_finalize',
    'commons_contribution', 'revenue_share',
    'marketplace_sale', 'marketplace_purchase',
    'escrow', 'escrow_release'
  )),
  amount_micro INTEGER NOT NULL,
  idempotency_key TEXT UNIQUE,
  description TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, pool_id, entry_seq)
);

CREATE INDEX idx_credit_ledger_account
  ON credit_ledger(account_id, created_at DESC);

CREATE INDEX idx_credit_ledger_reservation
  ON credit_ledger(reservation_id)
  WHERE reservation_id IS NOT NULL;

-- credit_account_seq: Atomic sequence counter per (account_id, pool_id)
-- Replaces MAX(entry_seq)+1 pattern which is unsafe under concurrent writers
CREATE TABLE credit_account_seq (
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT NOT NULL DEFAULT '__all__',
  next_seq INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(account_id, pool_id)
);

-- credit_reservations: Canonical reservation lifecycle record
-- Without this, reservation_lots alone cannot express status (pending/finalized/released/expired)
CREATE TABLE credit_reservations (
  id TEXT PRIMARY KEY,                     -- reservation_id
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT,
  total_reserved_micro INTEGER NOT NULL,   -- Sum of all reservation_lots for this reservation
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'finalized', 'released', 'expired'
  )),
  billing_mode TEXT NOT NULL DEFAULT 'live' CHECK (billing_mode IN (
    'shadow', 'soft', 'live'
  )),
  expires_at TEXT NOT NULL,                -- created_at + TTL
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finalized_at TEXT,
  idempotency_key TEXT UNIQUE             -- Prevents duplicate reservations for same operation
);

CREATE INDEX idx_credit_reservations_expiry
  ON credit_reservations(expires_at)
  WHERE status = 'pending';

CREATE INDEX idx_credit_reservations_account
  ON credit_reservations(account_id, created_at DESC);

-- reservation_lots: Per-lot allocation tracking for multi-lot reserves
CREATE TABLE reservation_lots (
  reservation_id TEXT NOT NULL REFERENCES credit_reservations(id),
  lot_id TEXT NOT NULL REFERENCES credit_lots(id),
  reserved_micro INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(reservation_id, lot_id)
);

-- credit_debts: Tracks refund liabilities when lot is partially consumed
CREATE TABLE credit_debts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT,
  debt_micro INTEGER NOT NULL,            -- Outstanding refund liability
  source_payment_id TEXT,                 -- crypto_payments.id that triggered the refund
  source_lot_id TEXT REFERENCES credit_lots(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,                       -- Set when debt paid down by future deposits
  CONSTRAINT positive_debt CHECK (debt_micro > 0)
);

CREATE INDEX idx_credit_debts_account
  ON credit_debts(account_id)
  WHERE resolved_at IS NULL;
```

**Entry sequence allocation:** The `credit_account_seq` table replaces the `COALESCE(MAX(entry_seq), 0) + 1` pattern. Within a `BEGIN IMMEDIATE` transaction:
1. `UPDATE credit_account_seq SET next_seq = next_seq + 1 WHERE account_id = ? AND pool_id = ? RETURNING next_seq - 1 AS seq`
2. If no row exists: `INSERT INTO credit_account_seq (account_id, pool_id, next_seq) VALUES (?, ?, 2)` and use seq=1
3. The returned `seq` is used as `entry_seq` in the ledger INSERT

This is O(1) (single row update) vs O(n) (MAX scan) and eliminates contention from concurrent sequence allocation.

**Reservation lifecycle:** The `credit_reservations` table provides a canonical record for each reservation. The sweeper only expires reservations with `status='pending'` past their `expires_at`. Finalize transitions to `'finalized'`, release transitions to `'released'`. The `idempotency_key` prevents duplicate reservations. Only the reservation creator (matched via `account_id`) can finalize or release.

**Refund debt model:** When a refund arrives for a partially-consumed lot (lot's `available_micro < refund_amount`), the shortfall is recorded in `credit_debts`. Future deposits to the same account first pay down outstanding debts before crediting the balance. This prevents balance inflation from refund-after-consumption scenarios.

**BigInt precision safety (end-to-end):**

SQLite stores all integers as up to 8-byte signed integers (int64, up to 2^63-1). However, JavaScript `number` (IEEE-754 double) only has 53 bits of integer precision (2^53-1 = ~$9B at micro-USD). To prevent silent precision loss:

1. **Drizzle schema:** All `_micro` columns use `integer(name, { mode: 'bigint' })` which stores as SQLite INTEGER (matching DDL) but returns TypeScript `bigint` values, not `number`. This avoids the default Drizzle `integer()` → JS `number` conversion that would lose precision above 2^53. Requires drizzle-orm >= 0.30.0 (current: 0.45.1).
2. **TypeScript:** All monetary arithmetic uses `BigInt` — no `Number` conversion for amounts. Zod schemas validate with `z.coerce.bigint()`.
3. **REAL columns are display-only:** The legacy `price_amount`, `pay_amount`, `actually_paid` REAL columns in `crypto_payments` are retained for backward compatibility but are **never used for financial calculations**. The canonical amount is `amount_usd_micro` (integer). On `finished` webhook, the USD-equivalent is converted to micro-USD once via `Math.round(priceAmount * 1_000_000)` and stored as `amount_usd_micro`.
4. **Runtime guard:** `assertMicroUSD(value: bigint)` rejects negative amounts and values exceeding a configurable ceiling (default: 1_000_000_000_000n = $1M, adjustable).
5. **JSON serialization:** BigInt values are serialized as strings in API responses (`"available_micro": "5000000"`) to prevent JSON.stringify precision loss. Client SDKs parse with `BigInt()`.

**Note:** At micro-USD precision, $9.2 trillion fits in int64 — far beyond any practical balance. The BigInt requirement is defensive: it prevents a class of bugs where intermediate sums or aggregations might temporarily exceed 2^53 during reconciliation or batch operations.

#### Migration 031: Crypto Payments V2

Extends the existing `crypto_payments` table (migration 021) with new columns for the credit ledger integration. Uses SQLite table recreation pattern (same approach as 021).

```sql
-- Drop and recreate with new columns
-- Preserve existing data via INSERT...SELECT

-- PRAGMA foreign_keys must be OFF during table recreation, then re-enabled after
PRAGMA foreign_keys = OFF;

CREATE TABLE crypto_payments_v2 (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'nowpayments'
    CHECK (provider IN ('nowpayments', 'x402')),
  provider_payment_id TEXT NOT NULL,
  provider_invoice_id TEXT,
  -- Legacy column preserved for backward compatibility with existing code paths
  -- New code should use provider_payment_id; payment_id is kept as a generated alias
  payment_id TEXT GENERATED ALWAYS AS (provider_payment_id) STORED,
  account_id TEXT REFERENCES credit_accounts(id),
  -- Existing columns preserved (all from migration 021)
  community_id TEXT REFERENCES communities(id),
  tier TEXT CHECK (tier IS NULL OR tier IN (
    'starter', 'basic', 'premium', 'exclusive', 'elite', 'enterprise'
  )),
  price_amount REAL,                        -- Display-only; NOT used for financial math
  price_currency TEXT NOT NULL DEFAULT 'usd',
  pay_amount REAL,                          -- Display-only; NOT used for financial math
  pay_currency TEXT,
  pay_address TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN (
    'waiting', 'confirming', 'confirmed', 'sending',
    'partially_paid', 'finished', 'failed', 'refunded', 'expired'
  )),
  actually_paid REAL,                       -- Display-only; NOT used for financial math
  -- New columns
  amount_usd_micro INTEGER,                 -- Canonical financial amount (micro-USD BigInt)
  lot_id TEXT REFERENCES credit_lots(id),
  raw_payload TEXT,
  order_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  finished_at TEXT,
  UNIQUE(provider, provider_payment_id)
);

-- Migrate existing data
INSERT INTO crypto_payments_v2 (
  id, provider, provider_payment_id, community_id, tier,
  price_amount, price_currency, pay_amount, pay_currency,
  pay_address, status, actually_paid, order_id,
  created_at, updated_at, expires_at, finished_at
)
SELECT
  id, 'nowpayments', payment_id, community_id, tier,
  price_amount, price_currency, pay_amount, pay_currency,
  pay_address, status, actually_paid, order_id,
  created_at, updated_at, expires_at, finished_at
FROM crypto_payments;

-- Post-migration verification (run before DROP)
-- SELECT COUNT(*) FROM crypto_payments_v2 must equal SELECT COUNT(*) FROM crypto_payments
-- SELECT COUNT(*) FROM crypto_payments_v2 WHERE payment_id IS NULL must be 0

DROP TABLE crypto_payments;
ALTER TABLE crypto_payments_v2 RENAME TO crypto_payments;

PRAGMA foreign_keys = ON;

-- Recreate all indexes from migration 021 + new indexes
CREATE INDEX idx_crypto_payments_provider_id
  ON crypto_payments(provider, provider_payment_id);
CREATE INDEX idx_crypto_payments_payment_id
  ON crypto_payments(payment_id);              -- Legacy compat index
CREATE INDEX idx_crypto_payments_account
  ON crypto_payments(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_crypto_payments_status
  ON crypto_payments(status);
CREATE INDEX idx_crypto_payments_community
  ON crypto_payments(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX idx_crypto_payments_community_status
  ON crypto_payments(community_id, status);    -- From migration 021
CREATE INDEX idx_crypto_payments_created_at
  ON crypto_payments(created_at DESC);         -- From migration 021
CREATE INDEX idx_crypto_payments_order_id
  ON crypto_payments(order_id);                -- From migration 021
```

**Migration 031 Rollback Procedure:**

Migration 031 uses a destructive table recreation pattern (`DROP TABLE crypto_payments`). A documented rollback procedure is critical for production billing data.

```
Pre-migration:
1. MANDATORY: Create full SQLite backup before running migration
   $ cp themes/sietch/data/community.db themes/sietch/data/community.db.pre-031
2. Verify backup integrity:
   $ sqlite3 themes/sietch/data/community.db.pre-031 "PRAGMA integrity_check; SELECT COUNT(*) FROM crypto_payments;"
3. Record pre-migration row count for post-migration verification

Post-migration verification:
1. SELECT COUNT(*) FROM crypto_payments; -- must match pre-migration count
2. SELECT COUNT(*) FROM crypto_payments WHERE payment_id IS NULL; -- must be 0
3. PRAGMA foreign_key_check; -- must return no violations
4. PRAGMA integrity_check; -- must return 'ok'

Rollback (if verification fails):
1. Stop the Sietch API process
2. Restore from backup:
   $ cp themes/sietch/data/community.db.pre-031 themes/sietch/data/community.db
3. Verify restored database:
   $ sqlite3 themes/sietch/data/community.db "PRAGMA integrity_check; SELECT COUNT(*) FROM crypto_payments;"
4. Restart Sietch API (code must be reverted to pre-031 version)
5. Investigate failure cause before re-attempting

NOTE: Migration 031 is NOT idempotent. If it partially fails (e.g., after DROP but
before INSERT...SELECT completes), the only recovery path is the backup. The backup
step is therefore NON-OPTIONAL.
```

#### Migration 032: Campaign Engine

```sql
CREATE TABLE credit_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN (
    'reverse_airdrop', 'promotional', 'referral', 'commons_grant'
  )),
  reciprocity_type TEXT,
  community_id TEXT,
  pool_restriction TEXT,
  budget_micro INTEGER NOT NULL,
  spent_micro INTEGER NOT NULL DEFAULT 0,
  grant_formula TEXT,
  eligible_count INTEGER DEFAULT 0,
  granted_count INTEGER DEFAULT 0,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'active', 'paused', 'completed', 'expired'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE credit_grants (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES credit_campaigns(id),
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  amount_micro INTEGER NOT NULL,
  loss_data TEXT,
  transferable INTEGER NOT NULL DEFAULT 0,
  ledger_entry_id TEXT REFERENCES credit_ledger(id),
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, account_id)
);

CREATE INDEX idx_credit_grants_campaign
  ON credit_grants(campaign_id);
CREATE INDEX idx_credit_grants_account
  ON credit_grants(account_id);
```

#### Migration 033: Billing Operations

```sql
-- DLQ for failed operations
CREATE TABLE billing_dlq (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'webhook_processing', 'revenue_distribution', 'lot_creation', 'balance_sync'
  )),
  payload TEXT NOT NULL,
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'manual_review'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_billing_dlq_status
  ON billing_dlq(status, next_retry_at)
  WHERE status IN ('pending', 'processing');

-- Admin audit log for grant operations
CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY,
  caller_identity TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_admin_audit_log_created
  ON admin_audit_log(created_at DESC);

-- Billing system configuration (runtime-modifiable)
CREATE TABLE billing_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default config
-- Rates stored as basis points (integer) to enable deterministic integer-only distribution math.
-- 1 basis point = 0.01%. 50 bps = 0.5%. 1500 bps = 15%.
INSERT INTO billing_config (key, value) VALUES
  ('commons_rate_bps', '50'),              -- 0.5% = 50 basis points
  ('community_rate_bps', '1500'),          -- 15% = 1500 basis points
  ('reserve_safety_multiplier_pct', '150'),-- 1.5x = 150%
  ('reserve_ttl_seconds', '300'),
  ('overrun_alert_threshold_pct', '5'),    -- 5%
  ('billing_mode', 'shadow');

-- Revenue distribution uses deterministic integer math:
--   commons_share = (charge_micro * commons_rate_bps) / 10000
--   community_share = (charge_micro * community_rate_bps) / 10000
--   foundation_share = charge_micro - commons_share - community_share
-- Integer division truncates; foundation absorbs remainder.
-- Invariant: commons + community + foundation = charge (always exact).
```

### 3.3 Data Access Patterns

| Query | Frequency | Optimization |
|-------|-----------|--------------|
| Get balance (read) | Very High (~100/s) | Redis cache `balance:{account_id}:{pool_id}` |
| Reserve from lots (write) | High (~10/s) | `BEGIN IMMEDIATE` + redemption index |
| Finalize (write) | High (~10/s) | `reservation_lots` lookup by reservation_id |
| Webhook upsert | Low (~1/min) | UNIQUE constraint on (provider, provider_payment_id) |
| Ledger history | Medium (~1/s) | Index on (account_id, created_at DESC) |
| Reconciliation | Low (periodic) | Full table scans, acceptable at scheduled intervals |
| Batch grants | Low (~1/day) | Bulk INSERT within single transaction |

### 3.4 Caching Strategy

| Data | Cache Location | Write Strategy | Invalidation | TTL |
|------|---------------|----------------|--------------|-----|
| Account balance | Redis `balance:{acct}:{pool}` | Write-through (SQLite → Redis) | Overwrite on every write | None (persistent) |
| Budget counters | Redis `agent:budget:*` | Direct (Lua scripts) | TTL-based | Monthly rollover |
| Entitlements | Redis (existing GatekeeperService) | Event-driven | Subscription change webhook | 5 min |

**Critical invariant:** Reserve authorization ALWAYS reads from SQLite within the write transaction, never from Redis alone. Redis is for display and rate-limiting only.

### 3.5 Drizzle Schema Definitions

New Drizzle schema file: `themes/sietch/src/db/schema/billing.ts`

```typescript
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// Helper: all monetary columns use integer({ mode: 'bigint' }) which:
// - Stores as SQLite INTEGER (int64 affinity, matching the DDL)
// - Deserializes to TypeScript bigint (not JS number)
// This is the correct Drizzle SQLite API for int64-as-bigint mapping.
// Requires drizzle-orm >= 0.30.0 (current: 0.45.1).
const microUSD = (name: string) => integer(name, { mode: 'bigint' });

export const creditAccounts = sqliteTable('credit_accounts', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  version: integer('version').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  entityUnique: uniqueIndex('idx_credit_accounts_entity')
    .on(table.entityType, table.entityId),
}));

export const creditLots = sqliteTable('credit_lots', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => creditAccounts.id),
  poolId: text('pool_id'),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  originalMicro: microUSD('original_micro').notNull(),
  availableMicro: microUSD('available_micro').notNull().default(0n),
  reservedMicro: microUSD('reserved_micro').notNull().default(0n),
  consumedMicro: microUSD('consumed_micro').notNull().default(0n),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  redemptionIdx: index('idx_credit_lots_redemption')
    .on(table.accountId, table.poolId, table.expiresAt),
  // NOTE: The partial unique index (WHERE source_id IS NOT NULL) for deposit
  // idempotency CANNOT be expressed in Drizzle's index API. It is created via
  // raw SQL in migration 030. The Drizzle schema omits it intentionally to
  // avoid creating a non-partial unique index that would over-constrain NULLs.
  // See migration 030 DDL: CREATE UNIQUE INDEX idx_credit_lots_source
  //   ON credit_lots(source_type, source_id) WHERE source_id IS NOT NULL;
}));

export const creditBalances = sqliteTable('credit_balances', {
  accountId: text('account_id').notNull().references(() => creditAccounts.id),
  poolId: text('pool_id'),
  availableMicro: microUSD('available_micro').notNull().default(0n),
  reservedMicro: microUSD('reserved_micro').notNull().default(0n),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  pk: uniqueIndex('credit_balances_pk')
    .on(table.accountId, table.poolId),
}));

export const creditAccountSeq = sqliteTable('credit_account_seq', {
  accountId: text('account_id').notNull().references(() => creditAccounts.id),
  poolId: text('pool_id').notNull().default('__all__'),
  nextSeq: integer('next_seq').notNull().default(1),
}, (table) => ({
  pk: uniqueIndex('credit_account_seq_pk')
    .on(table.accountId, table.poolId),
}));

export const creditLedger = sqliteTable('credit_ledger', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => creditAccounts.id),
  poolId: text('pool_id'),
  lotId: text('lot_id').references(() => creditLots.id),
  reservationId: text('reservation_id'),
  entrySeq: integer('entry_seq').notNull(),
  entryType: text('entry_type').notNull(),
  amountMicro: microUSD('amount_micro').notNull(),
  idempotencyKey: text('idempotency_key').unique(),
  description: text('description'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  seqUnique: uniqueIndex('idx_credit_ledger_seq')
    .on(table.accountId, table.poolId, table.entrySeq),
  accountIdx: index('idx_credit_ledger_account')
    .on(table.accountId, table.createdAt),
  reservationIdx: index('idx_credit_ledger_reservation')
    .on(table.reservationId),
}));

export const creditReservations = sqliteTable('credit_reservations', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => creditAccounts.id),
  poolId: text('pool_id'),
  totalReservedMicro: microUSD('total_reserved_micro').notNull(),
  status: text('status').notNull().default('pending'),
  billingMode: text('billing_mode').notNull().default('live'),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  finalizedAt: text('finalized_at'),
  idempotencyKey: text('idempotency_key').unique(),
}, (table) => ({
  // NOTE: The partial index (WHERE status = 'pending') for sweeper performance
  // CANNOT be expressed in Drizzle's SQLite index API. It is created via raw SQL
  // in migration 030. See DDL: CREATE INDEX idx_credit_reservations_expiry
  //   ON credit_reservations(expires_at) WHERE status = 'pending';
  accountIdx: index('idx_credit_reservations_account')
    .on(table.accountId, table.createdAt),
}));

export const reservationLots = sqliteTable('reservation_lots', {
  reservationId: text('reservation_id').notNull()
    .references(() => creditReservations.id),
  lotId: text('lot_id').notNull().references(() => creditLots.id),
  reservedMicro: microUSD('reserved_micro').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  pk: uniqueIndex('reservation_lots_pk')
    .on(table.reservationId, table.lotId),
}));

export const creditDebts = sqliteTable('credit_debts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => creditAccounts.id),
  poolId: text('pool_id'),
  debtMicro: microUSD('debt_micro').notNull(),
  sourcePaymentId: text('source_payment_id'),
  sourceLotId: text('source_lot_id').references(() => creditLots.id),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
}, (table) => ({
  accountIdx: index('idx_credit_debts_account')
    .on(table.accountId),
}));
```

---

## 4. UI Design

**N/A for V1.** The billing system is API-only. No new UI pages, components, or client-side code.

Existing admin dashboard (if any) may display billing data via the new API endpoints, but no frontend changes are in scope. The PRD specifies shadow billing "dashboard shows what you would have paid" — this is a data display concern for a future sprint, not a V1 deliverable.

---

## 5. API Specifications

### 5.1 API Design Principles

- **Style:** REST (consistent with existing Sietch API)
- **Auth:** Bearer token (existing JWT auth) for user endpoints; scoped admin tokens for grant endpoints (see §5.7 for auth details)
- **Validation:** Zod schemas on all request bodies
- **Errors:** Consistent `{ error: { code, message, details? } }` format
- **Idempotency:** `Idempotency-Key` header on all POST endpoints that create resources
- **BigInt serialization:** All `*_micro` fields are serialized as **strings** in JSON responses (e.g., `"available_micro": "5000000"`). Client SDKs parse with `BigInt()`. This prevents JSON.stringify/JSON.parse precision loss for values exceeding 2^53.

#### Rate Limits

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `POST /api/billing/topup` | 10 | per minute | per account |
| `GET /api/billing/balance` | 60 | per minute | per account |
| `GET /api/billing/history` | 30 | per minute | per account |
| `POST /api/crypto/webhook` | 100 | per minute | global (NOWPayments IPs) |
| `POST /admin/billing/campaigns/:id/grants/batch` | 10 | per hour | per campaign |
| `POST /admin/billing/accounts/:id/mint` | 20 | per hour | global |
| `POST /api/internal/billing/finalize` | 200 | per minute | per service (loa-finn) |

Enforcement via existing Express rate limiter middleware (already used for `/invoke`). Returns `429 Too Many Requests` with `Retry-After` header.

### 5.2 Balance & Credit Endpoints

Mounted on existing `billingRouter` (`/api/billing/*`).

#### GET /api/billing/balance

Returns the caller's credit balance across all pools.

```
Authorization: Bearer <jwt>

Response 200:
{
  "account_id": "acct_abc123",
  "balances": [
    {
      "pool_id": null,
      "available_micro": "5000000",
      "reserved_micro": "250000"
    },
    {
      "pool_id": "cheap",
      "available_micro": "2000000",
      "reserved_micro": "0"
    }
  ],
  "total_available_micro": "7000000",
  "total_reserved_micro": "250000"
}
```

#### GET /api/billing/history

Returns ledger entries for the caller's account.

```
Authorization: Bearer <jwt>
Query: ?limit=50&offset=0&pool_id=cheap&entry_type=finalize

Response 200:
{
  "entries": [
    {
      "id": "entry_xyz",
      "entry_type": "finalize",
      "pool_id": "cheap",
      "amount_micro": "-500",
      "description": "Inference: gpt-4o-mini",
      "created_at": "2026-02-14T10:00:00Z"
    }
  ],
  "total": 142,
  "limit": 50,
  "offset": 0
}
```

### 5.3 Top-Up Endpoint

Mounted on `billingRouter`.

#### POST /api/billing/topup

Processes an x402 USDC top-up payment.

```
Authorization: Bearer <jwt>
X-402-Payment: <x402 payment header>

{
  "amount_usd": 10.00
}

Response 200:
{
  "payment_id": "cp_topup_xyz",
  "amount_usd_micro": "10000000",
  "lot_id": "lot_abc",
  "balance": {
    "available_micro": "15000000",
    "reserved_micro": "0"
  }
}

Response 402 (insufficient/missing payment):
{
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "x402 payment required",
    "details": {
      "topup_amount": "5.00",
      "currency": "USDC",
      "chain": "base",
      "facilitator": "<coinbase_facilitator_address>"
    }
  }
}
```

### 5.4 Webhook Endpoints

Mounted on existing `cryptoBillingRouter` (`/api/crypto/*`).

#### POST /api/crypto/webhook

Existing endpoint — wired to credit ledger in this cycle.

```
Headers: x-nowpayments-sig: <hmac_signature>
Body: raw JSON (preserved by existing Express middleware)

Processing:
1. Verify HMAC-SHA512 (Strategy A: raw body, fallback Strategy B: sorted-key)
2. Upsert crypto_payments record
3. Validate state transition
4. If 'finished': create lot + deposit entry
5. If 'refunded': clawback lot + refund entry

Response 200: { "status": "ok" }
Response 401: { "error": { "code": "INVALID_SIGNATURE" } }
Response 409: { "error": { "code": "INVALID_TRANSITION" } }
```

### 5.5 Admin Endpoints

Mounted on `billingAdminRouter` (`/admin/billing/*`).

#### POST /admin/billing/campaigns/:campaignId/grants/batch

Batch grant creation for Reverse Airdrop campaigns.

```
Authorization: Bearer <admin_token> (scope: admin:grants:write)
Idempotency-Key: <unique_key>

{
  "grants": [
    {
      "wallet_address": "0xABC...",
      "loss_usd": 150.00,
      "source": "dune_query_123",
      "idempotency_key": "campaign-123-0xABC"
    }
  ]
}

Response 200:
{
  "created": 45,
  "skipped": 3,
  "rejected": 2,
  "total_amount_micro": "48000000",
  "campaign_budget_remaining_micro": "952000000"
}

Response 400: batch_size > 1000, invalid grant data
Response 403: insufficient scope
Response 409: budget exceeded
Response 429: rate limit (10 calls/campaign/hour)
```

#### POST /admin/billing/accounts/:accountId/mint

Mint credits to an account (admin override).

```
Authorization: Bearer <admin_token> (scope: admin:mint:write)

{
  "amount_micro": "5000000",
  "pool_id": null,
  "reason": "Customer support credit",
  "idempotency_key": "support-ticket-456"
}

Response 200:
{
  "lot_id": "lot_mint_xyz",
  "ledger_entry_id": "entry_mint_xyz",
  "balance": { "available_micro": "10000000" }
}
```

#### GET /admin/billing/reconciliation

Run or view reconciliation status.

```
Authorization: Bearer <admin_token> (scope: admin:billing:read)

Response 200:
{
  "last_run": "2026-02-14T06:00:00Z",
  "status": "healthy",
  "checks": {
    "lot_balance_match": { "status": "pass", "accounts_checked": 1234 },
    "orphan_reservations": { "status": "pass", "found": 0 },
    "zero_sum_invariant": { "status": "pass", "distributions_checked": 567 },
    "webhook_deposit_match": { "status": "pass", "unprocessed": 0 }
  }
}
```

### 5.6 S2S (Server-to-Server) Endpoints

Used by loa-finn for usage reporting.

#### POST /api/internal/billing/finalize

Called by loa-finn after inference completion with actual usage.

```
Authorization: Internal JWT (existing mechanism)

{
  "reservation_id": "res_abc123",
  "actual_cost_micro": 750,
  "usage": {
    "model_alias": "cheap",
    "input_tokens": 300,
    "output_tokens": 200,
    "total_tokens": 500
  }
}

Response 200:
{
  "finalized_micro": "750",
  "released_micro": "250",
  "billing_mode": "live"
}
```

### 5.7 Authentication & Authorization Model

#### User Endpoints (`/api/billing/*`)

- **Auth:** Existing JWT auth middleware (already on all `/api/*` routes)
- **Token issuer:** Sietch API (self-issued, `iss: "arrakis-sietch"`)
- **Claims used:** `sub` (user ID) → resolved to `account_id` via `credit_accounts(entity_type='person', entity_id=sub)`
- **No additional auth required** — user can only access their own account data

#### Admin Endpoints (`/admin/billing/*`)

- **Auth:** Scoped bearer tokens with the following properties:
  - **Issuer:** Sietch API admin token generator (CLI tool or admin panel)
  - **Signing:** HMAC-SHA256 with `ADMIN_TOKEN_SECRET` env var (rotated quarterly, minimum 256-bit)
  - **Audience:** `aud: "arrakis-admin"`
  - **Scopes:** Fine-grained: `admin:grants:write`, `admin:mint:write`, `admin:billing:read`
  - **TTL:** 1 hour maximum. Short-lived tokens reduce blast radius.
  - **JTI (JWT ID):** Unique per token, cached in Redis with TTL matching token TTL for replay protection
  - **Validation:** Verify signature, check `exp`, verify `aud`, verify scope for the specific endpoint, check JTI not in replay cache
- **Audit logging:** Every admin action writes to `admin_audit_log` with `caller_identity`, `action`, `resource_type`, `resource_id`, `ip_address`, and before/after balance snapshots in `details` JSON
- **Rate limiting:** Per-endpoint limits (see §5.1 Rate Limits table)

#### Internal S2S Endpoints (`/api/internal/*`)

- **Auth:** Internal JWT (existing mechanism between Sietch and loa-finn)
  - **Signing:** Shared secret via `INTERNAL_JWT_SECRET` env var (separate from admin and user JWT secrets)
  - **Audience:** `aud: "arrakis-internal"`
  - **Issuer:** `iss: "loa-finn"` (validated on receipt)
  - **TTL:** 5 minutes (short-lived, per-request tokens)
  - **No JTI replay protection** — finalize idempotency is handled at the reservation level (`reservation_id` is the idempotency key)
- **Network policy:** In production, internal endpoints should be restricted to loa-finn's IP range or VPC. In development, this is enforced by convention only.

#### Token Rotation Cadence

| Secret | Rotation | Method |
|--------|----------|--------|
| `ADMIN_TOKEN_SECRET` | Quarterly | Manual rotation, all active tokens expire |
| `INTERNAL_JWT_SECRET` | Quarterly | Coordinated rotation between Sietch and loa-finn |
| `NOWPAYMENTS_IPN_SECRET` | On compromise only | Provider-managed |
| User JWT secret | Existing cadence | No change |

---

## 6. Error Handling Strategy

### 6.1 Financial Error Categories

| Category | HTTP Status | Recovery | Example |
|----------|-------------|----------|---------|
| Insufficient Balance | 402 | Client tops up | Reserve exceeds available |
| Invalid Transition | 409 | Log + ignore | Duplicate webhook, state regression |
| Idempotency Hit | 200 (success) | Return existing result | Duplicate reserve/finalize |
| SQLite Busy | 503 + Retry-After | Client retries | Concurrent write contention |
| Redis Failure | N/A (degraded) | Fall back to SQLite | Cache miss, write failure |
| Webhook Verification | 401 | Log + alert | Invalid HMAC signature |
| Budget Exceeded | 409 | Admin reviews | Campaign grant exceeds budget |
| DLQ Entry | N/A (async) | Auto-retry 3x, then manual | Failed distribution posting |

### 6.2 Error Response Format

Consistent with existing Sietch API error format:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Available balance of 500 micro-USD is less than requested reserve of 1000 micro-USD",
    "details": {
      "available_micro": "500",
      "requested_micro": "1000",
      "pool_id": "cheap"
    },
    "request_id": "req_abc123"
  }
}
```

### 6.3 Logging Strategy

All billing operations log structured JSON via Pino (existing):

```typescript
logger.info({
  event: 'billing.reserve',
  account_id: 'acct_abc',
  reservation_id: 'res_xyz',
  amount_micro: 1000,
  pool_id: 'cheap',
  lots_consumed: 2,
  billing_mode: 'live',
  duration_ms: 3.2
});
```

**Financial events** (reserve, finalize, deposit, refund, grant) are logged at `info` level with full context. **Anomalies** (overrun, drift, DLQ entry, invalid transition) are logged at `warn` level. **Failures** (SQLite error, verification failure) are logged at `error` level.

---

## 7. Testing Strategy

### 7.1 Testing Pyramid

| Level | Target | Count (est.) | Tools |
|-------|--------|-------------|-------|
| Unit | Core service logic | ~40 tests | Vitest |
| Conformance | Ledger invariants, FIFO order, idempotency | ~25 tests | Vitest |
| Integration | API endpoints, webhook flow, state transitions | ~20 tests | Vitest + supertest |
| Smoke | NOWPayments sandbox round-trip | ~5 tests | Vitest + real sandbox API |

**Total estimate: ~90 new tests** across 4 categories.

### 7.2 Conformance Test Suite

New file: `tests/conformance/credit-ledger.test.ts`

These tests verify the financial invariants defined in the PRD:

| Test | Invariant Verified |
|------|-------------------|
| `reserve-fifo-order` | Pool-restricted lots consumed before unrestricted; expiring before non-expiring |
| `reserve-atomic-lot-selection` | Concurrent reserves (10 parallel) produce no balance corruption |
| `reserve-sqlite-busy-retry` | SQLITE_BUSY triggers exponential backoff, succeeds within 3 retries |
| `finalize-deterministic` | Finalize allocates Y across lots in same FIFO order as reserve |
| `finalize-surplus-release` | Y < X releases surplus on last lots consumed |
| `finalize-overrun-shadow` | Y > X in shadow mode logs overrun without balance impact |
| `finalize-overrun-soft` | Y > X in soft mode allows negative balance |
| `finalize-overrun-live` | Y > X in live mode caps at reserved amount |
| `entry-seq-monotonic` | entry_seq is strictly increasing per (account_id, pool_id) |
| `idempotency-reserve` | Duplicate reservation_id returns existing reservation |
| `idempotency-finalize` | Duplicate finalize returns success, no double debit |
| `lot-invariant` | `available + reserved + consumed = original` for every lot |
| `balance-cache-consistency` | `credit_balances` matches `SUM(credit_lots)` after every operation |
| `zero-sum-distribution` | Revenue distribution entries sum to zero |
| `reservation-ttl-sweep` | Expired reservations are released by sweeper |
| `webhook-state-machine` | Only valid transitions accepted; forward jumps allowed; no regression |
| `webhook-idempotency` | Duplicate `finished` webhook creates only one deposit |
| `refund-clawback` | Refund deducts from lot, tracks refund_debt if partially consumed |
| `redis-fallback` | Reserve works correctly when Redis is unavailable |
| `redis-reconciliation` | Drift between Redis and SQLite is detected and corrected |

### 7.3 Smoke Test Suite (NOWPayments Sandbox)

New file: `tests/smoke/nowpayments-sandbox.test.ts`

Requires `NOWPAYMENTS_SANDBOX_API_KEY` and `NOWPAYMENTS_SANDBOX_IPN_SECRET` env vars.

| Test | What It Validates |
|------|-------------------|
| `create-payment` | Payment created, returns pay_address and amount |
| `webhook-signature-a` | Raw body HMAC-SHA512 verification (Strategy A) |
| `webhook-signature-b` | Sorted-key HMAC-SHA512 verification (Strategy B) |
| `webhook-to-deposit` | Finished webhook creates credit_lot + ledger entry |
| `duplicate-webhook` | Second finished webhook is idempotent (no duplicate deposit) |

### 7.4 Integration Test Setup

Tests use an in-memory SQLite database (`:memory:`) with migrations applied. Redis is mocked via `ioredis-mock` for unit tests, real Redis for integration tests (existing test infrastructure).

---

## 8. Development Phases

Mapped to the 6 sprints defined in PRD §8.

### Sprint 1: Credit Ledger Foundation + NOWPayments Smoke (P0)

**Goal:** Core financial infrastructure + payment validation.

- [ ] Migration 030: credit_accounts, credit_lots (with consumed_micro + CHECK constraints), credit_balances, credit_ledger, credit_account_seq, credit_reservations, reservation_lots, credit_debts
- [ ] Drizzle schema definitions (`db/schema/billing.ts`) with `integer(name, { mode: 'bigint' })` for all monetary columns
- [ ] `assertMicroUSD()` runtime guard and BigInt serialization helpers
- [ ] `ICreditLedgerService` port definition
- [ ] `CreditLedgerAdapter` implementation (reserve, finalize, release, getBalance)
- [ ] Atomic lot selection with `BEGIN IMMEDIATE`
- [ ] Entry_seq allocation via `credit_account_seq` counter table (atomic UPDATE...RETURNING)
- [ ] `credit_reservations` lifecycle management (pending → finalized/released/expired)
- [ ] Redis balance cache (write-through)
- [ ] Reservation TTL sweeper (BullMQ job) — only sweeps `status='pending'` past `expires_at`
- [ ] NOWPayments sandbox smoke tests (5 tests)
- [ ] Conformance tests for ledger invariants (~15 tests)

**Dependencies:** NOWPayments sandbox account (human blocker).
**Acceptance criteria:** All 20 conformance + smoke tests pass. Concurrent reserve test (10 parallel) shows no corruption.

### Sprint 2: x402 Integration + Payment Wiring (P0)

**Goal:** Connect payments to the credit ledger.

- [ ] Migration 031: crypto_payments_v2 (extends existing table)
- [ ] `X402PaymentAdapter` using `@x402/server`
- [ ] Express middleware for x402 (`x402Middleware`)
- [ ] `POST /api/billing/topup` endpoint
- [ ] `IPaymentService` port + adapter (webhook processing, state machine)
- [ ] Wire NOWPayments webhook to credit ledger (lot creation on `finished`)
- [ ] Payment state machine with allowed transitions
- [ ] Refund/clawback logic with `credit_debts` for partially-consumed lot refunds
- [ ] Upgrade `@0xhoneyjar/loa-hounfour` to v3.0.0
- [ ] Integration tests for webhook → deposit flow (~10 tests)

**Dependencies:** Sprint 1, Coinbase CDP account (human blocker for x402).
**Acceptance criteria:** NOWPayments webhook creates lot + deposit. x402 top-up creates lot + deposit. State machine rejects invalid transitions.

### Sprint 3: Shadow Billing + Feature Flag (P0)

**Goal:** Enable billing in observation mode.

- [ ] `BillingMiddleware` (mode-aware: shadow/soft/live)
- [ ] Shadow billing on `/invoke` route (shadow_reserve → inference → shadow_finalize)
- [ ] `BILLING_MODE=shadow` environment variable
- [ ] `FEATURE_BILLING_ENABLED=true` flag activation
- [ ] Revenue distribution posting (commons + community + foundation)
- [ ] `RevenueDistributionService` with zero-sum invariant
- [ ] Overrun handling per billing mode (shadow/soft/live)
- [ ] Balance reconciliation job (every 5 min)
- [ ] Daily reconciliation job (4 checks)
- [ ] DLQ table + processor
- [ ] Conformance tests for distribution + overrun (~10 tests)

**Dependencies:** Sprint 2.
**Acceptance criteria:** Shadow billing logs charges for 7+ days without affecting real balances. Zero-sum invariant holds for all distribution postings. Reconciliation detects and corrects drift.

### Sprint 4: Campaign Engine + Discount System (P1)

**Goal:** Reverse Airdrop infrastructure.

- [ ] Migration 032: credit_campaigns, credit_grants
- [ ] `ICampaignService` port + adapter
- [ ] Grant formula evaluation (proportional_loss, fixed_amount, tiered)
- [ ] `POST /admin/billing/campaigns/:id/grants/batch` endpoint
- [ ] Migration 033: billing_dlq, admin_audit_log, billing_config
- [ ] Admin audit logging
- [ ] Budget enforcement, per-wallet cap, rate limiting, batch size limit
- [ ] Gamified discount engine (community membership → discount percentage)
- [ ] Admin `POST /admin/billing/accounts/:id/mint` endpoint
- [ ] Integration tests for batch grants (~5 tests)

**Dependencies:** Sprint 1 (credit ledger).
**Acceptance criteria:** Batch grant creates lots with pool restrictions and expiry. Budget enforcement rejects over-budget batches. Audit log records all admin actions.

### Sprint 5: Collab.Land Displacement + GTM (P2)

**Goal:** Competitive positioning infrastructure.

- [ ] Feature comparison matrix (arrakis vs Collab.Land)
- [ ] Migration path documentation for Collab.Land communities
- [ ] Community onboarding flow with setup fee (0.01 ETH)
- [ ] `GET /api/billing/pricing` endpoint (public pricing page data)
- [ ] `GET /admin/billing/reconciliation` endpoint
- [ ] Billing dashboard data endpoints (shadow billing summary)
- [ ] Operational runbook for billing system

**Dependencies:** Sprint 3 (billing live in shadow mode).

### Sprint 6: Agent Wallet Exploration — ERC-6551 (P2)

**Goal:** Prototype agent-owned wallets (parallel track).

- [ ] ERC-6551 token-bound account research
- [ ] Prototype: agent holds USDC, pays for own inference
- [ ] `entity_type: 'agent'` account creation flow
- [ ] lobster.cash API evaluation
- [ ] Technical feasibility report

**Dependencies:** None (independent track).

---

## 9. Known Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NOWPayments sandbox unavailable | Medium | High (blocks Sprint 1 smoke tests) | Ledger can be tested independently; smoke tests deferred |
| SQLite contention under load | Low | Medium (503 errors) | `BEGIN IMMEDIATE` + exponential backoff; Turso single-writer topology |
| Redis cache drift | Low | Low (display inconsistency) | 5-min reconciliation; reserve always reads SQLite |
| x402 library compatibility | Medium | Medium (blocks Sprint 2) | `@x402/server` is framework-agnostic; worst case, verify manually |
| loa-hounfour v3.0.0 not merged | Low | Low (can use branch ref) | PR is flatline-achieved with 370 tests |
| Overrun rate > 5% | Medium | Medium (revenue leakage) | 1.5x safety multiplier; mid-stream incremental reserve; per-pool tuning |
| Migration 031 data loss | Low | Critical | Full backup before migration; INSERT...SELECT preserves all existing data |

---

## 10. Open Questions

| # | Question | Owner | Status | Proposed Resolution |
|---|----------|-------|--------|-------------------|
| 1 | Which HMAC strategy does NOWPayments actually use? | Sprint 1 smoke tests | Open | Test both strategies against real sandbox; remove non-matching |
| 2 | Coinbase facilitator fee at scale? | Product | Open | Free tier covers launch; $99/month paid tier at 1K+ communities |
| 3 | Community revenue share — flat 15% or tiered? | Product | Open | Start flat 15%, add tiers in V2 based on data |
| 4 | Commons rate — 0.5% or configurable per pool? | Product | Open | Start 0.5% global; `billing_config` table allows per-pool override later |
| 5 | Shadow billing dashboard — which metrics? | Product | Deferred | V1 collects data; dashboard is a future sprint |

---

## 11. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| micro-USD | 1 USD = 1,000,000 micro-USD. BigInt precision eliminates floating-point rounding. |
| lot | An individual credit bucket with pool restrictions, expiry, and provenance tracking. |
| pool | A model routing tier (cheap, fast-code, reviewer, reasoning, architect). |
| reserve | Pre-authorize spending before inference — deducts from `available_micro`, adds to `reserved_micro`. |
| finalize | Confirm actual cost after inference — converts reserved to consumed. |
| release | Cancel a reservation — returns reserved amount to available. |
| FIFO redemption | Consume lots ordered by: pool-restricted first, then unrestricted; soonest-expiring first. |
| shadow billing | Log hypothetical charges without affecting balances. |
| DLQ | Dead Letter Queue — failed async operations queued for retry. |
| commons | System-level account receiving 0.5% of all finalized charges, funding free-tier access. |

### B. File Map (New Files)

| File | Purpose |
|------|---------|
| `themes/sietch/src/db/schema/billing.ts` | Drizzle schema for all billing tables |
| `themes/sietch/src/db/migrations/030_credit_ledger.ts` | Core ledger tables |
| `themes/sietch/src/db/migrations/031_crypto_payments_v2.ts` | Extend crypto_payments |
| `themes/sietch/src/db/migrations/032_campaigns.ts` | Campaign + grants tables |
| `themes/siecht/src/db/migrations/033_billing_ops.ts` | DLQ, audit, config tables |
| `themes/sietch/src/packages/core/ports/ICreditLedgerService.ts` | Credit ledger port |
| `themes/sietch/src/packages/core/ports/IPaymentService.ts` | Payment orchestration port |
| `themes/sietch/src/packages/core/ports/ICampaignService.ts` | Campaign engine port |
| `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts` | SQLite + Redis implementation |
| `themes/sietch/src/packages/adapters/billing/X402PaymentAdapter.ts` | x402 verification |
| `themes/sietch/src/packages/adapters/billing/PaymentServiceAdapter.ts` | Payment orchestration |
| `themes/sietch/src/packages/adapters/billing/CampaignAdapter.ts` | Campaign engine |
| `themes/sietch/src/packages/adapters/billing/RevenueDistributionService.ts` | Zero-sum posting |
| `themes/sietch/src/api/middleware/billing-guard.ts` | Balance check middleware |
| `themes/sietch/src/api/middleware/x402-middleware.ts` | x402 top-up gate |
| `themes/sietch/src/api/middleware/shadow-billing.ts` | Shadow mode hook |
| `themes/sietch/src/api/routes/billing-routes.ts` | Balance, history, topup endpoints |
| `themes/sietch/src/api/routes/billing-admin-routes.ts` | Admin grant, mint, reconciliation |
| `themes/sietch/src/jobs/reservation-sweeper.ts` | BullMQ: expired reservation cleanup |
| `themes/sietch/src/jobs/balance-reconciler.ts` | BullMQ: Redis ↔ SQLite sync |
| `themes/sietch/src/jobs/dlq-processor.ts` | BullMQ: failed operation retry |
| `tests/conformance/credit-ledger.test.ts` | ~25 financial invariant tests |
| `tests/smoke/nowpayments-sandbox.test.ts` | ~5 sandbox round-trip tests |
| `tests/integration/billing-api.test.ts` | ~20 endpoint integration tests |

### C. Existing Files Modified

| File | Changes |
|------|---------|
| `themes/sietch/src/api/server.ts` | Mount new billing routes; add billing middleware to `/invoke` |
| `themes/sietch/src/packages/adapters/billing/NOWPaymentsAdapter.ts` | Add credit ledger integration on webhook processing |
| `themes/sietch/src/packages/adapters/billing/index.ts` | Export new adapters |
| `themes/sietch/src/types/billing.ts` | Add credit account types, lot types, ledger entry types |
| `themes/sietch/package.json` | Add `@x402/server`, upgrade `@0xhoneyjar/loa-hounfour` to v3.0.0 |
| `packages/adapters/agent/budget-manager.ts` | Bridge to credit ledger for finalize reporting |
| `.env.example` | Add `BILLING_MODE`, `NOWPAYMENTS_*`, `X402_*` variables |

### D. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-14 | Initial version — Billing & Payments architecture |
| 1.1.0 | 2026-02-14 | GPT-5.2 review fixes: BigInt end-to-end precision (blob mode), credit_account_seq counter table, consumed_micro on lots, credit_reservations lifecycle table, credit_debts for refund liability, deposit idempotency UNIQUE index, basis-point integer rates, migration 031 backward compat (payment_id alias + PRAGMA + verification) |
| 1.2.0 | 2026-02-14 | Flatline Protocol integrations: FIFO lot selection algorithm with SQL (IMP-003), reservation state machine with failure modes (SKP-003), cost overrun behavior per billing mode (IMP-008), rate limits for all billing endpoints (IMP-002), BigInt-as-string JSON serialization in all API examples (SKP-002), x402 on-chain verification rules (SKP-005), §5.7 Authentication & Authorization model with scopes/JTI/rotation (SKP-007), webhook single-strategy enforcement (SKP-004), SQLite write throughput SLOs with escalation path (SKP-001), Migration 031 rollback procedure (IMP-007), Sprint 1 blob→integer typo fix (IMP-001) |

---

*Generated by Architecture Designer Agent for cycle-025. Grounded in PRD v1.3.0 (892 lines, 12 Flatline integrations), codebase reality (api.md, database.md), and direct code inspection of existing billing infrastructure.*

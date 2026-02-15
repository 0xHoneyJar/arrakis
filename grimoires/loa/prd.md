# PRD: Billing & Payments — Path to Revenue

**Version:** 1.3.0
**Cycle:** 025
**Date:** 2026-02-14
**Status:** Draft
**References:** [RFC #62](https://github.com/0xHoneyJar/arrakis/issues/62) · [loa-hounfour PR #1](https://github.com/0xHoneyJar/loa-hounfour/pull/1) · [loa-finn #66](https://github.com/0xHoneyJar/loa-finn/issues/66) · Bridgebuilder Reviews BB-62-001 through BB-62-035

---

## 1. Problem Statement

Arrakis has no way to collect money. The billing infrastructure is 90% built — 153 conformance tests, a BigInt micro-USD budget engine, a crypto payment adapter, 6 subscription tiers with 17 gated features, atomic Redis/Lua reserve-finalize scripts — but 0% live. `FEATURE_BILLING_ENABLED=false` is the single biggest business risk.

**Constraints that define the solution space:**

1. **BVI entity** — Stripe does not support BVI. Paddle applied, never responded. Traditional payment processors are not available.
2. **Web3 launch** — Crypto payments are natural for the target audience (NFT communities, DAOs, token holders). This is a feature, not a limitation.
3. **Existing budget engine** — `budget-manager.ts` and `budget-unit-bridge.ts` already handle BigInt micro-USD arithmetic with reserve-finalize semantics. 153 conformance tests verify this.
4. **NOWPayments adapter built** — `NOWPaymentsAdapter.ts` was built in Sprint 155-156 but never tested against sandbox. Account not yet created.
5. **x402 protocol available** — Official `@x402/hono` middleware exists for per-request USDC micropayments via Coinbase facilitator. Not yet integrated.
6. **6-level stakeholder model** — Agent, Person, Community, Mod, Protocol, Foundation. Each level both pays and earns.

**What exists vs. what doesn't:**

| Category | Built | Not Built |
|----------|-------|-----------|
| Community billing | PaddleBillingAdapter, NOWPaymentsAdapter, GatekeeperService, webhook HMAC verification | NOWPayments sandbox validation, live flag enablement |
| Agent billing | BigInt budget manager, atomic Redis/Lua scripts, BYOK credential storage, usage reporting | Credit ledger, markup multiplier, x402 middleware |
| Protocol types | loa-hounfour v3.0.0 (PR #1) with billing schemas, BigInt arithmetic, validation pipeline | Arrakis adoption of v3.0.0 billing types |

> Sources: billing-rfc.md, RFC #62 body, reality/api.md, reality/database.md

---

## 2. Goals & Success Metrics

### P0 — Must Ship

| ID | Goal | Metric | Source |
|----|------|--------|--------|
| G-1 | Validate NOWPayments end-to-end in sandbox | Sandbox payment created, webhook received, signature verified, credit_ledger entry written | RFC #62 Phase 0 |
| G-2 | Implement credit ledger system | Append-only ledger with BigInt micro-USD, idempotency keys, reserve-finalize pattern, per-pool balances | RFC #62 Comment 4, BB-62-017 |
| G-3 | Integrate x402 micropayments for agent API | `@x402/hono` middleware on invoke endpoint, USDC on Base, per-model pricing | RFC #62 Phase 1 |
| G-5 | Enable FEATURE_BILLING_ENABLED=true with shadow billing | Shadow mode logs hypothetical charges for 7+ days before soft billing | RFC #62 Phase 0 |
| G-10 | Validate $690/month revenue per community target | Pricing model spreadsheet verified against real model costs with 5x markup | RFC #62 Comment 4 |

### P1 — Should Ship

| ID | Goal | Metric | Source |
|----|------|--------|--------|
| G-4 | Define BillingEntity model (all 6 stakeholder levels) | `credit_accounts` table supports Agent, Person, Community, Mod, Protocol, Foundation entity types | RFC #62 Comment 4 |
| G-6 | Implement gamified discount engine | Community members of onboarded projects receive configurable discounts | RFC #62 body |
| G-11 | Credit system supports pool-restricted balances | `credit_lots` table with per-lot `pool_id` and `expires_at`; FIFO expiry-based redemption across lots | BB-62-017 (Critical) |

### P2 — Architectural Readiness

| ID | Goal | Metric | Source |
|----|------|--------|--------|
| G-7 | Deploy Collab.Land displacement GTM infrastructure | Migration path documented, feature comparison published | RFC #62 body |
| G-8 | Prototype ERC-6551 agent wallets | Agent can hold USDC and pay for own API calls via token-bound account | RFC #62 body, BB-62-034 |
| G-9 | Evaluate lobster.cash for agent banking | API assessment, compatibility report | RFC #62 body |
| G-12 | Campaign engine tracks Reverse Airdrop grants | `credit_campaigns` + `credit_grants` tables with loss data, grant formulas, transferable flag | BB-62-018, BB-62-019 |
| G-13 | Loss oracle batch API endpoint | `POST /api/admin/campaigns/{id}/grants/batch` with idempotency, per-wallet loss data | BB-62-024 |

> Sources: billing-rfc.md goals table, RFC #62 Comments 4-7, Bridgebuilder findings

---

## 3. Users & Stakeholders

### 3.1 Six-Level Stakeholder Matrix

Every stakeholder level has something to pay for AND something to earn. This is not a single-payer system — it's a multi-sided marketplace.

| Level | Pays For | Earns From | Entity Type |
|-------|----------|------------|-------------|
| **Agent** | Inference costs (auto-debited from community/person budget) | Performance-based credits (v2, ERC-6551) | `agent` |
| **Person** | Credit packs, x402 micropayments, BYOK subscription | Reverse Airdrop credits, marketplace credit sales | `person` |
| **Community** | Monthly subscription (NOWPayments), setup fee (0.01 ETH) | Revenue share (15% of member spending), Collab.Land displacement savings | `community` |
| **Mod** | Nothing directly (covered by community) | Moderation credits, elevated tier access | `mod` |
| **Protocol** | x402 per-request (when calling arrakis as an API) | API revenue, platform fees | `protocol` |
| **Foundation** | Infrastructure costs | Transaction fees (5% marketplace), setup fees, subscription margin | `foundation` |

> Sources: RFC #62 body ("stakeholders at every level"), billing-rfc.md stakeholder model, BB-62-030

### 3.2 Primary Personas

| Persona | Context | Key Need |
|---------|---------|----------|
| **Community Admin** | Manages Discord/Telegram community with arrakis agent | Simple crypto payment to keep agent running, budget visibility |
| **Token Holder** | Member of onboarded community who suffered USD losses | Reverse Airdrop credits to try agent for free, option to sell unused credits |
| **Individual User** | Wants to use agent outside community context | Pay-as-you-go via x402 micropayments or credit packs |
| **BYOK Developer** | Brings own API keys, wants arrakis orchestration | $5/month flat subscription, 100% margin for arrakis |
| **Protocol Integrator** | Calls arrakis agent API programmatically | x402 per-request USDC, predictable pricing |

---

## 4. Functional Requirements

### 4.1 Credit Ledger System (G-2, G-4, G-11)

The credit ledger is the single source of truth for all monetary state. Every payment, charge, refund, grant, and transfer is an append-only ledger entry.

#### 4.1.1 Credit Accounts

```sql
CREATE TABLE credit_accounts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,     -- agent | person | community | mod | protocol | foundation | commons
  entity_id TEXT NOT NULL,       -- FK to the entity (community.id, profile.id, etc.)
  version INTEGER NOT NULL DEFAULT 0,  -- Optimistic concurrency
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);
```

**Entity type `commons`** is a system-level account that receives 0.5-2% of all transactions, self-funding acquisition campaigns and free-tier access. One commons account per pool.

> Sources: RFC #62 Comment 4 schema, BB-62-031 (commons pool enrichment)

#### 4.1.2 Credit Lots (FIFO Expiry Model)

Credits are modeled as **lots** — individual buckets with distinct pool restrictions, expiry dates, and provenance. This is required because a single account can hold credits from multiple sources (purchases, grants, campaigns) with different restrictions and lifetimes.

```sql
CREATE TABLE credit_lots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT,                  -- NULL = unrestricted, 'cheap'/'fast-code'/etc. = pool-restricted
  source_type TEXT NOT NULL,     -- deposit | grant | purchase | transfer_in | commons_dividend
  source_id TEXT,                -- FK to grant_id, campaign_id, payment_id, etc.
  original_micro BIGINT NOT NULL,
  available_micro BIGINT NOT NULL DEFAULT 0,
  reserved_micro BIGINT NOT NULL DEFAULT 0,
  expires_at TEXT,               -- NULL = never expires
  created_at TEXT NOT NULL
);

CREATE INDEX idx_credit_lots_redemption
  ON credit_lots(account_id, pool_id, expires_at)
  WHERE available_micro > 0;
```

**Redemption order (FIFO by expiry):** When spending from a pool, consume lots in this order:
1. Pool-restricted lots matching the target pool, ordered by `expires_at ASC` (soonest-expiring first)
2. Unrestricted lots (`pool_id IS NULL`), ordered by `expires_at ASC`
3. Never-expiring lots (`expires_at IS NULL`) last

This enables the Reverse Airdrop to grant cheap-pool-only credits that drain before purchased credits, and ensures expiring grants are used before permanent balances.

**Lot invariant:** `original_micro = available_micro + reserved_micro + consumed_micro` (where consumed_micro is derived from ledger entries referencing this lot).

**Atomic lot selection (concurrency safety):** FIFO lot selection and balance deduction MUST be atomic to prevent double-spend or over-reserve under concurrent requests for the same account:

- **Strategy:** `BEGIN IMMEDIATE` SQLite transaction wrapping the entire reserve operation (lot selection + lot update + ledger insert + balance cache update). SQLite's `BEGIN IMMEDIATE` acquires a write lock at transaction start, serializing concurrent writers.
- **Lot selection query:** `SELECT id, available_micro FROM credit_lots WHERE account_id = ? AND (pool_id = ? OR pool_id IS NULL) AND available_micro > 0 ORDER BY CASE WHEN pool_id IS NOT NULL THEN 0 ELSE 1 END, expires_at ASC NULLS LAST` — executed within the write transaction to guarantee consistent reads.
- **Invariant enforcement:** After deducting from lots, assert `available_micro >= 0` for every touched lot. If any lot would go negative, abort the transaction (indicates a concurrency bug).
- **Retry on SQLITE_BUSY:** If another transaction holds the write lock, retry with exponential backoff (max 3 retries, 10ms/50ms/200ms). After max retries, return `503 Service Unavailable` with `Retry-After` header.
- **Acceptance criteria:** No lot's `available_micro` is ever negative. Concurrent reserve tests (10 parallel reserves for the same account) must all succeed or fail cleanly with no balance corruption.
- **Single-writer guarantee:** Turso/LibSQL in embedded mode provides the same single-writer semantics as SQLite. For future multi-region deployment, reserve operations MUST route to a single primary region or use Turso's primary-writer topology.

#### 4.1.3 Per-Pool Balance Cache (Derived)

```sql
CREATE TABLE credit_balances (
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT,                  -- NULL = unrestricted aggregate
  available_micro BIGINT NOT NULL DEFAULT 0,  -- SUM(lots.available_micro) for this pool
  reserved_micro BIGINT NOT NULL DEFAULT 0,   -- SUM(lots.reserved_micro) for this pool
  updated_at TEXT NOT NULL,
  PRIMARY KEY(account_id, pool_id)
);
```

**This table is a derived cache**, not the source of truth. It is recomputed from `credit_lots` and validated against ledger sums. The Redis hot cache mirrors this table for sub-millisecond balance reads.

**Rebuild procedure:** `SELECT account_id, pool_id, SUM(available_micro), SUM(reserved_micro) FROM credit_lots WHERE available_micro > 0 OR reserved_micro > 0 GROUP BY account_id, pool_id`. Run on startup and periodically as consistency check.

**Cache consistency model (write-through with SQLite as source of truth):**

- **Write path:** SQLite transaction commits FIRST (lots + ledger + balances cache table), THEN Redis is updated synchronously within the same request. SQLite is always the authoritative source.
- **Redis update:** After SQLite commit, update Redis keys `balance:{account_id}:{pool_id}` with new `available_micro` and `reserved_micro` values. Use Redis `MULTI/EXEC` for atomicity of the Redis update itself.
- **Redis write failure:** If Redis update fails after SQLite commit, log WARNING and continue. The balance is correct in SQLite. Redis will self-heal on next read-through or periodic reconciliation.
- **Read path (normal):** Balance checks read from Redis first (sub-ms). If Redis returns a value, use it for display/rate-limiting. For **reserve authorization**, always read from SQLite within the write transaction (never authorize spending based solely on cached Redis values).
- **Read path (Redis outage):** If Redis is unavailable, fall back to SQLite reads via `credit_balances` table. Higher latency (~5-10ms vs sub-ms) but correct. Log WARNING with `redis_fallback_count` metric.
- **Periodic reconciliation:** Every 5 minutes, compare Redis balances to SQLite `credit_balances` for the 100 most-recently-active accounts. If drift detected, overwrite Redis from SQLite and log `balance_drift_corrected` metric with account_id and delta.
- **Startup rebuild:** On application start, rebuild all Redis balance keys from SQLite. This ensures Redis is never stale after a restart or Redis flush.
- **Guard invariant:** `NEVER authorize a reserve operation using only Redis-cached balances.` The reserve write transaction reads lots directly from SQLite, ensuring correctness regardless of cache state.

> Sources: BB-62-017 (Critical finding), billing-rfc.md Reverse Airdrop requirements, GPT-5.2 review finding #1 (lot-level model for FIFO expiry), Flatline IMP-003 (HIGH_CONSENSUS, 840), Flatline IMP-005 (HIGH_CONSENSUS, 780)

#### 4.1.4 Credit Ledger (Append-Only)

```sql
CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  pool_id TEXT,                  -- Which pool was affected
  lot_id TEXT REFERENCES credit_lots(id),  -- Which lot was consumed (for reserve/finalize/release)
  reservation_id TEXT,           -- Groups reserve/finalize/release entries for one operation
  entry_seq BIGINT NOT NULL,     -- Monotonic sequence per (account_id, pool_id) — enforces ordering
  entry_type TEXT NOT NULL,      -- deposit | reserve | finalize | release | refund |
                                 -- grant | shadow_charge | shadow_reserve | shadow_finalize |
                                 -- commons_contribution | revenue_share |
                                 -- marketplace_sale | marketplace_purchase |
                                 -- escrow | escrow_release
  amount_micro BIGINT NOT NULL,  -- Positive = credit, negative = debit
  idempotency_key TEXT UNIQUE,   -- Prevents duplicate entries
  description TEXT,
  metadata TEXT,                 -- JSON: { outcome_score?, campaign_id?, reciprocity_type?,
                                 --         provider_event_id?, counterparty_account_id? }
  created_at TEXT NOT NULL,
  UNIQUE(account_id, pool_id, entry_seq)  -- Strict monotonic ordering
);
```

**Key design decisions:**
- **No `balance_after` column.** Balances are derived by summing ledger entries or read from the `credit_balances` cache. This avoids fragile running balances that break under out-of-order inserts, retries, or late webhooks.
- **`entry_seq` enforces ordering.** Monotonically increasing per `(account_id, pool_id)`. Inserts that violate sequence are rejected, preventing silent corruption.
- **Atomic sequence allocation:** `entry_seq` is allocated as `SELECT COALESCE(MAX(entry_seq), 0) + 1 FROM credit_ledger WHERE account_id = ? AND pool_id = ?` within the same `BEGIN IMMEDIATE` transaction that performs the lot update and ledger insert. The single-writer guarantee from §4.1.2 (SQLite write lock) ensures no concurrent transaction can allocate the same sequence number. This eliminates the need for a separate sequence table or distributed coordination. For multi-region deployments (Turso with replicas), all write transactions MUST route to the primary writer — read replicas are used only for balance queries and analytics.
- **`lot_id` links consumption to source.** Every reserve/finalize draws from a specific lot, preserving pool restrictions and expiry provenance through the lot model.
- **`reservation_id` groups operations.** A single inference request produces a reserve → finalize (or reserve → release) pair. The `reservation_id` links them, enabling partial finalization and reconciliation.
- **Shadow billing types included.** `shadow_charge`, `shadow_reserve`, `shadow_finalize` are first-class entry types, enabling shadow mode to record hypothetical charges in the same ledger without affecting real balances.
- **Revenue distribution types included.** `commons_contribution` and `revenue_share` are posted as separate entries with `counterparty_account_id` in metadata, enabling double-entry-style reconciliation.

**Metadata enrichments (BB-62-027, BB-62-031):**
- `outcome_score` (nullable): Transforms ledger from cost tracker to value tracker.
- `reciprocity_type` (nullable): One of `foundation_to_user`, `community_to_member`, `member_to_community`, `user_to_agent`, `agent_to_user`.
- `campaign_id` (nullable): Links to `credit_campaigns` for grant provenance.
- `provider_event_id` (nullable): Maps external payment events (NOWPayments `payment_id`, x402 tx hash) for replay protection.
- `counterparty_account_id` (nullable): The other account in a two-sided posting (revenue share, commons contribution).

> Sources: RFC #62 Comment 4 schema, BB-62-027 (outcome tracking), BB-62-030 (reciprocity vocabulary), GPT-5.2 review findings #2, #3, #7

#### 4.1.5 Reserve-Finalize Pattern

The credit ledger uses reserve-finalize semantics matching the existing budget engine. Each operation has precise invariants:

**Balance invariant per lot:** `available_micro + reserved_micro + consumed_micro = original_micro`

**Reserve (before inference):**
1. Select lots using FIFO redemption order (§4.1.2)
2. For each lot consumed: `available_micro -= amount`, `reserved_micro += amount`
3. Write ledger entry: `entry_type: reserve`, `amount_micro: -X` (negative = debit from available), `lot_id`, `reservation_id`
4. Update `credit_balances` cache: `available_micro -= X`, `reserved_micro += X`
5. Reserve is idempotent per `reservation_id` — duplicate reserves return the existing reservation

**Reservation lot tracking (multi-lot reservations):**

When a reserve spans multiple lots, the exact per-lot allocation MUST be recorded for deterministic finalization:

```sql
CREATE TABLE reservation_lots (
  reservation_id TEXT NOT NULL,
  lot_id TEXT NOT NULL REFERENCES credit_lots(id),
  reserved_micro BIGINT NOT NULL,   -- Amount reserved from this specific lot
  created_at TEXT NOT NULL,
  PRIMARY KEY(reservation_id, lot_id)
);
```

This table is written atomically within the reserve transaction. It records exactly which lots were consumed and how much from each, enabling deterministic finalization without re-running FIFO selection.

**Finalize (after inference, actual cost known):**
1. Actual cost Y may differ from reserved amount X (Y <= X for normal completion, Y < X for partial/abort)
2. Read `reservation_lots` to get per-lot reserved amounts in FIFO order (same order used at reserve time)
3. Allocate Y across lots in FIFO order: consume from the first lot until exhausted, then next lot, etc. For each lot: `reserved_micro -= lot_consumed`, where `lot_consumed = MIN(remaining_Y, lot.reserved_micro)`
4. Write per-lot finalize ledger entries: `entry_type: finalize`, `amount_micro: -lot_consumed`, `lot_id`, `reservation_id`
5. If Y < X (overestimate): the last lot(s) in FIFO order get partial or zero consumption. Write `entry_type: release`, `amount_micro: +(lot.reserved_micro - lot_consumed)` for each lot with surplus. Lot's `available_micro += surplus`.
6. Update `credit_balances` cache accordingly

**Release (cancellation/abort, no cost incurred):**
1. Full amount X returned: `reserved_micro -= X`, `available_micro += X` on each lot
2. Write ledger entry: `entry_type: release`, `amount_micro: +X`, `reservation_id`
3. Release is idempotent per `reservation_id` + `entry_type: release`

**Partial finalization:** If streaming is aborted mid-response, finalize with actual tokens consumed (Y < X). The surplus is auto-released in the same transaction.

**Overrun handling (Y > X — actual cost exceeds reserve):**

LLM inference costs are estimates. Token counts can exceed predictions due to model retries, tool calls, streaming overruns, or provider billing adjustments. The system MUST handle Y > X gracefully:

1. **Safety multiplier on reserve:** Reserve `X = estimated_cost * 1.5` (configurable per pool). This covers most overrun scenarios. The multiplier is applied silently — users see estimated cost in UI, not the padded reserve.
2. **Mid-stream incremental reserve (for long-running operations):** If token consumption reaches 80% of reserved amount during streaming, attempt an incremental reserve for an additional 50% of the original estimate. If the incremental reserve fails (insufficient balance), behavior depends on billing mode.
3. **Per-billing-mode behavior when Y > X after delivery:**

| Billing Mode | Y > X Behavior |
|-------------|---------------|
| **Shadow** | Log the overrun as `shadow_finalize` with actual Y. No balance impact. Record `overrun_micro: Y - X` in metadata for pricing analysis. |
| **Soft** | Finalize with actual Y. If Y > reserved, consume additional `available_micro` from the account's lots (same FIFO order). If insufficient available balance, allow negative balance (soft mode permits this). Log warning. |
| **Live** | Finalize with `MIN(Y, X)` — cap at reserved amount. The delta `Y - X` is absorbed as revenue leakage, tracked in `overrun_micro` metadata. If overruns exceed 5% of finalized volume in a 1-hour window, raise an alert to recalibrate the safety multiplier. |

4. **Acceptance criteria:** Concurrent overrun test: 10 parallel requests where actual > estimated, all finalize correctly per billing mode with no balance corruption.

#### 4.1.6 Reservation TTL & Expiry Sweeper

Reservations MUST have a time-to-live to prevent indefinite fund locking:

- **Default TTL:** 5 minutes for inference requests (configurable per pool; reasoning/architect pools may use 15 minutes)
- **Reservation record:** Each reservation stores `expires_at = created_at + TTL` alongside the `reservation_id` in the ledger metadata
- **Sweeper job:** A periodic task (runs every 60 seconds) scans for reservations where `expires_at < NOW()` and no finalize/release entry exists for that `reservation_id`. For each expired reservation, the sweeper writes a `release` entry (returning funds to available) with `description: "expired_reservation_sweep"`
- **Metrics:** Track `reservation_expired_count`, `reservation_expired_amount_micro`, `reservation_avg_duration_ms` for operational visibility
- **Alert threshold:** If expired reservations exceed 5% of total reservations in a 1-hour window, raise an alert (indicates inference timeouts or upstream failures)

#### 4.1.7 Failure Modes & Recovery

Every write path in the reserve-finalize lifecycle has defined failure modes and recovery procedures:

| Failure Mode | Symptom | Detection | Recovery |
|-------------|---------|-----------|----------|
| **Reserve: SQLite commit fails** | Lots not debited, no ledger entry | Transaction rollback (automatic) | Retry with same `reservation_id` (idempotent). No Redis update needed since SQLite is source of truth. |
| **Reserve: Redis update fails after SQLite commit** | SQLite debited but Redis stale | Redis balance doesn't match SQLite on next read | Periodic reconciliation rebuilds Redis from SQLite. Next reserve will read correct balance from SQLite fallback. |
| **Finalize: SQLite commit fails** | Reserved funds not finalized | Reservation TTL sweeper detects orphan | Retry finalize. If inference was delivered, use DLQ for manual reconciliation. Sweeper releases after TTL as safety net. |
| **Revenue distribution: posting fails mid-sequence** | Payer debited but commons/community/foundation not credited | Zero-sum check fails on reconciliation | All distribution entries are written in a single SQLite transaction. If any entry fails, entire distribution rolls back. Finalize entry stands; distribution retried from DLQ. |
| **Webhook processing: credit lot creation fails** | Payment received but credits not minted | `provider_event_id` exists in payment log but no matching `deposit` in ledger | DLQ with automatic retry (3 attempts, exponential backoff). Manual reconciliation dashboard shows unprocessed payments. |
| **Double finalize attempt** | Duplicate finalize for same `reservation_id` | `idempotency_key` constraint violation | Rejected silently (idempotent). Return success. |

**Dead Letter Queue (DLQ):** Failed webhook processing and revenue distribution postings are queued to a `billing_dlq` table with `payload`, `error`, `retry_count`, `next_retry_at`. Max 3 automatic retries with exponential backoff (1s, 10s, 100s). After max retries, status becomes `manual_review`.

**Reconciliation:** A daily reconciliation job verifies:
1. `SUM(credit_lots.available_micro + reserved_micro)` matches `credit_balances` for all accounts
2. Every `reserve` entry has a corresponding `finalize` or `release` within TTL
3. Zero-sum invariant holds for all revenue distribution groups
4. All `finished` webhooks have a corresponding `deposit` ledger entry

> Sources: reality/database.md (agent_usage_log pattern), packages/adapters/agent/budget-manager.ts, GPT-5.2 review finding #2, Flatline IMP-001 (HIGH_CONSENSUS, 895), Flatline IMP-002 (HIGH_CONSENSUS, 850)

### 4.2 Payment Providers

#### 4.2.1 NOWPayments Integration (G-1)

**Status:** Adapter built (`NOWPaymentsAdapter.ts`), untested against sandbox.

**Work required:**
1. Create NOWPayments sandbox account (human dependency)
2. Write smoke test suite against sandbox API
3. Verify HMAC-SHA512 webhook signature verification
4. Wire webhook to credit ledger: `finished` status → `deposit` ledger entry + lot creation
5. Support currencies: BTC, ETH, USDC (minimum viable set)

**Webhook signature verification:**

The implementation MUST try two HMAC-SHA512 verification strategies in order, because NOWPayments documentation is ambiguous about whether they sign the raw body or a canonicalized form:

**Strategy A (primary): Raw body HMAC**
1. Preserve the raw request body bytes exactly as received (before any JSON parsing)
2. Compute HMAC-SHA512 using IPN Secret Key over the raw body bytes
3. Compare to `x-nowpayments-sig` header using `crypto.timingSafeEqual()` (hex, lowercase)
4. If match: verification passes

**Strategy B (fallback): Sorted-key canonicalization (per [NOWPayments IPN docs](https://nowpayments.zendesk.com/hc/en-us/articles/21395546303389))**
1. Parse JSON from the raw bytes to get the payload object
2. Sort payload keys alphabetically (shallow, top-level only)
3. `JSON.stringify()` the sorted object (compact form, no whitespace)
4. Compute HMAC-SHA512 using IPN Secret Key over the stringified sorted payload
5. Compare to `x-nowpayments-sig` header using `crypto.timingSafeEqual()` (hex, lowercase)
6. If match: verification passes

If neither strategy matches: return 401, log attempt (including first 8 chars of expected vs received for each strategy), do NOT process.

**Sandbox validation (Sprint 1, MANDATORY):** The smoke test suite MUST determine which strategy NOWPayments actually uses by testing against real sandbox webhooks. Once validated, the non-matching strategy SHOULD be removed and the verified strategy hardcoded as the sole verification path. The existing `NOWPaymentsAdapter.ts` already implements `sortObjectKeys()` for Strategy B.

**Replay protection:**
- Store `payment_id` from webhook payload as `provider_event_id` in ledger metadata
- Map `payment_id` to `idempotency_key`: `nowpayments:{payment_id}:{payment_status}`
- Only the first `finished` status webhook for a given `payment_id` creates a deposit — duplicates are rejected by the idempotency constraint
- Enforce status transition: only process `finished` if current known status is `confirming` or `confirmed` (reject `finished` if already `finished` or `refunded`)

**Payment state machine:**

External payment events are tracked in a dedicated state machine table to handle out-of-order delivery, refunds, and idempotent processing:

```sql
CREATE TABLE crypto_payments (
  id TEXT PRIMARY KEY,                    -- Internal payment ID
  provider TEXT NOT NULL,                 -- 'nowpayments' | 'x402'
  provider_payment_id TEXT NOT NULL,      -- NOWPayments payment_id or x402 tx hash
  provider_invoice_id TEXT,               -- NOWPayments invoice_id (for reconciliation)
  account_id TEXT REFERENCES credit_accounts(id),  -- Mapped after identification
  status TEXT NOT NULL DEFAULT 'waiting', -- Current state (see transitions below)
  amount_crypto TEXT,                     -- Amount in payment currency (e.g., "0.05 ETH")
  amount_usd_micro BIGINT,               -- Converted to micro-USD at time of confirmation
  lot_id TEXT REFERENCES credit_lots(id), -- Created on 'finished' transition
  raw_payload TEXT,                       -- Last webhook payload (for audit/dispute resolution)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, provider_payment_id)
);
```

**Allowed state transitions:**

```
waiting → confirming → confirmed → finished
waiting → expired
waiting → failed
confirming → expired
confirming → failed
finished → refunded    (lot clawback triggered)
```

Any transition not in this list is rejected and logged as `invalid_transition` with the full payload stored for investigation.

**Refund handling (lot clawback):** When a `refunded` event arrives for a `finished` payment:
1. Look up the `lot_id` created by the original deposit
2. If `lot.available_micro >= refund_amount`: deduct from `available_micro`, write `refund` ledger entry
3. If lot partially consumed (`available_micro < refund_amount`): deduct available, record remainder as `refund_debt` in metadata. The account's balance goes negative (tracked for operational resolution)
4. Write `refund` ledger entry with `provider_event_id` and `counterparty_account_id: NULL` (external cash-out)

**Out-of-order delivery:** The state machine processes transitions idempotently. If `finished` arrives before `confirmed`, the intermediate states are recorded retroactively (payment jumps to `finished`). If `confirming` arrives after `finished`, it's a no-op (state doesn't regress).

**Webhook flow:**
```
NOWPayments → POST /api/billing/crypto/webhook (raw body bytes)
           → Verify HMAC-SHA512 signature (raw body → sorted JSON → HMAC → timing-safe compare)
           → Upsert crypto_payments record (provider_payment_id as key)
           → Validate state transition (reject invalid, allow forward jumps)
           → If transition to 'finished':
             → Create credit_lot (source_type: deposit, pool_id: NULL, no expiry)
             → Write credit_ledger entry (entry_type: deposit, provider_event_id in metadata)
             → Update credit_balances cache
           → If transition to 'refunded':
             → Execute lot clawback procedure (see above)
             → Write credit_ledger entry (entry_type: refund)
           → Return 200
```

**Sandbox testing:** Use `api-sandbox.nowpayments.io/v1` with sandbox credentials. The `case` parameter enables deterministic test scenarios.

> Sources: nowpayments-api.md, reality/api.md (webhook endpoint already exists), GPT-5.2 review finding #6

#### 4.2.2 x402 Micropayments (G-3)

**Protocol:** HTTP 402 Payment Required with `@x402/hono` middleware. Coinbase facilitator (free 1,000 tx/month). USDC on Base.

**Two-tier model — top-up + internal ledger:**

x402 is used for **balance top-ups**, not per-inference settlement. This avoids per-request on-chain settlement fees while still using the x402 protocol:

1. **Top-up via x402:** User sends USDC payment (minimum $1, suggested $5/$10/$25) via x402. This is an on-chain transaction settled through Coinbase facilitator.
2. **Internal credit:** Payment creates a `credit_lot` (unrestricted, no expiry) and a `deposit` ledger entry.
3. **Per-request spending:** Subsequent `/invoke` calls use the internal reserve-finalize pattern against the credit balance — no on-chain settlement per request.
4. **Low balance prompt:** When `available_micro` drops below a configurable threshold, the response includes an `X-402-Balance-Low` header prompting the client to top up.

```
First request (no balance):
  Client → POST /invoke
        ← 402 Payment Required { topup_amount: "5.00", currency: "USDC", facilitator: "..." }
  Client → POST /invoke + X-402-Payment header (USDC top-up)
        → Middleware verifies x402 payment, creates credit_lot + deposit entry
        → Route handler: reserve from lot → inference → finalize
        ← 200 + response

Subsequent requests (balance available):
  Client → POST /invoke (no payment header needed)
        → Route handler: reserve from lot → inference → finalize
        ← 200 + response + X-402-Balance-Low (if below threshold)
```

This model means on-chain transactions happen at **top-up frequency** (~monthly for active users), not per-request. At 1,000 communities x 10 users x 1 top-up/month = 10,000 on-chain tx/month. This **exceeds the Coinbase facilitator free tier of 1,000 tx/month** — at scale, a paid facilitator tier ($99/month) or alternative settlement path will be required. At launch scale (<100 communities, ~1,000 tx/month), the free tier is sufficient. Per-request billing happens entirely within the internal credit ledger.

**Dedicated top-up endpoint:** In addition to the x402 middleware on `/invoke` (which handles first-request top-up), a dedicated `POST /api/billing/topup` endpoint allows users to top up proactively without coupling payment to an inference request. This decouples settlement latency from inference availability:

```
POST /api/billing/topup
X-402-Payment: <x402 payment header>

{ "amount_usd": 10.00 }  // Optional: suggest amount; x402 header determines actual

→ Verify x402 payment (tx hash + chain + amount + sender as provider_event_id)
→ Create crypto_payments record (provider: 'x402', status: 'finished')
→ Create credit_lot + deposit ledger entry
→ Return 200 { balance: { available_micro, reserved_micro } }
```

**x402 idempotency:** `provider_event_id` for x402 is `x402:{chain_id}:{tx_hash}:{amount}:{sender}`. Duplicate top-ups with the same tx hash are rejected by the `crypto_payments` UNIQUE constraint.

**Per-model pricing with markup (COGS basis):**

COGS is defined as the raw provider cost per 1M tokens, split by input/output. The arrakis price applies a 5x markup to the blended cost. Per-request estimates assume 300 input + 200 output tokens (500 total).

| Pool | Input Cost/1M | Output Cost/1M | Blended COGS/1M | Arrakis Price/1M (5x) | Est. Per-Request |
|------|--------------|----------------|-----------------|----------------------|-----------------|
| cheap | $0.10 | $0.30 | $0.20 | $1.00 | $0.0005 |
| fast-code | $2.00 | $4.00 | $3.00 | $15.00 | $0.0075 |
| reviewer | $10.00 | $20.00 | $15.00 | $75.00 | $0.0375 |
| reasoning | $40.00 | $80.00 | $60.00 | $300.00 | $0.1500 |
| architect | $50.00 | $100.00 | $75.00 | $375.00 | $0.1875 |

**Minimum charge:** Each request has a minimum charge of `MAX(actual_cost, 100 micro-USD)` ($0.0001) to prevent sub-overhead requests from being free.

**Actual billing:** Charges are based on actual token counts (input + output), not estimates. The per-request column is for pricing communication only — the ledger records exact usage.

> Sources: RFC #62 Phase 1, billing-rfc.md x402 section, BB-62-032 (settlement batching), GPT-5.2 review finding #4

#### 4.2.3 Credit Packs

Pre-loaded credit lots purchased via NOWPayments. Credits represent **spending power at list price** (5x markup already included). $1 of credits = $1 of inference at arrakis list prices = $0.20 of underlying COGS.

| Pack | USD Price | Credits (micro-USD) | Bonus Credits | Total Spending Power | Arrakis COGS | Gross Margin |
|------|-----------|--------------------|--------------|--------------------|-------------|-------------|
| Starter | $5 | 5,000,000 | 0 | $5.00 | $1.00 | 80% |
| Builder | $10 | 10,000,000 | 0 | $10.00 | $2.00 | 80% |
| Power | $25 | 25,000,000 | 2,500,000 | $27.50 | $5.50 | 78% |
| Enterprise | $100 | 100,000,000 | 20,000,000 | $120.00 | $24.00 | 76% |

**Margin math:** All packs maintain 76-80% gross margin because credits are denominated at list price (5x markup). The "bonus" credits cost arrakis only 20% of face value in COGS. A $25 Power pack with $2.50 bonus: COGS = $27.50 * 0.20 = $5.50, margin = ($25 - $5.50) / $25 = 78%.

Credit packs create unrestricted lots (`pool_id: NULL`, no expiry). Larger packs include bonus credits as volume incentive.

> Sources: RFC #62 body (credit pack system), GPT-5.2 review finding #8

### 4.3 Billing Modes (G-5)

Three progressive billing modes with minimum 7-day dwell time per mode:

| Mode | Behavior | Duration |
|------|----------|----------|
| **Shadow** | Log hypothetical charges to `credit_ledger` with `entry_type: shadow_charge`. No actual balance deduction. Dashboard shows "what you would have paid." | 7+ days |
| **Soft** | Deduct from balance but allow negative balance (no hard block). Warn at -$5, -$10, -$25 thresholds. | 7+ days |
| **Live** | Full enforcement. Reserve-finalize with hard block at $0 balance. | Permanent |

**Feature flag progression:**
```
FEATURE_BILLING_ENABLED=false  →  BILLING_MODE=shadow  →  BILLING_MODE=soft  →  BILLING_MODE=live
```

**Shadow billing value:** 7 days of shadow billing data provides real usage patterns for pricing validation (G-10) before any user impact.

> Sources: billing-rfc.md billing modes, RFC #62 Phase 0

### 4.4 Revenue Model & Pricing (G-10)

**Economics model (Vercel parallel — DX is the product):**

| Revenue Stream | Model | Target Margin |
|----------------|-------|---------------|
| PAYG (Managed) | 5x markup on model inference cost | 80% |
| BYOK | $5/month flat subscription | 100% |
| Setup fee | 0.01 ETH (~$25) one-time per community | 100% |
| Credit packs | Pre-loaded at 1-1.2x face value | 50-80% |
| x402 micropayments | Per-request USDC with 5x markup | 80% |
| Community subscription | Monthly via NOWPayments | 50% |
| Marketplace fees | 5% seller fee on credit trades (v2) | 100% |
| Commons dividends | 0.5-2% of all transactions (self-funding) | N/A |

**Target unit economics:**
- Revenue per community: $690/month (10 active users x $69/month avg spend)
- ARR at 1,000 communities: $8.4M
- Break-even: ~50 communities at $690/month avg

> Sources: billing-rfc.md targets, RFC #62 body economics, BB-62-031 (commons dividends)

### 4.5 Reverse Airdrop Campaign Engine (G-12, G-13)

A novel user acquisition mechanism: use on-chain analytics to measure USD losses community token holders have suffered, then grant pool-restricted credits proportional to losses.

#### 4.5.1 Campaign Tables

```sql
CREATE TABLE credit_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL,       -- reverse_airdrop | promotional | referral | commons_grant
  reciprocity_type TEXT,             -- foundation_to_user | community_to_member | etc.
  community_id TEXT,                 -- NULL = global campaign
  pool_restriction TEXT,             -- NULL = unrestricted, 'cheap' = cheap pool only
  budget_micro BIGINT NOT NULL,      -- Total campaign budget in micro-USD
  spent_micro BIGINT NOT NULL DEFAULT 0,
  grant_formula TEXT,                -- JSON: { type: 'proportional_loss', cap_micro: 5000000, min_loss_usd: 10 }
  eligible_count INTEGER DEFAULT 0,
  granted_count INTEGER DEFAULT 0,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | active | paused | completed | expired
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE credit_grants (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES credit_campaigns(id),
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  amount_micro BIGINT NOT NULL,
  loss_data TEXT,                     -- JSON: { wallet: "0x...", token: "...", loss_usd: 150.00, source: "dune_query_123" }
  transferable BOOLEAN NOT NULL DEFAULT false,
  ledger_entry_id TEXT REFERENCES credit_ledger(id),
  granted_at TEXT NOT NULL,
  UNIQUE(campaign_id, account_id)    -- One grant per account per campaign
);
```

#### 4.5.2 Grant Formulas

| Formula Type | Description | Parameters |
|-------------|-------------|------------|
| `proportional_loss` | Credits proportional to USD loss | `cap_micro` (per-wallet cap), `min_loss_usd` (minimum threshold), `ratio` (default 1.0) |
| `fixed_amount` | Same amount for all eligible | `amount_micro` |
| `tiered` | Amount varies by loss bracket | `brackets: [{ min_loss: 10, max_loss: 50, amount_micro: 1000000 }, ...]` |

#### 4.5.3 Loss Oracle API

```
POST /api/admin/campaigns/{campaign_id}/grants/batch
Authorization: Bearer <admin-token>

{
  "grants": [
    {
      "wallet_address": "0x...",
      "loss_usd": 150.00,
      "source": "dune_query_123",
      "idempotency_key": "campaign-123-0xABC"
    }
  ]
}
```

**Community-gated eligibility (BB-62-025):** The wallet's associated community must be registered with arrakis. The oracle API validates community membership before granting.

**Admin endpoint security controls (the Loss Oracle is a money printer — treat it accordingly):**

| Control | Requirement | Rationale |
|---------|-------------|-----------|
| **Authentication** | Bearer token with scoped `admin:grants:write` permission (not a shared admin-token) | Principle of least privilege |
| **Audit log** | Every batch call logged to `admin_audit_log` with caller identity, campaign_id, grant count, total amount, timestamp, IP | Non-repudiation, incident forensics |
| **Budget enforcement** | Reject batch if `campaign.spent_micro + batch_total > campaign.budget_micro` | Prevents over-granting beyond campaign budget |
| **Per-wallet cap** | Reject individual grants exceeding `campaign.grant_formula.cap_micro` | Defense in depth against formula bugs |
| **Rate limit** | Max 10 batch calls per campaign per hour (configurable) | Limits blast radius of compromised credentials |
| **Batch size limit** | Max 1,000 grants per batch request | Prevents timeout/OOM on large payloads |
| **Large grant alert** | If any single grant exceeds $50 (50,000,000 micro-USD), log WARNING and require `force: true` flag | Catches outlier grant amounts before minting |
| **Idempotency** | Per-grant `idempotency_key` prevents duplicate minting on retry | Already specified; critical for batch operations |

**Economics example:** 2,000 holders x $5 cap = $10,000 in credits. At cheap pool ($0.001/request) = 5,000 free requests per wallet. 10% conversion = 200 paying users x $9.99/month = $2,000/month recurring. Payback: 5 months.

> Sources: billing-rfc.md Reverse Airdrop section, BB-62-017 through BB-62-026

#### 4.5.4 Marketplace Readiness (Schema Only — V2)

The credit system MUST support future marketplace operations without schema migration:

- **Lot-based transfers:** Marketplace trades transfer entire lots (or split lots) between accounts. Since `pool_id` and `expires_at` are intrinsic to the lot, pool restrictions and expiry survive transfers automatically. The lot's `source_type` becomes `transfer_in` on the buyer's side.
- `credit_grants.transferable` flag enables/disables credit trading per grant — only lots originating from transferable grants can be listed for sale
- `entry_type` enum includes `marketplace_sale`, `marketplace_purchase`, `escrow`, `escrow_release`
- Foundation takes 5% seller fee (configurable), deducted as a separate lot consumed from seller's proceeds
- Marketplace creates natural price discrimination: users who value credits more pay market price, users who don't sell at discount

**V1 scope:** Schema supports marketplace. No marketplace UI or API in V1.

> Sources: billing-rfc.md marketplace section, BB-62-019 (transferability), BB-62-026 (price discovery), GPT-5.2 review finding #9

### 4.6 loa-hounfour Protocol Integration

loa-hounfour v3.0.0 (PR #1) provides shared billing types that arrakis MUST adopt:

| Import | Purpose |
|--------|---------|
| `AgentBillingConfig` | Billing configuration per agent |
| `CreditBalance` | Shared credit balance type (BigInt micro-USD) |
| `UsageRecord` | Standardized usage report format |
| `GuardResult` | Structured billing guard responses |
| `validators.billingConfig()` | Pre-compiled TypeBox validator |
| BigInt micro-USD arithmetic | Shared precision handling across repos |

**Version compatibility:** Arrakis MUST call `validateCompatibility(CONTRACT_VERSION)` to ensure protocol alignment with loa-finn. This is already proven in the E2E test suite (cycle-024).

> Sources: rfc31-hounfour.md, loa-hounfour PR #1 summary

### 4.7 Cross-System E2E Billing Flow

The complete billing round-trip must be validated end-to-end:

```
Person → POST /invoke (with credit balance)
      → Reserve X micro-USD from lots (credit_ledger: reserve, lot_id per lot consumed)
      → JWT with req_hash → loa-finn
      → Inference (model routing by tier/pool)
      → Usage report (actual cost Y) → Arrakis
      → Finalize Y micro-USD (credit_ledger: finalize), release surplus X-Y
      → Post revenue distribution entries (see posting rules below)
```

#### 4.7.1 Revenue Distribution Posting Rules

For every finalized charge of Y micro-USD in pool P against payer account A:

| # | Entry | Account | entry_type | amount_micro | Notes |
|---|-------|---------|-----------|-------------|-------|
| 1 | Payer charge | A (payer) | `finalize` | -Y | Debit from payer's lot |
| 2 | Commons contribution | A (payer) | `commons_contribution` | -(Y * commons_rate) | e.g., 0.5% of Y; metadata: `counterparty_account_id: commons_{pool}` |
| 3 | Commons receipt | commons_{pool} | `commons_contribution` | +(Y * commons_rate) | Credit to commons pool for this pool |
| 4 | Community share | community_{id} | `revenue_share` | +(Y * community_rate) | e.g., 15% of Y; metadata: `counterparty_account_id: foundation` |
| 5 | Foundation revenue | foundation | `revenue_share` | +(Y - commons - community_share) | Remainder after distributions |

**Zero-sum invariant:** `SUM(all entries for this finalization) = 0` for internal credit movements. The payer's total debit (-Y) equals the sum of all credits to commons + community + foundation. External cash-in (NOWPayments deposit, x402 top-up) is the only operation that mints new credits (creates value from outside the system). External cash-out (if any, v2) destroys credits.

**COGS tracking:** Provider inference costs are NOT modeled as credit movements. They are tracked separately in `agent_usage_log.costCents` (existing table). The difference between arrakis list price (Y) and provider COGS is gross margin, calculated in analytics, not in the ledger.

**Configurable rates:** Commons rate (default 0.5%) and community rate (default 15%) are stored in system config, not hardcoded. Foundation receives the remainder.

This flow validates:
1. Payment acceptance (x402 top-up or existing credit balance)
2. Budget reservation (atomic, idempotent, lot-level)
3. Inference execution with cost tracking
4. Usage finalization with actual cost
5. Revenue distribution to stakeholders (zero-sum postings)

> Sources: loa-finn #66 P0 requirements, RFC #62 Phase 4, GPT-5.2 review finding #5

---

## 5. Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Ledger write latency | < 10ms (SQLite/Turso) | Reserve must not add perceptible latency to inference |
| Balance cache | Redis hot cache, 100ms staleness tolerance | Read-heavy balance checks during rate limiting |
| Idempotency | Every ledger entry has unique idempotency_key | Prevents duplicate charges on retry/failover |
| Precision | BigInt micro-USD (1 USD = 1,000,000 micro-USD) | Matches loa-hounfour, budget-unit-bridge.ts, 153 conformance tests |
| Audit trail | Append-only ledger, no UPDATE/DELETE on credit_ledger | Financial compliance, dispute resolution |
| Webhook verification | HMAC-SHA512 with timing-safe comparison, idempotency per provider_event_id | Prevents forged and replayed payment notifications |
| Shadow billing overhead | < 1% additional latency in shadow mode | Shadow logging must not impact user experience |
| x402 top-up frequency | ~1 on-chain tx per user per month (not per request) | Minimizes facilitator fees; per-request billing is internal |
| Lot consistency | `credit_balances` cache matches `SUM(credit_lots)` — verified on startup and periodically | Derived cache must not drift from source of truth |

---

## 6. Technical Decisions (Pre-Resolved)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Credit granularity | micro-USD (1 USD = 1,000,000) | Matches loa-finn, budget-unit-bridge.ts, eliminates rounding |
| Provider priority | x402 + NOWPayments (MVP) → lobster.cash (Growth) → Stripe (Scale) | BVI-compatible path |
| Billing modes | shadow → soft → live (7-day min each) | De-risk pricing before enforcement |
| x402 facilitator | Coinbase CDP (free 1,000 tx/month; paid tier at scale) | Zero cost at launch; $99/month when exceeding free tier |
| Persistent storage | SQLite/Turso for ledger (source of truth) | Existing Drizzle ORM, edge-friendly |
| Hot cache | Redis for balance checks | Existing Redis infrastructure, atomic Lua scripts |
| Markup model | 5x on model costs | 80% gross margin, Vercel pricing parallel |
| Credit redemption | Lot-based FIFO: pool-restricted lots by expiry first, then unrestricted lots | Reverse Airdrop credits drain first; expiring grants consumed before permanent balances |
| Commons pool | 0.5% of finalized charges (configurable) | Self-funding acquisition, minimal user impact; zero-sum posting rules |
| x402 model | Top-up + internal ledger (not per-request settlement) | On-chain tx at top-up frequency (~monthly), per-request billing internal |

> Sources: billing-rfc.md Technical Decisions, BB-62-031 (commons), BB-62-017 (FIFO redemption)

---

## 7. Existing Code Assets

| Asset | Path | Status | Relevance |
|-------|------|--------|-----------|
| Budget Engine | `packages/adapters/agent/budget-manager.ts` | Production | Reserve-finalize pattern to extend |
| Unit Bridge | `packages/adapters/agent/budget-unit-bridge.ts` | Production | BigInt micro-USD conversion |
| Pool Mapping | `packages/adapters/agent/pool-mapping.ts` | Production | Tier → pool access rules |
| NOWPayments Adapter | `themes/sietch/src/packages/adapters/billing/NOWPaymentsAdapter.ts` | Built, untested | Wire to sandbox, add smoke tests |
| Crypto Payment Port | `themes/sietch/src/packages/core/ports/ICryptoPaymentProvider.ts` | Production | Interface for payment providers |
| Billing Types | `themes/sietch/src/types/billing.ts` | Production | 6 tiers, 17 features — extend with credit types |
| Crypto Payments DB | `themes/sietch/src/db/migrations/021_crypto_payments.ts` | Deployed | Base migration for billing tables |
| Feature Flag | `FEATURE_BILLING_ENABLED=false` in .env | Off | Flip to enable shadow billing |
| 153 Conformance Tests | `tests/conformance/`, `tests/unit/` | Passing | Extend with billing conformance |
| Webhook Endpoint | `POST /api/billing/crypto/webhook` | Deployed | Wire to credit ledger |
| Usage Log | `agent_usage_log` table with `costCents` bigint | Production | Source data for shadow billing |
| GatekeeperService | `themes/sietch/src/packages/adapters/billing/` | Production | 17-feature entitlement checks |

> Sources: billing-rfc.md code assets, reality/api.md, reality/database.md

---

## 8. Sprint Structure

6 sprints over 8 weeks, ordered by dependency chain and revenue impact:

| Sprint | Focus | Priority | Dependencies |
|--------|-------|----------|-------------|
| 1 | NOWPayments smoke tests + credit ledger foundation | P0 | NOWPayments sandbox account (human blocker) |
| 2 | x402 integration + agent micropayments | P0 | Sprint 1 (credit ledger), Coinbase CDP account (human blocker) |
| 3 | Shadow billing + feature flag activation | P0 | Sprint 2 (x402 wired) |
| 4 | Gamification + discount engine + Reverse Airdrop schema | P1 | Sprint 1 (credit ledger) |
| 5 | Collab.Land displacement + GTM infrastructure | P2 | Sprint 3 (billing live) |
| 6 | Agent wallet exploration (ERC-6551) — parallel track | P2 | None (independent) |

**Sprint 1** unblocks everything. The credit ledger is the foundation all other sprints build on.
**Sprint 6** runs in parallel — it's an exploration track with no downstream dependencies.

---

## 9. Out of Scope (V1)

| Item | Reason | Future Phase |
|------|--------|--------------|
| Credit marketplace UI/API | Schema ready, marketplace deferred to V2 | Growth |
| Stripe integration | Requires non-BVI entity | Scale |
| lobster.cash integration | API maturity unknown, evaluation only | Growth |
| MCP tool billing | Requires MCP protocol finalization | V2 |
| Agent-issued credit (ERC-6551 backed) | Requires agent wallet prototype first | V2 |
| Outcome-based pricing | `outcome_score` field ready, pricing engine deferred | V2 |
| Multi-currency credit balances | micro-USD only for V1 | Scale |
| Fiat payment processing | Blocked by BVI entity status | Scale |

---

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| NOWPayments sandbox account not created | Blocks Sprint 1 entirely | Medium | Human dependency — escalate immediately |
| Coinbase CDP account not created | Blocks Sprint 2 (x402) | Medium | Human dependency — can start Sprint 3-4 in parallel |
| NOWPayments doesn't support BVI entities | Blocks crypto subscriptions | Low | x402 is the primary revenue path; NOWPayments is secondary |
| 5x markup too high for market | Revenue target missed | Medium | Shadow billing data validates pricing before enforcement; adjustable per-pool |
| x402 facilitator fees exceed free tier | Unexpected cost at scale | **Medium** | Free tier (1,000 tx/month) covers launch (<100 communities). At 1,000 communities (~10,000 tx/month), upgrade to paid tier ($99/month). Dedicated `/topup` endpoint decouples payment from inference availability. |
| loa-hounfour v3.0.0 PR not merged | Blocks protocol type adoption | Low | PR is flatline-achieved, 370 tests; can use from branch |
| Credit ledger introduces latency | Slower inference responses | Medium | Redis hot cache for reads; async ledger writes for non-reserve operations |
| Reverse Airdrop grants become liability | Granted credits never convert to revenue | Medium | Pool restriction limits cost exposure; 90-180 day expiry; $5 per-wallet cap |

---

## 11. Human Dependencies (Blockers)

| Dependency | Blocks | Priority | Owner |
|-----------|--------|----------|-------|
| Create NOWPayments sandbox account | Sprint 1 | P0 | Product/Ops |
| Create Coinbase CDP account for x402 facilitator | Sprint 2 | P0 | Product/Ops |
| Investigate lobster.cash API access | Sprint 6 | P2 | Product/Ops |
| Merge loa-hounfour PR #1 (v3.0.0) | Sprint 1 protocol types | P1 | Engineering |

---

## 12. ECSA Postcapitalist Enrichments

The following concepts from ECSA's "Protocols for Postcapitalist Expression" are architecturally supported by the credit system design. These are not V1 features but the schema accommodates them without migration.

| ECSA Concept | Arrakis Implementation | Schema Support |
|-------------|----------------------|----------------|
| Three token types (stake/liquidity/commodity) | finnNFT (stake) + Credits (liquidity) + Inference outputs (commodity) | Existing architecture |
| Reciprocal staking | 6-level stakeholder matrix with bidirectional value flow | `reciprocity_type` in metadata |
| Multiple indices of value | Pool system (cheap, fast-code, reviewer, reasoning, architect) | `credit_lots.pool_id` per lot |
| Netting & clearing | Budget engine reserve-finalize + x402 top-up model | Internal ledger with periodic on-chain settlement |
| Commons dividends | Commons pool account receiving % of transactions | `entity_type: 'commons'` |
| Solidarity pricing | Reverse Airdrop (credits proportional to losses) | Campaign engine |
| Distributed credit issuance | Agent-issued credits backed by ERC-6551 TBA (v2) | `entity_type: 'agent'` in credit_accounts |
| Outcome tracking | `outcome_score` in ledger metadata | Nullable JSON field |

**The agent-native advantage (BB-62-033):** Postcapitalist economic protocols that are aspirational for human economies are natively implementable in agent economies. Agents comply procedurally with redistribution, transparent valuation, and credit default resolution. This makes arrakis the natural testbed for postcapitalist economics — "What ECSA theorizes, arrakis implements."

> Sources: RFC #62 Comment 7, BB-62-027 through BB-62-035, postcapitalist.agency

---

## 13. Success Definition

The billing system is revenue-ready when ALL of the following are verified:

**Payment acceptance:**
- NOWPayments sandbox: payment created, webhook received, signature verified, credit deposited
- x402: middleware installed, per-model pricing configured, USDC payment accepted on invoke endpoint

**Credit ledger integrity:**
- Append-only ledger with BigInt micro-USD precision, strict monotonic `entry_seq` per (account, pool)
- Lot-based credit model with per-lot `pool_id` and `expires_at`; FIFO expiry-based redemption
- Reserve-finalize pattern with `reservation_id` linking reserve/finalize/release entries, idempotent per reservation
- All 6 entity types supported (agent, person, community, mod, protocol, foundation) + commons
- Zero-sum revenue distribution postings: payer debit = SUM(commons + community + foundation credits)
- `credit_balances` cache validated against `SUM(credit_lots)` on startup

**Billing mode progression:**
- Shadow mode: 7+ days of hypothetical charges logged, pricing model validated
- Soft mode: balance deduction with negative-balance warnings
- Live mode: hard enforcement with reserve-finalize

**Revenue metrics (G-10):**
- Shadow billing data validates $690/month per community target
- 5x markup produces 80% gross margin across all pools
- Break-even analysis confirmed at ~50 communities

**Architectural readiness:**
- Campaign engine schema deployed (even if no campaigns active in V1)
- Marketplace entry types in enum (even if no marketplace API in V1)
- Commons pool account created (even if contribution rate is 0% initially)
- `outcome_score` field in metadata (even if unpopulated in V1)

**Cross-references:**
- [ ] B-1: First NOWPayments sandbox payment completes end-to-end
- [ ] B-2: x402 micropayment accepted on agent invoke endpoint
- [ ] B-3: Credit ledger records all monetary events with BigInt precision
- [ ] B-4: Shadow billing produces 7+ days of usage data
- [ ] B-5: Pricing model validated against shadow billing data
- [ ] B-6: `FEATURE_BILLING_ENABLED=true` deployed to production

---

*This PRD is grounded in RFC #62 (7 comments, 35 Bridgebuilder findings), 3 context files (billing-rfc.md, nowpayments-api.md, rfc31-hounfour.md), codebase reality (api.md, database.md), and cross-repo references (loa-hounfour PR #1, loa-finn #66). Every functional requirement traces to an existing code asset or architectural decision.*

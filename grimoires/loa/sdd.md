# SDD: The Kwisatz Haderach — Agent Economic Citizenship & Constitutional Governance

**Version:** 1.0.0
**Date:** 2026-02-16
**Status:** Draft
**PRD:** `grimoires/loa/prd.md` v1.0.0
**Cycle:** cycle-030

---

## 1. Executive Summary

This SDD designs the technical architecture for making agents first-class economic citizens and establishing constitutional governance for system parameters. It extends the existing billing infrastructure (credit ledger, state machines, billing events, revenue rules, fraud/settlement services) with four new subsystems:

1. **Constitutional Governance** — `system_config` table with multi-sig approval, 7-day cooldown, entity-type overrides
2. **Agent Budget Engine** — per-agent daily spending caps with circuit breaker, Redis advisory + SQLite authoritative
3. **EconomicEvent Outbox** — unified `economic_events` append-only table for cross-system publication (outbox pattern)
4. **ADR-008 Reconciliation** — design + test harness for credit ledger ↔ budget engine conservation

All monetary operations use BigInt micro-USD (existing `CreditLedgerAdapter` precision). No new databases — extends SQLite (authoritative) + Redis (cache/acceleration). No existing interfaces are modified.

> Grounded in: `ICreditLedgerService.ts`, `state-machines.ts`, `billing-events.ts`, `RevenueRulesAdapter.ts`, `AgentWalletPrototype.ts`, `CreditLedgerAdapter.ts`, `SettlementService.ts`, `CreatorPayoutService.ts`, `FraudRulesService.ts`, migrations 030-046.

---

## 2. System Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        API Layer (Express)                           │
│  /api/admin/config/*  /api/agent/*  /api/reconciliation/*            │
└──────┬──────────────────────┬──────────────────────┬────────────────┘
       │                      │                      │
┌──────▼──────────┐  ┌────────▼──────────┐  ┌────────▼──────────┐
│  Constitutional  │  │  AgentBudget      │  │  Reconciliation   │
│  Governance      │  │  Service          │  │  Service          │
│  Service         │  │                   │  │                   │
└──────┬──────────┘  └────────┬──────────┘  └────────┬──────────┘
       │                      │                      │
┌──────▼──────────────────────▼──────────────────────▼──────────┐
│                    Existing Billing Layer                       │
│  CreditLedgerAdapter  │  RevenueDistributionSvc               │
│  SettlementService    │  RevenueRulesAdapter                  │
│  CreatorPayoutService │  FraudRulesService                    │
│  AgentWalletPrototype │  BillingEventEmitter                  │
└──────┬──────────────────────┬──────────────────────┬──────────┘
       │                      │                      │
┌──────▼──────┐  ┌────────────▼────────┐  ┌──────────▼──────────┐
│   SQLite    │  │     Redis           │  │  EconomicEvent      │
│ (authority) │  │   (cache/advisory)  │  │  Outbox Dispatcher  │
└─────────────┘  └────────────────────┘  └─────────────────────┘
```

### 2.2 Extension Strategy

**No existing interfaces are modified.** New services compose existing ports:

| Existing Port | How Extended |
|---------------|-------------|
| `ICreditLedgerService` | Unchanged. Agent accounts already supported (`entity_type: 'agent'`). Budget cap checks wrap `reserve()` calls — no interface change. |
| `IRevenueRulesService` | Unchanged. Revenue rules governance pattern cloned for constitutional governance. |
| `BillingEvent` union type | Extended: new event types added to discriminated union (additive only). |
| `StateMachineDefinition` | New `SYSTEM_CONFIG_MACHINE` defined using existing `StateMachineDefinition<S>` generic. |
| `BillingEventEmitter` | New `EconomicEventEmitter` wraps existing emitter + writes to `economic_events` outbox table within same transaction. |

### 2.3 Key Design Principles

1. **Conservation invariant preserved**: All changes are additive — no new money creation paths, no invariant modifications.
2. **Entity-type agnosticism maintained**: The credit ledger remains entity-type agnostic. Differentiation happens in the governance/policy layer above the ledger.
3. **Compile-time fallback**: Every runtime-configurable parameter has a compile-time constant as last-resort default. If `system_config` lookup fails, the system operates with hardcoded values (identical to current behavior).
4. **Synchronous outbox**: Event emission uses synchronous INSERT within the same SQLite transaction. Async dispatch happens after commit (outbox pattern).

---

## 3. Data Architecture

### 3.1 New Tables

#### `system_config`

Constitutional parameters with governance lifecycle.

```sql
CREATE TABLE system_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  param_key TEXT NOT NULL,
  entity_type TEXT,           -- NULL = global default, 'agent'/'person'/etc = entity override
  value_json TEXT NOT NULL,   -- JSON-encoded value (supports numbers, strings, objects)
  config_version INTEGER NOT NULL DEFAULT 1,
  active_from TEXT,           -- ISO 8601 timestamp when this config becomes active
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'cooling_down', 'active', 'superseded', 'rejected')),
  proposed_by TEXT NOT NULL,
  proposed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approved_by TEXT,           -- JSON array of approver IDs (multi-sig)
  approval_count INTEGER NOT NULL DEFAULT 0,
  required_approvals INTEGER NOT NULL DEFAULT 2,
  cooldown_ends_at TEXT,      -- Set when status transitions to 'cooling_down'
  activated_at TEXT,
  superseded_at TEXT,
  superseded_by TEXT REFERENCES system_config(id),
  metadata TEXT,              -- JSON: notes, justification
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Only one active config per (param_key, entity_type) pair
CREATE UNIQUE INDEX idx_system_config_active
  ON system_config(param_key, entity_type) WHERE status = 'active';

-- Version uniqueness per (param_key, entity_type) — prevents concurrent version collision
CREATE UNIQUE INDEX idx_system_config_version
  ON system_config(param_key, entity_type, config_version);

-- Lookup active config: entity-specific first, then global fallback
CREATE INDEX idx_system_config_lookup
  ON system_config(param_key, status, entity_type);
```

#### `system_config_version_seq`

Monotonic version counter per (param_key, entity_type) pair. Updated within `BEGIN IMMEDIATE` to prevent concurrent version allocation.

```sql
CREATE TABLE system_config_version_seq (
  param_key TEXT NOT NULL,
  entity_type TEXT,           -- NULL for global
  current_version INTEGER NOT NULL DEFAULT 0,
  UNIQUE(param_key, entity_type)
);
```

#### `system_config_audit`

Append-only audit trail for all governance actions.

```sql
CREATE TABLE system_config_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id TEXT NOT NULL REFERENCES system_config(id),
  action TEXT NOT NULL
    CHECK (action IN ('proposed', 'approved', 'rejected', 'cooling_started', 'activated', 'superseded', 'emergency_override')),
  actor TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  config_version INTEGER NOT NULL,
  metadata TEXT,              -- JSON: approval reason, override justification
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_config_audit_config ON system_config_audit(config_id);
CREATE INDEX idx_config_audit_action ON system_config_audit(action, created_at);
```

#### `agent_spending_limits`

Per-agent daily budget caps with circuit breaker state.

```sql
CREATE TABLE agent_spending_limits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  daily_cap_micro BIGINT NOT NULL,
  current_spend_micro BIGINT NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  window_duration_seconds INTEGER NOT NULL DEFAULT 86400,  -- 24h
  circuit_state TEXT NOT NULL DEFAULT 'closed'
    CHECK (circuit_state IN ('closed', 'warning', 'open')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(account_id)
);
```

#### `agent_budget_finalizations`

Idempotency ledger for budget cap accounting. Each finalization is recorded exactly once.

```sql
CREATE TABLE agent_budget_finalizations (
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  reservation_id TEXT NOT NULL,
  amount_micro BIGINT NOT NULL,
  finalized_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (account_id, reservation_id)
);
```

#### `agent_identity`

Canonical identity anchor for agent provenance verification.

```sql
CREATE TABLE agent_identity (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id TEXT NOT NULL UNIQUE REFERENCES credit_accounts(id),
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  tba_address TEXT,           -- Phase 2: ERC-6551 token-bound account address
  creator_account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  creator_signature TEXT,     -- Hex-encoded signature of agent config by creator wallet
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(chain_id, contract_address, token_id)
);
CREATE INDEX idx_agent_identity_creator ON agent_identity(creator_account_id);
```

#### `agent_clawback_receivables`

Tracks unpaid clawback remainders to preserve conservation when agent balance is insufficient for full clawback.

```sql
CREATE TABLE agent_clawback_receivables (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  source_clawback_id TEXT NOT NULL,        -- Original clawback event correlation ID
  original_amount_micro INTEGER NOT NULL,  -- Total remainder at time of shortfall
  balance_micro INTEGER NOT NULL,          -- Current outstanding amount (decremented by drip recovery)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT,                        -- Set when balance_micro reaches 0
  CHECK(original_amount_micro > 0),
  CHECK(balance_micro >= 0)
);
CREATE INDEX idx_clawback_receivables_account
  ON agent_clawback_receivables(account_id) WHERE balance_micro > 0;
```

#### `economic_events`

Unified outbox table for cross-system event publication.

```sql
CREATE TABLE economic_events (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,  -- Global ordering
  event_id TEXT NOT NULL UNIQUE,            -- UUID
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  correlation_id TEXT,                      -- Traces across operations
  idempotency_key TEXT NOT NULL UNIQUE,     -- Deduplication
  config_version INTEGER,                   -- system_config version used
  payload TEXT NOT NULL,                    -- JSON event-specific data
  -- Dispatch claim columns (prevents double-dispatch under concurrency)
  claimed_by TEXT,                          -- Worker ID that claimed this event
  claimed_at TEXT,                          -- When claimed (stale claim detection)
  published_at TEXT,                        -- Set after successful external publish
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Dispatcher claims unpublished, unclaimed events atomically
CREATE INDEX idx_economic_events_dispatchable
  ON economic_events(rowid) WHERE published_at IS NULL AND claimed_by IS NULL;

-- Stale claim detection (claimed but not published within timeout)
CREATE INDEX idx_economic_events_stale_claims
  ON economic_events(claimed_at) WHERE claimed_by IS NOT NULL AND published_at IS NULL;

-- Per-entity ordering queries
CREATE INDEX idx_economic_events_entity
  ON economic_events(entity_id, rowid);
```

### 3.2 Schema Extensions to Existing Tables

#### `billing_events` — new event types

Add to `BillingEvent` discriminated union (TypeScript only — SQLite stores as TEXT):
- `AgentBudgetWarning` — agent hit 80% of daily cap
- `AgentBudgetExhausted` — agent hit 100% of daily cap
- `AgentSettlementInstant` — agent earning settled immediately (0h hold)
- `ConfigProposed` — constitutional parameter change proposed
- `ConfigApproved` — constitutional parameter change approved
- `ConfigActivated` — constitutional parameter became active

#### `credit_accounts` — no schema change

Agent accounts already work. `entity_type: 'agent'` is already in the CHECK constraint (`030_credit_ledger.ts:27-29`). `AgentWalletPrototype.ts:172` already creates agent accounts via `getOrCreateAccount('agent', ...)`.

### 3.3 Parameter Resolution

### 3.4 Parameter Schema Registry

Every constitutional parameter has a strict typed schema defined in code. Proposals are validated against this schema **before** they can enter the governance lifecycle. This prevents runtime type errors in money-moving code paths.

```typescript
// packages/core/protocol/config-schema.ts

interface ParamSchema {
  key: string;
  type: 'integer' | 'bigint_micro' | 'integer_seconds' | 'integer_percent' | 'nullable';
  min?: number;
  max?: number;
  description: string;
}

const CONFIG_SCHEMA: Record<string, ParamSchema> = {
  'kyc.basic_threshold_micro':      { key: 'kyc.basic_threshold_micro',      type: 'bigint_micro',      min: 0, description: 'KYC basic tier threshold in micro-USD' },
  'kyc.enhanced_threshold_micro':   { key: 'kyc.enhanced_threshold_micro',   type: 'bigint_micro',      min: 0, description: 'KYC enhanced tier threshold in micro-USD' },
  'settlement.hold_seconds':        { key: 'settlement.hold_seconds',        type: 'integer_seconds',   min: 0, max: 604800, description: 'Settlement hold duration in seconds' },
  'payout.min_micro':               { key: 'payout.min_micro',               type: 'bigint_micro',      min: 0, description: 'Minimum payout amount in micro-USD' },
  'payout.rate_limit_seconds':      { key: 'payout.rate_limit_seconds',      type: 'integer_seconds',   min: 0, description: 'Minimum seconds between payouts per account' },
  'payout.fee_cap_percent':         { key: 'payout.fee_cap_percent',         type: 'integer_percent',   min: 1, max: 100, description: 'Maximum fee as percentage of gross payout' },
  'revenue_rule.cooldown_seconds':  { key: 'revenue_rule.cooldown_seconds',  type: 'integer_seconds',   min: 0, description: 'Revenue rule cooldown in seconds' },
  'fraud_rule.cooldown_seconds':    { key: 'fraud_rule.cooldown_seconds',    type: 'integer_seconds',   min: 0, description: 'Fraud rule cooldown in seconds' },
  'reservation.default_ttl_seconds':{ key: 'reservation.default_ttl_seconds',type: 'integer_seconds',   min: 30, max: 3600, description: 'Default reservation TTL in seconds' },
  'referral.attribution_window_days':{ key: 'referral.attribution_window_days', type: 'integer',        min: 1, max: 730, description: 'Referral attribution window in days' },
  'agent.drip_recovery_pct':         { key: 'agent.drip_recovery_pct',         type: 'integer_percent',   min: 1, max: 100, description: 'Percentage of each new agent earning applied to outstanding clawback receivable' },
};
```

**Key normalization changes from current codebase:**
- `settlement.hold_hours` → `settlement.hold_seconds` (integer seconds, no floats)
- `payout.rate_limit_hours` → `payout.rate_limit_seconds` (integer seconds — agent override: 8640 = 10 per 24h)
- `revenue_rule.cooldown_hours` → `revenue_rule.cooldown_seconds` (integer seconds)
- `fraud_rule.cooldown_hours` → `fraud_rule.cooldown_seconds` (integer seconds)
- `referral.attribution_window_months` → `referral.attribution_window_days` (integer days)

All durations are stored as **integer seconds or days** — no floating-point values in `value_json`. The `propose()` method validates the value against the schema and rejects proposals with invalid types or out-of-range values before they enter the governance lifecycle.

### 3.5 Parameter Resolution

Runtime parameter lookup follows a three-tier resolution chain:

```
1. entity-specific override  →  system_config WHERE param_key = ? AND entity_type = ? AND status = 'active'
2. global default            →  system_config WHERE param_key = ? AND entity_type IS NULL AND status = 'active'
3. compile-time fallback     →  hardcoded constant in source code (current behavior)
```

**For money-moving operations** (reserve, finalize, settlement, payout), parameter reads MUST occur within the SQLite transaction (`BEGIN IMMEDIATE` block). Redis is used only for non-transactional reads (dashboards, API queries, advisory cap checks).

The `config_version` from the resolved config record is recorded in the operation's audit trail (ledger entry metadata or economic event payload).

---

## 4. Service Architecture

### 4.1 ConstitutionalGovernanceService

**Location:** `themes/sietch/src/packages/adapters/billing/ConstitutionalGovernanceService.ts`
**Port:** `themes/sietch/src/packages/core/ports/IConstitutionalGovernanceService.ts`

```typescript
interface IConstitutionalGovernanceService {
  // Parameter resolution (used by all services)
  resolve<T>(paramKey: string, entityType?: EntityType): Promise<ResolvedParam<T>>;
  resolveInTransaction<T>(tx: Transaction, paramKey: string, entityType?: EntityType): ResolvedParam<T>;

  // Governance lifecycle
  propose(paramKey: string, value: unknown, opts: ProposeOpts): Promise<SystemConfig>;
  approve(configId: string, approverAdminId: string): Promise<SystemConfig>;
  reject(configId: string, rejectorAdminId: string, reason: string): Promise<SystemConfig>;
  activateExpiredCooldowns(): Promise<number>; // BullMQ cron

  // Emergency override (requires 3+ approvals + immediate audit)
  emergencyOverride(configId: string, approvers: string[], justification: string): Promise<SystemConfig>;

  // Query
  getActiveConfig(paramKey: string, entityType?: EntityType): Promise<SystemConfig | null>;
  getConfigHistory(paramKey: string): Promise<SystemConfig[]>;
  getPendingProposals(): Promise<SystemConfig[]>;
}

interface ResolvedParam<T> {
  value: T;
  configVersion: number;
  source: 'entity_override' | 'global_config' | 'compile_fallback';
  configId: string | null;
}

interface ProposeOpts {
  entityType?: EntityType;  // NULL = global, 'agent' = agent-specific override
  proposerAdminId: string;
  justification?: string;
}
```

**State machine:** Reuses `StateMachineDefinition<S>` pattern from `state-machines.ts`:

```typescript
export type SystemConfigState =
  | 'draft'
  | 'pending_approval'
  | 'cooling_down'
  | 'active'
  | 'superseded'
  | 'rejected';

export const SYSTEM_CONFIG_MACHINE: StateMachineDefinition<SystemConfigState> = {
  name: 'system_config',
  initial: 'draft',
  transitions: {
    draft: ['pending_approval'],
    pending_approval: ['cooling_down', 'rejected'],
    cooling_down: ['active', 'rejected'],
    active: ['superseded'],
    superseded: [],
    rejected: [],
  },
  terminal: ['superseded', 'rejected'],
};
```

**Approval flow:**

```
Admin proposes parameter change → status: 'draft'
  → First admin approves → status: 'pending_approval', approval_count: 1
    → Second admin approves → status: 'cooling_down', cooldown_ends_at set (7 days)
      → BullMQ cron detects cooldown expired → status: 'active'
        → Previous active config for same (param_key, entity_type) → status: 'superseded'
```

**Multi-sig enforcement:** The `approved_by` JSON array stores approver IDs. The proposer cannot be among the approvers (four-eyes). Approval count must reach `required_approvals` (default: 2) before cooling can start.

**Emergency override:** Requires 3+ admin approvals in a single call. Bypasses cooldown — config goes directly to `active`. An `emergency_override` audit entry is written with all approver IDs and justification. A notification event (`ConfigActivated` with `emergency: true`) is emitted immediately.

### 4.2 AgentBudgetService

**Location:** `themes/sietch/src/packages/adapters/billing/AgentBudgetService.ts`
**Port:** `themes/sietch/src/packages/core/ports/IAgentBudgetService.ts`

```typescript
interface IAgentBudgetService {
  // Cap management
  setDailyCap(accountId: string, capMicro: bigint): Promise<AgentSpendingLimit>;
  getDailyCap(accountId: string): Promise<AgentSpendingLimit | null>;

  // Budget check (called before reserve())
  checkBudget(accountId: string, amountMicro: bigint): Promise<BudgetCheckResult>;

  // Budget update (called after finalize())
  recordFinalization(accountId: string, reservationId: string, amountMicro: bigint): Promise<void>;

  // Window reset (BullMQ cron)
  resetExpiredWindows(): Promise<number>;

  // Circuit breaker state
  getCircuitState(accountId: string): Promise<CircuitState>;
}

interface BudgetCheckResult {
  allowed: boolean;
  currentSpendMicro: bigint;
  dailyCapMicro: bigint;
  remainingMicro: bigint;
  circuitState: CircuitState;
}

type CircuitState = 'closed' | 'warning' | 'open';
```

**Cap accounting rules (from PRD FR-2):**

The cap tracks **finalized spend only** — reservations are never counted toward the cap. Idempotency is enforced via the `agent_budget_finalizations` table (one row per `(account_id, reservation_id)` — `INSERT OR IGNORE` prevents double-counting across retries):

```typescript
/**
 * Called within the SAME SQLite transaction as the CreditLedgerAdapter.finalize() call.
 * The caller passes the active transaction handle to ensure atomicity.
 */
async recordFinalizationInTransaction(
  tx: Transaction, accountId: string, reservationId: string, amountMicro: bigint
): Promise<void> {
  const now = new Date().toISOString();

  // Get spending limit for this agent
  const limit = await tx.get(
    'SELECT * FROM agent_spending_limits WHERE account_id = ?',
    [accountId]
  );
  if (!limit) return; // No cap configured — no-op

  // Idempotency: INSERT OR IGNORE into finalizations ledger
  const inserted = await tx.run(
    `INSERT OR IGNORE INTO agent_budget_finalizations (account_id, reservation_id, amount_micro, finalized_at)
     VALUES (?, ?, ?, ?)`,
    [accountId, reservationId, amountMicro.toString(), now]
  );
  if (inserted.changes === 0) return; // Already recorded — idempotent skip

  // Check if window has expired → reset
  const windowEnd = new Date(new Date(limit.window_start).getTime() + limit.window_duration_seconds * 1000);
  let windowStart = limit.window_start;
  if (new Date(now) > windowEnd) {
    windowStart = now; // Window expired, reset start
    // Recompute spend from finalizations in new window only
    const windowSpend = await tx.get(
      `SELECT COALESCE(SUM(amount_micro), 0) as total FROM agent_budget_finalizations
       WHERE account_id = ? AND finalized_at >= ?`,
      [accountId, now]
    );
    // New window — only this finalization counts
  }

  // Compute current spend from authoritative finalizations ledger
  const spendResult = await tx.get(
    `SELECT COALESCE(SUM(amount_micro), 0) as total FROM agent_budget_finalizations
     WHERE account_id = ? AND finalized_at >= ?`,
    [accountId, windowStart]
  );
  const newSpend = BigInt(spendResult.total);
  const cap = BigInt(limit.daily_cap_micro);

  // Determine circuit state
  let circuitState: CircuitState = 'closed';
  if (newSpend >= cap) {
    circuitState = 'open';
  } else if (newSpend >= (cap * 80n) / 100n) {
    circuitState = 'warning';
  }

  // Atomic update of spending limit state
  await tx.run(
    `UPDATE agent_spending_limits
     SET current_spend_micro = ?, circuit_state = ?, window_start = ?, updated_at = ?
     WHERE account_id = ?`,
    [newSpend.toString(), circuitState, windowStart, now, accountId]
  );

  // Emit events within transaction (outbox insert)
  if (circuitState === 'warning') {
    await this.eventEmitter.emitInTransaction(tx, {
      eventType: 'AgentBudgetWarning',
      entityType: 'agent', entityId: accountId,
      idempotencyKey: `budget_warning:${accountId}:${reservationId}`,
      payload: { accountId, currentSpendMicro: newSpend.toString(), dailyCapMicro: cap.toString() },
    });
  } else if (circuitState === 'open') {
    await this.eventEmitter.emitInTransaction(tx, {
      eventType: 'AgentBudgetExhausted',
      entityType: 'agent', entityId: accountId,
      idempotencyKey: `budget_exhausted:${accountId}:${reservationId}`,
      payload: { accountId, currentSpendMicro: newSpend.toString(), dailyCapMicro: cap.toString() },
    });
  }
}
```

**Budget check (advisory — called before `reserve()`):**

```typescript
async checkBudget(accountId: string, amountMicro: bigint): Promise<BudgetCheckResult> {
  // Fast path: Redis advisory check (non-authoritative)
  const cached = await this.redis.get(`agent_budget:${accountId}`);
  if (cached) {
    const { currentSpendMicro, dailyCapMicro, circuitState } = JSON.parse(cached);
    if (circuitState === 'open') {
      return { allowed: false, currentSpendMicro, dailyCapMicro, remainingMicro: 0n, circuitState };
    }
  }

  // SQLite authoritative check (used if Redis miss or for final confirmation)
  const limit = await this.db.get(
    'SELECT * FROM agent_spending_limits WHERE account_id = ?',
    [accountId]
  );
  if (!limit) return { allowed: true, currentSpendMicro: 0n, dailyCapMicro: 0n, remainingMicro: 0n, circuitState: 'closed' };

  const cap = BigInt(limit.daily_cap_micro);
  const spend = BigInt(limit.current_spend_micro);
  const remaining = cap > spend ? cap - spend : 0n;

  // Update Redis cache
  await this.redis.setex(`agent_budget:${accountId}`, 60, JSON.stringify({
    currentSpendMicro: spend.toString(),
    dailyCapMicro: cap.toString(),
    circuitState: limit.circuit_state,
  }));

  return {
    allowed: limit.circuit_state !== 'open',
    currentSpendMicro: spend,
    dailyCapMicro: cap,
    remainingMicro: remaining,
    circuitState: limit.circuit_state as CircuitState,
  };
}
```

**Integration with existing reserve/finalize flow:**

Budget enforcement operates at **two points** — advisory pre-check and authoritative finalize-time enforcement:

1. **Pre-check (advisory)**: `AgentBudgetService.checkBudget()` is called before `reserve()` as a fast-path rejection. This is a performance optimization, not a safety guarantee.
2. **Finalize-time (authoritative)**: `AgentBudgetService.recordFinalizationInTransaction()` is called **within the same SQLite `BEGIN IMMEDIATE` transaction** as `CreditLedgerAdapter.finalize()`. This is the safety guarantee — budget increment and finalize are atomic.

All code paths that call `finalize()` for agent accounts MUST go through `AgentAwareFinalizer` — a single application service wrapper that enforces budget accounting:

```typescript
// AgentAwareFinalizer — the ONLY finalize entrypoint for agent accounts
class AgentAwareFinalizer {
  async finalize(reservationId: string, actualCostMicro: bigint, opts?: FinalizeOptions): Promise<FinalizeResult> {
    return this.db.transaction('IMMEDIATE', async (tx) => {
      // 1. Finalize reservation in ledger (within tx)
      const result = await this.ledger.finalizeInTransaction(tx, reservationId, actualCostMicro, opts);

      // 2. If agent account, apply authoritative budget accounting (within same tx)
      const account = await tx.get('SELECT entity_type FROM credit_accounts WHERE id = ?', [result.accountId]);
      if (account.entity_type === 'agent') {
        await this.budgetService.recordFinalizationInTransaction(tx, result.accountId, reservationId, actualCostMicro);
      }

      return result;
    });
  }
}
```

```
Agent requests inference
  → API/Gateway reads account entity_type
  → If entity_type === 'agent':
    → AgentBudgetService.checkBudget(accountId, estimatedCost) [advisory]
      → If circuit_state === 'open': reject with 429
      → If allowed: proceed to CreditLedgerAdapter.reserve()
  → On finalize():
    → AgentAwareFinalizer.finalize(reservationId, actualCost) [authoritative]
      → Within single BEGIN IMMEDIATE transaction:
        1. CreditLedgerAdapter.finalizeInTransaction(tx, ...)
        2. AgentBudgetService.recordFinalizationInTransaction(tx, ...)
      → If budget exceeded: finalize succeeds but circuit opens immediately
        (next reserve() will be rejected)
```

### 4.3 EconomicEventEmitter

**Location:** `themes/sietch/src/packages/adapters/billing/EconomicEventEmitter.ts`
**Port:** `themes/sietch/src/packages/core/ports/IEconomicEventEmitter.ts`

```typescript
interface IEconomicEventEmitter {
  /**
   * Emit an economic event within the caller's SQLite transaction.
   * The event is INSERTed into the `economic_events` table synchronously.
   * External publication happens asynchronously after commit (outbox pattern).
   *
   * @param tx - The active SQLite transaction handle
   * @param event - The event to emit
   */
  emitInTransaction(tx: Transaction, event: EconomicEventInput): Promise<void>;

  /**
   * Emit an event outside a transaction context (for non-financial events).
   * Uses its own BEGIN IMMEDIATE transaction.
   */
  emit(eventType: string, payload: Record<string, unknown>): Promise<void>;
}

interface EconomicEventInput {
  eventType: EconomicEventType;
  entityType: string;
  entityId: string;
  correlationId?: string;
  idempotencyKey: string;
  configVersion?: number;
  payload: Record<string, unknown>;
}
```

**EconomicEvent union type** — extends existing `BillingEvent` for cross-system vocabulary:

```typescript
// packages/core/protocol/economic-events.ts

export type EconomicEventType =
  // From existing BillingEvent (bridged 1:1)
  | 'LotMinted' | 'ReservationCreated' | 'ReservationFinalized' | 'ReservationReleased'
  | 'ReferralRegistered' | 'BonusGranted' | 'BonusFlagged'
  | 'EarningRecorded' | 'EarningSettled' | 'EarningClawedBack'
  | 'PayoutRequested' | 'PayoutApproved' | 'PayoutCompleted' | 'PayoutFailed'
  | 'RewardsDistributed' | 'ScoreImported'
  // New for cycle-030
  | 'AgentBudgetWarning' | 'AgentBudgetExhausted'
  | 'AgentSettlementInstant'
  | 'ConfigProposed' | 'ConfigApproved' | 'ConfigActivated'
  | 'ReconciliationCompleted' | 'ReconciliationDivergence';

/**
 * Base shape for all economic events in the outbox table.
 * Each event includes ordering (rowid), deduplication (idempotency_key),
 * tracing (correlation_id), and governance provenance (config_version).
 */
export interface EconomicEvent {
  eventId: string;           // UUID
  eventType: EconomicEventType;
  entityType: string;
  entityId: string;
  correlationId: string | null;
  idempotencyKey: string;
  configVersion: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

**Outbox dispatch pattern (with claim protocol to prevent double-dispatch):**

```
Within SQLite transaction (synchronous):
  1. Source-of-truth write (ledger entry, config update, etc.)
  2. INSERT INTO economic_events (synchronous, same transaction)
  3. COMMIT

After commit (asynchronous — claim-based dispatcher):
  4. Claim batch atomically:
     UPDATE economic_events
       SET claimed_by = :worker_id, claimed_at = :now
       WHERE rowid IN (
         SELECT rowid FROM economic_events
         WHERE published_at IS NULL AND claimed_by IS NULL
         ORDER BY rowid LIMIT 100
       )
       RETURNING *;
  5. Publish claimed events to external consumers (NATS, webhooks, etc.)
  6. UPDATE economic_events SET published_at = :now WHERE rowid = :rowid AND claimed_by = :worker_id
  7. Stale claim recovery (runs periodically):
     UPDATE economic_events SET claimed_by = NULL, claimed_at = NULL
       WHERE claimed_by IS NOT NULL AND published_at IS NULL
       AND claimed_at < datetime('now', '-60 seconds');
```

**Claim guarantees:** The `UPDATE ... WHERE claimed_by IS NULL RETURNING *` is atomic under SQLite's single-writer model. Concurrent dispatcher workers never claim the same rows. Stale claims (worker crashed mid-publish) are recovered after 60s timeout and re-dispatched by another worker.

**Ordering guarantees:** Events are ordered by `(entity_id, rowid)` for per-entity ordering, or `rowid` alone for global ordering. The SQLite auto-incrementing rowid provides total ordering within the single-writer database.

**Delivery semantics:** At-least-once. The `idempotency_key` enables consumers to deduplicate. Events are NOT gap-free (failed transactions don't emit events since the whole transaction rolls back). The claim protocol minimizes duplicate dispatch to only crash-recovery scenarios (stale claim re-dispatch), not concurrent worker contention.

### 4.4 AgentSettlementPolicy

**Modification to:** `themes/sietch/src/packages/adapters/billing/SettlementService.ts`

Agent earnings settle with a 0-hour hold (configurable via `system_config`). The existing `SettlementService` is modified to read the settlement hold parameter per entity type.

**Critical: all writes within a single transaction.** The `tx` handle is threaded through every write — ledger entry, earning status update, and economic event emission all use the same `BEGIN IMMEDIATE` transaction. If any step fails, the entire transaction rolls back (no partial settlement).

```typescript
async settleEarnings(): Promise<number> {
  const now = new Date().toISOString();
  let settled = 0;

  // Get all pending earnings grouped by entity type
  const pending = await this.db.all(
    `SELECT re.*, ca.entity_type
     FROM referrer_earnings re
     INNER JOIN credit_accounts ca ON ca.id = re.referrer_account_id
     WHERE re.status = 'pending'`
  );

  for (const earning of pending) {
    await this.db.transaction('IMMEDIATE', async (tx) => {
      // Resolve settlement hold per entity type (reads within tx)
      const holdParam = this.governance.resolveInTransaction(
        tx, 'settlement.hold_seconds', earning.entity_type
      );
      const holdSeconds = holdParam.value; // Already integer seconds (no conversion needed)

      // Check if hold has elapsed
      const settleAfter = new Date(new Date(earning.created_at).getTime() + holdSeconds * 1000);
      if (new Date(now) < settleAfter) return; // Still in hold period

      // Write settlement ledger entry — WITHIN SAME TX
      await this.ledger.postEntryInTransaction(tx, {
        accountId: earning.referrer_account_id,
        entryType: 'settlement',
        amountMicro: earning.amount_micro,
        lotId: earning.earning_lot_id,
        idempotencyKey: `settlement:${earning.id}`,
        metadata: JSON.stringify({
          earning_id: earning.id,
          config_version: holdParam.configVersion,
        }),
      });

      // Update earning status — WITHIN SAME TX
      await tx.run(
        `UPDATE referrer_earnings SET status = 'settled', settlement_at = ? WHERE id = ? AND status = 'pending'`,
        [now, earning.id]
      );

      // Emit economic event — WITHIN SAME TX (outbox insert)
      const eventType = holdSeconds === 0 ? 'AgentSettlementInstant' : 'EarningSettled';
      await this.eventEmitter.emitInTransaction(tx, {
        eventType,
        entityType: earning.entity_type,
        entityId: earning.referrer_account_id,
        correlationId: earning.id,
        idempotencyKey: `settlement_event:${earning.id}`,
        configVersion: holdParam.configVersion,
        payload: {
          earningId: earning.id,
          amountMicro: earning.amount_micro.toString(),
          holdSeconds,
        },
      });
    });
    settled++;
  }
  return settled;
}
```

**Transaction threading requirement:** `ICreditLedgerService` MUST expose `postEntryInTransaction(tx, ...)` and `finalizeInTransaction(tx, ...)` overloads that accept an external transaction handle. All money-moving writes in this SDD use these overloads to guarantee atomicity across ledger entry + earning status + economic event emission.
```

**Agent clawback policy (from PRD FR-2b):**

Agent earnings (even with 0-hour settlement hold) remain subject to:
1. **Automated fraud rules**: If `FraudCheckService` flags the underlying transaction, the earning is withheld regardless of entity type.
2. **Clawback**: If the source transaction is reversed (e.g., referee chargeback), the agent earning is clawed back via compensating ledger entry. Existing `clawbackEarning()` method works unchanged.
3. **Non-negative balance with receivable tracking**: If a clawback would create a negative balance, the clawback is applied in two parts within the **same `BEGIN IMMEDIATE` transaction**:
   - **Immediate clawback**: Applied up to available balance (debit agent account to zero).
   - **Receivable entry**: The unpaid remainder is recorded as a `clawback_receivable` ledger entry against the agent's receivable sub-account (`{agentAccountId}:receivable`). This preserves conservation — the liability is not forgiven, it is tracked.
   - **Economic events**: Both `agent_clawback_partial` (for the applied portion) and `agent_clawback_receivable_created` (for the remainder) are emitted within the same transaction.
4. **Drip recovery**: Future agent earnings are intercepted by the `AgentAwareFinalizer`. Before crediting new earnings, it checks the agent's receivable balance. If non-zero, a portion (configurable via `system_config` key `agent.drip_recovery_pct`, default 50%) of each new earning is transferred from the earning to the receivable account via idempotent ledger entries keyed by `drip:{earningId}:{receivableId}`. When the receivable reaches zero, normal earning flow resumes.
5. **Reconciliation**: The `ReconciliationService` includes `clawback_receivable` sub-accounts in its conservation check. The invariant is: `sum(all_account_balances) + sum(all_receivable_balances) = total_minted`. Receivable balances are always >= 0 (they represent money owed to the platform).

### 4.5 AgentProvenanceVerifier

**Location:** `themes/sietch/src/packages/adapters/billing/AgentProvenanceVerifier.ts`

```typescript
interface IAgentProvenanceVerifier {
  // Register agent identity
  registerAgent(opts: RegisterAgentOpts): Promise<AgentIdentity>;

  // Verify agent provenance (called on agent account creation)
  verifyProvenance(accountId: string): Promise<ProvenanceResult>;

  // Resolve creator for an agent
  getCreator(agentAccountId: string): Promise<CreditAccount>;

  // Phase 2: Bind TBA address
  bindTBA(accountId: string, tbaAddress: string): Promise<AgentIdentity>;
}

interface RegisterAgentOpts {
  agentAccountId: string;
  creatorAccountId: string;
  chainId: number;
  contractAddress: string;
  tokenId: string;
  creatorSignature?: string;  // Hex-encoded signature of agent config
}

interface ProvenanceResult {
  verified: boolean;
  creatorKYCLevel: 'none' | 'basic' | 'enhanced';
  identityAnchor: { chainId: number; contractAddress: string; tokenId: string };
}
```

**Beneficiary model:** Agents are controlled sub-ledgers of a KYC'd creator:
- Agent earnings credit the agent's internal account (for spending on inference)
- Surplus (earnings > spending) is transferable to the creator's account
- Creator KYC level governs payout thresholds for agent-originating earnings
- Agent cannot receive external payouts directly (Phase 1)

### 4.6 ReconciliationService (ADR-008)

**Location:** `themes/sietch/src/packages/adapters/billing/ReconciliationService.ts`

```typescript
interface IReconciliationService {
  // Run periodic reconciliation check
  reconcile(): Promise<ReconciliationResult>;

  // Get reconciliation history
  getHistory(limit?: number): Promise<ReconciliationResult[]>;
}

interface ReconciliationResult {
  timestamp: string;
  checks: ReconciliationCheck[];
  status: 'passed' | 'divergence_detected';
}

interface ReconciliationCheck {
  name: string;
  expected: bigint;
  actual: bigint;
  divergenceMicro: bigint;
  passed: boolean;
}
```

**Reconciliation checks:**

1. **Internal conservation** (credit ledger only):
   ```sql
   -- For each account: available + reserved + consumed = total minted - expired
   SELECT account_id,
     SUM(available_micro + reserved_micro + consumed_micro) as lot_sum,
     SUM(original_micro) as minted_sum
   FROM credit_lots
   GROUP BY account_id
   HAVING lot_sum != minted_sum
   ```

   **Including clawback receivables:** Agent accounts may have associated receivable sub-accounts (`{accountId}:receivable`). The global conservation check must include these:
   ```sql
   -- Global conservation: all balances + all receivables = total minted
   SELECT
     (SELECT SUM(available_micro + reserved_micro + consumed_micro) FROM credit_lots) as total_lots,
     (SELECT COALESCE(SUM(balance_micro), 0) FROM agent_clawback_receivables
      WHERE balance_micro > 0) as total_receivables,
     (SELECT SUM(original_micro) FROM credit_lots) as total_minted
   -- Invariant: total_lots + total_receivables = total_minted
   ```

2. **Cross-system bridge conservation** (credit ledger ↔ budget engine):
   ```
   sum(credit_ledger.reserved_micro WHERE status = 'pending') == sum(budget_engine.allocated_capacity)
   ```
   This check is design-only in Phase 1 (ADR-008). The test harness simulates the budget engine side.

3. **Agent spending vs cap** (agent budget engine):
   ```sql
   -- Verify cap counter matches actual finalized spend in window
   SELECT asl.account_id, asl.current_spend_micro,
     (SELECT COALESCE(SUM(actual_cost_micro), 0) FROM credit_reservations
      WHERE account_id = asl.account_id AND status = 'finalized'
      AND finalized_at >= asl.window_start) as actual_spend
   FROM agent_spending_limits asl
   WHERE asl.current_spend_micro != actual_spend
   ```

**Reconciliation NEVER auto-corrects.** Divergence > threshold triggers an alert event (`ReconciliationDivergence`) and admin notification.

### 4.7 Parameter Migration Path

To replace hardcoded constants with runtime-configurable parameters, each service is modified to read from `ConstitutionalGovernanceService` instead of constants:

```typescript
// BEFORE (current code)
const KYC_BASIC_THRESHOLD_MICRO = 100_000_000n;  // CreatorPayoutService.ts:67

// AFTER (cycle-030)
const kycThreshold = this.governance.resolveInTransaction(
  tx, 'kyc.basic_threshold_micro', account.entityType
);
// kycThreshold.value = 100000000 (from system_config or compile-time fallback)
// kycThreshold.configVersion = 3 (recorded in audit trail)
// kycThreshold.source = 'entity_override' | 'global_config' | 'compile_fallback'
```

**Compile-time fallbacks (unchanged from current codebase):**

| Param Key | Fallback Value | Source File | Notes |
|-----------|---------------|-------------|-------|
| `kyc.basic_threshold_micro` | `100000000` | CreatorPayoutService.ts:67 | bigint_micro |
| `kyc.enhanced_threshold_micro` | `600000000` | CreatorPayoutService.ts:68 | bigint_micro |
| `settlement.hold_seconds` | `172800` | SettlementService.ts:55 | 48h in seconds |
| `payout.min_micro` | `1000000` | CreatorPayoutService.ts:64 | bigint_micro |
| `payout.rate_limit_seconds` | `86400` | CreatorPayoutService.ts:71 | 24h in seconds |
| `payout.fee_cap_percent` | `20` | CreatorPayoutService.ts:77 | integer percent |
| `revenue_rule.cooldown_seconds` | `172800` | RevenueRulesAdapter.ts:34 | 48h in seconds |
| `fraud_rule.cooldown_seconds` | `604800` | FraudRulesService.ts:129 | 168h in seconds |
| `reservation.default_ttl_seconds` | `300` | CreditLedgerAdapter.ts:48 | integer seconds |
| `referral.attribution_window_days` | `365` | ReferralService | 12 months ≈ 365 days |

**Entity-type overrides seeded at migration time:**

| Param Key | Entity Type | Override Value | Notes |
|-----------|-------------|----------------|-------|
| `settlement.hold_seconds` | `agent` | `0` | Instant settlement |
| `payout.min_micro` | `agent` | `10000` | $0.01 micro-transactions |
| `payout.rate_limit_seconds` | `agent` | `8640` | ~10 per 24h |

---

## 5. API Design

### 5.1 Constitutional Governance Endpoints

```
POST   /api/admin/config/propose         Propose parameter change
POST   /api/admin/config/:id/approve     Approve pending proposal
POST   /api/admin/config/:id/reject      Reject pending proposal
POST   /api/admin/config/:id/emergency   Emergency override (3+ admins)
GET    /api/admin/config                  List active configuration
GET    /api/admin/config/pending          List pending proposals
GET    /api/admin/config/:key/history     Get parameter history
```

#### `POST /api/admin/config/propose`

**Auth:** Admin bearer token
**Body:**
```json
{
  "param_key": "settlement.hold_seconds",
  "entity_type": "agent",
  "value": 0,
  "justification": "Agents don't need human dispute windows"
}
```
**Response:** `201 Created`
```json
{
  "id": "...",
  "param_key": "settlement.hold_seconds",
  "entity_type": "agent",
  "value_json": "0",
  "status": "draft",
  "required_approvals": 2,
  "approval_count": 0
}
```

#### `POST /api/admin/config/:id/approve`

**Auth:** Admin bearer token (different admin from proposer)
**Response:** `200 OK`
```json
{
  "id": "...",
  "status": "cooling_down",
  "approval_count": 2,
  "cooldown_ends_at": "2026-02-23T00:00:00Z"
}
```
**Errors:** `403` (self-approval), `409` (already approved by this admin), `400` (invalid state)

### 5.2 Agent Budget Endpoints

```
GET    /api/agent/:id/budget             Get agent budget status
PUT    /api/agent/:id/budget/cap         Set daily spending cap
GET    /api/agent/:id/identity           Get agent identity/provenance
```

#### `GET /api/agent/:id/budget`

**Response:** `200 OK`
```json
{
  "account_id": "...",
  "daily_cap_micro": 50000000,
  "current_spend_micro": 12000000,
  "remaining_micro": 38000000,
  "circuit_state": "closed",
  "window_resets_at": "2026-02-17T00:00:00Z"
}
```

### 5.3 Reconciliation Endpoints

```
POST   /api/admin/reconciliation/run     Trigger manual reconciliation
GET    /api/admin/reconciliation/history  Get reconciliation history
```

### 5.4 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `POST /api/admin/config/propose` | 10/hour per admin |
| `POST /api/admin/config/:id/approve` | 50/hour per admin |
| `POST /api/admin/config/:id/emergency` | 3/day per admin |
| `GET /api/agent/:id/budget` | 60/minute per account |

---

## 6. Security Architecture

### 6.1 Constitutional Governance Security

- **Multi-sig**: Minimum 2 admin approvals; proposer cannot self-approve (four-eyes enforced via `approved_by` array check)
- **Extended cooldown**: 7-day window between approval and activation for constitutional parameters (vs 48h for revenue rules)
- **Emergency override**: Requires 3+ admin approvals + immediate audit notification. All approver IDs recorded in `system_config_audit` with `action: 'emergency_override'`
- **Append-only audit**: Every governance action recorded in `system_config_audit` — no UPDATE or DELETE allowed on this table
- **Config versioning**: Monotonically increasing `config_version` prevents stale reads. Money-moving operations record the version used

### 6.2 Agent Budget Security

- **Defense-in-depth**: Redis atomic counter (advisory, fast check) + SQLite authoritative counter (within same transaction as finalize)
- **Idempotent cap updates**: `agent_budget_finalizations` table with `PRIMARY KEY (account_id, reservation_id)` and `INSERT OR IGNORE` prevents double-counting on retry — each reservation can only increment spend once
- **Circuit breaker**: 80% warning → 100% hard stop. All `reserve()` calls for that agent are rejected until window resets
- **No negative caps**: `current_spend_micro` is monotonically increasing within a window. Window reset is the only decrease
- **Creator cannot override agent cap**: Cap changes require admin governance (prevents creator from removing safety limits)

### 6.3 Agent Provenance Security

- **Chain-of-custody**: Agent identity is verified via creator's wallet signature, not human identity documents
- **Canonical anchor**: `(chain_id, contract_address, token_id)` is immutable after registration. Phase 2 `tba_address` is additive only
- **Creator KYC cascades**: Agent payout thresholds are governed by the creator's KYC level, not the agent's
- **No orphan agents**: Agent account creation requires a valid `creator_account_id` that exists in `credit_accounts`

### 6.4 Economic Event Security

- **Synchronous outbox**: Events are INSERTed within the same SQLite transaction as source-of-truth writes. No orphan events, no missed events
- **Idempotency**: `idempotency_key` UNIQUE constraint prevents duplicate events on retry
- **Append-only**: `economic_events` table has no UPDATE or DELETE in application code. `published_at` is the only mutable field (set by dispatcher after external publish)
- **No data leakage**: Event payloads contain account IDs and amounts but no PII. Cross-system consumers authenticate via API keys

---

## 7. Migration Plan

### 7.1 New Migrations

| Migration | Tables/Changes |
|-----------|---------------|
| `047_system_config` | `system_config`, `system_config_audit`, seed default parameters, seed agent-specific overrides |
| `048_agent_budget` | `agent_spending_limits`, `agent_budget_finalizations` |
| `049_agent_identity` | `agent_identity`, `agent_clawback_receivables` |
| `050_economic_events` | `economic_events` outbox table (with claim columns) |

### 7.2 Seed Data (Migration 047)

```sql
-- Seed global defaults (matching current hardcoded values, normalized to integer seconds/days)
INSERT INTO system_config (param_key, entity_type, value_json, status, config_version, proposed_by, activated_at)
VALUES
  ('kyc.basic_threshold_micro', NULL, '100000000', 'active', 1, 'migration', datetime('now')),
  ('kyc.enhanced_threshold_micro', NULL, '600000000', 'active', 1, 'migration', datetime('now')),
  ('settlement.hold_seconds', NULL, '172800', 'active', 1, 'migration', datetime('now')),
  ('payout.min_micro', NULL, '1000000', 'active', 1, 'migration', datetime('now')),
  ('payout.rate_limit_seconds', NULL, '86400', 'active', 1, 'migration', datetime('now')),
  ('payout.fee_cap_percent', NULL, '20', 'active', 1, 'migration', datetime('now')),
  ('revenue_rule.cooldown_seconds', NULL, '172800', 'active', 1, 'migration', datetime('now')),
  ('fraud_rule.cooldown_seconds', NULL, '604800', 'active', 1, 'migration', datetime('now')),
  ('reservation.default_ttl_seconds', NULL, '300', 'active', 1, 'migration', datetime('now')),
  ('referral.attribution_window_days', NULL, '365', 'active', 1, 'migration', datetime('now'));

-- Seed version sequence counters
INSERT INTO system_config_version_seq (param_key, entity_type, current_version)
SELECT param_key, entity_type, 1 FROM system_config WHERE status = 'active';

-- Seed agent-specific overrides
INSERT INTO system_config (param_key, entity_type, value_json, status, config_version, proposed_by, activated_at)
VALUES
  ('settlement.hold_seconds', 'agent', '0', 'active', 1, 'migration', datetime('now')),
  ('payout.min_micro', 'agent', '10000', 'active', 1, 'migration', datetime('now')),
  ('payout.rate_limit_seconds', 'agent', '8640', 'active', 1, 'migration', datetime('now')),
  ('agent.drip_recovery_pct', 'agent', '50', 'active', 1, 'migration', datetime('now'));

-- Seed agent override version counters
INSERT INTO system_config_version_seq (param_key, entity_type, current_version)
VALUES
  ('settlement.hold_seconds', 'agent', 1),
  ('payout.min_micro', 'agent', 1),
  ('payout.rate_limit_seconds', 'agent', 1),
  ('agent.drip_recovery_pct', 'agent', 1);
```

### 7.3 Backward Compatibility

- All existing tests (439+) continue passing unchanged
- Services that don't read from `system_config` continue using compile-time constants
- `system_config` seed data matches current hardcoded values exactly
- Migration is purely additive — no existing column changes, no constraint modifications

---

## 8. Queue Architecture

### 8.1 New BullMQ Queues

| Queue | Purpose | Concurrency | Schedule |
|-------|---------|-------------|----------|
| `config-activation` | Activate configs after cooldown expiry | 1 | Cron: every hour |
| `budget-window-reset` | Reset expired agent spending windows | 1 | Cron: every hour |
| `economic-event-dispatch` | Publish outbox events to external consumers | 3 | Poll: every 10s |
| `reconciliation` | Run cross-system reconciliation checks | 1 | Cron: every 6 hours |

### 8.2 Modified Existing Queues

| Queue | Modification |
|-------|-------------|
| `settlement-check` | Modified to read settlement hold per entity type from `system_config` |

---

## 9. Observability

### 9.1 Metrics

| Metric | Type | Alert |
|--------|------|-------|
| `config.proposals.created` | Counter | Monitoring only |
| `config.proposals.activated` | Counter | Monitoring only |
| `config.emergency_overrides` | Counter | Any = alert (exceptional) |
| `agent.budget.warnings` | Counter | >10/hour = alert |
| `agent.budget.exhausted` | Counter | >5/hour = alert (runaway pattern) |
| `agent.budget.utilization_pct` | Histogram | p90 >90% = alert |
| `agent.settlement.instant_count` | Counter | Monitoring only |
| `economic_events.emitted` | Counter | Monitoring only |
| `economic_events.dispatch_lag_ms` | Histogram | p99 >5000ms = alert |
| `economic_events.unpublished_count` | Gauge | >1000 = alert (dispatcher stuck) |
| `reconciliation.divergence_count` | Counter | Any >0 = critical alert |
| `reconciliation.check_duration_ms` | Histogram | p99 >30s = warning |

### 9.2 Audit Trail

All governance actions append to `system_config_audit` (immutable, append-only). Additional audit:
- `economic_events` — unified financial event trail
- `agent_spending_limits` — cap counter state (mutable but version-tracked)
- Existing: `credit_ledger`, `revenue_rule_audit_log`, `referral_attribution_log`

---

## 10. Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| Parameter resolution (money-moving) | <2ms p99 | SQLite indexed lookup within transaction |
| Parameter resolution (dashboard) | <1ms p99 | Redis cache (60s TTL) |
| Agent budget check | <5ms p99 | Redis advisory + SQLite fallback |
| Agent budget finalization update | <3ms p99 | Single UPDATE within existing finalize transaction |
| Economic event emission | <2ms overhead | Single INSERT within existing transaction |
| Economic event dispatch (outbox) | <100ms per batch | Poll + batch publish |
| Reconciliation check | <30s for 10K accounts | Aggregate SQL queries |
| Config activation (cooldown expiry) | <100ms per config | Cron hourly, single UPDATE |
| Agent settlement (instant) | <100ms p99 | Same as existing settlement, hold = 0 |

---

## 11. Technical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Constitutional migration breaks parameter reads | Medium | High | Compile-time fallback: if `system_config` lookup returns null, use hardcoded constant. Migration seeds values identical to current constants. Feature flag: `SYSTEM_CONFIG_ENABLED=false` falls back to all compile-time. |
| Agent budget cap race condition (concurrent finalize) | Low | Medium | SQLite single-writer prevents concurrent writes to `agent_spending_limits`. Redis advisory is eventually-consistent (acceptable — authoritative check is in SQLite transaction). Idempotent via `agent_budget_finalizations` PK `(account_id, reservation_id)` with `INSERT OR IGNORE`. |
| Economic event outbox grows unbounded | Low | Low | Async dispatcher runs every 10s. Retention: published events archived after 30 days. Index on `published_at IS NULL` ensures fast poll. |
| Config version monotonicity breaks on edge case | Low | Medium | `config_version` is per-`(param_key, entity_type)` — allocated via `system_config_version_seq` counter table under `BEGIN IMMEDIATE`, with `UNIQUE(param_key, entity_type, config_version)` DB-enforced constraint. No `MAX+1` races possible. |
| Cross-system reconciliation reveals inconsistencies at launch | Medium | Medium | ADR-008 is design-only in Phase 1. Test harness simulates budget engine. Reconciliation is alert-only (never auto-corrects). |

---

## 12. Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `better-sqlite3` | existing | SQLite database (already in codebase) |
| `ioredis` | existing | Redis client (already in codebase) |
| `bullmq` | existing | Queue management (already in codebase) |
| `uuid` | existing | Event ID generation (already in codebase) |

**No new infrastructure dependencies.** All runs on existing SQLite + Redis + BullMQ stack.

---

## 13. Key Decisions (ADR Cross-References)

| ADR | Title | SDD Sections Affected |
|-----|-------|-----------------------|
| [ADR-008](decisions/adr-008-cross-system-reconciliation.md) | Cross-System Balance Reconciliation | §4.6 ReconciliationService (design-only in Phase 1) |
| [ADR-010](decisions/adr-010-rounding-algorithm.md) | Largest-Remainder Rounding | §4.2 Budget cap (BigInt arithmetic, no rounding issues) |
| [ADR-013](decisions/adr-013-timestamp-format-convention.md) | Timestamp Format Convention | §3.1 Tables (ISO 8601 format) |
| [ADR-015](decisions/adr-015-sqlite-locking-hierarchy.md) | SQLite Locking Hierarchy | §4.1-4.4 (BEGIN IMMEDIATE for money ops) |
| NEW: ADR-016 | Constitutional vs Statutory Parameter Taxonomy | §3.3 Parameter Resolution, §4.1 Governance |
| NEW: ADR-017 | Outbox Pattern for Economic Events | §3.1 economic_events, §4.3 EconomicEventEmitter |

---

## 14. Phase Mapping

### Phase 1: Constitutional Foundation (Sprints 1-9, Global 275-283)

| Sprint | Components |
|--------|-----------|
| 1-2 | Migration 047, ConstitutionalGovernanceService, system_config state machine, parameter resolution with compile-time fallback |
| 3-4 | Entity-specific overrides, modify SettlementService + CreatorPayoutService + FraudRulesService to read from system_config, AgentSettlementPolicy |
| 5-6 | Migration 048-049, AgentBudgetService + circuit breaker, AgentProvenanceVerifier, agent_identity table |
| 7 | Migration 050, EconomicEventEmitter (outbox), EconomicEvent union type, event emission from credit ledger operations |
| 8 | ADR-008 design document, ReconciliationService + test harness, reconciliation cron |
| 9 | Cross-sprint coherence review stage, E2E testing, integration validation |

### Phase 2: Agent Sovereignty (Future Cycle)

| Sprint | Components |
|--------|-----------|
| 1-2 | ERC-6551 TBA binding: `tba_address` column, on-chain verification, `agent_identity` Phase 2 fields |
| 3-4 | Agent self-authorization: TBA-signed reserve/finalize, referral code generation, budget-cap-bounded autonomy |
| 5 | Agent economic self-sustainability dashboard, surplus transfer to creator account |

---

*Generated with Loa Framework `/architect`*
*Grounded in: existing billing infrastructure (migrations 030-046), `ICreditLedgerService`, `state-machines.ts`, `billing-events.ts`, `RevenueRulesAdapter`, `AgentWalletPrototype`, `CreditLedgerAdapter`, `SettlementService`, `CreatorPayoutService`, `FraudRulesService`*

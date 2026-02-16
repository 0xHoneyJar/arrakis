# Sprint Plan: The Kwisatz Haderach — Agent Economic Citizenship & Constitutional Governance

**Version:** 1.1.0
**Date:** 2026-02-16
**Cycle:** cycle-030
**PRD:** `grimoires/loa/prd.md` v1.0.0
**SDD:** `grimoires/loa/sdd.md` v1.0.0

---

## Overview

| Parameter | Value |
|-----------|-------|
| Total sprints | 9 |
| Phase 1 (Constitutional Foundation) | Sprints 1-9 |
| Sprint size | 1 agent session each |
| Global sprint IDs | 275-283 |
| Estimated total tasks | ~50 |

---

## Sprint 1: Constitutional Governance — Schema & State Machine (Sprint 275)

**Goal:** Database foundation for constitutional governance with full state machine lifecycle
**PRD refs:** FR-4, FR-5
**SDD refs:** SS3.1, SS7.1, SS7.2

### Tasks

#### Task 1.1: Create migration 047_system_config

**Description:** Create the `system_config` table with governance lifecycle columns, the `system_config_audit` append-only audit trail, and the `system_config_version_seq` monotonic version counter table. All three tables per SDD SS3.1 schema definitions.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/047_system_config.ts`
**Acceptance Criteria:**
- [ ] `system_config` table created with all columns: `id`, `param_key`, `entity_type`, `value_json`, `config_version`, `active_from`, `status` (CHECK constraint for 6 states), `proposed_by`, `proposed_at`, `approved_by` (JSON array), `approval_count`, `required_approvals`, `cooldown_ends_at`, `activated_at`, `superseded_at`, `superseded_by`, `metadata`, `created_at`
- [ ] UNIQUE index `idx_system_config_active` on `(param_key, entity_type) WHERE status = 'active'`
- [ ] UNIQUE index `idx_system_config_version` on `(param_key, entity_type, config_version)`
- [ ] Lookup index `idx_system_config_lookup` on `(param_key, status, entity_type)`
- [ ] `system_config_audit` table created with `AUTOINCREMENT` PK, `config_id` FK, `action` CHECK, `actor`, `previous_status`, `new_status`, `config_version`, `metadata`, `created_at`
- [ ] `system_config_version_seq` table created with `param_key`, `entity_type`, `current_version`, UNIQUE constraint on `(param_key, entity_type)`
- [ ] Migration runs cleanly forward and rolls back without errors

**Testing:**
- Migration forward/rollback test
- Constraint validation: insert with invalid status rejected
- UNIQUE index enforcement: two active configs for same `(param_key, entity_type)` rejected

#### Task 1.2: Seed global defaults and agent-specific overrides

**Description:** Seed all 10 constitutional parameters with their current hardcoded values (normalized to integer seconds/days per SDD SS3.4) as active system_config rows. Seed 4 agent-specific overrides (settlement.hold_seconds=0, payout.min_micro=10000, payout.rate_limit_seconds=8640, agent.drip_recovery_pct=50). Seed version sequence counters for all seeded configs.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/047_system_config.ts`
**Acceptance Criteria:**
- [ ] 10 global defaults seeded with `status: 'active'`, `config_version: 1`, `proposed_by: 'migration'`
- [ ] 4 agent-specific overrides seeded with `entity_type: 'agent'`, `status: 'active'`
- [ ] Version sequence counters seeded for all 14 config rows
- [ ] Seeded values match current hardcoded constants exactly (per SDD SS4.7 fallback table)
- [ ] Seed is idempotent: running migration twice does not duplicate rows

**Testing:**
- Query seeded data and validate all 14 rows present with correct values
- Verify version sequence counters match

#### Task 1.3: Define SYSTEM_CONFIG_MACHINE state machine

**Description:** Add the `SystemConfigState` type and `SYSTEM_CONFIG_MACHINE` definition to `state-machines.ts`, reusing the existing `StateMachineDefinition<S>` generic. Six states: `draft`, `pending_approval`, `cooling_down`, `active`, `superseded`, `rejected`. Terminal states: `superseded`, `rejected`.
**File(s):** `themes/sietch/src/packages/core/billing/state-machines.ts`
**Acceptance Criteria:**
- [ ] `SystemConfigState` union type exported with all 6 states
- [ ] `SYSTEM_CONFIG_MACHINE` exported conforming to `StateMachineDefinition<SystemConfigState>`
- [ ] Transitions: `draft -> pending_approval`, `pending_approval -> cooling_down | rejected`, `cooling_down -> active | rejected`, `active -> superseded`
- [ ] Terminal states: `superseded`, `rejected` (empty transition arrays)
- [ ] No changes to existing state machine definitions (`RevenueRuleState`, etc.)

**Testing:**
- Unit tests: validate all legal transitions succeed
- Unit tests: validate all illegal transitions throw (e.g., `draft -> active`, `superseded -> draft`)
- Unit tests: verify terminal states have no outgoing transitions

#### Task 1.4: Create SystemConfig and ResolvedParam TypeScript types

**Description:** Define the `SystemConfig`, `ResolvedParam<T>`, `ProposeOpts`, and `SystemConfigState` TypeScript types in the core protocol layer for use across the codebase.
**File(s):** `themes/sietch/src/packages/core/billing/billing-types.ts`
**Acceptance Criteria:**
- [ ] `SystemConfig` interface matches all `system_config` table columns
- [ ] `ResolvedParam<T>` generic interface with `value: T`, `configVersion: number`, `source: 'entity_override' | 'global_config' | 'compile_fallback'`, `configId: string | null`
- [ ] `ProposeOpts` interface with `entityType?`, `proposerAdminId`, `justification?`
- [ ] Types compile and are re-exported from barrel

**Testing:**
- Type compilation test (no runtime tests needed for types)

---

## Sprint 2: Constitutional Governance — Service & Parameter Resolution (Sprint 276)

**Goal:** Full ConstitutionalGovernanceService with multi-sig approval, emergency override, and parameter resolution chain
**PRD refs:** FR-4, FR-5, FR-6
**SDD refs:** SS4.1, SS3.3, SS3.4, SS5.1, SS8.1

### Tasks

#### Task 2.1: Create IConstitutionalGovernanceService port interface

**Description:** Define the port interface per SDD SS4.1 with all method signatures: `resolve`, `resolveInTransaction`, `propose`, `submit`, `approve`, `reject`, `activateExpiredCooldowns`, `emergencyOverride`, `getActiveConfig`, `getConfigHistory`, `getPendingProposals`. The `submit()` method transitions a draft proposal to `pending_approval` status, making it visible for approval. This separates proposal creation (draft) from submission for review.
**File(s):** `themes/sietch/src/packages/core/ports/IConstitutionalGovernanceService.ts`
**Acceptance Criteria:**
- [ ] Interface exported with all 11 method signatures (including `submit`)
- [ ] `resolve<T>` and `resolveInTransaction<T>` return `ResolvedParam<T>`
- [ ] `propose` accepts `ProposeOpts` and returns `Promise<SystemConfig>` with `status: 'draft'`
- [ ] `submit(configId: string, proposerAdminId: string): Promise<SystemConfig>` transitions `draft -> pending_approval`
- [ ] Port compiles and is re-exported from barrel

**Testing:**
- Type compilation test

#### Task 2.2: Implement ConstitutionalGovernanceService

**Description:** Full adapter implementation with governance lifecycle. Includes three-tier parameter resolution (entity override -> global config -> compile-time fallback), multi-sig approval flow (2+ admins, four-eyes enforcement), 7-day cooldown, and config version allocation via `system_config_version_seq` counter table under `BEGIN IMMEDIATE`.
**File(s):** `themes/sietch/src/packages/adapters/billing/ConstitutionalGovernanceService.ts`
**Acceptance Criteria:**
- [ ] `propose()` validates value against `CONFIG_SCHEMA`, allocates version from `system_config_version_seq` under `BEGIN IMMEDIATE`, inserts `system_config` row with `status: 'draft'`, writes audit entry
- [ ] `submit(configId, proposerAdminId)` transitions `draft -> pending_approval`, writes audit entry. Only the original proposer can submit their own draft
- [ ] `approve()` requires status `pending_approval`, enforces four-eyes (proposer cannot approve), increments `approval_count`, transitions to `cooling_down` when `approval_count >= required_approvals`, sets `cooldown_ends_at` (7 days)
- [ ] `reject()` transitions from `pending_approval` or `cooling_down` to `rejected`, writes audit entry
- [ ] `resolve()` follows three-tier chain: entity-specific override -> global -> compile-time fallback
- [ ] `resolveInTransaction()` reads from SQLite within provided transaction handle (not Redis)
- [ ] `emergencyOverride()` requires 3+ approvers, bypasses cooldown, transitions directly to `active`, writes `emergency_override` audit entry
- [ ] `activateExpiredCooldowns()` finds configs with `status = 'cooling_down'` and `cooldown_ends_at <= now`, transitions to `active`, supersedes previous active config for same `(param_key, entity_type)`

**Testing:**
- Unit tests: full approval flow (propose -> submit -> approve -> approve -> cooling_down -> activate)
- Unit tests: approve on draft (not submitted) throws `InvalidStateError`
- Unit tests: four-eyes violation throws `FourEyesViolationError`
- Unit tests: emergency override with 3 admins succeeds, with 2 admins rejected
- Unit tests: parameter resolution chain (entity -> global -> compile fallback)
- Unit tests: schema validation rejects invalid type, out-of-range values

#### Task 2.3: Implement CONFIG_SCHEMA parameter schema registry

**Description:** Define the `ParamSchema` interface and `CONFIG_SCHEMA` registry per SDD SS3.4. All 10+ constitutional parameters with typed validation, integer seconds normalization. Validation function that checks type, range, and rejects proposals with invalid values.
**File(s):** `themes/sietch/src/packages/core/protocol/config-schema.ts`
**Acceptance Criteria:**
- [ ] `ParamSchema` interface with `key`, `type` (enum: `integer`, `bigint_micro`, `integer_seconds`, `integer_percent`, `nullable`), `min?`, `max?`, `description`
- [ ] `CONFIG_SCHEMA` record covering all 10 parameters plus `agent.drip_recovery_pct`
- [ ] `validateConfigValue(key: string, value: unknown): ValidationResult` exported
- [ ] Duration normalization: all durations stored as integer seconds (no hours/months)
- [ ] Validation rejects: wrong type, below min, above max, unknown key

**Testing:**
- Unit tests: valid values for each parameter type pass validation
- Unit tests: out-of-range values rejected with descriptive error
- Unit tests: unknown parameter key rejected

#### Task 2.4: Implement config-activation BullMQ cron job

**Description:** Hourly cron that calls `ConstitutionalGovernanceService.activateExpiredCooldowns()` to transition configs past their 7-day cooldown into `active` state, superseding any previous active config.
**File(s):** `themes/sietch/src/packages/adapters/billing/crons/config-activation.ts`
**Acceptance Criteria:**
- [ ] BullMQ cron job registered with hourly schedule
- [ ] Calls `activateExpiredCooldowns()` and logs count of activated configs
- [ ] Follows existing cron patterns (e.g., `revenue-rules-activator.ts`)
- [ ] Handles empty result (no configs to activate) gracefully

**Testing:**
- Unit test: config past cooldown activated on cron run
- Unit test: config still in cooldown period not activated
- Unit test: previous active config superseded after activation

#### Task 2.5: Create constitutional governance admin API endpoints

**Description:** Create admin API routes per SDD SS5.1 for propose, approve, reject, emergency override, list active, list pending, and parameter history.
**File(s):** `themes/sietch/src/packages/adapters/billing/routes/config-admin.ts`
**Acceptance Criteria:**
- [ ] `POST /api/admin/config/propose` — validates body, calls `propose()`, returns 201 with `status: 'draft'`
- [ ] `POST /api/admin/config/:id/submit` — transitions draft to `pending_approval`, only by original proposer
- [ ] `POST /api/admin/config/:id/approve` — four-eyes enforced, requires `pending_approval` status, returns updated config
- [ ] `POST /api/admin/config/:id/reject` — returns updated config
- [ ] `POST /api/admin/config/:id/emergency` — requires 3+ approvers in body
- [ ] `GET /api/admin/config` — lists all active configuration
- [ ] `GET /api/admin/config/pending` — lists pending proposals
- [ ] `GET /api/admin/config/:key/history` — returns parameter history
- [ ] Rate limits: 10/hr propose, 50/hr approve, 3/day emergency
- [ ] All endpoints behind `requireRole('admin')` middleware

**Testing:**
- Integration tests: propose -> approve -> list active
- Integration tests: 403 on non-admin access
- Integration tests: 409 on self-approval

---

## Sprint 3: Entity-Specific Overrides & Parameter Migration (Sprint 277)

**Goal:** Wire existing services to read governance parameters from system_config with entity-type differentiation
**PRD refs:** FR-1, FR-5, FR-6
**SDD refs:** SS3.3, SS3.5, SS4.7

### Tasks

#### Task 3.1: Implement entity-specific parameter resolution

**Description:** Extend `ConstitutionalGovernanceService.resolve()` and `resolveInTransaction()` to support the full three-tier resolution chain with entity-type differentiation. The lookup queries entity-specific override first, then global default, then returns compile-time fallback.
**File(s):** `themes/sietch/src/packages/adapters/billing/ConstitutionalGovernanceService.ts`
**Acceptance Criteria:**
- [ ] `resolve('settlement.hold_seconds', 'agent')` returns `{ value: 0, source: 'entity_override' }`
- [ ] `resolve('settlement.hold_seconds', 'person')` returns `{ value: 172800, source: 'global_config' }` (no person override seeded)
- [ ] `resolve('nonexistent.key', undefined)` returns compile-time fallback with `source: 'compile_fallback'`
- [ ] `resolveInTransaction(tx, ...)` reads from SQLite within provided transaction (not Redis)
- [ ] Resolution records `configVersion` from the resolved row

**Testing:**
- Unit tests: entity override -> global -> compile fallback chain
- Unit tests: entity type with no override falls through to global
- Unit tests: transaction-bound resolution for money-moving operations
- Property test: resolution always returns a value (never undefined)

#### Task 3.2: Modify SettlementService to read settlement.hold_seconds from system_config

**Description:** Replace the hardcoded 48h constant in `SettlementService` with a `ConstitutionalGovernanceService.resolveInTransaction()` call for `settlement.hold_seconds`, resolved per entity type. Agent earnings will settle with 0-hour hold; human earnings retain 48-hour hold.
**File(s):** `themes/sietch/src/packages/adapters/billing/SettlementService.ts`
**Acceptance Criteria:**
- [ ] Settlement hold read from `system_config` via `resolveInTransaction(tx, 'settlement.hold_seconds', entity_type)`
- [ ] Agent earnings settle immediately (0-second hold)
- [ ] Human earnings settle after 172800 seconds (48 hours) — unchanged behavior
- [ ] `configVersion` recorded in settlement ledger entry metadata
- [ ] All existing settlement tests continue passing (backward compatibility)

**Testing:**
- Unit test: agent earning settles immediately
- Unit test: human earning respects 48h hold
- Unit test: compile-time fallback used when system_config empty
- Regression: existing settlement test suite passes unchanged

#### Task 3.3: Modify CreatorPayoutService to read KYC thresholds and payout parameters

**Description:** Replace hardcoded KYC thresholds (`$100/$600`), minimum payout, rate limit, and fee cap constants with `resolveInTransaction()` calls. Agent accounts bypass KYC (provenance verification only).
**File(s):** `themes/sietch/src/packages/adapters/billing/CreatorPayoutService.ts`
**Acceptance Criteria:**
- [ ] `kyc.basic_threshold_micro` read from system_config (default: 100000000)
- [ ] `kyc.enhanced_threshold_micro` read from system_config (default: 600000000)
- [ ] `payout.min_micro` read from system_config (default: 1000000; agent: 10000)
- [ ] `payout.rate_limit_seconds` read from system_config (default: 86400; agent: 8640)
- [ ] `payout.fee_cap_percent` read from system_config (default: 20)
- [ ] All existing payout tests continue passing

**Testing:**
- Unit test: agent account uses agent-specific payout.min_micro (10000)
- Unit test: human account uses global payout.min_micro (1000000)
- Regression: existing payout test suite passes unchanged

#### Task 3.4: Seed data validation and backward compatibility tests

**Description:** Comprehensive test that verifies seed data matches current hardcoded values exactly, ensuring zero behavioral change for existing human accounts after migration.
**File(s):** `themes/sietch/src/tests/unit/billing/governance-seed-validation.test.ts`
**Acceptance Criteria:**
- [ ] Test reads all 14 seeded system_config rows and validates values match SDD SS4.7 fallback table
- [ ] Test verifies agent overrides return correct differentiated values
- [ ] Test verifies resolution chain produces identical behavior to pre-migration hardcoded constants
- [ ] All 439+ existing tests from cycle-029 continue passing

**Testing:**
- Seed validation test suite
- Full existing test suite regression run

---

## Sprint 4: Agent Settlement Policy & Clawback (Sprint 278)

**Goal:** Agent instant settlement, clawback receivable model, and transaction threading for money-moving operations
**PRD refs:** FR-1, FR-2b
**SDD refs:** SS4.4, SS4.2 (transaction threading), SS3.1 (agent_clawback_receivables)

### Tasks

#### Task 4.1: Modify FraudRulesService and RevenueRulesAdapter to read cooldown from system_config

**Description:** Replace hardcoded cooldown constants in `FraudRulesService` (168h) and `RevenueRulesAdapter` (48h) with `resolveInTransaction()` calls for `fraud_rule.cooldown_seconds` and `revenue_rule.cooldown_seconds` respectively.
**File(s):** `themes/sietch/src/packages/adapters/billing/FraudRulesService.ts`, `themes/sietch/src/packages/adapters/billing/RevenueRulesAdapter.ts`
**Acceptance Criteria:**
- [ ] `FraudRulesService` reads `fraud_rule.cooldown_seconds` from system_config (default: 604800)
- [ ] `RevenueRulesAdapter` reads `revenue_rule.cooldown_seconds` from system_config (default: 172800)
- [ ] Both services use compile-time fallback when system_config unavailable
- [ ] Existing fraud/revenue rules tests pass unchanged

**Testing:**
- Unit test: cooldown period matches system_config value
- Regression: existing test suites pass

#### Task 4.2: Implement AgentSettlementPolicy with 0-hour hold

**Description:** Implement the agent-specific settlement behavior where agent earnings settle immediately (no human dispute window). The existing `SettlementService` already reads per-entity hold from system_config (Sprint 3.2); this task adds the `AgentSettlementInstant` economic event emission and validates the 0-hold path end-to-end.
**File(s):** `themes/sietch/src/packages/adapters/billing/SettlementService.ts`
**Acceptance Criteria:**
- [ ] Agent earnings with `hold_seconds = 0` settle in the same cron cycle they appear
- [ ] `AgentSettlementInstant` event emitted (distinct from `EarningSettled`)
- [ ] Automated fraud rules still apply to agent earnings regardless of hold
- [ ] Settlement ledger entry written with `config_version` in metadata

**Testing:**
- Unit test: agent earning created and settled in same cycle
- Unit test: fraudulent agent earning withheld despite 0-hold
- Integration test: agent settlement E2E flow

#### Task 4.3: Implement transaction threading (postEntryInTransaction, finalizeInTransaction)

**Description:** Add `postEntryInTransaction(tx, ...)` and `finalizeInTransaction(tx, ...)` overloads to `ICreditLedgerService` that accept an external transaction handle. All money-moving writes across ledger entry + earning status + economic event emission must share the same `BEGIN IMMEDIATE` transaction.
**File(s):** `themes/sietch/src/packages/core/ports/ICreditLedgerService.ts`, `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts`
**Acceptance Criteria:**
- [ ] `postEntryInTransaction(tx, opts)` accepts external transaction handle
- [ ] `finalizeInTransaction(tx, reservationId, actualCostMicro, opts?)` accepts external transaction handle
- [ ] Existing `postEntry()` and `finalize()` methods unchanged (backward compatible)
- [ ] Transaction-threaded overloads used by SettlementService (Sprint 3.2) and AgentAwareFinalizer (Sprint 6)
- [ ] If any step within the shared transaction fails, entire transaction rolls back

**Testing:**
- Unit test: postEntryInTransaction writes within provided transaction
- Unit test: forced rollback after postEntryInTransaction confirms no orphan writes
- Unit test: existing postEntry() still works standalone

#### Task 4.4: Create migration 048_agent_clawback_receivables and implement clawback receivable model

**Description:** Create migration `048_agent_clawback_receivables` for the `agent_clawback_receivables` table. This migration is numbered 048 (immediately after 047_system_config) so that it is available when Sprint 4 code is deployed. Subsequent migrations are renumbered: 049 (agent_budget, Sprint 5), 050 (agent_identity, Sprint 7), 051 (economic_events, Sprint 8), 052 (reconciliation_runs, Sprint 9). Implement partial clawback with receivable tracking. When clawback exceeds agent balance, apply up to available balance and record remainder as receivable.

**Ledger semantics for receivables:** A receivable is an **off-ledger liability** -- it is NOT a credit lot or ledger entry. When a partial clawback occurs: (a) a compensating debit entry is posted to the agent's account for the available balance (standard clawback path), (b) the unpaid remainder is recorded in `agent_clawback_receivables` as an IOU. The conservation invariant for credit lots remains `available + reserved + consumed = total_minted` (lots-only). A separate invariant tracks receivables: `sum(receivable.balance_micro) = total_outstanding_platform_IOUs`. The combined platform-level invariant is: `sum(all_lot_balances) + sum(all_receivable_balances) = sum(all_minted) - sum(all_expired)`. ReconciliationService (Sprint 9) runs both checks independently.

**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/048_agent_clawback_receivables.ts`, `themes/sietch/src/packages/adapters/billing/SettlementService.ts`
**Acceptance Criteria:**
- [ ] `agent_clawback_receivables` table created in migration 048 with `id`, `account_id` FK, `source_clawback_id`, `original_amount_micro`, `balance_micro`, `created_at`, `resolved_at`
- [ ] CHECK constraints: `original_amount_micro > 0`, `balance_micro >= 0`
- [ ] Index on `(account_id) WHERE balance_micro > 0`
- [ ] Migration 048 ships with Sprint 4 release -- table available before Sprint 4 code runs
- [ ] Clawback against insufficient agent balance: posts compensating debit up to available balance (standard ledger entry), creates receivable row for unpaid remainder (off-ledger IOU)
- [ ] Both `agent_clawback_partial` and `agent_clawback_receivable_created` events emitted via `BillingEventEmitter` (existing in-memory event bus, NOT the economic_events outbox which is Sprint 8)
- [ ] Conservation invariant: `clawback_applied + receivable_created = original_clawback_amount`

**Testing:**
- Migration forward/rollback test
- Unit test: full clawback when balance sufficient (no receivable created)
- Unit test: partial clawback + receivable when balance insufficient
- Unit test: conservation invariant holds across partial clawback
- Property test: `applied + receivable = original` for random amounts

#### Task 4.5: Implement drip recovery from future agent earnings

**Description:** Intercept future agent earnings to recover outstanding clawback receivables. When a new earning is credited to an agent with non-zero receivable balance, a configurable percentage (`agent.drip_recovery_pct`, default 50%) is transferred from the earning to reduce the receivable. When receivable reaches zero, normal earning flow resumes.
**File(s):** `themes/sietch/src/packages/adapters/billing/SettlementService.ts`
**Acceptance Criteria:**
- [ ] Before crediting agent earning, check for outstanding receivables
- [ ] If receivable exists: deduct `drip_recovery_pct` of earning, apply to receivable
- [ ] Drip recovery keyed by `drip:{earningId}:{receivableId}` for idempotency
- [ ] Receivable `resolved_at` set when `balance_micro` reaches 0
- [ ] `agent.drip_recovery_pct` read from system_config (default: 50)

**Testing:**
- Unit test: earning with outstanding receivable triggers drip recovery
- Unit test: drip percentage matches system_config value
- Unit test: receivable resolved when balance reaches zero
- Unit test: idempotent on retry (same earning ID)

---

## Sprint 5: Agent Budget Engine — Schema & Core (Sprint 279)

**Goal:** Budget cap database schema and core AgentBudgetService with idempotent finalization tracking
**PRD refs:** FR-2
**SDD refs:** SS3.1, SS4.2, SS7.1

### Tasks

#### Task 5.1: Create migration 049_agent_budget

**Description:** Create `agent_spending_limits` and `agent_budget_finalizations` tables per SDD SS3.1 schema definitions.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/049_agent_budget.ts`
**Acceptance Criteria:**
- [ ] `agent_spending_limits` table with `id`, `account_id` (UNIQUE, FK), `daily_cap_micro` BIGINT, `current_spend_micro` BIGINT DEFAULT 0, `window_start`, `window_duration_seconds` DEFAULT 86400, `circuit_state` CHECK ('closed','warning','open'), `created_at`, `updated_at`
- [ ] `agent_budget_finalizations` table with PK `(account_id, reservation_id)`, `amount_micro` BIGINT, `finalized_at`
- [ ] `account_id` FK references `credit_accounts(id)` in both tables
- [ ] Migration runs cleanly forward and rolls back

**Testing:**
- Migration forward/rollback test
- Constraint validation: duplicate (account_id, reservation_id) rejected
- FK constraint: invalid account_id rejected

#### Task 5.2: Create IAgentBudgetService port interface

**Description:** Define the port interface per SDD SS4.2 with `setDailyCap`, `getDailyCap`, `checkBudget`, `recordFinalization`, `resetExpiredWindows`, `getCircuitState`.
**File(s):** `themes/sietch/src/packages/core/ports/IAgentBudgetService.ts`
**Acceptance Criteria:**
- [ ] Interface exported with all 6 method signatures
- [ ] `BudgetCheckResult` type exported with `allowed`, `currentSpendMicro`, `dailyCapMicro`, `remainingMicro`, `circuitState`
- [ ] `CircuitState` type exported: `'closed' | 'warning' | 'open'`
- [ ] Port compiles and is re-exported from barrel

**Testing:**
- Type compilation test

#### Task 5.3: Implement AgentBudgetService core

**Description:** Full adapter implementation with `setDailyCap`, `getDailyCap`, `checkBudget` (Redis advisory + SQLite authoritative), `recordFinalization` (standalone), and `recordFinalizationInTransaction` (transaction-threaded). Budget idempotency via `INSERT OR IGNORE` on `agent_budget_finalizations`.
**File(s):** `themes/sietch/src/packages/adapters/billing/AgentBudgetService.ts`
**Acceptance Criteria:**
- [ ] `setDailyCap(accountId, capMicro)` creates/updates agent_spending_limits row
- [ ] `getDailyCap(accountId)` returns current limit or null
- [ ] `checkBudget(accountId, amountMicro)` uses Redis fast path, falls back to SQLite
- [ ] `recordFinalizationInTransaction(tx, accountId, reservationId, amountMicro)` records finalization idempotently via `INSERT OR IGNORE`, computes new spend from authoritative finalizations ledger using precise windowed query: `SELECT COALESCE(SUM(amount_micro), 0) FROM agent_budget_finalizations WHERE account_id = ? AND finalized_at >= ? AND finalized_at < ?` (where bounds are `window_start` and `window_start + window_duration_seconds`), updates circuit state
- [ ] Index on `agent_budget_finalizations(account_id, finalized_at)` for efficient windowed spend computation
- [ ] Idempotency: recording same `(account_id, reservation_id)` twice is a no-op (`INSERT OR IGNORE` returns `changes === 0`)
- [ ] Window expiry: if current time >= `window_start + window_duration_seconds`, reset `window_start` to current time and recompute spend from finalizations in new window only (new window spend starts from the current finalization only)
- [ ] Window boundary precision: `finalized_at >= window_start AND finalized_at < window_end` (half-open interval, no double-counting at boundaries)

**Testing:**
- Unit test: set cap, check budget (allowed), record finalization, check budget again
- Unit test: idempotency -- double finalization records same amount once
- Unit test: window reset after expiry -- spend recomputed for new window only
- Unit test: finalization at exact window boundary assigned to correct window
- Unit test: Redis cache miss falls through to SQLite

#### Task 5.4: Implement budget-window-reset BullMQ cron job

**Description:** Hourly cron that calls `AgentBudgetService.resetExpiredWindows()` to reset spending windows that have exceeded their duration. Recomputes `current_spend_micro` from `agent_budget_finalizations` within the new window.
**File(s):** `themes/sietch/src/packages/adapters/billing/crons/budget-window-reset.ts`
**Acceptance Criteria:**
- [ ] BullMQ cron registered with hourly schedule
- [ ] Resets `current_spend_micro` and `circuit_state` for expired windows
- [ ] Recomputes spend from finalizations within new window only
- [ ] Invalidates Redis cache for reset accounts

**Testing:**
- Unit test: expired window resets spend to 0, circuit state to 'closed'
- Unit test: non-expired window untouched
- Unit test: Redis cache invalidated on reset

---

## Sprint 6: Agent Budget — Circuit Breaker & AgentAwareFinalizer (Sprint 280)

**Goal:** Circuit breaker enforcement and the authoritative AgentAwareFinalizer that wraps finalize + budget accounting atomically
**PRD refs:** FR-2
**SDD refs:** SS4.2, SS6.2

### Tasks

#### Task 6.1: Implement circuit breaker thresholds

**Description:** Wire circuit breaker state transitions within `AgentBudgetService.recordFinalizationInTransaction()`. At 80% of daily cap: emit `AgentBudgetWarning` event and set `circuit_state = 'warning'`. At 100%: emit `AgentBudgetExhausted` and set `circuit_state = 'open'`. When open, `checkBudget()` returns `allowed: false`.

**Event emission strategy (pre-outbox):** The `economic_events` outbox table does not exist until Sprint 8. In Sprint 6, circuit breaker events are emitted via the existing `BillingEventEmitter` (in-memory event bus). The `AgentBudgetService` accepts an `IEventEmitter` interface (dependency injection). Sprint 8 Task 8.5 backfills the wiring to also write these events to the `economic_events` outbox table once it exists. This avoids a circular dependency while preserving testability.

**File(s):** `themes/sietch/src/packages/adapters/billing/AgentBudgetService.ts`
**Acceptance Criteria:**
- [ ] At 80% cap: `circuit_state` transitions to `'warning'`, `AgentBudgetWarning` event emitted via `BillingEventEmitter` (existing in-memory event bus)
- [ ] At 100% cap: `circuit_state` transitions to `'open'`, `AgentBudgetExhausted` event emitted via `BillingEventEmitter`
- [ ] `checkBudget()` returns `allowed: false` when `circuit_state === 'open'`
- [ ] `AgentBudgetService` accepts injected `IEventEmitter` interface (Sprint 8 will provide outbox-backed implementation)
- [ ] Below 80%: `circuit_state` remains `'closed'`

**Testing:**
- Unit test: spend at 79% -> closed, 80% -> warning, 100% -> open
- Unit test: checkBudget rejects when circuit open
- Unit test: window reset transitions circuit back to closed
- Unit test: mock IEventEmitter receives correct event types

#### Task 6.2: Implement AgentAwareFinalizer

**Description:** Single application service wrapper that all agent finalize entrypoints MUST use. Wraps `CreditLedgerAdapter.finalizeInTransaction()` + `AgentBudgetService.recordFinalizationInTransaction()` in the same `BEGIN IMMEDIATE` transaction. Non-agent accounts pass through to standard finalize.
**File(s):** `themes/sietch/src/packages/adapters/billing/AgentAwareFinalizer.ts`
**Acceptance Criteria:**
- [ ] `finalize(reservationId, actualCostMicro, opts?)` wraps both ledger finalize + budget accounting in one transaction
- [ ] For non-agent accounts: delegates directly to standard `finalize()` (no budget accounting)
- [ ] For agent accounts: both finalize and budget accounting are atomic — if either fails, both roll back
- [ ] Budget exceeded at finalize time: finalize succeeds but circuit opens immediately (next reserve rejected)
- [ ] All agent finalize code paths go through AgentAwareFinalizer (no direct ledger.finalize for agents)

**Testing:**
- Unit test: agent finalize records budget and ledger atomically
- Unit test: non-agent finalize skips budget accounting
- Unit test: rollback on budget service failure also rolls back ledger finalize
- Integration test: concurrent finalize safety (SQLite single-writer serialization)

#### Task 6.3: Integrate Redis atomic counter for advisory fast check

**Description:** Wire Redis `INCRBY` and `GET` for advisory budget cap checks on `reserve()`. Redis counter is synced from SQLite on finalize and window reset. Redis is never authoritative — only an optimization to avoid SQLite reads on every reserve.
**File(s):** `themes/sietch/src/packages/adapters/billing/AgentBudgetService.ts`
**Acceptance Criteria:**
- [ ] `checkBudget()` reads Redis counter first (`agent_budget:{accountId}`)
- [ ] Redis cache updated after `recordFinalizationInTransaction()` completes
- [ ] Redis cache invalidated on window reset
- [ ] Redis miss falls through to SQLite authoritative check
- [ ] Redis TTL: 60 seconds (stale data tolerated for advisory checks)

**Testing:**
- Unit test: Redis hit returns fast result
- Unit test: Redis miss triggers SQLite query
- Unit test: Redis counter updated after finalization

#### Task 6.4: Wire AgentAwareFinalizer into existing finalize entrypoints

**Description:** Identify all code paths that call `CreditLedgerAdapter.finalize()` and route agent-entity calls through `AgentAwareFinalizer`. Ensure no direct `finalize()` call exists for agent accounts outside the wrapper.
**File(s):** Various billing adapter files
**Acceptance Criteria:**
- [ ] All finalize calls for agent accounts routed through AgentAwareFinalizer
- [ ] Non-agent finalize paths unchanged
- [ ] Existing finalize tests continue passing
- [ ] Grep confirms no direct `finalize(` calls for agent entity type outside AgentAwareFinalizer

**Testing:**
- Regression: all existing finalize tests pass
- Code audit: verify routing completeness

---

## Sprint 7: Agent Identity & Provenance (Sprint 281)

**Goal:** Agent identity table, provenance verification, and creator KYC cascade
**PRD refs:** FR-3
**SDD refs:** SS3.1, SS4.5

### Tasks

#### Task 7.1: Create migration 050_agent_identity

**Description:** Create the `agent_identity` table per SDD SS3.1 with canonical identity anchor `(chain_id, contract_address, token_id)`, creator reference, optional `tba_address` for Phase 2, and creator signature field.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/050_agent_identity.ts`
**Acceptance Criteria:**
- [ ] `agent_identity` table with `id`, `account_id` (UNIQUE FK), `chain_id`, `contract_address`, `token_id`, `tba_address` (nullable, Phase 2), `creator_account_id` FK, `creator_signature`, `verified_at`, `created_at`
- [ ] UNIQUE constraint on `(chain_id, contract_address, token_id)` — one agent per on-chain identity
- [ ] Index on `creator_account_id` for creator lookups
- [ ] Migration runs cleanly forward and rolls back

**Testing:**
- Migration forward/rollback test
- Constraint validation: duplicate canonical anchor rejected
- FK constraint: invalid creator_account_id rejected

#### Task 7.2: Create IAgentProvenanceVerifier port interface

**Description:** Define the port interface per SDD SS4.5 with `registerAgent`, `verifyProvenance`, `getCreator`, `bindTBA` (stub for Phase 2).
**File(s):** `themes/sietch/src/packages/core/ports/IAgentProvenanceVerifier.ts`
**Acceptance Criteria:**
- [ ] `registerAgent(opts: RegisterAgentOpts): Promise<AgentIdentity>` — registers canonical identity
- [ ] `verifyProvenance(accountId: string): Promise<ProvenanceResult>` — verifies chain-of-custody
- [ ] `getCreator(agentAccountId: string): Promise<CreditAccount>` — resolves creator
- [ ] `bindTBA(accountId: string, tbaAddress: string): Promise<AgentIdentity>` — Phase 2 stub
- [ ] Types: `RegisterAgentOpts`, `ProvenanceResult`, `AgentIdentity` exported

**Testing:**
- Type compilation test

#### Task 7.3: Implement AgentProvenanceVerifier

**Description:** Full adapter implementation. Agent registration validates the canonical identity anchor is unique, links to creator account, and optionally stores creator's wallet signature. Provenance verification checks creator KYC level cascades to agent. `bindTBA` is a Phase 2 stub that throws `NotImplementedError`.
**File(s):** `themes/sietch/src/packages/adapters/billing/AgentProvenanceVerifier.ts`
**Acceptance Criteria:**
- [ ] `registerAgent()` inserts `agent_identity` row, validates uniqueness of `(chain_id, contract_address, token_id)`
- [ ] `registerAgent()` validates `creator_account_id` exists in `credit_accounts`
- [ ] `verifyProvenance()` returns creator's KYC level, verified status, identity anchor
- [ ] `getCreator()` resolves creator account from `agent_identity.creator_account_id`
- [ ] `bindTBA()` throws `NotImplementedError('Phase 2: ERC-6551 TBA binding')`
- [ ] Duplicate registration (same canonical anchor) rejected with clear error

**Testing:**
- Unit test: successful registration
- Unit test: duplicate canonical anchor rejected
- Unit test: provenance verification returns correct creator KYC level
- Unit test: creator resolution
- Unit test: bindTBA throws NotImplementedError

#### Task 7.4: Create agent registration and provenance API endpoints

**Description:** API endpoints for agent registration and provenance queries per SDD SS5.2.
**File(s):** `themes/sietch/src/packages/adapters/billing/routes/agent.ts`
**Acceptance Criteria:**
- [ ] `POST /api/agent/register` — registers agent identity, returns `AgentIdentity`
- [ ] `GET /api/agent/:id/provenance` — returns provenance verification result
- [ ] `GET /api/agent/:id/identity` — returns full agent identity record
- [ ] Registration validates required fields: `agentAccountId`, `creatorAccountId`, `chainId`, `contractAddress`, `tokenId`
- [ ] Proper error responses: 409 for duplicate registration, 400 for missing fields

**Testing:**
- Integration test: register agent -> query provenance
- Integration test: duplicate registration returns 409
- Integration test: provenance includes creator KYC level

---

## Sprint 8: Economic Event Outbox & Emission (Sprint 282)

**Goal:** Unified economic event outbox table, discriminated union type, and synchronous event emission from credit ledger operations
**PRD refs:** FR-7, FR-8
**SDD refs:** SS3.1, SS4.3, SS7.1

### Tasks

#### Task 8.1: Create migration 051_economic_events

**Description:** Create the `economic_events` outbox table per SDD SS3.1 with claim protocol columns (`claimed_by`, `claimed_at`), publication tracking (`published_at`), and all required indexes for dispatch, stale claim recovery, and per-entity ordering.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/051_economic_events.ts`
**Acceptance Criteria:**
- [ ] `economic_events` table with `rowid` AUTOINCREMENT PK, `event_id` (UNIQUE), `event_type`, `entity_type`, `entity_id`, `correlation_id`, `idempotency_key` (UNIQUE), `config_version`, `payload` (JSON), `claimed_by`, `claimed_at`, `published_at`, `created_at`
- [ ] Index `idx_economic_events_dispatchable` on `(rowid) WHERE published_at IS NULL AND claimed_by IS NULL`
- [ ] Index `idx_economic_events_stale_claims` on `(claimed_at) WHERE claimed_by IS NOT NULL AND published_at IS NULL`
- [ ] Index `idx_economic_events_entity` on `(entity_id, rowid)`
- [ ] Migration runs cleanly forward and rolls back

**Testing:**
- Migration forward/rollback test
- Constraint validation: duplicate `event_id` or `idempotency_key` rejected
- Index existence verification

#### Task 8.2: Define EconomicEvent discriminated union type

**Description:** Create the `EconomicEventType` union and `EconomicEvent` interface per SDD SS4.3. All 24+ event types covering existing credit ledger operations plus new cycle-030 events.
**File(s):** `themes/sietch/src/packages/core/protocol/economic-events.ts`
**Acceptance Criteria:**
- [ ] `EconomicEventType` string literal union exported with all types: `LotMinted`, `ReservationCreated`, `ReservationFinalized`, `ReservationReleased`, `ReferralRegistered`, `BonusGranted`, `BonusFlagged`, `EarningRecorded`, `EarningSettled`, `EarningClawedBack`, `PayoutRequested`, `PayoutApproved`, `PayoutCompleted`, `PayoutFailed`, `RewardsDistributed`, `ScoreImported`, `AgentBudgetWarning`, `AgentBudgetExhausted`, `AgentSettlementInstant`, `ConfigProposed`, `ConfigApproved`, `ConfigActivated`, `ReconciliationCompleted`, `ReconciliationDivergence`
- [ ] `EconomicEvent` interface with `eventId`, `eventType`, `entityType`, `entityId`, `correlationId`, `idempotencyKey`, `configVersion`, `payload`, `createdAt`
- [ ] `EconomicEventInput` interface for emitter input (without auto-generated fields)
- [ ] Types compile and are re-exported from barrel

**Testing:**
- Type compilation test
- Verify every existing credit ledger operation has a corresponding event type

#### Task 8.3: Implement EconomicEventEmitter

**Description:** Implement `IEconomicEventEmitter` per SDD SS4.3 with `emitInTransaction(tx, event)` for synchronous event insertion within the caller's transaction, and `emit(event)` for standalone emission with its own transaction.
**File(s):** `themes/sietch/src/packages/adapters/billing/EconomicEventEmitter.ts`, `themes/sietch/src/packages/core/ports/IEconomicEventEmitter.ts`
**Acceptance Criteria:**
- [ ] `emitInTransaction(tx, event)` INSERTs into `economic_events` within the provided transaction handle
- [ ] `emit(event)` creates its own `BEGIN IMMEDIATE` transaction for non-financial events
- [ ] UUID generation for `event_id`
- [ ] `idempotency_key` UNIQUE constraint prevents duplicate events on retry (INSERT OR IGNORE)
- [ ] Event payload serialized as JSON string

**Testing:**
- Unit test: emitInTransaction writes event within caller's transaction
- Unit test: forced rollback after emitInTransaction confirms no orphan event row
- Unit test: duplicate idempotency_key silently skipped
- Unit test: standalone emit creates its own transaction

#### Task 8.4: Implement outbox dispatch with claim protocol

**Description:** Async dispatcher that claims unpublished events atomically, publishes to external consumers, and marks as published. Includes stale claim recovery for crashed workers.
**File(s):** `themes/sietch/src/packages/adapters/billing/crons/economic-event-dispatch.ts`
**Acceptance Criteria:**
- [ ] BullMQ queue `economic-event-dispatch` with concurrency 3, poll every 10s
- [ ] Two-step SQLite-compatible claim pattern (no `UPDATE...LIMIT RETURNING`): (a) `SELECT rowid FROM economic_events WHERE published_at IS NULL AND claimed_by IS NULL ORDER BY rowid LIMIT 100`, (b) `UPDATE economic_events SET claimed_by = :worker, claimed_at = :now WHERE rowid IN (:rowids) AND claimed_by IS NULL AND published_at IS NULL`, (c) `SELECT * FROM economic_events WHERE claimed_by = :worker AND published_at IS NULL` to retrieve claimed rows
- [ ] After external publish: `UPDATE economic_events SET published_at = :now WHERE rowid = :rowid AND claimed_by = :worker`
- [ ] Stale claim recovery: events claimed >60s ago without publish are unclaimed via `UPDATE economic_events SET claimed_by = NULL, claimed_at = NULL WHERE claimed_by IS NOT NULL AND published_at IS NULL AND claimed_at < datetime('now', '-60 seconds')`
- [ ] No double-claim under concurrency: SQLite single-writer serialization ensures step (b) guard `AND claimed_by IS NULL` prevents races

**Testing:**
- Unit test: event claimed and published successfully
- Unit test: stale claim recovered after 60s timeout
- Unit test: concurrent claim attempts serialized correctly
- Unit test: already-published events not re-claimed

#### Task 8.5: Wire event emission into credit ledger operations and backfill circuit breaker outbox

**Description:** Add `EconomicEventEmitter.emitInTransaction()` calls to key credit ledger operations: `postEntry` (LotMinted), `reserve` (ReservationCreated), `finalize` (ReservationFinalized), `release` (ReservationReleased). Also backfill `AgentBudgetService` (Sprint 6) to inject the outbox-backed `EconomicEventEmitter` as the `IEventEmitter` implementation, so that `AgentBudgetWarning` and `AgentBudgetExhausted` events are now written to the `economic_events` outbox table within the finalize transaction.
**File(s):** `themes/sietch/src/packages/adapters/billing/CreditLedgerAdapter.ts`, `themes/sietch/src/packages/adapters/billing/AgentBudgetService.ts`
**Acceptance Criteria:**
- [ ] `LotMinted` emitted on `postEntry` for credit entries
- [ ] `ReservationCreated` emitted on `reserve`
- [ ] `ReservationFinalized` emitted on `finalize`
- [ ] `ReservationReleased` emitted on `release`
- [ ] All emissions use `emitInTransaction(tx, ...)` within existing transaction
- [ ] `AgentBudgetService` IEventEmitter wired to outbox-backed `EconomicEventEmitter` (backfill from Sprint 6)
- [ ] `AgentBudgetWarning` and `AgentBudgetExhausted` events now written to `economic_events` outbox within finalize transaction
- [ ] Existing credit ledger tests continue passing (event emission is additive)

**Testing:**
- Unit test: each ledger operation emits corresponding event to outbox
- Unit test: event payload contains correct amounts, account IDs
- Unit test: AgentBudgetWarning/Exhausted events appear in economic_events table
- Regression: all existing credit ledger tests pass
- Atomicity test: rollback after emit confirms no orphan events

---

## Sprint 9: Reconciliation, E2E & Launch Readiness (Sprint 283)

**Goal:** ADR-008 reconciliation design, ReconciliationService, cross-sprint coherence review, and full E2E integration validation
**PRD refs:** FR-9, FR-10, FR-13, G-4, G-6
**SDD refs:** SS4.6, SS8.1, SS9

### Tasks

#### Task 9.1: Write ADR-008 design document

**Description:** Write the cross-system reconciliation ADR per PRD FR-9. Covers semantic distinction (conserved funds vs authorized capacity), canonical bridge mechanism (credit ledger reservation = single source of truth), authority model, reconciliation protocol (alert-only, never auto-correct), clawback propagation, and event-based synchronization.
**File(s):** `grimoires/loa/decisions/adr-008-cross-system-reconciliation.md`
**Acceptance Criteria:**
- [ ] ADR covers all 6 topics from PRD FR-9
- [ ] Semantic distinction: credit ledger = conserved funds, budget engine = authorized capacity
- [ ] Bridge mechanism: `reserve()` locks credits 1:1 to budget capacity
- [ ] Reconciliation is alert-only — never auto-corrects
- [ ] Clawback propagation: `EarningClawedBack` triggers budget capacity reduction
- [ ] Event-based sync: budget engine subscribes to economic events

**Testing:**
- ADR review (no automated testing — design document)

#### Task 9.2: Create reconciliation_runs table and implement ReconciliationService with test harness

**Description:** Create a `reconciliation_runs` table for persisting reconciliation results (no dedicated migration needed -- added as part of Sprint 9 setup via a lightweight schema creation in the ReconciliationService init or a migration 052). Implement `IReconciliationService` per SDD SS4.6 with four reconciliation checks: internal conservation (credit lots), cross-system bridge (simulated), agent spending vs cap, and clawback receivables. Reconciliation NEVER auto-corrects -- divergence emits `ReconciliationDivergence` event.

**Conservation invariant semantics (clarified per GPT review):** Two independent invariants are checked:
1. **Lots-only conservation:** `sum(available_micro + reserved_micro + consumed_micro) = sum(original_micro) - sum(expired_micro)` per account (standard credit ledger invariant, unchanged from cycle-029)
2. **Receivable conservation:** `sum(receivable.balance_micro WHERE balance_micro > 0)` tracks total outstanding platform IOUs (off-ledger liabilities, not counted in lot sums)
3. **Platform-level combined:** `sum(all_lot_balances) + sum(all_receivable_balances) = sum(all_minted) - sum(all_expired)` -- this proves no value leaked

**File(s):** `themes/sietch/src/packages/adapters/billing/ReconciliationService.ts`, `themes/sietch/src/packages/core/ports/IReconciliationService.ts`, `themes/sietch/src/packages/adapters/billing/migrations/052_reconciliation_runs.ts` (migration 052 ships with Sprint 9 release)
**Acceptance Criteria:**
- [ ] `reconciliation_runs` table created with `id`, `started_at`, `finished_at`, `status` ('passed'|'divergence_detected'), `checks_json` (JSON array of check results), `divergence_summary_json`, `created_at`
- [ ] Internal conservation check (lots-only): `available + reserved + consumed = original - expired` per account
- [ ] Receivable balance check (separate invariant): `sum(receivable.balance_micro) = total_outstanding_IOUs`
- [ ] Platform-level combined check: `sum(all_lot_balances) + sum(all_receivable_balances) = sum(all_minted) - sum(all_expired)`
- [ ] Cross-system bridge check: `sum(locked_credits) == sum(allocated_capacity)` (simulated budget engine)
- [ ] Agent spending vs cap check: `current_spend_micro` matches actual finalized spend in window (see Task 5.3 precise query)
- [ ] `ReconciliationCompleted` event on pass, `ReconciliationDivergence` event on failure
- [ ] Results persisted to `reconciliation_runs` table for history queries

**Testing:**
- Unit test: healthy state passes all three conservation checks
- Unit test: simulated divergence detected and reported (lot mismatch vs receivable mismatch)
- Unit test: receivable balance check separate from lot conservation
- Unit test: results persisted and retrievable via `getHistory()`
- Integration test: full reconciliation flow per PRD FR-10 (earn -> reserve -> finalize -> reconcile)

#### Task 9.3: Implement reconciliation BullMQ cron and API endpoints

**Description:** Every-6-hours cron that runs `reconcile()`. Admin API endpoints for manual trigger and history queries.
**File(s):** `themes/sietch/src/packages/adapters/billing/crons/reconciliation.ts`, `themes/sietch/src/packages/adapters/billing/routes/reconciliation-admin.ts`
**Acceptance Criteria:**
- [ ] BullMQ cron: `reconciliation` every 6 hours
- [ ] `POST /api/admin/reconciliation/run` — triggers manual reconciliation, returns result
- [ ] `GET /api/admin/reconciliation/history` — returns recent results
- [ ] Both endpoints behind `requireRole('admin')` middleware

**Testing:**
- Unit test: cron triggers reconciliation on schedule
- Integration test: manual trigger via API returns result

#### Task 9.4: Cross-sprint coherence review (FR-13)

**Description:** Perform a systematic cross-sprint coherence review across all 8 completed sprints. Check for naming divergence, format inconsistency, parameter drift, and architectural tension. Document findings as coherence issues tagged with affected sprints.
**File(s):** `grimoires/loa/coherence-review-030.md`
**Acceptance Criteria:**
- [ ] All 8 sprints reviewed for naming consistency (e.g., service names, table column names, event type names)
- [ ] Timestamp format consistency verified across all new tables (ISO 8601 via `strftime`)
- [ ] Parameter key naming convention verified (`category.name_unit` pattern)
- [ ] Economic event type names match table operations 1:1
- [ ] Any found inconsistencies documented with severity and fix recommendations
- [ ] Bridgebuilder protocol extended with explicit coherence stage

**Testing:**
- Manual review (no automated testing for coherence review)

#### Task 9.5: E2E integration test — full agent economic journey

**Description:** End-to-end test covering the complete agent economic lifecycle: agent creation with provenance -> earn referral revenue -> instant settlement (0h hold) -> spend via reserve/finalize with budget cap -> circuit breaker activation -> reconciliation validates conservation. Uses all services built in Sprints 1-8.
**File(s):** `themes/sietch/src/tests/integration/billing/agent-economic-journey.test.ts`
**Acceptance Criteria:**
- [ ] Agent account created with provenance verification
- [ ] Agent earns referral revenue (LotMinted event emitted)
- [ ] Agent earning settles instantly (AgentSettlementInstant event)
- [ ] Agent spends via reserve -> AgentAwareFinalizer.finalize (budget accounting atomic)
- [ ] Budget circuit breaker fires at 80% (warning) and 100% (open)
- [ ] Clawback with receivable: partial clawback + drip recovery
- [ ] Reconciliation passes: all conservation checks green
- [ ] All economic events present in outbox with correct types and ordering

**Testing:**
- Full E2E test suite — single test class covering entire journey
- Conservation property: `total_minted = total_balances + total_receivables` at every step

#### Task 9.6: Backward compatibility validation

**Description:** Run the full existing test suite (439+ tests from cycle-029) against the new codebase to verify zero regressions. Verify all existing human account flows work identically.
**File(s):** Existing test files
**Acceptance Criteria:**
- [ ] All 439+ existing tests pass without modification
- [ ] Human accounts unaffected by constitutional governance (same parameters via seed data)
- [ ] New tables are additive — no existing schema changes
- [ ] Performance regression check: no existing operation exceeds +10% latency

**Testing:**
- Full existing test suite regression run

---

## Appendix A: FR-to-Sprint Mapping

| FR | Description | Sprint(s) |
|----|-------------|-----------|
| FR-1 | Agent entity-specific parameters | Sprint 3, 4 |
| FR-2 | Agent budget caps and circuit breaker | Sprint 5, 6 |
| FR-2b | Agent settlement and clawback policy | Sprint 4 |
| FR-3 | Agent provenance verification and beneficiary model | Sprint 7 |
| FR-4 | System config table with governance lifecycle | Sprint 1, 2 |
| FR-5 | Constitutional parameters migration | Sprint 1, 2, 3 |
| FR-6 | Entity-specific parameter overrides | Sprint 2, 3 |
| FR-7 | EconomicEvent union type | Sprint 8 |
| FR-8 | Event emission from existing operations | Sprint 8 |
| FR-9 | Reconciliation design document (ADR-008) | Sprint 9 |
| FR-10 | Reconciliation test harness | Sprint 9 |
| FR-11 | TBA-to-credit-ledger binding (Phase 2) | -- |
| FR-12 | Agent self-authorization (Phase 2) | -- |
| FR-13 | Bridgebuilder cross-sprint coherence review | Sprint 9 |

---

## Appendix B: Dependency Graph

```
Sprint 1 (275) ──→ Sprint 2 (276) ──→ Sprint 3 (277) ──→ Sprint 4 (278)
(migration 047,     (governance svc,    (entity overrides,   (migration 048,
 state machine,      config schema,      settlement/payout    fraud/revenue rules,
 seed data)          admin API)          migration)           agent settlement,
                                                              clawback receivable,
                                                              tx threading)
                                              │
                                              ├──→ Sprint 5 (279) ──→ Sprint 6 (280)
                                              │    (migration 049,    (circuit breaker,
                                              │     budget service     AgentAwareFinalizer,
                                              │     core)              Redis integration)
                                              │
                                              ├──→ Sprint 7 (281)
                                              │    (migration 050,
                                              │     agent identity,
                                              │     provenance API)
                                              │
                                              └──→ Sprint 8 (282)
                                                   (migration 051,
                                                    economic events,
                                                    outbox dispatch)
                                                        │
           Sprint 5 ──→ Sprint 6 ─────────────────────→│
           Sprint 7 ──────────────────────────────────→│
                                                        │
                                                        ▼
                                                   Sprint 9 (283)
                                                   (migration 052,
                                                    ADR-008, reconciliation,
                                                    coherence review,
                                                    E2E testing)
```

**Migration ordering:** 047 (Sprint 1) -> 048 (Sprint 4) -> 049 (Sprint 5) -> 050 (Sprint 7) -> 051 (Sprint 8) -> 052 (Sprint 9) -- strictly monotonic, each migration ships with its sprint's release.

| Migration | Sprint | Table(s) |
|-----------|--------|----------|
| 047_system_config | Sprint 1 | `system_config`, `system_config_audit`, `system_config_version_seq` + seed data |
| 048_agent_clawback_receivables | Sprint 4 | `agent_clawback_receivables` |
| 049_agent_budget | Sprint 5 | `agent_spending_limits`, `agent_budget_finalizations` |
| 050_agent_identity | Sprint 7 | `agent_identity` |
| 051_economic_events | Sprint 8 | `economic_events` |
| 052_reconciliation_runs | Sprint 9 | `reconciliation_runs` |

**Key dependencies:**
- Sprint 3 (entity overrides) requires Sprint 2 (governance service) complete
- Sprint 4 (agent settlement + clawback) requires Sprint 3 (parameter migration)
- Sprint 5-8 can begin after Sprint 4 and progress in parallel where schemas don't conflict
- Sprint 6 (circuit breaker events) uses in-memory BillingEventEmitter; Sprint 8 backfills outbox wiring
- Sprint 9 (E2E + reconciliation) requires all of Sprints 5-8 complete

---

## Appendix C: Goal Traceability

| Goal | Sprint(s) | Tasks | Validation |
|------|-----------|-------|------------|
| G-1 | 3, 4, 5, 6, 7 | 3.1-3.4, 4.1-4.5, 5.1-5.4, 6.1-6.4, 7.1-7.4 | E2E test: agent account with differentiated settlement (0h), budget cap, provenance verification (Sprint 9.5) |
| G-2 | 1, 2, 3 | 1.1-1.4, 2.1-2.5, 3.1-3.4 | E2E test: propose -> multi-sig approve -> 7-day cooldown -> activation. Emergency override test (Sprint 2.2) |
| G-3 | 8 | 8.1-8.5 | Unit test: every credit ledger operation emits correct EconomicEvent. 24+ event types defined (Sprint 8.2) |
| G-4 | 9 | 9.1-9.3 | ADR-008 written and validated. ReconciliationService test harness proves conservation across simulated cross-system scenario (Sprint 9.2) |
| G-6 | 9 | 9.4 | Cross-sprint coherence review completed with findings documented. Bridgebuilder protocol enhanced (Sprint 9.4) |

---

## Risk Mitigation

| Risk | Sprint | Mitigation |
|------|--------|------------|
| Constitutional migration breaks parameter reads | 1, 2, 3 | Compile-time fallback: if system_config lookup fails, use hardcoded constants. Seed data matches current values exactly |
| Agent budget cap race condition | 5, 6 | SQLite single-writer prevents concurrent writes. Idempotent via `agent_budget_finalizations` PK with `INSERT OR IGNORE`. Redis is advisory only |
| Conservation violation from partial clawback | 4 | Receivable tracking preserves conservation: `applied + receivable = original`. Property-based test validates |
| Event emission increases write latency | 8 | Synchronous INSERT within existing transaction (outbox pattern). Estimated <2ms overhead on SQLite WAL |
| Cross-system reconciliation reveals inconsistencies | 9 | ADR-008 is design-only for Phase 1. Test harness simulates budget engine. Reconciliation is alert-only (never auto-corrects) |
| Config version monotonicity breaks | 1, 2 | Version allocated via `system_config_version_seq` counter under `BEGIN IMMEDIATE` with UNIQUE constraint. No `MAX+1` races |
| Backward compatibility regression | 9 | Full 439+ existing test suite regression run. All migrations purely additive |
| Transaction threading complexity | 4, 6 | `postEntryInTransaction` and `finalizeInTransaction` overloads tested with forced rollback to prove atomicity |

---

*Generated with Loa Framework `/sprint-plan`*
*Based on PRD v1.0.0, SDD v1.0.0*
*Cycle: cycle-030 — The Kwisatz Haderach — Agent Economic Citizenship & Constitutional Governance*

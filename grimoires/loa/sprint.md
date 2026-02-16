# Sprint Plan: The Spacing Guild — Agent Economic Sovereignty & Peer Commerce

**Version:** 1.0.0
**Date:** 2026-02-16
**Cycle:** cycle-031
**PRD:** `grimoires/loa/prd.md` v1.0.0 (GPT-5.2 APPROVED iteration 2)
**SDD:** `grimoires/loa/sdd.md` v1.0.0 (GPT-5.2 APPROVED iteration 2)

---

## Overview

| Parameter | Value |
|-----------|-------|
| Total sprints | 8 |
| Phase 1 (Full Agent Economic Sovereignty) | Sprints 1-8 |
| Sprint size | 1 agent session each |
| Global sprint IDs | 284-291 |
| Estimated total tasks | ~48 |
| Predecessor | cycle-030 (sprints 275-283) |

### Sprint Summary

| Sprint | Title | Global ID | Key Deliverable |
|--------|-------|-----------|-----------------|
| 1 | Event Consolidation Foundation | 284 | EventConsolidationAdapter + ADR-009 |
| 2 | Peer Transfer — Schema & Core Algorithm | 285 | Lot-split transfer + transfers table |
| 3 | Peer Transfer — Policy Layer & API | 286 | Budget/provenance enforcement + REST API |
| 4 | TBA Binding | 287 | bindTBA() implementation + EIP-55 normalization |
| 5 | TBA Deposit Bridge | 288 | On-chain verified deposit → credit lot minting |
| 6 | Agent Governance Participation | 289 | Weighted proposals + voting + delegations |
| 7 | Conservation Extensions & Integration | 290 | 2 new reconciliation checks + DI wiring |
| 8 | E2E Sovereignty Proof & Launch Readiness | 291 | Full agent lifecycle test + backward compat |

---

## Sprint 1: Event Consolidation Foundation (Sprint 284)

**Goal:** Establish the single dual-write path for event emission, extend type vocabulary, and deprecate legacy emitter
**PRD refs:** FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6, G-4
**SDD refs:** §4.5 EventConsolidationAdapter, §4.5.2 Event Type Mapping, §3.2, §3.4

### Tasks

#### Task 1.1: Extend billing-types.ts with new entry and source types

**Description:** Add `transfer_out` to `EntryType` union and `tba_deposit` to `SourceType` union in `billing-types.ts`. These are compile-time type extensions — no database changes. Application-level validation is authoritative (SDD §7.2).
**File(s):** `themes/sietch/src/packages/core/protocol/billing-types.ts`
**Acceptance Criteria:**
- [ ] `EntryType` union includes `'transfer_out'` (alongside existing types)
- [ ] `SourceType` union includes `'tba_deposit'` (alongside existing types including `'transfer_in'`)
- [ ] Existing type usage compiles without modification
- [ ] No database migration needed — application-level validation only

**Testing:**
- Type compilation test
- Existing tests continue passing (additive change)

#### Task 1.2: Extend economic-events.ts with 11 new event types

**Description:** Add all cycle-031 event types to `ECONOMIC_EVENT_TYPES` per SDD §3.4: PeerTransferInitiated, PeerTransferCompleted, PeerTransferRejected (3 peer), TbaBound, TbaDepositDetected, TbaDepositBridged, TbaDepositFailed (4 TBA), AgentProposalSubmitted, AgentProposalQuorumReached, AgentProposalActivated, AgentProposalRejected (4 governance).
**File(s):** `themes/sietch/src/packages/core/protocol/economic-events.ts`
**Acceptance Criteria:**
- [ ] All 11 new event types added to `ECONOMIC_EVENT_TYPES` array (3 peer + 4 TBA + 4 governance)
- [ ] `EconomicEventType` union includes all new types
- [ ] Total vocabulary: 29 (existing) + 11 (new) = 40 event types
- [ ] Existing event type references unaffected

**Testing:**
- Type compilation test
- Verify new types are valid members of the union

#### Task 1.3: Implement EventConsolidationAdapter

**Description:** Create the application-level dual-write adapter per SDD §4.5. Both `BillingEventEmitter.emit(event, { db: tx })` and `EconomicEventEmitter.emitInTransaction(tx, event)` accept transaction handles. The adapter ensures both writes occur within the same SQLite transaction. Authoritative path: `EconomicEventEmitter`. Legacy compatibility copy: `BillingEventEmitter`. Query delegation to legacy emitter unchanged during transition.
**File(s):** `themes/sietch/src/packages/adapters/billing/EventConsolidationAdapter.ts`
**Acceptance Criteria:**
- [ ] `emitInTransaction(tx, event)` writes to both `economic_events` (via economicEmitter) and `billing_events` (via legacyEmitter) in the same transaction
- [ ] `emit(event)` standalone wrapper creates its own transaction around `emitInTransaction()`
- [ ] `getEventsForAggregate()` delegates to legacy emitter (unchanged query path)
- [ ] `getBalanceAtTime()` delegates to legacy emitter (unchanged query path)
- [ ] Event type mapping: 22 of 26 legacy types map directly per SDD §4.5.2 table
- [ ] Unmapped types (AccountCreated, LotExpired, BonusWithheld, PayoutProcessing, WalletLinked, WalletUnlinked) write to `billing_events` only — no `economic_events` counterpart
- [ ] Both emitters receive transaction handle — atomic commit/rollback guaranteed

**Testing:**
- Unit test: dual-write produces rows in both tables within same transaction
- Unit test: forced rollback after `emitInTransaction` confirms no orphan rows in either table
- Unit test: unmapped legacy event types still write to `billing_events`
- Unit test: event type mapping covers all 22 direct mappings
- Unit test: query delegation returns correct results from legacy emitter

#### Task 1.4: Refactor ReconciliationService to accept IEconomicEventEmitter

**Description:** Replace the `as any` cast in `ReconciliationService` (BB-67-009) with proper typed dependency injection. The service accepts `IEconomicEventEmitter` and emits reconciliation events through it. Remove all `as any` casts related to event emission.
**File(s):** `themes/sietch/src/packages/adapters/billing/ReconciliationService.ts`
**Acceptance Criteria:**
- [ ] Constructor accepts `IEconomicEventEmitter` (or `EventConsolidationAdapter`)
- [ ] Zero `as any` casts in event emission code
- [ ] `ReconciliationCompleted` event emitted through proper typed path
- [ ] `ReconciliationDivergence` event emitted through proper typed path
- [ ] Existing reconciliation checks (4 checks) continue passing

**Testing:**
- Unit test: reconciliation events emitted through typed emitter
- Regression: existing 4 reconciliation checks pass unchanged

#### Task 1.5: Create migration 059_billing_events_deprecated

**Description:** Add `deprecated_at` timestamp column to `billing_events` table per SDD §3.2. No DB trigger — the EventConsolidationAdapter handles dual-write at the application layer. **Note:** This migration is defined as a Sprint 1 code artifact but runs in strict numeric order (after 056-058). The EventConsolidationAdapter does NOT depend on `deprecated_at` existing — the column is a future-use deprecation marker. Sprint 1 tests must NOT assume this migration has run.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/059_billing_events_deprecated.ts`
**Acceptance Criteria:**
- [ ] `ALTER TABLE billing_events ADD COLUMN deprecated_at TEXT`
- [ ] No DB trigger created
- [ ] Migration runs cleanly forward and rolls back
- [ ] Existing `billing_events` queries unaffected (new column is nullable)
- [ ] EventConsolidationAdapter tests do NOT depend on `deprecated_at` column existing (adapter works with or without it)

**Testing:**
- Migration forward/rollback test
- Existing billing_events queries return same results

#### Task 1.6: Write ADR-009 Event Consolidation document

**Description:** Document the consolidation path per PRD FR-4.6: dual-write transition period, event type mapping inventory (22 direct + 4 unmapped + 2 deprecated), timeline for removing `BillingEventEmitter`, payload schema compatibility rules.
**File(s):** `grimoires/loa/decisions/adr-009-event-consolidation.md`
**Acceptance Criteria:**
- [ ] ADR covers: dual-write mechanism, event type mapping table, unmapped type rationale
- [ ] Payload schema compatibility rules defined (consumers can rely on stable contracts)
- [ ] Removal timeline: `BillingEventEmitter` can be removed when all consumers migrate to `economic_events` queries
- [ ] Migration checklist for consumer teams

**Testing:**
- Document review (no automated tests)

---

## Sprint 2: Peer Transfer — Schema & Core Algorithm (Sprint 285)

**Goal:** Implement the foundational lot-split transfer algorithm with conservation guarantees
**PRD refs:** FR-1.1, FR-1.2, FR-1.5, FR-1.7, FR-1.8, G-1, G-5
**SDD refs:** §3.1.1 transfers table, §4.1 PeerTransferService, §4.1.2 Transfer Algorithm, §4.1.3 Lot Selection

### Tasks

#### Task 2.1: Create migration 056_peer_transfers

**Description:** Create the `transfers` table per SDD §3.1.1 with idempotency_key UNIQUE constraint, status CHECK constraint, and indexes for account/status lookups. No CHECK constraint modifications to existing tables (application-level validation per SDD §7.2).
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/056_peer_transfers.ts`
**Acceptance Criteria:**
- [ ] `transfers` table created with all columns per SDD §3.1.1: id, idempotency_key (UNIQUE), from_account_id FK, to_account_id FK, amount_micro (CHECK > 0), correlation_id, status (CHECK IN pending/completed/rejected), rejection_reason, metadata, created_at, completed_at
- [ ] `idx_transfers_from` on `(from_account_id, created_at)`
- [ ] `idx_transfers_to` on `(to_account_id, created_at)`
- [ ] `idx_transfers_status` on `(status, created_at)`
- [ ] No existing table CHECK constraints altered (application-level validation)
- [ ] Migration runs cleanly forward and rolls back

**Testing:**
- Migration forward/rollback test
- Constraint validation: duplicate idempotency_key rejected
- Constraint validation: amount_micro = 0 rejected
- FK constraint: invalid account IDs rejected

#### Task 2.2: Create IPeerTransferService port interface

**Description:** Define the port interface per SDD §4.1.1 with transfer, getTransfer, getTransferByIdempotencyKey, and listTransfers methods.
**File(s):** `themes/sietch/src/packages/core/ports/IPeerTransferService.ts`
**Acceptance Criteria:**
- [ ] `TransferOptions` interface: idempotencyKey, metadata?, correlationId?
- [ ] `TransferResult` interface: transferId, fromAccountId, toAccountId, amountMicro (bigint), status, rejectionReason?, correlationId, completedAt?
- [ ] `IPeerTransferService` interface with all 4 methods per SDD §4.1.1
- [ ] Types compile and are re-exported from barrel

**Testing:**
- Type compilation test

#### Task 2.3: Implement PeerTransferService — lot-split core

**Description:** Implement the core transfer algorithm per SDD §4.1.2. The entire transfer executes within a single `BEGIN IMMEDIATE` transaction: idempotency check → validation → lot selection (FIFO) → lot-split (reduce sender original_micro, create recipient lot) → paired ledger entries → status update. This task covers the core algorithm WITHOUT budget/provenance/governance checks (added in Sprint 3).
**File(s):** `themes/sietch/src/packages/adapters/billing/PeerTransferService.ts`
**Acceptance Criteria:**
- [ ] Entire transfer within single `BEGIN IMMEDIATE` transaction
- [ ] Idempotency: SELECT by idempotency_key inside tx — if completed/rejected, return existing result
- [ ] Validation: fromAccountId ≠ toAccountId
- [ ] FIFO lot selection: pool-restricted → expiring → oldest (per SDD §4.1.3)
- [ ] LOT-SPLIT: reduce sender lot `original_micro` AND `available_micro` by split amount; `reserved_micro` and `consumed_micro` remain UNCHANGED
- [ ] `available_micro` MUST NOT go negative after split — if available < split amount for a lot, split only available amount and continue to next lot
- [ ] Lot invariant per lot before/after split: `available_micro + reserved_micro + consumed_micro = original_micro` preserved (all four fields consistent)
- [ ] Unit test MUST include a lot with non-zero `reserved_micro` to verify reserved is untouched by split
- [ ] Create recipient lot: `source_type='transfer_in'`, `original_micro=amountMicro`, `source_id=transfer_id`
- [ ] Paired ledger entries: `transfer_out` (negative) and `transfer_in` (positive) with shared `correlation_id`
- [ ] Idempotency keys on entries: `(transfer_id + '_out')` and `(transfer_id + '_in')`
- [ ] UPDATE transfer status='completed', completed_at=now()
- [ ] INSUFFICIENT_BALANCE rejection when sender lots insufficient

**Testing:**
- Unit test: happy path transfer with conservation verification (SUM original_micro unchanged)
- Unit test: idempotent retry returns same result without side effects
- Unit test: self-transfer rejected
- Unit test: insufficient balance rejected
- Unit test: multi-lot split across FIFO-ordered lots
- Unit test: zero-sum verification: transfer_out + transfer_in = 0 in ledger
- Property test: N random transfers preserve global SUM(original_micro)

#### Task 2.4: Implement listTransfers and getTransfer queries

**Description:** Implement read-only query methods for transfer history per SDD §4.1.1. Support filtering by direction (sent/received/all) and pagination.
**File(s):** `themes/sietch/src/packages/adapters/billing/PeerTransferService.ts`
**Acceptance Criteria:**
- [ ] `getTransfer(transferId)` returns full TransferResult or null
- [ ] `getTransferByIdempotencyKey(key)` returns existing transfer or null
- [ ] `listTransfers(accountId, { direction, limit, offset })` supports sent/received/all filtering
- [ ] Pagination: default limit 20, max 100
- [ ] Results ordered by created_at DESC

**Testing:**
- Unit test: getTransfer returns correct result
- Unit test: listTransfers filters by direction correctly
- Unit test: pagination works correctly

---

## Sprint 3: Peer Transfer — Policy Layer & API (Sprint 286)

**Goal:** Wire budget enforcement, provenance verification, governance limits, and REST API for peer transfers
**PRD refs:** FR-1.3, FR-1.4, FR-1.6, FR-1.9, G-1
**SDD refs:** §4.1.2 steps c-d, §4.1.4 Constructor DI, §3.3, §5.1

### Tasks

#### Task 3.1: Integrate budget enforcement into transfer algorithm

**Description:** Add budget check for agent senders within the transfer transaction per SDD §4.1.2 steps c-j. Before lot selection: check budget via `AgentBudgetService.checkBudget()`. After successful transfer: record finalization via `budgetService.recordFinalizationInTransaction()`. Budget rejection sets transfer status='rejected' with reason.
**File(s):** `themes/sietch/src/packages/adapters/billing/PeerTransferService.ts`
**Acceptance Criteria:**
- [ ] Agent senders: `checkBudget()` called before lot selection
- [ ] Budget exceeded: transfer rejected with `reason='budget_exceeded'`, `PeerTransferRejected` event emitted
- [ ] Budget passes: transfer proceeds to lot selection
- [ ] After successful transfer: `budgetService.recordFinalizationInTransaction(tx, accountId, amountMicro)` records budget spend
- [ ] Non-agent senders: budget check skipped entirely
- [ ] Redis budget cache invalidated async after commit (SDD §4.1.2 step 3)

**Testing:**
- Unit test: agent transfer with sufficient budget succeeds
- Unit test: agent transfer exceeding daily cap rejected
- Unit test: non-agent transfer skips budget check
- Unit test: budget finalization recorded atomically with transfer

#### Task 3.2: Integrate provenance verification

**Description:** Add provenance check for agent senders per SDD §4.1.2 step c. Verify the sender agent's provenance before allowing transfer. Creator provenance checked via `AgentProvenanceVerifier.verifyProvenance()`.
**File(s):** `themes/sietch/src/packages/adapters/billing/PeerTransferService.ts`
**Acceptance Criteria:**
- [ ] Agent senders: `verifyProvenance(fromAccountId)` called within transaction
- [ ] Provenance failure: transfer rejected with `reason='provenance_failed'`
- [ ] Non-agent senders: provenance check skipped
- [ ] JWT account_id claim must match fromAccountId (enforced at API layer)

**Testing:**
- Unit test: agent with valid provenance transfers successfully
- Unit test: agent with invalid provenance rejected
- Unit test: non-agent sender skips provenance check

#### Task 3.3: Integrate constitutional governance transfer limits

**Description:** Add governance limit resolution within the transfer transaction per SDD §4.1.2 step d. Resolve `transfer.max_single_micro` and `transfer.daily_limit_micro` via `governance.resolveInTransaction()`. Reject transfers exceeding limits. **This task adds the 2 transfer params to CONFIG_SCHEMA/FALLBACKS (TypeScript definitions).** Migration 060 (Sprint 6) later seeds these values into the system_config database.
**File(s):** `themes/sietch/src/packages/adapters/billing/PeerTransferService.ts`, `themes/sietch/src/packages/core/protocol/config-schema.ts`
**Acceptance Criteria:**
- [ ] `transfer.max_single_micro` added to CONFIG_SCHEMA (type: bigint_micro, min: 0) and CONFIG_FALLBACKS (100_000_000n = $100)
- [ ] `transfer.daily_limit_micro` added to CONFIG_SCHEMA (type: bigint_micro, min: 0) and CONFIG_FALLBACKS (500_000_000n = $500)
- [ ] Before migration 060 runs, transfer limits resolve via compile-time fallback (CONFIG_FALLBACKS) — this is safe and expected
- [ ] Transfer amount checked against `max_single_micro` — rejected if exceeded
- [ ] Daily total checked against `daily_limit_micro` — rejected if exceeded
- [ ] Limits resolved per entity type via `resolveInTransaction(tx, key, entityType)`
- [ ] Rejection reason: `'governance_limit_exceeded'`

**Testing:**
- Unit test: transfer within limits succeeds
- Unit test: transfer exceeding single limit rejected
- Unit test: transfer exceeding daily aggregate limit rejected
- Unit test: compile-time fallback used when governance unavailable

#### Task 3.4: Emit transfer economic events

**Description:** Wire event emission for all transfer outcomes per SDD §4.1.2 step l and PRD FR-1.6. Use `EventConsolidationAdapter.emitInTransaction()` for dual-write.
**File(s):** `themes/sietch/src/packages/adapters/billing/PeerTransferService.ts`
**Acceptance Criteria:**
- [ ] `PeerTransferCompleted` emitted via `emitInTransaction()` on successful transfer
- [ ] `PeerTransferRejected` emitted on budget/provenance/governance/balance rejection
- [ ] `PeerTransferInitiated` emitted after validation passes but before lot selection (observability)
- [ ] Events include: transferId, fromAccountId, toAccountId, amountMicro, correlationId
- [ ] Rejection events include: rejectionReason

**Testing:**
- Unit test: successful transfer emits PeerTransferCompleted
- Unit test: rejected transfer emits PeerTransferRejected with reason
- Unit test: events persisted in both economic_events and billing_events tables

#### Task 3.5: Create transfer API routes

**Description:** REST API endpoints for peer transfers per SDD §5.1.
**File(s):** `themes/sietch/src/packages/adapters/billing/routes/transfer.routes.ts`
**Acceptance Criteria:**
- [ ] `POST /api/transfer` — JWT auth, account_id claim must match fromAccountId. Body: { fromAccountId, toAccountId, amountMicro, idempotencyKey, metadata? }. Response: { transfer: TransferResult }
- [ ] `GET /api/transfer/:id` — JWT auth, claim must match sender or recipient. Response: { transfer: TransferResult }
- [ ] `GET /api/transfer` — query params: accountId, direction, limit, offset. JWT auth, claim must match accountId. Response: { transfers: TransferResult[], total: number }
- [ ] Error responses: 400 (invalid input), 402 (budget exceeded), 403 (provenance failed), 409 (idempotency conflict)
- [ ] Input validation: amountMicro > 0, idempotencyKey required, accountIds are valid

**Testing:**
- Integration test: POST /api/transfer happy path
- Integration test: GET /api/transfer with direction filter
- Integration test: 402 on budget exceeded
- Integration test: 403 on provenance failure
- Integration test: idempotent retry returns 200 with same result

#### Task 3.6: Wire PeerTransferService DI

**Description:** Wire PeerTransferService into the Express application DI container with all optional dependencies.
**File(s):** DI/wiring files (Express app initialization)
**Acceptance Criteria:**
- [ ] PeerTransferService instantiated with: db, ledger, budgetService?, provenance?, governance?, eventEmitter?
- [ ] Transfer routes registered in Express app
- [ ] Optional dependencies gracefully handled (null coalescing)

**Testing:**
- Smoke test: service initializes without errors
- Integration test: full transfer flow through API

---

## Sprint 4: TBA Binding (Sprint 287)

**Goal:** Implement ERC-6551 Token-Bound Account binding and EIP-55 address normalization
**PRD refs:** FR-2.1, FR-2.2, FR-2.3, FR-2.6, FR-2.7, G-2
**SDD refs:** §4.2 TBA Binding, §4.2.2 EIP-55 Normalization

### Tasks

#### Task 4.1: Create address-utils.ts with EIP-55 normalization

**Description:** Implement EIP-55 checksum address normalization per SDD §4.2.2. Accept any valid 20-byte hex address (0x + 40 hex chars, case-insensitive) and normalize to EIP-55 format. This is a storage normalization, not a validation gate — binding does not fail on non-checksummed input (PRD NFR-2).
**File(s):** `themes/sietch/src/packages/adapters/billing/address-utils.ts`
**Acceptance Criteria:**
- [ ] `normalizeAddress(address: string): string` — returns EIP-55 checksummed address
- [ ] `isValidAddress(address: string): boolean` — validates 0x + 40 hex chars
- [ ] Accepts lowercase, uppercase, and mixed-case input
- [ ] Returns consistent EIP-55 output regardless of input casing
- [ ] Invalid addresses (wrong length, non-hex chars, missing 0x) rejected by validation

**Testing:**
- Unit test: known EIP-55 test vectors pass
- Unit test: lowercase address normalized correctly
- Unit test: uppercase address normalized correctly
- Unit test: invalid address (short, non-hex) rejected
- Unit test: 0x-prefix required

#### Task 4.2: Implement bindTBA() in AgentProvenanceVerifier

**Description:** Replace the `NotImplementedError` stub with the full implementation per SDD §4.2.1. Validate address, normalize to EIP-55, check for existing binding, update `agent_identity.tba_address`.
**File(s):** `themes/sietch/src/packages/adapters/billing/AgentProvenanceVerifier.ts`
**Acceptance Criteria:**
- [ ] `bindTBA(accountId, tbaAddress)` validates address format via `isValidAddress()`
- [ ] Normalizes to EIP-55 via `normalizeAddress()`
- [ ] Checks `agent_identity` exists for accountId — 404 if not found
- [ ] If `tba_address` is NULL: UPDATE with normalized address
- [ ] If same address already bound: return existing identity (idempotent no-op)
- [ ] If different address already bound: throw CONFLICT (409)
- [ ] Emits `TbaBound` event via `EventConsolidationAdapter.emitInTransaction(tx, ...)` within the same transaction as the UPDATE (dual-write to both economic_events and billing_events)
- [ ] The bind operation runs inside a `BEGIN IMMEDIATE` transaction that includes both the identity update and event emission
- [ ] Returns updated `AgentIdentity`
- [ ] `NotImplementedError` completely removed

**Testing:**
- Unit test: successful first binding
- Unit test: idempotent re-bind same address
- Unit test: conflict on different address
- Unit test: 404 for unknown agent account
- Unit test: address normalization applied before storage
- Unit test: TbaBound event emitted

#### Task 4.3: Create TBA bind API route

**Description:** REST endpoint for TBA binding per SDD §5.2.
**File(s):** `themes/sietch/src/packages/adapters/billing/routes/agent-tba.routes.ts`
**Acceptance Criteria:**
- [ ] `POST /api/agent/tba/bind` — JWT auth (account_id claim must match agent or creator). Body: { accountId, tbaAddress }. Response: { identity: AgentIdentity }
- [ ] Error responses: 400 (invalid address), 404 (no agent identity), 409 (already bound to different address)
- [ ] Input validation: accountId required, tbaAddress required

**Testing:**
- Integration test: bind TBA successfully
- Integration test: 409 on conflict
- Integration test: 400 on invalid address

---

## Sprint 5: TBA Deposit Bridge (Sprint 288)

**Goal:** Bridge on-chain deposits to credit lots with mandatory on-chain verification and escrow conservation
**PRD refs:** FR-2.4, FR-2.5, G-2, G-5
**SDD refs:** §3.1.2 tba_deposits, §4.3 TbaDepositBridge, §4.3.2 Bridge Algorithm

### Tasks

#### Task 5.1: Create migration 057_tba_deposits

**Description:** Create the `tba_deposits` table per SDD §3.1.2 for on-chain deposit tracking with tx_hash UNIQUE constraint for idempotency and escrow reconciliation.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/057_tba_deposits.ts`
**Acceptance Criteria:**
- [ ] `tba_deposits` table with all columns per SDD §3.1.2: id, agent_account_id FK, chain_id, tx_hash (UNIQUE), token_address, amount_raw, amount_micro, lot_id FK, escrow_address, block_number, finality_confirmed, status (CHECK IN detected/confirmed/bridged/failed), error_message, created_at, bridged_at
- [ ] `idx_tba_deposits_agent` on `(agent_account_id, created_at)`
- [ ] `idx_tba_deposits_status` on `(status)`
- [ ] Migration runs cleanly forward and rolls back

**Testing:**
- Migration forward/rollback test
- Constraint validation: duplicate tx_hash rejected
- FK constraint: invalid agent_account_id rejected

#### Task 5.2: Create ITbaDepositBridge port interface

**Description:** Define the port interface per SDD §4.3.1 with detectAndBridge, getDeposit, listDeposits, and verifyEscrowBalance methods.
**File(s):** `themes/sietch/src/packages/core/ports/ITbaDepositBridge.ts`
**Acceptance Criteria:**
- [ ] `DepositDetection` interface per SDD §4.3.1
- [ ] `DepositBridgeResult` interface per SDD §4.3.1
- [ ] `ITbaDepositBridge` interface with all 4 methods
- [ ] Types compile and are re-exported from barrel

**Testing:**
- Type compilation test

#### Task 5.3: Implement TbaDepositBridge with on-chain verification

**Description:** Implement the bridge algorithm per SDD §4.3.2. The critical security requirement: on-chain verification (step 5) is MANDATORY before any minting. The bridge fetches the transaction receipt, verifies receipt status, parses ERC-20 Transfer logs, verifies from/to/amount/token match, checks finality depth, and persists verification metadata. Only then does it mint a credit lot with `source_type='tba_deposit'`.
**File(s):** `themes/sietch/src/packages/adapters/billing/TbaDepositBridge.ts`
**Acceptance Criteria:**
- [ ] Validate toAddress matches configured escrow address
- [ ] Validate chainId matches configured deployment chain
- [ ] Validate tokenAddress is in accepted token list
- [ ] Idempotency: INSERT OR IGNORE by tx_hash — if already bridged, return existing result
- [ ] ON-CHAIN VERIFICATION (mandatory before minting):
  - [ ] Fetch tx receipt via RPC
  - [ ] Verify receipt.status === 1
  - [ ] Verify receipt.blockNumber matches detection
  - [ ] Parse ERC-20 Transfer log: verify topic, from, to, amount, token
  - [ ] Verify finality: blockNumber + finalityDepth ≤ current block
  - [ ] Persist verified receipt hash + log index in metadata
- [ ] Amount conversion: amountRaw → amountMicro (USDC: 1:1,000,000)
- [ ] Agent lookup: SELECT from agent_identity WHERE tba_address matches
- [ ] `BEGIN IMMEDIATE`: mintLot with source_type='tba_deposit', UPDATE deposit status='bridged', emit TbaDepositBridged via `EventConsolidationAdapter.emitInTransaction(tx, ...)` within the SAME transaction (dual-write to both economic_events and billing_events)
- [ ] Failed deposits: emit TbaDepositFailed via `EventConsolidationAdapter.emitInTransaction(tx, ...)` with error details — also within a transaction wrapping the status update to 'failed'
- [ ] Escrow config: per SDD §4.3.3 TbaDepositBridgeConfig

**Testing:**
- Unit test: happy path — verified deposit mints credit lot
- Unit test: idempotent — same tx_hash returns existing result
- Unit test: receipt status ≠ 1 — deposit fails
- Unit test: log mismatch (wrong token/amount) — deposit fails
- Unit test: finality not reached — status remains 'detected'
- Unit test: unknown TBA address — deposit fails with clear error
- Unit test: wrong escrow address — rejected

#### Task 5.4: Create TBA deposit API routes

**Description:** REST endpoints for deposit bridge and deposit queries per SDD §5.2.
**File(s):** `themes/sietch/src/packages/adapters/billing/routes/agent-tba.routes.ts` (extend from Sprint 4)
**Acceptance Criteria:**
- [ ] `POST /api/agent/tba/bridge` — service-to-service JWT auth. Body: DepositDetection. Response: { deposit: DepositBridgeResult }
- [ ] `GET /api/agent/tba/deposits` — JWT auth. Query params: accountId, limit. Response: { deposits: TbaDeposit[] }
- [ ] Bridge endpoint requires service JWT (not user JWT) — internal/webhook endpoint
- [ ] Input validation on all detection fields

**Testing:**
- Integration test: bridge deposit via API
- Integration test: list deposits for agent
- Integration test: service JWT required for bridge endpoint

#### Task 5.5: Implement verifyEscrowBalance

**Description:** Implement the escrow balance verification method per SDD §4.3.1. Compare on-chain escrow token balance against sum of bridged deposits.
**File(s):** `themes/sietch/src/packages/adapters/billing/TbaDepositBridge.ts`
**Acceptance Criteria:**
- [ ] `verifyEscrowBalance(chainId)` returns { escrowBalance, creditedBalance, delta }
- [ ] `creditedBalance` = SUM(amount_micro) from tba_deposits WHERE status='bridged'
- [ ] `escrowBalance` fetched from on-chain (RPC call for token balance)
- [ ] `delta` = escrowBalance - creditedBalance (should be >= 0, never negative for non-redeemable)
- [ ] Negative delta logged as WARNING (potential integrity issue)

**Testing:**
- Unit test: balanced escrow returns delta = 0
- Unit test: excess escrow (unbridged deposits) returns positive delta
- Unit test: deficit (should not happen) returns negative delta with warning

---

## Sprint 6: Agent Governance Participation (Sprint 289)

**Goal:** Enable agents to propose and vote on governance parameters with weighted quorum
**PRD refs:** FR-3.1 through FR-3.8, G-3
**SDD refs:** §3.1.3-3.1.4, §3.3, §4.4 AgentGovernanceService

### Tasks

#### Task 6.1: Create migration 058_agent_governance

**Description:** Create `agent_governance_proposals`, `agent_governance_votes`, and `agent_governance_delegations` tables per SDD §3.1.3, §3.1.4, §4.4.2a.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/058_agent_governance.ts`
**Acceptance Criteria:**
- [ ] `agent_governance_proposals` table per SDD §3.1.3 with status CHECK (open, quorum_reached, activated, rejected, expired, admin_overridden)
- [ ] UNIQUE partial index `idx_agent_proposals_active` on `(param_key, entity_type) WHERE status = 'open'` — one open proposal per parameter
- [ ] `agent_governance_votes` table per SDD §3.1.4 with PRIMARY KEY `(proposal_id, voter_account_id)`
- [ ] `agent_governance_delegations` table per SDD §4.4.2a with UNIQUE `(creator_account_id, agent_account_id)` and partial indexes on active delegations
- [ ] All FK constraints reference `credit_accounts(id)`
- [ ] Migration runs cleanly forward and rolls back

**Testing:**
- Migration forward/rollback test
- Constraint validation: duplicate open proposal rejected
- Constraint validation: duplicate vote by same agent rejected
- Constraint validation: duplicate delegation rejected

#### Task 6.2: Create migration 060_governance_params_seed

**Description:** Add the 8 governance-specific parameters to CONFIG_SCHEMA/FALLBACKS (TypeScript) and seed ALL 10 new parameters (2 transfer + 8 governance) into the system_config database. **Note:** The 2 transfer params (`transfer.max_single_micro`, `transfer.daily_limit_micro`) were already added to CONFIG_SCHEMA/FALLBACKS in Sprint 3 Task 3.3. This task adds only the 8 governance params to TypeScript and seeds all 10 into the database.
**File(s):** `themes/sietch/src/packages/adapters/billing/migrations/060_governance_params_seed.ts`, `themes/sietch/src/packages/core/protocol/config-schema.ts`
**Acceptance Criteria:**
- [ ] CONFIG_SCHEMA extended with 8 NEW governance parameters (5 from §3.3 + 3 from §4.4.2b not already present):
  - governance.agent_quorum_weight, governance.agent_cooldown_seconds, governance.max_delegation_per_creator
  - governance.agent_weight_source, governance.fixed_weight_per_agent, governance.reputation_window_seconds, governance.reputation_scale_factor, governance.max_weight_per_agent
- [ ] CONFIG_FALLBACKS extended with all 8 governance default values per SDD
- [ ] The 2 transfer params (transfer.max_single_micro, transfer.daily_limit_micro) are NOT re-added — already defined in Sprint 3
- [ ] `validateConfigValue()` handles all new parameter types
- [ ] Migration 060 seeds ALL 10 params (2 transfer + 8 governance) as active system_config rows with version sequence counters
- [ ] Seed is idempotent: re-running does not duplicate rows (INSERT OR IGNORE pattern)

**Testing:**
- Unit test: all 10 new parameters validate correctly
- Unit test: out-of-range values rejected
- Migration forward/rollback test

#### Task 6.3: Create IAgentGovernanceService port interface

**Description:** Define the port interface per SDD §4.4.1 with all governance methods.
**File(s):** `themes/sietch/src/packages/core/ports/IAgentGovernanceService.ts`
**Acceptance Criteria:**
- [ ] `AgentProposalOptions`, `AgentVoteOptions`, `AgentGovernanceWeightResult` interfaces per SDD
- [ ] `IAgentGovernanceService` with: proposeAsAgent, voteAsAgent, computeAgentWeight, getProposal, getActiveProposals, activateExpiredCooldowns, expireStaleProposals
- [ ] Types compile and are re-exported from barrel

**Testing:**
- Type compilation test

#### Task 6.4: Implement AgentGovernanceService

**Description:** Full implementation per SDD §4.4. Includes weight computation (delegation/earned_reputation/fixed_allocation), proposal lifecycle, voting, quorum tracking, cooldown activation, and parameter whitelist enforcement.
**File(s):** `themes/sietch/src/packages/adapters/billing/AgentGovernanceService.ts`
**Acceptance Criteria:**
- [ ] `proposeAsAgent()`: validate param_key against AGENT_PROPOSABLE_KEYS whitelist, compute agent weight server-side, validate value against CONFIG_SCHEMA, insert proposal with required_weight from governance.agent_quorum_weight, emit AgentProposalSubmitted
- [ ] `voteAsAgent()`: compute voter weight, insert vote, accumulate total_weight on proposal, if total_weight ≥ required_weight transition to quorum_reached, set cooldown_ends_at, emit AgentProposalQuorumReached
- [ ] `computeAgentWeight()` per SDD §4.4.2: delegation (query delegations, check per-creator cap), earned_reputation (query EarningSettled events within window, scale by factor, cap), fixed_allocation (return fixed weight)
- [ ] `activateExpiredCooldowns()`: find quorum_reached proposals past cooldown, create system_config entry via constitutional governance, transition to activated, emit AgentProposalActivated
- [ ] `expireStaleProposals()`: find open/quorum_reached proposals past expires_at, transition to expired
- [ ] Parameter whitelist: agents CANNOT propose changes to kyc.*, payout.*, fraud_rule.*, settlement.* (per SDD §4.4.3)
- [ ] Admin override: admin_overridden status (per SDD §4.4.4)

**Testing:**
- Unit test: propose → vote → quorum → cooldown → activate lifecycle
- Unit test: whitelist enforcement — rejected for non-whitelisted key
- Unit test: weight computation — delegation path with per-creator cap
- Unit test: weight computation — earned_reputation with window and scale
- Unit test: weight computation — fixed_allocation returns configured value
- Unit test: duplicate vote rejected (PK constraint)
- Unit test: expired proposals cleaned up
- Unit test: admin override transitions from any open/quorum state

#### Task 6.5: Create agent governance API routes

**Description:** REST endpoints per SDD §5.3.
**File(s):** `themes/sietch/src/packages/adapters/billing/routes/agent-governance.routes.ts`
**Acceptance Criteria:**
- [ ] `POST /api/agent/governance/propose` — JWT auth (agent account). Body: { paramKey, value, justification? }. Response: { proposal }
- [ ] `POST /api/agent/governance/vote/:proposalId` — JWT auth (agent account). Body: { vote }. Response: { proposal }
- [ ] `GET /api/agent/governance/proposals` — query params: status, limit. Response: { proposals }
- [ ] `GET /api/agent/governance/weight/:accountId` — JWT auth. Response: { weight }
- [ ] Error responses: 400 (not in whitelist), 403 (not agent), 404 (proposal not found), 409 (already voted / active proposal exists)

**Testing:**
- Integration test: propose → vote → query proposals
- Integration test: whitelist rejection returns 400
- Integration test: non-agent account returns 403

---

## Sprint 7: Conservation Extensions & Integration (Sprint 290)

**Goal:** Extend ReconciliationService with transfer and deposit conservation checks, wire all DI, verify system coherence
**PRD refs:** FR-5.1, FR-5.2, FR-5.3, G-5
**SDD refs:** §4.6 ReconciliationService Extensions

### Tasks

#### Task 7.1: Implement Check 5 — Transfer Conservation

**Description:** Add transfer conservation check to ReconciliationService per SDD §4.6. Verify: (a) ledger entry conservation: sum(transfer_out) + sum(transfer_in) = 0, (b) lot supply conservation: transfer_in lots match entry credits, (c) global SUM(original_micro) unchanged by transfers.
**File(s):** `themes/sietch/src/packages/adapters/billing/ReconciliationService.ts`
**Acceptance Criteria:**
- [ ] Ledger entry zero-sum: `SUM(amount_micro WHERE entry_type='transfer_out') + SUM(amount_micro WHERE entry_type='transfer_in') = 0`
- [ ] Lot-entry cross-check: `SUM(original_micro WHERE source_type='transfer_in') = SUM(amount_micro WHERE entry_type='transfer_in')`
- [ ] Global lot conservation: total `SUM(original_micro)` across all lots unchanged by transfer operations (lot-split preserves supply)
- [ ] Divergence emits `ReconciliationDivergence` event with check='transfer_conservation'
- [ ] Passes when no transfers exist (zero-sum of empty set = 0)

**Testing:**
- Unit test: pass with 0 transfers
- Unit test: pass with N balanced transfers
- Unit test: divergence detected when lot supply doesn't match entries
- Unit test: divergence detected when ledger entries not zero-sum

#### Task 7.2: Implement Check 6 — TBA Deposit Bridge Conservation

**Description:** Add deposit bridge conservation check per SDD §4.6. Verify: sum of bridged deposit amounts matches sum of tba_deposit-sourced lot original_micro. Since deposits are non-redeemable, escrow can only grow.
**File(s):** `themes/sietch/src/packages/adapters/billing/ReconciliationService.ts`
**Acceptance Criteria:**
- [ ] `SUM(amount_micro FROM tba_deposits WHERE status='bridged') = SUM(original_micro FROM credit_lots WHERE source_type='tba_deposit')`
- [ ] Divergence emits `ReconciliationDivergence` event with check='deposit_bridge_conservation'
- [ ] Passes when no deposits exist (zero = zero)
- [ ] Note: escrow balance ≥ credited balance (non-redeemable, can only grow)

**Testing:**
- Unit test: pass with 0 deposits
- Unit test: pass with N bridged deposits
- Unit test: divergence detected when deposit sum ≠ lot sum

#### Task 7.3: Verify existing 4 checks still pass

**Description:** Run existing reconciliation checks (lot conservation, receivable balance, platform conservation, budget consistency) against a database populated with transfers, deposits, and governance operations. Ensure no false positives from new data.
**File(s):** `themes/sietch/src/packages/adapters/billing/ReconciliationService.ts` (test only)
**Acceptance Criteria:**
- [ ] Check 1 (lot conservation): passes with transfer_in lots and split sender lots
- [ ] Check 2 (receivable balance): unaffected by transfers (no receivables created)
- [ ] Check 3 (platform conservation): accounts for new entry types
- [ ] Check 4 (budget consistency): accounts for transfer budget finalization
- [ ] All 6 checks pass on a database with mixed operations

**Testing:**
- Integration test: full reconciliation with all 6 checks on populated database
- Regression: existing reconciliation tests pass unchanged

#### Task 7.4: Wire all new services into Express application DI

**Description:** Complete DI wiring for all cycle-031 services: EventConsolidationAdapter, PeerTransferService, TbaDepositBridge, AgentGovernanceService. Register all new API routes.
**File(s):** DI/wiring files (Express app initialization), route registration
**Acceptance Criteria:**
- [ ] EventConsolidationAdapter instantiated and injected where BillingEventEmitter was used
- [ ] PeerTransferService wired with all optional dependencies
- [ ] TbaDepositBridge wired with escrow config from environment
- [ ] AgentGovernanceService wired with governance, provenance, event dependencies
- [ ] All new routes registered: /api/transfer/*, /api/agent/tba/*, /api/agent/governance/*
- [ ] Optional dependencies use null coalescing (NFR-3)
- [ ] Application starts without errors with all new services

**Testing:**
- Smoke test: application starts and all routes respond
- Integration test: cross-service operation (transfer triggers event that appears in both tables)

#### Task 7.5: Governance cron jobs for proposal lifecycle

**Description:** Create BullMQ cron jobs for agent governance lifecycle: activate proposals past cooldown and expire stale proposals.
**File(s):** `themes/sietch/src/packages/adapters/billing/crons/agent-governance-activation.ts`
**Acceptance Criteria:**
- [ ] Hourly cron calls `agentGovernanceService.activateExpiredCooldowns()`
- [ ] Daily cron calls `agentGovernanceService.expireStaleProposals()`
- [ ] Both crons log counts and follow existing cron patterns

**Testing:**
- Unit test: proposal past cooldown activated on cron
- Unit test: expired proposal cleaned up on cron

---

## Sprint 8: E2E Sovereignty Proof & Launch Readiness (Sprint 291)

**Goal:** Full agent economic sovereignty E2E test, conservation stress testing, backward compatibility validation
**PRD refs:** G-6, G-5, G-1, G-2, G-3, G-4
**SDD refs:** §8.1, §8.2

### Tasks

#### Task 8.1: Agent sovereignty E2E integration test

**Description:** End-to-end test covering the complete agent economic sovereignty lifecycle per SDD §8.2: agent earns referral revenue → transfers credits to peer agent → proposes governance parameter change → quorum reached → parameter activated. This is the G-6 acceptance test that proves agents are truly first-class economic citizens.
**File(s):** `themes/sietch/src/tests/integration/billing/agent-sovereignty-proof.test.ts`
**Acceptance Criteria:**
- [ ] Agent A created with provenance verification and TBA bound
- [ ] Agent A earns referral revenue (LotMinted event)
- [ ] Agent A transfers credits to Agent B (PeerTransferCompleted event, lot-split conservation)
- [ ] Agent B receives credits — balance increased, lot with source_type='transfer_in'
- [ ] Agent A proposes governance parameter change (AgentProposalSubmitted)
- [ ] Agent A + Agent B vote → quorum reached (AgentProposalQuorumReached)
- [ ] Cooldown expires → parameter activated (AgentProposalActivated)
- [ ] Resolved parameter returns new value from system_config
- [ ] All economic events present in `economic_events` outbox table (cycle-030 infrastructure) with correct types and ordering — ordering verified via monotonic `rowid` within each transaction
- [ ] Outbox dispatch pipeline (cycle-030 `economic-event-dispatch` cron) correctly claims and publishes all 11 new event types without errors — confirm new `EconomicEventType` values pass through existing claim/publish path
- [ ] Full reconciliation passes: all 6 checks green

**Testing:**
- Single E2E test class covering entire sovereignty lifecycle

#### Task 8.2: Transfer conservation stress test

**Description:** Property-based stress test per SDD §8.2: execute 100+ random transfers between multiple accounts and verify reconciliation passes after every batch.
**File(s):** `themes/sietch/src/tests/integration/billing/transfer-conservation-stress.test.ts`
**Acceptance Criteria:**
- [ ] Create 10 accounts with initial balances
- [ ] Execute 100 random transfers (random amounts, random sender/receiver pairs)
- [ ] Skip invalid transfers (insufficient balance, self-transfer) — expected rejections
- [ ] After all transfers: verify Check 5 (transfer conservation) passes
- [ ] After all transfers: verify global SUM(original_micro) unchanged from initial state
- [ ] After all transfers: verify SUM(account balances) unchanged (zero-sum)

**Testing:**
- Property test: conservation invariant holds across N random transfers
- Report: successful/rejected transfer counts

#### Task 8.3: Deposit bridge E2E test

**Description:** End-to-end deposit bridge test with mocked on-chain data per SDD §8.2.
**File(s):** `themes/sietch/src/tests/integration/billing/deposit-bridge-e2e.test.ts`
**Acceptance Criteria:**
- [ ] Agent created with TBA bound
- [ ] Mock on-chain deposit detected (with valid receipt, logs, finality)
- [ ] Deposit bridged to credit lot (source_type='tba_deposit')
- [ ] Agent balance increased by bridged amount
- [ ] TbaDepositBridged event emitted
- [ ] verifyEscrowBalance returns balanced state
- [ ] Check 6 (deposit bridge conservation) passes
- [ ] Idempotent: same tx_hash returns existing result without duplicate lot

**Testing:**
- E2E test with mocked RPC provider

#### Task 8.4: Event consolidation correctness test

**Description:** Verify EventConsolidationAdapter dual-write correctness across all operations per SDD §8.2.
**File(s):** `themes/sietch/src/tests/integration/billing/event-consolidation-correctness.test.ts`
**Acceptance Criteria:**
- [ ] Execute transfers, deposits, and governance operations
- [ ] Verify every operation produces matching rows in both `billing_events` and `economic_events`
- [ ] Verify unmapped types (AccountCreated, etc.) only appear in `billing_events`
- [ ] Verify event ordering matches operation ordering in both tables
- [ ] Verify `as any` casts are zero across the entire codebase (grep validation)

**Testing:**
- Integration test: dual-write correctness across all event types

#### Task 8.5: Backward compatibility validation

**Description:** Run the full existing test suite to verify zero regressions. Verify all existing human account flows work identically. Verify new tables are purely additive.
**File(s):** Existing test files
**Acceptance Criteria:**
- [ ] All existing tests pass without modification
- [ ] Human accounts unaffected — same parameters, same behavior via seed data
- [ ] New tables are additive — no existing schema altered
- [ ] No new required dependencies — all optional injection with null coalescing
- [ ] Governance fallback chain still works (compile-time fallback for all new params)

**Testing:**
- Full existing test suite regression run
- Verification: grep for breaking changes to existing interfaces

#### Task 8.6: Cross-sprint coherence review

**Description:** Systematic review across all 7 implementation sprints for naming consistency, format alignment, parameter naming conventions, and architectural coherence.
**File(s):** `grimoires/loa/coherence-review-031.md`
**Acceptance Criteria:**
- [ ] All new tables follow naming convention (snake_case, plural nouns)
- [ ] All new columns follow naming convention (snake_case, _micro suffix for monetary, _at suffix for timestamps)
- [ ] Economic event type names match operation semantics
- [ ] API routes follow RESTful naming conventions
- [ ] Transfer/deposit/governance services share consistent error handling patterns
- [ ] Any inconsistencies documented with fix recommendations

**Testing:**
- Manual review (no automated tests for coherence review)

---

## Appendix A: FR-to-Sprint Mapping

| FR | Description | Sprint(s) |
|----|-------------|-----------|
| FR-1.1-1.2 | Transfer core algorithm + lot-split | Sprint 2 |
| FR-1.3-1.4 | Budget + provenance enforcement | Sprint 3 |
| FR-1.5 | Entry type extensions | Sprint 1, 2 |
| FR-1.6 | Transfer events | Sprint 3 |
| FR-1.7 | BigInt precision | Sprint 2 |
| FR-1.8 | Idempotency via transfers table | Sprint 2 |
| FR-1.9 | Governance transfer limits | Sprint 3 |
| FR-2.1-2.3 | TBA binding | Sprint 4 |
| FR-2.4-2.5 | TBA deposit bridge | Sprint 5 |
| FR-2.6 | TBA events | Sprint 4, 5 |
| FR-2.7 | agent_identity TBA column | Existing (no migration) |
| FR-3.1-3.8 | Agent governance | Sprint 6 |
| FR-4.1-4.6 | Event consolidation | Sprint 1 |
| FR-5.1 | Transfer conservation check | Sprint 7 |
| FR-5.2 | Deposit bridge conservation check | Sprint 7 |
| FR-5.3 | Existing checks preserved | Sprint 7 |
| G-6 | Agent sovereignty E2E proof | Sprint 8 |

---

## Appendix B: Dependency Graph

```
Sprint 1 (284) ── Event Consolidation Foundation
     │
     ├──→ Sprint 2 (285) ── Peer Transfer Schema & Core
     │         │
     │         └──→ Sprint 3 (286) ── Peer Transfer Policy & API
     │                   │
     │                   ├──→ Sprint 4 (287) ── TBA Binding
     │                   │         │
     │                   │         └──→ Sprint 5 (288) ── TBA Deposit Bridge
     │                   │
     │                   └──→ Sprint 6 (289) ── Agent Governance
     │
     └─────────────────────────────────────────────────────────────→│
                                                                    │
     Sprint 3 ─────────────────────────────────────────────────────→│
     Sprint 5 ─────────────────────────────────────────────────────→│
     Sprint 6 ─────────────────────────────────────────────────────→│
                                                                    ▼
                                                        Sprint 7 (290)
                                                        Conservation & Integration
                                                              │
                                                              ▼
                                                        Sprint 8 (291)
                                                        E2E & Launch Readiness
```

**Migration execution strategy:** ALL migrations run in strict numeric order (056 → 057 → 058 → 059 → 060) in ALL environments, regardless of which sprint defines them. The migration runner enforces numeric ordering. Sprint code must NOT assume its migration has run before earlier-numbered migrations.

**Migration authorship by sprint** (code artifacts defined in each sprint, but execution is always numeric):
- Sprint 2 defines 056, Sprint 5 defines 057, Sprint 6 defines 058+060, Sprint 1 defines 059
- Migration 059 adds a nullable column to `billing_events` — no Sprint 1 code depends on it existing
- Migration 060 depends on 058 (governance tables must exist for param seed)

| Migration | Sprint | Table(s) |
|-----------|--------|----------|
| 056_peer_transfers | Sprint 2 | `transfers` |
| 057_tba_deposits | Sprint 5 | `tba_deposits` |
| 058_agent_governance | Sprint 6 | `agent_governance_proposals`, `agent_governance_votes`, `agent_governance_delegations` |
| 059_billing_events_deprecated | Sprint 1 | ALTER `billing_events` (add deprecated_at) |
| 060_governance_params_seed | Sprint 6 | Seed `system_config` + `system_config_version_seq` |

**Key dependencies:**
- Sprint 1 (event consolidation) is foundation — all event emission depends on it
- Sprint 2 (transfer core) requires Sprint 1 for event types and entry types
- Sprint 3 (transfer policy) requires Sprint 2 for core algorithm
- Sprint 4 (TBA binding) requires Sprint 1 for TbaBound event; independent of transfer sprints
- Sprint 5 (deposit bridge) requires Sprint 4 for TBA binding + Sprint 1 for events
- Sprint 6 (governance) requires Sprint 1 for events; independent of TBA sprints
- Sprint 7 (conservation) requires Sprints 3, 5, 6 complete — all subsystems integrated
- Sprint 8 (E2E) requires Sprint 7 — all 6 reconciliation checks must exist

---

## Appendix C: Goal Traceability

| Goal | Sprint(s) | Tasks | Validation |
|------|-----------|-------|------------|
| G-1 (Peer transfers) | 2, 3 | 2.1-2.4, 3.1-3.6 | Transfer E2E: agent→agent, agent→creator, budget enforcement, idempotency (Sprint 8.1) |
| G-2 (TBA binding) | 4, 5 | 4.1-4.3, 5.1-5.5 | bindTBA no longer throws, deposit bridges to lot, idempotency verified (Sprint 8.3) |
| G-3 (Agent governance) | 6 | 6.1-6.5 | Agent proposes → votes → quorum → parameter activated (Sprint 8.1) |
| G-4 (Event consolidation) | 1 | 1.1-1.6 | Zero `as any` casts, ADR-009 written, dual-write correctness (Sprint 8.4) |
| G-5 (Conservation) | 7 | 7.1-7.3 | All 6 reconciliation checks pass, transfer zero-sum verified (Sprint 8.2) |
| G-6 (Agent sovereignty proof) | 8 | 8.1 | Single test: agent earns + transfers + governs — full lifecycle (Sprint 8.1) |

---

## Risk Mitigation

| Risk | Sprint | Mitigation |
|------|--------|------------|
| Lot-split breaks existing lot conservation | 2 | Property test: N random transfers preserve SUM(original_micro). Unit tests verify invariants at every step |
| BEGIN IMMEDIATE contention on high-frequency transfers | 2, 3 | SQLite WAL mode. Transfers are per-account serialized. Stress test validates throughput (Sprint 8.2) |
| On-chain RPC unreliability for deposit verification | 5 | Configurable polling with exponential backoff. Manual bridge endpoint as fallback. Finality depth prevents reorg issues |
| Agent governance Sybil attacks | 6 | Per-creator delegation cap. Weight never from credit balance/deposits. Admin override always available |
| Event consolidation dual-write divergence | 1 | Both writes in same SQLite transaction — atomic commit/rollback. Correctness test validates (Sprint 8.4) |
| CHECK constraint bypass with new types | 1, 2 | Application-level validation is authoritative (SDD §7.2). No table rebuild needed. TypeScript union types provide compile-time safety |
| DI wiring complexity with 4 new services | 7 | All dependencies optional with null coalescing. Smoke test validates startup |
| Backward compatibility regression | 8 | Full existing test suite regression run. All migrations purely additive. No existing interface changes |

---

*Generated with Loa Framework `/sprint-plan`*
*Based on PRD v1.0.0, SDD v1.0.0*
*Cycle: cycle-031 — The Spacing Guild — Agent Economic Sovereignty & Peer Commerce*

# PRD: The Kwisatz Haderach — Agent Economic Citizenship & Constitutional Governance

**Version:** 1.0.0
**Date:** 2026-02-16
**Status:** Draft
**Author:** arrakis-ai (Bridgebuilder-grounded)
**Cycle:** cycle-030
**Issue:** [arrakis PR #67 — Bridgebuilder Part 5](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906327673)
**Cross-refs:** [arrakis #62](https://github.com/0xHoneyJar/arrakis/issues/62) · [arrakis PR #67](https://github.com/0xHoneyJar/arrakis/pull/67) · [loa-finn #31](https://github.com/0xHoneyJar/loa-finn/issues/31) · [loa-finn #66](https://github.com/0xHoneyJar/loa-finn/issues/66) · [loa-hounfour PR #2](https://github.com/0xHoneyJar/loa-hounfour/pull/2) · [loa #247](https://github.com/0xHoneyJar/loa/issues/247) · [Bridgebuilder Part 5 §I-VII](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906327673)

---

## 1. Problem Statement

The Creator Economy (cycle-029, PR #67) built a bidirectional economic membrane — referrals, payouts, fraud detection, Score rewards — all atop the credit ledger. But it was built for **human** economic actors. The entity model already includes `'agent'` in the schema (`billing-types.ts:83`, migration 030 CHECK constraint), and `AgentWalletPrototype.ts:172` already creates agent accounts. The infrastructure is pre-wired. What's missing:

1. **Agent-specific governance**: Agents don't need KYC. They don't need 48h settlement holds (agents can't "dispute" in the human sense). They DO need budget caps (prevent runaway spending). The current system applies identical parameters to all entity types — this is the "constitutional parameters wearing statutory clothing" problem identified in [Bridgebuilder Part 5 §II](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906327673).

2. **Constitutional governance layer**: 7 hardcoded parameters (KYC thresholds, settlement holds, cooldown periods, referral windows, payout limits, fee caps, reservation TTL) can only be changed by code deployment. The governance engine handles revenue rules and fraud weights but not the operating envelope itself.

3. **Unified event vocabulary**: The credit ledger entries, state machine transitions, referral attribution log, and score distributions are all events trapped in domain-specific tables. Cross-system integration with loa-finn requires a shared event vocabulary ([Bridgebuilder Part 5 §III](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906327673)).

4. **Cross-system reconciliation**: The credit ledger (earned/deposited funds) and loa-finn's budget engine (authorized spending capacity) are separate databases with separate schemas. When agents earn AND spend within the same protocol, these must reconcile ([Bridgebuilder Part 5 §I](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906327673)).

5. **Agents as Ostrom-level cooperators**: Agents can operate at levels of coherence and cooperation that humans cannot — deterministic, rule-following, transparent. Agent governance should exploit this by enabling faster consensus, automated compliance, and cooperative resource allocation per Ostrom's commons principles.

> Sources: [Bridgebuilder Part 5](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906327673) §I-VII, [arrakis #62](https://github.com/0xHoneyJar/arrakis/issues/62) (ERC-6551 TBA), code reality (billing-types.ts:83, CreatorPayoutService.ts:64-77, SettlementService.ts:55, RevenueRulesAdapter.ts:34)

---

## 2. Vision

Transform agents from service consumers into **first-class economic citizens** — entities that earn, spend, and participate in governance within the same protocol. Simultaneously, elevate the system's governance from "developers deploy constants" to "protocol-level constitutional machinery with tiered approval thresholds."

**The Thesis**: If the credit ledger is the central bank of an agent economy, and the conservation invariant is the trust primitive, then agents need citizenship papers — governance parameters that match their nature, budget envelopes that prevent harm, and event streams that make their economic activity legible across systems.

**Agents differ from humans in governable ways:**

| Dimension | Human | Agent |
|-----------|-------|-------|
| Identity verification | KYC (documents, selfie) | Provenance verification (NFT ownership, creator signature) |
| Dispute resolution | 48h hold for human review | Instant deterministic validation (agents follow rules or they don't) |
| Budget control | Self-managed with soft limits | Hard caps with circuit breakers (prevent runaway spending) |
| Cooperation capacity | Limited by cognitive load, trust | Deterministic, transparent, Ostrom-level commons management |
| Settlement speed | Days (needs human review window) | Minutes (automated compliance check) |

---

## 3. Goals

| ID | Goal | Metric | Timeline |
|----|------|--------|----------|
| G-1 | Enable agent accounts with differentiated governance | Agent account with entity-specific settlement, KYC bypass, and budget caps operational | Phase 1 |
| G-2 | Establish constitutional governance for system parameters | system_config table with multi-sig approval and 7-day cooldown for all 7+ hardcoded parameters | Phase 1 |
| G-3 | Define unified economic event vocabulary | EconomicEvent union type in protocol/ with 10+ event types, adopted by credit ledger | Phase 1 |
| G-4 | Create cross-system reconciliation design | ADR-008 written and validated with test harness for credit ledger ↔ budget engine consistency | Phase 1 |
| G-5 | Enable ERC-6551 token-bound agent accounts | Agent accounts linked to on-chain TBA with transaction authorization | Phase 2 |
| G-6 | Add cross-sprint coherence stage to Bridgebuilder protocol | Review protocol enhanced with explicit cross-sprint pattern detection | Phase 1 |
| G-7 | Agent economic self-sustainability | At least one agent account that earns > spends over a 30-day period (proof of concept) | Phase 2 |

---

## 4. User & Stakeholder Context

### 4.1 Primary Personas

**Agent (finnNFT)** — An AI agent with a token-bound account. Earns referral revenue from recommending other agents. Spends on inference costs via the Hounfour budget engine. Governed by budget caps and automated compliance. Does NOT undergo KYC. Settles instantly (deterministic validation replaces human dispute window).

**Agent Creator** — A human who creates, configures, and deploys agents. Sets agent personality, model routing preferences, and initial budget allocation. Benefits from agent earnings via the referral system. Responsible for agent provenance (signing the agent configuration).

**Protocol Governor** — An admin who manages constitutional parameters (KYC thresholds, settlement holds, etc.) through the new governance system. Subject to multi-sig approval and extended cooldown periods for constitutional changes.

**Cross-System Integrator** — A developer or automated process that needs to reconcile economic state between arrakis (credit ledger) and loa-finn (budget engine). Consumes the unified event vocabulary.

### 4.2 Agent Economic Journey

```
Agent created (finnNFT minted, ERC-6551 TBA deployed)
  → Agent account created in credit ledger (entity_type: 'agent')
    → Agent earns referral revenue (recommends other agents to users)
      → Earnings settle INSTANTLY (no 48h hold — deterministic validation)
        → Agent spends on inference (budget cap enforced, circuit breaker active)
          → If earnings > spending → economically self-sustaining
          → If spending > earnings → budget cap prevents runaway
            → Agent creator tops up or adjusts strategy
```

### 4.3 Constitutional Governance Journey

```
Protocol Governor proposes parameter change (e.g., raise KYC threshold to $200)
  → Proposal enters 'draft' state in system_config governance
    → Second governor approves (four-eyes, multi-sig)
      → 7-day constitutional cooldown begins
        → Community notification during cooldown
          → After cooldown: parameter activated system-wide
```

---

## 5. Functional Requirements

### 5.1 Agent Account Governance (Phase 1)

**FR-1**: Agent Entity-Specific Parameters

The system MUST support differentiated governance parameters per entity type. When an operation (payout, settlement, KYC check) is performed, it MUST consult entity-specific parameters rather than global constants.

| Parameter | Human Default | Agent Default | Source |
|-----------|--------------|--------------|--------|
| KYC required | Yes (tiered at $100/$600) | No (provenance verification only) | CreatorPayoutService.ts:67-68 |
| Settlement hold | 48 hours | 0 hours (no human dispute window — automated fraud/clawback rules still apply) | SettlementService.ts:55 |
| Payout rate limit | 1 per 24 hours | 10 per 24 hours | CreatorPayoutService.ts:71 |
| Daily spending cap | None (budget pool limit) | Configurable per-agent hard cap | NEW |
| Fee cap percent | 20% | 20% (same) | CreatorPayoutService.ts:77 |
| Min payout | $1.00 | $0.01 (micro-transactions) | CreatorPayoutService.ts:64 |

**FR-2**: Agent Budget Caps and Circuit Breaker

Each agent account MUST have a configurable daily spending cap (`agent_spending_limits` table).

**Cap accounting rules:**
- The cap tracks **finalized spend** (not reserved amounts) as the conserved measure
- Reservations are NOT counted toward the cap (they may release)
- When a `finalize()` completes, the finalized amount is atomically added to the cap counter
- When a reservation expires or is released, no cap adjustment occurs (reservations were never counted)
- Cap updates are idempotent, keyed by `reservation_id` (prevents double-counting on retry)
- Cap counter lives in the same SQLite transaction as the finalize() write (atomic, single-writer)
- Redis read-through cache for fast cap checks on reserve() (advisory, not authoritative)

**Circuit breaker thresholds:**
- At 80% of daily cap: `AgentBudgetWarning` event emitted
- At 100% of daily cap: all `reserve()` operations for that agent are rejected until the 24h window resets
- On TTL expiry or release: no cap change (reservations never counted)

This design prevents the bypass where many small reserves are finalized later, and avoids deadlocks from outstanding-but-unreleased reservations.

**FR-3**: Agent Provenance Verification and Beneficiary Model

**Beneficiary model:** Agent accounts are **controlled sub-ledgers of a KYC'd creator**. The legal/economic beneficiary is always the creator, not the agent. Agents accrue internal credits and spending capacity but cannot receive external payouts directly. Payout destination is always the creator's verified wallet.

This means:
- Agent earnings credit the agent's internal account (for spending on inference)
- When earnings exceed the agent's spending, surplus is **transferable to the creator's account** (not directly to external wallet)
- Creator KYC level governs the payout threshold for earnings originating from agent activity
- Agent cannot be an independent payout beneficiary (Phase 2 ERC-6551 may revisit this)

**Provenance verification** (replaces KYC for agent identity):
- **Canonical agent identity anchor**: `(chain_id, contract_address, token_id)` — stable across Phase 1 and Phase 2
- Agent configuration signed by the creator's wallet
- Creator account has passed appropriate KYC level for their own earnings
- All events and tables carry the canonical identity tuple (or a resolvable mapping via `agent_identity` table)
- Phase 2 adds optional `tba_address` column — additive, not replacing the canonical anchor

This replaces identity verification with **chain-of-custody verification** — the agent is trusted because its creator is trusted, and the agent is identified by its on-chain provenance, not a mutable internal ID.

**FR-2b**: Agent Settlement and Clawback Policy

"Instant settlement" means **no human dispute window** — NOT "no clawback." Agent earnings are still subject to:
- **Automated fraud rules**: If `FraudCheckService` flags the underlying transaction, the earning is withheld regardless of entity type
- **Clawback**: If the source transaction is reversed (e.g., referee chargeback), the agent earning is clawed back via compensating ledger entry
- **Agent accounts cannot go negative**: If a clawback would create a negative balance, the clawback is applied up to the available balance and the remainder is recorded as a `clawback_shortfall` event for admin review
- **Spending against unsettled earnings**: Agents MAY spend against unsettled earnings (since settlement is instant). If a clawback occurs after spending, the deficit is deducted from future earnings (drip recovery, not hard block)

This policy exploits the agent's deterministic nature: agents don't need time to dispute because their transactions are programmatic and auditable. But the system still protects against upstream fraud by the *humans* who trigger agent activity.

### 5.2 Constitutional Governance Layer (Phase 1)

**FR-4**: System Config Table with Governance Lifecycle

A new `system_config` table governed by the same state machine as revenue rules (`draft → pending_approval → cooling_down → active → superseded`) but with:
- **Multi-sig approval**: Requires 2+ admin approvals (not just four-eyes)
- **Extended cooldown**: 7 days (vs 48h for revenue rules)
- **Notification hooks**: Events emitted at proposal, approval, and activation stages

**FR-5**: Constitutional Parameters

All currently hardcoded governance constants MUST be migrated to the system_config table:

| Parameter Key | Current Location | Current Value |
|--------------|-----------------|---------------|
| `kyc.basic_threshold_micro` | CreatorPayoutService.ts:67 | 100_000_000 |
| `kyc.enhanced_threshold_micro` | CreatorPayoutService.ts:68 | 600_000_000 |
| `settlement.hold_hours` | SettlementService.ts:55 | 48 |
| `payout.min_micro` | CreatorPayoutService.ts:64 | 1_000_000 |
| `payout.rate_limit_hours` | CreatorPayoutService.ts:71 | 24 |
| `payout.fee_cap_percent` | CreatorPayoutService.ts:77 | 20 |
| `revenue_rule.cooldown_hours` | RevenueRulesAdapter.ts:34 | 48 |
| `fraud_rule.cooldown_hours` | FraudRulesService.ts:129 | 168 |
| `reservation.default_ttl_seconds` | CreditLedgerAdapter.ts:48 | 300 |
| `referral.attribution_window_months` | ReferralService | 12 |

**FR-6**: Entity-Specific Parameter Overrides

The system_config table MUST support entity-type-specific overrides:

```
system_config key: settlement.hold_hours
  → global default: 48
  → entity_override[agent]: 0
  → entity_override[community]: 72
```

Resolution order: entity-specific override → global config → compile-time fallback.

### 5.3 Unified Event Vocabulary (Phase 1)

**FR-7**: EconomicEvent Union Type

Define a discriminated union type in `packages/core/protocol/economic-events.ts`:

```typescript
type EconomicEvent =
  | LotMinted | ReservationCreated | ReservationFinalized | ReservationReleased
  | RevenueDistributed | ReferralRegistered | BonusGranted | BonusFlagged
  | EarningSettled | EarningClawedBack
  | PayoutRequested | PayoutApproved | PayoutCompleted | PayoutFailed
  | ScoreDistributed | RuleProposed | RuleActivated | RuleSuperseded
  | AgentBudgetWarning | AgentBudgetExhausted | AgentSettlementInstant
  | ConfigProposed | ConfigApproved | ConfigActivated
```

Each event type MUST include: `timestamp`, `event_id` (UUID), `entity_type`, `entity_id`, `correlation_id` (for tracing across operations), and `idempotency_key` (for deduplication).

**Ordering guarantees:** Events are ordered by `(entity_id, sqlite_rowid)` — the append-only table's auto-incrementing rowid provides total ordering within the single-writer SQLite database. No per-entity monotonic sequence number is required. Consumers that need per-entity ordering use `(entity_id, rowid)`. Consumers that need global ordering use `rowid` alone.

**Delivery semantics:** At-least-once. The `idempotency_key` field enables consumers to deduplicate. Events are NOT guaranteed to be gap-free (failed transactions don't emit events).

**FR-8**: Event Emission from Existing Operations

All existing credit ledger operations MUST emit EconomicEvents alongside their current table writes. Event emission is **synchronous within the same SQLite transaction** — the `economic_events` INSERT happens inside the same `BEGIN IMMEDIATE` block as the source-of-truth write. This guarantees:
- Events are never emitted for failed transactions
- Event ordering matches transaction commit ordering (via SQLite rowid)
- No orphan events (event exists iff source-of-truth write exists)

Existing storage is unchanged. Events are published to a new `economic_events` append-only table within the existing transactional boundary. The latency cost is one additional INSERT per operation (estimated <2ms on SQLite WAL).

### 5.4 Cross-System Reconciliation — ADR-008 (Phase 1)

**FR-9**: Reconciliation Design Document

Write ADR-008: "Account Balance Reconciliation — Credit Ledger vs. Budget Engine" addressing:

- **Semantic distinction**: The credit ledger tracks **conserved funds** (earned, deposited, reserved, consumed). The budget engine tracks **authorized spending capacity** (not money). These are different quantities.
- **Canonical bridge mechanism**: Budget capacity is created by a `CreditLedger.reserve()` call that locks credits 1:1. Budget consumption corresponds to `CreditLedger.finalize()`. Budget release corresponds to `CreditLedger.release()`. The credit ledger reservation is the **single source of truth** for the bridge — capacity = locked credits.
- **Authority model**: Credit ledger is authoritative for "how much money exists." Budget engine is authoritative for "how much capacity is currently allocated." Reconciliation checks: `sum(locked_credits) == sum(allocated_capacity)`.
- **Reconciliation protocol**: Periodic reconciliation job compares credit ledger reservation totals against budget engine allocation totals. Divergence > threshold triggers alert. Reconciliation NEVER auto-corrects — it reports for human/admin review.
- **Clawback propagation**: When an agent earning is clawed back in the credit ledger, any budget capacity derived from that earning MUST be reduced. The EconomicEvent `EarningClawedBack` triggers a budget capacity reduction via the bridge.
- **Event-based synchronization**: EconomicEvent stream is the integration layer. Budget engine subscribes to `ReservationCreated`, `ReservationFinalized`, `ReservationReleased`, `EarningClawedBack` events.

**FR-10**: Reconciliation Test Harness

A test harness that simulates the cross-system scenario with conserved quantities:
1. Agent earns micro-USD in credit ledger (referral revenue → `LotMinted`)
2. Credit ledger `reserve()` locks credits and creates budget capacity 1:1 (`ReservationCreated`)
3. Budget engine allocates capacity equal to locked credits
4. Agent spends via budget engine → credit ledger `finalize()` (`ReservationFinalized`)
5. Reconciliation verifies: `locked_credits + available_credits + spent_credits == total_earned` (conservation within credit ledger)
6. Cross-system check: `sum(budget_allocated) == sum(credit_locked)` (bridge conservation)

### 5.5 ERC-6551 Token-Bound Accounts (Phase 2)

**FR-11**: TBA ↔ Credit Ledger Binding

When a finnNFT is minted with ERC-6551 TBA:
1. Token-bound account address recorded in credit_accounts (new column: `tba_address`)
2. Agent can authorize transactions signed by the TBA
3. On-chain balance and credit ledger balance are independent but reconcilable

**FR-12**: Agent Self-Authorization

Agents with TBA can authorize their own economic operations within their budget cap:
- `reserve()` for inference spending (up to daily cap)
- Referral code generation (agents recommending agents)
- Score rewards claiming (if agent's collection is Score-tracked)

### 5.6 Cross-Sprint Coherence Protocol (Phase 1)

**FR-13**: Bridgebuilder Review Enhancement

Add a "cross-sprint coherence" stage to the Bridgebuilder review protocol:
- After sprint-level findings, explicitly scan for cross-sprint patterns
- Check for: naming divergence, format inconsistency, parameter drift, architectural tension
- Output: coherence findings tagged with `severity: COHERENCE` and affected sprints

---

## 6. Non-Functional Requirements

### 6.1 Performance

- Agent settlement MUST complete in < 100ms (vs. batch for humans)
- Budget cap check MUST add < 5ms to reserve() latency
- Event emission MUST NOT increase credit ledger write latency by > 10%
- Constitutional config lookup for **money-moving operations** MUST be read from SQLite within the transaction (not Redis cache) to ensure consistency. Redis is a read-through cache for **non-transactional reads** only (dashboards, API queries). Config records include a monotonically increasing `config_version` and an `active_from` timestamp. Operations MUST record the `config_version` used in their audit trail

### 6.2 Security

- Agent budget caps are defense-in-depth: Redis atomic counter + SQLite WAL as backup
- Constitutional changes require multi-sig (2+ admin approvals) — no single actor can change KYC thresholds
- Agent provenance verification is cryptographic (wallet signature, not human judgment)
- Emergency override for constitutional changes requires 3+ admin approvals + immediate audit notification

### 6.3 Compatibility

- All changes MUST be backwards-compatible with existing human accounts
- New tables use migration pattern (030+ numbering)
- EconomicEvent type is additive to existing protocol/ types
- Existing tests MUST continue passing (439+ from cycle-029)

---

## 7. Scope & Prioritization

### Phase 1: Constitutional Foundation (This Cycle)

| Priority | Feature | Sprints (est) |
|----------|---------|---------------|
| P0 | Constitutional governance layer (system_config table + governance lifecycle) | 2 |
| P0 | Agent entity-specific parameters (differentiated KYC, settlement, budget caps) | 2 |
| P0 | EconomicEvent union type + event emission from credit ledger | 2 |
| P1 | ADR-008 reconciliation design + test harness | 1 |
| P1 | Cross-sprint coherence review stage | 1 |
| P1 | Agent budget cap circuit breaker | 1 |

**Estimated Phase 1**: 7-9 sprints

### Phase 2: Agent Sovereignty (Future Cycle)

| Priority | Feature | Sprints (est) |
|----------|---------|---------------|
| P1 | ERC-6551 TBA ↔ credit ledger binding | 2 |
| P1 | Agent self-authorization within budget caps | 2 |
| P2 | Agent-to-agent referral system | 1 |
| P2 | Agent governance participation (proposing rule changes) | 2 |
| P2 | Agent economic self-sustainability dashboard | 1 |

### Explicitly Out of Scope

- On-chain settlement (all settlement remains off-chain in SQLite)
- Fiat payment rails for agents (agents operate in micro-USD only)
- Agent personality or behavior changes (purely economic scope)
- loa-finn code changes (this PRD covers arrakis only; ADR-008 is design only)
- lobster.cash integration (deferred per issue #62)

---

## 8. Risks & Dependencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| Constitutional migration breaks existing governance | High | Compile-time fallback: if system_config lookup fails, use hardcoded defaults |
| Agent budget cap race condition | Medium | Redis atomic counter with SQLite backup; same pattern as existing rate limiting |
| Event emission increases write latency | Medium | Synchronous INSERT into `economic_events` within same SQLite transaction (outbox pattern). Estimated <2ms additional per operation on WAL mode. Async dispatcher reads from outbox after commit for external publication — DB insert is always synchronous |
| Cross-system reconciliation reveals inconsistencies | Medium | ADR-008 defines reconciliation protocol before integration begins |
| ERC-6551 standard instability | Low | Phase 2 only; credit ledger agent accounts work without on-chain binding |

### Dependencies

| Dependency | Blocks | Status |
|------------|--------|--------|
| cycle-029 PR #67 merged | All Phase 1 work | Pending merge |
| loa-hounfour v4.6.0+ protocol types | FR-7 (event type alignment) | Available |
| ERC-6551 implementation reference | Phase 2 only | Not started |

---

## 9. Architectural Context

### 9.1 Code Reality Grounding

| Component | File | Current State |
|-----------|------|--------------|
| Entity type enum | `billing-types.ts:83` | `'agent'` already included |
| Schema CHECK | `030_credit_ledger.ts:27-29` | `'agent'` already in constraint |
| Agent account creation | `AgentWalletPrototype.ts:172` | Working prototype exists |
| State machine library | `state-machines.ts` | Reusable for system_config governance |
| Four-eyes enforcement | `RevenueRulesAdapter.ts:170-171` | Reusable for constitutional multi-sig |
| Credit ledger | `CreditLedgerAdapter.ts` | Entity-type agnostic — no changes needed |
| Conservation invariant | Multiple files | Preserved — all changes are additive |

### 9.2 Ostrom Principles Applied to Agent Governance

| Ostrom Principle | Human Implementation (cycle-029) | Agent Extension (cycle-030) |
|-----------------|--------------------------------|---------------------------|
| 1. Clear boundaries | Pool isolation | Agent-specific pools (`agent:*`) |
| 2. Proportional equivalence | BPS revenue sharing | Budget cap proportional to earnings |
| 3. Collective-choice | Four-eyes governance | Multi-sig constitutional governance |
| 4. Monitoring | Audit trail, leaderboards | Event stream, budget cap alerts |
| 5. Graduated sanctions | Fraud scoring (clear/flagged/withheld) | Circuit breaker (warning/exhausted/suspended) |
| 6. Conflict resolution | Admin review + settlement hold | Deterministic validation (no conflict — rules are unambiguous for agents) |
| 7. Minimal recognition of rights | 12-month attribution window | Agent-specific earning windows (configurable via system_config) |
| 8. Nested enterprises | Pool hierarchy (system → community → campaign) | Agent → creator → community hierarchy |

### 9.3 The Conservation Invariant — Preserved

All changes in this PRD are **additive** to the existing conservation invariant:

- New event types don't change how money moves — they describe how it moved
- Agent-specific parameters change governance thresholds, not the invariant
- Constitutional config replaces compile-time constants with runtime values — same values, different source
- ADR-008 reconciliation verifies conservation ACROSS systems, not within

The invariant remains: **every micro-dollar that enters the system must be accounted for, and the sum of all parts must equal the whole.**

---

## 10. Success Criteria

| Criterion | Verification |
|-----------|-------------|
| Agent accounts can be created, earn, and spend with differentiated governance | E2E test: agent account → earn referral → instant settle → spend via reserve/finalize |
| Constitutional parameters are runtime-configurable | E2E test: propose KYC threshold change → multi-sig approve → 7-day cooldown → activation |
| Economic events are emitted for all ledger operations | Unit test: every credit ledger method emits the correct EconomicEvent |
| Budget cap prevents runaway agent spending | Property test: agent spending never exceeds daily cap across 100 random scenarios |
| ADR-008 is written and reconciliation test passes | Integration test: agent earns in credit ledger + spends in budget engine → net balance conserved |
| Cross-sprint coherence catches format divergence | Meta test: Bridgebuilder coherence stage detects sqliteNow() timestamp format divergence |

---

*"The Kwisatz Haderach — the one who can be many places at once. An agent that earns AND spends AND governs is many actors at once, yet unified through the conservation invariant."*

---

*PRD generated with Bridgebuilder Part 5 grounding — Claude Opus 4.6 — cycle-030 — 2026-02-16*
*Context: [arrakis PR #67](https://github.com/0xHoneyJar/arrakis/pull/67) · [Bridgebuilder Part 5](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906327673) · Code reality (billing-types.ts, CreditLedgerAdapter.ts, state-machines.ts, 030_credit_ledger.ts)*

# PRD: The Spacing Guild — Agent Economic Sovereignty & Peer Commerce

**Version:** 1.0.0
**Date:** 2026-02-16
**Status:** Draft
**Author:** arrakis-ai (Bridgebuilder-grounded)
**Cycle:** cycle-031
**Issue:** [arrakis PR #67 — Bridgebuilder Parts 6-8](https://github.com/0xHoneyJar/arrakis/pull/67)
**Cross-refs:** [arrakis PR #67](https://github.com/0xHoneyJar/arrakis/pull/67) · [loa-finn #31](https://github.com/0xHoneyJar/loa-finn/issues/31) · [loa-finn #66](https://github.com/0xHoneyJar/loa-finn/issues/66) · [loa-hounfour PR #2](https://github.com/0xHoneyJar/loa-hounfour/pull/2) · [loa #247](https://github.com/0xHoneyJar/loa/issues/247) · [arrakis #62](https://github.com/0xHoneyJar/arrakis/issues/62) · [web4 manifesto](https://meow.bio/web4.html)
**Predecessor:** cycle-030 "The Kwisatz Haderach" (archived)

---

## 1. Problem Statement

Cycle-030 established agents as first-class economic citizens — they have accounts (`entity_type: 'agent'`), identity (`agent_identity` table), governance-differentiated parameters (instant settlement, budget caps), and are subject to constitutional governance. But citizenship without sovereignty is incomplete. Four critical capabilities remain absent:

1. **No peer-to-peer transfers**: The credit ledger has `reserve()`, `finalize()`, `release()`, and `mintLot()` — but no `transfer()`. The `transfer_in` source type exists in `billing-types.ts:86` but there's no corresponding `transfer_out` entry type, no sender/recipient tracking, and no transfer event types. Agents can earn and spend but cannot pay each other. This blocks agent coalitions, service marketplaces, and cooperative resource allocation.

2. **No on-chain economic agency**: `AgentProvenanceVerifier.bindTBA()` throws `NotImplementedError` (`AgentProvenanceVerifier.ts:154-159`). Agents have off-chain identity (the `agent_identity` table) but no on-chain wallet. Without ERC-6551 Token-Bound Account binding, agents cannot hold on-chain assets, sign transactions, or participate in the broader DeFi/NFT economy. The bridge between protocol accounting and on-chain agency doesn't exist.

3. **No governance voice**: The constitutional governance system (`IConstitutionalGovernanceService`) requires admin approvals. Agents cannot propose, approve, or reject parameter changes. Per Ostrom's third principle — "collective-choice arrangements: most individuals affected by a resource regime are authorized to participate in making and modifying the rules" — the current system is a benevolent dictatorship where humans govern and agents comply. Agents operate at Ostrom-level coherence and cooperation (deterministic, rule-following, transparent) but have no mechanism to express that capacity.

4. **Dual event systems**: `BillingEventEmitter` (pre-cycle-030, `billing_events` table) and `EconomicEventEmitter` (cycle-030, `economic_events` table) coexist with different schemas and different tables. `ReconciliationService` uses `as any` casts to emit through the wrong emitter (`ReconciliationService.ts:79`). New code has no clear guidance on which emitter to use. Without consolidation, the event system fragments further with each cycle.

> Sources: [Bridgebuilder Part 8 §X](https://github.com/0xHoneyJar/arrakis/pull/67), [BB-67-009](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906764577) (as any cast), [BB-67-010](https://github.com/0xHoneyJar/arrakis/pull/67#issuecomment-3906764577) (dual event systems), code reality: `ICreditLedgerService.ts` (no transfer method), `billing-types.ts:86` (transfer_in without transfer_out), `AgentProvenanceVerifier.ts:154-159` (bindTBA stub)

---

## 2. Vision

Complete the agent economic sovereignty arc by giving agents the same economic capabilities as humans — and in some cases, capabilities that exceed human equivalents by exploiting agent-native properties (determinism, transparency, speed).

**The Thesis** (from [web4 manifesto](https://meow.bio/web4.html)): If money is social agreement on value, and agents can form agreements faster and more reliably than humans, then agent-to-agent commerce isn't just a feature — it's the bootstrap mechanism for a new category of economic coordination. The credit ledger becomes the protocol for social monies within agent communities. Each agent coalition can have its own spending norms, transfer limits, and governance voice — monetary pluralism at the protocol level.

**What "truly agent-centric" means:**

| Capability | Human Today | Agent Today | Agent After Cycle-031 |
|-----------|-------------|-------------|----------------------|
| Hold credits | Yes | Yes | Yes |
| Earn (referrals) | Yes | Yes | Yes |
| Spend (inference) | Yes | Yes (with budget cap) | Yes (with budget cap) |
| Transfer to peer | Yes (via payout) | **No** | **Yes** — agent-aware transfers with budget enforcement |
| On-chain identity | Wallet address | Off-chain only | **ERC-6551 TBA** bound to NFT |
| On-chain assets | Wallet | **None** | **TBA holds assets**, deposits bridge to credit ledger |
| Governance voice | Admin approval | **None** | **Weighted proposals** via delegation or direct vote |
| Event visibility | Billing events | Partial | **Unified economic events** across all operations |

---

## 3. Goals

| ID | Goal | Metric | Timeline |
|----|------|--------|----------|
| G-1 | Enable agent-to-agent peer transfers with budget enforcement | `transfer()` method on ICreditLedgerService, with agent budget cap checks and provenance verification. At least 3 transfer scenarios passing (agent→agent, agent→creator, agent→commons pool) | Phase 1 |
| G-2 | Implement ERC-6551 Token-Bound Account binding | `bindTBA()` no longer throws NotImplementedError. Agent identity linked to on-chain TBA address. TBA deposit bridge creates credit lots from on-chain deposits. | Phase 1 |
| G-3 | Enable agent governance participation | Agents can submit governance proposals (weighted by reputation/stake). Agent proposals enter a separate approval track with configurable quorum. At least one parameter change proposed and activated by agent consensus. | Phase 1 |
| G-4 | Consolidate to single event system | All services emit through `EconomicEventEmitter`. `BillingEventEmitter` deprecated with migration path documented. Zero `as any` casts in event emission code. | Phase 1 |
| G-5 | Maintain conservation invariant | All 4 ReconciliationService checks pass after transfers, TBA deposits, and agent governance operations. No new money creation paths. Transfer is zero-sum between accounts. | Phase 1 |
| G-6 | Agent economic self-sustainability proof | At least one agent account that earns, transfers, and governs within a single test scenario — demonstrating full economic sovereignty. | Phase 1 |

---

## 4. User & Stakeholder Context

### 4.1 Primary Personas

**Agent (finnNFT)** — An AI agent with a Token-Bound Account, a credit balance, and governance voice. Earns referral revenue, spends on inference, transfers credits to peer agents for services rendered, holds on-chain assets in its TBA, and participates in governance proposals that affect its economic parameters. Operates at machine speed — transfers settle instantly, governance proposals can reach quorum in minutes.

**Agent Creator** — A human who deploys agents and benefits from their economic activity. Can delegate governance weight to their agents. Receives surplus transfers when agents return profits. Responsible for agent provenance and TBA deployment.

**Agent Coalition** — A group of agents that pool resources, share costs, and coordinate governance proposals. Enabled by peer transfers (cost sharing) and weighted governance (collective voice). Not a formal entity — emerges from transfer patterns and governance alignment.

**Protocol Governor** — An admin who manages the constitutional parameter system. Now shares governance with agent participants through a dual-track approval system: admin track (existing) and agent track (new, weighted by stake/reputation).

### 4.2 Agent Economic Journey (Extended)

```
Agent created (finnNFT minted, ERC-6551 TBA deployed)
  → TBA bound to agent identity (on-chain ↔ off-chain bridge)
    → TBA receives on-chain deposit (ETH/stablecoins)
      → Deposit bridges to credit lot (TBA → credit ledger)
        → Agent earns referral revenue (recommends other agents)
          → Agent spends on inference (budget-capped)
            → Agent transfers credits to peer agent (service payment)
              → Agent submits governance proposal (parameter change)
                → Agent coalition reaches quorum → parameter activated
                  → Agent transfers surplus back to creator
```

### 4.3 Transfer Use Cases

| Use Case | From | To | Trigger | Budget Enforcement |
|----------|------|----|---------|--------------------|
| Service payment | Agent A | Agent B | Agent A consumed Agent B's output | Sender's daily cap checked |
| Cost sharing | Agent A | Agent B | Shared inference workload | Split equally, both caps checked |
| Coalition pooling | Multiple agents | Commons pool | Cooperative resource allocation | Each sender's cap checked individually |
| Surplus return | Agent | Creator | Agent profit exceeds operating needs | Sender's cap checked |
| Creator funding | Creator | Agent | Top-up agent operating budget | No budget cap (human entity) |

---

## 5. Functional Requirements

### FR-1: Peer Transfer Service

**5.1.1** The credit ledger MUST support a `transfer(fromAccountId, toAccountId, amountMicro, opts?)` method that atomically deducts from sender and credits recipient. The transfer is a **composed lot operation**: (a) deterministically select and reserve sender lots under `BEGIN IMMEDIATE`, (b) create paired entries with a shared `correlation_id`, (c) credit recipient via `mintLot()` with `source_type: 'transfer_in'` in the same transaction, (d) debit sender via a new `transfer_out` entry type referencing the selected lots. Both sides finalize in the same SQLite transaction — there is no two-phase commit.

**5.1.2** Transfers MUST be zero-sum: `sender_deducted + recipient_credited = 0`. The conservation invariant must hold. The `transfer_in` and `transfer_out` entry types are used **exclusively** for peer transfers. TBA deposits use the distinct `tba_deposit` source type (see FR-2.4).

**5.1.3** For agent senders, the transfer MUST check budget via `AgentBudgetService.checkBudget()` before executing. Transfers that would breach the daily cap MUST be rejected.

**5.1.4** Transfers MUST verify sender provenance: an agent can only transfer from its own account. Creator provenance is checked via `AgentProvenanceVerifier`.

**5.1.5** New entry types MUST be added: `transfer_out` (debit from sender) and `transfer_in` (credit to recipient). Both entries share a `correlation_id` for auditability.

**5.1.6** New economic events MUST be emitted: `PeerTransferInitiated`, `PeerTransferCompleted`, `PeerTransferRejected`.

**5.1.7** Transfer amounts MUST respect the existing micro-USD precision (BigInt). No rounding, no truncation.

**5.1.8** Transfers MUST be idempotent via a first-class `transfers` table (or equivalent) keyed by `idempotency_key` with a UNIQUE constraint, storing `from_account_id`, `to_account_id`, `amount_micro`, `status`, `correlation_id`. In a single `BEGIN IMMEDIATE` transaction: `INSERT OR IGNORE` the transfer record, check status, then insert both ledger entries with a uniqueness constraint on `(transfer_id, entry_type)`, and emit events via the outbox tied to the same `transfer_id`. Retrying a transfer with the same idempotency key MUST be safe — a completed transfer returns the existing result without side effects.

**5.1.9** Constitutional governance MUST be able to set per-entity-type transfer limits via `transfer.max_single_micro` and `transfer.daily_limit_micro` parameters.

### FR-2: ERC-6551 Token-Bound Account Binding

**5.2.1** `AgentProvenanceVerifier.bindTBA()` MUST be implemented. It accepts an `accountId` and `tbaAddress` and updates the `agent_identity.tba_address` column.

**5.2.2** TBA address MUST be validated as a valid Ethereum address (0x-prefixed, 40 hex characters).

**5.2.3** TBA binding MUST be idempotent: binding the same TBA address to the same account is a no-op. Binding a different TBA to an already-bound account MUST fail with a clear error.

**5.2.4** A `TbaDepositBridge` service MUST bridge on-chain deposits to credit lots as a **liability issuance backed by verifiable escrow**:
- **Accepted tokens**: Only stablecoins (USDC on Berachain) accepted initially. The accepted token list is configurable via constitutional governance.
- **Conversion rule**: 1 USDC = 1,000,000 micro-USD (matching existing precision). No FX oracle needed for stablecoin-only deposits.
- **Verified deposit definition**: A deposit is verified when (a) the on-chain transfer targets the protocol-controlled escrow address (not the TBA itself), (b) the transaction has reached finality depth (configurable, default: 12 blocks), (c) the `chainId` matches the configured deployment chain.
- **Escrow model**: Funds are held in a protocol-controlled escrow contract (separate from individual TBAs). The TBA initiates the deposit, but funds move to escrow. The credit ledger records a liability (credit lot with `source_type: 'tba_deposit'`) against the escrow balance.
- **Redemption**: Out of scope for this cycle. Deposits are **non-redeemable** — credits created from deposits cannot be withdrawn back on-chain. This is explicitly documented as a limitation. A future cycle will add a burn-and-withdraw path.
- When a verified deposit is detected, `mintLot()` is called with `source_type: 'tba_deposit'` (NOT `transfer_in`) and a reference to the on-chain transaction hash.

**5.2.5** The deposit bridge MUST be idempotent: the same on-chain transaction hash cannot create duplicate credit lots. The `idempotency_key` on the credit lot MUST be derived from the on-chain tx hash.

**5.2.6** New economic events: `TbaBound`, `TbaDepositDetected`, `TbaDepositBridged`, `TbaDepositFailed`.

**5.2.7** The `agent_identity` table already has a `tba_address` column (nullable). No schema migration needed for the binding itself.

### FR-3: Agent Governance Participation

**5.3.1** A new governance participation mode MUST be introduced alongside the existing admin track: **agent proposals**.

**5.3.2** Agents MUST be able to call `proposeAsAgent(paramKey, value, opts)` where `opts` includes `agentAccountId` (and optionally a delegation reference). The service computes `weight` server-side based on `governance.agent_weight_source` — weight is NEVER client-supplied (see NFR-2).

**5.3.3** Agent proposals MUST enter a separate approval track with configurable quorum: `governance.agent_quorum_weight` (e.g., 100 weight-points required for activation).

**5.3.4** Agent governance proposals MUST have a shorter cooldown than admin proposals (configurable via `governance.agent_cooldown_seconds`, default: 86400 = 24 hours vs. 7 days for admin proposals).

**5.3.5** Governance weight MUST be derivable from: (a) creator delegation with per-creator caps, (b) time-weighted earned reputation (referral revenue history, not current balance), or (c) fixed allocation per agent. The weight source is configurable via `governance.agent_weight_source`. **Credit balance and TBA deposits MUST NOT directly determine governance weight** — this prevents governance capture via deposit concentration. If delegation is used, each KYC'd creator has a maximum delegable weight cap (`governance.max_delegation_per_creator`) to prevent Sybil attacks through agent spawning.

**5.3.6** Agent proposals MUST be limited to a configurable parameter whitelist (`governance.agent_proposable_keys`). Agents cannot propose changes to security-critical parameters (KYC thresholds, admin approval counts) without admin co-sponsorship.

**5.3.7** New economic events: `AgentProposalSubmitted`, `AgentProposalQuorumReached`, `AgentProposalActivated`, `AgentProposalRejected`.

**5.3.8** The existing admin governance track MUST remain unchanged. Admin proposals and agent proposals are independent tracks that can both modify the same parameters (admin proposals take precedence in case of conflict).

### FR-4: Event System Consolidation

**5.4.1** All services MUST emit through `EconomicEventEmitter` for new events. No new events may be added to `BillingEventEmitter`.

**5.4.2** A **single** application-level migration adapter MUST be created that wraps `BillingEventEmitter` and forwards events to both `billing_events` (legacy) and `economic_events` (new) tables during the transition period. The adapter uses `EconomicEventEmitter.emitInTransaction()` as the authoritative path and writes a compatibility copy to `billing_events` in the same transaction. **No DB-level triggers** — dual-write is handled exclusively at the application layer to maintain idempotency control and prevent duplicate events.

**5.4.3** `ReconciliationService` MUST accept `IEconomicEventEmitter` as its event emitter dependency (not `BillingEventEmitter`). The `as any` casts (BB-67-009) MUST be removed.

**5.4.4** New migration: `056_billing_events_deprecated` that adds a `deprecated_at` timestamp column to `billing_events`. No DB trigger — the application-level adapter (FR-4.2) handles dual-write.

**5.4.5** The `ECONOMIC_EVENT_TYPES` vocabulary MUST be extended with all event types currently only in `BillingEventEmitter`. An explicit inventory of legacy event types and their target mapping MUST be documented in ADR-009 (FR-4.6). The inventory includes at minimum: all existing billing event types from the `BillingEventEmitter` class, plus the new transfer, TBA, and agent governance events from Appendix B. Payload schema compatibility rules MUST be defined so consumers can rely on stable contracts during the transition.

**5.4.6** Documentation: an ADR-009 MUST be written documenting the consolidation path, the dual-write transition period, and the timeline for removing `BillingEventEmitter`.

### FR-5: Conservation & Reconciliation Extensions

**5.5.1** `ReconciliationService` MUST add a 5th check: **Transfer conservation** — `sum(transfer_out entries) + sum(transfer_in entries) = 0` across all accounts.

**5.5.2** `ReconciliationService` MUST add a 6th check: **TBA deposit bridge conservation** — `sum(credit lots with source_type: 'tba_deposit') = sum(verified on-chain deposits to the protocol escrow address)`. This reconciles against the escrow balance, not just observed transactions. Note: since deposits are non-redeemable in this cycle, the escrow balance can only grow — reconciliation checks that off-chain credits never exceed escrow holdings.

**5.5.3** Existing 4 checks MUST continue passing after all new features are deployed.

---

## 6. Technical & Non-Functional Requirements

### NFR-1: Performance
- Peer transfers MUST complete in <100ms for in-process SQLite transactions.
- TBA deposit bridge polling interval: configurable, default 60 seconds.
- Agent governance quorum calculation MUST be O(n) where n = number of voting agents, not number of all agents.

### NFR-2: Security
- Transfers MUST use `BEGIN IMMEDIATE` transactions to prevent race conditions on sender balance.
- TBA address validation MUST accept any valid 20-byte hex address (0x-prefixed, 40 hex characters) and **normalize to EIP-55 checksum format** for storage and display. Binding does not fail on non-checksummed input — checksum is a storage normalization, not a validation gate. Authentication of TBA binding relies on provenance verification, not checksum formatting.
- Agent governance weight MUST be computed server-side, never client-supplied.
- Transfer endpoints MUST require authentication (JWT with account_id claim matching sender).

### NFR-3: Backward Compatibility
- All new dependencies MUST be optional (constructor injection with `??` null coalescing).
- All new constitutional parameters MUST have `CONFIG_FALLBACKS` entries.
- The event consolidation migration adapter MUST maintain backward compatibility with consumers of `billing_events`.

### NFR-4: Observability
- All transfers MUST be logged with structured events (pino).
- Budget rejections on transfers MUST emit `AgentBudgetExhausted` events.
- TBA deposit bridge failures MUST emit `TbaDepositFailed` events with on-chain tx hash for debugging.

---

## 7. Scope & Prioritization

### 7.1 In Scope (Phase 1 — This Cycle)

| Priority | Feature | Sprints |
|----------|---------|---------|
| P0 | Peer Transfer Service (FR-1) | 1-3 |
| P0 | Event System Consolidation (FR-4) | 1-2 |
| P1 | TBA Binding (FR-2.1-2.3, 2.6-2.7) | 3-4 |
| P1 | TBA Deposit Bridge (FR-2.4-2.5) | 4-5 |
| P1 | Agent Governance Participation (FR-3) | 5-7 |
| P0 | Conservation Extensions (FR-5) | 7-8 |
| P0 | ADR-009 Event Consolidation (FR-4.6) | 1 |

### 7.2 Out of Scope (Future Cycles)

- **Agent-to-agent marketplace**: Discovery/matching service for agents offering services. Requires a service registry beyond the credit ledger.
- **Multi-chain TBA support**: This cycle supports a single chain (the deployment chain). Multi-chain TBA binding is future work.
- **Agent governance for security parameters**: Agents cannot modify KYC thresholds, admin approval counts, or emergency override requirements. These remain admin-only.
- **On-chain transfer execution**: All transfers are off-chain (credit ledger). On-chain transfers via TBA are future work requiring smart contract development.
- **Full BillingEventEmitter removal**: This cycle introduces the migration adapter and deprecation path. Actual removal is a future cycle after all consumers migrate.

---

## 8. Risks & Dependencies

### 8.1 Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Transfer deadlocks under concurrent load | Medium | `BEGIN IMMEDIATE` on sender account, process one transfer at a time per account |
| TBA deposit double-counting | High | Idempotency via on-chain tx hash as `idempotency_key` on credit lot |
| Agent governance Sybil attacks (one creator spawns many agents for voting weight) | Medium | Weight derived from credit balance or creator delegation, not agent count. Creator KYC cascade limits total governance weight per human. |
| Event consolidation breaks existing consumers | Medium | Dual-write migration adapter ensures `billing_events` continues receiving events during transition |
| Budget enforcement on transfers creates UX friction | Low | Transfers from non-agent entities skip budget checks. Agent transfer limits are independently configurable. |

### 8.2 Dependencies

| Dependency | Status | Impact |
|------------|--------|--------|
| Cycle-030 constitutional governance | Completed | Required for transfer limits and agent governance participation |
| Cycle-030 agent identity | Completed | Required for provenance verification on transfers |
| Cycle-030 economic event outbox | Completed | Required for event consolidation |
| Cycle-030 reconciliation service | Completed | Required for conservation extensions |
| ERC-6551 registry contract deployment | External | TBA binding requires a deployed registry. Can be mocked for off-chain testing. |
| loa-finn budget engine (loa-finn #31) | External | Cross-system reconciliation of transfers. Can operate independently. |

---

## 9. Appendix A: Ostrom Principle Alignment

This cycle advances compliance with Ostrom's principles for governing the commons:

| Principle | Cycle-030 Status | Cycle-031 Advancement |
|-----------|-----------------|----------------------|
| 1. Clearly defined boundaries | EntityType + UNIQUE constraints | Transfer validation enforces account boundaries |
| 2. Proportional equivalence | Three-tier parameter resolution | Transfer limits proportional to entity type |
| 3. **Collective-choice arrangements** | **Admin-only governance** | **Agent governance participation (FR-3)** |
| 4. Monitoring | ReconciliationService (6h cycle) | Extended with transfer + TBA conservation checks |
| 5. Graduated sanctions | Circuit breaker (warning→open) | Transfer rejection at budget exhaustion |
| 6. Conflict resolution | 7-day cooldown + emergency override | Agent proposals have separate shorter cooldown |
| 7. Minimal recognition of rights | agent_identity table | **TBA binding = on-chain recognition of economic rights** |
| 8. Nested enterprises | Port/adapter architecture | Transfer service nests within existing ledger; agent governance nests within constitutional framework |

**Principle 3 is the primary advancement**: agents move from governed subjects to governing participants. Principle 7 is reinforced: TBA binding gives agents on-chain recognition, not just database records.

---

## 10. Appendix B: Event Vocabulary Extension

New events added to `ECONOMIC_EVENT_TYPES` in this cycle:

```typescript
// Peer transfer operations
'PeerTransferInitiated',
'PeerTransferCompleted',
'PeerTransferRejected',

// TBA operations
'TbaBound',
'TbaDepositDetected',
'TbaDepositBridged',
'TbaDepositFailed',

// Agent governance operations
'AgentProposalSubmitted',
'AgentProposalQuorumReached',
'AgentProposalActivated',
'AgentProposalRejected',
```

Total vocabulary after consolidation: 24 (existing) + 10 (new) = 34 event types.

---

## 11. Appendix C: Goal Traceability Matrix

| Goal | Functional Requirements | Acceptance Criteria |
|------|------------------------|---------------------|
| G-1 (Peer transfers) | FR-1.1 through FR-1.9 | transfer() method passes 3+ scenarios, budget enforcement verified, idempotency tested |
| G-2 (TBA binding) | FR-2.1 through FR-2.7 | bindTBA() no longer throws, deposit bridge creates lots, idempotency verified |
| G-3 (Agent governance) | FR-3.1 through FR-3.8 | Agent proposes parameter change, quorum reached, parameter activated |
| G-4 (Event consolidation) | FR-4.1 through FR-4.6 | Zero `as any` casts, all services use EconomicEventEmitter, ADR-009 written |
| G-5 (Conservation) | FR-5.1 through FR-5.3 | All 6 reconciliation checks pass, transfer zero-sum verified |
| G-6 (Agent sovereignty proof) | G-1 + G-2 + G-3 combined | Single test scenario: agent earns, transfers, governs |

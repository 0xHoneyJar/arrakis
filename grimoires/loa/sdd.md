# SDD: The Spacing Guild — Agent Economic Sovereignty & Peer Commerce

**Version:** 1.0.0
**Date:** 2026-02-16
**Status:** Draft
**PRD:** `grimoires/loa/prd.md` v1.0.0 (GPT-5.2 APPROVED iteration 2)
**Cycle:** cycle-031
**Predecessor:** cycle-030 SDD (archived: `grimoires/loa/archive/2026-02-16-kwisatz-haderach-complete/sdd.md`)

---

## 1. Executive Summary

This SDD designs the technical architecture for completing agent economic sovereignty. It extends the cycle-030 infrastructure (constitutional governance, agent budget engine, economic event outbox, reconciliation service) with five new subsystems:

1. **Peer Transfer Service** — atomic credit transfers between accounts with budget enforcement and conservation guarantees
2. **TBA Binding & Deposit Bridge** — ERC-6551 Token-Bound Account binding with escrow-backed deposit bridging
3. **Agent Governance Participation** — weighted agent proposals via a separate approval track with configurable quorum
4. **Event Consolidation Adapter** — single-path migration from `BillingEventEmitter` to `EconomicEventEmitter`
5. **Conservation Extensions** — two new reconciliation checks (transfer zero-sum, deposit bridge conservation)

All monetary operations use BigInt micro-USD (existing `CreditLedgerAdapter` precision). No new databases — extends SQLite (authoritative) + Redis (cache/acceleration). No existing interfaces are broken — all new dependencies use optional constructor injection.

> Grounded in: `ICreditLedgerService.ts`, `IConstitutionalGovernanceService.ts`, `AgentProvenanceVerifier.ts`, `EconomicEventEmitter.ts`, `AgentAwareFinalizer.ts`, `AgentBudgetService.ts`, `ReconciliationService.ts`, `billing-types.ts`, `economic-events.ts`, `config-schema.ts`, `BillingEventEmitter.ts`, migrations 030-055.

---

## 2. System Architecture

### 2.1 Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          API Layer (Express)                              │
│  /api/transfer/*  /api/agent/tba/*  /api/agent/governance/*               │
│  /api/admin/config/*  /api/reconciliation/*                               │
└─────┬───────────────────┬───────────────────┬──────────────────┬─────────┘
      │                   │                   │                  │
┌─────▼──────────┐ ┌──────▼──────────┐ ┌──────▼──────────┐ ┌────▼────────────┐
│  PeerTransfer  │ │  TbaDeposit     │ │  AgentGovern-   │ │  Reconciliation │
│  Service       │ │  Bridge         │ │  anceService    │ │  Service (ext)  │
│                │ │                 │ │                 │ │                 │
│ - transfer()   │ │ - detectDeposit │ │ - proposeAs-    │ │ - 6 checks      │
│ - getTransfer  │ │ - bridgeDeposit │ │   Agent()       │ │ - transfer cons │
│ - listHistory  │ │ - verifyEscrow  │ │ - voteAsAgent() │ │ - deposit cons  │
└─────┬──────────┘ └──────┬──────────┘ │ - computeWeight │ └────┬────────────┘
      │                   │            └──────┬──────────┘      │
┌─────▼───────────────────▼───────────────────▼─────────────────▼──────────┐
│                      Existing Billing Layer (cycle-030)                    │
│                                                                           │
│  ICreditLedgerService  │  AgentBudgetService  │  AgentProvenanceVerifier  │
│  (reserve/finalize/    │  (checkBudget/       │  (registerAgent/verify/   │
│   mintLot)             │   recordFinalize)     │   bindTBA ← IMPLEMENT)   │
│                        │                      │                           │
│  SettlementService     │  ConstitutionalGov   │  EventConsolidation      │
│  (unchanged)           │  Service (EXTENDED)   │  Adapter (NEW)           │
└─────┬───────────────────┬──────────────────────┬─────────────────────────┘
      │                   │                      │
┌─────▼─────┐  ┌──────────▼────────┐  ┌──────────▼──────────────┐
│  SQLite   │  │     Redis         │  │  EconomicEventEmitter   │
│ (author.) │  │  (cache/advisory) │  │  (authoritative outbox) │
└───────────┘  └───────────────────┘  └─────────────────────────┘
```

### 2.2 Extension Strategy

**No existing interfaces are broken.** New services compose existing ports:

| Existing Port | How Extended |
|---------------|-------------|
| `ICreditLedgerService` | Unchanged. `PeerTransferService` composes `mintLot()` + new `transfer_out` entry type in same tx. |
| `IConstitutionalGovernanceService` | Extended with `proposeAsAgent()`, `voteAsAgent()`, `computeAgentWeight()`. New methods — existing methods unchanged. |
| `AgentProvenanceVerifier` | `bindTBA()` implemented (was `NotImplementedError`). `verifyProvenance()` enhanced to check TBA status. |
| `AgentBudgetService` | Unchanged. `PeerTransferService` calls `checkBudget()` before transfer execution. |
| `EconomicEventEmitter` | Unchanged. All new events emitted through existing `emitInTransaction()`. |
| `BillingEventEmitter` | Wrapped by `EventConsolidationAdapter` for dual-write. Not modified directly. |
| `ReconciliationService` | Extended with 2 new checks (transfer conservation, deposit bridge conservation). |
| `billing-types.ts` | Extended: new `EntryType` values (`transfer_out`), new `SourceType` value (`tba_deposit`). Additive only. |
| `economic-events.ts` | Extended: 10 new event types added to `ECONOMIC_EVENT_TYPES`. Additive only. |
| `config-schema.ts` | Extended: 5 new parameters added to `CONFIG_SCHEMA` and `CONFIG_FALLBACKS`. |

### 2.3 Key Design Principles

1. **Conservation invariant extended**: Transfer is zero-sum (sender deducted = recipient credited). Deposit bridge is backed by verifiable escrow. No new phantom money paths.
2. **Entity-type agnosticism maintained**: The credit ledger remains entity-type agnostic. Transfer budget enforcement and governance weight computation happen in the policy layer above the ledger.
3. **Compile-time fallback**: Every new configurable parameter has a `CONFIG_FALLBACKS` entry.
4. **Single dual-write path**: Event consolidation uses one mechanism (application-level adapter), not a mix of app-level and DB triggers.
5. **Composed atomic operations**: Transfer follows the `AgentAwareFinalizer` pattern — wrapping multiple adapter calls in a single `BEGIN IMMEDIATE` SQLite transaction.

---

## 3. Data Architecture

### 3.1 New Tables

#### 3.1.1 `transfers`

First-class transfer records for idempotency and auditability.

```sql
-- Migration: 056_peer_transfers.ts
CREATE TABLE transfers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  idempotency_key TEXT NOT NULL UNIQUE,
  from_account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  to_account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  amount_micro INTEGER NOT NULL CHECK (amount_micro > 0),
  correlation_id TEXT NOT NULL,       -- Shared between debit/credit entries
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'rejected')),
  rejection_reason TEXT,              -- If rejected: 'budget_exceeded', 'provenance_failed', etc.
  metadata TEXT,                      -- JSON: purpose, service payment ref, etc.
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);

-- Fast lookup by account (sender or recipient)
CREATE INDEX idx_transfers_from ON transfers(from_account_id, created_at);
CREATE INDEX idx_transfers_to ON transfers(to_account_id, created_at);

-- Status queries (e.g., pending transfers for display)
CREATE INDEX idx_transfers_status ON transfers(status, created_at);
```

#### 3.1.2 `tba_deposits`

On-chain deposit tracking for escrow reconciliation.

```sql
-- Migration: 057_tba_deposits.ts
CREATE TABLE tba_deposits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  agent_account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  chain_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,         -- On-chain transaction hash (idempotency)
  token_address TEXT NOT NULL,          -- Deposited token (e.g., USDC contract)
  amount_raw TEXT NOT NULL,             -- Raw token amount (string for arbitrary precision)
  amount_micro INTEGER NOT NULL,        -- Converted to micro-USD
  lot_id TEXT REFERENCES credit_lots(id), -- Created credit lot
  escrow_address TEXT NOT NULL,         -- Protocol-controlled escrow contract
  block_number INTEGER NOT NULL,
  finality_confirmed INTEGER NOT NULL DEFAULT 0, -- 0 = pending, 1 = confirmed
  status TEXT NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'confirmed', 'bridged', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  bridged_at TEXT
);

CREATE INDEX idx_tba_deposits_agent ON tba_deposits(agent_account_id, created_at);
CREATE INDEX idx_tba_deposits_status ON tba_deposits(status);
```

#### 3.1.3 `agent_governance_proposals`

Agent-track governance proposals with weighted voting.

```sql
-- Migration: 058_agent_governance.ts
CREATE TABLE agent_governance_proposals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  param_key TEXT NOT NULL,
  entity_type TEXT,                     -- NULL = global, 'agent' = agent-specific
  proposed_value_json TEXT NOT NULL,
  proposer_account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  proposer_weight INTEGER NOT NULL,     -- Computed server-side at proposal time
  total_weight INTEGER NOT NULL DEFAULT 0, -- Accumulated vote weight
  required_weight INTEGER NOT NULL,     -- Quorum threshold (from governance.agent_quorum_weight)
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'quorum_reached', 'activated', 'rejected', 'expired', 'admin_overridden')),
  cooldown_ends_at TEXT,
  activated_at TEXT,
  expires_at TEXT NOT NULL,             -- Proposals expire if quorum not reached
  config_id TEXT REFERENCES system_config(id), -- Created system_config entry on activation
  metadata TEXT,                        -- JSON: justification, delegation refs
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Only one open proposal per (param_key, entity_type)
CREATE UNIQUE INDEX idx_agent_proposals_active
  ON agent_governance_proposals(param_key, entity_type) WHERE status = 'open';

CREATE INDEX idx_agent_proposals_status ON agent_governance_proposals(status, expires_at);
```

#### 3.1.4 `agent_governance_votes`

Individual agent votes on proposals.

```sql
CREATE TABLE agent_governance_votes (
  proposal_id TEXT NOT NULL REFERENCES agent_governance_proposals(id),
  voter_account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  weight INTEGER NOT NULL,              -- Computed server-side
  vote TEXT NOT NULL CHECK (vote IN ('support', 'oppose')),
  delegation_ref TEXT,                  -- If voting via delegation, reference to delegation
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (proposal_id, voter_account_id)
);
```

### 3.2 Modified Tables

#### `credit_lots` — New source_type

```sql
-- Add 'tba_deposit' to source_type CHECK constraint
-- Migration 056 alters: CHECK (source_type IN ('deposit','grant','purchase','transfer_in','commons_dividend','tba_deposit'))
```

#### `credit_ledger` (ledger_entries) — New entry_types

```sql
-- Add 'transfer_out' and 'transfer_in' to entry_type CHECK constraint
-- Migration 056 alters: existing CHECK + 'transfer_out', 'transfer_in'
```

#### `billing_events` — Deprecation marker

```sql
-- Migration 059_billing_events_deprecated.ts
ALTER TABLE billing_events ADD COLUMN deprecated_at TEXT;
-- No trigger. Dual-write handled at application level.
```

### 3.3 New Constitutional Parameters

```typescript
// Added to CONFIG_SCHEMA in config-schema.ts
'transfer.max_single_micro':      { type: 'bigint_micro', min: 0n, description: 'Max single transfer amount' }
'transfer.daily_limit_micro':     { type: 'bigint_micro', min: 0n, description: 'Max daily transfer volume per account' }
'governance.agent_quorum_weight':  { type: 'integer', min: 1, max: 10000, description: 'Weight required for agent proposal activation' }
'governance.agent_cooldown_seconds': { type: 'integer_seconds', min: 0, max: 604800, description: 'Agent proposal cooldown' }
'governance.max_delegation_per_creator': { type: 'integer', min: 1, max: 1000, description: 'Max governance weight delegable per creator' }

// Added to CONFIG_FALLBACKS
'transfer.max_single_micro':       100_000_000n,   // 100 USD
'transfer.daily_limit_micro':      500_000_000n,   // 500 USD per day
'governance.agent_quorum_weight':   100,            // 100 weight-points
'governance.agent_cooldown_seconds': 86400,         // 24 hours (vs 7 days for admin)
'governance.max_delegation_per_creator': 100         // Max 100 weight per creator
```

### 3.4 New Economic Event Types

```typescript
// Added to ECONOMIC_EVENT_TYPES in economic-events.ts
// Peer transfers
'PeerTransferInitiated',    // Transfer record created, budget checked
'PeerTransferCompleted',    // Both entries written, lots adjusted
'PeerTransferRejected',     // Budget exceeded, provenance failed, etc.

// TBA operations
'TbaBound',                 // TBA address bound to agent identity
'TbaDepositDetected',       // On-chain deposit observed
'TbaDepositBridged',        // Deposit bridged to credit lot
'TbaDepositFailed',         // Bridge failed (finality, validation, etc.)

// Agent governance
'AgentProposalSubmitted',   // Agent created proposal
'AgentProposalQuorumReached', // Total weight ≥ required weight
'AgentProposalActivated',   // Cooldown complete, config active
'AgentProposalRejected',    // Admin override or expiry
```

Total vocabulary: 29 (existing) + 10 (new) = 39 event types.

---

## 4. Component Design

### 4.1 PeerTransferService

**File**: `themes/sietch/src/packages/adapters/billing/PeerTransferService.ts`
**Port**: `themes/sietch/src/packages/core/ports/IPeerTransferService.ts`

#### 4.1.1 Interface

```typescript
interface TransferOptions {
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

interface TransferResult {
  transferId: string;
  fromAccountId: string;
  toAccountId: string;
  amountMicro: bigint;
  status: 'completed' | 'rejected';
  rejectionReason?: string;
  correlationId: string;
  completedAt?: string;
}

interface IPeerTransferService {
  transfer(fromAccountId: string, toAccountId: string, amountMicro: bigint, opts: TransferOptions): Promise<TransferResult>;
  getTransfer(transferId: string): Promise<TransferResult | null>;
  getTransferByIdempotencyKey(key: string): Promise<TransferResult | null>;
  listTransfers(accountId: string, options?: { limit?: number; offset?: number; direction?: 'sent' | 'received' | 'all' }): Promise<TransferResult[]>;
}
```

#### 4.1.2 Transfer Algorithm

**Critical conservation design**: Transfers use a **lot-split** operation, not mint. The sender lot's `original_micro` is reduced by the transfer amount, and a new recipient lot is created with `original_micro` equal to that amount. This preserves total `original_micro` across all lots (zero-sum at the lot level, not just the ledger entry level).

```
transfer(fromAccountId, toAccountId, amountMicro, opts):
  1. BEGIN IMMEDIATE transaction:

     a. SELECT transfer by idempotency_key
        → If exists and completed: COMMIT, return existing result (idempotent)
        → If exists and rejected: COMMIT, return rejection (idempotent)
        → If not exists: INSERT transfer record with status='pending'

     b. Validate: fromAccountId ≠ toAccountId

     c. Verify sender provenance (agent senders only):
        → AgentProvenanceVerifier.verifyProvenance(fromAccountId)
        → If agent: check budget via AgentBudgetService.checkBudget()
        → If budget exceeded: UPDATE transfers SET status='rejected',
          emit PeerTransferRejected via emitInTransaction, COMMIT, return

     d. Check governance limits (in-transaction resolution):
        → governance.resolveInTransaction(tx, 'transfer.max_single_micro', senderEntityType)
        → governance.resolveInTransaction(tx, 'transfer.daily_limit_micro', senderEntityType)
        → If exceeded: reject with reason, COMMIT, return

     e. Select sender lots (FIFO: pool-restricted → expiring → oldest)
        → If total available < amountMicro: reject INSUFFICIENT_BALANCE, COMMIT, return

     f. LOT-SPLIT operation (conservation-preserving):
        For each selected sender lot:
          i.  Reduce lot's available_micro by split amount
          ii. Reduce lot's original_micro by split amount
          — Lot invariant preserved: (available-X) + reserved + consumed = (original-X)

     g. Create recipient lot:
        INSERT credit_lot: source_type='transfer_in', original_micro=amountMicro,
          available_micro=amountMicro, reserved=0, consumed=0,
          source_id=transfer_id (for traceability)
        — Global lot conservation: sender original decreased, recipient original increased by same amount

     h. INSERT ledger_entry: entry_type='transfer_out', amount_micro=-amountMicro,
        correlation_id, idempotency_key=(transfer_id + '_out')
     i. INSERT ledger_entry: entry_type='transfer_in', amount_micro=+amountMicro,
        correlation_id, idempotency_key=(transfer_id + '_in')

     j. If agent sender: budgetService.recordFinalizationInTransaction(tx, accountId, amountMicro)

     k. UPDATE transfers SET status='completed', completed_at=now()

     l. economicEventEmitter.emitInTransaction(tx, PeerTransferCompleted)

  2. COMMIT

  3. If agent sender: invalidate Redis budget cache (async, non-blocking)

  4. Return TransferResult
```

**Why lot-split, not mint**: A naive `mintLot()` on the recipient creates new `original_micro` without destroying sender `original_micro`, inflating total supply. The lot-split approach reduces sender `original_micro` and creates recipient `original_micro` by the same amount — total `SUM(original_micro)` across all lots is unchanged by transfers.

#### 4.1.3 Lot Selection Strategy

FIFO (First-In-First-Out): oldest money moves first. This matches the existing `reserve()` lot selection in `ICreditLedgerService`:

1. Filter lots by sender's account_id
2. Exclude lots with pool restrictions that don't match (if applicable)
3. Order by: expires_at ASC NULLS LAST, created_at ASC
4. Iterate lots, deducting from `available_micro` until transfer amount is fully sourced
5. If total available < transfer amount: reject with `INSUFFICIENT_BALANCE`

#### 4.1.4 Constructor (DI)

```typescript
class PeerTransferService implements IPeerTransferService {
  constructor(
    private readonly db: Database.Database,
    private readonly ledger: ICreditLedgerService,
    private readonly budgetService?: AgentBudgetService,      // Optional
    private readonly provenance?: AgentProvenanceVerifier,    // Optional
    private readonly governance?: IConstitutionalGovernanceService, // Optional
    private readonly eventEmitter?: IEconomicEventEmitter     // Optional
  ) {}
}
```

### 4.2 TBA Binding (AgentProvenanceVerifier Extension)

**File**: `themes/sietch/src/packages/adapters/billing/AgentProvenanceVerifier.ts` (modified)

#### 4.2.1 bindTBA Implementation

```typescript
bindTBA(accountId: string, tbaAddress: string): Promise<AgentIdentity> {
  // 1. Validate address: 0x-prefixed, 40 hex characters
  // 2. Normalize to EIP-55 checksum format for storage
  // 3. Check agent_identity exists for accountId
  // 4. Check tba_address is NULL (not already bound)
  //    → If same address already bound: return existing (idempotent)
  //    → If different address already bound: throw CONFLICT (409)
  // 5. UPDATE agent_identity SET tba_address = normalizedAddress WHERE account_id = accountId
  // 6. Emit TbaBound event via EconomicEventEmitter
  // 7. Return updated AgentIdentity
}
```

#### 4.2.2 EIP-55 Address Normalization

```typescript
function normalizeAddress(address: string): string {
  // Accept: 0x + 40 hex chars (case-insensitive)
  // Normalize: apply EIP-55 checksum encoding
  // Return: checksummed address
  // This is a storage normalization, not a validation gate
}
```

### 4.3 TbaDepositBridge

**File**: `themes/sietch/src/packages/adapters/billing/TbaDepositBridge.ts`
**Port**: `themes/sietch/src/packages/core/ports/ITbaDepositBridge.ts`

#### 4.3.1 Interface

```typescript
interface DepositDetection {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  amountRaw: string;          // Raw token amount
  fromAddress: string;        // TBA address
  toAddress: string;          // Escrow address
  blockNumber: number;
}

interface DepositBridgeResult {
  depositId: string;
  lotId: string;
  amountMicro: bigint;
  status: 'bridged' | 'failed';
  error?: string;
}

interface ITbaDepositBridge {
  detectAndBridge(detection: DepositDetection): Promise<DepositBridgeResult>;
  getDeposit(txHash: string): Promise<TbaDeposit | null>;
  listDeposits(agentAccountId: string, options?: { limit?: number }): Promise<TbaDeposit[]>;
  verifyEscrowBalance(chainId: number): Promise<{ escrowBalance: bigint; creditedBalance: bigint; delta: bigint }>;
}
```

#### 4.3.2 Bridge Algorithm

```
detectAndBridge(detection):
  1. Validate detection.toAddress matches configured escrow address
  2. Validate detection.chainId matches configured deployment chain
  3. Validate detection.tokenAddress is in accepted token list

  4. INSERT OR IGNORE into tba_deposits with tx_hash as unique key
     → If already exists and bridged: return existing result (idempotent)
     → If already exists and failed: allow retry

  5. ON-CHAIN VERIFICATION (MANDATORY before any minting):
     a. Fetch transaction receipt via RPC: eth_getTransactionReceipt(detection.txHash)
     b. Verify receipt.status === 1 (success)
     c. Verify receipt.blockNumber matches detection.blockNumber
     d. Parse ERC-20 Transfer log from receipt.logs:
        - Verify log topic matches Transfer(address,address,uint256)
        - Verify log.from matches detection.fromAddress (TBA)
        - Verify log.to matches configured escrow address
        - Verify log.amount matches detection.amountRaw
        - Verify log.address matches detection.tokenAddress
     e. Verify finality: receipt.blockNumber + finality_depth ≤ current block
        → If not confirmed: UPDATE status='detected', return pending
     f. Persist hash of verified receipt + log index in tba_deposits.metadata
        for audit trail

  6. Convert amount: amountRaw → amountMicro (1 USDC = 1,000,000 micro-USD)

  7. Find agent account via TBA address:
     → SELECT account_id FROM agent_identity WHERE tba_address = detection.fromAddress
     → If not found: reject (TBA not bound), emit TbaDepositFailed

  8. BEGIN IMMEDIATE transaction:
     a. ledger.mintLot(agentAccountId, amountMicro, 'tba_deposit', { sourceId: txHash })
     b. UPDATE tba_deposits SET status='bridged', lot_id=lot.id, bridged_at=now(),
        finality_confirmed=1
     c. economicEventEmitter.emitInTransaction(tx, TbaDepositBridged)
  9. COMMIT

  10. Return DepositBridgeResult
```

**Security note**: On-chain verification (step 5) is mandatory. The bridge NEVER mints credits based solely on webhook/listener data. Even if the internal endpoint is compromised, fabricated detections without matching on-chain receipts are rejected. This is the equivalent of Stripe's "verify webhook signature before processing" pattern, but for on-chain data.

#### 4.3.3 Escrow Configuration

```typescript
interface TbaDepositBridgeConfig {
  escrowAddress: string;                // Protocol-controlled escrow contract
  chainId: number;                      // Deployment chain
  acceptedTokens: string[];             // Token contract addresses (USDC initially)
  finalityDepth: number;                // Block confirmations required (default: 12)
  pollingIntervalSeconds: number;       // How often to check for deposits (default: 60)
  conversionRates: Record<string, bigint>; // Token address → micro-USD per raw unit
}
```

### 4.4 AgentGovernanceService

**File**: `themes/sietch/src/packages/adapters/billing/AgentGovernanceService.ts`
**Port**: `themes/sietch/src/packages/core/ports/IAgentGovernanceService.ts`

#### 4.4.1 Interface

```typescript
interface AgentProposalOptions {
  agentAccountId: string;
  delegationRef?: string;               // If voting via delegation
  justification?: string;
}

interface AgentVoteOptions {
  agentAccountId: string;
  vote: 'support' | 'oppose';
  delegationRef?: string;
}

interface AgentGovernanceWeightResult {
  accountId: string;
  weight: number;
  source: 'delegation' | 'earned_reputation' | 'fixed_allocation';
  details: Record<string, unknown>;
}

interface IAgentGovernanceService {
  proposeAsAgent(paramKey: string, value: unknown, opts: AgentProposalOptions): Promise<AgentGovernanceProposal>;
  voteAsAgent(proposalId: string, opts: AgentVoteOptions): Promise<AgentGovernanceProposal>;
  computeAgentWeight(agentAccountId: string): Promise<AgentGovernanceWeightResult>;
  getProposal(proposalId: string): Promise<AgentGovernanceProposal | null>;
  getActiveProposals(): Promise<AgentGovernanceProposal[]>;
  activateExpiredCooldowns(): Promise<number>;  // Cron: activate proposals past cooldown
  expireStaleProposals(): Promise<number>;       // Cron: expire proposals past deadline
}
```

#### 4.4.2 Weight Computation

Server-side only. Never client-supplied.

```
computeAgentWeight(agentAccountId):
  1. Resolve weight source: governance.resolve('governance.agent_weight_source')
     → 'delegation' | 'earned_reputation' | 'fixed_allocation'

  2. Based on source:
     a. DELEGATION:
        - Find creator via AgentProvenanceVerifier.getCreator(agentAccountId)
        - Query agent_governance_delegations for this agent
        - Check creator's total delegated weight across all agents
        - If total ≥ governance.max_delegation_per_creator: cap at remaining
        - Return delegated weight

     b. EARNED_REPUTATION:
        - Query EarningSettled events for agentAccountId within
          governance.reputation_window_seconds
        - Weight = sum(settled_earnings_micro) / governance.reputation_scale_factor
        - Cap at governance.max_weight_per_agent
        - Return earned weight

     c. FIXED_ALLOCATION:
        - Return governance.fixed_weight_per_agent (configurable parameter)
```

#### 4.4.2a Delegation Table

```sql
-- Added to Migration 058_agent_governance.ts
CREATE TABLE agent_governance_delegations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  creator_account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  agent_account_id TEXT NOT NULL REFERENCES credit_accounts(id),
  weight INTEGER NOT NULL CHECK (weight > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT,
  UNIQUE(creator_account_id, agent_account_id)  -- One delegation per creator-agent pair
);

CREATE INDEX idx_delegations_creator ON agent_governance_delegations(creator_account_id)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_delegations_agent ON agent_governance_delegations(agent_account_id)
  WHERE revoked_at IS NULL;
```

#### 4.4.2b Additional Governance Config Parameters

```typescript
// Added to CONFIG_SCHEMA (in addition to those in §3.3)
'governance.agent_weight_source':       { type: 'nullable', description: 'Weight computation mode: delegation|earned_reputation|fixed_allocation' }
'governance.fixed_weight_per_agent':    { type: 'integer', min: 1, max: 1000, description: 'Fixed weight per agent in fixed_allocation mode' }
'governance.reputation_window_seconds': { type: 'integer_seconds', min: 86400, max: 31536000, description: 'Lookback window for earned reputation' }
'governance.reputation_scale_factor':   { type: 'bigint_micro', min: 1n, description: 'Micro-USD per weight point' }
'governance.max_weight_per_agent':      { type: 'integer', min: 1, max: 10000, description: 'Maximum weight per individual agent' }

// Added to CONFIG_FALLBACKS
'governance.agent_weight_source':       'fixed_allocation',  // Safest default
'governance.fixed_weight_per_agent':    10,                  // 10 weight per agent
'governance.reputation_window_seconds': 2592000,             // 30 days
'governance.reputation_scale_factor':   10_000_000n,         // 10 USD per weight point
'governance.max_weight_per_agent':      100                  // Cap at 100 per agent
```

#### 4.4.3 Parameter Whitelist

```typescript
// Agents can only propose changes to these parameters
const AGENT_PROPOSABLE_KEYS: string[] = [
  'transfer.max_single_micro',
  'transfer.daily_limit_micro',
  'governance.agent_quorum_weight',
  'governance.agent_cooldown_seconds',
  'reservation.default_ttl_seconds',
  'agent.drip_recovery_pct',
];

// Agents CANNOT propose changes to:
// - kyc.* (security-critical)
// - payout.* (financial operations)
// - settlement.* (hold periods)
// - fraud_rule.* (fraud detection)
// These require admin governance or admin co-sponsorship
```

#### 4.4.4 Proposal Lifecycle

```
open → (votes accumulate) → quorum_reached → (cooldown) → activated
open → (expiry deadline) → expired
open/quorum_reached → (admin override) → admin_overridden
quorum_reached → (admin rejection) → rejected
```

When a proposal is activated:
1. Create a `system_config` entry via `IConstitutionalGovernanceService.propose()` + auto-approve
2. The agent governance track feeds INTO the existing admin governance system
3. Admin proposals always take precedence in case of conflict (FR-3.8)

### 4.5 EventConsolidationAdapter

**File**: `themes/sietch/src/packages/adapters/billing/EventConsolidationAdapter.ts`

#### 4.5.1 Design

Both `BillingEventEmitter.emit(event, { db })` and `EconomicEventEmitter.emitInTransaction(tx, event)` accept a database/transaction handle. The adapter ensures both writes occur within the **same SQLite transaction** by requiring the caller to pass a transaction context.

```typescript
class EventConsolidationAdapter {
  constructor(
    private readonly legacyEmitter: BillingEventEmitter,
    private readonly economicEmitter: EconomicEventEmitter,
    private readonly eventMapping: Map<string, EconomicEventType>
  ) {}

  // Transactional dual-write (REQUIRED path for atomic consistency)
  emitInTransaction(tx: { prepare(sql: string): any }, event: BillingEvent): void {
    // 1. Write to economic_events (authoritative) via economicEmitter
    const economicEvent = this.mapToEconomicEvent(event);
    if (economicEvent) {
      this.economicEmitter.emitInTransaction(tx, economicEvent);
    }
    // 2. Write to billing_events (legacy compatibility) via legacyEmitter
    this.legacyEmitter.emit(event, { db: tx as any });
    // Both writes in the SAME SQLite transaction — atomic commit/rollback
  }

  // Standalone wrapper (creates its own transaction)
  emit(event: BillingEvent): void {
    // Creates a transaction wrapping both writes
    this.db.transaction(() => {
      this.emitInTransaction(this.db, event);
    })();
  }

  // Delegate queries to legacy emitter (unchanged during transition)
  getEventsForAggregate(...args): Array<BillingEvent> {
    return this.legacyEmitter.getEventsForAggregate(...args);
  }

  getBalanceAtTime(...args): bigint {
    return this.legacyEmitter.getBalanceAtTime(...args);
  }
}
```

**Atomicity guarantee**: Both `BillingEventEmitter.emit({ db: tx })` and `EconomicEventEmitter.emitInTransaction(tx)` write within the caller's transaction context. If either write fails, the entire transaction rolls back. No divergence between tables is possible within a single transaction.
```

#### 4.5.2 Event Type Mapping (ADR-009)

Legacy BillingEvent types → EconomicEvent types:

| BillingEvent type | EconomicEvent type | Notes |
|-------------------|-------------------|-------|
| `AccountCreated` | — | Not mapped (account creation is not an economic event) |
| `LotMinted` | `LotMinted` | Direct mapping |
| `LotExpired` | — | Not mapped (passive expiry, not an economic action) |
| `ReservationCreated` | `ReservationCreated` | Direct mapping |
| `ReservationFinalized` | `ReservationFinalized` | Direct mapping |
| `ReservationReleased` | `ReservationReleased` | Direct mapping |
| `ReferralRegistered` | `ReferralRegistered` | Direct mapping |
| `BonusGranted` | `BonusGranted` | Direct mapping |
| `BonusFlagged` | `BonusFlagged` | Direct mapping |
| `BonusWithheld` | — | Not mapped (cycle-029 only, deprecated) |
| `EarningRecorded` | `EarningRecorded` | Direct mapping |
| `EarningSettled` | `EarningSettled` | Direct mapping |
| `EarningClawedBack` | `EarningClawedBack` | Direct mapping |
| `AgentSettlementInstant` | `AgentSettlementInstant` | Direct mapping |
| `AgentClawbackPartial` | `AgentClawbackPartial` | Direct mapping |
| `AgentClawbackReceivableCreated` | `AgentClawbackReceivableCreated` | Direct mapping |
| `PayoutRequested` | `PayoutRequested` | Direct mapping |
| `PayoutApproved` | `PayoutApproved` | Direct mapping |
| `PayoutProcessing` | — | Not mapped (transient state, not in ECONOMIC_EVENT_TYPES) |
| `PayoutCompleted` | `PayoutCompleted` | Direct mapping |
| `PayoutFailed` | `PayoutFailed` | Direct mapping |
| `RewardsDistributed` | `RewardsDistributed` | Direct mapping |
| `ScoreImported` | `ScoreImported` | Direct mapping |
| `WalletLinked` | — | Not mapped (identity event, not economic) |
| `WalletUnlinked` | — | Not mapped (identity event, not economic) |
| `AgentBudgetWarning` | `AgentBudgetWarning` | Direct mapping |
| `AgentBudgetExhausted` | `AgentBudgetExhausted` | Direct mapping |

**Summary**: 22 of 26 legacy event types map directly. 4 are not mapped (AccountCreated, LotExpired, BonusWithheld, PayoutProcessing, WalletLinked, WalletUnlinked) — these are either non-economic or deprecated.

### 4.6 ReconciliationService Extensions

**File**: `themes/sietch/src/packages/adapters/billing/ReconciliationService.ts` (modified)

#### Check 5: Transfer Conservation

```sql
-- Ledger entry conservation: transfer_out + transfer_in = 0
SELECT COALESCE(SUM(amount_micro), 0) AS total_out
FROM credit_ledger WHERE entry_type = 'transfer_out';

SELECT COALESCE(SUM(amount_micro), 0) AS total_in
FROM credit_ledger WHERE entry_type = 'transfer_in';

-- Conservation: total_out + total_in = 0

-- Lot supply conservation: total original_micro unchanged by transfers
-- Compare: SUM(original_micro) for transfer_in lots = ABS(total_out from ledger)
SELECT COALESCE(SUM(original_micro), 0) AS total_lots_in
FROM credit_lots WHERE source_type = 'transfer_in';

-- Cross-check: total_lots_in = total_in (recipient lots match entry credits)
-- AND: global SUM(original_micro) unchanged (lot-split preserves total supply)
-- The lot-split operation reduces sender lot original_micro by the same amount
-- as recipient lot original_micro is created, so total supply is invariant.
```

#### Check 6: TBA Deposit Bridge Conservation

```sql
-- Sum all bridged deposits (off-chain credits)
SELECT COALESCE(SUM(amount_micro), 0) AS total_credited
FROM tba_deposits WHERE status = 'bridged';

-- Sum all deposit-sourced lots (should match)
SELECT COALESCE(SUM(original_micro), 0) AS total_lots
FROM credit_lots WHERE source_type = 'tba_deposit';

-- Conservation: total_credited = total_lots
-- Note: escrow balance >= total_credited (can only grow, non-redeemable)
```

---

## 5. API Design

### 5.1 Transfer API

```
POST /api/transfer
  Auth: JWT (account_id claim must match fromAccountId)
  Body: { fromAccountId, toAccountId, amountMicro, idempotencyKey, metadata? }
  Response: { transfer: TransferResult }
  Errors: 400 (invalid), 402 (budget exceeded), 403 (provenance), 409 (idempotency conflict)

GET /api/transfer/:id
  Auth: JWT (account_id claim must match sender or recipient)
  Response: { transfer: TransferResult }

GET /api/transfer?accountId=X&direction=sent|received|all&limit=20&offset=0
  Auth: JWT (account_id claim must match accountId)
  Response: { transfers: TransferResult[], total: number }
```

### 5.2 TBA API

```
POST /api/agent/tba/bind
  Auth: JWT (account_id claim must match agent or creator)
  Body: { accountId, tbaAddress }
  Response: { identity: AgentIdentity }
  Errors: 400 (invalid address), 404 (no agent identity), 409 (already bound)

GET /api/agent/tba/deposits?accountId=X&limit=20
  Auth: JWT
  Response: { deposits: TbaDeposit[] }

POST /api/agent/tba/bridge   (Internal / webhook from on-chain listener)
  Auth: Service-to-service JWT
  Body: { chainId, txHash, tokenAddress, amountRaw, fromAddress, toAddress, blockNumber }
  Response: { deposit: DepositBridgeResult }
```

### 5.3 Agent Governance API

```
POST /api/agent/governance/propose
  Auth: JWT (agent account)
  Body: { paramKey, value, justification? }
  Response: { proposal: AgentGovernanceProposal }
  Errors: 400 (not in whitelist), 403 (not agent), 409 (active proposal exists)

POST /api/agent/governance/vote/:proposalId
  Auth: JWT (agent account)
  Body: { vote: 'support' | 'oppose' }
  Response: { proposal: AgentGovernanceProposal }
  Errors: 400 (invalid vote), 403 (not agent), 404 (proposal not found), 409 (already voted)

GET /api/agent/governance/proposals?status=open&limit=20
  Auth: JWT
  Response: { proposals: AgentGovernanceProposal[] }

GET /api/agent/governance/weight/:accountId
  Auth: JWT
  Response: { weight: AgentGovernanceWeightResult }
```

---

## 6. Security Architecture

### 6.1 Transfer Security

| Threat | Mitigation |
|--------|------------|
| Self-transfer (balance inflation) | Reject fromAccountId = toAccountId |
| Budget bypass | AgentBudgetService.checkBudget() before transfer, recordFinalization after |
| Identity spoofing | JWT account_id claim must match sender |
| Race condition on balance | BEGIN IMMEDIATE serializes concurrent transfers per account |
| Double-spend via retries | transfers.idempotency_key UNIQUE constraint + status check |
| Governance limit bypass | Constitutional governance resolves transfer limits per entity type |

### 6.2 TBA Security

| Threat | Mitigation |
|--------|------------|
| Fake deposit (no on-chain tx) | Verify against actual on-chain data (block explorer / RPC) |
| Double-bridging same deposit | tba_deposits.tx_hash UNIQUE constraint |
| Binding wrong TBA to agent | Provenance verification + creator authentication |
| Reorg causing bridged deposit to vanish | Finality depth (12 blocks) before bridging |

### 6.3 Governance Security

| Threat | Mitigation |
|--------|------------|
| Governance capture via deposits | Credit balance/deposits CANNOT determine weight (FR-3.5) |
| Sybil via agent spawning | Per-creator delegation cap (governance.max_delegation_per_creator) |
| Security parameter manipulation | Whitelist: agents cannot propose kyc.*, payout.*, fraud_rule.* changes |
| Admin override | Admin proposals always take precedence (FR-3.8) |
| Weight fabrication | Weight computed server-side, never client-supplied |

---

## 7. Migration Plan

### 7.1 Migration Sequence

| Migration | File | Description |
|-----------|------|-------------|
| 056 | `056_peer_transfers.ts` | `transfers` table + `transfer_out`/`transfer_in` entry types + `tba_deposit` source type |
| 057 | `057_tba_deposits.ts` | `tba_deposits` table for deposit tracking |
| 058 | `058_agent_governance.ts` | `agent_governance_proposals` + `agent_governance_votes` tables |
| 059 | `059_billing_events_deprecated.ts` | Add `deprecated_at` column to `billing_events` |
| 060 | `060_governance_params_seed.ts` | Seed new CONFIG_SCHEMA params + CONFIG_FALLBACKS |

### 7.2 Entry Type / Source Type Extensions

**Decision: Application-level validation ONLY (no table rebuild).**

The existing codebase (migrations 030-055) defines CHECK constraints in the original CREATE TABLE statements, but the `CreditLedgerAdapter` performs application-level type validation before inserting. New entry types (`transfer_out`, `transfer_in`) and source types (`tba_deposit`) are validated at the application layer only.

**Why not rebuild tables**: SQLite CHECK constraint modification requires CREATE-COPY-DROP-RENAME, which is risky for production data and requires recreating all indexes and foreign keys. The existing adapter already validates types before insert, so DB-level CHECK constraints are redundant.

**Implementation**:
1. Migration 056 does NOT alter existing table CHECK constraints
2. `PeerTransferService` validates `transfer_out`/`transfer_in` before insert
3. `TbaDepositBridge` validates `tba_deposit` before insert
4. Add the new type values to TypeScript union types in `billing-types.ts` (compile-time safety)
5. Existing CHECK constraints remain but are never the only gate — application validation is authoritative

---

## 8. Testing Strategy

### 8.1 Unit Tests (per component)

| Component | Test Count | Key Scenarios |
|-----------|-----------|---------------|
| PeerTransferService | ~25 | Happy path, budget rejection, provenance failure, idempotency, zero-sum verification, governance limits, FIFO lot selection |
| TBA bindTBA() | ~8 | Valid bind, idempotent rebind, conflict detection, address normalization |
| TbaDepositBridge | ~12 | Happy path, idempotent bridge, finality check, unknown TBA rejection, escrow verification |
| AgentGovernanceService | ~15 | Propose, vote, quorum reached, cooldown activation, expiry, admin override, whitelist enforcement, weight computation |
| EventConsolidationAdapter | ~10 | Dual-write, mapping correctness, unmapped types handled, transaction context |
| ReconciliationService ext | ~8 | Transfer conservation pass/fail, deposit conservation pass/fail |

### 8.2 Integration Tests

| Scenario | Description |
|----------|-------------|
| Agent sovereignty proof (G-6) | Agent earns via referral → transfers to peer → proposes governance change → quorum → parameter activated. Full lifecycle in one test. |
| Transfer conservation stress | 100 random transfers, verify reconciliation passes |
| Deposit bridge E2E | Mock on-chain deposit → detect → bridge → verify lot + balance |
| Event consolidation correctness | Emit via adapter, verify both billing_events and economic_events tables |

---

## 9. Technical Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| SQLite contention on high-frequency transfers | Medium | BEGIN IMMEDIATE serializes per-file. For scale: batch transfers or use WAL mode. |
| On-chain RPC reliability for deposit detection | Medium | Configurable polling with exponential backoff. Manual bridge endpoint as fallback. |
| Agent governance quorum gaming | Low | Per-creator caps + whitelist limit blast radius. Admin override always available. |
| Event consolidation data loss during transition | Medium | Dual-write ensures both tables receive events. No event is lost — worst case is duplicate. |
| CHECK constraint migration complexity in SQLite | Low | Use application-level validation (existing pattern). |

---

## 10. File Manifest

### New Files

| File | Purpose |
|------|---------|
| `core/ports/IPeerTransferService.ts` | Transfer service interface |
| `core/ports/ITbaDepositBridge.ts` | Deposit bridge interface |
| `core/ports/IAgentGovernanceService.ts` | Agent governance interface |
| `adapters/billing/PeerTransferService.ts` | Transfer service implementation |
| `adapters/billing/TbaDepositBridge.ts` | Deposit bridge implementation |
| `adapters/billing/AgentGovernanceService.ts` | Agent governance implementation |
| `adapters/billing/EventConsolidationAdapter.ts` | Dual-write migration adapter |
| `adapters/billing/address-utils.ts` | EIP-55 address normalization |
| `db/migrations/056_peer_transfers.ts` | Transfer tables + type extensions |
| `db/migrations/057_tba_deposits.ts` | Deposit tracking table |
| `db/migrations/058_agent_governance.ts` | Governance tables |
| `db/migrations/059_billing_events_deprecated.ts` | Deprecation marker |
| `db/migrations/060_governance_params_seed.ts` | New parameter seeds |
| `api/routes/transfer.routes.ts` | Transfer API endpoints |
| `api/routes/agent-tba.routes.ts` | TBA API endpoints |
| `api/routes/agent-governance.routes.ts` | Governance API endpoints |
| `grimoires/loa/decisions/adr-009-event-consolidation.md` | Event consolidation ADR |

### Modified Files

| File | Change |
|------|--------|
| `AgentProvenanceVerifier.ts` | Implement `bindTBA()` (was `NotImplementedError`) |
| `ReconciliationService.ts` | Add checks 5 (transfer conservation) and 6 (deposit bridge conservation) |
| `billing-types.ts` | Add `transfer_out` to EntryType, `tba_deposit` to SourceType |
| `economic-events.ts` | Add 10 new event types |
| `config-schema.ts` | Add 5 new parameters to CONFIG_SCHEMA and CONFIG_FALLBACKS |
| DI/wiring files | Wire new services into Express app |

---

## 11. Dependency Graph

```
Sprint ordering based on dependencies:

  Event Consolidation (FR-4)  ←── foundation, must come first
       │
       ├── Peer Transfer (FR-1) ←── depends on event emission + entry types
       │        │
       │        ├── TBA Binding (FR-2.1-2.3) ←── independent of transfers
       │        │        │
       │        │        └── TBA Deposit Bridge (FR-2.4-2.5) ←── depends on binding
       │        │
       │        └── Agent Governance (FR-3) ←── depends on transfer limits being configurable
       │
       └── Conservation Extensions (FR-5) ←── depends on all above being implemented
```

Suggested sprint ordering: Event Consolidation → Peer Transfers → TBA Binding → Deposit Bridge → Agent Governance → Conservation Extensions → E2E Sovereignty Proof

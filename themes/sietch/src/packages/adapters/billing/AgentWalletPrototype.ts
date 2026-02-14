/**
 * AgentWalletPrototype — ERC-6551 Agent Wallet Proof of Concept
 *
 * Demonstrates agent self-funding via credit ledger:
 * 1. Create agent credit account (entity_type: 'agent')
 * 2. Simulate TBA deposit → credit lot minting
 * 3. Agent reserves credits for inference
 * 4. Agent finalizes after inference completes
 *
 * This is a prototype — no on-chain TBA interaction.
 * On-chain integration deferred to V2.
 *
 * SDD refs: §8 Sprint 6
 * Sprint refs: Task 6.2
 *
 * @module packages/adapters/billing/AgentWalletPrototype
 */

import type {
  ICreditLedgerService,
  CreditAccount,
  BalanceResult,
  ReservationResult,
  FinalizeResult,
} from '../../core/ports/ICreditLedgerService.js';

// =============================================================================
// Types
// =============================================================================

export interface AgentWalletConfig {
  /** The finnNFT token ID */
  tokenId: string;
  /** Daily spending cap in micro-USD */
  dailyCapMicro: bigint;
  /** Auto-refill threshold in micro-USD (trigger deposit when balance drops below) */
  refillThresholdMicro: bigint;
  /** Owner address (NFT holder) */
  ownerAddress: string;
}

export interface AgentWallet {
  /** Credit account for this agent */
  account: CreditAccount;
  /** Agent configuration */
  config: AgentWalletConfig;
  /** Simulated TBA address (deterministic from tokenId) */
  tbaAddress: string;
}

export interface AgentSpendResult {
  reservationId: string;
  amountMicro: bigint;
  remainingBalanceMicro: bigint;
}

export interface AgentFinalizeResult {
  finalizedMicro: bigint;
  releasedMicro: bigint;
  remainingBalanceMicro: bigint;
  needsRefill: boolean;
}

// =============================================================================
// AgentWalletPrototype
// =============================================================================

export class AgentWalletPrototype {
  private ledger: ICreditLedgerService;
  private dailySpent: Map<string, bigint> = new Map();

  constructor(ledger: ICreditLedgerService) {
    this.ledger = ledger;
  }

  /**
   * Create an agent wallet linked to a finnNFT.
   * Creates a credit account with entity_type: 'agent'.
   */
  async createAgentWallet(config: AgentWalletConfig): Promise<AgentWallet> {
    const account = await this.ledger.getOrCreateAccount('agent', `finn-${config.tokenId}`);

    // Simulate deterministic TBA address (in production, derived from ERC-6551 Registry)
    const tbaAddress = `0x${Buffer.from(`tba-${config.tokenId}`).toString('hex').padStart(40, '0').slice(0, 40)}`;

    return {
      account,
      config,
      tbaAddress,
    };
  }

  /**
   * Simulate a TBA deposit — funds arriving from on-chain USDC transfer.
   * In production, this would be triggered by an on-chain event listener.
   */
  async simulateTbaDeposit(
    wallet: AgentWallet,
    amountMicro: bigint,
    txHash: string,
  ): Promise<{ lotId: string; balanceMicro: bigint }> {
    const lot = await this.ledger.mintLot(
      wallet.account.id,
      amountMicro,
      'deposit',
      {
        sourceId: `tba-deposit-${txHash}`,
        poolId: 'general',
        description: `TBA deposit from ${wallet.tbaAddress}`,
        idempotencyKey: `tba:${txHash}`,
      },
    );

    const balance = await this.ledger.getBalance(wallet.account.id);

    return {
      lotId: lot.id,
      balanceMicro: balance.availableMicro,
    };
  }

  /**
   * Agent reserves credits for an inference call.
   * Enforces daily spending cap.
   */
  async reserveForInference(
    wallet: AgentWallet,
    estimatedCostMicro: bigint,
  ): Promise<AgentSpendResult> {
    // Check daily cap
    const todayKey = `${wallet.account.id}:${new Date().toISOString().slice(0, 10)}`;
    const spent = this.dailySpent.get(todayKey) ?? 0n;

    if (spent + estimatedCostMicro > wallet.config.dailyCapMicro) {
      throw new Error(
        `Agent daily cap exceeded: spent ${spent} + ${estimatedCostMicro} > cap ${wallet.config.dailyCapMicro}`
      );
    }

    const reservation = await this.ledger.reserve(
      wallet.account.id,
      null,
      estimatedCostMicro,
      {
        billingMode: 'live',
        description: `Agent inference: finn-${wallet.config.tokenId}`,
      },
    );

    const balance = await this.ledger.getBalance(wallet.account.id);

    return {
      reservationId: reservation.reservationId,
      amountMicro: reservation.totalReservedMicro,
      remainingBalanceMicro: balance.availableMicro,
    };
  }

  /**
   * Finalize an agent's inference reservation with actual cost.
   * Updates daily spending tracker and checks refill threshold.
   */
  async finalizeInference(
    wallet: AgentWallet,
    reservationId: string,
    actualCostMicro: bigint,
  ): Promise<AgentFinalizeResult> {
    const result = await this.ledger.finalize(reservationId, actualCostMicro);

    // Track daily spending
    const todayKey = `${wallet.account.id}:${new Date().toISOString().slice(0, 10)}`;
    const currentSpent = this.dailySpent.get(todayKey) ?? 0n;
    this.dailySpent.set(todayKey, currentSpent + result.actualCostMicro);

    const balance = await this.ledger.getBalance(wallet.account.id);

    return {
      finalizedMicro: result.actualCostMicro,
      releasedMicro: result.surplusReleasedMicro,
      remainingBalanceMicro: balance.availableMicro,
      needsRefill: balance.availableMicro < wallet.config.refillThresholdMicro,
    };
  }

  /**
   * Get the agent's current credit balance.
   */
  async getBalance(wallet: AgentWallet): Promise<BalanceResult> {
    return this.ledger.getBalance(wallet.account.id);
  }

  /**
   * Check if the agent needs a refill from its TBA.
   */
  async needsRefill(wallet: AgentWallet): Promise<boolean> {
    const balance = await this.ledger.getBalance(wallet.account.id);
    return balance.availableMicro < wallet.config.refillThresholdMicro;
  }

  /**
   * Get remaining daily budget for an agent.
   */
  getRemainingDailyBudget(wallet: AgentWallet): bigint {
    const todayKey = `${wallet.account.id}:${new Date().toISOString().slice(0, 10)}`;
    const spent = this.dailySpent.get(todayKey) ?? 0n;
    const remaining = wallet.config.dailyCapMicro - spent;
    return remaining > 0n ? remaining : 0n;
  }
}

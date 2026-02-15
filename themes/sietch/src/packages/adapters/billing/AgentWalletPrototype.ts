/**
 * AgentWalletPrototype — ERC-6551 Agent Wallet Proof of Concept
 *
 * Demonstrates agent self-funding via credit ledger:
 * 1. Create agent credit account (entity_type: 'agent')
 * 2. Simulate TBA deposit → credit lot minting
 * 3. Agent reserves credits for inference
 * 4. Agent finalizes after inference completes
 *
 * Daily spending tracking (Sprint 241):
 * - SQLite: persistent source of truth (daily_agent_spending table)
 * - Redis: INCRBY cache for fast reads with midnight UTC TTL
 * - In-memory Map: sync-only fallback for test/prototype mode
 *
 * Read path: Redis → SQLite → in-memory (production)
 * Sync path: in-memory only (getRemainingDailyBudgetSync)
 *
 * SDD refs: §8 Sprint 6, §2.3 Daily Spending
 * Sprint refs: Task 6.2, Tasks 3.1-3.5
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
import type Database from 'better-sqlite3';

// =============================================================================
// Redis Interface (Task 9.4, extended Sprint 241 Task 3.3)
// =============================================================================

/** Redis interface for daily spending persistence with INCRBY support */
export interface AgentRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  /** Set key with TTL in seconds */
  setex?(key: string, seconds: number, value: string): Promise<string>;
  expire?(key: string, seconds: number): Promise<number>;
  /** Atomic increment — returns new value after increment */
  incrby?(key: string, increment: number): Promise<number>;
  /** Execute Lua script for atomic INCRBY + EXPIREAT */
  eval?(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
}

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
  /** Optional NFT-based identity anchor hash (loa-hounfour sybil resistance) */
  identityAnchor?: string;
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

/** Redis key prefix for agent daily spending */
const DAILY_SPEND_PREFIX = 'billing:agent:daily:';

/**
 * Lua script for atomic INCRBY + EXPIREAT on first write.
 * Detects new key by comparing INCRBY result to the increment value.
 * If they match, this was the first write — set EXPIREAT to midnight UTC.
 */
const REDIS_INCRBY_EXPIREAT_LUA = `
local newval = redis.call('INCRBY', KEYS[1], ARGV[1])
if newval == tonumber(ARGV[1]) then
  redis.call('EXPIREAT', KEYS[1], ARGV[2])
end
return newval
`;

export class AgentWalletPrototype {
  private ledger: ICreditLedgerService;
  private dailySpent: Map<string, bigint> = new Map();
  private redis: AgentRedisClient | null;
  private db: Database.Database | null;

  constructor(
    ledger: ICreditLedgerService,
    redis?: AgentRedisClient | null,
    db?: Database.Database | null,
  ) {
    this.ledger = ledger;
    this.redis = redis ?? null;
    this.db = db ?? null;
  }

  /**
   * Create an agent wallet linked to a finnNFT.
   * Creates a credit account with entity_type: 'agent'.
   */
  async createAgentWallet(config: AgentWalletConfig): Promise<AgentWallet> {
    const account = await this.ledger.getOrCreateAccount('agent', `finn-${config.tokenId}`);

    // Include identity anchor in TBA address derivation if provided (Task 9.3)
    const tbaInput = config.identityAnchor
      ? `tba-${config.tokenId}-${config.identityAnchor}`
      : `tba-${config.tokenId}`;
    const tbaAddress = `0x${Buffer.from(tbaInput).toString('hex').padStart(40, '0').slice(0, 40)}`;

    // Persist identity anchor to SQLite (Sprint 243, Task 5.2)
    if (config.identityAnchor && this.db) {
      this.persistIdentityAnchor(account.id, config.identityAnchor, config.ownerAddress);
    }

    return {
      account,
      config,
      tbaAddress,
    };
  }

  /**
   * Verify that a wallet's identity anchor matches the expected value.
   * Used for sybil resistance — ensures agent wallet is bound to a verified NFT identity.
   */
  verifyIdentityBinding(wallet: AgentWallet, expectedAnchor: string): boolean {
    return wallet.config.identityAnchor === expectedAnchor;
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
   * Enforces daily spending cap. Reads from Redis → SQLite → in-memory.
   */
  async reserveForInference(
    wallet: AgentWallet,
    estimatedCostMicro: bigint,
  ): Promise<AgentSpendResult> {
    // Check daily cap — read from Redis first, fallback to SQLite, then in-memory
    const todayKey = `${wallet.account.id}:${new Date().toISOString().slice(0, 10)}`;
    const spent = await this.getDailySpent(todayKey);

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
   * Writes daily spending to SQLite (persistent) + Redis (cache) + in-memory.
   * Cap enforcement at finalize: if total exceeds cap, actual cost is capped.
   */
  async finalizeInference(
    wallet: AgentWallet,
    reservationId: string,
    actualCostMicro: bigint,
  ): Promise<AgentFinalizeResult> {
    // Cap enforcement at finalize time
    const todayKey = `${wallet.account.id}:${new Date().toISOString().slice(0, 10)}`;
    const todayDate = new Date().toISOString().slice(0, 10);
    const currentSpent = await this.getDailySpent(todayKey);

    let cappedCost = actualCostMicro;
    if (currentSpent + actualCostMicro > wallet.config.dailyCapMicro) {
      const remaining = wallet.config.dailyCapMicro - currentSpent;
      cappedCost = remaining > 0n ? remaining : 0n;
    }

    const result = await this.ledger.finalize(reservationId, cappedCost);

    // Write to SQLite (persistent source of truth)
    this.upsertDailySpending(wallet.account.id, todayDate, result.actualCostMicro);

    // Update in-memory cache
    const newSpent = currentSpent + result.actualCostMicro;
    this.dailySpent.set(todayKey, newSpent);

    // Write to Redis cache (non-blocking, failure is acceptable)
    await this.incrbyRedisSpending(todayKey, result.actualCostMicro);

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
   * Get remaining daily budget for an agent (async).
   * Reads from Redis → SQLite → in-memory.
   */
  async getRemainingDailyBudget(wallet: AgentWallet): Promise<bigint> {
    const todayKey = `${wallet.account.id}:${new Date().toISOString().slice(0, 10)}`;
    const spent = await this.getDailySpent(todayKey);
    const remaining = wallet.config.dailyCapMicro - spent;
    return remaining > 0n ? remaining : 0n;
  }

  /**
   * Get remaining daily budget synchronously (in-memory Map only).
   * For test/prototype mode where Redis and SQLite may not be available.
   */
  getRemainingDailyBudgetSync(wallet: AgentWallet): bigint {
    const todayKey = `${wallet.account.id}:${new Date().toISOString().slice(0, 10)}`;
    const spent = this.dailySpent.get(todayKey) ?? 0n;
    const remaining = wallet.config.dailyCapMicro - spent;
    return remaining > 0n ? remaining : 0n;
  }

  // ---------------------------------------------------------------------------
  // Private: Identity anchor persistence (Sprint 243, Task 5.2)
  // ---------------------------------------------------------------------------

  /**
   * Persist identity anchor to agent_identity_anchors table.
   * Idempotent: INSERT OR IGNORE skips if anchor already bound to this account.
   */
  private persistIdentityAnchor(
    accountId: string,
    identityAnchor: string,
    createdBy: string,
  ): void {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO agent_identity_anchors
          (agent_account_id, identity_anchor, created_by)
        VALUES (?, ?, ?)
      `).run(accountId, identityAnchor, createdBy);
    } catch {
      // Table may not exist in test setup — non-fatal
    }
  }

  /**
   * Look up stored identity anchor for an agent account.
   * Returns null if no anchor is bound or table doesn't exist.
   */
  getStoredAnchor(accountId: string): string | null {
    if (!this.db) return null;
    try {
      const row = this.db.prepare(
        `SELECT identity_anchor FROM agent_identity_anchors WHERE agent_account_id = ?`
      ).get(accountId) as { identity_anchor: string } | undefined;
      return row?.identity_anchor ?? null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: SQLite daily spending (Sprint 241, Task 3.2)
  // ---------------------------------------------------------------------------

  /**
   * Atomic UPSERT into daily_agent_spending.
   * ON CONFLICT increments existing total rather than replacing it.
   */
  private upsertDailySpending(
    accountId: string,
    spendingDate: string,
    incrementMicro: bigint,
  ): void {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT INTO daily_agent_spending (agent_account_id, spending_date, total_spent_micro, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(agent_account_id, spending_date) DO UPDATE SET
          total_spent_micro = total_spent_micro + excluded.total_spent_micro,
          updated_at = datetime('now')
      `).run(accountId, spendingDate, incrementMicro.toString());
    } catch {
      // SQLite write failure — Redis and in-memory still function
    }
  }

  /**
   * Read daily spent from SQLite.
   * Returns 0n if table doesn't exist or no row found.
   */
  private getDailySpentFromSqlite(accountId: string, spendingDate: string): bigint {
    if (!this.db) return 0n;
    try {
      const row = this.db.prepare(
        `SELECT total_spent_micro FROM daily_agent_spending
         WHERE agent_account_id = ? AND spending_date = ?`
      ).get(accountId, spendingDate) as { total_spent_micro: number | string } | undefined;

      if (row) return BigInt(row.total_spent_micro);
    } catch {
      // Table may not exist in test setup — fall through
    }
    return 0n;
  }

  // ---------------------------------------------------------------------------
  // Private: Redis daily spending (Task 9.4, extended Sprint 241 Task 3.3)
  // ---------------------------------------------------------------------------

  /**
   * Read daily spent from Redis → SQLite → in-memory.
   * Production read path: Redis (fast) → SQLite (persistent) → Map (last resort)
   */
  private async getDailySpent(todayKey: string): Promise<bigint> {
    // Layer 1: Redis (fast cache)
    if (this.redis) {
      try {
        const redisKey = `${DAILY_SPEND_PREFIX}${todayKey}`;
        const val = await this.redis.get(redisKey);
        if (val !== null) {
          const parsed = BigInt(val);
          this.dailySpent.set(todayKey, parsed);
          return parsed;
        }
      } catch {
        // Redis unavailable — fall through to SQLite
      }
    }

    // Layer 2: SQLite (persistent source of truth)
    const [accountId, date] = todayKey.split(':').length >= 2
      ? [todayKey.substring(0, todayKey.lastIndexOf(':')), todayKey.substring(todayKey.lastIndexOf(':') + 1)]
      : [todayKey, ''];

    if (date && this.db) {
      const sqliteSpent = this.getDailySpentFromSqlite(accountId, date);
      if (sqliteSpent > 0n) {
        this.dailySpent.set(todayKey, sqliteSpent);
        return sqliteSpent;
      }
    }

    // Layer 3: In-memory Map (last resort / test mode)
    return this.dailySpent.get(todayKey) ?? 0n;
  }

  /**
   * Atomic Redis INCRBY with EXPIREAT on first write.
   * Uses Lua script if eval is available, otherwise falls back to INCRBY + EXPIRE.
   */
  private async incrbyRedisSpending(todayKey: string, incrementMicro: bigint): Promise<void> {
    if (!this.redis) return;
    try {
      const redisKey = `${DAILY_SPEND_PREFIX}${todayKey}`;
      const incrementNum = Number(incrementMicro);
      const midnightEpoch = this.midnightUtcEpoch();

      // Prefer atomic Lua script: INCRBY + EXPIREAT on first write
      if (this.redis.eval) {
        await this.redis.eval(
          REDIS_INCRBY_EXPIREAT_LUA,
          1,
          redisKey,
          incrementNum,
          midnightEpoch,
        );
        return;
      }

      // Fallback: separate INCRBY + EXPIRE
      if (this.redis.incrby) {
        const newVal = await this.redis.incrby(redisKey, incrementNum);
        // If newVal equals increment, this was the first write — set TTL
        if (newVal === incrementNum && this.redis.expire) {
          const ttl = this.secondsUntilMidnightUtc();
          await this.redis.expire(redisKey, ttl);
        }
        return;
      }

      // Last resort: use set (overwrites — less accurate under concurrency)
      const currentSpent = this.dailySpent.get(todayKey) ?? 0n;
      const ttl = this.secondsUntilMidnightUtc();
      if (this.redis.setex) {
        await this.redis.setex(redisKey, ttl, currentSpent.toString());
      } else {
        await this.redis.set(redisKey, currentSpent.toString());
        if (this.redis.expire) {
          await this.redis.expire(redisKey, ttl);
        }
      }
    } catch {
      // Redis unavailable — SQLite and in-memory are still updated
    }
  }

  /** Seconds remaining until midnight UTC */
  private secondsUntilMidnightUtc(): number {
    const now = new Date();
    const midnight = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    ));
    return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  }

  /** Unix epoch seconds for next midnight UTC */
  private midnightUtcEpoch(): number {
    const now = new Date();
    const midnight = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    ));
    return Math.floor(midnight.getTime() / 1000);
  }
}

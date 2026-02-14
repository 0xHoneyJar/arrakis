/**
 * RevenueDistributionService — Zero-Sum Revenue Posting
 *
 * After every finalization, distributes the charge into three pools:
 *   commons_share  = (charge * commons_rate_bps)  / 10000
 *   community_share = (charge * community_rate_bps) / 10000
 *   foundation_share = charge - commons_share - community_share
 *
 * Foundation absorbs integer truncation remainder (zero-sum invariant).
 * All three entries posted in a single SQLite transaction (atomic with finalize).
 *
 * SDD refs: §1.4 RevenueDistributionService
 * Sprint refs: Task 3.3
 *
 * @module packages/adapters/billing/RevenueDistributionService
 */

import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { logger } from '../../../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

export interface DistributionResult {
  commonsShare: bigint;
  communityShare: bigint;
  foundationShare: bigint;
  commonsAccountId: string;
  communityAccountId: string;
  foundationAccountId: string;
}

export interface DistributionConfig {
  commonsRateBps: bigint;
  communityRateBps: bigint;
  foundationRateBps: bigint;
  commonsAccountId: string;
  communityAccountId: string;
  foundationAccountId: string;
}

// =============================================================================
// RevenueDistributionService
// =============================================================================

export class RevenueDistributionService {
  private db: Database.Database;
  private configCache: DistributionConfig | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Load distribution config from billing_config table.
   * Cached after first load; call invalidateConfig() to refresh.
   */
  getConfig(): DistributionConfig {
    if (this.configCache) return this.configCache;

    const getVal = (key: string): string => {
      const row = this.db.prepare(
        `SELECT value FROM billing_config WHERE key = ?`
      ).get(key) as { value: string } | undefined;
      if (!row) throw new Error(`Missing billing_config key: ${key}`);
      return row.value;
    };

    this.configCache = {
      commonsRateBps: BigInt(getVal('commons_rate_bps')),
      communityRateBps: BigInt(getVal('community_rate_bps')),
      foundationRateBps: BigInt(getVal('foundation_rate_bps')),
      commonsAccountId: getVal('commons_account_id'),
      communityAccountId: getVal('community_account_id'),
      foundationAccountId: getVal('foundation_account_id'),
    };

    // Validate rates sum to 10000 bps (100%)
    const total = this.configCache.commonsRateBps +
      this.configCache.communityRateBps +
      this.configCache.foundationRateBps;
    if (total !== 10000n) {
      throw new Error(
        `Revenue distribution rates must sum to 10000 bps, got ${total}`
      );
    }

    return this.configCache;
  }

  /**
   * Clear cached config. Call after admin updates rates.
   */
  invalidateConfig(): void {
    this.configCache = null;
  }

  /**
   * Calculate revenue distribution shares.
   * Foundation absorbs integer truncation remainder (zero-sum invariant).
   */
  calculateShares(chargeMicro: bigint): {
    commonsShare: bigint;
    communityShare: bigint;
    foundationShare: bigint;
  } {
    const config = this.getConfig();

    const commonsShare = (chargeMicro * config.commonsRateBps) / 10000n;
    const communityShare = (chargeMicro * config.communityRateBps) / 10000n;
    // Foundation absorbs remainder — exact zero-sum
    const foundationShare = chargeMicro - commonsShare - communityShare;

    return { commonsShare, communityShare, foundationShare };
  }

  /**
   * Post revenue distribution entries within an existing transaction.
   *
   * MUST be called within the same db.transaction() as finalize() to ensure
   * atomicity — if finalize rolls back, distribution entries are also rolled back.
   *
   * @param accountId - The account being charged (source)
   * @param poolId - The pool being charged from
   * @param chargeMicro - The finalized charge amount
   * @param reservationId - The reservation being finalized
   * @param entrySeqBase - Base sequence number (distribution entries use seq+1, seq+2, seq+3)
   */
  postDistribution(
    accountId: string,
    poolId: string,
    chargeMicro: bigint,
    reservationId: string,
    entrySeqBase: number,
  ): DistributionResult {
    if (chargeMicro <= 0n) {
      return {
        commonsShare: 0n,
        communityShare: 0n,
        foundationShare: 0n,
        commonsAccountId: '',
        communityAccountId: '',
        foundationAccountId: '',
      };
    }

    const config = this.getConfig();
    const { commonsShare, communityShare, foundationShare } = this.calculateShares(chargeMicro);

    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

    // Post commons contribution
    if (commonsShare > 0n) {
      this.db.prepare(
        `INSERT INTO credit_ledger
         (id, account_id, pool_id, reservation_id, entry_seq, entry_type,
          amount_micro, description, created_at)
         VALUES (?, ?, ?, ?, ?, 'commons_contribution', ?, ?, ?)`
      ).run(
        randomUUID(), config.commonsAccountId, poolId, reservationId,
        entrySeqBase + 1, commonsShare.toString(),
        `Commons share from ${accountId}`, now,
      );
    }

    // Post revenue share (community)
    if (communityShare > 0n) {
      this.db.prepare(
        `INSERT INTO credit_ledger
         (id, account_id, pool_id, reservation_id, entry_seq, entry_type,
          amount_micro, description, created_at)
         VALUES (?, ?, ?, ?, ?, 'revenue_share', ?, ?, ?)`
      ).run(
        randomUUID(), config.communityAccountId, poolId, reservationId,
        entrySeqBase + 2, communityShare.toString(),
        `Community revenue share from ${accountId}`, now,
      );
    }

    // Post foundation share (revenue_share entry type)
    if (foundationShare > 0n) {
      this.db.prepare(
        `INSERT INTO credit_ledger
         (id, account_id, pool_id, reservation_id, entry_seq, entry_type,
          amount_micro, description, created_at)
         VALUES (?, ?, ?, ?, ?, 'revenue_share', ?, ?, ?)`
      ).run(
        randomUUID(), config.foundationAccountId, poolId, reservationId,
        entrySeqBase + 3, foundationShare.toString(),
        `Foundation revenue share from ${accountId}`, now,
      );
    }

    logger.info({
      event: 'billing.distribution',
      accountId,
      reservationId,
      chargeMicro: chargeMicro.toString(),
      commonsShare: commonsShare.toString(),
      communityShare: communityShare.toString(),
      foundationShare: foundationShare.toString(),
    }, 'Revenue distribution posted');

    return {
      commonsShare,
      communityShare,
      foundationShare,
      commonsAccountId: config.commonsAccountId,
      communityAccountId: config.communityAccountId,
      foundationAccountId: config.foundationAccountId,
    };
  }
}

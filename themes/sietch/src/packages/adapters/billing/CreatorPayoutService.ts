/**
 * CreatorPayoutService — Two-Phase Escrow Payout Flow
 *
 * Handles payout requests with KYC enforcement, balance validation,
 * rate limiting, and escrow via PayoutStateMachine.
 *
 * KYC thresholds:
 *   < $100 cumulative: none (wallet address only)
 *   $100-$600: basic KYC (email + wallet verification)
 *   > $600: enhanced KYC (admin approval)
 *
 * SDD refs: §4.4 PayoutService
 * Sprint refs: Tasks 9.1, 9.3
 *
 * @module packages/adapters/billing/CreatorPayoutService
 */

import type Database from 'better-sqlite3';
import { logger } from '../../../utils/logger.js';
import { PayoutStateMachine } from './PayoutStateMachine.js';
import { SettlementService } from './SettlementService.js';
import { validateEIP55Checksum } from './protocol/eip55.js';

// =============================================================================
// Types
// =============================================================================

export type KycLevel = 'none' | 'basic' | 'enhanced' | 'verified';

export interface PayoutRequestInput {
  accountId: string;
  amountMicro: number;
  payoutAddress: string;
  currency?: string;
}

export interface PayoutRequestResult {
  success: boolean;
  payoutId?: string;
  error?: string;
  requiredKycLevel?: KycLevel;
}

export interface WithdrawableBalance {
  settledMicro: bigint;
  escrowMicro: bigint;
  withdrawableMicro: bigint;
}

export interface KycStatusResult {
  currentLevel: KycLevel;
  cumulativePayoutsMicro: bigint;
  nextThreshold: number | null;
  nextThresholdLevel: KycLevel | null;
  percentToNextThreshold: number;
  warning: string | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum payout amount (micro USD) — $1.00 */
const MIN_PAYOUT_MICRO = 1_000_000;

/** KYC thresholds in micro USD */
const KYC_BASIC_THRESHOLD_MICRO = 100_000_000;    // $100
const KYC_ENHANCED_THRESHOLD_MICRO = 600_000_000;  // $600

/** Rate limit: 1 payout per 24 hours */
const RATE_LIMIT_HOURS = 24;

/** Default fee (micro USD) — $0 for Phase 1B */
const DEFAULT_FEE_MICRO = 0;

/** Fee cap: reject if fee > 20% of gross */
const FEE_CAP_PERCENT = 20;

// =============================================================================
// CreatorPayoutService
// =============================================================================

export class CreatorPayoutService {
  private db: Database.Database;
  private stateMachine: PayoutStateMachine;
  private settlement: SettlementService;

  constructor(db: Database.Database) {
    this.db = db;
    this.stateMachine = new PayoutStateMachine(db);
    this.settlement = new SettlementService(db);
  }

  /**
   * Request a payout with full validation.
   * Creates payout request in pending state, then approves with escrow.
   */
  requestPayout(input: PayoutRequestInput): PayoutRequestResult {
    const { accountId, amountMicro, payoutAddress, currency } = input;

    // Validate minimum
    if (amountMicro < MIN_PAYOUT_MICRO) {
      return { success: false, error: `Minimum payout is ${MIN_PAYOUT_MICRO / 1_000_000} USD` };
    }

    // Validate EIP-55 checksum on payout address
    if (!validateEIP55Checksum(payoutAddress)) {
      return { success: false, error: 'Invalid payout address: EIP-55 checksum validation failed' };
    }

    // Check KYC
    const kycCheck = this.checkKycRequirement(accountId, amountMicro);
    if (!kycCheck.allowed) {
      return {
        success: false,
        error: `KYC level '${kycCheck.requiredLevel}' required for this payout amount`,
        requiredKycLevel: kycCheck.requiredLevel,
      };
    }

    // Check rate limit
    if (this.isRateLimited(accountId)) {
      return { success: false, error: 'Rate limit exceeded: 1 payout per 24 hours' };
    }

    // Check balance
    const balance = this.getWithdrawableBalance(accountId);
    if (balance.withdrawableMicro < BigInt(amountMicro)) {
      return {
        success: false,
        error: `Insufficient withdrawable balance: ${balance.withdrawableMicro} < ${amountMicro}`,
      };
    }

    // Fee validation
    const feeMicro = DEFAULT_FEE_MICRO;
    if (feeMicro > 0 && (feeMicro / amountMicro) * 100 > FEE_CAP_PERCENT) {
      return { success: false, error: `Fee exceeds ${FEE_CAP_PERCENT}% cap` };
    }

    try {
      // OCC check on treasury state
      const treasuryVersion = this.getTreasuryVersion();

      const result = this.db.transaction(() => {
        // Re-check treasury version (OCC)
        const currentVersion = this.getTreasuryVersion();
        if (currentVersion !== treasuryVersion) {
          throw new Error('Treasury state changed — retry required');
        }

        // Create and approve in single transaction
        const { payoutId } = this.stateMachine.createRequest(
          accountId, amountMicro, feeMicro, payoutAddress, currency,
        );

        const approveResult = this.stateMachine.approve(payoutId);
        if (!approveResult.success) {
          throw new Error(`Approve failed: ${approveResult.reason}`);
        }

        // Bump treasury version
        this.db.prepare(`
          UPDATE treasury_state SET version = version + 1,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = 1
        `).run();

        return payoutId;
      })();

      logger.info({
        event: 'payout.requested',
        payoutId: result,
        accountId,
        amountMicro,
      }, 'Payout request created and approved');

      return { success: true, payoutId: result };
    } catch (err) {
      logger.error({ err, accountId }, 'Payout request failed');
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Get withdrawable balance for an account.
   * Settled minus in-escrow amounts.
   */
  getWithdrawableBalance(accountId: string): WithdrawableBalance {
    const settledMicro = this.settlement.getSettledBalance(accountId);

    // Get amount currently in escrow (active payouts)
    let escrowMicro = 0n;
    try {
      const row = this.db.prepare(`
        SELECT COALESCE(SUM(amount_micro), 0) as total
        FROM payout_requests
        WHERE account_id = ? AND status IN ('pending', 'approved', 'processing')
      `).get(accountId) as { total: number };
      escrowMicro = BigInt(row.total);
    } catch {
      // Table may not exist
    }

    const withdrawableMicro = settledMicro - escrowMicro;

    return {
      settledMicro,
      escrowMicro,
      withdrawableMicro: withdrawableMicro > 0n ? withdrawableMicro : 0n,
    };
  }

  /**
   * Get KYC level for an account.
   */
  getKycLevel(accountId: string): KycLevel {
    try {
      const row = this.db.prepare(`
        SELECT kyc_level FROM credit_accounts WHERE id = ?
      `).get(accountId) as { kyc_level: string | null } | undefined;

      if (!row || !row.kyc_level) return 'none';
      return row.kyc_level as KycLevel;
    } catch {
      // Column may not exist yet
      return 'none';
    }
  }

  /**
   * Get KYC status with progressive disclosure warnings.
   * Returns current level, progress toward next threshold, and warning when at 80%+.
   */
  getKycStatus(accountId: string): KycStatusResult {
    const currentLevel = this.getKycLevel(accountId);

    let cumulativePayoutsMicro = 0n;
    try {
      const row = this.db.prepare(`
        SELECT COALESCE(SUM(amount_micro), 0) as total
        FROM payout_requests
        WHERE account_id = ? AND status = 'completed'
      `).get(accountId) as { total: number };
      cumulativePayoutsMicro = BigInt(row.total);
    } catch {
      // Table may not exist
    }

    const cumulative = Number(cumulativePayoutsMicro);

    // Determine next threshold based on cumulative payouts
    let nextThreshold: number | null = null;
    let nextThresholdLevel: KycLevel | null = null;

    if (cumulative < KYC_BASIC_THRESHOLD_MICRO) {
      nextThreshold = KYC_BASIC_THRESHOLD_MICRO;
      nextThresholdLevel = 'basic';
    } else if (cumulative < KYC_ENHANCED_THRESHOLD_MICRO) {
      nextThreshold = KYC_ENHANCED_THRESHOLD_MICRO;
      nextThresholdLevel = 'enhanced';
    }
    // else: already past all thresholds

    const percentToNextThreshold = nextThreshold
      ? Math.min(Math.round((cumulative / nextThreshold) * 100), 100)
      : 100;

    // Warning triggers at 80% of next threshold
    let warning: string | null = null;
    if (nextThreshold && percentToNextThreshold >= 80) {
      const thresholdUsd = nextThreshold / 1_000_000;
      warning = `Verify your identity to increase your payout limit. You are approaching the $${thresholdUsd} threshold for ${nextThresholdLevel} verification.`;
    }

    return {
      currentLevel,
      cumulativePayoutsMicro,
      nextThreshold,
      nextThresholdLevel,
      percentToNextThreshold,
      warning,
    };
  }

  /**
   * Set KYC level for an account (admin action).
   */
  setKycLevel(accountId: string, level: KycLevel): void {
    try {
      this.db.prepare(`
        UPDATE credit_accounts SET kyc_level = ? WHERE id = ?
      `).run(level, accountId);
    } catch {
      // Column may not exist — add it
      try {
        this.db.exec(`ALTER TABLE credit_accounts ADD COLUMN kyc_level TEXT DEFAULT 'none'`);
        this.db.prepare(`
          UPDATE credit_accounts SET kyc_level = ? WHERE id = ?
        `).run(level, accountId);
      } catch {
        // Already exists
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private checkKycRequirement(accountId: string, payoutAmountMicro: number): {
    allowed: boolean;
    requiredLevel: KycLevel;
  } {
    // Calculate cumulative withdrawn + this request
    let cumulativeWithdrawn = 0n;
    try {
      const row = this.db.prepare(`
        SELECT COALESCE(SUM(amount_micro), 0) as total
        FROM payout_requests
        WHERE account_id = ? AND status = 'completed'
      `).get(accountId) as { total: number };
      cumulativeWithdrawn = BigInt(row.total);
    } catch {
      // Table may not exist
    }

    const totalAfterPayout = cumulativeWithdrawn + BigInt(payoutAmountMicro);
    const currentKyc = this.getKycLevel(accountId);

    let requiredLevel: KycLevel;
    if (totalAfterPayout > BigInt(KYC_ENHANCED_THRESHOLD_MICRO)) {
      requiredLevel = 'enhanced';
    } else if (totalAfterPayout > BigInt(KYC_BASIC_THRESHOLD_MICRO)) {
      requiredLevel = 'basic';
    } else {
      requiredLevel = 'none';
    }

    const kycOrder: KycLevel[] = ['none', 'basic', 'enhanced', 'verified'];
    const currentIdx = kycOrder.indexOf(currentKyc);
    const requiredIdx = kycOrder.indexOf(requiredLevel);

    return {
      allowed: currentIdx >= requiredIdx,
      requiredLevel,
    };
  }

  private isRateLimited(accountId: string): boolean {
    try {
      const row = this.db.prepare(`
        SELECT COUNT(*) as count FROM payout_requests
        WHERE account_id = ?
          AND requested_at > datetime('now', '-${RATE_LIMIT_HOURS} hours')
          AND status != 'cancelled'
      `).get(accountId) as { count: number };
      return row.count > 0;
    } catch {
      return false;
    }
  }

  private getTreasuryVersion(): number {
    try {
      const row = this.db.prepare(`SELECT version FROM treasury_state WHERE id = 1`).get() as { version: number };
      return row.version;
    } catch {
      return 0;
    }
  }
}

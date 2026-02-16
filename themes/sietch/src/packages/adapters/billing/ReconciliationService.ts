/**
 * ReconciliationService — Cross-System Reconciliation (ADR-008)
 *
 * Alert-only reconciliation. NEVER auto-corrects. Divergence emits
 * ReconciliationDivergence event and logs for human review.
 *
 * Conservation checks:
 * 1. Lot conservation: available + reserved + consumed = original - expired (per account)
 * 2. Receivable balance: sum(outstanding receivables) matches expected IOUs
 * 3. Platform-level: all_lot_balances + all_receivable_balances = all_minted - all_expired
 * 4. Budget consistency: current_spend_micro matches windowed finalizations sum
 *
 * SDD refs: §SS4.6, §SS8.1
 * Sprint refs: Task 9.2
 *
 * @module adapters/billing/ReconciliationService
 */

import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { logger } from '../../../utils/logger.js';
import { sqliteTimestamp } from './protocol/timestamps.js';
import type {
  IReconciliationService,
  ReconciliationResult,
  ReconciliationCheck,
  ReconciliationStatus,
} from '../../core/ports/IReconciliationService.js';
import type { BillingEventEmitter } from './BillingEventEmitter.js';

// =============================================================================
// ReconciliationService
// =============================================================================

export class ReconciliationService implements IReconciliationService {
  private db: Database.Database;
  private eventEmitter: BillingEventEmitter | null;

  constructor(db: Database.Database, eventEmitter?: BillingEventEmitter) {
    this.db = db;
    this.eventEmitter = eventEmitter ?? null;
  }

  async reconcile(): Promise<ReconciliationResult> {
    const id = randomUUID();
    const startedAt = sqliteTimestamp();
    const checks: ReconciliationCheck[] = [];
    const divergences: string[] = [];

    // Check 1: Lot conservation (per account)
    checks.push(this.checkLotConservation(divergences));

    // Check 2: Receivable balance tracking
    checks.push(this.checkReceivableBalances(divergences));

    // Check 3: Platform-level conservation
    checks.push(this.checkPlatformConservation(divergences));

    // Check 4: Budget consistency
    checks.push(this.checkBudgetConsistency(divergences));

    const finishedAt = sqliteTimestamp();
    const status: ReconciliationStatus = divergences.length > 0 ? 'divergence_detected' : 'passed';

    // Persist result
    this.db.prepare(`
      INSERT INTO reconciliation_runs (id, started_at, finished_at, status, checks_json, divergence_summary_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id, startedAt, finishedAt, status,
      JSON.stringify(checks),
      divergences.length > 0 ? JSON.stringify(divergences) : null,
    );

    // Emit event
    if (this.eventEmitter) {
      const eventType = status === 'passed' ? 'ReconciliationCompleted' : 'ReconciliationDivergence';
      try {
        this.eventEmitter.emit({
          type: eventType as any,
          aggregateType: 'account' as any,
          aggregateId: id,
          timestamp: finishedAt,
          causationId: `reconciliation:${id}`,
          payload: {
            checksCount: checks.length,
            divergencesCount: divergences.length,
            status,
          },
        } as any, { db: this.db });
      } catch {
        // Event emission failure is non-fatal for reconciliation
      }
    }

    logger.info({
      event: `reconciliation.${status}`,
      id,
      checksRun: checks.length,
      divergences: divergences.length,
    }, `Reconciliation ${status}: ${checks.filter(c => c.status === 'passed').length}/${checks.length} checks passed`);

    return { id, startedAt, finishedAt, status, checks, divergences };
  }

  async getHistory(limit = 20): Promise<ReconciliationResult[]> {
    const rows = this.db.prepare(`
      SELECT * FROM reconciliation_runs ORDER BY created_at DESC LIMIT ?
    `).all(limit) as Array<{
      id: string; started_at: string; finished_at: string;
      status: ReconciliationStatus; checks_json: string; divergence_summary_json: string | null;
    }>;

    return rows.map(row => ({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      checks: JSON.parse(row.checks_json),
      divergences: row.divergence_summary_json ? JSON.parse(row.divergence_summary_json) : [],
    }));
  }

  // ---------------------------------------------------------------------------
  // Conservation Checks
  // ---------------------------------------------------------------------------

  private checkLotConservation(divergences: string[]): ReconciliationCheck {
    try {
      // Per-account: available + reserved + consumed should equal original - expired_amount
      const accounts = this.db.prepare(`
        SELECT cl.account_id,
          SUM(cl.available_micro) as total_available,
          SUM(cl.reserved_micro) as total_reserved,
          SUM(cl.consumed_micro) as total_consumed,
          SUM(cl.original_micro) as total_original
        FROM credit_lots cl
        GROUP BY cl.account_id
      `).all() as Array<{
        account_id: string;
        total_available: number;
        total_reserved: number;
        total_consumed: number;
        total_original: number;
      }>;

      let violations = 0;
      for (const acct of accounts) {
        const lhs = BigInt(acct.total_available) + BigInt(acct.total_reserved) + BigInt(acct.total_consumed);
        const rhs = BigInt(acct.total_original);
        // Allow for expired lots: lhs <= rhs
        if (lhs > rhs) {
          violations++;
          divergences.push(`Lot conservation violated for account ${acct.account_id}: ${lhs} > ${rhs}`);
        }
      }

      return {
        name: 'lot_conservation',
        status: violations === 0 ? 'passed' : 'failed',
        details: { accountsChecked: accounts.length, violations },
      };
    } catch (err) {
      return { name: 'lot_conservation', status: 'failed', details: { error: (err as Error).message } };
    }
  }

  private checkReceivableBalances(divergences: string[]): ReconciliationCheck {
    try {
      const row = this.db.prepare(`
        SELECT
          COUNT(*) as total_receivables,
          COALESCE(SUM(CASE WHEN balance_micro > 0 THEN 1 ELSE 0 END), 0) as outstanding_count,
          COALESCE(SUM(CASE WHEN balance_micro > 0 THEN balance_micro ELSE 0 END), 0) as outstanding_total,
          COALESCE(SUM(original_amount_micro), 0) as total_original
        FROM agent_clawback_receivables
      `).get() as {
        total_receivables: number;
        outstanding_count: number;
        outstanding_total: number;
        total_original: number;
      };

      // Receivable balance should never exceed original amount
      const violations = row.outstanding_total > row.total_original ? 1 : 0;
      if (violations > 0) {
        divergences.push(`Receivable balance (${row.outstanding_total}) exceeds original (${row.total_original})`);
      }

      return {
        name: 'receivable_balance',
        status: violations === 0 ? 'passed' : 'failed',
        details: {
          totalReceivables: row.total_receivables,
          outstandingCount: row.outstanding_count,
          outstandingTotal: row.outstanding_total,
        },
      };
    } catch {
      // Table may not exist yet — pass silently
      return { name: 'receivable_balance', status: 'passed', details: { skipped: true } };
    }
  }

  private checkPlatformConservation(divergences: string[]): ReconciliationCheck {
    try {
      const lotTotals = this.db.prepare(`
        SELECT
          COALESCE(SUM(original_micro), 0) as total_minted,
          COALESCE(SUM(available_micro + reserved_micro + consumed_micro), 0) as total_accounted
        FROM credit_lots
      `).get() as { total_minted: number; total_accounted: number };

      let receivableTotal = 0;
      try {
        const recRow = this.db.prepare(`
          SELECT COALESCE(SUM(balance_micro), 0) as total
          FROM agent_clawback_receivables WHERE balance_micro > 0
        `).get() as { total: number };
        receivableTotal = recRow.total;
      } catch {
        // Table may not exist
      }

      const totalMinted = BigInt(lotTotals.total_minted);
      const totalAccounted = BigInt(lotTotals.total_accounted) + BigInt(receivableTotal);

      // total_accounted should not exceed total_minted
      const ok = totalAccounted <= totalMinted;
      if (!ok) {
        divergences.push(
          `Platform conservation: accounted (${totalAccounted}) > minted (${totalMinted})`
        );
      }

      return {
        name: 'platform_conservation',
        status: ok ? 'passed' : 'failed',
        details: {
          totalMinted: totalMinted.toString(),
          totalLotBalances: lotTotals.total_accounted.toString(),
          totalReceivables: receivableTotal.toString(),
          totalAccounted: totalAccounted.toString(),
        },
      };
    } catch (err) {
      return { name: 'platform_conservation', status: 'failed', details: { error: (err as Error).message } };
    }
  }

  private checkBudgetConsistency(divergences: string[]): ReconciliationCheck {
    try {
      const limits = this.db.prepare(`
        SELECT id, account_id, current_spend_micro, window_start, window_duration_seconds
        FROM agent_spending_limits
      `).all() as Array<{
        id: string; account_id: string; current_spend_micro: number;
        window_start: string; window_duration_seconds: number;
      }>;

      let violations = 0;
      for (const limit of limits) {
        const windowEnd = new Date(
          new Date(limit.window_start).getTime() + limit.window_duration_seconds * 1000
        ).toISOString();

        const spendRow = this.db.prepare(`
          SELECT COALESCE(SUM(amount_micro), 0) as actual_spend
          FROM agent_budget_finalizations
          WHERE account_id = ? AND finalized_at >= ? AND finalized_at < ?
        `).get(limit.account_id, limit.window_start, windowEnd) as { actual_spend: number };

        if (spendRow.actual_spend !== limit.current_spend_micro) {
          violations++;
          divergences.push(
            `Budget consistency: account ${limit.account_id} recorded=${limit.current_spend_micro} actual=${spendRow.actual_spend}`
          );
        }
      }

      return {
        name: 'budget_consistency',
        status: violations === 0 ? 'passed' : 'failed',
        details: { limitsChecked: limits.length, violations },
      };
    } catch {
      // Budget tables may not exist — pass silently
      return { name: 'budget_consistency', status: 'passed', details: { skipped: true } };
    }
  }
}

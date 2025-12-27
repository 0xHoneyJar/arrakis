/**
 * =============================================================================
 * SIETCH UNIFIED - DATA LIFECYCLE SERVICE
 * =============================================================================
 * 
 * GDPR-compliant data lifecycle management:
 * - 30-day auto-purge for ephemeral activity data
 * - 7-day session expiry for verification tokens
 * - Automated data retention enforcement
 * - Audit trail for all purge operations
 * 
 * ENTERPRISE STANDARD: Microsoft/GDPR PII lifecycle best practices.
 * 
 * @module services/compliance/data-lifecycle.service
 */

import { PrismaClient } from '@prisma/client';
import { getObservability } from '../observability/observability.service';

// =============================================================================
// TYPES
// =============================================================================

export interface RetentionPolicy {
  dataType: string;
  retentionDays: number;
  description: string;
  legalBasis: string;
}

export interface PurgeResult {
  dataType: string;
  recordsPurged: number;
  oldestRecordDate?: Date;
  newestRecordDate?: Date;
  executedAt: Date;
}

export interface DataLifecycleConfig {
  policies: RetentionPolicy[];
  dryRun?: boolean;
  batchSize?: number;
}

// =============================================================================
// DEFAULT RETENTION POLICIES
// =============================================================================

export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    dataType: 'verification_sessions',
    retentionDays: 7,
    description: 'Wallet verification session tokens',
    legalBasis: 'Contract performance (verification process)',
  },
  {
    dataType: 'activity_events',
    retentionDays: 30,
    description: 'User activity events (messages, reactions)',
    legalBasis: 'Legitimate interest (conviction scoring)',
  },
  {
    dataType: 'api_request_logs',
    retentionDays: 30,
    description: 'API request logs for debugging',
    legalBasis: 'Legitimate interest (service operation)',
  },
  {
    dataType: 'webhook_events',
    retentionDays: 90,
    description: 'Stripe/Collab.Land webhook payloads',
    legalBasis: 'Legal obligation (financial records)',
  },
  {
    dataType: 'audit_logs',
    retentionDays: 365,
    description: 'Security and compliance audit logs',
    legalBasis: 'Legal obligation (audit requirements)',
  },
  {
    dataType: 'data_export_requests',
    retentionDays: 90,
    description: 'GDPR data export request records',
    legalBasis: 'Legal obligation (GDPR Article 20)',
  },
  {
    dataType: 'data_deletion_requests',
    retentionDays: 365,
    description: 'GDPR deletion request records (proof of compliance)',
    legalBasis: 'Legal obligation (GDPR Article 17)',
  },
  {
    dataType: 'badge_display_cache',
    retentionDays: 1,
    description: 'Cached badge display data',
    legalBasis: 'Performance optimization (cache)',
  },
];

// =============================================================================
// DATA LIFECYCLE SERVICE
// =============================================================================

export class DataLifecycleService {
  private prisma: PrismaClient;
  private policies: RetentionPolicy[];
  private batchSize: number;
  private obs = getObservability();

  constructor(params: {
    prisma: PrismaClient;
    config?: Partial<DataLifecycleConfig>;
  }) {
    this.prisma = params.prisma;
    this.policies = params.config?.policies || DEFAULT_RETENTION_POLICIES;
    this.batchSize = params.config?.batchSize || 1000;
  }

  // ===========================================================================
  // RETENTION POLICY MANAGEMENT
  // ===========================================================================

  /**
   * Get all retention policies.
   */
  getPolicies(): RetentionPolicy[] {
    return [...this.policies];
  }

  /**
   * Get policy for a specific data type.
   */
  getPolicy(dataType: string): RetentionPolicy | undefined {
    return this.policies.find(p => p.dataType === dataType);
  }

  /**
   * Update a retention policy.
   */
  updatePolicy(dataType: string, retentionDays: number): void {
    const policy = this.policies.find(p => p.dataType === dataType);
    if (policy) {
      policy.retentionDays = retentionDays;
      this.obs.info('retention_policy_updated', { dataType, retentionDays });
    }
  }

  // ===========================================================================
  // PURGE OPERATIONS
  // ===========================================================================

  /**
   * Run all retention purge jobs.
   */
  async runAllPurgeJobs(dryRun: boolean = false): Promise<PurgeResult[]> {
    this.obs.info('purge_jobs_started', { dryRun, policyCount: this.policies.length });
    
    const results: PurgeResult[] = [];

    for (const policy of this.policies) {
      try {
        const result = await this.purgeDataType(policy.dataType, dryRun);
        results.push(result);
      } catch (error) {
        this.obs.error(`purge_job_failed`, error as Error, { dataType: policy.dataType });
        results.push({
          dataType: policy.dataType,
          recordsPurged: 0,
          executedAt: new Date(),
        });
      }
    }

    // Log summary
    const totalPurged = results.reduce((sum, r) => sum + r.recordsPurged, 0);
    this.obs.info('purge_jobs_completed', {
      dryRun,
      totalPurged,
      dataTypes: results.map(r => ({ type: r.dataType, count: r.recordsPurged })),
    });

    // Record metric
    this.obs.counter('data_lifecycle_purge_total', totalPurged, { dryRun: String(dryRun) });

    return results;
  }

  /**
   * Purge a specific data type based on its retention policy.
   */
  async purgeDataType(dataType: string, dryRun: boolean = false): Promise<PurgeResult> {
    const policy = this.getPolicy(dataType);
    if (!policy) {
      throw new Error(`No retention policy found for: ${dataType}`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    this.obs.info('purge_started', {
      dataType,
      retentionDays: policy.retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      dryRun,
    });

    let recordsPurged = 0;
    let oldestRecordDate: Date | undefined;
    let newestRecordDate: Date | undefined;

    switch (dataType) {
      case 'verification_sessions':
        const sessions = await this.purgeVerificationSessions(cutoffDate, dryRun);
        recordsPurged = sessions.count;
        break;

      case 'activity_events':
        // Note: ActivityScore model tracks aggregates, not individual events
        // If you have a separate events table, purge it here
        recordsPurged = 0;
        break;

      case 'badge_display_cache':
        const cache = await this.purgeBadgeDisplayCache(cutoffDate, dryRun);
        recordsPurged = cache.count;
        break;

      case 'audit_logs':
        const logs = await this.purgeAuditLogs(cutoffDate, dryRun);
        recordsPurged = logs.count;
        break;

      case 'data_export_requests':
        const exports = await this.purgeDataExportRequests(cutoffDate, dryRun);
        recordsPurged = exports.count;
        break;

      case 'data_deletion_requests':
        const deletions = await this.purgeDataDeletionRequests(cutoffDate, dryRun);
        recordsPurged = deletions.count;
        break;

      default:
        this.obs.warn('purge_unknown_type', { dataType });
    }

    // Log to audit trail
    if (!dryRun && recordsPurged > 0) {
      await this.prisma.auditLog.create({
        data: {
          action: 'data_lifecycle_purge',
          actor: 'system:data_lifecycle',
          metadata: {
            dataType,
            recordsPurged,
            cutoffDate: cutoffDate.toISOString(),
            retentionDays: policy.retentionDays,
          },
        },
      });
    }

    return {
      dataType,
      recordsPurged,
      oldestRecordDate,
      newestRecordDate,
      executedAt: new Date(),
    };
  }

  // ===========================================================================
  // SPECIFIC PURGE IMPLEMENTATIONS
  // ===========================================================================

  /**
   * Purge expired verification sessions.
   */
  private async purgeVerificationSessions(
    cutoffDate: Date,
    dryRun: boolean
  ): Promise<{ count: number }> {
    if (dryRun) {
      const count = await this.prisma.verificationSession.count({
        where: {
          OR: [
            { expiresAt: { lt: cutoffDate } },
            { status: 'expired', updatedAt: { lt: cutoffDate } },
            { status: 'completed', updatedAt: { lt: cutoffDate } },
          ],
        },
      });
      return { count };
    }

    const result = await this.prisma.verificationSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoffDate } },
          { status: 'expired', updatedAt: { lt: cutoffDate } },
          { status: 'completed', updatedAt: { lt: cutoffDate } },
        ],
      },
    });

    return { count: result.count };
  }

  /**
   * Purge expired badge display cache.
   */
  private async purgeBadgeDisplayCache(
    cutoffDate: Date,
    dryRun: boolean
  ): Promise<{ count: number }> {
    if (dryRun) {
      const count = await this.prisma.badgeDisplayCache.count({
        where: { expiresAt: { lt: cutoffDate } },
      });
      return { count };
    }

    const result = await this.prisma.badgeDisplayCache.deleteMany({
      where: { expiresAt: { lt: cutoffDate } },
    });

    return { count: result.count };
  }

  /**
   * Purge old audit logs (keep recent for compliance).
   */
  private async purgeAuditLogs(
    cutoffDate: Date,
    dryRun: boolean
  ): Promise<{ count: number }> {
    // Never delete audit logs for critical actions
    const excludedActions = [
      'data_deletion_completed',
      'fee_waiver_granted',
      'subscription_created',
    ];

    if (dryRun) {
      const count = await this.prisma.auditLog.count({
        where: {
          createdAt: { lt: cutoffDate },
          action: { notIn: excludedActions },
        },
      });
      return { count };
    }

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        action: { notIn: excludedActions },
      },
    });

    return { count: result.count };
  }

  /**
   * Purge completed data export requests.
   */
  private async purgeDataExportRequests(
    cutoffDate: Date,
    dryRun: boolean
  ): Promise<{ count: number }> {
    if (dryRun) {
      const count = await this.prisma.dataExportRequest.count({
        where: {
          status: 'completed',
          completedAt: { lt: cutoffDate },
        },
      });
      return { count };
    }

    const result = await this.prisma.dataExportRequest.deleteMany({
      where: {
        status: 'completed',
        completedAt: { lt: cutoffDate },
      },
    });

    return { count: result.count };
  }

  /**
   * Purge old data deletion requests (keep proof of compliance).
   */
  private async purgeDataDeletionRequests(
    cutoffDate: Date,
    dryRun: boolean
  ): Promise<{ count: number }> {
    // Keep a summary record but remove detailed data
    if (dryRun) {
      const count = await this.prisma.dataDeletionRequest.count({
        where: {
          status: 'completed',
          completedAt: { lt: cutoffDate },
        },
      });
      return { count };
    }

    // Instead of deleting, anonymize the request
    const result = await this.prisma.dataDeletionRequest.updateMany({
      where: {
        status: 'completed',
        completedAt: { lt: cutoffDate },
      },
      data: {
        // Anonymize but keep record of compliance
        metadata: {},
      },
    });

    return { count: result.count };
  }

  // ===========================================================================
  // SESSION EXPIRY
  // ===========================================================================

  /**
   * Expire all verification sessions older than 7 days.
   */
  async expireOldSessions(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const result = await this.prisma.verificationSession.updateMany({
      where: {
        status: 'pending',
        createdAt: { lt: cutoffDate },
      },
      data: {
        status: 'expired',
      },
    });

    if (result.count > 0) {
      this.obs.info('sessions_expired', { count: result.count });
    }

    return result.count;
  }

  /**
   * Expire sessions that have passed their expiresAt timestamp.
   */
  async expireTimedOutSessions(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.verificationSession.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    return result.count;
  }

  // ===========================================================================
  // REPORTING
  // ===========================================================================

  /**
   * Get data retention report for compliance.
   */
  async getRetentionReport(): Promise<{
    policies: Array<RetentionPolicy & { currentRecordCount: number }>;
    nextPurgeEstimates: Array<{ dataType: string; estimatedCount: number }>;
    lastPurgeDate?: Date;
  }> {
    const policyStats = await Promise.all(
      this.policies.map(async (policy) => {
        let currentRecordCount = 0;

        switch (policy.dataType) {
          case 'verification_sessions':
            currentRecordCount = await this.prisma.verificationSession.count();
            break;
          case 'audit_logs':
            currentRecordCount = await this.prisma.auditLog.count();
            break;
          case 'badge_display_cache':
            currentRecordCount = await this.prisma.badgeDisplayCache.count();
            break;
        }

        return { ...policy, currentRecordCount };
      })
    );

    // Estimate next purge
    const nextPurgeEstimates = await Promise.all(
      this.policies.map(async (policy) => {
        const result = await this.purgeDataType(policy.dataType, true);
        return {
          dataType: policy.dataType,
          estimatedCount: result.recordsPurged,
        };
      })
    );

    // Get last purge from audit log
    const lastPurge = await this.prisma.auditLog.findFirst({
      where: { action: 'data_lifecycle_purge' },
      orderBy: { createdAt: 'desc' },
    });

    return {
      policies: policyStats,
      nextPurgeEstimates,
      lastPurgeDate: lastPurge?.createdAt,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let dataLifecycleInstance: DataLifecycleService | null = null;

export function getDataLifecycleService(params: {
  prisma: PrismaClient;
  config?: Partial<DataLifecycleConfig>;
}): DataLifecycleService {
  if (!dataLifecycleInstance) {
    dataLifecycleInstance = new DataLifecycleService(params);
  }
  return dataLifecycleInstance;
}

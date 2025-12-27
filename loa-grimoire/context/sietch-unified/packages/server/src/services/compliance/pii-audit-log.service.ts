/**
 * =============================================================================
 * SIETCH UNIFIED - PII AUDIT LOG SERVICE
 * =============================================================================
 * 
 * Records every access to personally identifiable information for GDPR
 * compliance auditing. Tracks AccountKit, wallet lookups, and UID access.
 * 
 * ENTERPRISE STANDARD: GDPR Articles 15-22 "Data Passport" trail.
 * 
 * @module services/compliance/pii-audit-log.service
 */

import { PrismaClient } from '@prisma/client';
import { getObservability } from '../observability/observability.service';

// =============================================================================
// TYPES
// =============================================================================

export type PIIAccessType = 
  | 'wallet_lookup'
  | 'uid_resolution'
  | 'identity_verification'
  | 'balance_check'
  | 'nft_ownership_check'
  | 'governance_participation'
  | 'staking_lookup'
  | 'profile_read'
  | 'profile_update'
  | 'data_export'
  | 'data_deletion'
  | 'cross_platform_link';

export interface PIIAccessRecord {
  id?: string;
  timestamp: Date;
  accessType: PIIAccessType;
  subjectId: string;           // UnifiedIdentity ID being accessed
  actorId: string;             // Who/what initiated the access
  actorType: 'user' | 'service' | 'admin' | 'system';
  dataFields: string[];        // Which PII fields were accessed
  purpose: string;             // Legal basis / reason for access
  sourceService: string;       // Which service made the request
  chain?: string;              // Blockchain if applicable
  contractAddress?: string;    // Contract if applicable
  ipAddress?: string;          // Client IP if available
  userAgent?: string;          // Client user agent if available
  correlationId?: string;      // For tracing across services
  retentionDays: number;       // How long this log entry is kept
  gdprBasis: GDPRLegalBasis;   // Legal basis for processing
}

export type GDPRLegalBasis = 
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests';

export interface PIIAuditQuery {
  subjectId?: string;
  actorId?: string;
  accessType?: PIIAccessType;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface DataPassport {
  subjectId: string;
  generatedAt: Date;
  accessHistory: PIIAccessRecord[];
  dataInventory: DataInventoryItem[];
  retentionSchedule: RetentionScheduleItem[];
  exportFormat: 'json' | 'pdf';
}

export interface DataInventoryItem {
  category: string;
  fields: string[];
  source: string;
  collectedAt?: Date;
  legalBasis: GDPRLegalBasis;
  retentionPeriod: string;
}

export interface RetentionScheduleItem {
  dataType: string;
  retentionDays: number;
  deletionDate: Date;
  legalBasis: string;
}

// =============================================================================
// PII AUDIT LOG SERVICE
// =============================================================================

export class PIIAuditLogService {
  private prisma: PrismaClient;
  private obs = getObservability();
  private retentionDays: number;

  constructor(params: {
    prisma: PrismaClient;
    retentionDays?: number;
  }) {
    this.prisma = params.prisma;
    this.retentionDays = params.retentionDays || 365; // 1 year default
    
    console.log('✅ PII Audit Log Service initialized');
  }

  // ===========================================================================
  // ACCESS LOGGING
  // ===========================================================================

  /**
   * Log a PII access event.
   */
  async logAccess(record: Omit<PIIAccessRecord, 'id' | 'timestamp' | 'retentionDays'>): Promise<void> {
    const fullRecord: PIIAccessRecord = {
      ...record,
      timestamp: new Date(),
      retentionDays: this.retentionDays,
    };

    try {
      await this.prisma.auditLog.create({
        data: {
          action: `pii_access:${record.accessType}`,
          actor: `${record.actorType}:${record.actorId}`,
          metadata: {
            ...fullRecord,
            timestamp: fullRecord.timestamp.toISOString(),
          },
        },
      });

      this.obs.info('pii_access_logged', {
        accessType: record.accessType,
        subjectId: record.subjectId,
        actorType: record.actorType,
        dataFieldsCount: record.dataFields.length,
      });

      this.obs.counter('pii_access_events', 1, {
        accessType: record.accessType,
        actorType: record.actorType,
      });
    } catch (error) {
      this.obs.error('pii_audit_log_failed', error as Error, {
        accessType: record.accessType,
        subjectId: record.subjectId,
      });
      // Don't throw - audit logging should not break primary operations
    }
  }

  /**
   * Log wallet lookup from AccountKit.
   */
  async logWalletLookup(params: {
    subjectId: string;
    walletAddress: string;
    chain: string;
    actorId: string;
    actorType: 'user' | 'service' | 'admin' | 'system';
    purpose: string;
    correlationId?: string;
  }): Promise<void> {
    await this.logAccess({
      accessType: 'wallet_lookup',
      subjectId: params.subjectId,
      actorId: params.actorId,
      actorType: params.actorType,
      dataFields: ['wallet_address', 'chain'],
      purpose: params.purpose,
      sourceService: 'AccountKitDataProvider',
      chain: params.chain,
      correlationId: params.correlationId,
      gdprBasis: 'contract',
    });
  }

  /**
   * Log cross-platform UID resolution.
   */
  async logUIDResolution(params: {
    subjectId: string;
    platforms: string[];
    actorId: string;
    actorType: 'user' | 'service' | 'admin' | 'system';
    purpose: string;
    correlationId?: string;
  }): Promise<void> {
    await this.logAccess({
      accessType: 'uid_resolution',
      subjectId: params.subjectId,
      actorId: params.actorId,
      actorType: params.actorType,
      dataFields: params.platforms.map(p => `${p}_uid`),
      purpose: params.purpose,
      sourceService: 'IdentityBridgeService',
      correlationId: params.correlationId,
      gdprBasis: 'contract',
    });
  }

  /**
   * Log identity verification event.
   */
  async logIdentityVerification(params: {
    subjectId: string;
    platform: string;
    walletAddress?: string;
    actorId: string;
    success: boolean;
    correlationId?: string;
  }): Promise<void> {
    await this.logAccess({
      accessType: 'identity_verification',
      subjectId: params.subjectId,
      actorId: params.actorId,
      actorType: 'service',
      dataFields: ['platform_uid', 'wallet_address', 'verification_signature'],
      purpose: `Identity verification for ${params.platform} (${params.success ? 'success' : 'failed'})`,
      sourceService: 'IdentityBridgeService',
      correlationId: params.correlationId,
      gdprBasis: 'contract',
    });
  }

  /**
   * Log data export (GDPR Article 20).
   */
  async logDataExport(params: {
    subjectId: string;
    exportedFields: string[];
    requestedBy: string;
    format: 'json' | 'csv';
    correlationId?: string;
  }): Promise<void> {
    await this.logAccess({
      accessType: 'data_export',
      subjectId: params.subjectId,
      actorId: params.requestedBy,
      actorType: 'user',
      dataFields: params.exportedFields,
      purpose: 'GDPR Article 20 data portability request',
      sourceService: 'GDPRService',
      correlationId: params.correlationId,
      gdprBasis: 'legal_obligation',
    });
  }

  /**
   * Log data deletion (GDPR Article 17).
   */
  async logDataDeletion(params: {
    subjectId: string;
    deletedFields: string[];
    requestedBy: string;
    correlationId?: string;
  }): Promise<void> {
    await this.logAccess({
      accessType: 'data_deletion',
      subjectId: params.subjectId,
      actorId: params.requestedBy,
      actorType: 'user',
      dataFields: params.deletedFields,
      purpose: 'GDPR Article 17 right to erasure request',
      sourceService: 'GDPRService',
      correlationId: params.correlationId,
      gdprBasis: 'legal_obligation',
    });
  }

  // ===========================================================================
  // QUERY & REPORTING
  // ===========================================================================

  /**
   * Query PII access logs.
   */
  async queryAccessLogs(query: PIIAuditQuery): Promise<PIIAccessRecord[]> {
    const where: any = {
      action: { startsWith: 'pii_access:' },
    };

    if (query.subjectId) {
      where.metadata = { path: ['subjectId'], equals: query.subjectId };
    }

    if (query.accessType) {
      where.action = `pii_access:${query.accessType}`;
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = query.fromDate;
      if (query.toDate) where.createdAt.lte = query.toDate;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      take: query.limit || 100,
      skip: query.offset || 0,
      orderBy: { createdAt: 'desc' },
    });

    return logs.map(log => ({
      id: log.id,
      timestamp: log.createdAt,
      ...(log.metadata as any),
    }));
  }

  /**
   * Generate GDPR Data Passport for a subject.
   */
  async generateDataPassport(subjectId: string): Promise<DataPassport> {
    // Get all access history
    const accessHistory = await this.queryAccessLogs({
      subjectId,
      limit: 1000,
    });

    // Get data inventory
    const identity = await this.prisma.unifiedIdentity.findUnique({
      where: { id: subjectId },
      include: {
        wallets: true,
        accounts: true,
        profile: true,
      },
    });

    const dataInventory: DataInventoryItem[] = [];

    if (identity) {
      dataInventory.push({
        category: 'Identity',
        fields: ['unified_identity_id', 'created_at', 'updated_at'],
        source: 'Sietch Unified',
        collectedAt: identity.createdAt,
        legalBasis: 'contract',
        retentionPeriod: 'Until account deletion',
      });

      if (identity.wallets.length > 0) {
        dataInventory.push({
          category: 'Wallet Addresses',
          fields: identity.wallets.map(w => `${w.chain}:${w.address.slice(0, 10)}...`),
          source: 'Collab.Land AccountKit',
          legalBasis: 'contract',
          retentionPeriod: 'Until wallet unlink',
        });
      }

      if (identity.accounts.length > 0) {
        dataInventory.push({
          category: 'Platform Accounts',
          fields: identity.accounts.map(a => `${a.platform}_uid`),
          source: 'User verification',
          legalBasis: 'contract',
          retentionPeriod: 'Until account unlink',
        });
      }

      if (identity.profile) {
        dataInventory.push({
          category: 'Profile Data',
          fields: ['nym', 'visibility', 'data_region', 'preferences'],
          source: 'User input',
          legalBasis: 'consent',
          retentionPeriod: 'Until profile deletion',
        });
      }
    }

    // Calculate retention schedule
    const retentionSchedule: RetentionScheduleItem[] = [
      {
        dataType: 'Verification Sessions',
        retentionDays: 7,
        deletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        legalBasis: 'Contract performance',
      },
      {
        dataType: 'Activity Events',
        retentionDays: 30,
        deletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        legalBasis: 'Legitimate interest',
      },
      {
        dataType: 'Audit Logs',
        retentionDays: 365,
        deletionDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        legalBasis: 'Legal obligation',
      },
    ];

    // Log this data passport generation
    await this.logAccess({
      accessType: 'data_export',
      subjectId,
      actorId: subjectId,
      actorType: 'user',
      dataFields: ['full_data_passport'],
      purpose: 'GDPR Article 15 right of access - Data Passport generation',
      sourceService: 'PIIAuditLogService',
      gdprBasis: 'legal_obligation',
    });

    return {
      subjectId,
      generatedAt: new Date(),
      accessHistory,
      dataInventory,
      retentionSchedule,
      exportFormat: 'json',
    };
  }

  /**
   * Get access summary for compliance reporting.
   */
  async getAccessSummary(params: {
    fromDate: Date;
    toDate: Date;
  }): Promise<{
    totalAccesses: number;
    byType: Record<PIIAccessType, number>;
    byActorType: Record<string, number>;
    uniqueSubjects: number;
  }> {
    const logs = await this.queryAccessLogs({
      fromDate: params.fromDate,
      toDate: params.toDate,
      limit: 10000,
    });

    const byType: Record<string, number> = {};
    const byActorType: Record<string, number> = {};
    const uniqueSubjects = new Set<string>();

    for (const log of logs) {
      byType[log.accessType] = (byType[log.accessType] || 0) + 1;
      byActorType[log.actorType] = (byActorType[log.actorType] || 0) + 1;
      uniqueSubjects.add(log.subjectId);
    }

    return {
      totalAccesses: logs.length,
      byType: byType as Record<PIIAccessType, number>,
      byActorType,
      uniqueSubjects: uniqueSubjects.size,
    };
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Purge old audit logs beyond retention period.
   */
  async purgeExpiredLogs(): Promise<number> {
    const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        action: { startsWith: 'pii_access:' },
        createdAt: { lt: cutoffDate },
      },
    });

    if (result.count > 0) {
      this.obs.info('pii_audit_logs_purged', { count: result.count });
    }

    return result.count;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let piiAuditLogInstance: PIIAuditLogService | null = null;

export function getPIIAuditLogService(prisma: PrismaClient): PIIAuditLogService {
  if (!piiAuditLogInstance) {
    piiAuditLogInstance = new PIIAuditLogService({ prisma });
  }
  return piiAuditLogInstance;
}

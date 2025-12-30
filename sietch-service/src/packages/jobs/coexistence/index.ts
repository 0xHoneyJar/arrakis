/**
 * Coexistence Jobs - Scheduled Tasks for Shadow Mode & Rollback Monitoring
 *
 * Sprint 57: Shadow Mode Foundation - Shadow Ledger & Sync
 * Sprint 63: Migration Engine - Rollback & Takeover (RollbackWatcherJob)
 *
 * @module packages/jobs/coexistence
 */

// Shadow Sync Job (Sprint 57)
export {
  ShadowSyncJob,
  createShadowSyncJob,
  type ShadowSyncJobConfig,
  type ShadowSyncJobResult,
  type AccuracyAlert,
  type CommunityGuildMapping,
  type GetCommunityGuildMappings,
  type AdminDigest,
} from './ShadowSyncJob.js';

// Rollback Watcher Job (Sprint 63)
export {
  RollbackWatcherJob,
  createRollbackWatcherJob,
  type RollbackWatcherJobConfig,
  type RollbackWatcherJobResult,
  type RollbackDetail,
  type WatcherCommunityMapping,
  type GetWatcherCommunityMappings,
  type GetAccessCounts,
  type GetErrorCounts,
} from './RollbackWatcherJob.js';

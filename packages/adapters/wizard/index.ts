/**
 * Wizard Adapters
 *
 * Sprint S-20: Wizard Session Store & State Model
 *
 * Exports wizard-related adapter implementations:
 * - RedisWizardSessionStore - Redis-backed session management
 * - S3ShadowStateStore - S3-backed manifest history and drift detection
 */

// Redis Session Store
export {
  RedisWizardSessionStore,
  createRedisWizardSessionStore,
  type RedisClient,
  type RedisSessionStoreOptions,
} from './redis-session-store.js';

// S3 Shadow State Store
export {
  S3ShadowStateStore,
  createShadowStateStore,
  type S3Client,
  type ShadowStateStoreOptions,
  type ShadowStateMetadata,
  type ShadowStateSnapshot,
  type DriftComparisonResult,
  type DriftItem,
  type ActualDiscordState,
  type ActualRole,
  type ActualChannel,
} from './shadow-state-store.js';

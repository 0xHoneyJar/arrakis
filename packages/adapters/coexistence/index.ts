/**
 * Coexistence Adapters
 *
 * Sprint S-24: Incumbent Detection & Shadow Ledger
 * Sprint S-25: Shadow Sync Job & Verification Tiers
 *
 * Adapters for shadow mode coexistence including:
 * - IncumbentDetector: Auto-detection of Collab.Land, Matrica, Guild.xyz
 * - ScyllaDBShadowLedger: Shadow state and divergence tracking
 * - ShadowSyncJob: 6-hour periodic comparison
 * - FeatureGate: Tier-based feature access control
 *
 * @see SDD §7.1 Shadow Mode Architecture
 */

// Sprint S-24: Incumbent Detection
export {
  IncumbentDetector,
  createIncumbentDetector,
  type IDiscordRestService,
  type GuildMember,
  type GuildChannel,
  type GuildRole,
  type DetectionOptions,
} from './incumbent-detector.js';

// Sprint S-24: Shadow Ledger
export {
  ScyllaDBShadowLedger,
  createScyllaDBShadowLedger,
  type IScyllaClient,
} from './shadow-ledger.js';

// Sprint S-25: Shadow Sync Job
export {
  ShadowSyncJob,
  createShadowSyncJob,
  type IDiscordMemberService,
  type ICommunityRepository,
  type IEligibilityChecker,
  type INatsPublisher,
  type IMetricsClient,
  type GuildMemberData,
  type EligibilityRule,
  type ShadowSyncJobOptions,
} from './shadow-sync-job.js';

// Sprint S-25: Feature Gate
export {
  FeatureGate,
  createFeatureGate,
  createFeatureGateWithStore,
  InMemoryFeatureOverrideStore,
  FeatureAccessDeniedError,
  type ICommunityTierRepository,
  type IFeatureOverrideStore,
  type FeatureGateOptions,
} from './feature-gate.js';

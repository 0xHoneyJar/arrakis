/**
 * Coexistence Adapters - Shadow Mode & Incumbent Detection
 *
 * Sprint 56: Shadow Mode Foundation - Incumbent Detection
 * Sprint 57: Shadow Mode Foundation - Shadow Ledger & Sync
 *
 * This module provides adapters for coexisting with incumbent token-gating
 * solutions (Collab.Land, Matrica, Guild.xyz) during migration.
 *
 * Components:
 * - CoexistenceStorage: PostgreSQL storage for incumbent configs, migration states, shadow ledger
 * - IncumbentDetector: Detects incumbent bots using multiple methods
 * - ShadowLedger: Tracks divergences between incumbent and Arrakis access
 *
 * @module packages/adapters/coexistence
 */

// Storage adapter
export {
  CoexistenceStorage,
  createCoexistenceStorage,
} from './CoexistenceStorage.js';

// Incumbent detector
export {
  IncumbentDetector,
  createIncumbentDetector,
  KNOWN_INCUMBENTS,
  CONFIDENCE,
  type DetectionResult,
  type DetectionOptions,
} from './IncumbentDetector.js';

// Shadow ledger (Sprint 57)
export {
  ShadowLedger,
  createShadowLedger,
  type ShadowSyncOptions,
  type ShadowSyncResult,
  type ArrakisPrediction,
  type GetArrakisPredictions,
} from './ShadowLedger.js';

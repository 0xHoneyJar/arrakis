/**
 * E2E Test Vector Adapter
 *
 * Loads loa-hounfour golden vectors from the filesystem and re-exports
 * arrakis-specific E2E scenario vectors from packages/contracts.
 *
 * Two APIs:
 *   - getVector/getTestVectors: E2E scenario vectors (from packages/contracts)
 *   - loadVectorFile: raw loa-hounfour vectors for conformance suites (Sprint 2)
 *
 * @see PRD §4.1 (Vector Adapter Module)
 * @see SDD §3.1 (Vector Loader)
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';

// Re-export E2E scenario vectors from packages/contracts
export {
  getVector,
  CONTRACT_VERSION,
  validateContractCompatibility,
  type TestVector,
} from '../../../packages/contracts/src/index.js';

// Also re-export getTestVectors (local convenience — iterates all 9 E2E scenarios)
import { getVector as _getVector } from '../../../packages/contracts/src/index.js';

const E2E_SCENARIO_NAMES = [
  'invoke_free_tier',
  'invoke_pro_pool_routing',
  'invoke_stream_sse',
  'invoke_rate_limited',
  'invoke_budget_exceeded',
  'stream_abort_reconciliation',
  'invoke_byok',
  'invoke_ensemble_best_of_n',
  'invoke_ensemble_partial_failure',
] as const;

/** Get all 9 E2E scenario vectors */
export function getTestVectors() {
  return E2E_SCENARIO_NAMES.map((n) => _getVector(n));
}

// --------------------------------------------------------------------------
// loa-hounfour Vector Loader (for conformance suites)
// --------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const HOUNFOUR_ROOT = dirname(
  require.resolve('@0xhoneyjar/loa-hounfour/package.json'),
);

/**
 * Load a JSON vector file from the loa-hounfour package.
 *
 * loa-hounfour's package.json exports only "." and "./schemas/*" —
 * vectors are shipped in files but have no subpath export.
 * We resolve the package root via createRequire and read with fs.
 *
 * @param relativePath - Path relative to loa-hounfour root (e.g. 'vectors/budget/basic-pricing.json')
 * @returns Parsed JSON content
 */
export function loadVectorFile<T>(relativePath: string): T {
  const fullPath = resolve(join(HOUNFOUR_ROOT, relativePath));
  const root = resolve(HOUNFOUR_ROOT) + sep;
  if (!fullPath.startsWith(root)) {
    throw new Error('Invalid vector path — must be within loa-hounfour package');
  }
  const raw = readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw) as T;
}

/**
 * Vectors are always available — this module's existence proves the
 * dependency is installed and vectors are accessible.
 */
export const VECTORS_AVAILABLE = true;

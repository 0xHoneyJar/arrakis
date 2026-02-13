/**
 * E2E Test Vector Adapter
 *
 * Loads loa-hounfour golden vectors from the filesystem and provides
 * arrakis-specific E2E scenario vectors from the local fixture file.
 *
 * Two APIs:
 *   - getVector/getTestVectors: E2E scenario vectors (local fixture)
 *   - loadVectorFile: raw loa-hounfour vectors for conformance suites (Sprint 2)
 *
 * @see PRD §4.1 (Vector Adapter Module)
 * @see SDD §3.1 (Vector Loader)
 */

import { readFileSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Re-export protocol-level types from loa-hounfour
export { CONTRACT_VERSION, validateCompatibility } from '@0xhoneyjar/loa-hounfour';

// --------------------------------------------------------------------------
// E2E Scenario Vectors (arrakis-specific test fixtures)
// --------------------------------------------------------------------------

/** E2E test vector shape — arrakis gateway routing scenarios */
export interface TestVector {
  name: string;
  description: string;
  request: Record<string, unknown>;
  response: Record<string, unknown> & {
    stream_events?: Array<Record<string, unknown>>;
  };
  usage_report_payload: Record<string, unknown> | null;
}

interface TestVectors {
  version: string;
  description: string;
  vectors: TestVector[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_VECTORS: TestVectors = JSON.parse(
  readFileSync(join(__dirname, 'e2e-scenarios.json'), 'utf-8'),
) as TestVectors;

/** Get a single E2E scenario vector by name */
export function getVector(name: string): TestVector {
  const vector = E2E_VECTORS.vectors.find((v) => v.name === name);
  if (!vector) {
    throw new Error(
      `Test vector '${name}' not found. Available: ${E2E_VECTORS.vectors.map((v) => v.name).join(', ')}`,
    );
  }
  return vector;
}

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
  return E2E_SCENARIO_NAMES.map((n) => getVector(n));
}

// --------------------------------------------------------------------------
// loa-hounfour Vector Loader (for conformance suites)
// --------------------------------------------------------------------------

/** Resolve hounfour root via import.meta.resolve (ESM-safe, no exports map needed) */
const HOUNFOUR_ROOT = resolve(
  fileURLToPath(import.meta.resolve('@0xhoneyjar/loa-hounfour')),
  '..', '..',
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

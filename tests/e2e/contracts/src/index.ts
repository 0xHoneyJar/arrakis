/**
 * @arrakis/loa-finn-contract
 *
 * Contract artifacts for arrakis ↔ loa-finn integration.
 * Provides typed access to JSON Schema definitions and test vectors.
 *
 * Version is the single source of truth for pool_mapping_version JWT claim.
 *
 * @see SDD §3.2.3 Contract Artifact Package
 * @see Sprint 1, Task 1.4
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// --------------------------------------------------------------------------
// Version — single source of truth for pool_mapping_version JWT claim
// --------------------------------------------------------------------------

const pkg = require('../package.json') as { version: string };

/** Contract artifact version — used as pool_mapping_version JWT claim value */
export const CONTRACT_VERSION: string = pkg.version;

// --------------------------------------------------------------------------
// Compatibility Matrix
// --------------------------------------------------------------------------

export interface CompatibilityEntry {
  arrakis: string;
  loa_finn: string;
  contract: string;
  notes: string;
}

export interface CompatibilityMatrix {
  contract_version: string;
  compatibility: CompatibilityEntry[];
  breaking_changes: string[];
  deprecations: string[];
}

/** Compatibility matrix documenting which arrakis/loa-finn versions work together */
const COMPATIBILITY: CompatibilityMatrix =
  require('../compatibility.json') as CompatibilityMatrix;

/** Get the compatibility matrix for programmatic use */
export function getCompatibility(): CompatibilityMatrix {
  return COMPATIBILITY;
}

/**
 * Local-only contract version validation. Warns (does not fail) if the current
 * CONTRACT_VERSION has no matching entry in compatibility.json.
 *
 * This is purely local validation — it does NOT attempt to fetch loa-finn's
 * version at runtime (that would require a loa-finn API change, deferred).
 */
export function validateContractCompatibility(
  log?: { warn: (obj: Record<string, unknown>, msg: string) => void },
): boolean {
  const hasEntry = COMPATIBILITY.compatibility.some(
    (entry) => entry.contract === CONTRACT_VERSION,
  );
  if (!hasEntry && log) {
    log.warn(
      { contractVersion: CONTRACT_VERSION, availableEntries: COMPATIBILITY.compatibility.map((e) => e.contract) },
      'CONTRACT_VERSION has no matching entry in compatibility.json — update compatibility matrix',
    );
  }
  return hasEntry;
}

// --------------------------------------------------------------------------
// Schema
// --------------------------------------------------------------------------

export interface TierPoolMapping {
  default: string;
  allowed: string[];
}

export interface ContractSchema {
  version: string;
  description: string;
  schemas: {
    jwt_claims: Record<string, unknown>;
    invoke_response: Record<string, unknown>;
    usage_report: Record<string, unknown>;
    stream_events: Record<string, unknown>;
  };
  tier_pool_mapping: Record<string, TierPoolMapping>;
}

/** Full contract schema with JSON Schema definitions and tier pool mapping */
export const CONTRACT_SCHEMA: ContractSchema =
  require('../schema/loa-finn-contract.json') as ContractSchema;

// --------------------------------------------------------------------------
// Test Vectors
// --------------------------------------------------------------------------

export interface TestVectorUsageReport {
  pool_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_micro: number;
  accounting_mode?: string;
  usage_tokens?: number;
}

export interface TestVector {
  name: string;
  description: string;
  request: {
    jwt_claims: Record<string, unknown>;
    body: Record<string, unknown>;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    stream_events?: Array<Record<string, unknown>>;
    abort_after_events?: number;
    expect_reconciliation?: boolean;
  };
  usage_report_payload: TestVectorUsageReport | null;
}

export interface TestVectors {
  version: string;
  description: string;
  vectors: TestVector[];
}

/** Test vectors for E2E scenarios — decoded payload templates, NOT pre-signed JWS */
export const TEST_VECTORS: TestVectors =
  require('../vectors/loa-finn-test-vectors.json') as TestVectors;

/**
 * Get a test vector by name.
 * @throws Error if vector not found
 */
export function getVector(name: string): TestVector {
  const vector = TEST_VECTORS.vectors.find((v) => v.name === name);
  if (!vector) {
    throw new Error(
      `Test vector '${name}' not found. Available: ${TEST_VECTORS.vectors.map((v) => v.name).join(', ')}`,
    );
  }
  return vector;
}

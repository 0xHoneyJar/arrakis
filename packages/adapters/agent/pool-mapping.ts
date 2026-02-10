/**
 * Pool Mapping — Tier-Aware Pool Resolution
 * Sprint 3, Task 3.1: Hounfour Phase 4 — Spice Gate
 *
 * Maps model aliases to loa-finn pool IDs with tier-aware `native` handling.
 * Pool IDs match loa-finn vocabulary exactly: cheap, fast-code, reviewer, reasoning, architect.
 *
 * @see SDD §4.3 Pool Routing
 * @see ADR-005 Tier-Aware Native Resolution
 */

import type { AccessLevel, ModelAlias } from '@arrakis/core/ports';

// --------------------------------------------------------------------------
// Pool ID vocabulary (must match loa-finn pool-registry)
// --------------------------------------------------------------------------

export const POOL_IDS = ['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect'] as const;
export type PoolId = (typeof POOL_IDS)[number];

/** Set for O(1) validation */
export const VALID_POOL_IDS: ReadonlySet<string> = new Set(POOL_IDS);

// --------------------------------------------------------------------------
// Access Level → Pool mapping (from PRD §2.1)
// --------------------------------------------------------------------------

export const ACCESS_LEVEL_POOLS: Record<AccessLevel, { default: PoolId; allowed: PoolId[] }> = {
  free:       { default: 'cheap',     allowed: ['cheap'] },
  pro:        { default: 'fast-code', allowed: ['cheap', 'fast-code', 'reviewer'] },
  enterprise: { default: 'architect', allowed: ['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect'] },
};

// --------------------------------------------------------------------------
// Alias → Pool direct mapping (everything except `native`)
// --------------------------------------------------------------------------

export const ALIAS_TO_POOL: Partial<Record<ModelAlias, PoolId>> = {
  cheap: 'cheap',
  'fast-code': 'fast-code',
  reviewer: 'reviewer',
  reasoning: 'reasoning',
};

// `native` resolves tier-dependently — not in ALIAS_TO_POOL
const NATIVE_POOL: Record<AccessLevel, PoolId> = {
  free: 'cheap',        // Anti-escalation: free tier never gets expensive pool
  pro: 'fast-code',     // Pro tier default
  enterprise: 'architect', // Enterprise gets highest-capability pool
};

// --------------------------------------------------------------------------
// Pool Resolution
// --------------------------------------------------------------------------

export interface PoolResolution {
  poolId: PoolId;
  allowedPools: PoolId[];
}

/**
 * Resolve a model alias to a pool ID with tier-aware `native` handling.
 *
 * Resolution rules:
 * - No alias → tier default pool
 * - `native` → tier-aware (free→cheap, pro→fast-code, enterprise→architect)
 * - Direct alias (cheap, fast-code, etc.) → 1:1 pool mapping
 * - Unauthorized pool → silent fallback to tier default (AC-3.4)
 * - Unknown alias → tier default (defense-in-depth)
 */
export function resolvePoolId(
  modelAlias: ModelAlias | undefined,
  accessLevel: AccessLevel,
): PoolResolution {
  const { default: defaultPool, allowed: allowedPools } = ACCESS_LEVEL_POOLS[accessLevel];

  // No alias → use tier default
  if (!modelAlias) {
    return { poolId: defaultPool, allowedPools };
  }

  // native → tier-aware resolution
  if (modelAlias === 'native') {
    return { poolId: NATIVE_POOL[accessLevel], allowedPools };
  }

  // Direct alias → pool
  const pool = ALIAS_TO_POOL[modelAlias];
  if (!pool) {
    return { poolId: defaultPool, allowedPools };
  }

  // Verify authorized — fallback to tier default if not (AC-3.4)
  if (!allowedPools.includes(pool)) {
    return { poolId: defaultPool, allowedPools };
  }

  return { poolId: pool, allowedPools };
}

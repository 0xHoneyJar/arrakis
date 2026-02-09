/**
 * Tier→Access Mapper
 * Sprint S1-T3: Default mapping only (per-community overrides deferred to S3-T8)
 *
 * Maps community tier (1-9) → access level → allowed model aliases.
 * Config-driven with sensible defaults from PRD §2.1.
 *
 * @see SDD §4.3 Tier→Access Mapper
 * @see PRD FR-2.1 Default Tier Mapping
 */

import type { AccessLevel, ModelAlias } from '@arrakis/core/ports';

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

/** Mapping entry for a single tier */
export interface TierMapping {
  accessLevel: AccessLevel;
  aliases: ModelAlias[];
}

/** Configuration for the tier→access mapper */
export interface TierMappingConfig {
  /** Default tier→access mapping (used when no community override) */
  defaults: Record<number, TierMapping>;
}

// --------------------------------------------------------------------------
// Default Mapping (from PRD §2.1)
// --------------------------------------------------------------------------

/** Default tier→access mapping: 1-3→free, 4-6→pro, 7-9→enterprise */
export const DEFAULT_TIER_MAP: TierMappingConfig = {
  defaults: {
    1: { accessLevel: 'free', aliases: ['cheap'] },
    2: { accessLevel: 'free', aliases: ['cheap'] },
    3: { accessLevel: 'free', aliases: ['cheap'] },
    4: { accessLevel: 'pro', aliases: ['cheap', 'fast-code', 'reviewer'] },
    5: { accessLevel: 'pro', aliases: ['cheap', 'fast-code', 'reviewer'] },
    6: { accessLevel: 'pro', aliases: ['cheap', 'fast-code', 'reviewer'] },
    7: { accessLevel: 'enterprise', aliases: ['cheap', 'fast-code', 'reviewer', 'reasoning', 'native'] },
    8: { accessLevel: 'enterprise', aliases: ['cheap', 'fast-code', 'reviewer', 'reasoning', 'native'] },
    9: { accessLevel: 'enterprise', aliases: ['cheap', 'fast-code', 'reviewer', 'reasoning', 'native'] },
  },
};

// --------------------------------------------------------------------------
// Tier→Access Mapper
// --------------------------------------------------------------------------

export class TierAccessMapper {
  private readonly config: TierMappingConfig;

  constructor(config?: TierMappingConfig) {
    this.config = config ?? DEFAULT_TIER_MAP;
  }

  /**
   * Resolve access level and allowed model aliases for a given tier.
   * Sprint 1: Uses default mapping only.
   * Sprint 3 (S3-T8): Will add per-community PostgreSQL overrides + Redis cache.
   *
   * @param tier - Community tier (1-9)
   * @returns Access level and allowed model aliases
   * @throws Error if tier is out of range
   */
  resolveAccess(tier: number): { accessLevel: AccessLevel; allowedModelAliases: ModelAlias[] } {
    const mapping = this.config.defaults[tier];
    if (!mapping) {
      throw new Error(`Invalid tier: ${tier}. Expected 1-9.`);
    }
    return {
      accessLevel: mapping.accessLevel,
      allowedModelAliases: [...mapping.aliases],
    };
  }

  /**
   * Validate that a requested model alias is allowed for the user's access level.
   *
   * @param alias - Requested model alias
   * @param allowed - Array of allowed model aliases for the user's tier
   * @returns True if the alias is permitted
   */
  validateModelRequest(alias: ModelAlias, allowed: ModelAlias[]): boolean {
    return allowed.includes(alias);
  }
}

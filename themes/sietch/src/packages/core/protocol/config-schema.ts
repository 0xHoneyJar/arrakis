/**
 * Constitutional Parameter Schema Registry
 *
 * Every constitutional parameter has a strict typed schema defined here.
 * Proposals are validated against this schema BEFORE entering the governance
 * lifecycle, preventing runtime type errors in money-moving code paths.
 *
 * All durations are stored as integer seconds or days — no floating-point
 * values in value_json. No hours, no months.
 *
 * SDD refs: §3.4 Parameter Schema Registry
 * Sprint refs: Sprint 276, Task 2.3
 *
 * @module packages/core/protocol/config-schema
 */

// =============================================================================
// Schema Types
// =============================================================================

export interface ParamSchema {
  key: string;
  type: 'integer' | 'bigint_micro' | 'integer_seconds' | 'integer_percent' | 'nullable';
  min?: number;
  max?: number;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// =============================================================================
// Registry
// =============================================================================

export const CONFIG_SCHEMA: Record<string, ParamSchema> = {
  'kyc.basic_threshold_micro': {
    key: 'kyc.basic_threshold_micro',
    type: 'bigint_micro',
    min: 0,
    description: 'KYC basic tier threshold in micro-USD',
  },
  'kyc.enhanced_threshold_micro': {
    key: 'kyc.enhanced_threshold_micro',
    type: 'bigint_micro',
    min: 0,
    description: 'KYC enhanced tier threshold in micro-USD',
  },
  'settlement.hold_seconds': {
    key: 'settlement.hold_seconds',
    type: 'integer_seconds',
    min: 0,
    max: 604800,
    description: 'Settlement hold duration in seconds',
  },
  'payout.min_micro': {
    key: 'payout.min_micro',
    type: 'bigint_micro',
    min: 0,
    description: 'Minimum payout amount in micro-USD',
  },
  'payout.rate_limit_seconds': {
    key: 'payout.rate_limit_seconds',
    type: 'integer_seconds',
    min: 0,
    description: 'Minimum seconds between payouts per account',
  },
  'payout.fee_cap_percent': {
    key: 'payout.fee_cap_percent',
    type: 'integer_percent',
    min: 1,
    max: 100,
    description: 'Maximum fee as percentage of gross payout',
  },
  'revenue_rule.cooldown_seconds': {
    key: 'revenue_rule.cooldown_seconds',
    type: 'integer_seconds',
    min: 0,
    description: 'Revenue rule cooldown in seconds',
  },
  'fraud_rule.cooldown_seconds': {
    key: 'fraud_rule.cooldown_seconds',
    type: 'integer_seconds',
    min: 0,
    description: 'Fraud rule cooldown in seconds',
  },
  'reservation.default_ttl_seconds': {
    key: 'reservation.default_ttl_seconds',
    type: 'integer_seconds',
    min: 30,
    max: 3600,
    description: 'Default reservation TTL in seconds',
  },
  'referral.attribution_window_days': {
    key: 'referral.attribution_window_days',
    type: 'integer',
    min: 1,
    max: 730,
    description: 'Referral attribution window in days',
  },
  'agent.drip_recovery_pct': {
    key: 'agent.drip_recovery_pct',
    type: 'integer_percent',
    min: 1,
    max: 100,
    description: 'Percentage of each new agent earning applied to outstanding clawback receivable',
  },
};

// =============================================================================
// Compile-time Fallback Values
// =============================================================================

export const CONFIG_FALLBACKS: Record<string, number> = {
  'kyc.basic_threshold_micro': 100_000_000,
  'kyc.enhanced_threshold_micro': 600_000_000,
  'settlement.hold_seconds': 172_800,
  'payout.min_micro': 1_000_000,
  'payout.rate_limit_seconds': 86_400,
  'payout.fee_cap_percent': 20,
  'revenue_rule.cooldown_seconds': 172_800,
  'fraud_rule.cooldown_seconds': 604_800,
  'reservation.default_ttl_seconds': 300,
  'referral.attribution_window_days': 365,
  'agent.drip_recovery_pct': 50,
};

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a proposed config value against its schema.
 * Returns { valid: true } or { valid: false, error: '...' }.
 */
export function validateConfigValue(key: string, value: unknown): ValidationResult {
  const schema = CONFIG_SCHEMA[key];
  if (!schema) {
    return { valid: false, error: `Unknown parameter key: '${key}'` };
  }

  if (schema.type === 'nullable' && value === null) {
    return { valid: true };
  }

  // All non-nullable types must be a number (stored as JSON string in value_json)
  const numValue = typeof value === 'string' ? Number(value) : (typeof value === 'number' ? value : NaN);

  if (!Number.isFinite(numValue)) {
    return { valid: false, error: `Parameter '${key}' requires a numeric value, got: ${typeof value}` };
  }

  if (!Number.isInteger(numValue)) {
    return { valid: false, error: `Parameter '${key}' requires an integer value, got: ${numValue}` };
  }

  if (schema.min !== undefined && numValue < schema.min) {
    return { valid: false, error: `Parameter '${key}' value ${numValue} is below minimum ${schema.min}` };
  }

  if (schema.max !== undefined && numValue > schema.max) {
    return { valid: false, error: `Parameter '${key}' value ${numValue} exceeds maximum ${schema.max}` };
  }

  return { valid: true };
}

/**
 * BigInt Safety Utilities for Micro-USD Precision
 *
 * All monetary values in the credit ledger are stored as micro-USD (1 USD = 1,000,000 micro-USD).
 * These utilities enforce precision safety and prevent common BigInt/Number conversion bugs.
 *
 * SDD refs: §3.2 BigInt precision safety (end-to-end)
 * Sprint refs: Task 1.3
 */

import { z } from 'zod';

/**
 * Default ceiling: $1,000,000 in micro-USD.
 * Configurable via BILLING_CEILING_MICRO env var.
 * Sprint 3 adds billing_config table override.
 */
const DEFAULT_CEILING_MICRO = 1_000_000_000_000n; // $1M

function getCeilingMicro(): bigint {
  const envCeiling = process.env.BILLING_CEILING_MICRO;
  if (envCeiling) {
    try {
      const parsed = BigInt(envCeiling);
      if (parsed > 0n) return parsed;
    } catch {
      // Invalid env var — fall through to default
    }
  }
  return DEFAULT_CEILING_MICRO;
}

/**
 * Assert that a BigInt value is a valid micro-USD amount.
 * Rejects negative values and values exceeding the configurable ceiling.
 *
 * @throws {RangeError} if value is negative or exceeds ceiling
 */
export function assertMicroUSD(value: bigint): void {
  if (value < 0n) {
    throw new RangeError(`micro-USD value must be non-negative, got ${value}`);
  }
  const ceiling = getCeilingMicro();
  if (value > ceiling) {
    throw new RangeError(
      `micro-USD value ${value} exceeds ceiling ${ceiling} ($${Number(ceiling) / 1_000_000})`
    );
  }
}

/**
 * Zod schema for validating micro-USD amounts from string input.
 * Accepts string or number input, coerces to bigint.
 * Rejects negative values.
 */
export const microUsdSchema = z
  .union([z.string(), z.number()])
  .transform((val) => {
    try {
      return BigInt(val);
    } catch {
      throw new Error(`Cannot convert "${val}" to BigInt`);
    }
  })
  .refine((val) => val >= 0n, { message: 'micro-USD value must be non-negative' });

/**
 * Zod schema for validating micro-USD with ceiling check.
 * Use for API input validation.
 */
export const microUsdWithCeilingSchema = microUsdSchema
  .refine(
    (val) => val <= getCeilingMicro(),
    { message: `micro-USD value exceeds ceiling` }
  );

/**
 * Recursively serialize all BigInt values in an object to strings.
 * Required for JSON.stringify since BigInt is not JSON-serializable.
 *
 * @example
 * serializeBigInt({ amount: 5000000n, name: 'test' })
 * // => { amount: '5000000', name: 'test' }
 */
export function serializeBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeBigInt) as unknown as T;
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeBigInt(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Convert a dollar amount to micro-USD.
 * Uses BigInt arithmetic to avoid floating-point precision issues.
 *
 * @example
 * dollarsToMicro(1.50) // => 1500000n
 */
export function dollarsToMicro(dollars: number): bigint {
  // Multiply first, then round to avoid floating-point issues with BigInt conversion
  return BigInt(Math.round(dollars * 1_000_000));
}

/**
 * Convert micro-USD to a display-friendly dollar string.
 * For display only — never use the result in financial calculations.
 *
 * @example
 * microToDollarsDisplay(1500000n) // => '$1.50'
 */
export function microToDollarsDisplay(micro: bigint): string {
  const dollars = Number(micro) / 1_000_000;
  return `$${dollars.toFixed(2)}`;
}

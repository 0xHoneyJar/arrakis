/**
 * Budget Unit Bridge — micro-USD (loa-finn) ↔ micro-cents (arrakis)
 *
 * Pure function module. No class, no state, no dependencies.
 * All money values use bigint for 64-bit safe integer arithmetic.
 *
 * Conversion: micro_cents = micro_usd × 100
 *   loa-finn: 1 USD = 1,000,000 micro-USD
 *   arrakis:  1 USD = 100,000,000 micro-cents
 *
 * See: decisions/005-budget-unit-convention.md (ADR-005)
 */

const CONVERSION_FACTOR = 100n
const MAX_MICRO_USD = 100_000_000_000n // 100B µUSD = $100K per report (PRD cap)
const MAX_MICRO_CENTS = MAX_MICRO_USD * CONVERSION_FACTOR // 10T µ¢

/**
 * Convert micro-USD (loa-finn) to micro-cents (arrakis).
 * Lossless: multiply by 100.
 * @throws RangeError on negative or overflow
 */
export function microUsdToMicroCents(microUsd: bigint): bigint {
  assertValidMicroUnit(microUsd, 'microUsd')
  if (microUsd > MAX_MICRO_USD) {
    throw new RangeError(`microUsd ${microUsd} exceeds cap (max: ${MAX_MICRO_USD})`)
  }
  return microUsd * CONVERSION_FACTOR
}

/**
 * Convert micro-cents (arrakis) to micro-USD (loa-finn).
 * Lossy: floor division by 100. Only for display/reporting, NEVER for accounting.
 * @throws RangeError on negative
 */
export function microCentsToMicroUsd(microCents: bigint): bigint {
  assertValidMicroUnit(microCents, 'microCents')
  return microCents / CONVERSION_FACTOR // bigint division is floor by default
}

/**
 * Parse a JSON number or string into a bigint for money values.
 * Accepts: integer number within safe range, decimal string of digits, or bigint.
 * @throws TypeError on invalid input
 */
export function parseMicroUnit(value: unknown, name: string): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || !Number.isFinite(value) || value < 0) {
      throw new TypeError(`${name} must be a non-negative integer (got ${value})`)
    }
    return BigInt(value)
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value)
  }
  throw new TypeError(
    `${name} must be integer, bigint, or digit string (got ${typeof value})`
  )
}

function assertValidMicroUnit(value: bigint, name: string): void {
  if (value < 0n) {
    throw new RangeError(`${name} must be non-negative (got ${value})`)
  }
}

export { CONVERSION_FACTOR, MAX_MICRO_USD, MAX_MICRO_CENTS }

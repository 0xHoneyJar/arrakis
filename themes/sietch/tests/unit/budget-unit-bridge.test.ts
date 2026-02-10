import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  microUsdToMicroCents,
  microCentsToMicroUsd,
  parseMicroUnit,
  CONVERSION_FACTOR,
  MAX_MICRO_USD,
  MAX_MICRO_CENTS,
} from '../../../../packages/adapters/agent/budget-unit-bridge'

// Arbitrary for valid micro-USD bigint values (0 to MAX_MICRO_USD)
const microUsdArb = fc.bigInt({ min: 0n, max: MAX_MICRO_USD })

// Arbitrary for valid micro-cents bigint values (0 to MAX_MICRO_CENTS)
const microCentsArb = fc.bigInt({ min: 0n, max: MAX_MICRO_CENTS })

describe('BudgetUnitBridge', () => {
  describe('microUsdToMicroCents', () => {
    it('converts by multiplying by 100 (AC-4.2)', () => {
      fc.assert(
        fc.property(microUsdArb, (microUsd) => {
          expect(microUsdToMicroCents(microUsd)).toBe(microUsd * 100n)
        }),
        { numRuns: 1000 }
      )
    })

    it('converts known values correctly', () => {
      expect(microUsdToMicroCents(0n)).toBe(0n)
      expect(microUsdToMicroCents(1n)).toBe(100n)
      expect(microUsdToMicroCents(1_000_000n)).toBe(100_000_000n) // $1
      expect(microUsdToMicroCents(MAX_MICRO_USD)).toBe(MAX_MICRO_CENTS)
    })

    it('throws on negative input (AC-4.6)', () => {
      expect(() => microUsdToMicroCents(-1n)).toThrow(RangeError)
      expect(() => microUsdToMicroCents(-1000n)).toThrow(RangeError)
    })

    it('throws on overflow past MAX_MICRO_USD (AC-4.5)', () => {
      expect(() => microUsdToMicroCents(MAX_MICRO_USD + 1n)).toThrow(RangeError)
      expect(() => microUsdToMicroCents(MAX_MICRO_USD * 2n)).toThrow(RangeError)
    })
  })

  describe('microCentsToMicroUsd', () => {
    it('converts by floor dividing by 100', () => {
      fc.assert(
        fc.property(microCentsArb, (microCents) => {
          expect(microCentsToMicroUsd(microCents)).toBe(microCents / 100n)
        }),
        { numRuns: 1000 }
      )
    })

    it('converts known values correctly', () => {
      expect(microCentsToMicroUsd(0n)).toBe(0n)
      expect(microCentsToMicroUsd(100n)).toBe(1n)
      expect(microCentsToMicroUsd(100_000_000n)).toBe(1_000_000n) // $1
      expect(microCentsToMicroUsd(99n)).toBe(0n) // floor division
      expect(microCentsToMicroUsd(199n)).toBe(1n) // floor division
    })

    it('throws on negative input (AC-4.6)', () => {
      expect(() => microCentsToMicroUsd(-1n)).toThrow(RangeError)
    })
  })

  describe('round-trip properties', () => {
    it('microUsd → microCents → microUsd is lossless (AC-4.3)', () => {
      fc.assert(
        fc.property(microUsdArb, (microUsd) => {
          const microCents = microUsdToMicroCents(microUsd)
          expect(microCentsToMicroUsd(microCents)).toBe(microUsd)
        }),
        { numRuns: 1000 }
      )
    })

    it('microCents → microUsd → microCents is within 99 of original (AC-4.4)', () => {
      fc.assert(
        fc.property(microCentsArb, (microCents) => {
          const microUsd = microCentsToMicroUsd(microCents)
          const roundTripped = microUsdToMicroCents(microUsd)
          const diff = microCents - roundTripped
          expect(diff).toBeGreaterThanOrEqual(0n)
          expect(diff).toBeLessThan(100n) // bounded truncation loss
        }),
        { numRuns: 1000 }
      )
    })
  })

  describe('parseMicroUnit', () => {
    it('passes through bigint values', () => {
      expect(parseMicroUnit(42n, 'test')).toBe(42n)
      expect(parseMicroUnit(0n, 'test')).toBe(0n)
    })

    it('converts non-negative integer numbers to bigint', () => {
      expect(parseMicroUnit(0, 'test')).toBe(0n)
      expect(parseMicroUnit(42, 'test')).toBe(42n)
      expect(parseMicroUnit(1_000_000, 'test')).toBe(1_000_000n)
      expect(parseMicroUnit(Number.MAX_SAFE_INTEGER, 'test')).toBe(
        BigInt(Number.MAX_SAFE_INTEGER)
      )
    })

    it('converts digit strings to bigint', () => {
      expect(parseMicroUnit('0', 'test')).toBe(0n)
      expect(parseMicroUnit('42', 'test')).toBe(42n)
      expect(parseMicroUnit('100000000000', 'test')).toBe(100_000_000_000n)
    })

    it('throws on negative numbers (AC-4.6)', () => {
      expect(() => parseMicroUnit(-1, 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit(-0.5, 'cost')).toThrow(TypeError)
    })

    it('throws on non-integer numbers (AC-4.6)', () => {
      expect(() => parseMicroUnit(1.5, 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit(0.1, 'cost')).toThrow(TypeError)
    })

    it('throws on NaN and Infinity (AC-4.6)', () => {
      expect(() => parseMicroUnit(NaN, 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit(Infinity, 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit(-Infinity, 'cost')).toThrow(TypeError)
    })

    it('throws on non-digit strings', () => {
      expect(() => parseMicroUnit('abc', 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit('-1', 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit('1.5', 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit('', 'cost')).toThrow(TypeError)
    })

    it('throws on unsupported types', () => {
      expect(() => parseMicroUnit(null, 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit(undefined, 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit(true, 'cost')).toThrow(TypeError)
      expect(() => parseMicroUnit({}, 'cost')).toThrow(TypeError)
    })

    it('includes field name in error message', () => {
      expect(() => parseMicroUnit(-1, 'cost_micro')).toThrow('cost_micro')
    })
  })

  describe('constants', () => {
    it('CONVERSION_FACTOR is 100', () => {
      expect(CONVERSION_FACTOR).toBe(100n)
    })

    it('MAX_MICRO_USD represents $100K', () => {
      // 100,000 USD × 1,000,000 µUSD/USD = 100,000,000,000
      expect(MAX_MICRO_USD).toBe(100_000_000_000n)
    })

    it('MAX_MICRO_CENTS = MAX_MICRO_USD × 100', () => {
      expect(MAX_MICRO_CENTS).toBe(MAX_MICRO_USD * CONVERSION_FACTOR)
    })
  })
})

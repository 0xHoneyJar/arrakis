/**
 * S2SJwtValidator Unit Tests
 * Sprint 1 Task 1.4: AC-2.1 through AC-2.7
 *
 * Covers:
 * - ES256 signature validation from test JWKS
 * - JWKS caching: fresh (1h), stale-if-error (72h), hard reject
 * - Unknown kid → force refresh with cooldown
 * - Single-flight dedup (thundering herd)
 * - Cross-protocol typ enforcement (JWT vs JWS)
 * - Expired/wrong iss/aud rejection
 * - Clock-skew leeway behavior
 *
 * All TTL tests use FakeClock — no real-time waiting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SignJWT, CompactSign, exportJWK, importPKCS8 } from 'jose'
import { generateKeyPairSync, createPublicKey } from 'node:crypto'
import { S2SJwtValidator, type S2SJwtValidatorConfig } from '../../../../packages/adapters/agent/s2s-jwt-validator'
import type { Clock } from '../../../../packages/adapters/agent/clock'

// --------------------------------------------------------------------------
// FakeClock
// --------------------------------------------------------------------------

class FakeClock implements Clock {
  private _now: number
  constructor(startMs = Date.now()) { this._now = startMs }
  now() { return this._now }
  advance(ms: number) { this._now += ms }
  set(ms: number) { this._now = ms }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

function generateTestKeyPair() {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' })
}

async function getPublicJwk(privateKey: ReturnType<typeof generateTestKeyPair>['privateKey'], kid: string) {
  const publicKey = createPublicKey(privateKey)
  const jwk = await exportJWK(publicKey)
  return { ...jwk, kid, alg: 'ES256', use: 'sig', kty: 'EC' }
}

async function getPrivateKeyLike(privateKey: ReturnType<typeof generateTestKeyPair>['privateKey']) {
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
  return importPKCS8(pem, 'ES256')
}

/** Create a valid signed JWT for testing */
async function createTestJwt(
  privateKey: ReturnType<typeof generateTestKeyPair>['privateKey'],
  kid: string,
  overrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {},
) {
  const key = await getPrivateKeyLike(privateKey)
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    purpose: 'usage-report',
    report_id: 'rpt-123',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT', ...headerOverrides })
    .setIssuer('loa-finn')
    .setAudience('arrakis')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key)
}

/** Create a JWS compact serialization for testing */
async function createTestJws(
  privateKey: ReturnType<typeof generateTestKeyPair>['privateKey'],
  kid: string,
  payload: Uint8Array,
  headerOverrides: Record<string, unknown> = {},
) {
  const key = await getPrivateKeyLike(privateKey)
  return new CompactSign(payload)
    .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWS', ...headerOverrides })
    .sign(key)
}

function makeConfig(overrides: Partial<S2SJwtValidatorConfig> = {}): S2SJwtValidatorConfig {
  return {
    jwksUrl: 'https://loa-finn.test/.well-known/jwks.json',
    expectedIssuer: 'loa-finn',
    expectedAudience: 'arrakis',
    jwksCacheTtlMs: HOUR_MS,
    jwksStaleMaxMs: 72 * HOUR_MS,
    jwksRefreshCooldownMs: MINUTE_MS,
    clockToleranceSec: 30,
    ...overrides,
  }
}

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
  fatal: vi.fn(),
  trace: vi.fn(),
  level: 'silent',
  silent: vi.fn(),
} as any

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('S2SJwtValidator', () => {
  let clock: FakeClock
  let keyPairA: ReturnType<typeof generateTestKeyPair>
  let keyPairB: ReturnType<typeof generateTestKeyPair>
  let publicJwkA: Awaited<ReturnType<typeof getPublicJwk>>
  let publicJwkB: Awaited<ReturnType<typeof getPublicJwk>>
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    clock = new FakeClock(1_700_000_000_000) // fixed epoch
    keyPairA = generateTestKeyPair()
    keyPairB = generateTestKeyPair()
    publicJwkA = await getPublicJwk(keyPairA.privateKey, 'kid-a')
    publicJwkB = await getPublicJwk(keyPairB.privateKey, 'kid-b')

    // Default: JWKS returns key A
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [publicJwkA] }),
    })
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========================================================================
  // JWT Validation — Happy Path (AC-2.1)
  // ========================================================================
  describe('validateJwt — happy path (AC-2.1)', () => {
    it('validates a correctly signed ES256 JWT', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      const payload = await validator.validateJwt(token)
      expect(payload.iss).toBe('loa-finn')
      expect(payload.aud).toBe('arrakis')
      expect(payload.purpose).toBe('usage-report')
      expect(payload.report_id).toBe('rpt-123')
    })

    it('returns S2SJwtPayload with all required fields', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      const payload = await validator.validateJwt(token)
      expect(typeof payload.exp).toBe('number')
      expect(typeof payload.iat).toBe('number')
      expect(payload.exp).toBeGreaterThan(payload.iat)
    })
  })

  // ========================================================================
  // JWT Rejection — Wrong iss/aud/expired (AC-2.5, AC-2.6, AC-2.7)
  // ========================================================================
  describe('validateJwt — rejection', () => {
    it('rejects token with wrong issuer (AC-2.5)', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const key = await getPrivateKeyLike(keyPairA.privateKey)
      const now = Math.floor(Date.now() / 1000)
      const token = await new SignJWT({ purpose: 'usage-report' })
        .setProtectedHeader({ alg: 'ES256', kid: 'kid-a', typ: 'JWT' })
        .setIssuer('evil-service')
        .setAudience('arrakis')
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(key)

      await expect(validator.validateJwt(token)).rejects.toThrow()
    })

    it('rejects token with wrong audience (AC-2.6)', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const key = await getPrivateKeyLike(keyPairA.privateKey)
      const now = Math.floor(Date.now() / 1000)
      const token = await new SignJWT({ purpose: 'usage-report' })
        .setProtectedHeader({ alg: 'ES256', kid: 'kid-a', typ: 'JWT' })
        .setIssuer('loa-finn')
        .setAudience('wrong-service')
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(key)

      await expect(validator.validateJwt(token)).rejects.toThrow()
    })

    it('rejects expired token beyond leeway (AC-2.7)', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const key = await getPrivateKeyLike(keyPairA.privateKey)
      const now = Math.floor(Date.now() / 1000)
      // Expired 60s ago — beyond 30s leeway
      const token = await new SignJWT({ purpose: 'usage-report' })
        .setProtectedHeader({ alg: 'ES256', kid: 'kid-a', typ: 'JWT' })
        .setIssuer('loa-finn')
        .setAudience('arrakis')
        .setIssuedAt(now - 600)
        .setExpirationTime(now - 60)
        .sign(key)

      await expect(validator.validateJwt(token)).rejects.toThrow()
    })

    it('rejects token signed with unknown key', async () => {
      // JWKS returns key A, but token signed with key B
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)

      // Force refresh also returns only key A
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [publicJwkA] }),
      })

      const token = await createTestJwt(keyPairB.privateKey, 'kid-b')
      await expect(validator.validateJwt(token)).rejects.toThrow()
    })

    it('rejects token without typ: JWT', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      // Create JWT with typ: JWS (wrong)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a', {}, { typ: 'JWS' })
      await expect(validator.validateJwt(token)).rejects.toThrow('typ: JWT')
    })
  })

  // ========================================================================
  // Clock-Skew Leeway
  // ========================================================================
  describe('validateJwt — clock-skew leeway', () => {
    it('accepts token expired 10s ago with 30s leeway', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const key = await getPrivateKeyLike(keyPairA.privateKey)
      const now = Math.floor(Date.now() / 1000)
      const token = await new SignJWT({ purpose: 'usage-report' })
        .setProtectedHeader({ alg: 'ES256', kid: 'kid-a', typ: 'JWT' })
        .setIssuer('loa-finn')
        .setAudience('arrakis')
        .setIssuedAt(now - 320)
        .setExpirationTime(now - 10)
        .sign(key)

      // Should succeed — 10s within 30s leeway
      const payload = await validator.validateJwt(token)
      expect(payload.iss).toBe('loa-finn')
    })

    it('rejects token expired 60s ago with 30s leeway', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const key = await getPrivateKeyLike(keyPairA.privateKey)
      const now = Math.floor(Date.now() / 1000)
      const token = await new SignJWT({ purpose: 'usage-report' })
        .setProtectedHeader({ alg: 'ES256', kid: 'kid-a', typ: 'JWT' })
        .setIssuer('loa-finn')
        .setAudience('arrakis')
        .setIssuedAt(now - 600)
        .setExpirationTime(now - 60)
        .sign(key)

      await expect(validator.validateJwt(token)).rejects.toThrow()
    })
  })

  // ========================================================================
  // JWS Verification (Cross-Protocol Safety)
  // ========================================================================
  describe('verifyJws — cross-protocol typ enforcement', () => {
    it('verifies a valid JWS with typ: JWS', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const payload = new TextEncoder().encode('{"cost_micro_usd":42000}')
      const jws = await createTestJws(keyPairA.privateKey, 'kid-a', payload)

      const result = await validator.verifyJws(jws)
      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded.cost_micro_usd).toBe(42000)
    })

    it('rejects JWS with typ: JWT (cross-protocol guard)', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const payload = new TextEncoder().encode('{"cost_micro_usd":42000}')
      const jws = await createTestJws(keyPairA.privateKey, 'kid-a', payload, { typ: 'JWT' })

      await expect(validator.verifyJws(jws)).rejects.toThrow('must not have typ: JWT')
    })

    it('returns raw Uint8Array payload', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const raw = new TextEncoder().encode('hello world')
      const jws = await createTestJws(keyPairA.privateKey, 'kid-a', raw)

      const result = await validator.verifyJws(jws)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(new TextDecoder().decode(result)).toBe('hello world')
    })
  })

  // ========================================================================
  // JWKS Caching — Fresh (AC-2.2)
  // ========================================================================
  describe('JWKS caching — fresh cache (AC-2.2)', () => {
    it('caches JWKS for 1h without refetch', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Advance 59 minutes — still fresh
      clock.advance(59 * MINUTE_MS)
      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('refreshes JWKS after 1h TTL', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Advance past 1h
      clock.advance(61 * MINUTE_MS)
      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  })

  // ========================================================================
  // JWKS Caching — Unknown kid refresh (AC-2.2)
  // ========================================================================
  describe('JWKS caching — unknown kid triggers refresh (AC-2.2)', () => {
    it('force-refreshes when encountering unknown kid', async () => {
      // First fetch returns only key A
      fetchSpy
        .mockResolvedValueOnce({ ok: true, json: async () => ({ keys: [publicJwkA] }) })
        // Second fetch (forced) returns both keys
        .mockResolvedValueOnce({ ok: true, json: async () => ({ keys: [publicJwkA, publicJwkB] }) })

      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)

      // First validation with kid-a succeeds, fetches JWKS
      const tokenA = await createTestJwt(keyPairA.privateKey, 'kid-a')
      await validator.validateJwt(tokenA)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Advance past cooldown (60s)
      clock.advance(61_000)

      // Now validate with kid-b — triggers force refresh
      const tokenB = await createTestJwt(keyPairB.privateKey, 'kid-b')
      await validator.validateJwt(tokenB)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  })

  // ========================================================================
  // JWKS Caching — Stale-if-error (AC-2.3)
  // ========================================================================
  describe('JWKS caching — stale-if-error (AC-2.3)', () => {
    it('serves stale JWKS on fetch failure within 72h window', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      // First fetch succeeds
      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Advance past 1h TTL, make fetch fail
      clock.advance(2 * HOUR_MS)
      fetchSpy.mockRejectedValue(new Error('JWKS endpoint down'))

      // Should still work — serving stale cache (2h old, within 72h)
      const payload = await validator.validateJwt(token)
      expect(payload.iss).toBe('loa-finn')
    })
  })

  // ========================================================================
  // JWKS Caching — Hard reject after 72h (AC-2.4)
  // ========================================================================
  describe('JWKS caching — hard reject after 72h (AC-2.4)', () => {
    it('rejects all tokens when stale cache exceeds 72h', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      // First fetch succeeds
      await validator.validateJwt(token)

      // Advance past 72h, make all fetches fail
      clock.advance(73 * HOUR_MS)
      fetchSpy.mockRejectedValue(new Error('JWKS endpoint down'))

      await expect(validator.validateJwt(token)).rejects.toThrow('JWKS unavailable')
    })
  })

  // ========================================================================
  // JWKS Caching — Cooldown (AC-2.2)
  // ========================================================================
  describe('JWKS caching — refresh cooldown', () => {
    it('respects 60s cooldown between refresh attempts', async () => {
      // First fetch succeeds
      fetchSpy
        .mockResolvedValueOnce({ ok: true, json: async () => ({ keys: [publicJwkA] }) })
        // Second fetch (after TTL) fails
        .mockRejectedValueOnce(new Error('down'))
        // Third fetch (after cooldown) succeeds
        .mockResolvedValueOnce({ ok: true, json: async () => ({ keys: [publicJwkA] }) })

      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      // First call — fetch succeeds
      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Advance past TTL
      clock.advance(61 * MINUTE_MS)

      // Second call — fetch fails, serves stale
      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      // Advance 30s — still in cooldown
      clock.advance(30_000)

      // Third call — cooldown active, serves stale without fetching
      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(2) // no new fetch

      // Advance past cooldown (30s more = 60s total)
      clock.advance(31_000)

      // Fourth call — cooldown expired, fetches again
      await validator.validateJwt(token)
      expect(fetchSpy).toHaveBeenCalledTimes(3)
    })
  })

  // ========================================================================
  // Single-flight dedup (thundering herd)
  // ========================================================================
  describe('JWKS — single-flight dedup', () => {
    it('concurrent validateJwt calls share a single JWKS fetch', async () => {
      // Slow fetch to simulate concurrent requests
      let resolvePromise: (v: any) => void
      fetchSpy.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve
        }),
      )

      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      // Launch 5 concurrent validations
      const promises = Array.from({ length: 5 }, () =>
        validator.validateJwt(token),
      )

      // Resolve the single inflight fetch
      resolvePromise!({
        ok: true,
        json: async () => ({ keys: [publicJwkA] }),
      })

      const results = await Promise.all(promises)
      expect(results).toHaveLength(5)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  // ========================================================================
  // JWKS fetch error handling
  // ========================================================================
  describe('JWKS — fetch error handling', () => {
    it('throws when JWKS has no keys', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [] }),
      })

      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      await expect(validator.validateJwt(token)).rejects.toThrow('no keys')
    })

    it('throws on HTTP error with no stale cache', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 })

      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      await expect(validator.validateJwt(token)).rejects.toThrow('JWKS unavailable')
    })
  })

  // ========================================================================
  // JWT Schema Version Extraction (Bridgebuilder F-10, T1.2)
  // ========================================================================
  describe('validateJwt — v claim extraction (F-10)', () => {
    it('validateJwt extracts v from payload', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a', { v: 1 })

      const payload = await validator.validateJwt(token)
      expect(payload.v).toBe(1)
    })

    it('validateJwt returns v=undefined for legacy tokens', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      // Token without v claim (legacy format)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a')

      const payload = await validator.validateJwt(token)
      expect(payload.v).toBeUndefined()
    })

    it('validateJwt ignores non-numeric v claim', async () => {
      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const token = await createTestJwt(keyPairA.privateKey, 'kid-a', { v: 'not-a-number' })

      const payload = await validator.validateJwt(token)
      expect(payload.v).toBeUndefined()
    })
  })

  // ========================================================================
  // Key resolution fallback
  // ========================================================================
  describe('key resolution', () => {
    it('uses first EC key when token has no kid', async () => {
      // Create a token without kid
      const key = await getPrivateKeyLike(keyPairA.privateKey)
      const now = Math.floor(Date.now() / 1000)
      const token = await new SignJWT({ purpose: 'usage-report' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT' }) // no kid
        .setIssuer('loa-finn')
        .setAudience('arrakis')
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(key)

      const validator = new S2SJwtValidator(makeConfig(), noopLogger, clock)
      const payload = await validator.validateJwt(token)
      expect(payload.iss).toBe('loa-finn')
    })
  })
})

/**
 * JWKS E2E Contract Tests — Full JWT Round-Trip with Pool Routing
 * Sprint 3, Task 3.5: Hounfour Phase 4 — Spice Gate
 *
 * Validates:
 * - Full 19-claim JWT round-trip (sign → JWKS → verify)
 * - Pool routing claims (pool_id, allowed_pools) correctness
 * - Key rotation overlap (old key still validates)
 * - Expired token rejection
 * - req_hash wire-binding (tampering detected)
 * - Unknown kid handling
 *
 * @see SDD §7.2.2 JWKS Caching & Key Rotation Contract
 * @see AC-3.1 through AC-5.4
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'

// Mock fs before barrel imports (budget-manager loads Lua at module level)
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue('-- mock lua'),
  }
})

import { JwtService, type Clock, computeReqHash, POOL_IDS, VALID_POOL_IDS } from '../../../../packages/adapters/agent'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import {
  generateTestKey,
  startJwksServer,
  signTestJwt,
  type TestKeyPair,
  type JwksTestServer,
} from '../helpers/jwks-test-server'

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
// Constants
// --------------------------------------------------------------------------

const HOUR_MS = 3_600_000

/** Full 19-claim test context (includes pool routing claims) */
function createFullContext(overrides?: Partial<Record<string, unknown>>) {
  return {
    tenantId: 'community-abc123',
    userId: '0x1234567890abcdef1234567890abcdef12345678',
    nftId: 'nft-42',
    tier: 7,
    accessLevel: 'enterprise' as const,
    allowedModelAliases: ['cheap', 'fast-code', 'reviewer', 'reasoning', 'native'] as any,
    poolId: 'architect',
    allowedPools: ['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect'],
    platform: 'discord' as const,
    channelId: 'channel-xyz',
    idempotencyKey: 'idem-e2e-001',
    traceId: 'trace-e2e-001',
    ...overrides,
  }
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('JWKS E2E Contract Tests — Full JWT Round-Trip (Sprint 3)', () => {
  let clock: FakeClock
  let currentKey: TestKeyPair
  let previousKey: TestKeyPair
  let server: JwksTestServer

  beforeAll(async () => {
    currentKey = await generateTestKey('kid-current-e2e')
    previousKey = await generateTestKey('kid-previous-e2e')
  })

  beforeEach(async () => {
    clock = new FakeClock(Date.now())
    server = await startJwksServer([currentKey])
  })

  afterAll(async () => {
    // server is cleaned up per-test in afterEach-like patterns
  })

  async function createService(opts?: {
    keyId?: string
    previousKey?: TestKeyPair
    expiresAtMs?: number
  }) {
    const keyId = opts?.keyId ?? currentKey.kid
    const service = new JwtService(
      {
        keyId,
        expirySec: 120,
        ...(opts?.previousKey
          ? {
            previousKey: {
              keyId: opts.previousKey.kid,
              privateKey: opts.previousKey.privateKeyLike,
              publicJwk: opts.previousKey.publicJwk,
              expiresAt: new Date(opts.expiresAtMs ?? clock.now() + 48 * HOUR_MS),
            },
          }
          : {}),
      },
      { load: async () => currentKey.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string },
      clock,
    )
    await service.initialize()
    return service
  }

  function decodePayload(token: string): Record<string, unknown> {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  }

  function decodeHeader(token: string): Record<string, unknown> {
    return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
  }

  // ========================================================================
  // 1. Full JWT Round-Trip — 19 claims (AC-3.1, AC-5.1)
  // ========================================================================
  describe('Full JWT round-trip — 19 claims', () => {
    it('sign() produces JWT with all 19 claims correctly typed', async () => {
      const service = await createService()
      const context = createFullContext()
      const body = '{"messages":[{"role":"user","content":"hello"}]}'
      const token = await service.sign(context, body)

      const payload = decodePayload(token)
      const header = decodeHeader(token)

      // Standard JWT claims (7)
      expect(payload.iss).toBe('arrakis')
      expect(payload.sub).toBe(context.userId)
      expect(payload.aud).toBe('loa-finn')
      expect(typeof payload.iat).toBe('number')
      expect(typeof payload.exp).toBe('number')
      expect(typeof payload.jti).toBe('string')
      expect(header.alg).toBe('ES256')

      // Custom application claims (10)
      expect(payload.tenant_id).toBe(context.tenantId)
      expect(payload.nft_id).toBe(context.nftId)
      expect(payload.tier).toBe(context.tier)
      expect(typeof payload.tier_name).toBe('string')
      expect(payload.access_level).toBe(context.accessLevel)
      expect(payload.allowed_model_aliases).toEqual(context.allowedModelAliases)
      expect(payload.platform).toBe(context.platform)
      expect(payload.channel_id).toBe(context.channelId)
      expect(payload.idempotency_key).toBe(context.idempotencyKey)
      expect(typeof payload.req_hash).toBe('string')

      // Pool routing claims (2) — NEW in Sprint 3
      expect(payload.pool_id).toBe('architect')
      expect(payload.allowed_pools).toEqual(['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect'])

      await server.close()
    })

    it('req_hash matches independently computed hash', async () => {
      const service = await createService()
      const body = '{"messages":[{"role":"user","content":"test req_hash binding"}]}'
      const token = await service.sign(createFullContext(), body)

      const payload = decodePayload(token)
      const expectedHash = computeReqHash(body)
      expect(payload.req_hash).toBe(expectedHash)

      await server.close()
    })

    it('jti is a valid UUID', async () => {
      const service = await createService()
      const token = await service.sign(createFullContext(), '{}')
      const payload = decodePayload(token)

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      expect(payload.jti).toMatch(uuidRegex)

      await server.close()
    })

    it('exp = iat + 120 (configured expiry)', async () => {
      const service = await createService()
      const token = await service.sign(createFullContext(), '{}')
      const payload = decodePayload(token)

      expect((payload.exp as number) - (payload.iat as number)).toBe(120)

      await server.close()
    })
  })

  // ========================================================================
  // 2. Pool routing claims validation (AC-3.2, AC-3.4)
  // ========================================================================
  describe('Pool routing claims validation', () => {
    it('pool_id is a valid pool ID', async () => {
      const service = await createService()
      const token = await service.sign(createFullContext({ poolId: 'reasoning' }), '{}')
      const payload = decodePayload(token)

      expect(VALID_POOL_IDS.has(payload.pool_id as string)).toBe(true)

      await server.close()
    })

    it('allowed_pools contains only valid pool IDs', async () => {
      const service = await createService()
      const token = await service.sign(createFullContext(), '{}')
      const payload = decodePayload(token)

      const pools = payload.allowed_pools as string[]
      expect(Array.isArray(pools)).toBe(true)
      expect(pools.length).toBeGreaterThan(0)
      for (const pool of pools) {
        expect(VALID_POOL_IDS.has(pool)).toBe(true)
      }

      await server.close()
    })

    it('free tier: pool_id=cheap, allowed_pools=[cheap]', async () => {
      const service = await createService()
      const context = createFullContext({
        tier: 2,
        accessLevel: 'free',
        poolId: 'cheap',
        allowedPools: ['cheap'],
      })
      const token = await service.sign(context, '{}')
      const payload = decodePayload(token)

      expect(payload.pool_id).toBe('cheap')
      expect(payload.allowed_pools).toEqual(['cheap'])

      await server.close()
    })

    it('enterprise tier: all 5 pools available', async () => {
      const service = await createService()
      const token = await service.sign(createFullContext(), '{}')
      const payload = decodePayload(token)

      expect(payload.allowed_pools).toEqual(
        ['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect'],
      )

      await server.close()
    })

    it('pool_id and allowed_pools are undefined when not set in context', async () => {
      const service = await createService()
      // Context without pool fields — backward compat
      const context = createFullContext()
      delete (context as any).poolId
      delete (context as any).allowedPools
      const token = await service.sign(context, '{}')
      const payload = decodePayload(token)

      // Should be undefined (not included in JWT)
      expect(payload.pool_id).toBeUndefined()
      expect(payload.allowed_pools).toBeUndefined()

      await server.close()
    })
  })

  // ========================================================================
  // 3. Key rotation overlap (AC-5.2)
  // ========================================================================
  describe('Key rotation overlap — old key still validates', () => {
    it('JWT signed with current key validates via JWKS', async () => {
      server.setKeys([currentKey])
      const jwks = createRemoteJWKSet(new URL(`${server.url}/.well-known/jwks.json`))

      const service = await createService()
      const token = await service.sign(createFullContext(), '{}')

      const { payload } = await jwtVerify(token, jwks, {
        issuer: 'arrakis',
        audience: 'loa-finn',
      })
      expect(payload.tenant_id).toBe('community-abc123')

      await server.close()
    })

    it('both old and new JWTs validate during overlap', async () => {
      // Serve both keys
      server.setKeys([currentKey, previousKey])
      const jwks = createRemoteJWKSet(new URL(`${server.url}/.well-known/jwks.json`))

      // Sign with current key
      const service = await createService({ previousKey })
      const tokenNew = await service.sign(createFullContext(), '{}')

      // Sign directly with previous key (simulating old token)
      const tokenOld = await signTestJwt(previousKey, {
        iss: 'arrakis',
        sub: '0xOldUser',
        aud: 'loa-finn',
        tenant_id: 'community-old',
        tier: 5,
        access_level: 'pro',
      })

      // Both should validate
      const resultNew = await jwtVerify(tokenNew, jwks, { issuer: 'arrakis', audience: 'loa-finn' })
      expect(resultNew.payload.tenant_id).toBe('community-abc123')

      const resultOld = await jwtVerify(tokenOld, jwks, { issuer: 'arrakis', audience: 'loa-finn' })
      expect(resultOld.payload.tenant_id).toBe('community-old')

      await server.close()
    })

    it('old JWT rejected after old key removed from JWKS', async () => {
      // Start with both keys
      server.setKeys([currentKey, previousKey])
      const jwks = createRemoteJWKSet(new URL(`${server.url}/.well-known/jwks.json`))

      // Sign with previous key
      const tokenOld = await signTestJwt(previousKey, {
        iss: 'arrakis',
        sub: '0xOldUser',
        aud: 'loa-finn',
        tenant_id: 'old-community',
        tier: 1,
        access_level: 'free',
      })

      // Verify it works initially
      await jwtVerify(tokenOld, jwks, { issuer: 'arrakis', audience: 'loa-finn' })

      // Remove old key — only serve current
      server.setKeys([currentKey])

      // Create a fresh JWKS fetcher (simulating cache expiry)
      const freshJwks = createRemoteJWKSet(new URL(`${server.url}/.well-known/jwks.json`))

      // Old token should fail with fresh JWKS
      await expect(
        jwtVerify(tokenOld, freshJwks, { issuer: 'arrakis', audience: 'loa-finn' }),
      ).rejects.toThrow()

      await server.close()
    })
  })

  // ========================================================================
  // 4. Expired token rejection (AC-5.3)
  // ========================================================================
  describe('Expired token rejection', () => {
    it('rejects JWT with exp in the past', async () => {
      server.setKeys([currentKey])
      const jwks = createRemoteJWKSet(new URL(`${server.url}/.well-known/jwks.json`))

      // Sign with iat and exp in the past
      const pastIat = Math.floor(Date.now() / 1000) - 300
      const token = await signTestJwt(currentKey, {
        iss: 'arrakis',
        sub: '0xExpired',
        aud: 'loa-finn',
        tenant_id: 'community-expired',
      }, { iat: pastIat, expirySec: 120 }) // exp = pastIat + 120 = ~180s ago

      await expect(
        jwtVerify(token, jwks, { issuer: 'arrakis', audience: 'loa-finn' }),
      ).rejects.toThrow()

      await server.close()
    })
  })

  // ========================================================================
  // 5. req_hash tampering detection (AC-5.4)
  // ========================================================================
  describe('req_hash wire-binding — tampering detection', () => {
    it('req_hash mismatch detected when body tampered', async () => {
      const service = await createService()
      const originalBody = '{"messages":[{"role":"user","content":"original"}]}'
      const token = await service.sign(createFullContext(), originalBody)
      const payload = decodePayload(token)

      // Tamper with body
      const tamperedBody = '{"messages":[{"role":"user","content":"tampered"}]}'
      const tamperedHash = computeReqHash(tamperedBody)

      // req_hash should NOT match tampered body
      expect(payload.req_hash).not.toBe(tamperedHash)
      // But should match original
      expect(payload.req_hash).toBe(computeReqHash(originalBody))

      await server.close()
    })

    it('single byte change produces different req_hash', async () => {
      const service = await createService()
      const body1 = '{"a":1}'
      const body2 = '{"a":2}'

      const token1 = await service.sign(createFullContext(), body1)
      const token2 = await service.sign(createFullContext(), body2)

      const hash1 = decodePayload(token1).req_hash
      const hash2 = decodePayload(token2).req_hash

      expect(hash1).not.toBe(hash2)

      await server.close()
    })
  })

  // ========================================================================
  // 6. Unknown kid handling
  // ========================================================================
  describe('Unknown kid handling', () => {
    it('JWT with unknown kid fails validation', async () => {
      // Server only has currentKey
      server.setKeys([currentKey])
      const jwks = createRemoteJWKSet(new URL(`${server.url}/.well-known/jwks.json`))

      // Sign with a completely unknown key
      const unknownKey = await generateTestKey('kid-unknown-xyz')
      const token = await signTestJwt(unknownKey, {
        iss: 'arrakis',
        sub: '0xUnknown',
        aud: 'loa-finn',
        tenant_id: 'community-unknown',
      })

      await expect(
        jwtVerify(token, jwks, { issuer: 'arrakis', audience: 'loa-finn' }),
      ).rejects.toThrow()

      await server.close()
    })
  })

  // ========================================================================
  // 7. Pool resolution round-trip (all tiers)
  // ========================================================================
  describe('Pool resolution round-trip — all tiers', () => {
    it.each([
      { tier: 1, accessLevel: 'free', expectedPool: 'cheap', expectedPools: ['cheap'] },
      { tier: 4, accessLevel: 'pro', expectedPool: 'fast-code', expectedPools: ['cheap', 'fast-code', 'reviewer'] },
      { tier: 7, accessLevel: 'enterprise', expectedPool: 'architect', expectedPools: ['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect'] },
    ])('tier $tier ($accessLevel): pool_id=$expectedPool', async ({ tier, accessLevel, expectedPool, expectedPools }) => {
      const service = await createService()
      const context = createFullContext({
        tier,
        accessLevel,
        poolId: expectedPool,
        allowedPools: expectedPools,
      })
      const token = await service.sign(context, '{}')
      const payload = decodePayload(token)

      expect(payload.pool_id).toBe(expectedPool)
      expect(payload.allowed_pools).toEqual(expectedPools)

      await server.close()
    })
  })

  // ========================================================================
  // 8. JWKS endpoint contract
  // ========================================================================
  describe('JWKS endpoint contract', () => {
    it('serves correct Content-Type and Cache-Control headers', async () => {
      const res = await fetch(`${server.url}/.well-known/jwks.json`)

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/json')
      expect(res.headers.get('cache-control')).toContain('public')
      expect(res.headers.get('cache-control')).toContain('max-age=3600')

      await server.close()
    })

    it('returns 404 for non-JWKS paths', async () => {
      const res = await fetch(`${server.url}/other`)
      expect(res.status).toBe(404)

      await server.close()
    })

    it('JWKS keys have required JWK fields', async () => {
      const res = await fetch(`${server.url}/.well-known/jwks.json`)
      const jwks = await res.json()

      expect(jwks.keys.length).toBeGreaterThan(0)
      for (const key of jwks.keys) {
        expect(key.kid).toBeDefined()
        expect(key.alg).toBe('ES256')
        expect(key.use).toBe('sig')
        expect(key.kty).toBe('EC')
        expect(key.crv).toBe('P-256')
        expect(key.x).toBeDefined()
        expect(key.y).toBeDefined()
        // Must NOT have private key material
        expect(key.d).toBeUndefined()
      }

      await server.close()
    })
  })
})

/**
 * JwtService Unit Tests
 * Bridgebuilder Round 2 — Sprint 1 (T1.1, T1.5)
 *
 * Covers:
 *   - v=1 schema version claim present in signed tokens
 *   - Contract test: v claim accepted by S2SJwtValidator round-trip (GPT-R1)
 *
 * @see Bridgebuilder F-10
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { jwtVerify, importPKCS8, exportJWK, importJWK } from 'jose'
import { generateKeyPairSync, createPublicKey } from 'node:crypto'
import { JwtService, type JwtServiceConfig, type KeyLoader } from '../../../../packages/adapters/agent/jwt-service'
import { S2SJwtValidator, type S2SJwtValidatorConfig } from '../../../../packages/adapters/agent/s2s-jwt-validator'
import type { AgentRequestContext } from '../../../../packages/core/ports'
import type { Clock } from '../../../../packages/adapters/agent/clock'

// --------------------------------------------------------------------------
// Test fixtures
// --------------------------------------------------------------------------

function generateTestKeyPair() {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' })
}

function makeContext(overrides: Partial<AgentRequestContext> = {}): AgentRequestContext {
  return {
    tenantId: 'community-1',
    userId: 'user-1',
    channelId: 'channel-1',
    traceId: 'trace-1',
    idempotencyKey: 'idem-1',
    accessLevel: 'pro',
    tier: 4,
    nftId: 'nft-1',
    platform: 'discord',
    allowedModelAliases: ['cheap', 'fast-code', 'reviewer'],
    poolId: 'fast-code',
    allowedPools: ['cheap', 'fast-code', 'reviewer'],
    ...overrides,
  } as AgentRequestContext
}

const REAL_CLOCK: Clock = { now: () => Date.now() }

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

describe('JwtService — schema version claim (F-10)', () => {
  let keyPair: ReturnType<typeof generateTestKeyPair>
  let jwtService: JwtService
  let publicJwk: any

  beforeAll(async () => {
    keyPair = generateTestKeyPair()
    const pem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

    const keyLoader: KeyLoader = { load: async () => pem }
    const config: JwtServiceConfig = {
      keyId: 'test-kid-1',
      expirySec: 120,
    }

    jwtService = new JwtService(config, keyLoader, REAL_CLOCK)
    await jwtService.initialize()

    const pub = createPublicKey(keyPair.privateKey)
    publicJwk = await exportJWK(pub)
  })

  it('sign() includes schema version v=1', async () => {
    const token = await jwtService.sign(makeContext(), '{"test":"body"}')

    // Decode without verification to inspect claims
    const key = await importJWK({ ...publicJwk, alg: 'ES256' }, 'ES256')
    const { payload } = await jwtVerify(token, key, {
      issuer: 'arrakis',
      audience: 'loa-finn',
    })

    expect((payload as any).v).toBe(1)
  })

  it('v claim is an integer, not a string', async () => {
    const token = await jwtService.sign(makeContext(), '{"test":"body"}')

    const key = await importJWK({ ...publicJwk, alg: 'ES256' }, 'ES256')
    const { payload } = await jwtVerify(token, key, {
      issuer: 'arrakis',
      audience: 'loa-finn',
    })

    expect(typeof (payload as any).v).toBe('number')
    expect(Number.isInteger((payload as any).v)).toBe(true)
  })

  it('v claim accepted by S2SJwtValidator (contract test — GPT-R1)', async () => {
    // This proves loa-finn-style validation tolerates the new v claim.
    // The S2SJwtValidator uses the same ES256 + JWKS verification chain as loa-finn.

    // Sign a token with JwtService (arrakis → loa-finn direction)
    const token = await jwtService.sign(makeContext(), '{"test":"body"}')

    // Create a validator that trusts our test key (simulating loa-finn validating arrakis tokens)
    // We need to mock fetch to return our JWKS
    const jwksUrl = 'https://arrakis.test/.well-known/jwks.json'
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [{ ...publicJwk, kid: 'test-kid-1', alg: 'ES256', use: 'sig', kty: 'EC' }],
      }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    try {
      const validatorConfig: S2SJwtValidatorConfig = {
        jwksUrl,
        expectedIssuer: 'arrakis',
        expectedAudience: 'loa-finn',
        jwksCacheTtlMs: 3_600_000,
        jwksStaleMaxMs: 259_200_000,
        jwksRefreshCooldownMs: 60_000,
        clockToleranceSec: 30,
      }

      const validator = new S2SJwtValidator(validatorConfig, noopLogger, REAL_CLOCK)
      // validateJwt should succeed — v claim is an additional claim, RFC 7519 §4.3 tolerates it
      const payload = await validator.validateJwt(token)

      expect(payload.iss).toBe('arrakis')
      expect(payload.aud).toBe('loa-finn')
      expect(payload.v).toBe(1)
    } finally {
      vi.restoreAllMocks()
    }
  })
})

/**
 * loa-finn Test Client — Sender-Side Usage Report Producer
 * Sprint 4, Task 4.0: Hounfour Phase 4 — Spice Gate
 *
 * Produces real signed usage reports using the same cryptographic code paths
 * as production loa-finn. Uses JWKS test fixtures for key material.
 *
 * Flow:
 *   1. Sign S2S JWT with { purpose: "usage-report", report_id } claims
 *   2. Sign JWS compact serialization over canonical UsageReport JSON
 *   3. Return request body in the format expected by /internal/usage-reports
 *
 * @see SDD §3.2 UsageReceiver
 * @see AC-6.1, AC-6.2
 */

import { SignJWT, CompactSign } from 'jose'
import { randomUUID } from 'node:crypto'
import type { TestKeyPair } from './jwks-test-server'

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface UsageReportPayload {
  report_id: string
  community_id: string
  user_wallet: string
  model_alias: string
  prompt_tokens: number
  completion_tokens: number
  cost_micro: number | string
  pool_id?: string
}

export interface SignedUsageReport {
  /** S2S Bearer JWT (for Authorization header) */
  s2sToken: string
  /** JWS compact serialization of the usage report (for request body) */
  jwsCompact: string
  /** The raw usage report payload */
  report: UsageReportPayload
}

// --------------------------------------------------------------------------
// Default report factory
// --------------------------------------------------------------------------

export function createTestReport(overrides?: Partial<UsageReportPayload>): UsageReportPayload {
  return {
    report_id: `rpt-${randomUUID().slice(0, 8)}`,
    community_id: '550e8400-e29b-41d4-a716-446655440000',
    user_wallet: '0xTestWallet1234567890abcdef',
    model_alias: 'cheap',
    prompt_tokens: 100,
    completion_tokens: 50,
    cost_micro: 5000,
    ...overrides,
  }
}

// --------------------------------------------------------------------------
// Signing functions
// --------------------------------------------------------------------------

/**
 * Create a signed S2S JWT (Bearer token for Authorization header).
 * Mimics loa-finn's S2S JWT signing for usage reports.
 */
export async function signS2SJwt(
  key: TestKeyPair,
  reportId: string,
  overrides?: Record<string, unknown>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    purpose: 'usage-report',
    report_id: reportId,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ: 'JWT' })
    .setIssuer('loa-finn')
    .setAudience('arrakis')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setJti(randomUUID())
    .sign(key.privateKeyLike)
}

/**
 * Sign a usage report as JWS compact serialization.
 * Mimics loa-finn's JWS signing over canonical report JSON.
 */
export async function signReportJws(
  key: TestKeyPair,
  report: UsageReportPayload,
): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(report))

  return new CompactSign(payload)
    .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ: 'JWS' })
    .sign(key.privateKeyLike)
}

/**
 * Produce a complete signed usage report (S2S JWT + JWS).
 * Returns everything needed to POST to /internal/usage-reports.
 */
export async function createSignedUsageReport(
  key: TestKeyPair,
  reportOverrides?: Partial<UsageReportPayload>,
  jwtOverrides?: Record<string, unknown>,
): Promise<SignedUsageReport> {
  const report = createTestReport(reportOverrides)
  const s2sToken = await signS2SJwt(key, report.report_id, jwtOverrides)
  const jwsCompact = await signReportJws(key, report)

  return { s2sToken, jwsCompact, report }
}

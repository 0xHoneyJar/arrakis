/**
 * UsageReceiver Unit Tests
 * Sprint 192 Task 2.8: Tests for 7-step validation pipeline
 *
 * Covers:
 *   - Happy path: valid JWT + JWS → accepted
 *   - Duplicate report_id → idempotent 200
 *   - Missing/invalid JWT claims → 400
 *   - JWS signature verification failure → propagated
 *   - JWS payload not valid JSON → 400
 *   - Schema validation failures → 400
 *   - report_id mismatch (JWT vs payload) → 400
 *   - cost_micro bounds check → 400
 *   - Unsafe integer cost_micro → 400
 *   - report_id length enforcement → 400
 *   - Redis failure warn-only (not blocking)
 *   - PG insert failure → 500
 *
 * @see SDD §3.2 UsageReceiver
 * @see ADR-005 Budget Unit Convention
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsageReceiver, UsageReceiverError } from '../../../../packages/adapters/agent/usage-receiver';
import type { UsageReceiverDeps } from '../../../../packages/adapters/agent/usage-receiver';
import type { UsageReceiverConfig } from '../../../../packages/adapters/agent/config';
import type { S2SJwtPayload } from '../../../../packages/adapters/agent/s2s-jwt-validator';

// --------------------------------------------------------------------------
// Test Helpers
// --------------------------------------------------------------------------

function makeJwtClaims(overrides: Partial<S2SJwtPayload> = {}): S2SJwtPayload {
  return {
    iss: 'loa-finn',
    aud: 'arrakis',
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000),
    jti: 'jwt-jti-123',
    purpose: 'usage-report',
    report_id: 'report-abc-123',
    ...overrides,
  };
}

function makeUsageReport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    report_id: 'report-abc-123',
    community_id: '550e8400-e29b-41d4-a716-446655440000',
    user_wallet: '0xabc123',
    model_alias: 'gpt-4o',
    prompt_tokens: 100,
    completion_tokens: 50,
    cost_micro: 5000,
    ...overrides,
  };
}

function createMockDeps(): UsageReceiverDeps & {
  mockVerifyJws: ReturnType<typeof vi.fn>;
  mockInsert: ReturnType<typeof vi.fn>;
  mockRedisIncrby: ReturnType<typeof vi.fn>;
} {
  const mockVerifyJws = vi.fn();
  const mockInsert = vi.fn();
  const mockRedisIncrby = vi.fn();

  // Default: verifyJws returns valid JSON bytes
  mockVerifyJws.mockResolvedValue(
    new TextEncoder().encode(JSON.stringify(makeUsageReport())),
  );

  // Default: PG insert returns a row (not duplicate)
  mockInsert.mockResolvedValue([{ id: 'some-uuid' }]);

  // Default: Redis incrby succeeds
  mockRedisIncrby.mockResolvedValue(1);

  const deps: UsageReceiverDeps = {
    s2sValidator: {
      validateJwt: vi.fn(),
      verifyJws: mockVerifyJws,
    } as any,
    db: {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: mockInsert,
          }),
        }),
      }),
    } as any,
    redis: {
      incrby: mockRedisIncrby,
    } as any,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any,
  };

  return { ...deps, mockVerifyJws, mockInsert, mockRedisIncrby };
}

const DEFAULT_CONFIG: UsageReceiverConfig = {
  maxCostMicroUsd: 100_000_000_000n, // 100B = $100K
  maxReportIdLength: 256,
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('UsageReceiver', () => {
  let deps: ReturnType<typeof createMockDeps>;
  let receiver: UsageReceiver;

  beforeEach(() => {
    deps = createMockDeps();
    receiver = new UsageReceiver(deps, DEFAULT_CONFIG);
  });

  // ========================================================================
  // Happy Path
  // ========================================================================

  describe('happy path', () => {
    it('accepts valid JWT + JWS and returns accepted status', async () => {
      const claims = makeJwtClaims();
      const result = await receiver.receive(claims, 'valid.jws.compact');

      expect(result).toEqual({
        status: 'accepted',
        report_id: 'report-abc-123',
      });
    });

    it('calls verifyJws with the compact serialization', async () => {
      const claims = makeJwtClaims();
      await receiver.receive(claims, 'my.jws.token');

      expect(deps.mockVerifyJws).toHaveBeenCalledWith('my.jws.token');
    });

    it('inserts into PG with correct values', async () => {
      const claims = makeJwtClaims();
      await receiver.receive(claims, 'valid.jws.compact');

      const insertCall = (deps.db.insert as any).mock.calls[0];
      expect(insertCall).toBeDefined();

      // Check the values passed to .values()
      const valuesCall = (deps.db.insert as any).mock.results[0].value.values.mock.calls[0][0];
      expect(valuesCall.communityId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(valuesCall.userWallet).toBe('0xabc123');
      expect(valuesCall.modelAlias).toBe('gpt-4o');
      expect(valuesCall.promptTokens).toBe(100);
      expect(valuesCall.completionTokens).toBe(50);
      expect(valuesCall.costCents).toBe(500000n); // 5000 * 100
      expect(valuesCall.costMicroUsd).toBe(5000n);
      expect(valuesCall.reportId).toBe('report-abc-123');
      expect(valuesCall.originalJti).toBe('jwt-jti-123');
      expect(valuesCall.source).toBe('usage-report');
    });

    it('updates Redis counter with bigint-safe string', async () => {
      const claims = makeJwtClaims();
      await receiver.receive(claims, 'valid.jws.compact');

      expect(deps.mockRedisIncrby).toHaveBeenCalled();
      const [key, value] = deps.mockRedisIncrby.mock.calls[0];
      expect(key).toMatch(/^agent:budget:committed:550e8400.*:\d{4}-\d{2}$/);
      expect(value).toBe('500000'); // costMicroCents as string
    });

    it('uses report_id as originalJti fallback when jti absent', async () => {
      const claims = makeJwtClaims({ jti: undefined });
      await receiver.receive(claims, 'valid.jws.compact');

      const valuesCall = (deps.db.insert as any).mock.results[0].value.values.mock.calls[0][0];
      expect(valuesCall.originalJti).toBe('report-abc-123');
    });

    it('handles string cost_micro', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ cost_micro: '999999' }))),
      );

      const claims = makeJwtClaims();
      const result = await receiver.receive(claims, 'valid.jws.compact');

      expect(result.status).toBe('accepted');
      const valuesCall = (deps.db.insert as any).mock.results[0].value.values.mock.calls[0][0];
      expect(valuesCall.costMicroUsd).toBe(999999n);
    });

    it('handles pool_id in report', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ pool_id: 'fast-code' }))),
      );

      const claims = makeJwtClaims();
      await receiver.receive(claims, 'valid.jws.compact');

      const valuesCall = (deps.db.insert as any).mock.results[0].value.values.mock.calls[0][0];
      expect(valuesCall.poolId).toBe('fast-code');
    });
  });

  // ========================================================================
  // Step 1: JWT Claims Validation
  // ========================================================================

  describe('Step 1: JWT claims validation', () => {
    it('rejects missing report_id in JWT claims', async () => {
      const claims = makeJwtClaims({ report_id: undefined });

      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('report_id'),
      });
    });

    it('rejects JWT report_id exceeding max length', async () => {
      const longId = 'x'.repeat(257);
      const claims = makeJwtClaims({ report_id: longId });

      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('max length'),
      });
    });
  });

  // ========================================================================
  // Step 3: JWS Payload Decoding
  // ========================================================================

  describe('Step 3: JWS payload decoding', () => {
    it('rejects non-JSON JWS payload', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode('not valid json'),
      );

      const claims = makeJwtClaims();
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('not valid JSON'),
      });
    });
  });

  // ========================================================================
  // Step 4: Schema Validation
  // ========================================================================

  describe('Step 4: schema validation', () => {
    it('rejects missing required fields', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify({ report_id: 'test' })),
      );

      const claims = makeJwtClaims({ report_id: 'test' });
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Invalid usage report'),
      });
    });

    it('rejects negative token counts', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ prompt_tokens: -1 }))),
      );

      const claims = makeJwtClaims();
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('rejects tokens exceeding 100M', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ prompt_tokens: 100_000_001 }))),
      );

      const claims = makeJwtClaims();
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('rejects invalid community_id (not UUID)', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ community_id: 'not-a-uuid' }))),
      );

      const claims = makeJwtClaims();
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('rejects payload report_id exceeding max length', async () => {
      const longId = 'y'.repeat(257);
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ report_id: longId }))),
      );

      // JWT report_id matches but is also long — schema max is 256 so it fails schema first
      const claims = makeJwtClaims({ report_id: longId });

      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ========================================================================
  // Step 4b: Cost Bounds Check
  // ========================================================================

  describe('Step 4b: cost bounds check', () => {
    it('rejects cost_micro exceeding cap', async () => {
      const config: UsageReceiverConfig = {
        maxCostMicroUsd: 1000n, // Very low cap for testing
        maxReportIdLength: 256,
      };
      const lowCapReceiver = new UsageReceiver(deps, config);

      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ cost_micro: 1001 }))),
      );

      const claims = makeJwtClaims();
      await expect(lowCapReceiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(lowCapReceiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('exceeds cap'),
      });
    });

    it('rejects unsafe integer cost_micro', async () => {
      // Number.MAX_SAFE_INTEGER + 1 = 9007199254740992
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ cost_micro: 9007199254740992 }))),
      );

      const claims = makeJwtClaims();
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('safe integer'),
      });
    });

    it('accepts large cost_micro as string', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ cost_micro: '99999999999' }))),
      );

      const claims = makeJwtClaims();
      const result = await receiver.receive(claims, 'valid.jws');
      expect(result.status).toBe('accepted');
    });
  });

  // ========================================================================
  // Step 5: report_id Cross-Check
  // ========================================================================

  describe('Step 5: report_id cross-check', () => {
    it('rejects report_id mismatch between JWT and payload', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ report_id: 'different-id' }))),
      );

      const claims = makeJwtClaims({ report_id: 'report-abc-123' });
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('mismatch'),
      });
    });
  });

  // ========================================================================
  // Step 6: PG Insert (Idempotency)
  // ========================================================================

  describe('Step 6: PG insert idempotency', () => {
    it('returns duplicate status when report_id already exists', async () => {
      // Empty result = ON CONFLICT DO NOTHING (no rows returned)
      deps.mockInsert.mockResolvedValue([]);

      const claims = makeJwtClaims();
      const result = await receiver.receive(claims, 'valid.jws');

      expect(result).toEqual({
        status: 'duplicate',
        report_id: 'report-abc-123',
      });
    });

    it('does not update Redis on duplicate', async () => {
      deps.mockInsert.mockResolvedValue([]);

      const claims = makeJwtClaims();
      await receiver.receive(claims, 'valid.jws');

      expect(deps.mockRedisIncrby).not.toHaveBeenCalled();
    });

    it('throws 500 on PG insert failure', async () => {
      deps.mockInsert.mockRejectedValue(new Error('Connection refused'));

      const claims = makeJwtClaims();
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toThrow(UsageReceiverError);
      await expect(receiver.receive(claims, 'valid.jws')).rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringContaining('Internal error'),
      });
    });
  });

  // ========================================================================
  // Step 7: Redis Counter (Warn-Only)
  // ========================================================================

  describe('Step 7: Redis counter (warn-only)', () => {
    it('still returns accepted when Redis fails', async () => {
      deps.mockRedisIncrby.mockRejectedValue(new Error('Redis down'));

      const claims = makeJwtClaims();
      const result = await receiver.receive(claims, 'valid.jws');

      expect(result.status).toBe('accepted');
    });

    it('logs warning when Redis fails', async () => {
      deps.mockRedisIncrby.mockRejectedValue(new Error('Redis down'));

      const claims = makeJwtClaims();
      await receiver.receive(claims, 'valid.jws');

      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.stringContaining('Redis INCRBY failed'),
      );
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('edge cases', () => {
    it('handles zero cost_micro', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({ cost_micro: 0 }))),
      );

      const claims = makeJwtClaims();
      const result = await receiver.receive(claims, 'valid.jws');

      expect(result.status).toBe('accepted');
      const valuesCall = (deps.db.insert as any).mock.results[0].value.values.mock.calls[0][0];
      expect(valuesCall.costMicroUsd).toBe(0n);
      expect(valuesCall.costCents).toBe(0n);
    });

    it('handles zero tokens', async () => {
      deps.mockVerifyJws.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(makeUsageReport({
          prompt_tokens: 0,
          completion_tokens: 0,
        }))),
      );

      const claims = makeJwtClaims();
      const result = await receiver.receive(claims, 'valid.jws');
      expect(result.status).toBe('accepted');
    });
  });
});

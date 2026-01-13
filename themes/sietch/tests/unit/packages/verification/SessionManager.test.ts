/**
 * SessionManager Tests
 *
 * Unit tests for wallet verification session management.
 * Tests CRUD operations with mocked database.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { SessionManager } from '../../../../src/packages/verification/SessionManager.js';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock the schema import
vi.mock('../../../../src/packages/adapters/storage/schema.js', () => ({
  walletVerificationSessions: {
    id: 'id',
    communityId: 'community_id',
    discordUserId: 'discord_user_id',
    discordGuildId: 'discord_guild_id',
    discordUsername: 'discord_username',
    nonce: 'nonce',
    walletAddress: 'wallet_address',
    status: 'status',
    createdAt: 'created_at',
    expiresAt: 'expires_at',
    completedAt: 'completed_at',
    attempts: 'attempts',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    errorMessage: 'error_message',
  },
}));

// Mock TenantContext
vi.mock('../../../../src/packages/adapters/storage/TenantContext.js', () => ({
  TenantContext: vi.fn().mockImplementation(() => ({
    withTenant: vi.fn((_tenantId: string, fn: () => Promise<unknown>) => fn()),
  })),
}));

// Create mock database
function createMockDb() {
  const mockResult: unknown[] = [];

  const mockChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(mockResult)),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => Promise.resolve(mockResult)),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    _setResult: (result: unknown[]) => {
      mockResult.length = 0;
      mockResult.push(...result);
    },
  };

  return mockChain;
}

// =============================================================================
// Test Data
// =============================================================================

const TEST_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_DISCORD_USER_ID = '123456789012345678';
const TEST_DISCORD_GUILD_ID = '987654321098765432';
const TEST_DISCORD_USERNAME = 'testuser#1234';
const TEST_SESSION_ID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_NONCE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

function createMockSession(overrides: Partial<{
  id: string;
  communityId: string;
  discordUserId: string;
  discordGuildId: string;
  discordUsername: string;
  nonce: string;
  walletAddress: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  attempts: number;
  ipAddress: string | null;
  userAgent: string | null;
  errorMessage: string | null;
}> = {}) {
  const now = new Date();
  return {
    id: TEST_SESSION_ID,
    communityId: TEST_TENANT_ID,
    discordUserId: TEST_DISCORD_USER_ID,
    discordGuildId: TEST_DISCORD_GUILD_ID,
    discordUsername: TEST_DISCORD_USERNAME,
    nonce: TEST_NONCE,
    walletAddress: null,
    status: 'pending',
    createdAt: now,
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes
    completedAt: null,
    attempts: 0,
    ipAddress: null,
    userAgent: null,
    errorMessage: null,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('SessionManager', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let sessionManager: SessionManager;

  beforeEach(() => {
    mockDb = createMockDb();
    sessionManager = new SessionManager(
      mockDb as unknown as Parameters<typeof SessionManager['prototype']['constructor']>[0],
      TEST_TENANT_ID
    );
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      expect(sessionManager).toBeDefined();
      expect(sessionManager.getMaxAttempts()).toBe(3);
      expect(sessionManager.getSessionTtlMinutes()).toBe(15);
    });

    it('should create instance with custom TTL', () => {
      const customManager = new SessionManager(
        mockDb as unknown as Parameters<typeof SessionManager['prototype']['constructor']>[0],
        TEST_TENANT_ID,
        { sessionTtlMinutes: 30 }
      );
      expect(customManager.getSessionTtlMinutes()).toBe(30);
    });
  });

  describe('create', () => {
    it('should create a new session when no pending session exists', async () => {
      const newSession = createMockSession();

      // First call returns empty (no existing session)
      // Second call returns the new session
      let callCount = 0;
      mockDb.limit.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([]);
        }
        return Promise.resolve([newSession]);
      });
      mockDb.returning.mockResolvedValue([newSession]);

      const result = await sessionManager.create({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        discordUsername: TEST_DISCORD_USERNAME,
      });

      expect(result.isNew).toBe(true);
      expect(result.session).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should return existing pending session if one exists', async () => {
      const existingSession = createMockSession();
      mockDb.limit.mockResolvedValue([existingSession]);

      const result = await sessionManager.create({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        discordUsername: TEST_DISCORD_USERNAME,
      });

      expect(result.isNew).toBe(false);
      expect(result.session).toEqual(existingSession);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should include IP and user agent when provided', async () => {
      const newSession = createMockSession({
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      let callCount = 0;
      mockDb.limit.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? [] : [newSession]);
      });
      mockDb.returning.mockResolvedValue([newSession]);

      const result = await sessionManager.create({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        discordUsername: TEST_DISCORD_USERNAME,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result.isNew).toBe(true);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });
  });

  describe('getById', () => {
    it('should return session when found', async () => {
      const session = createMockSession();
      mockDb.limit.mockResolvedValue([session]);

      const result = await sessionManager.getById(TEST_SESSION_ID);

      expect(result).toEqual(session);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await sessionManager.getById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('getByNonce', () => {
    it('should return session when found', async () => {
      const session = createMockSession();
      mockDb.limit.mockResolvedValue([session]);

      const result = await sessionManager.getByNonce(TEST_NONCE);

      expect(result).toEqual(session);
    });

    it('should return null when not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await sessionManager.getByNonce('nonexistent-nonce');

      expect(result).toBeNull();
    });
  });

  describe('getPendingForUser', () => {
    it('should return pending session for user', async () => {
      const session = createMockSession();
      mockDb.limit.mockResolvedValue([session]);

      const result = await sessionManager.getPendingForUser(TEST_DISCORD_USER_ID);

      expect(result).toEqual(session);
    });

    it('should return null when no pending session', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await sessionManager.getPendingForUser('unknown-user');

      expect(result).toBeNull();
    });
  });

  describe('markCompleted', () => {
    it('should mark session as completed with wallet address', async () => {
      const completedSession = createMockSession({
        status: 'completed',
        walletAddress: TEST_WALLET.toLowerCase(),
        completedAt: new Date(),
      });
      mockDb.returning.mockResolvedValue([completedSession]);

      const result = await sessionManager.markCompleted({
        sessionId: TEST_SESSION_ID,
        walletAddress: TEST_WALLET,
      });

      expect(result).toEqual(completedSession);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          walletAddress: TEST_WALLET.toLowerCase(),
        })
      );
    });

    it('should return null when session not found', async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await sessionManager.markCompleted({
        sessionId: 'nonexistent-id',
        walletAddress: TEST_WALLET,
      });

      expect(result).toBeNull();
    });
  });

  describe('incrementAttempts', () => {
    it('should increment attempts when under limit', async () => {
      const updatedSession = createMockSession({ attempts: 1 });
      mockDb.returning.mockResolvedValue([updatedSession]);

      const result = await sessionManager.incrementAttempts(TEST_SESSION_ID);

      expect(result).toEqual(updatedSession);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null when at max attempts', async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await sessionManager.incrementAttempts(TEST_SESSION_ID);

      expect(result).toBeNull();
    });
  });

  describe('markFailed', () => {
    it('should mark session as failed with error message', async () => {
      const failedSession = createMockSession({
        status: 'failed',
        errorMessage: 'Signature verification failed',
      });
      mockDb.returning.mockResolvedValue([failedSession]);

      const result = await sessionManager.markFailed({
        sessionId: TEST_SESSION_ID,
        errorMessage: 'Signature verification failed',
      });

      expect(result).toEqual(failedSession);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Signature verification failed',
        })
      );
    });
  });

  describe('expireOldSessions', () => {
    it('should expire pending sessions past expiry', async () => {
      const expiredSessions = [
        createMockSession({ status: 'expired' }),
        createMockSession({ status: 'expired', id: 'another-id' }),
      ];
      mockDb.returning.mockResolvedValue(expiredSessions);

      const count = await sessionManager.expireOldSessions();

      expect(count).toBe(2);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'expired',
        })
      );
    });

    it('should return 0 when no sessions to expire', async () => {
      mockDb.returning.mockResolvedValue([]);

      const count = await sessionManager.expireOldSessions();

      expect(count).toBe(0);
    });
  });

  describe('validateSession', () => {
    it('should return valid for pending non-expired session under attempt limit', () => {
      const session = createMockSession();

      const result = sessionManager.validateSession(session);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for null session', () => {
      const result = sessionManager.validateSession(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should return invalid for completed session', () => {
      const session = createMockSession({ status: 'completed' });

      const result = sessionManager.validateSession(session);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session is completed');
    });

    it('should return invalid for expired session', () => {
      const session = createMockSession({ status: 'expired' });

      const result = sessionManager.validateSession(session);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session is expired');
    });

    it('should return invalid for failed session', () => {
      const session = createMockSession({ status: 'failed' });

      const result = sessionManager.validateSession(session);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session is failed');
    });

    it('should return invalid for session past expiry time', () => {
      const session = createMockSession({
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      });

      const result = sessionManager.validateSession(session);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session has expired');
    });

    it('should return invalid for session at max attempts', () => {
      const session = createMockSession({ attempts: 3 });

      const result = sessionManager.validateSession(session);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Maximum verification attempts exceeded');
    });

    it('should return invalid for session over max attempts', () => {
      const session = createMockSession({ attempts: 5 });

      const result = sessionManager.validateSession(session);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Maximum verification attempts exceeded');
    });
  });
});

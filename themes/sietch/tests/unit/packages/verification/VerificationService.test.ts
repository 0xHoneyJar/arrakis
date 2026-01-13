/**
 * WalletVerificationService Tests
 *
 * Unit tests for the wallet verification orchestration service.
 * Tests the complete verification flow with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { WalletVerificationService } from '../../../../src/packages/verification/VerificationService.js';
import type { WalletVerificationSession } from '../../../../src/packages/adapters/storage/schema.js';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock SessionManager
const mockSessionManager = {
  create: vi.fn(),
  getById: vi.fn(),
  getByNonce: vi.fn(),
  getPendingForUser: vi.fn(),
  markCompleted: vi.fn(),
  markFailed: vi.fn(),
  incrementAttempts: vi.fn(),
  expireOldSessions: vi.fn(),
  validateSession: vi.fn(),
};

// Mock SignatureVerifier
const mockSignatureVerifier = {
  verifyAddress: vi.fn(),
  recover: vi.fn(),
};

// Mock MessageBuilder
const mockMessageBuilder = {
  build: vi.fn(),
  buildFromNonce: vi.fn(),
};

// Mock the imports
vi.mock('../../../../src/packages/verification/SessionManager.js', () => ({
  SessionManager: vi.fn().mockImplementation(() => mockSessionManager),
}));

vi.mock('../../../../src/packages/verification/SignatureVerifier.js', () => ({
  SignatureVerifier: vi.fn().mockImplementation(() => mockSignatureVerifier),
}));

vi.mock('../../../../src/packages/verification/MessageBuilder.js', () => ({
  MessageBuilder: vi.fn().mockImplementation(() => mockMessageBuilder),
}));

// Mock schema
vi.mock('../../../../src/packages/adapters/storage/schema.js', () => ({
  walletVerificationSessions: {},
}));

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
const TEST_SIGNATURE = '0x1234567890abcdef' as `0x${string}`;
const TEST_MESSAGE = 'Test signing message';
const TEST_COMMUNITY_NAME = 'Test Community';

function createMockSession(
  overrides: Partial<WalletVerificationSession> = {}
): WalletVerificationSession {
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
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
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

describe('WalletVerificationService', () => {
  let service: WalletVerificationService;
  let mockDb: unknown;
  let auditEvents: unknown[];
  let walletLinks: unknown[];

  beforeEach(() => {
    vi.clearAllMocks();
    auditEvents = [];
    walletLinks = [];

    mockDb = {};
    service = new WalletVerificationService(
      mockDb as Parameters<typeof WalletVerificationService['prototype']['constructor']>[0],
      TEST_TENANT_ID,
      {
        debug: false,
        onAuditEvent: async (event) => {
          auditEvents.push(event);
        },
        onWalletLink: async (params) => {
          walletLinks.push(params);
        },
      }
    );
  });

  describe('createSession', () => {
    it('should create a new session and return message to sign', async () => {
      const mockSession = createMockSession();
      mockSessionManager.create.mockResolvedValue({
        session: mockSession,
        isNew: true,
      });
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);

      const result = await service.createSession({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        discordUsername: TEST_DISCORD_USERNAME,
        communityName: TEST_COMMUNITY_NAME,
      });

      expect(result.sessionId).toBe(TEST_SESSION_ID);
      expect(result.nonce).toBe(TEST_NONCE);
      expect(result.message).toBe(TEST_MESSAGE);
      expect(result.isNew).toBe(true);
      expect(mockSessionManager.create).toHaveBeenCalledWith({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        discordUsername: TEST_DISCORD_USERNAME,
        ipAddress: undefined,
        userAgent: undefined,
      });
    });

    it('should return existing session if one exists', async () => {
      const mockSession = createMockSession();
      mockSessionManager.create.mockResolvedValue({
        session: mockSession,
        isNew: false,
      });
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);

      const result = await service.createSession({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        discordUsername: TEST_DISCORD_USERNAME,
        communityName: TEST_COMMUNITY_NAME,
      });

      expect(result.isNew).toBe(false);
      expect(auditEvents).toHaveLength(0); // No audit event for existing session
    });

    it('should emit audit event for new session', async () => {
      const mockSession = createMockSession();
      mockSessionManager.create.mockResolvedValue({
        session: mockSession,
        isNew: true,
      });
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);

      await service.createSession({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        discordUsername: TEST_DISCORD_USERNAME,
        communityName: TEST_COMMUNITY_NAME,
        ipAddress: '192.168.1.1',
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]).toMatchObject({
        type: 'SESSION_CREATED',
        sessionId: TEST_SESSION_ID,
        discordUserId: TEST_DISCORD_USER_ID,
        ipAddress: '192.168.1.1',
      });
    });
  });

  describe('verifySignature', () => {
    it('should successfully verify signature and complete session', async () => {
      const mockSession = createMockSession();
      const completedSession = createMockSession({
        status: 'completed',
        walletAddress: TEST_WALLET.toLowerCase(),
        completedAt: new Date(),
      });

      mockSessionManager.getById.mockResolvedValue(mockSession);
      mockSessionManager.validateSession.mockReturnValue({ valid: true });
      mockSessionManager.incrementAttempts.mockResolvedValue({
        ...mockSession,
        attempts: 1,
      });
      mockSessionManager.markCompleted.mockResolvedValue(completedSession);
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);
      mockSignatureVerifier.verifyAddress.mockResolvedValue({
        valid: true,
        recoveredAddress: TEST_WALLET.toLowerCase(),
      });

      const result = await service.verifySignature({
        sessionId: TEST_SESSION_ID,
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
      });

      expect(result.success).toBe(true);
      expect(result.walletAddress).toBe(TEST_WALLET.toLowerCase());
      expect(result.sessionStatus).toBe('completed');
      expect(walletLinks).toHaveLength(1);
      expect(walletLinks[0]).toMatchObject({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        walletAddress: TEST_WALLET,
      });
    });

    it('should fail if session not found', async () => {
      mockSessionManager.getById.mockResolvedValue(null);
      mockSessionManager.validateSession.mockReturnValue({
        valid: false,
        error: 'Session not found',
      });

      const result = await service.verifySignature({
        sessionId: 'nonexistent',
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SESSION_NOT_FOUND');
    });

    it('should fail if session is expired', async () => {
      const expiredSession = createMockSession({ status: 'expired' });
      mockSessionManager.getById.mockResolvedValue(expiredSession);
      mockSessionManager.validateSession.mockReturnValue({
        valid: false,
        error: 'Session is expired',
      });

      const result = await service.verifySignature({
        sessionId: TEST_SESSION_ID,
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SESSION_EXPIRED');
    });

    it('should fail if session already completed', async () => {
      const completedSession = createMockSession({ status: 'completed' });
      mockSessionManager.getById.mockResolvedValue(completedSession);
      mockSessionManager.validateSession.mockReturnValue({
        valid: false,
        error: 'Session is completed',
      });

      const result = await service.verifySignature({
        sessionId: TEST_SESSION_ID,
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SESSION_ALREADY_COMPLETED');
    });

    it('should fail if max attempts exceeded', async () => {
      const mockSession = createMockSession({ attempts: 2 });
      mockSessionManager.getById.mockResolvedValue(mockSession);
      mockSessionManager.validateSession.mockReturnValue({ valid: true });
      mockSessionManager.incrementAttempts.mockResolvedValue(null);
      mockSessionManager.markFailed.mockResolvedValue({
        ...mockSession,
        status: 'failed',
      });

      const result = await service.verifySignature({
        sessionId: TEST_SESSION_ID,
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MAX_ATTEMPTS_EXCEEDED');
      expect(mockSessionManager.markFailed).toHaveBeenCalled();
    });

    it('should fail if signature is invalid', async () => {
      const mockSession = createMockSession();
      mockSessionManager.getById.mockResolvedValue(mockSession);
      mockSessionManager.validateSession.mockReturnValue({ valid: true });
      mockSessionManager.incrementAttempts.mockResolvedValue({
        ...mockSession,
        attempts: 1,
      });
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);
      mockSignatureVerifier.verifyAddress.mockResolvedValue({
        valid: false,
        error: 'Invalid signature',
      });

      const result = await service.verifySignature({
        sessionId: TEST_SESSION_ID,
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_SIGNATURE');
      expect(result.sessionStatus).toBe('pending'); // Can retry
    });

    it('should fail if address does not match signature', async () => {
      const mockSession = createMockSession();
      mockSessionManager.getById.mockResolvedValue(mockSession);
      mockSessionManager.validateSession.mockReturnValue({ valid: true });
      mockSessionManager.incrementAttempts.mockResolvedValue({
        ...mockSession,
        attempts: 1,
      });
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);
      mockSignatureVerifier.verifyAddress.mockResolvedValue({
        valid: false,
        error: 'Signature address does not match expected address',
        recoveredAddress: '0xDifferentAddress',
      });

      const result = await service.verifySignature({
        sessionId: TEST_SESSION_ID,
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ADDRESS_MISMATCH');
    });

    it('should emit audit events for verification flow', async () => {
      const mockSession = createMockSession();
      const completedSession = createMockSession({
        status: 'completed',
        walletAddress: TEST_WALLET.toLowerCase(),
      });

      mockSessionManager.getById.mockResolvedValue(mockSession);
      mockSessionManager.validateSession.mockReturnValue({ valid: true });
      mockSessionManager.incrementAttempts.mockResolvedValue({
        ...mockSession,
        attempts: 1,
      });
      mockSessionManager.markCompleted.mockResolvedValue(completedSession);
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);
      mockSignatureVerifier.verifyAddress.mockResolvedValue({
        valid: true,
        recoveredAddress: TEST_WALLET.toLowerCase(),
      });

      await service.verifySignature({
        sessionId: TEST_SESSION_ID,
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
        ipAddress: '192.168.1.1',
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]).toMatchObject({
        type: 'VERIFICATION_COMPLETED',
        sessionId: TEST_SESSION_ID,
        walletAddress: TEST_WALLET,
        success: true,
        ipAddress: '192.168.1.1',
      });
    });
  });

  describe('getSession', () => {
    it('should return session info when found', async () => {
      const mockSession = createMockSession();
      mockSessionManager.getById.mockResolvedValue(mockSession);

      const result = await service.getSession(TEST_SESSION_ID);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(TEST_SESSION_ID);
      expect(result?.status).toBe('pending');
      expect(result?.discordUserId).toBe(TEST_DISCORD_USER_ID);
    });

    it('should return null when session not found', async () => {
      mockSessionManager.getById.mockResolvedValue(null);

      const result = await service.getSession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getSessionByNonce', () => {
    it('should return session info when found', async () => {
      const mockSession = createMockSession();
      mockSessionManager.getByNonce.mockResolvedValue(mockSession);

      const result = await service.getSessionByNonce(TEST_NONCE);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(TEST_SESSION_ID);
    });

    it('should return null when nonce not found', async () => {
      mockSessionManager.getByNonce.mockResolvedValue(null);

      const result = await service.getSessionByNonce('invalid-nonce');

      expect(result).toBeNull();
    });
  });

  describe('getPendingSession', () => {
    it('should return pending session for user', async () => {
      const mockSession = createMockSession();
      mockSessionManager.getPendingForUser.mockResolvedValue(mockSession);

      const result = await service.getPendingSession(TEST_DISCORD_USER_ID);

      expect(result).not.toBeNull();
      expect(result?.discordUserId).toBe(TEST_DISCORD_USER_ID);
    });

    it('should return null when no pending session', async () => {
      mockSessionManager.getPendingForUser.mockResolvedValue(null);

      const result = await service.getPendingSession('unknown-user');

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should return count of expired sessions', async () => {
      mockSessionManager.expireOldSessions.mockResolvedValue(5);

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(5);
      expect(mockSessionManager.expireOldSessions).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue if wallet link callback fails', async () => {
      const mockSession = createMockSession();
      const completedSession = createMockSession({
        status: 'completed',
        walletAddress: TEST_WALLET.toLowerCase(),
      });

      mockSessionManager.getById.mockResolvedValue(mockSession);
      mockSessionManager.validateSession.mockReturnValue({ valid: true });
      mockSessionManager.incrementAttempts.mockResolvedValue({
        ...mockSession,
        attempts: 1,
      });
      mockSessionManager.markCompleted.mockResolvedValue(completedSession);
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);
      mockSignatureVerifier.verifyAddress.mockResolvedValue({
        valid: true,
        recoveredAddress: TEST_WALLET.toLowerCase(),
      });

      // Create service with failing wallet link callback
      const failingService = new WalletVerificationService(
        mockDb as Parameters<typeof WalletVerificationService['prototype']['constructor']>[0],
        TEST_TENANT_ID,
        {
          onWalletLink: async () => {
            throw new Error('Link failed');
          },
        }
      );

      const result = await failingService.verifySignature({
        sessionId: TEST_SESSION_ID,
        signature: TEST_SIGNATURE,
        walletAddress: TEST_WALLET as `0x${string}`,
      });

      // Should still succeed even if callback fails
      expect(result.success).toBe(true);
    });

    it('should continue if audit event callback fails', async () => {
      const mockSession = createMockSession();
      mockSessionManager.create.mockResolvedValue({
        session: mockSession,
        isNew: true,
      });
      mockMessageBuilder.buildFromNonce.mockReturnValue(TEST_MESSAGE);

      // Create service with failing audit callback
      const failingService = new WalletVerificationService(
        mockDb as Parameters<typeof WalletVerificationService['prototype']['constructor']>[0],
        TEST_TENANT_ID,
        {
          onAuditEvent: async () => {
            throw new Error('Audit failed');
          },
        }
      );

      // Should not throw
      const result = await failingService.createSession({
        discordUserId: TEST_DISCORD_USER_ID,
        discordGuildId: TEST_DISCORD_GUILD_ID,
        discordUsername: TEST_DISCORD_USERNAME,
        communityName: TEST_COMMUNITY_NAME,
      });

      expect(result.sessionId).toBe(TEST_SESSION_ID);
    });
  });
});

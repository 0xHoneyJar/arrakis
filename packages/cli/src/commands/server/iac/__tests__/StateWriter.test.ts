/**
 * StateWriter Unit Tests
 *
 * Sprint 92: Discord Infrastructure-as-Code - Diff Calculation & State Application
 *
 * Tests applying configuration changes to Discord via the REST API.
 * Uses mocked DiscordClient for unit testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateWriter, formatApplyResult, createWriterFromEnv } from '../StateWriter.js';
import type { DiscordClient } from '../DiscordClient.js';
import { RateLimiter } from '../RateLimiter.js';
import { RetryHandler } from '../RetryHandler.js';
import type { ServerDiff, ApplyBatchResult } from '../types.js';

// ============================================================================
// Mocks
// ============================================================================

function createMockClient(): DiscordClient {
  return {
    createRole: vi.fn().mockResolvedValue({ id: 'new-role-id', name: 'New Role' }),
    updateRole: vi.fn().mockResolvedValue({ id: 'role-id', name: 'Updated Role' }),
    deleteRole: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn().mockResolvedValue({ id: 'new-channel-id', name: 'new-channel' }),
    updateChannel: vi.fn().mockResolvedValue({ id: 'channel-id', name: 'updated-channel' }),
    deleteChannel: vi.fn().mockResolvedValue(undefined),
    setChannelPermission: vi.fn().mockResolvedValue(undefined),
    deleteChannelPermission: vi.fn().mockResolvedValue(undefined),
    fetchGuildData: vi.fn(),
    fetchGuild: vi.fn(),
    fetchRoles: vi.fn(),
    fetchChannels: vi.fn(),
    validateGuildAccess: vi.fn(),
    getMaskedToken: vi.fn().mockReturnValue('***'),
  } as unknown as DiscordClient;
}

// Fast rate limiter that doesn't wait
function createFastRateLimiter(): RateLimiter {
  return new RateLimiter({
    maxTokens: 1000,
    refillRate: 1000,
    createCooldownMs: 0,
    minRequestIntervalMs: 0,
  });
}

// Fast retry handler that doesn't wait
function createFastRetryHandler(): RetryHandler {
  return new RetryHandler({
    maxAttempts: 1,
    baseDelayMs: 0,
    jitterFactor: 0,
  });
}

function createEmptyDiff(guildId = '123456789012345678'): ServerDiff {
  return {
    guildId,
    hasChanges: false,
    summary: {
      total: 0,
      create: 0,
      update: 0,
      delete: 0,
      noop: 0,
    },
    roles: [],
    categories: [],
    channels: [],
    permissions: [],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('StateWriter', () => {
  let mockClient: DiscordClient;
  let writer: StateWriter;
  const guildId = '123456789012345678';

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    writer = new StateWriter(mockClient, createFastRateLimiter(), createFastRetryHandler());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create writer with client', () => {
      const w = new StateWriter(mockClient);
      expect(w).toBeInstanceOf(StateWriter);
    });

    it('should accept custom rate limiter and retry handler', () => {
      const w = new StateWriter(
        mockClient,
        createFastRateLimiter(),
        createFastRetryHandler()
      );
      expect(w).toBeInstanceOf(StateWriter);
    });
  });

  describe('apply', () => {
    describe('dry run', () => {
      it('should not make any API calls in dry run mode', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.roles = [
          {
            operation: 'create',
            name: 'New Role',
            desired: {
              name: 'New Role',
              color: '#FF0000',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
          },
        ];
        diff.summary.create = 1;
        diff.summary.total = 1;

        const result = await writer.apply(diff, guildId, { dryRun: true });

        expect(result.success).toBe(true);
        expect(mockClient.createRole).not.toHaveBeenCalled();
      });

      it('should return expected changes in dry run', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.roles = [
          {
            operation: 'create',
            name: 'New Role',
            desired: {
              name: 'New Role',
              color: '#FF0000',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
          },
        ];
        diff.summary.create = 1;
        diff.summary.total = 1;

        const result = await writer.apply(diff, guildId, { dryRun: true });

        // Dry run still returns results for each planned operation
        expect(result.summary.total).toBe(1);
      });
    });

    describe('role operations', () => {
      it('should create a role', async () => {
        vi.useRealTimers(); // Use real timers for rate limiter

        // Create fresh writer with real timers
        const freshWriter = new StateWriter(mockClient, createFastRateLimiter(), createFastRetryHandler());

        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.roles = [
          {
            operation: 'create',
            name: 'New Role',
            desired: {
              id: '',
              name: 'New Role',
              color: '#FF0000',
              permissions: ['SEND_MESSAGES'],
              hoist: true,
              mentionable: false,
              position: 0,
              managed: false,
              isEveryone: false,
              isIacManaged: true,
            },
          },
        ];
        diff.summary.create = 1;
        diff.summary.total = 1;

        const result = await freshWriter.apply(diff, guildId);

        expect(mockClient.createRole).toHaveBeenCalledWith(
          guildId,
          expect.objectContaining({
            name: 'New Role',
            color: expect.any(Number),
            hoist: true,
            mentionable: false,
          })
        );
        expect(result.summary.succeeded).toBeGreaterThan(0);

        vi.useFakeTimers(); // Restore fake timers
      });

      it('should update a role', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.roles = [
          {
            operation: 'update',
            name: 'Existing Role',
            current: {
              id: 'role-id-123',
              name: 'Existing Role',
              color: '#FF0000',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
            desired: {
              name: 'Existing Role',
              color: '#00FF00',
              permissions: [],
              hoist: true,
              mentionable: false,
            },
            changes: [
              { field: 'color', from: '#FF0000', to: '#00FF00' },
              { field: 'hoist', from: false, to: true },
            ],
          },
        ];
        diff.summary.update = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.updateRole).toHaveBeenCalledWith(
          guildId,
          'role-id-123',
          expect.objectContaining({
            color: expect.any(Number),
            hoist: true,
          })
        );
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });

      it('should delete a role', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.roles = [
          {
            operation: 'delete',
            name: 'Role to Delete',
            current: {
              id: 'role-id-456',
              name: 'Role to Delete',
              color: '#FF0000',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
          },
        ];
        diff.summary.delete = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.deleteRole).toHaveBeenCalledWith(guildId, 'role-id-456');
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });
    });

    describe('category operations', () => {
      it('should create a category', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.categories = [
          {
            operation: 'create',
            name: 'New Category',
            desired: {
              name: 'New Category',
              position: 0,
            },
          },
        ];
        diff.summary.create = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.createChannel).toHaveBeenCalledWith(
          guildId,
          expect.objectContaining({
            name: 'New Category',
            type: 4, // GuildCategory
          })
        );
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });

      it('should delete a category', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.categories = [
          {
            operation: 'delete',
            name: 'Category to Delete',
            current: {
              id: 'cat-id-123',
              name: 'Category to Delete',
              position: 0,
            },
          },
        ];
        diff.summary.delete = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.deleteChannel).toHaveBeenCalledWith('cat-id-123');
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });
    });

    describe('channel operations', () => {
      it('should create a text channel', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.channels = [
          {
            operation: 'create',
            name: 'new-channel',
            desired: {
              name: 'new-channel',
              type: 'text',
              topic: 'A new channel',
              nsfw: false,
            },
          },
        ];
        diff.summary.create = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.createChannel).toHaveBeenCalledWith(
          guildId,
          expect.objectContaining({
            name: 'new-channel',
            type: 0, // GuildText
          })
        );
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });

      it('should create a voice channel', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.channels = [
          {
            operation: 'create',
            name: 'voice-channel',
            desired: {
              name: 'voice-channel',
              type: 'voice',
              bitrate: 64000,
              userLimit: 10,
            },
          },
        ];
        diff.summary.create = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.createChannel).toHaveBeenCalledWith(
          guildId,
          expect.objectContaining({
            name: 'voice-channel',
            type: 2, // GuildVoice
            bitrate: 64000,
            user_limit: 10,
          })
        );
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });

      it('should update a channel', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.channels = [
          {
            operation: 'update',
            name: 'existing-channel',
            current: {
              id: 'channel-id-123',
              name: 'existing-channel',
              type: 'text',
              topic: 'Old topic',
            },
            desired: {
              name: 'existing-channel',
              type: 'text',
              topic: 'New topic',
            },
            changes: [{ field: 'topic', from: 'Old topic', to: 'New topic' }],
          },
        ];
        diff.summary.update = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.updateChannel).toHaveBeenCalledWith(
          'channel-id-123',
          expect.objectContaining({
            topic: expect.stringContaining('New topic'),
          })
        );
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });

      it('should delete a channel', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.channels = [
          {
            operation: 'delete',
            name: 'channel-to-delete',
            current: {
              id: 'channel-id-456',
              name: 'channel-to-delete',
              type: 'text',
            },
          },
        ];
        diff.summary.delete = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.deleteChannel).toHaveBeenCalledWith('channel-id-456');
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });
    });

    describe('permission operations', () => {
      it('should set channel permission', async () => {
        vi.useRealTimers(); // Use real timers for rate limiter

        // Create fresh writer with real timers
        const freshWriter = new StateWriter(mockClient, createFastRateLimiter(), createFastRetryHandler());

        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.permissions = [
          {
            operation: 'create',
            targetId: 'channel-id-123',
            targetName: 'test-channel',
            targetType: 'channel',
            subjectId: 'role-id-456',
            subjectName: 'Test Role',
            subjectType: 'role',
            desired: {
              allow: ['SEND_MESSAGES'],
              deny: ['MANAGE_MESSAGES'],
            },
          },
        ];
        diff.summary.create = 1;
        diff.summary.total = 1;

        const result = await freshWriter.apply(diff, guildId);

        expect(mockClient.setChannelPermission).toHaveBeenCalledWith(
          'channel-id-123',
          'role-id-456',
          expect.objectContaining({
            type: 0, // Role overwrite type
          })
        );
        expect(result.summary.succeeded).toBeGreaterThan(0);

        vi.useFakeTimers(); // Restore fake timers
      });

      it('should delete channel permission', async () => {
        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.permissions = [
          {
            operation: 'delete',
            targetId: 'channel-id-123',
            targetName: 'test-channel',
            targetType: 'channel',
            subjectId: 'role-id-456',
            subjectName: 'Test Role',
            subjectType: 'role',
            current: {
              allow: ['SEND_MESSAGES'],
              deny: [],
            },
          },
        ];
        diff.summary.delete = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId);
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(mockClient.deleteChannelPermission).toHaveBeenCalledWith(
          'channel-id-123',
          'role-id-456'
        );
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });
    });

    describe('error handling', () => {
      it('should continue on error when continueOnError is true', async () => {
        (mockClient.createRole as ReturnType<typeof vi.fn>)
          .mockRejectedValueOnce({ status: 500, message: 'Server error' })
          .mockResolvedValueOnce({ id: 'role-2', name: 'Role 2' });

        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.roles = [
          {
            operation: 'create',
            name: 'Role 1',
            desired: {
              name: 'Role 1',
              color: '#FF0000',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
          },
          {
            operation: 'create',
            name: 'Role 2',
            desired: {
              name: 'Role 2',
              color: '#00FF00',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
          },
        ];
        diff.summary.create = 2;
        diff.summary.total = 2;

        const applyPromise = writer.apply(diff, guildId, { continueOnError: true });
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        expect(result.summary.failed).toBeGreaterThan(0);
        expect(result.summary.succeeded).toBeGreaterThan(0);
      });

      it('should stop on error when continueOnError is false', async () => {
        (mockClient.createRole as ReturnType<typeof vi.fn>).mockRejectedValue({
          status: 403,
          message: 'Missing permissions',
        });

        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.roles = [
          {
            operation: 'create',
            name: 'Role 1',
            desired: {
              name: 'Role 1',
              color: '#FF0000',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
          },
          {
            operation: 'create',
            name: 'Role 2',
            desired: {
              name: 'Role 2',
              color: '#00FF00',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
          },
        ];
        diff.summary.create = 2;
        diff.summary.total = 2;

        const applyPromise = writer.apply(diff, guildId, { continueOnError: false });
        await vi.runAllTimersAsync();
        const result = await applyPromise;

        // Should have stopped after first failure
        expect(result.summary.failed).toBe(1);
        expect(mockClient.createRole).toHaveBeenCalledTimes(1);
      });
    });

    describe('progress callback', () => {
      it('should call progress callback for each operation', async () => {
        const onProgress = vi.fn();

        const diff = createEmptyDiff();
        diff.hasChanges = true;
        diff.roles = [
          {
            operation: 'create',
            name: 'Role 1',
            desired: {
              name: 'Role 1',
              color: '#FF0000',
              permissions: [],
              hoist: false,
              mentionable: false,
            },
          },
        ];
        diff.summary.create = 1;
        diff.summary.total = 1;

        const applyPromise = writer.apply(diff, guildId, { onProgress });
        await vi.runAllTimersAsync();
        await applyPromise;

        expect(onProgress).toHaveBeenCalled();
      });
    });

    describe('no changes', () => {
      it('should return early when no changes', async () => {
        const diff = createEmptyDiff();

        const result = await writer.apply(diff, guildId);

        expect(result.summary.total).toBe(0);
        expect(result.summary.succeeded).toBe(0);
        expect(result.summary.failed).toBe(0);
      });
    });
  });

  describe('formatApplyResult', () => {
    it('should format successful result', () => {
      const result: ApplyBatchResult = {
        success: true,
        results: [],
        summary: {
          total: 5,
          succeeded: 5,
          failed: 0,
        },
        totalDurationMs: 1234,
      };

      const formatted = formatApplyResult(result);

      expect(formatted).toContain('5');
      expect(formatted).toContain('SUCCESS');
    });

    it('should format result with failures', () => {
      const result: ApplyBatchResult = {
        success: false,
        results: [
          {
            success: false,
            operation: 'create',
            resourceType: 'role',
            resourceName: 'Failed Role',
            error: 'Missing permissions',
            durationMs: 100,
          },
        ],
        summary: {
          total: 5,
          succeeded: 3,
          failed: 2,
        },
        totalDurationMs: 2345,
      };

      const formatted = formatApplyResult(result);

      expect(formatted).toContain('3');
      expect(formatted).toContain('2');
      expect(formatted).toContain('FAILED');
    });

    it('should include total in output', () => {
      const result: ApplyBatchResult = {
        success: true,
        results: [],
        summary: {
          total: 3,
          succeeded: 3,
          failed: 0,
        },
        totalDurationMs: 50,
      };

      const formatted = formatApplyResult(result);

      expect(formatted).toContain('Total');
      expect(formatted).toContain('3');
    });
  });
});

/**
 * Sandbox + RouteProvider Integration Tests
 *
 * Sprint 86: Discord Server Sandboxes - Event Routing
 *
 * Verifies that SandboxManager correctly updates RouteProvider cache
 * when guilds are registered/unregistered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxManager } from '../../services/sandbox-manager.js';
import { RouteProvider } from '../../services/route-provider.js';
import type { Logger } from 'pino';

// Mock logger
const createMockLogger = (): Logger => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => logger),
  } as unknown as Logger;
  return logger;
};

// Mock SQL client
const createMockSql = () => {
  const mockResults: unknown[] = [];
  let callIndex = 0;

  const mockSql = vi.fn((..._args: unknown[]) => {
    const result = mockResults[callIndex] ?? [];
    callIndex++;
    return Promise.resolve(result);
  });

  (mockSql as any).mockResolvedValueOnce = (value: unknown) => {
    mockResults.push(value);
    return mockSql;
  };

  (mockSql as any).resetMocks = () => {
    mockResults.length = 0;
    callIndex = 0;
  };

  return mockSql;
};

// Mock Redis client
const createMockRedis = () => {
  const store = new Map<string, string>();

  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    _store: store,
    _clear: () => store.clear(),
  };
};

describe('SandboxManager + RouteProvider Integration', () => {
  let sandboxManager: SandboxManager;
  let routeProvider: RouteProvider;
  let mockSql: ReturnType<typeof createMockSql>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSql = createMockSql();
    mockRedis = createMockRedis();
    mockLogger = createMockLogger();
    mockRedis._clear();

    // Create RouteProvider
    routeProvider = new RouteProvider({
      sql: mockSql as any,
      redis: mockRedis as any,
      logger: mockLogger,
      cacheTtlMs: 60000,
    });

    // Create SandboxManager WITH RouteProvider for cache sync
    sandboxManager = new SandboxManager({
      sql: mockSql as any,
      logger: mockLogger,
      routeProvider,
    });
  });

  describe('Guild Registration', () => {
    it('should update RouteProvider cache when guild is registered', async () => {
      const sandboxId = 'sandbox-uuid';
      const guildId = '123456789012345678';

      // Mock: getById
      (mockSql as any).mockResolvedValueOnce([{
        id: sandboxId,
        name: 'test-sandbox',
        owner: 'testuser',
        status: 'running',
        schema_name: 'sandbox_12345678',
        discord_token_id: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        destroyed_at: null,
        last_activity_at: null,
        metadata: {},
        guild_ids: [],
      }]);
      // Mock: checkGuildAvailability
      (mockSql as any).mockResolvedValueOnce([]);
      // Mock: INSERT mapping
      (mockSql as any).mockResolvedValueOnce([]);
      // Mock: audit log
      (mockSql as any).mockResolvedValueOnce([]);

      await sandboxManager.registerGuild(sandboxId, guildId, 'testuser');

      // Verify RouteProvider cache was updated
      expect(mockRedis.set).toHaveBeenCalledWith(
        `sandbox:route:${guildId}`,
        sandboxId,
        'PX',
        60000
      );

      // Verify cache contains correct mapping
      expect(mockRedis._store.get(`sandbox:route:${guildId}`)).toBe(sandboxId);
    });

    it('should handle RouteProvider cache failure gracefully', async () => {
      const sandboxId = 'sandbox-uuid';
      const guildId = '123456789012345678';

      // Make Redis.set fail
      mockRedis.set.mockRejectedValueOnce(new Error('Redis connection failed'));

      // Mock: getById
      (mockSql as any).mockResolvedValueOnce([{
        id: sandboxId,
        name: 'test-sandbox',
        owner: 'testuser',
        status: 'running',
        schema_name: 'sandbox_12345678',
        discord_token_id: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        destroyed_at: null,
        last_activity_at: null,
        metadata: {},
        guild_ids: [],
      }]);
      // Mock: checkGuildAvailability
      (mockSql as any).mockResolvedValueOnce([]);
      // Mock: INSERT mapping
      (mockSql as any).mockResolvedValueOnce([]);
      // Mock: audit log
      (mockSql as any).mockResolvedValueOnce([]);

      // Should not throw even if cache update fails
      await expect(
        sandboxManager.registerGuild(sandboxId, guildId, 'testuser')
      ).resolves.toBeUndefined();

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Guild Unregistration', () => {
    it('should invalidate RouteProvider cache when guild is unregistered', async () => {
      const sandboxId = 'sandbox-uuid';
      const guildId = '123456789012345678';

      // Pre-populate cache
      mockRedis._store.set(`sandbox:route:${guildId}`, sandboxId);

      // Mock: DELETE returns count > 0
      (mockSql as any).mockResolvedValueOnce({ count: 1 });
      // Mock: audit log
      (mockSql as any).mockResolvedValueOnce([]);

      await sandboxManager.unregisterGuild(sandboxId, guildId, 'testuser');

      // Verify RouteProvider cache was invalidated
      expect(mockRedis.del).toHaveBeenCalledWith(`sandbox:route:${guildId}`);

      // Verify cache no longer contains mapping
      expect(mockRedis._store.has(`sandbox:route:${guildId}`)).toBe(false);
    });
  });

  describe('RouteProvider Lookup after SandboxManager Changes', () => {
    it('should immediately reflect new guild registration in lookups', async () => {
      const sandboxId = 'sandbox-uuid';
      const guildId = '123456789012345678';

      // Mock: getById for registration
      (mockSql as any).mockResolvedValueOnce([{
        id: sandboxId,
        name: 'test-sandbox',
        owner: 'testuser',
        status: 'running',
        schema_name: 'sandbox_12345678',
        discord_token_id: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        destroyed_at: null,
        last_activity_at: null,
        metadata: {},
        guild_ids: [],
      }]);
      // Mock: checkGuildAvailability
      (mockSql as any).mockResolvedValueOnce([]);
      // Mock: INSERT mapping
      (mockSql as any).mockResolvedValueOnce([]);
      // Mock: audit log
      (mockSql as any).mockResolvedValueOnce([]);

      // Register the guild
      await sandboxManager.registerGuild(sandboxId, guildId, 'testuser');

      // Lookup should hit cache (no DB query needed)
      const result = await routeProvider.getSandboxForGuild(guildId);

      expect(result.sandboxId).toBe(sandboxId);
      expect(result.cached).toBe(true);
    });

    it('should immediately reflect guild unregistration in lookups', async () => {
      const sandboxId = 'sandbox-uuid';
      const guildId = '123456789012345678';

      // Pre-populate cache
      mockRedis._store.set(`sandbox:route:${guildId}`, sandboxId);

      // Mock: DELETE for unregistration
      (mockSql as any).mockResolvedValueOnce({ count: 1 });
      // Mock: audit log
      (mockSql as any).mockResolvedValueOnce([]);

      // Unregister the guild
      await sandboxManager.unregisterGuild(sandboxId, guildId, 'testuser');

      // Mock: DB lookup returns nothing (guild no longer mapped)
      (mockSql as any).mockResolvedValueOnce([]);

      // Lookup should now return null (cache was invalidated)
      const result = await routeProvider.getSandboxForGuild(guildId);

      expect(result.sandboxId).toBeNull();
      // Cache was invalidated, so this should be a DB lookup
      expect(result.cached).toBe(false);
    });
  });
});

describe('RouteProvider Redis Failure Handling', () => {
  let routeProvider: RouteProvider;
  let mockSql: ReturnType<typeof createMockSql>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSql = createMockSql();
    mockRedis = createMockRedis();
    mockLogger = createMockLogger();
    mockRedis._clear();

    routeProvider = new RouteProvider({
      sql: mockSql as any,
      redis: mockRedis as any,
      logger: mockLogger,
      cacheTtlMs: 60000,
    });
  });

  it('should degrade to database lookup when Redis read fails', async () => {
    const guildId = '123456789012345678';
    const sandboxId = 'sandbox-uuid';

    // Make Redis.get fail
    mockRedis.get.mockRejectedValueOnce(new Error('Redis connection refused'));

    // Mock: DB lookup returns sandbox
    (mockSql as any).mockResolvedValueOnce([{ sandbox_id: sandboxId }]);

    const result = await routeProvider.getSandboxForGuild(guildId);

    expect(result.sandboxId).toBe(sandboxId);
    expect(result.cached).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should still return result when Redis write fails', async () => {
    const guildId = '123456789012345678';
    const sandboxId = 'sandbox-uuid';

    // Make Redis.set fail
    mockRedis.set.mockRejectedValueOnce(new Error('Redis write failed'));

    // Mock: DB lookup returns sandbox
    (mockSql as any).mockResolvedValueOnce([{ sandbox_id: sandboxId }]);

    const result = await routeProvider.getSandboxForGuild(guildId);

    expect(result.sandboxId).toBe(sandboxId);
    expect(result.cached).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/services/StateManager.js';
import type { Logger } from 'pino';

// Mock ioredis
const mockRedis = {
  status: 'ready',
  ping: vi.fn().mockResolvedValue('PONG'),
  quit: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(),
  zremrangebyscore: vi.fn(),
  zcard: vi.fn(),
  on: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedis),
}));

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

describe('StateManager', () => {
  let stateManager: StateManager;
  const testRedisUrl = 'redis://localhost:6379';

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager(testRedisUrl, mockLogger);
  });

  afterEach(async () => {
    await stateManager.close();
  });

  describe('connect', () => {
    it('should connect to Redis and verify with ping', async () => {
      await stateManager.connect();

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'StateManager' });
    });

    it('should register event handlers on connection', async () => {
      await stateManager.connect();

      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('isConnected', () => {
    it('should return false before connection', () => {
      expect(stateManager.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await stateManager.connect();
      expect(stateManager.isConnected()).toBe(true);
    });
  });

  describe('ping', () => {
    it('should return null when not connected', async () => {
      const result = await stateManager.ping();
      expect(result).toBeNull();
    });

    it('should return latency when connected', async () => {
      await stateManager.connect();
      const result = await stateManager.ping();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should return null on ping error', async () => {
      await stateManager.connect();
      mockRedis.ping.mockRejectedValueOnce(new Error('ping failed'));

      const result = await stateManager.ping();
      expect(result).toBeNull();
    });
  });

  describe('Generic Key Operations', () => {
    beforeEach(async () => {
      await stateManager.connect();
    });

    describe('exists', () => {
      it('should return true when key exists', async () => {
        mockRedis.exists.mockResolvedValue(1);

        const result = await stateManager.exists('test:key');
        expect(result).toBe(true);
        expect(mockRedis.exists).toHaveBeenCalledWith('test:key');
      });

      it('should return false when key does not exist', async () => {
        mockRedis.exists.mockResolvedValue(0);

        const result = await stateManager.exists('test:key');
        expect(result).toBe(false);
      });
    });

    describe('set', () => {
      it('should set key without TTL', async () => {
        mockRedis.set.mockResolvedValue('OK');

        await stateManager.set('test:key', 'value');
        expect(mockRedis.set).toHaveBeenCalledWith('test:key', 'value');
      });

      it('should set key with TTL', async () => {
        mockRedis.set.mockResolvedValue('OK');

        await stateManager.set('test:key', 'value', 5000);
        expect(mockRedis.set).toHaveBeenCalledWith('test:key', 'value', 'PX', 5000);
      });
    });

    describe('get', () => {
      it('should return value when key exists', async () => {
        mockRedis.get.mockResolvedValue('test-value');

        const result = await stateManager.get('test:key');
        expect(result).toBe('test-value');
      });

      it('should return null when key does not exist', async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await stateManager.get('test:key');
        expect(result).toBeNull();
      });
    });

    describe('delete', () => {
      it('should delete key', async () => {
        mockRedis.del.mockResolvedValue(1);

        await stateManager.delete('test:key');
        expect(mockRedis.del).toHaveBeenCalledWith('test:key');
      });
    });
  });

  describe('Cooldown Operations', () => {
    beforeEach(async () => {
      await stateManager.connect();
    });

    describe('setCooldown', () => {
      it('should set cooldown with correct key pattern', async () => {
        mockRedis.set.mockResolvedValue('OK');
        const ttlMs = 5000;

        await stateManager.setCooldown('verify', 'user123', ttlMs);

        expect(mockRedis.set).toHaveBeenCalledWith(
          'cd:verify:user123',
          expect.any(String),
          'PX',
          ttlMs
        );
      });
    });

    describe('getCooldown', () => {
      it('should return not on cooldown when key does not exist', async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await stateManager.getCooldown('verify', 'user123');

        expect(result).toEqual({ isOnCooldown: false, remainingMs: 0 });
      });

      it('should return remaining time when on cooldown', async () => {
        const futureTime = Date.now() + 3000;
        mockRedis.get.mockResolvedValue(futureTime.toString());

        const result = await stateManager.getCooldown('verify', 'user123');

        expect(result.isOnCooldown).toBe(true);
        expect(result.remainingMs).toBeGreaterThan(0);
        expect(result.remainingMs).toBeLessThanOrEqual(3000);
      });

      it('should return not on cooldown when cooldown expired', async () => {
        const pastTime = Date.now() - 1000;
        mockRedis.get.mockResolvedValue(pastTime.toString());

        const result = await stateManager.getCooldown('verify', 'user123');

        expect(result).toEqual({ isOnCooldown: false, remainingMs: 0 });
      });
    });

    describe('clearCooldown', () => {
      it('should delete cooldown key', async () => {
        mockRedis.del.mockResolvedValue(1);

        await stateManager.clearCooldown('verify', 'user123');

        expect(mockRedis.del).toHaveBeenCalledWith('cd:verify:user123');
      });
    });
  });

  describe('Session Operations', () => {
    beforeEach(async () => {
      await stateManager.connect();
    });

    describe('setSession', () => {
      it('should store session data as JSON', async () => {
        mockRedis.set.mockResolvedValue('OK');

        await stateManager.setSession('wizard', 'user123', { step: 1 }, 60000);

        expect(mockRedis.set).toHaveBeenCalledWith(
          'sess:wizard:user123',
          expect.stringContaining('"step":1'),
          'PX',
          60000
        );
      });

      it('should include metadata in session', async () => {
        mockRedis.set.mockResolvedValue('OK');

        await stateManager.setSession('wizard', 'user123', { step: 1 }, 60000);

        const call = mockRedis.set.mock.calls[0];
        const sessionData = JSON.parse(call[1]);

        expect(sessionData).toMatchObject({
          type: 'wizard',
          userId: 'user123',
          data: { step: 1 },
        });
        expect(sessionData.createdAt).toBeDefined();
        expect(sessionData.expiresAt).toBeDefined();
      });
    });

    describe('getSession', () => {
      it('should return null when session does not exist', async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await stateManager.getSession('wizard', 'user123');

        expect(result).toBeNull();
      });

      it('should return parsed session data', async () => {
        const sessionData = {
          type: 'wizard',
          userId: 'user123',
          data: { step: 2 },
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
        };
        mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

        const result = await stateManager.getSession('wizard', 'user123');

        expect(result).toEqual(sessionData);
      });

      it('should return null on parse error', async () => {
        mockRedis.get.mockResolvedValue('invalid json');

        const result = await stateManager.getSession('wizard', 'user123');

        expect(result).toBeNull();
      });
    });

    describe('deleteSession', () => {
      it('should delete session key', async () => {
        mockRedis.del.mockResolvedValue(1);

        await stateManager.deleteSession('wizard', 'user123');

        expect(mockRedis.del).toHaveBeenCalledWith('sess:wizard:user123');
      });
    });

    describe('updateSession', () => {
      it('should return false when session does not exist', async () => {
        mockRedis.get.mockResolvedValue(null);

        const result = await stateManager.updateSession('wizard', 'user123', (data) => ({
          ...data,
          step: 2,
        }));

        expect(result).toBe(false);
      });

      it('should update session data and preserve TTL', async () => {
        const expiresAt = Date.now() + 30000;
        const sessionData = {
          type: 'wizard',
          userId: 'user123',
          data: { step: 1 },
          createdAt: Date.now(),
          expiresAt,
        };
        mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));
        mockRedis.set.mockResolvedValue('OK');

        const result = await stateManager.updateSession('wizard', 'user123', (data) => ({
          ...data,
          step: 2,
        }));

        expect(result).toBe(true);
        expect(mockRedis.set).toHaveBeenCalledWith(
          'sess:wizard:user123',
          expect.stringContaining('"step":2'),
          'PX',
          expect.any(Number)
        );
      });

      it('should return false when session expired', async () => {
        const sessionData = {
          type: 'wizard',
          userId: 'user123',
          data: { step: 1 },
          createdAt: Date.now() - 60000,
          expiresAt: Date.now() - 1000,
        };
        mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

        const result = await stateManager.updateSession('wizard', 'user123', (data) => ({
          ...data,
          step: 2,
        }));

        expect(result).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await stateManager.connect();
    });

    describe('incrementRateLimit', () => {
      it('should use sorted set for sliding window', async () => {
        const mockPipeline = {
          zremrangebyscore: vi.fn().mockReturnThis(),
          zadd: vi.fn().mockReturnThis(),
          zcard: vi.fn().mockReturnThis(),
          pexpire: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([
            [null, 0], // zremrangebyscore
            [null, 1], // zadd
            [null, 5], // zcard
            [null, 1], // pexpire
          ]),
        };
        mockRedis.pipeline.mockReturnValue(mockPipeline);

        const result = await stateManager.incrementRateLimit('user:123', 60000);

        expect(result).toBe(5);
        expect(mockPipeline.zremrangebyscore).toHaveBeenCalled();
        expect(mockPipeline.zadd).toHaveBeenCalled();
        expect(mockPipeline.zcard).toHaveBeenCalled();
        expect(mockPipeline.pexpire).toHaveBeenCalled();
      });
    });

    describe('getRateLimitCount', () => {
      it('should return current count after cleanup', async () => {
        mockRedis.zremrangebyscore.mockResolvedValue(1);
        mockRedis.zcard.mockResolvedValue(3);

        const result = await stateManager.getRateLimitCount('user:123', 60000);

        expect(result).toBe(3);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw when not connected for exists', async () => {
      await expect(stateManager.exists('key')).rejects.toThrow('Redis not connected');
    });

    it('should throw when not connected for set', async () => {
      await expect(stateManager.set('key', 'value')).rejects.toThrow('Redis not connected');
    });

    it('should throw when not connected for get', async () => {
      await expect(stateManager.get('key')).rejects.toThrow('Redis not connected');
    });

    it('should throw when not connected for delete', async () => {
      await expect(stateManager.delete('key')).rejects.toThrow('Redis not connected');
    });

    it('should throw when not connected for incrementRateLimit', async () => {
      await expect(stateManager.incrementRateLimit('id', 60000)).rejects.toThrow(
        'Redis not connected'
      );
    });

    it('should throw when not connected for getRateLimitCount', async () => {
      await expect(stateManager.getRateLimitCount('id', 60000)).rejects.toThrow(
        'Redis not connected'
      );
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      await stateManager.connect();
      await stateManager.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle multiple close calls gracefully', async () => {
      await stateManager.connect();
      await stateManager.close();
      await stateManager.close();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { createHealthServer, type HealthChecker, type ConsumerStatus } from '../src/health.js';
import type { Logger } from 'pino';

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

describe('createHealthServer', () => {
  let server: http.Server;
  let mockChecker: HealthChecker;
  const port = 3456;
  const memoryThresholdMb = 256;

  const defaultInteractionStatus: ConsumerStatus = {
    connected: true,
    consuming: true,
    messagesProcessed: 100,
    messagesErrored: 5,
  };

  const defaultEventStatus: ConsumerStatus = {
    connected: true,
    consuming: true,
    messagesProcessed: 500,
    messagesErrored: 10,
  };

  beforeEach(() => {
    mockChecker = {
      getInteractionConsumerStatus: vi.fn().mockReturnValue(defaultInteractionStatus),
      getEventConsumerStatus: vi.fn().mockReturnValue(defaultEventStatus),
      getRedisStatus: vi.fn().mockReturnValue(true),
      getRedisLatency: vi.fn().mockResolvedValue(5),
      getStartTime: vi.fn().mockReturnValue(Date.now() - 60000),
    };
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  const makeRequest = (path: string): Promise<{ status: number; body: any }> => {
    return new Promise((resolve) => {
      http.get(`http://localhost:${port}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 500,
            body: JSON.parse(data),
          });
        });
      });
    });
  };

  describe('health endpoint', () => {
    it('should return 200 when healthy', async () => {
      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100)); // Wait for server to start

      const { status, body } = await makeRequest('/health');

      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
    });

    it('should return 200 on root path', async () => {
      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { status, body } = await makeRequest('/');

      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
    });

    it('should return 404 for unknown paths', async () => {
      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { status, body } = await makeRequest('/unknown');

      expect(status).toBe(404);
      expect(body.error).toBe('Not found');
    });

    it('should return 503 when RabbitMQ is disconnected', async () => {
      mockChecker.getInteractionConsumerStatus = vi.fn().mockReturnValue({
        ...defaultInteractionStatus,
        connected: false,
        consuming: false,
      });
      mockChecker.getEventConsumerStatus = vi.fn().mockReturnValue({
        ...defaultEventStatus,
        connected: false,
        consuming: false,
      });

      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { status, body } = await makeRequest('/health');

      expect(status).toBe(503);
      expect(body.status).toBe('unhealthy');
    });

    it('should return 503 when Redis is disconnected', async () => {
      mockChecker.getRedisStatus = vi.fn().mockReturnValue(false);

      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { status, body } = await makeRequest('/health');

      expect(status).toBe(503);
      expect(body.status).toBe('unhealthy');
      expect(body.checks.redis.connected).toBe(false);
    });

    it('should return 503 when memory exceeds threshold', async () => {
      // Set threshold very low to trigger unhealthy
      server = createHealthServer(port, 0.001, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { status, body } = await makeRequest('/health');

      expect(status).toBe(503);
      expect(body.checks.memory.belowThreshold).toBe(false);
    });

    it('should include detailed health checks in response', async () => {
      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { body } = await makeRequest('/health');

      expect(body.checks).toBeDefined();
      expect(body.checks.rabbitmq).toBeDefined();
      expect(body.checks.rabbitmq.connected).toBe(true);
      expect(body.checks.rabbitmq.channelOpen).toBe(true);
      expect(body.checks.rabbitmq.consumersActive).toBe(2);

      expect(body.checks.redis).toBeDefined();
      expect(body.checks.redis.connected).toBe(true);
      expect(body.checks.redis.latencyMs).toBe(5);

      expect(body.checks.memory).toBeDefined();
      expect(body.checks.memory.heapUsed).toBeGreaterThan(0);
      expect(body.checks.memory.belowThreshold).toBe(true);
    });

    it('should include stats in response', async () => {
      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { body } = await makeRequest('/health');

      expect(body.stats).toBeDefined();
      expect(body.stats.messagesProcessed).toBe(600); // 100 + 500
      expect(body.stats.messagesErrored).toBe(15); // 5 + 10
      expect(body.stats.uptime).toBeGreaterThan(0);
    });

    it('should count active consumers correctly', async () => {
      mockChecker.getInteractionConsumerStatus = vi.fn().mockReturnValue({
        ...defaultInteractionStatus,
        consuming: false,
      });

      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { body } = await makeRequest('/health');

      expect(body.checks.rabbitmq.consumersActive).toBe(1);
    });

    it('should include timestamp in response', async () => {
      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const before = Date.now();
      const { body } = await makeRequest('/health');
      const after = Date.now();

      expect(body.timestamp).toBeGreaterThanOrEqual(before);
      expect(body.timestamp).toBeLessThanOrEqual(after);
    });

    it('should be healthy with at least one connected consumer', async () => {
      mockChecker.getInteractionConsumerStatus = vi.fn().mockReturnValue({
        ...defaultInteractionStatus,
        connected: false,
        consuming: false,
      });

      server = createHealthServer(port, memoryThresholdMb, mockChecker, mockLogger);
      await new Promise((r) => setTimeout(r, 100));

      const { status, body } = await makeRequest('/health');

      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
    });
  });
});

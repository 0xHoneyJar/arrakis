import * as http from 'node:http';
import type { Logger } from 'pino';
import type { WorkerHealthStatus } from './types.js';

/**
 * Consumer status for health checks
 */
export interface ConsumerStatus {
  connected: boolean;
  consuming: boolean;
  messagesProcessed: number;
  messagesErrored: number;
}

/**
 * Health checker interface for dependency injection
 */
export interface HealthChecker {
  getInteractionConsumerStatus: () => ConsumerStatus;
  getEventConsumerStatus: () => ConsumerStatus;
  getRedisStatus: () => boolean;
  getRedisLatency: () => Promise<number | null>;
  getStartTime: () => number;
}

/**
 * Create and start the health check HTTP server
 */
export function createHealthServer(
  port: number,
  memoryThresholdMb: number,
  checker: HealthChecker,
  logger: Logger
): http.Server {
  const log = logger.child({ component: 'health' });

  const server = http.createServer(async (req, res) => {
    if (req.url !== '/' && req.url !== '/health') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    try {
      const status = await buildHealthStatus(memoryThresholdMb, checker);
      const statusCode = status.status === 'healthy' ? 200 : 503;

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } catch (error) {
      log.error({ error }, 'Error building health status');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy', error: 'Internal error' }));
    }
  });

  server.listen(port, () => {
    log.info({ port }, 'Health server listening');
  });

  return server;
}

/**
 * Build comprehensive health status
 */
async function buildHealthStatus(
  memoryThresholdMb: number,
  checker: HealthChecker
): Promise<WorkerHealthStatus> {
  const interactionStatus = checker.getInteractionConsumerStatus();
  const eventStatus = checker.getEventConsumerStatus();
  const redisConnected = checker.getRedisStatus();
  const redisLatency = await checker.getRedisLatency();

  const memUsage = process.memoryUsage();
  const heapUsedMb = memUsage.heapUsed / 1024 / 1024;
  const belowThreshold = heapUsedMb < memoryThresholdMb;

  // Count active consumers
  const consumersActive =
    (interactionStatus.consuming ? 1 : 0) + (eventStatus.consuming ? 1 : 0);

  // RabbitMQ is healthy if at least one consumer is connected and consuming
  const rabbitmqHealthy =
    (interactionStatus.connected || eventStatus.connected) &&
    consumersActive > 0;

  // Overall health
  const isHealthy = rabbitmqHealthy && redisConnected && belowThreshold;

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: Date.now(),
    checks: {
      rabbitmq: {
        connected: interactionStatus.connected || eventStatus.connected,
        channelOpen: interactionStatus.consuming || eventStatus.consuming,
        consumersActive,
      },
      redis: {
        connected: redisConnected,
        latencyMs: redisLatency,
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        belowThreshold,
      },
    },
    stats: {
      messagesProcessed:
        interactionStatus.messagesProcessed + eventStatus.messagesProcessed,
      messagesErrored:
        interactionStatus.messagesErrored + eventStatus.messagesErrored,
      uptime: Date.now() - checker.getStartTime(),
    },
  };
}

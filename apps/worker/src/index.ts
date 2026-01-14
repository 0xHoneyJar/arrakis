import pino from 'pino';
import { getConfig } from './config.js';
import { InteractionConsumer } from './consumers/InteractionConsumer.js';
import { EventConsumer } from './consumers/EventConsumer.js';
import { DiscordRestService } from './services/DiscordRest.js';
import { StateManager } from './services/StateManager.js';
import { createHealthServer, type HealthChecker } from './health.js';

// Initialize logger first
const env = process.env;
const logger = pino({
  level: env['LOG_LEVEL'] || 'info',
  transport:
    env['NODE_ENV'] === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

// Track start time for uptime
const startTime = Date.now();

// Global state for health checks
let interactionConsumer: InteractionConsumer | null = null;
let eventConsumer: EventConsumer | null = null;
let stateManager: StateManager | null = null;
let healthServer: ReturnType<typeof createHealthServer> | null = null;

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Arrakis Worker service');

  // Load configuration (will throw if invalid)
  const config = getConfig();
  logger.info({ env: config.nodeEnv }, 'Configuration loaded');

  // Initialize Discord REST service (stateless, no connection needed)
  const discordRest = new DiscordRestService(config.discordApplicationId, logger);
  logger.info('Discord REST service initialized');

  // Initialize State Manager (Redis)
  stateManager = new StateManager(config.redisUrl, logger);
  await stateManager.connect();
  logger.info('State Manager connected to Redis');

  // Initialize consumers
  interactionConsumer = new InteractionConsumer(
    config.rabbitmqUrl,
    config.interactionQueue,
    config.interactionPrefetch,
    discordRest,
    stateManager,
    logger
  );

  eventConsumer = new EventConsumer(
    config.rabbitmqUrl,
    config.eventQueue,
    config.eventPrefetch,
    stateManager,
    logger
  );

  // Connect consumers to RabbitMQ
  await Promise.all([
    interactionConsumer.connect(),
    eventConsumer.connect(),
  ]);
  logger.info('Consumers connected to RabbitMQ');

  // Start consuming
  await Promise.all([
    interactionConsumer.startConsuming(),
    eventConsumer.startConsuming(),
  ]);
  logger.info('Consumers started processing messages');

  // Create health checker
  const healthChecker: HealthChecker = {
    getInteractionConsumerStatus: () => interactionConsumer?.getStatus() ?? { connected: false, consuming: false, messagesProcessed: 0, messagesErrored: 0 },
    getEventConsumerStatus: () => eventConsumer?.getStatus() ?? { connected: false, consuming: false, messagesProcessed: 0, messagesErrored: 0 },
    getRedisStatus: () => stateManager?.isConnected() ?? false,
    getRedisLatency: () => stateManager?.ping() ?? Promise.resolve(null),
    getStartTime: () => startTime,
  };

  // Start health server
  healthServer = createHealthServer(config.healthPort, config.memoryThresholdMb, healthChecker, logger);
  logger.info({ port: config.healthPort }, 'Health check server started');

  logger.info('Worker service fully initialized and ready');
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');

  // Stop health server first
  if (healthServer) {
    healthServer.close();
    logger.info('Health server closed');
  }

  // Stop consuming (but keep connections open to finish in-flight)
  if (interactionConsumer) {
    await interactionConsumer.stopConsuming();
    logger.info('Interaction consumer stopped');
  }

  if (eventConsumer) {
    await eventConsumer.stopConsuming();
    logger.info('Event consumer stopped');
  }

  // Close connections
  await Promise.all([
    interactionConsumer?.close(),
    eventConsumer?.close(),
    stateManager?.close(),
  ]);

  logger.info('All connections closed, worker shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception, shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection, shutting down');
  process.exit(1);
});

// Start the worker
main().catch((error) => {
  logger.fatal({ error }, 'Failed to start worker');
  process.exit(1);
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Logger } from 'pino';
import type { DiscordRestService } from '../../src/services/DiscordRest.js';
import type { StateManager } from '../../src/services/StateManager.js';
import type { DiscordEventPayload } from '../../src/types.js';

// Mock channel and connection - must be defined before vi.mock
const mockChannel = {
  prefetch: vi.fn().mockResolvedValue(undefined),
  consume: vi.fn(),
  ack: vi.fn(),
  nack: vi.fn(),
  cancel: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

const mockConnection = {
  createChannel: vi.fn().mockResolvedValue(mockChannel),
  close: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

// Mock amqplib - use default export
vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn().mockImplementation(() => Promise.resolve(mockConnection)),
  },
}));

// Import after mocking
import { InteractionConsumer } from '../../src/consumers/InteractionConsumer.js';

// Mock handlers
vi.mock('../../src/handlers/index.js', () => ({
  getCommandHandler: vi.fn().mockReturnValue(null),
  defaultCommandHandler: vi.fn().mockResolvedValue('ack'),
}));

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

// Mock DiscordRestService
const mockDiscordRest: DiscordRestService = {
  deferReply: vi.fn().mockResolvedValue({ success: true }),
  sendFollowup: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
  editOriginal: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
  setToken: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  sendDM: vi.fn(),
  getGuildMember: vi.fn(),
} as unknown as DiscordRestService;

// Mock StateManager
const mockStateManager: StateManager = {
  connect: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  ping: vi.fn(),
  close: vi.fn(),
  exists: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  setCooldown: vi.fn(),
  getCooldown: vi.fn(),
  clearCooldown: vi.fn(),
  setSession: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
  updateSession: vi.fn(),
  incrementRateLimit: vi.fn(),
  getRateLimitCount: vi.fn(),
} as unknown as StateManager;

describe('InteractionConsumer', () => {
  let consumer: InteractionConsumer;
  const rabbitmqUrl = 'amqp://localhost:5672';
  const queueName = 'arrakis.interactions';
  const prefetch = 5;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new InteractionConsumer(
      rabbitmqUrl,
      queueName,
      prefetch,
      mockDiscordRest,
      mockStateManager,
      mockLogger
    );
  });

  afterEach(async () => {
    await consumer.close();
  });

  describe('connect', () => {
    it('should connect to RabbitMQ', async () => {
      await consumer.connect();

      // Verify channel was created and configured
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.prefetch).toHaveBeenCalledWith(prefetch);
    });

    it('should register event handlers', async () => {
      await consumer.connect();

      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockChannel.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockChannel.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('startConsuming', () => {
    it('should throw if not connected', async () => {
      await expect(consumer.startConsuming()).rejects.toThrow(
        'Channel not initialized. Call connect() first.'
      );
    });

    it('should start consuming from queue', async () => {
      await consumer.connect();
      mockChannel.consume.mockResolvedValue({ consumerTag: 'consumer-123' });

      await consumer.startConsuming();

      expect(mockChannel.consume).toHaveBeenCalledWith(
        queueName,
        expect.any(Function),
        { noAck: false }
      );
    });
  });

  describe('message processing', () => {
    let messageHandler: (msg: { content: Buffer } | null) => Promise<void>;

    beforeEach(async () => {
      await consumer.connect();
      mockChannel.consume.mockImplementation((queue: string, handler: any) => {
        messageHandler = handler;
        return Promise.resolve({ consumerTag: 'consumer-123' });
      });
      await consumer.startConsuming();
    });

    it('should ignore null messages', async () => {
      await messageHandler(null);

      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should defer and process interaction events', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-123',
        eventType: 'interaction.command.verify',
        guildId: 'guild-123',
        timestamp: Date.now(),
        interactionId: 'interaction-123',
        interactionToken: 'token-123',
        data: {},
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockDiscordRest.deferReply).toHaveBeenCalledWith('interaction-123', 'token-123');
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should nack non-interaction events', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-123',
        eventType: 'member.join',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: {},
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      // Non-interaction events are acked to prevent blocking
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should nack when missing interaction token', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-123',
        eventType: 'interaction.command.verify',
        guildId: 'guild-123',
        timestamp: Date.now(),
        // Missing interactionId and interactionToken
        data: {},
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should nack when defer fails', async () => {
      vi.mocked(mockDiscordRest.deferReply).mockResolvedValueOnce({
        success: false,
        error: 'Token expired',
      });

      const payload: DiscordEventPayload = {
        eventId: 'event-123',
        eventType: 'interaction.command.verify',
        guildId: 'guild-123',
        timestamp: Date.now(),
        interactionId: 'interaction-123',
        interactionToken: 'token-123',
        data: {},
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should handle JSON parse errors', async () => {
      const msg = { content: Buffer.from('invalid json') };
      await messageHandler(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });
  });

  describe('stopConsuming', () => {
    it('should cancel consumer', async () => {
      await consumer.connect();
      mockChannel.consume.mockResolvedValue({ consumerTag: 'consumer-123' });
      await consumer.startConsuming();

      await consumer.stopConsuming();

      expect(mockChannel.cancel).toHaveBeenCalledWith('consumer-123');
    });

    it('should not throw if not consuming', async () => {
      await consumer.connect();

      await expect(consumer.stopConsuming()).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('should close channel and connection', async () => {
      await consumer.connect();
      await consumer.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return disconnected status initially', () => {
      const status = consumer.getStatus();

      expect(status).toEqual({
        connected: false,
        consuming: false,
        messagesProcessed: 0,
        messagesErrored: 0,
      });
    });

    it('should return connected status after connect', async () => {
      await consumer.connect();

      const status = consumer.getStatus();

      expect(status.connected).toBe(true);
      expect(status.consuming).toBe(false);
    });

    it('should return consuming status after startConsuming', async () => {
      await consumer.connect();
      mockChannel.consume.mockResolvedValue({ consumerTag: 'consumer-123' });
      await consumer.startConsuming();

      const status = consumer.getStatus();

      expect(status.connected).toBe(true);
      expect(status.consuming).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Logger } from 'pino';
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
import { EventConsumer } from '../../src/consumers/EventConsumer.js';

// Mock handlers
vi.mock('../../src/handlers/index.js', () => ({
  getEventHandler: vi.fn().mockReturnValue(null),
  defaultEventHandler: vi.fn().mockResolvedValue('ack'),
}));

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

// Mock StateManager
const mockStateManager: StateManager = {
  connect: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  ping: vi.fn(),
  close: vi.fn(),
  exists: vi.fn().mockResolvedValue(false),
  set: vi.fn().mockResolvedValue(undefined),
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

describe('EventConsumer', () => {
  let consumer: EventConsumer;
  const rabbitmqUrl = 'amqp://localhost:5672';
  const queueName = 'arrakis.events.guild';
  const prefetch = 10;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new EventConsumer(rabbitmqUrl, queueName, prefetch, mockStateManager, mockLogger);
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
      mockChannel.consume.mockResolvedValue({ consumerTag: 'consumer-456' });

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
        return Promise.resolve({ consumerTag: 'consumer-456' });
      });
      await consumer.startConsuming();
    });

    it('should ignore null messages', async () => {
      await messageHandler(null);

      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should process member.join events', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-123',
        eventType: 'member.join',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: { userId: 'user-123' },
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should process member.leave events', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-124',
        eventType: 'member.leave',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: { userId: 'user-456' },
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should process member.update events', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-125',
        eventType: 'member.update',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: { userId: 'user-789' },
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should process guild.create events', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-126',
        eventType: 'guild.create',
        guildId: 'guild-456',
        timestamp: Date.now(),
        data: {},
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should process guild.delete events', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-127',
        eventType: 'guild.delete',
        guildId: 'guild-789',
        timestamp: Date.now(),
        data: {},
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should skip message.create events', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-128',
        eventType: 'message.create',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: {},
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should ack unexpected event types', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-129',
        eventType: 'unknown.event' as any,
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: {},
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      // Unexpected events are acked to prevent blocking
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should check idempotency before processing', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-123',
        eventType: 'member.join',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: { userId: 'user-123' },
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockStateManager.exists).toHaveBeenCalledWith('event:processed:event-123');
    });

    it('should skip already processed events', async () => {
      vi.mocked(mockStateManager.exists).mockResolvedValueOnce(true);

      const payload: DiscordEventPayload = {
        eventId: 'event-duplicate',
        eventType: 'member.join',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: { userId: 'user-123' },
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      // Should ack without processing
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should mark event as processed after success', async () => {
      const payload: DiscordEventPayload = {
        eventId: 'event-new',
        eventType: 'member.join',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: { userId: 'user-123' },
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      expect(mockStateManager.set).toHaveBeenCalledWith(
        'event:processed:event-new',
        '1',
        24 * 60 * 60 * 1000 // 24 hours
      );
    });

    it('should handle JSON parse errors', async () => {
      const msg = { content: Buffer.from('invalid json') };
      await messageHandler(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should handle idempotency check errors gracefully', async () => {
      vi.mocked(mockStateManager.exists).mockRejectedValueOnce(new Error('Redis down'));

      const payload: DiscordEventPayload = {
        eventId: 'event-redis-error',
        eventType: 'member.join',
        guildId: 'guild-123',
        timestamp: Date.now(),
        data: { userId: 'user-123' },
      };

      const msg = { content: Buffer.from(JSON.stringify(payload)) };
      await messageHandler(msg);

      // Should still process (assume not processed on Redis error)
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });
  });

  describe('stopConsuming', () => {
    it('should cancel consumer', async () => {
      await consumer.connect();
      mockChannel.consume.mockResolvedValue({ consumerTag: 'consumer-456' });
      await consumer.startConsuming();

      await consumer.stopConsuming();

      expect(mockChannel.cancel).toHaveBeenCalledWith('consumer-456');
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
      mockChannel.consume.mockResolvedValue({ consumerTag: 'consumer-456' });
      await consumer.startConsuming();

      const status = consumer.getStatus();

      expect(status.connected).toBe(true);
      expect(status.consuming).toBe(true);
    });
  });
});

/**
 * WebhookService Tests (v5.0 - Sprint 2 Paddle Migration)
 *
 * Tests for Paddle webhook processing with idempotency.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  IBillingProvider,
  ProviderWebhookEvent,
  WebhookVerificationResult,
} from '../../../src/packages/core/ports/IBillingProvider.js';

// Mock dependencies
vi.mock('../../../src/services/cache/RedisService.js', () => ({
  redisService: {
    isEventProcessed: vi.fn(),
    markEventProcessed: vi.fn(),
    acquireEventLock: vi.fn(),
    releaseEventLock: vi.fn(),
    invalidateEntitlements: vi.fn(),
  },
}));

vi.mock('../../../src/db/billing-queries.js', () => ({
  isWebhookEventProcessed: vi.fn(),
  recordWebhookEvent: vi.fn(),
  getSubscriptionByCommunityId: vi.fn(),
  getSubscriptionByPaymentId: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  logBillingAuditEvent: vi.fn(),
}));

vi.mock('../../../src/services/boost/BoostService.js', () => ({
  boostService: {
    activateBoost: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('WebhookService', () => {
  let webhookService: any;
  let mockBillingProvider: IBillingProvider;
  let mockRedisService: any;
  let mockBillingQueries: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock billing provider
    mockBillingProvider = {
      provider: 'paddle',
      verifyWebhook: vi.fn(),
      getOrCreateCustomer: vi.fn(),
      getCustomer: vi.fn(),
      createCheckoutSession: vi.fn(),
      createOneTimeCheckoutSession: vi.fn(),
      createPortalSession: vi.fn(),
      getSubscription: vi.fn(),
      cancelSubscription: vi.fn(),
      resumeSubscription: vi.fn(),
      updateSubscriptionTier: vi.fn(),
      mapSubscriptionStatus: vi.fn().mockReturnValue('active'),
      isHealthy: vi.fn(),
    };

    // Import modules
    const webhookModule = await import('../../../src/services/billing/WebhookService.js');
    const redisModule = await import('../../../src/services/cache/RedisService.js');
    const queriesModule = await import('../../../src/db/billing-queries.js');

    webhookService = webhookModule.webhookService;
    mockRedisService = redisModule.redisService;
    mockBillingQueries = queriesModule;

    // Inject mock billing provider
    webhookService.setBillingProvider(mockBillingProvider);

    // Setup default mocks
    mockRedisService.isEventProcessed.mockResolvedValue(false);
    mockRedisService.acquireEventLock.mockResolvedValue(true);
    mockBillingQueries.isWebhookEventProcessed.mockReturnValue(false);
  });

  // ===========================================================================
  // Signature Verification
  // ===========================================================================

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const mockEvent: ProviderWebhookEvent = {
        id: 'evt_test',
        type: 'payment.completed',
        rawType: 'transaction.completed',
        data: {},
        timestamp: new Date(),
      };
      const mockResult: WebhookVerificationResult = {
        valid: true,
        event: mockEvent,
      };
      (mockBillingProvider.verifyWebhook as any).mockReturnValue(mockResult);

      const result = webhookService.verifySignature('raw-body', 'signature');
      expect(result).toEqual(mockEvent);
      expect(mockBillingProvider.verifyWebhook).toHaveBeenCalledWith(
        'raw-body',
        'signature'
      );
    });

    it('should throw error on invalid signature', () => {
      const mockResult: WebhookVerificationResult = {
        valid: false,
        error: 'Invalid signature',
      };
      (mockBillingProvider.verifyWebhook as any).mockReturnValue(mockResult);

      expect(() => {
        webhookService.verifySignature('raw-body', 'bad-signature');
      }).toThrow('Invalid signature');
    });

    it('should throw generic error when no error message provided', () => {
      const mockResult: WebhookVerificationResult = {
        valid: false,
      };
      (mockBillingProvider.verifyWebhook as any).mockReturnValue(mockResult);

      expect(() => {
        webhookService.verifySignature('raw-body', 'bad-signature');
      }).toThrow('Invalid webhook signature');
    });

    it('should throw error when provider not configured', () => {
      // Create new instance without provider
      const WebhookServiceClass = (webhookService as any).constructor;
      const newInstance = new WebhookServiceClass();

      expect(() => {
        newInstance.verifySignature('raw-body', 'signature');
      }).toThrow('Billing provider not configured');
    });
  });

  // ===========================================================================
  // Event Processing - Idempotency
  // ===========================================================================

  describe('processEvent - idempotency', () => {
    const createMockEvent = (
      type: string = 'payment.completed',
      rawType: string = 'transaction.completed'
    ): ProviderWebhookEvent => ({
      id: 'evt_test',
      type: type as any,
      rawType,
      data: { subscriptionId: 'sub_123' },
      timestamp: new Date(),
    });

    it('should reject duplicate event from Redis', async () => {
      mockRedisService.isEventProcessed.mockResolvedValue(true);

      const event = createMockEvent();
      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('duplicate');
      expect(result.message).toContain('Redis');
    });

    it('should reject duplicate event from database', async () => {
      mockRedisService.isEventProcessed.mockResolvedValue(false);
      mockBillingQueries.isWebhookEventProcessed.mockReturnValue(true);

      const event = createMockEvent();
      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('duplicate');
      expect(result.message).toContain('database');
      expect(mockRedisService.markEventProcessed).toHaveBeenCalledWith('evt_test');
    });

    it('should reject event if lock not acquired', async () => {
      mockRedisService.acquireEventLock.mockResolvedValue(false);

      const event = createMockEvent();
      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('duplicate');
      expect(result.message).toContain('another instance');
    });

    it('should skip unsupported event types', async () => {
      const event = createMockEvent('unsupported.event' as any, 'custom.event');
      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('skipped');
      expect(result.message?.toLowerCase()).toContain('unsupported');
    });

    it('should process new event successfully', async () => {
      const event = createMockEvent('subscription.created', 'subscription.created');
      event.data = {
        id: 'sub_123',
        customData: { community_id: 'community-123', tier: 'premium' },
        customerId: 'cus_123',
        currentBillingPeriod: {
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      mockBillingQueries.getSubscriptionByCommunityId.mockReturnValue(null);

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.recordWebhookEvent).toHaveBeenCalled();
      expect(mockRedisService.markEventProcessed).toHaveBeenCalledWith('evt_test');
      expect(mockRedisService.releaseEventLock).toHaveBeenCalledWith('evt_test');
    });

    it('should release lock even on error', async () => {
      const event = createMockEvent('subscription.created', 'subscription.created');
      event.data = {
        customData: { community_id: 'community-123' },
      };

      mockBillingQueries.getSubscriptionByCommunityId.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('failed');
      expect(mockRedisService.releaseEventLock).toHaveBeenCalledWith('evt_test');
    });
  });

  // ===========================================================================
  // Subscription Created
  // ===========================================================================

  describe('handleSubscriptionCreated', () => {
    const createSubscriptionEvent = (customData: Record<string, string> = {}): ProviderWebhookEvent => ({
      id: 'evt_test',
      type: 'subscription.created',
      rawType: 'subscription.created',
      data: {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active',
        customData: {
          community_id: 'community-123',
          tier: 'premium',
          ...customData,
        },
        currentBillingPeriod: {
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      timestamp: new Date(),
    });

    it('should create new subscription', async () => {
      const event = createSubscriptionEvent();
      mockBillingQueries.getSubscriptionByCommunityId.mockReturnValue(null);

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.createSubscription).toHaveBeenCalled();
      expect(mockBillingQueries.logBillingAuditEvent).toHaveBeenCalledWith(
        'subscription_created',
        expect.objectContaining({ communityId: 'community-123' }),
        'community-123'
      );
    });

    it('should update existing subscription', async () => {
      const event = createSubscriptionEvent();
      mockBillingQueries.getSubscriptionByCommunityId.mockReturnValue({
        id: 1,
        communityId: 'community-123',
        paymentSubscriptionId: 'old_sub',
        paymentCustomerId: 'cus_old',
        tier: 'basic',
        status: 'active',
      });

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).toHaveBeenCalledWith(
        'community-123',
        expect.objectContaining({
          paymentCustomerId: 'cus_123',
          paymentSubscriptionId: 'sub_123',
        })
      );
    });

    it('should skip if no community_id in metadata', async () => {
      const event: ProviderWebhookEvent = {
        id: 'evt_test',
        type: 'subscription.created',
        rawType: 'subscription.created',
        data: {
          id: 'sub_123',
          customData: {},
        },
        timestamp: new Date(),
      };

      const result = await webhookService.processEvent(event);

      // Event processes but handler logs warning and returns early
      expect(result.status).toBe('processed');
      expect(mockBillingQueries.createSubscription).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Payment Completed
  // ===========================================================================

  describe('handlePaymentCompleted', () => {
    const createPaymentEvent = (): ProviderWebhookEvent => ({
      id: 'evt_test',
      type: 'payment.completed',
      rawType: 'transaction.completed',
      data: {
        id: 'txn_123',
        subscriptionId: 'sub_123',
        customData: {
          community_id: 'community-123',
        },
        currentBillingPeriod: {
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      timestamp: new Date(),
    });

    it('should clear grace period and update status', async () => {
      const event = createPaymentEvent();
      mockBillingQueries.getSubscriptionByPaymentId.mockReturnValue({
        id: 1,
        communityId: 'community-123',
        paymentSubscriptionId: 'sub_123',
        tier: 'premium',
        status: 'past_due',
        graceUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).toHaveBeenCalledWith(
        'community-123',
        expect.objectContaining({
          status: 'active',
          graceUntil: null,
        })
      );
      expect(mockRedisService.invalidateEntitlements).toHaveBeenCalledWith('community-123');
    });

    it('should skip if no subscription found', async () => {
      const event = createPaymentEvent();
      mockBillingQueries.getSubscriptionByPaymentId.mockReturnValue(null);

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Payment Failed
  // ===========================================================================

  describe('handlePaymentFailed', () => {
    const createPaymentFailedEvent = (): ProviderWebhookEvent => ({
      id: 'evt_test',
      type: 'payment.failed',
      rawType: 'transaction.payment_failed',
      data: {
        id: 'txn_123',
        subscriptionId: 'sub_123',
      },
      timestamp: new Date(),
    });

    it('should set 24-hour grace period', async () => {
      const event = createPaymentFailedEvent();
      mockBillingQueries.getSubscriptionByPaymentId.mockReturnValue({
        id: 1,
        communityId: 'community-123',
        paymentSubscriptionId: 'sub_123',
        tier: 'premium',
        status: 'active',
      });

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).toHaveBeenCalled();
      // Check that graceUntil is set approximately 24 hours from now
      const updateCall = mockBillingQueries.updateSubscription.mock.calls[0][1];
      expect(updateCall.graceUntil).toBeDefined();
      expect(updateCall.status).toBe('past_due');
    });

    it('should skip if no subscription found', async () => {
      const event = createPaymentFailedEvent();
      mockBillingQueries.getSubscriptionByPaymentId.mockReturnValue(null);

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Subscription Updated
  // ===========================================================================

  describe('handleSubscriptionUpdated', () => {
    const createUpdateEvent = (customData: Record<string, string> = {}): ProviderWebhookEvent => ({
      id: 'evt_test',
      type: 'subscription.updated',
      rawType: 'subscription.updated',
      data: {
        id: 'sub_123',
        status: 'active',
        customData: {
          community_id: 'community-123',
          tier: 'exclusive',
          ...customData,
        },
      },
      timestamp: new Date(),
    });

    it('should update tier and status', async () => {
      const event = createUpdateEvent();

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).toHaveBeenCalledWith(
        'community-123',
        expect.objectContaining({
          tier: 'exclusive',
          status: 'active',
        })
      );
      expect(mockRedisService.invalidateEntitlements).toHaveBeenCalledWith('community-123');
    });

    it('should skip if no community_id in metadata', async () => {
      const event: ProviderWebhookEvent = {
        id: 'evt_test',
        type: 'subscription.updated',
        rawType: 'subscription.updated',
        data: {
          id: 'sub_123',
          status: 'active',
          customData: {},
        },
        timestamp: new Date(),
      };

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Subscription Canceled
  // ===========================================================================

  describe('handleSubscriptionCanceled', () => {
    const createCancelEvent = (): ProviderWebhookEvent => ({
      id: 'evt_test',
      type: 'subscription.canceled',
      rawType: 'subscription.canceled',
      data: {
        id: 'sub_123',
        customData: {
          community_id: 'community-123',
        },
      },
      timestamp: new Date(),
    });

    it('should downgrade to starter tier', async () => {
      const event = createCancelEvent();

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).toHaveBeenCalledWith(
        'community-123',
        expect.objectContaining({
          tier: 'starter',
          status: 'canceled',
          graceUntil: null,
        })
      );
      expect(mockRedisService.invalidateEntitlements).toHaveBeenCalledWith('community-123');
    });

    it('should skip if no community_id in metadata', async () => {
      const event: ProviderWebhookEvent = {
        id: 'evt_test',
        type: 'subscription.canceled',
        rawType: 'subscription.canceled',
        data: {
          id: 'sub_123',
          customData: {},
        },
        timestamp: new Date(),
      };

      const result = await webhookService.processEvent(event);

      expect(result.status).toBe('processed');
      expect(mockBillingQueries.updateSubscription).not.toHaveBeenCalled();
    });
  });
});

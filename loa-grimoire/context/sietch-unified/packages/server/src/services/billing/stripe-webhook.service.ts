/**
 * =============================================================================
 * SIETCH UNIFIED - STRIPE WEBHOOK HANDLER
 * =============================================================================
 * 
 * Handles incoming Stripe webhook events for subscription lifecycle management.
 * 
 * Key responsibilities:
 * - Verify webhook signatures (HMAC-SHA256)
 * - Process subscription events idempotently
 * - Update local database state
 * - Trigger notifications
 * - Invalidate entitlement cache
 * 
 * Events handled:
 * - checkout.session.completed
 * - invoice.paid
 * - invoice.payment_failed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * 
 * @module services/billing/stripe-webhook.service
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { GatekeeperService } from './gatekeeper.service';

// =============================================================================
// TYPES
// =============================================================================

interface WebhookResult {
  success: boolean;
  eventType: string;
  eventId: string;
  processed: boolean;
  error?: string;
}

interface NotificationPayload {
  communityId: string;
  type: 'payment_succeeded' | 'payment_failed' | 'subscription_cancelled' | 'grace_period_started' | 'grace_period_ending';
  data: Record<string, unknown>;
}

// =============================================================================
// STRIPE WEBHOOK HANDLER
// =============================================================================

export class StripeWebhookHandler {
  private stripe: Stripe;
  private prisma: PrismaClient;
  private gatekeeper: GatekeeperService;
  private webhookSecret: string;

  constructor(deps: {
    stripe: Stripe;
    prisma: PrismaClient;
    gatekeeper: GatekeeperService;
    webhookSecret: string;
  }) {
    this.stripe = deps.stripe;
    this.prisma = deps.prisma;
    this.gatekeeper = deps.gatekeeper;
    this.webhookSecret = deps.webhookSecret;
  }

  /**
   * Main entry point for webhook processing.
   * Verifies signature and routes to appropriate handler.
   */
  async handleWebhook(payload: string | Buffer, signature: string): Promise<WebhookResult> {
    // 1. Verify signature
    let event: Stripe.Event;
    
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature verification failed:', error);
      return {
        success: false,
        eventType: 'unknown',
        eventId: 'unknown',
        processed: false,
        error: `Signature verification failed: ${error}`,
      };
    }

    // 2. Check for idempotency (prevent duplicate processing)
    const alreadyProcessed = await this.checkIdempotency(event.id);
    if (alreadyProcessed) {
      console.log(`Event ${event.id} already processed, skipping`);
      return {
        success: true,
        eventType: event.type,
        eventId: event.id,
        processed: false,
      };
    }

    // 3. Route to appropriate handler
    try {
      await this.routeEvent(event);
      
      // 4. Mark as processed
      await this.markProcessed(event.id, event.type);

      return {
        success: true,
        eventType: event.type,
        eventId: event.id,
        processed: true,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error processing webhook ${event.type}:`, error);
      return {
        success: false,
        eventType: event.type,
        eventId: event.id,
        processed: false,
        error,
      };
    }
  }

  /**
   * Route event to specific handler based on type.
   */
  private async routeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle new subscription creation from checkout.
   */
  private async handleCheckoutComplete(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    
    if (session.mode !== 'subscription') {
      return; // Only handle subscription checkouts
    }

    const communityId = session.metadata?.communityId;
    const adminUserId = session.metadata?.adminUserId;

    if (!communityId) {
      throw new Error('Missing communityId in checkout metadata');
    }

    // Retrieve full subscription details
    const subscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string
    );

    const tier = this.getTierFromSubscription(subscription);

    // Create or update subscription record
    await this.prisma.communitySubscription.upsert({
      where: { communityId },
      create: {
        communityId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscription.id,
        tier,
        status: 'active',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        createdByUserId: adminUserId,
      },
      update: {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscription.id,
        tier,
        status: 'active',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        graceUntil: null,
      },
    });

    // Invalidate cache
    await this.gatekeeper.invalidateCache(communityId);

    // Send notification
    await this.sendNotification({
      communityId,
      type: 'payment_succeeded',
      data: {
        tier,
        subscriptionId: subscription.id,
      },
    });

    console.log(`✅ Subscription created for community ${communityId}: ${tier}`);
  }

  /**
   * Handle successful invoice payment.
   */
  private async handleInvoicePaid(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    if (!invoice.subscription) {
      return; // Only handle subscription invoices
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      invoice.subscription as string
    );

    const communityId = subscription.metadata?.communityId;
    if (!communityId) {
      console.warn('Invoice paid but no communityId in subscription metadata');
      return;
    }

    // Update subscription status
    await this.prisma.communitySubscription.update({
      where: { communityId },
      data: {
        status: 'active',
        graceUntil: null, // Clear any grace period
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // Record payment in history
    await this.prisma.paymentHistory.create({
      data: {
        communityId,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        paidAt: new Date(),
      },
    });

    // Invalidate cache
    await this.gatekeeper.invalidateCache(communityId);

    console.log(`✅ Invoice paid for community ${communityId}`);
  }

  /**
   * Handle failed invoice payment - start grace period.
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    if (!invoice.subscription) {
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      invoice.subscription as string
    );

    const communityId = subscription.metadata?.communityId;
    if (!communityId) {
      console.warn('Invoice failed but no communityId in subscription metadata');
      return;
    }

    // Start grace period
    const graceUntil = await this.gatekeeper.startGracePeriod(communityId);

    // Record failed payment
    await this.prisma.paymentHistory.create({
      data: {
        communityId,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        failureReason: invoice.last_finalization_error?.message,
      },
    });

    // Send notification
    await this.sendNotification({
      communityId,
      type: 'payment_failed',
      data: {
        graceUntil: graceUntil.toISOString(),
        updatePaymentUrl: await this.gatekeeper.getCustomerPortalUrl(
          communityId,
          process.env.APP_URL || 'https://your-domain.com'
        ),
      },
    });

    console.log(`⚠️ Payment failed for community ${communityId}, grace until ${graceUntil}`);
  }

  /**
   * Handle subscription updates (plan changes, etc).
   */
  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    
    const communityId = subscription.metadata?.communityId;
    if (!communityId) {
      console.warn('Subscription updated but no communityId in metadata');
      return;
    }

    const tier = this.getTierFromSubscription(subscription);
    const previousTier = event.data.previous_attributes?.items?.data?.[0]?.price?.id
      ? this.getTierFromPriceId(event.data.previous_attributes.items.data[0].price.id)
      : null;

    // Update local record
    await this.prisma.communitySubscription.update({
      where: { communityId },
      data: {
        tier,
        status: this.mapSubscriptionStatus(subscription.status),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // Invalidate cache
    await this.gatekeeper.invalidateCache(communityId);

    // Log tier change if applicable
    if (previousTier && previousTier !== tier) {
      await this.prisma.subscriptionEvent.create({
        data: {
          communityId,
          eventType: 'tier_changed',
          previousTier,
          newTier: tier,
        },
      });
    }

    console.log(`🔄 Subscription updated for community ${communityId}: ${tier}`);
  }

  /**
   * Handle subscription cancellation.
   */
  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    
    const communityId = subscription.metadata?.communityId;
    if (!communityId) {
      console.warn('Subscription deleted but no communityId in metadata');
      return;
    }

    // Get previous tier before downgrade
    const existingSubscription = await this.prisma.communitySubscription.findUnique({
      where: { communityId },
    });
    const previousTier = existingSubscription?.tier;

    // Downgrade to starter (settings preserved)
    await this.prisma.communitySubscription.update({
      where: { communityId },
      data: {
        tier: 'starter',
        status: 'cancelled',
        graceUntil: null,
        cancelledAt: new Date(),
        // Note: We preserve stripeCustomerId for reactivation
      },
    });

    // Record event
    await this.prisma.subscriptionEvent.create({
      data: {
        communityId,
        eventType: 'subscription_cancelled',
        previousTier,
        newTier: 'starter',
      },
    });

    // Invalidate cache
    await this.gatekeeper.invalidateCache(communityId);

    // Send notification
    await this.sendNotification({
      communityId,
      type: 'subscription_cancelled',
      data: {
        previousTier,
        settingsPreserved: true,
        reactivateUrl: 'https://cc.collab.land/pricing',
      },
    });

    console.log(`❌ Subscription cancelled for community ${communityId}`);
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Check if event has already been processed (idempotency).
   */
  private async checkIdempotency(eventId: string): Promise<boolean> {
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { stripeEventId: eventId },
    });
    return !!existing;
  }

  /**
   * Mark event as processed.
   */
  private async markProcessed(eventId: string, eventType: string): Promise<void> {
    await this.prisma.webhookEvent.create({
      data: {
        stripeEventId: eventId,
        eventType,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Extract tier from subscription.
   */
  private getTierFromSubscription(subscription: Stripe.Subscription): string {
    const priceId = subscription.items.data[0]?.price?.id;
    return priceId ? this.getTierFromPriceId(priceId) : 'starter';
  }

  /**
   * Map Stripe price ID to tier name.
   */
  private getTierFromPriceId(priceId: string): string {
    const priceToTier: Record<string, string> = {
      'price_basic_monthly': 'basic',
      'price_basic_yearly': 'basic',
      'price_premium_monthly': 'premium',
      'price_premium_yearly': 'premium',
      'price_exclusive_monthly': 'exclusive',
      'price_exclusive_yearly': 'exclusive',
      'price_elite_monthly': 'elite',
      'price_elite_yearly': 'elite',
    };
    return priceToTier[priceId] ?? 'starter';
  }

  /**
   * Map Stripe status to our status enum.
   */
  private mapSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): string {
    const statusMap: Record<string, string> = {
      'active': 'active',
      'past_due': 'past_due',
      'canceled': 'cancelled',
      'cancelled': 'cancelled',
      'trialing': 'trialing',
      'unpaid': 'past_due',
      'incomplete': 'pending',
      'incomplete_expired': 'cancelled',
    };
    return statusMap[stripeStatus] ?? 'unknown';
  }

  /**
   * Send notification (stub - implement with your notification service).
   */
  private async sendNotification(payload: NotificationPayload): Promise<void> {
    // TODO: Implement notification sending
    // Options:
    // - Discord DM to admin
    // - Telegram message
    // - Email via SendGrid/Resend
    console.log('📬 Notification:', payload);
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createStripeWebhookHandler(deps: {
  stripe: Stripe;
  prisma: PrismaClient;
  gatekeeper: GatekeeperService;
}): StripeWebhookHandler {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }

  return new StripeWebhookHandler({
    ...deps,
    webhookSecret,
  });
}

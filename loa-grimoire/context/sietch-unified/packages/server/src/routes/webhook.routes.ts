/**
 * =============================================================================
 * SIETCH UNIFIED - WEBHOOK ROUTES
 * =============================================================================
 * 
 * Handles incoming webhooks from external services.
 * 
 * Endpoints:
 * - POST /stripe - Stripe subscription webhooks
 * 
 * Note: Webhooks require raw body access and skip rate limiting.
 * 
 * @module routes/webhook
 */

import { Hono } from 'hono';
import Stripe from 'stripe';
import type { StripeWebhookHandler } from '../services/billing/stripe-webhook.service';

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface WebhookRouteDeps {
  webhookHandler: StripeWebhookHandler;
  stripe: Stripe;
}

export function createWebhookRoutes({ webhookHandler }: WebhookRouteDeps): Hono {
  const router = new Hono();

  /**
   * POST /stripe
   * Handle Stripe webhook events
   * 
   * Events handled:
   * - checkout.session.completed
   * - invoice.paid
   * - invoice.payment_failed
   * - customer.subscription.updated
   * - customer.subscription.deleted
   */
  router.post('/stripe', async (c) => {
    const signature = c.req.header('stripe-signature');

    if (!signature) {
      console.warn('Stripe webhook received without signature');
      return c.json({
        success: false,
        error: 'Missing stripe-signature header',
      }, 400);
    }

    try {
      // Get raw body for signature verification
      const rawBody = await c.req.text();
      
      // Process the webhook
      const result = await webhookHandler.handleWebhook(rawBody, signature);

      if (!result.success) {
        console.error('Webhook processing failed:', result.error);
        return c.json({
          success: false,
          error: result.error,
        }, 400);
      }

      // Return success to Stripe
      return c.json({
        success: true,
        received: true,
        eventId: result.eventId,
        eventType: result.eventType,
        processed: result.processed,
      });
    } catch (error) {
      console.error('Webhook handler error:', error);
      
      // Return 200 to prevent Stripe from retrying
      // Log the error for investigation
      return c.json({
        success: false,
        error: 'Internal webhook processing error',
        // Don't expose internal errors to external services
      }, 200);
    }
  });

  /**
   * GET /stripe/test
   * Test endpoint to verify webhook configuration (development only)
   */
  router.get('/stripe/test', async (c) => {
    if (process.env.NODE_ENV === 'production') {
      return c.json({
        success: false,
        error: 'Test endpoint not available in production',
      }, 404);
    }

    return c.json({
      success: true,
      message: 'Stripe webhook endpoint is configured',
      expectedEvents: [
        'checkout.session.completed',
        'invoice.paid',
        'invoice.payment_failed',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ],
    });
  });

  return router;
}

/**
 * Billing Routes Module
 *
 * POST /api/billing/topup — x402 USDC top-up (fully implemented)
 * GET /api/billing/balance — stub (Sprint 5)
 * GET /api/billing/history — stub (Sprint 5)
 * GET /api/billing/pricing — stub (Sprint 5)
 * POST /api/internal/billing/finalize — stub (Sprint 5)
 *
 * SDD refs: §5.3 Top-Up Endpoint, §5.2 Balance/History
 * Sprint refs: Task 2.5
 *
 * @module api/routes/billing-routes
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { memberRateLimiter } from '../middleware.js';
import { createOptionalX402Middleware, type X402Request } from '../middleware/x402-middleware.js';
import { serializeBigInt } from '../../packages/core/utils/micro-usd.js';
import { logger } from '../../utils/logger.js';
import type { IPaymentService } from '../../packages/core/ports/IPaymentService.js';

// =============================================================================
// Router Setup
// =============================================================================

export const creditBillingRouter = Router();

// =============================================================================
// Provider Initialization
// =============================================================================

let paymentService: IPaymentService | null = null;

/**
 * Set the payment service instance.
 * Called during server initialization.
 */
export function setCreditBillingPaymentService(service: IPaymentService): void {
  paymentService = service;
}

function getPaymentService(): IPaymentService {
  if (!paymentService) {
    throw new Error('Payment service not initialized');
  }
  return paymentService;
}

// =============================================================================
// Billing feature check
// =============================================================================

function requireBillingFeature(_req: Request, res: Response, next: Function): void {
  const enabled = process.env.FEATURE_BILLING_ENABLED === 'true';
  if (!enabled) {
    res.status(503).json({
      error: 'Billing Not Enabled',
      message: 'The credit billing system is not yet enabled.',
    });
    return;
  }
  next();
}

// =============================================================================
// Rate Limiter: 10 per minute per account for top-up
// =============================================================================

import rateLimit from 'express-rate-limit';

const topupRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use account ID from auth, fallback to IP
    return (req as any).accountId ?? req.ip ?? 'unknown';
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Top-up rate limit: maximum 10 requests per minute.',
    });
  },
});

// =============================================================================
// Schemas
// =============================================================================

const topupSchema = z.object({
  amountUsd: z.number().positive().max(10000, 'Maximum top-up is $10,000'),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  chainId: z.number().int().positive().default(8453),
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid sender address'),
  amount: z.string().min(1, 'Token amount required'),
});

// =============================================================================
// POST /api/billing/topup — x402 USDC Top-Up
// =============================================================================

creditBillingRouter.post(
  '/topup',
  requireBillingFeature,
  memberRateLimiter,
  requireAuth,
  topupRateLimiter,
  async (req: Request, res: Response) => {
    const result = topupSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    const { amountUsd, txHash, chainId, from, amount } = result.data;

    // Check Idempotency-Key header
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey && typeof idempotencyKey !== 'string') {
      res.status(400).json({
        error: 'Invalid Idempotency-Key header',
      });
      return;
    }

    try {
      const service = getPaymentService();

      // Get account ID from auth context
      const accountId = (req as any).accountId;
      if (!accountId) {
        res.status(401).json({ error: 'Account not identified' });
        return;
      }

      const topupResult = await service.createTopUp(accountId, amountUsd, {
        txHash,
        chainId,
        from,
        amount,
      });

      logger.info({
        event: 'billing.topup.success',
        paymentId: topupResult.paymentId,
        accountId: topupResult.accountId,
        amountUsdMicro: topupResult.amountUsdMicro.toString(),
      }, 'Top-up successful');

      res.status(201).json(serializeBigInt({
        paymentId: topupResult.paymentId,
        accountId: topupResult.accountId,
        lotId: topupResult.lotId,
        amountUsdMicro: topupResult.amountUsdMicro,
        provider: topupResult.provider,
      }));
    } catch (err) {
      logger.error({
        event: 'billing.topup.error',
        txHash,
        err,
      }, 'Top-up failed');

      if (err instanceof Error && err.message.includes('verification failed')) {
        res.status(402).json({
          error: 'Payment Verification Failed',
          message: err.message,
        });
        return;
      }
      if (err instanceof Error && err.message.includes('already used')) {
        res.status(409).json({
          error: 'Duplicate Payment',
          message: 'This transaction has already been used for a top-up.',
        });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// =============================================================================
// Stub Routes (Sprint 5)
// =============================================================================

creditBillingRouter.get('/balance', requireBillingFeature, requireAuth, (_req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'GET /api/billing/balance will be implemented in Sprint 5.',
  });
});

creditBillingRouter.get('/history', requireBillingFeature, requireAuth, (_req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'GET /api/billing/history will be implemented in Sprint 5.',
  });
});

creditBillingRouter.get('/pricing', requireBillingFeature, (_req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'GET /api/billing/pricing will be implemented in Sprint 5.',
  });
});

creditBillingRouter.post('/internal/finalize', requireBillingFeature, (_req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'POST /api/billing/internal/finalize will be implemented in Sprint 5.',
  });
});

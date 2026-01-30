/**
 * Internal Routes Module
 * Sprint 175: Internal API endpoints called by Trigger.dev
 *
 * These endpoints run on ECS which has VPC access to RDS.
 * Trigger.dev workers call these endpoints via HTTP instead of
 * directly connecting to RDS (which is blocked by VPC isolation).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';
import { runEligibilitySyncOnServer } from '../../services/eligibility-sync.js';

/**
 * Internal routes router
 */
export const internalRouter = Router();

/**
 * Internal API key middleware
 * Uses a dedicated INTERNAL_API_KEY env var for Trigger.dev -> ECS communication
 */
function requireInternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!internalKey) {
    logger.warn('INTERNAL_API_KEY not configured - internal endpoints disabled');
    res.status(503).json({
      error: 'Internal API not configured',
      message: 'INTERNAL_API_KEY environment variable not set',
    });
    return;
  }

  const providedKey = req.headers['x-internal-api-key'];

  if (!providedKey || providedKey !== internalKey) {
    logger.warn({ hasKey: !!providedKey }, 'Invalid internal API key');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing X-Internal-API-Key header',
    });
    return;
  }

  next();
}

// Apply internal API key requirement to all routes
internalRouter.use(requireInternalApiKey);

/**
 * POST /internal/sync-eligibility
 * Trigger eligibility sync job from Trigger.dev
 *
 * This endpoint runs the same logic as the sync task, but on ECS
 * which has VPC access to RDS. Trigger.dev calls this endpoint
 * via HTTP instead of trying to connect to RDS directly.
 */
internalRouter.post('/sync-eligibility', async (req: Request, res: Response) => {
  const startTime = Date.now();
  logger.info('Internal eligibility sync triggered');

  try {
    // Run the sync logic
    const result = await runEligibilitySyncOnServer();

    const duration = Date.now() - startTime;
    logger.info({ duration, snapshotId: result.snapshotId }, 'Internal eligibility sync completed');

    res.json({
      ...result,
      duration_ms: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({ error: errorMessage, duration }, 'Internal eligibility sync failed');

    res.status(500).json({
      success: false,
      error: errorMessage,
      duration_ms: duration,
    });
  }
});

/**
 * GET /internal/health
 * Health check for internal API (Trigger.dev can use to verify connectivity)
 */
internalRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'sietch-internal',
    timestamp: new Date().toISOString(),
    database_url_configured: !!config.database.url,
  });
});

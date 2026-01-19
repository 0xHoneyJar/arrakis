/**
 * Simulation Routes Module
 *
 * Sprint 110: REST API for QA Sandbox Testing System
 *
 * Provides REST endpoints for simulation operations within sandbox environments.
 * All routes are scoped to a specific sandbox and user.
 *
 * @module api/routes/simulation
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import {
  SimulationService,
  createSimulationService,
  SimulationErrorCode,
  type TierId,
} from '../../services/sandbox/index.js';
import { isValidTierId } from '../../services/sandbox/simulation-context.js';
import type { MinimalRedis } from '../../../../../packages/sandbox/src/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Extended request with simulation context
 */
interface SimulationRequest extends Request {
  simulationService?: SimulationService;
  sandboxId?: string;
}

/**
 * Dependencies for simulation router factory
 */
export interface SimulationRouterDeps {
  redis: MinimalRedis;
  getSandboxIdForGuild?: (guildId: string) => Promise<string | null>;
}

// =============================================================================
// Validation Schemas
// =============================================================================

const assumeRoleSchema = z.object({
  tierId: z.string().refine((val) => isValidTierId(val as TierId), {
    message: 'Invalid tier ID',
  }),
  rank: z.number().int().min(1).max(10000).optional(),
  badges: z.array(z.string()).optional(),
  note: z.string().max(200).optional(),
});

const updateStateSchema = z.object({
  bgtBalance: z.number().min(0).optional(),
  engagementStage: z.enum(['free', 'engaged', 'verified']).optional(),
  engagementPoints: z.number().min(0).optional(),
  activityScore: z.number().min(0).optional(),
  convictionScore: z.number().min(0).optional(),
  tenureDays: z.number().min(0).optional(),
  isVerified: z.boolean().optional(),
});

const checkSchema = z.object({
  type: z.enum(['channel', 'feature', 'tier', 'badges']),
  target: z.string().optional(),
});

const thresholdOverridesSchema = z.object({
  naib: z.number().positive().optional(),
  fedaykin: z.number().positive().optional(),
  usul: z.number().positive().optional(),
  sayyadina: z.number().positive().optional(),
  mushtamal: z.number().positive().optional(),
  sihaya: z.number().positive().optional(),
  qanat: z.number().positive().optional(),
  ichwan: z.number().positive().optional(),
  hajra: z.number().positive().optional(),
});

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Map simulation error codes to HTTP status codes
 */
function getHttpStatus(code: SimulationErrorCode): number {
  switch (code) {
    case SimulationErrorCode.NOT_FOUND:
      return 404;
    case SimulationErrorCode.VALIDATION_ERROR:
      return 400;
    case SimulationErrorCode.VERSION_CONFLICT:
      return 409;
    case SimulationErrorCode.SANDBOX_INACTIVE:
      return 403;
    case SimulationErrorCode.STORAGE_ERROR:
    default:
      return 500;
  }
}

/**
 * Async handler wrapper
 */
function asyncHandler(
  fn: (req: SimulationRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as SimulationRequest, res, next)).catch(next);
  };
}

// =============================================================================
// Router Factory
// =============================================================================

/**
 * Create simulation router with injected dependencies
 *
 * @param deps - Required dependencies (redis)
 * @returns Express router for simulation endpoints
 */
export function createSimulationRouter(deps: SimulationRouterDeps): Router {
  const router = Router({ mergeParams: true });
  const service = createSimulationService(deps.redis, logger);

  // ===========================================================================
  // Middleware
  // ===========================================================================

  /**
   * Extract and validate sandbox/user from params
   */
  router.use((req: SimulationRequest, _res: Response, next: NextFunction) => {
    req.simulationService = service;
    req.sandboxId = req.params.sandboxId;
    next();
  });

  // ===========================================================================
  // Role Assumption Endpoints (T110.2)
  // ===========================================================================

  /**
   * POST /sandbox/:sandboxId/simulation/:userId/assume
   * Assume a role within the simulation
   */
  router.post(
    '/:userId/assume',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const parseResult = assumeRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const { tierId, rank, badges, note } = parseResult.data;

      const result = await simulationService!.assumeRole(
        sandboxId!,
        userId,
        tierId as TierId,
        { rank, badges, note }
      );

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      logger.info({ sandboxId, userId, tierId }, 'Role assumed via REST API');

      res.status(200).json({
        success: true,
        data: {
          assumedRole: result.data!.assumedRole,
          version: result.data!.version,
        },
      });
    })
  );

  /**
   * DELETE /sandbox/:sandboxId/simulation/:userId/assume
   * Clear assumed role
   */
  router.delete(
    '/:userId/assume',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const result = await simulationService!.clearRole(sandboxId!, userId);

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      logger.info({ sandboxId, userId }, 'Role cleared via REST API');

      res.status(200).json({
        success: true,
        message: 'Role cleared',
        version: result.data!.version,
      });
    })
  );

  // ===========================================================================
  // State Endpoints (T110.3)
  // ===========================================================================

  /**
   * GET /sandbox/:sandboxId/simulation/:userId/whoami
   * Get full simulation status
   */
  router.get(
    '/:userId/whoami',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const result = await simulationService!.whoami(sandboxId!, userId);

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    })
  );

  /**
   * GET /sandbox/:sandboxId/simulation/:userId/state
   * Get current member state
   */
  router.get(
    '/:userId/state',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const result = await simulationService!.getState(sandboxId!, userId);

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    })
  );

  /**
   * PATCH /sandbox/:sandboxId/simulation/:userId/state
   * Update member state
   */
  router.patch(
    '/:userId/state',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const parseResult = updateStateSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const result = await simulationService!.setState(
        sandboxId!,
        userId,
        parseResult.data
      );

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      logger.debug(
        { sandboxId, userId, updatedFields: result.data!.updatedFields },
        'State updated via REST API'
      );

      res.status(200).json({
        success: true,
        data: result.data,
      });
    })
  );

  /**
   * DELETE /sandbox/:sandboxId/simulation/:userId
   * Reset/delete simulation context
   */
  router.delete(
    '/:userId',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const result = await simulationService!.deleteContext(sandboxId!, userId);

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      logger.info({ sandboxId, userId }, 'Context deleted via REST API');

      res.status(200).json({
        success: true,
        message: 'Simulation context deleted',
      });
    })
  );

  // ===========================================================================
  // Check Endpoints (T110.4)
  // ===========================================================================

  /**
   * POST /sandbox/:sandboxId/simulation/:userId/check
   * Check permissions, tier, or badges
   */
  router.post(
    '/:userId/check',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const parseResult = checkSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const { type, target } = parseResult.data;

      let result;
      switch (type) {
        case 'channel':
          if (!target) {
            res.status(400).json({
              error: 'Validation error',
              message: 'target is required for channel check',
            });
            return;
          }
          result = await simulationService!.checkChannelAccess(
            sandboxId!,
            userId,
            target
          );
          break;

        case 'feature':
          if (!target) {
            res.status(400).json({
              error: 'Validation error',
              message: 'target is required for feature check',
            });
            return;
          }
          result = await simulationService!.checkFeatureAccess(
            sandboxId!,
            userId,
            target
          );
          break;

        case 'tier':
          result = await simulationService!.checkTier(sandboxId!, userId);
          break;

        case 'badges':
          result = await simulationService!.checkBadges(sandboxId!, userId);
          break;

        default:
          res.status(400).json({
            error: 'Validation error',
            message: `Unknown check type: ${type}`,
          });
          return;
      }

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      res.status(200).json({
        success: true,
        type,
        data: result.data,
      });
    })
  );

  // ===========================================================================
  // Threshold Endpoints (T110.6)
  // ===========================================================================

  /**
   * GET /sandbox/:sandboxId/simulation/:userId/thresholds
   * Get current threshold overrides
   */
  router.get(
    '/:userId/thresholds',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const result = await simulationService!.getThresholdOverrides(
        sandboxId!,
        userId
      );

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        usingDefaults: result.data === null,
      });
    })
  );

  /**
   * PATCH /sandbox/:sandboxId/simulation/:userId/thresholds
   * Set threshold overrides
   */
  router.patch(
    '/:userId/thresholds',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const parseResult = thresholdOverridesSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.issues,
        });
        return;
      }

      const result = await simulationService!.setThresholdOverrides(
        sandboxId!,
        userId,
        parseResult.data
      );

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      logger.info(
        { sandboxId, userId, overrides: parseResult.data },
        'Thresholds set via REST API'
      );

      res.status(200).json({
        success: true,
        data: result.data!.thresholdOverrides,
        version: result.data!.version,
      });
    })
  );

  /**
   * DELETE /sandbox/:sandboxId/simulation/:userId/thresholds
   * Clear threshold overrides (revert to defaults)
   */
  router.delete(
    '/:userId/thresholds',
    asyncHandler(async (req: SimulationRequest, res: Response) => {
      const { sandboxId, simulationService } = req;
      const { userId } = req.params;

      const result = await simulationService!.clearThresholdOverrides(
        sandboxId!,
        userId
      );

      if (!result.success) {
        res.status(getHttpStatus(result.error!.code)).json({
          error: result.error!.message,
          code: result.error!.code,
          details: result.error!.details,
        });
        return;
      }

      logger.info({ sandboxId, userId }, 'Thresholds cleared via REST API');

      res.status(200).json({
        success: true,
        message: 'Thresholds cleared, using defaults',
        version: result.data!.version,
      });
    })
  );

  // ===========================================================================
  // Error Handler
  // ===========================================================================

  router.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error({ error: err.message, stack: err.stack }, 'Simulation API error');

      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    }
  );

  return router;
}

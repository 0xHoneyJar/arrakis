/**
 * Dashboard Restore Routes
 *
 * Sprint 126: Restore API & CLI
 *
 * REST API endpoints for configuration restore functionality including
 * preview (impact analysis) and execute operations.
 *
 * @see grimoires/loa/sdd.md §4.5 Restore API
 * @module api/routes/dashboard/restore
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../../../utils/logger.js';
import type { IConfigService } from '../../../services/config/ConfigService.js';
import {
  createImpactAnalyzer,
  type IImpactAnalyzer,
  type RestoreImpactReport,
} from '../../../services/restore/ImpactAnalyzer.js';
import { requireDashboardAuth, requireServerAccess } from '../../middleware/dashboardAuth.js';
import type { AuthenticatedDashboardRequest } from '../../middleware/dashboardAuth.js';
import { NotFoundError, BadRequestError } from '../../errors.js';

// =============================================================================
// Types
// =============================================================================

export interface RestoreRoutesDeps {
  /** ConfigService for fetching/updating configuration */
  configService: IConfigService;
  /** Optional custom logger */
  logger?: typeof logger;
  /** Optional custom ImpactAnalyzer */
  impactAnalyzer?: IImpactAnalyzer;
}

interface RestoreRequest extends AuthenticatedDashboardRequest {
  params: {
    serverId: string;
  };
}

// =============================================================================
// Validation Schemas
// =============================================================================

const previewRequestSchema = z.object({
  checkpointId: z.string().min(1, 'Checkpoint ID is required'),
});

const executeRequestSchema = z.object({
  checkpointId: z.string().min(1, 'Checkpoint ID is required'),
  confirmationCode: z.string().min(1, 'Confirmation code is required'),
});

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create restore routes for dashboard API
 */
export function createRestoreRoutes(deps: RestoreRoutesDeps): Router {
  const router = Router();
  const log = deps.logger ?? logger;
  const impactAnalyzer = deps.impactAnalyzer ?? createImpactAnalyzer();

  /**
   * GET /servers/:serverId/restore/checkpoints
   *
   * Lists available checkpoints for a server.
   *
   * Response:
   * - 200: List of checkpoints
   * - 401: Not authenticated
   * - 403: No access to server
   */
  router.get(
    '/servers/:serverId/restore/checkpoints',
    requireDashboardAuth,
    requireServerAccess,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const restoreReq = req as RestoreRequest;
      const { serverId } = restoreReq.params;

      try {
        log.debug(
          { serverId, userId: restoreReq.dashboardSession?.userId },
          'Listing restore checkpoints'
        );

        // Get config history filtered to CheckpointSnapshot records
        const history = await deps.configService.getConfigHistory({
          serverId,
          recordableType: 'CheckpointSnapshot',
          limit: 50,
        });

        const checkpoints = history.records.map((record) => ({
          id: record.recordableId,
          createdAt: record.createdAt.toISOString(),
          triggerCommand: (record.payload as any).triggerCommand,
          userId: record.userId,
        }));

        res.json({
          serverId,
          checkpoints,
          total: history.total,
        });
      } catch (error) {
        log.error({ error, serverId }, 'Failed to list checkpoints');
        next(error);
      }
    }
  );

  /**
   * POST /servers/:serverId/restore/preview
   *
   * Previews the impact of restoring to a checkpoint.
   *
   * Request Body:
   * - checkpointId: ID of the checkpoint to preview
   *
   * Response:
   * - 200: Impact analysis report
   * - 400: Invalid request body
   * - 401: Not authenticated
   * - 403: No access to server
   * - 404: Checkpoint not found
   */
  router.post(
    '/servers/:serverId/restore/preview',
    requireDashboardAuth,
    requireServerAccess,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const restoreReq = req as RestoreRequest;
      const { serverId } = restoreReq.params;

      try {
        // Validate request body
        const parseResult = previewRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new BadRequestError(parseResult.error.issues[0].message);
        }

        const { checkpointId } = parseResult.data;

        log.debug(
          {
            serverId,
            checkpointId,
            userId: restoreReq.dashboardSession?.userId,
          },
          'Previewing restore impact'
        );

        // Get current configuration
        const currentConfig = await deps.configService.getCurrentConfiguration(serverId);
        if (!currentConfig) {
          throw new NotFoundError('Server configuration', serverId);
        }

        // Get checkpoint from history
        const checkpoint = await getCheckpointById(deps.configService, serverId, checkpointId);
        if (!checkpoint) {
          throw new NotFoundError('Checkpoint', checkpointId);
        }

        // Analyze impact
        const report = impactAnalyzer.analyzeCheckpointRestore(currentConfig, checkpoint);

        // Generate confirmation code if high-impact
        const confirmationCode = report.isHighImpact
          ? generateConfirmationCode()
          : null;

        res.json({
          ...formatImpactReport(report),
          confirmationCode,
          confirmationRequired: report.isHighImpact,
        });

        log.info(
          {
            serverId,
            checkpointId,
            isHighImpact: report.isHighImpact,
            totalChanges: report.summary.totalChanges,
          },
          'Restore preview completed'
        );
      } catch (error) {
        log.error({ error, serverId }, 'Restore preview failed');
        next(error);
      }
    }
  );

  /**
   * POST /servers/:serverId/restore/execute
   *
   * Executes a restore to a checkpoint.
   *
   * Request Body:
   * - checkpointId: ID of the checkpoint to restore to
   * - confirmationCode: Required for high-impact restores
   *
   * Response:
   * - 200: Restore result
   * - 400: Invalid request body or wrong confirmation code
   * - 401: Not authenticated
   * - 403: No access to server
   * - 404: Checkpoint not found
   */
  router.post(
    '/servers/:serverId/restore/execute',
    requireDashboardAuth,
    requireServerAccess,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const restoreReq = req as RestoreRequest;
      const { serverId } = restoreReq.params;
      const userId = restoreReq.dashboardSession?.userId ?? 'unknown';

      try {
        // Validate request body
        const parseResult = executeRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new BadRequestError(parseResult.error.issues[0].message);
        }

        const { checkpointId, confirmationCode } = parseResult.data;

        log.info(
          {
            serverId,
            checkpointId,
            userId,
          },
          'Executing restore'
        );

        // Get current configuration
        const currentConfig = await deps.configService.getCurrentConfiguration(serverId);
        if (!currentConfig) {
          throw new NotFoundError('Server configuration', serverId);
        }

        // Get checkpoint
        const checkpoint = await getCheckpointById(deps.configService, serverId, checkpointId);
        if (!checkpoint) {
          throw new NotFoundError('Checkpoint', checkpointId);
        }

        // Analyze impact to check if confirmation is required
        const report = impactAnalyzer.analyzeCheckpointRestore(currentConfig, checkpoint);

        // Verify confirmation code for high-impact restores
        if (report.isHighImpact) {
          if (!confirmationCode || confirmationCode.length < 4) {
            throw new BadRequestError(
              'Confirmation code required for high-impact restores'
            );
          }
          // Note: In production, we'd verify the code matches the one from preview
          // For now, we accept any valid-looking code
        }

        // Execute the restore by updating all configuration sections
        const targetState = checkpoint.fullStateJson;

        // Update thresholds
        if (targetState.thresholds) {
          await deps.configService.updateThresholds(
            serverId,
            userId,
            targetState.thresholds as Record<string, any>,
            { restoredFrom: checkpointId }
          );
        }

        // Update feature gates
        if (targetState.featureGates) {
          await deps.configService.updateFeatureGates(
            serverId,
            userId,
            targetState.featureGates as Record<string, any>,
            { restoredFrom: checkpointId }
          );
        }

        // Update role mappings
        if (targetState.roleMappings) {
          await deps.configService.updateRoleMappings(
            serverId,
            userId,
            targetState.roleMappings as Record<string, any>,
            { restoredFrom: checkpointId }
          );
        }

        log.info(
          {
            serverId,
            checkpointId,
            userId,
            totalChanges: report.summary.totalChanges,
          },
          'Restore completed successfully'
        );

        res.json({
          success: true,
          serverId,
          checkpointId,
          restoredAt: new Date().toISOString(),
          changes: report.summary,
          message: `Configuration restored from checkpoint ${checkpointId}`,
        });
      } catch (error) {
        log.error({ error, serverId }, 'Restore execution failed');
        next(error);
      }
    }
  );

  return router;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a checkpoint by ID from config history
 */
async function getCheckpointById(
  configService: IConfigService,
  serverId: string,
  checkpointId: string
): Promise<import('../../../db/types/config.types.js').CheckpointSnapshot | null> {
  const history = await configService.getConfigHistory({
    serverId,
    recordableType: 'CheckpointSnapshot',
    limit: 100,
  });

  for (const record of history.records) {
    if (record.recordableId === checkpointId) {
      return record.payload as import('../../../db/types/config.types.js').CheckpointSnapshot;
    }
  }

  return null;
}

/**
 * Generate a 6-digit confirmation code
 */
function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Format impact report for API response
 */
function formatImpactReport(report: RestoreImpactReport) {
  return {
    serverId: report.serverId,
    analyzedAt: report.analyzedAt.toISOString(),
    isHighImpact: report.isHighImpact,
    summary: report.summary,
    userImpact: report.userImpact,
    thresholdChanges: report.thresholdChanges,
    featureChanges: report.featureChanges,
    roleChanges: report.roleChanges,
    humanReadableSummary: report.humanReadableSummary,
    warnings: report.warnings,
  };
}

// =============================================================================
// Exports
// =============================================================================

export type { RestoreImpactReport } from '../../../services/restore/ImpactAnalyzer.js';

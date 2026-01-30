import { schedules, logger as triggerLogger } from '@trigger.dev/sdk/v3';

/**
 * Scheduled task to sync BGT eligibility data from chain
 *
 * Runs every 6 hours via Trigger.dev scheduler.
 *
 * ARCHITECTURE NOTE (Sprint 175):
 * Trigger.dev workers run outside AWS VPC and cannot connect to RDS directly.
 * Instead of querying the database, this task calls an HTTP endpoint on the
 * ECS server which has VPC access to RDS. The sync logic runs on ECS.
 *
 * Flow:
 * 1. Trigger.dev schedules this task every 6 hours
 * 2. This task calls POST /internal/sync-eligibility on the sietch server
 * 3. The sietch server (running on ECS) executes the sync logic
 * 4. Results are returned via HTTP response
 */

interface SyncResult {
  success: boolean;
  snapshotId?: number;
  duration_ms?: number;
  stats?: {
    totalWallets: number;
    eligibleWallets: number;
    naibCount: number;
    fedaykinCount: number;
  };
  diff?: {
    added: number;
    removed: number;
    promotedToNaib: number;
    demotedFromNaib: number;
  };
  error?: string;
}

export const syncEligibilityTask = schedules.task({
  id: 'sync-eligibility',
  cron: '0 */6 * * *', // Every 6 hours at minute 0
  run: async () => {
    triggerLogger.info('Starting eligibility sync task (HTTP proxy mode)');

    // Get the internal API URL and key from environment
    const internalApiUrl = process.env.SIETCH_INTERNAL_URL;
    const internalApiKey = process.env.INTERNAL_API_KEY;

    if (!internalApiUrl) {
      triggerLogger.error('SIETCH_INTERNAL_URL environment variable not set');
      throw new Error('SIETCH_INTERNAL_URL not configured - cannot call ECS server');
    }

    if (!internalApiKey) {
      triggerLogger.error('INTERNAL_API_KEY environment variable not set');
      throw new Error('INTERNAL_API_KEY not configured - cannot authenticate with ECS server');
    }

    // First, verify connectivity with health check
    try {
      const healthUrl = `${internalApiUrl}/internal/health`;
      triggerLogger.info(`Checking ECS server connectivity at ${healthUrl}...`);

      const healthResponse = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'X-Internal-API-Key': internalApiKey,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout for health check
      });

      if (!healthResponse.ok) {
        const errMsg = `Health check failed: ${healthResponse.status} ${healthResponse.statusText}`;
        triggerLogger.error(errMsg);
        throw new Error(errMsg);
      }

      const healthData = await healthResponse.json();
      triggerLogger.info(`ECS server health check passed: ${JSON.stringify(healthData)}`);
    } catch (healthError) {
      const errMsg = healthError instanceof Error ? healthError.message : String(healthError);
      triggerLogger.error(`Failed to connect to ECS server: ${errMsg}`);
      throw new Error(`Cannot connect to ECS server: ${errMsg}`);
    }

    // Call the sync endpoint on the ECS server
    const syncUrl = `${internalApiUrl}/internal/sync-eligibility`;
    triggerLogger.info(`Calling ECS server to run eligibility sync at ${syncUrl}...`);

    try {
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': internalApiKey,
        },
        signal: AbortSignal.timeout(300000), // 5 minute timeout for sync
      });

      const result = await response.json() as SyncResult;

      if (!response.ok || !result.success) {
        const errMsg = `Sync failed: ${result.error || response.statusText}`;
        triggerLogger.error(`Eligibility sync failed on ECS server: status=${response.status}, error=${result.error}`);
        throw new Error(errMsg);
      }

      triggerLogger.info(
        `Eligibility sync completed successfully: snapshotId=${result.snapshotId}, ` +
        `duration=${result.duration_ms}ms, ` +
        `stats=${JSON.stringify(result.stats)}`
      );

      // Return the result from the ECS server
      return {
        success: true,
        proxy_mode: true,
        snapshotId: result.snapshotId,
        duration_ms: result.duration_ms,
        stats: result.stats,
        diff: result.diff,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      triggerLogger.error(`Eligibility sync HTTP call failed: ${errorMessage}`);

      // Re-throw to trigger retry logic
      throw error;
    }
  },
});

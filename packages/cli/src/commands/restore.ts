/**
 * CLI Restore Commands
 *
 * Sprint 126: Restore API & CLI
 * Sprint 150: CLI Restore Wiring (Sietch Vault CS2)
 *
 * CLI commands for listing, previewing, and executing configuration restores.
 * Uses CheckpointService to integrate with the Sietch dashboard API.
 *
 * Usage:
 *   gaib restore ls [options]              List checkpoints
 *   gaib restore preview <id> [options]    Impact analysis
 *   gaib restore exec <id> [options]       Execute restore
 *
 * @see SDD §15.3.4 Restore CLI Commands
 * @module packages/cli/commands/restore
 */

import chalk from 'chalk';
import readline from 'readline';
import {
  CheckpointService,
  CheckpointError,
  type ImpactAnalysis,
} from '../services/checkpoint.js';

// =============================================================================
// Types
// =============================================================================

export interface RestoreListOptions {
  serverId: string;
  json?: boolean;
  quiet?: boolean;
  limit?: number;
}

export interface RestorePreviewOptions {
  serverId: string;
  checkpointId: string;
  json?: boolean;
  quiet?: boolean;
}

export interface RestoreExecuteOptions {
  serverId: string;
  checkpointId: string;
  preview?: boolean;
  json?: boolean;
  quiet?: boolean;
  autoApprove?: boolean;
}

// =============================================================================
// CLI Commands
// =============================================================================

/**
 * List available checkpoints
 *
 * Sprint 150.2: Implement restore ls using API
 */
export async function restoreListCommand(options: RestoreListOptions): Promise<void> {
  const { serverId, json, quiet } = options;

  if (!serverId) {
    if (json) {
      console.log(JSON.stringify({ error: 'Server ID is required' }));
    } else {
      console.error(chalk.red('Error: Server ID is required (use --server-id)'));
    }
    process.exitCode = 1;
    return;
  }

  try {
    const checkpointService = new CheckpointService();
    const checkpoints = await checkpointService.list(serverId);

    if (json) {
      console.log(JSON.stringify({
        serverId,
        checkpoints: checkpoints.map(cp => ({
          id: cp.id,
          createdAt: cp.createdAt.toISOString(),
          expiresAt: cp.expiresAt.toISOString(),
          triggerCommand: cp.triggerCommand,
          schemaVersion: cp.schemaVersion,
        })),
        total: checkpoints.length,
      }, null, 2));
      return;
    }

    if (checkpoints.length === 0) {
      if (!quiet) {
        console.log(chalk.yellow('No checkpoints available for this server.'));
      }
      return;
    }

    if (!quiet) {
      console.log(chalk.bold(`\nAvailable Checkpoints for ${serverId}\n`));
    }

    console.log(chalk.dim('ID'.padEnd(30) + 'Created'.padEnd(25) + 'Trigger'.padEnd(12) + 'Expires'));
    console.log(chalk.dim('-'.repeat(85)));

    for (const cp of checkpoints) {
      const createdAt = cp.createdAt.toLocaleString();
      const expiresAt = cp.expiresAt.toLocaleString();
      console.log(
        cp.id.padEnd(30) +
          createdAt.padEnd(25) +
          cp.triggerCommand.padEnd(12) +
          expiresAt
      );
    }

    if (!quiet) {
      console.log(chalk.dim(`\nShowing ${checkpoints.length} checkpoint(s)`));
      console.log(chalk.dim('\nTo restore: gaib restore exec <checkpoint-id> --server-id <server-id>'));
    }
  } catch (error) {
    handleError(error, json ?? false);
  }
}

/**
 * Preview restore impact
 *
 * Sprint 150.3: Implement restore preview using API
 */
export async function restorePreviewCommand(options: RestorePreviewOptions): Promise<void> {
  const { serverId, checkpointId, json, quiet } = options;

  if (!serverId) {
    if (json) {
      console.log(JSON.stringify({ error: 'Server ID is required' }));
    } else {
      console.error(chalk.red('Error: Server ID is required (use --server-id)'));
    }
    process.exitCode = 1;
    return;
  }

  if (!checkpointId) {
    if (json) {
      console.log(JSON.stringify({ error: 'Checkpoint ID is required' }));
    } else {
      console.error(chalk.red('Error: Checkpoint ID is required'));
    }
    process.exitCode = 1;
    return;
  }

  try {
    const checkpointService = new CheckpointService();
    const preview = await checkpointService.preview(serverId, checkpointId);

    if (json) {
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    displayImpactAnalysis(preview, quiet ?? false);
  } catch (error) {
    handleError(error, json ?? false);
  }
}

/**
 * Execute restore
 *
 * Sprint 150.4: Implement restore exec using API
 * Sprint 150.5: Add confirmation code handling
 */
export async function restoreExecuteCommand(options: RestoreExecuteOptions): Promise<void> {
  const { serverId, checkpointId, preview, json, quiet, autoApprove } = options;

  if (!serverId) {
    if (json) {
      console.log(JSON.stringify({ error: 'Server ID is required' }));
    } else {
      console.error(chalk.red('Error: Server ID is required (use --server-id)'));
    }
    process.exitCode = 1;
    return;
  }

  if (!checkpointId) {
    if (json) {
      console.log(JSON.stringify({ error: 'Checkpoint ID is required' }));
    } else {
      console.error(chalk.red('Error: Checkpoint ID is required'));
    }
    process.exitCode = 1;
    return;
  }

  // If preview flag is set, just show preview
  if (preview) {
    await restorePreviewCommand({ serverId, checkpointId, json, quiet });
    return;
  }

  try {
    const checkpointService = new CheckpointService();

    // First, get preview to check if confirmation is needed
    const previewResult = await checkpointService.preview(serverId, checkpointId);

    // JSON mode - execute with minimal interaction
    if (json) {
      const result = await checkpointService.restore(
        serverId,
        checkpointId,
        previewResult.confirmationCode
      );
      console.log(JSON.stringify({
        success: result.success,
        restoredAt: result.restoredAt.toISOString(),
        summary: result.summary,
      }, null, 2));
      return;
    }

    // Show preview
    if (!quiet) {
      displayImpactAnalysis(previewResult, quiet ?? false);
    }

    // Get confirmation (Sprint 150.5: High-impact confirmation flow)
    if (!autoApprove) {
      const confirmed = await promptConfirmation(
        previewResult.confirmationRequired,
        previewResult.confirmationCode ?? null
      );

      if (!confirmed) {
        console.log(chalk.yellow('\nRestore cancelled.'));
        return;
      }
    }

    // Execute restore
    if (!quiet) {
      console.log(chalk.cyan('\nExecuting restore...'));
    }

    const result = await checkpointService.restore(
      serverId,
      checkpointId,
      previewResult.confirmationCode
    );

    if (result.success) {
      console.log(chalk.green('\n✓ Configuration restored successfully!'));
      console.log(chalk.dim(`  Restored at: ${result.restoredAt.toISOString()}`));
      console.log(chalk.dim(`  Thresholds: ${result.summary.thresholdsRestored}`));
      console.log(chalk.dim(`  Feature gates: ${result.summary.featureGatesRestored}`));
      console.log(chalk.dim(`  Role mappings: ${result.summary.roleMapsRestored}`));
    } else {
      console.error(chalk.red('\n✗ Restore failed'));
      process.exitCode = 1;
    }
  } catch (error) {
    handleError(error, json ?? false);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Display impact analysis in human-readable format
 */
function displayImpactAnalysis(preview: ImpactAnalysis, quiet: boolean): void {
  if (!quiet) {
    console.log(chalk.bold('\nRestore Impact Analysis\n'));
  }

  // High impact warning
  if (preview.isHighImpact) {
    console.log(chalk.red.bold('⚠️  HIGH IMPACT RESTORE'));
    console.log(chalk.red(`This restore will affect ${preview.affectedUsers} users.\n`));
  }

  // Summary
  console.log(chalk.bold('Changes:'));
  console.log(`  Thresholds:     ${preview.thresholdChanges.length}`);
  console.log(`  Feature gates:  ${preview.featureGateChanges.length}`);
  console.log(`  Role mappings:  ${preview.roleMapChanges.length}`);
  console.log(`  Users affected: ${preview.affectedUsers}`);

  // Detail threshold changes
  if (preview.thresholdChanges.length > 0) {
    console.log(chalk.bold('\nThreshold Changes:'));
    for (const change of preview.thresholdChanges) {
      console.log(chalk.dim(`  ${change.name}: ${change.oldValue} → ${change.newValue}`));
    }
  }

  // Detail feature gate changes
  if (preview.featureGateChanges.length > 0) {
    console.log(chalk.bold('\nFeature Gate Changes:'));
    for (const change of preview.featureGateChanges) {
      const oldState = change.oldEnabled ? 'enabled' : 'disabled';
      const newState = change.newEnabled ? 'enabled' : 'disabled';
      console.log(chalk.dim(`  ${change.name}: ${oldState} → ${newState}`));
    }
  }

  // Detail role mapping changes
  if (preview.roleMapChanges.length > 0) {
    console.log(chalk.bold('\nRole Mapping Changes:'));
    for (const change of preview.roleMapChanges) {
      console.log(chalk.dim(`  ${change.tier}: ${change.oldRoleId || 'none'} → ${change.newRoleId || 'none'}`));
    }
  }

  // Warnings
  if (preview.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    for (const warning of preview.warnings) {
      console.log(chalk.yellow(`  • ${warning}`));
    }
  }

  // Confirmation code hint
  if (preview.confirmationRequired && preview.confirmationCode) {
    console.log(chalk.cyan(`\nConfirmation code required: ${preview.confirmationCode}`));
  }
}

/**
 * Prompt user for confirmation
 *
 * Sprint 150.5: High-impact restore confirmation flow
 */
async function promptConfirmation(
  requireCode: boolean,
  expectedCode: string | null
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (requireCode && expectedCode) {
      // High-impact: require confirmation code
      rl.question(
        chalk.cyan(`\nEnter confirmation code to proceed: `),
        (answer) => {
          rl.close();
          if (answer === expectedCode) {
            resolve(true);
          } else {
            console.log(chalk.red('Incorrect confirmation code.'));
            resolve(false);
          }
        }
      );
    } else {
      // Standard: yes/no confirmation
      rl.question(chalk.cyan('\nProceed with restore? (y/N): '), (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    }
  });
}

/**
 * Handle errors from CheckpointService
 */
function handleError(error: unknown, json: boolean): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error instanceof CheckpointError ? error.code : 'UNKNOWN_ERROR';

  if (json) {
    console.log(JSON.stringify({
      success: false,
      error: errorMessage,
      code: errorCode,
    }));
  } else {
    console.error(chalk.red(`Error: ${errorMessage}`));
    if (error instanceof CheckpointError && error.statusCode) {
      console.error(chalk.dim(`  Status: ${error.statusCode}`));
    }
  }
  process.exitCode = 1;
}

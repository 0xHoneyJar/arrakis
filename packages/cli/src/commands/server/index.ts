/**
 * Server Command Group
 *
 * Sprint 93: Discord Infrastructure-as-Code - CLI Commands & Polish
 *
 * Registers the `gaib server` command group with all subcommands.
 * Provides Terraform-like workflow for Discord server configuration.
 *
 * @see SDD §6.0 CLI Commands
 * @see PRD §3.1 Infrastructure-as-Code
 * @module packages/cli/commands/server
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { shouldUseColor, handleError } from './utils.js';

/**
 * Creates the server command group
 *
 * @returns Commander command with all server subcommands
 */
export function createServerCommand(): Command {
  const server = new Command('server')
    .description('Infrastructure-as-Code for Discord servers (Terraform-like workflow)')
    // Common options (clig.dev compliance)
    .option('--no-color', 'Disable colored output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.optsWithGlobals();
      // Disable colors if --no-color flag, NO_COLOR env, TERM=dumb, or non-TTY
      if (opts.noColor || !shouldUseColor()) {
        chalk.level = 0;
      }
    })
    .addHelpText(
      'after',
      `
Examples:
  $ gaib server init                         Initialize config in current directory
  $ gaib server init --guild 123456789       Initialize with guild ID
  $ gaib server plan                         Preview changes (dry-run)
  $ gaib server plan -f config.yaml          Plan from specific config file
  $ gaib server diff                         Show detailed diff of changes
  $ gaib server diff --json                  Output diff as JSON
  $ gaib server export                       Export current Discord state to YAML
  $ gaib server export --guild 123456789     Export specific guild
`
    );

  // Register subcommands
  registerInitCommand(server);
  registerPlanCommand(server);
  registerDiffCommand(server);
  registerExportCommand(server);

  return server;
}

/**
 * Registers the 'init' subcommand
 *
 * Initializes a new server configuration file.
 *
 * @see S-93.2 acceptance criteria
 */
function registerInitCommand(parent: Command): void {
  parent
    .command('init')
    .description('Initialize a new server configuration file')
    .option('-g, --guild <id>', 'Discord guild/server ID')
    .option('-f, --file <path>', 'Output file path', 'discord-server.yaml')
    .option('--force', 'Overwrite existing configuration file')
    .option('--json', 'Output result as JSON')
    .action(async (options) => {
      try {
        const { initCommand } = await import('./init.js');
        const globalOpts = parent.optsWithGlobals();
        await initCommand({ ...options, quiet: globalOpts.quiet });
      } catch (error) {
        handleError(error, options.json);
      }
    });
}

/**
 * Registers the 'plan' subcommand
 *
 * Shows what changes would be applied without making them.
 * Similar to `terraform plan`.
 *
 * @see S-93.3 acceptance criteria
 */
function registerPlanCommand(parent: Command): void {
  parent
    .command('plan')
    .description('Preview changes without applying them (dry-run)')
    .option('-f, --file <path>', 'Configuration file path', 'discord-server.yaml')
    .option('-g, --guild <id>', 'Override guild ID from config')
    .option('--json', 'Output result as JSON')
    .option('--managed-only', 'Only show IaC-managed resources', true)
    .action(async (options) => {
      try {
        const { planCommand } = await import('./plan.js');
        const globalOpts = parent.optsWithGlobals();
        await planCommand({ ...options, quiet: globalOpts.quiet });
      } catch (error) {
        handleError(error, options.json);
      }
    });
}

/**
 * Registers the 'diff' subcommand
 *
 * Shows detailed diff between config and current Discord state.
 *
 * @see S-93.4 acceptance criteria
 */
function registerDiffCommand(parent: Command): void {
  parent
    .command('diff')
    .description('Show detailed diff between config and current state')
    .option('-f, --file <path>', 'Configuration file path', 'discord-server.yaml')
    .option('-g, --guild <id>', 'Override guild ID from config')
    .option('--json', 'Output diff as JSON')
    .option('--no-permissions', 'Exclude permission changes from diff')
    .option('--managed-only', 'Only show IaC-managed resources', true)
    .action(async (options) => {
      try {
        const { diffCommand } = await import('./diff.js');
        const globalOpts = parent.optsWithGlobals();
        await diffCommand({ ...options, quiet: globalOpts.quiet });
      } catch (error) {
        handleError(error, options.json);
      }
    });
}

/**
 * Registers the 'export' subcommand
 *
 * Exports current Discord server state to YAML configuration.
 *
 * @see S-93.5 acceptance criteria
 */
function registerExportCommand(parent: Command): void {
  parent
    .command('export')
    .description('Export current Discord server state to YAML')
    .option('-g, --guild <id>', 'Discord guild/server ID (required if not in config)')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON instead of YAML')
    .option('--include-unmanaged', 'Include resources not managed by IaC')
    .action(async (options) => {
      try {
        const { exportCommand } = await import('./export.js');
        const globalOpts = parent.optsWithGlobals();
        await exportCommand({ ...options, quiet: globalOpts.quiet });
      } catch (error) {
        handleError(error, options.json);
      }
    });
}

export default createServerCommand;

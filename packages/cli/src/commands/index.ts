/**
 * CLI Commands Registry
 *
 * Sprint 85: Discord Server Sandboxes - CLI Commands
 * Sprint 93: Discord Infrastructure-as-Code - CLI Commands & Polish
 *
 * Registers all command groups with the main program.
 *
 * @module packages/cli/commands
 */

import type { Command } from 'commander';
import { createSandboxCommand } from './sandbox/index.js';
import { createServerCommand } from './server/index.js';

/**
 * Registers all command groups with the program
 *
 * @param program - Commander program instance
 */
export function registerCommands(program: Command): void {
  // Register sandbox command group
  program.addCommand(createSandboxCommand());

  // Register server (IaC) command group
  // Sprint 93: Infrastructure-as-Code for Discord servers
  program.addCommand(createServerCommand());
}

export { createSandboxCommand, createServerCommand };

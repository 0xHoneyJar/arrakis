#!/usr/bin/env node
/**
 * gaib CLI - Arrakis Developer CLI
 *
 * Sprint 85: Discord Server Sandboxes - CLI Commands
 * Sprint 90: CLI Rename (bd → gaib)
 *
 * Entry point for the `gaib` command.
 *
 * Named after "Lisan al-Gaib" (Voice from the Outer World) from Dune,
 * reflecting Arrakis's Dune-inspired naming and the CLI's role in
 * managing sandboxed (isolated/hidden) Discord servers.
 *
 * @module packages/cli/bin/gaib
 */

import { Command } from 'commander';
import { registerCommands } from '../commands/index.js';

const program = new Command();

program
  .name('gaib')
  .description('Arrakis Developer CLI - Manage sandboxes, workers, and events')
  .version('0.1.0');

// Register all command groups
registerCommands(program);

// Parse arguments
program.parse();

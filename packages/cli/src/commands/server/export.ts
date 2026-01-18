/**
 * Server Export Command
 *
 * Sprint 93: Discord Infrastructure-as-Code - CLI Commands & Polish
 *
 * Exports current Discord server state to YAML configuration.
 *
 * @see SDD §6.0 CLI Commands
 * @see S-93.5 acceptance criteria
 * @module packages/cli/commands/server/export
 */

import { writeFileSync } from 'fs';
import * as yaml from 'js-yaml';
import {
  getGuildId,
  getDiscordToken,
  resolveConfigPath,
  formatSuccess,
  formatInfo,
} from './utils.js';
import { createClientFromEnv, readServerState } from './iac/index.js';
import type { ServerState, RoleState, CategoryState, ChannelState } from './iac/index.js';

/**
 * Options for the export command
 */
export interface ExportOptions {
  guild?: string;
  output?: string;
  json?: boolean;
  includeUnmanaged?: boolean;
  quiet?: boolean;
}

/**
 * Converts Discord state to exportable config format
 *
 * @param state - Server state from Discord
 * @param includeUnmanaged - Whether to include non-IaC-managed resources
 * @returns Configuration object
 */
function stateToConfig(
  state: ServerState,
  includeUnmanaged: boolean
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    version: '1.0',
    server: {
      name: state.name,
      id: state.id,
    },
  };

  // Export roles
  const roles = state.roles
    .filter((r) => !r.isEveryone && !r.managed) // Skip @everyone and bot roles
    .filter((r) => includeUnmanaged || r.isIacManaged)
    .map((r) => roleToConfig(r));

  config.roles = roles;

  // Export categories
  const categories = state.categories
    .filter((c) => includeUnmanaged || c.isIacManaged)
    .map((c) => categoryToConfig(c));

  config.categories = categories;

  // Export channels
  const channels = state.channels
    .filter((c) => includeUnmanaged || c.isIacManaged)
    .map((c) => channelToConfig(c));

  config.channels = channels;

  return config;
}

/**
 * Converts a role state to config format
 */
function roleToConfig(role: RoleState): Record<string, unknown> {
  const config: Record<string, unknown> = {
    name: role.name,
  };

  if (role.color && role.color !== '#000000') {
    config.color = role.color;
  }

  if (role.permissions && role.permissions.length > 0) {
    config.permissions = role.permissions;
  }

  if (role.hoist) {
    config.hoist = true;
  }

  if (role.mentionable) {
    config.mentionable = true;
  }

  return config;
}

/**
 * Converts a category state to config format
 */
function categoryToConfig(category: CategoryState): Record<string, unknown> {
  const config: Record<string, unknown> = {
    name: category.name,
    position: category.position,
  };

  return config;
}

/**
 * Converts a channel state to config format
 */
function channelToConfig(channel: ChannelState): Record<string, unknown> {
  const config: Record<string, unknown> = {
    name: channel.name,
    type: channel.type,
  };

  if (channel.topic) {
    config.topic = channel.topic;
  }

  if (channel.parentName) {
    config.category = channel.parentName;
  }

  if (channel.nsfw) {
    config.nsfw = true;
  }

  if (channel.slowmode && channel.slowmode > 0) {
    config.slowmode = channel.slowmode;
  }

  if (channel.bitrate) {
    config.bitrate = channel.bitrate;
  }

  if (channel.userLimit) {
    config.userLimit = channel.userLimit;
  }

  return config;
}

/**
 * Executes the export command
 *
 * Fetches current Discord state and exports it as YAML or JSON.
 *
 * @param options - Command options
 */
export async function exportCommand(options: ExportOptions): Promise<void> {
  // Validate environment
  getDiscordToken();

  // Get guild ID
  const guildId = getGuildId(options);
  if (!guildId) {
    throw Object.assign(
      new Error(
        'Guild ID is required for export. Either:\n' +
          '  - Pass --guild <id> option\n' +
          '  - Set DISCORD_GUILD_ID environment variable'
      ),
      { code: 'MISSING_GUILD_ID' }
    );
  }

  if (!options.quiet) {
    formatInfo(`Exporting server state for guild ${guildId}...`);
  }

  // Fetch current Discord state
  const client = createClientFromEnv();
  const state = await readServerState(client, guildId);

  if (!options.quiet) {
    formatInfo(`Server: ${state.name}`);
  }

  // Convert to config format
  const config = stateToConfig(state, options.includeUnmanaged ?? false);

  // Format output
  let output: string;
  if (options.json) {
    output = JSON.stringify(config, null, 2);
  } else {
    output = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    // Add header comment
    output = `# Discord Server Configuration\n# Exported from: ${state.name}\n# Guild ID: ${state.id}\n# Exported at: ${new Date().toISOString()}\n\n${output}`;
  }

  // Output
  if (options.output) {
    const outputPath = resolveConfigPath(options.output);
    writeFileSync(outputPath, output, 'utf-8');
    formatSuccess(`Exported configuration to: ${outputPath}`, undefined, false);
  } else {
    // Write to stdout
    console.log(output);
  }
}

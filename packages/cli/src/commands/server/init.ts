/**
 * Server Init Command
 *
 * Sprint 93: Discord Infrastructure-as-Code - CLI Commands & Polish
 * Sprint 100: Theme System Integration
 *
 * Initializes a new server configuration file.
 *
 * @see SDD §6.0 CLI Commands
 * @see S-93.2 acceptance criteria
 * @module packages/cli/commands/server/init
 */

import {
  generateDefaultConfig,
  generateThemedConfig,
  writeConfigFile,
  configExists,
  resolveConfigPath,
  formatSuccess,
  formatInfo,
  formatWarning,
  getGuildId,
  getDiscordToken,
} from './utils.js';
import { createClientFromEnv, readServerState } from './iac/index.js';
import { ThemeLoader, ThemeError, findThemePath } from './themes/index.js';

/**
 * Options for the init command
 */
export interface InitOptions {
  guild?: string;
  file: string;
  theme?: string;
  force?: boolean;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Executes the init command
 *
 * Creates a new server configuration file, optionally pre-populated
 * with current server state if a guild ID is provided.
 *
 * @param options - Command options
 */
export async function initCommand(options: InitOptions): Promise<void> {
  const filePath = options.file;
  const fullPath = resolveConfigPath(filePath);

  // Check for existing file
  if (configExists(filePath) && !options.force) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: false,
            error: {
              message: `Configuration file already exists: ${filePath}`,
              code: 'FILE_EXISTS',
              hint: 'Use --force to overwrite, or specify a different path with -f/--file.',
            },
          },
          null,
          2
        )
      );
      process.exit(1);
    }
    throw new Error(
      `Configuration file already exists: ${filePath}\n` +
        'Use --force to overwrite, or specify a different path with -f/--file.'
    );
  }

  const guildId = getGuildId(options);
  let serverName: string | undefined;

  // If guild ID provided, try to fetch server name
  if (guildId) {
    try {
      getDiscordToken(); // Validate token exists
      if (!options.quiet) {
        formatInfo(`Fetching server info for guild ${guildId}...`);
      }

      const client = createClientFromEnv();
      const state = await readServerState(client, guildId);
      serverName = state.name;

      if (!options.quiet) {
        formatInfo(`Found server: ${serverName}`);
      }
    } catch (error) {
      // Non-fatal: continue with default name
      if (!options.quiet) {
        formatWarning(
          `Could not fetch server info: ${error instanceof Error ? error.message : String(error)}`
        );
        formatInfo('Continuing with default template...');
      }
    }
  }

  // Generate config (with or without theme)
  let config: string;
  let themeName: string | undefined;

  if (options.theme) {
    // Validate theme exists
    const themePath = findThemePath(options.theme);
    if (!themePath) {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: false,
              error: {
                message: `Theme "${options.theme}" not found`,
                code: 'THEME_NOT_FOUND',
                hint: 'Run "gaib server theme list" to see available themes.',
              },
            },
            null,
            2
          )
        );
        process.exit(1);
      }
      throw new Error(
        `Theme "${options.theme}" not found.\n` +
          'Run "gaib server theme list" to see available themes.'
      );
    }

    // Load theme to validate it
    const loader = new ThemeLoader();
    try {
      await loader.load(options.theme);
      themeName = options.theme;
      if (!options.quiet) {
        formatInfo(`Using theme: ${options.theme}`);
      }
    } catch (error) {
      if (error instanceof ThemeError) {
        if (options.json) {
          console.log(
            JSON.stringify(
              {
                success: false,
                error: {
                  message: `Failed to load theme: ${error.message}`,
                  code: error.code,
                  details: error.details,
                },
              },
              null,
              2
            )
          );
          process.exit(1);
        }
        throw new Error(`Failed to load theme: ${error.message}`);
      }
      throw error;
    }

    config = generateThemedConfig(guildId, serverName, themeName);
  } else {
    config = generateDefaultConfig(guildId, serverName);
  }

  writeConfigFile(filePath, config, options.force);

  formatSuccess(`Created configuration file: ${fullPath}`, undefined, options.json);

  if (!options.quiet && !options.json) {
    console.log('');
    console.log('Next steps:');
    if (themeName) {
      console.log(`  1. Review and customize the theme variables in ${filePath}`);
      console.log('  2. Run "gaib server plan" to preview changes');
      console.log('  3. Run "gaib server apply" to apply changes to Discord');
    } else {
      console.log('  1. Edit the configuration file to define your server structure');
      console.log('  2. Run "gaib server plan" to preview changes');
      console.log('  3. Run "gaib server apply" to apply changes to Discord');
    }
    console.log('');
  }
}

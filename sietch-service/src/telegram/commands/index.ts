/**
 * Telegram Command Handlers Index (v4.1 - Sprint 30)
 *
 * Registers all command handlers on the bot instance.
 */

import type { Bot } from 'grammy';
import type { BotContext } from '../bot.js';
import { registerStartCommand } from './start.js';
import { registerVerifyCommand } from './verify.js';

/**
 * Register all command handlers on the bot
 */
export function registerAllCommands(bot: Bot<BotContext>): void {
  // Foundation commands (Sprint 30)
  registerStartCommand(bot);
  registerVerifyCommand(bot);

  // Set bot commands for the menu
  bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot and see welcome message' },
    { command: 'verify', description: 'Link your wallet via Collab.Land' },
    // Future commands (Sprint 31)
    // { command: 'score', description: 'View your conviction score' },
    // { command: 'leaderboard', description: 'See community rankings' },
    // { command: 'tier', description: 'Check your subscription tier' },
    // { command: 'status', description: 'See linked platforms' },
    // { command: 'help', description: 'Get help with commands' },
  ]).catch((error) => {
    // Non-fatal - bot works without command menu
    console.error('Failed to set bot commands:', error);
  });
}

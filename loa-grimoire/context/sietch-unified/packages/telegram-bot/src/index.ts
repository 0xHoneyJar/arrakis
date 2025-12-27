import { Bot, Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import { conversations, createConversation, ConversationFlavor } from '@grammyjs/conversations';
import { Menu } from '@grammyjs/menu';
import { run } from '@grammyjs/runner';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'telegram-bot' });

// =============================================================================
// TYPES
// =============================================================================

interface SessionData {
  verificationState?: 'awaiting_wallet' | 'awaiting_signature';
  pendingWallet?: string;
  returnTo?: string;
}

type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor;

// =============================================================================
// CONFIGURATION
// =============================================================================

const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  miniAppUrl: process.env.TELEGRAM_MINIAPP_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

// =============================================================================
// SERVICES
// =============================================================================

const redis = new Redis(config.redisUrl);

async function callApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

// =============================================================================
// BOT INITIALIZATION
// =============================================================================

const bot = new Bot<BotContext>(config.botToken);

// Session middleware with Redis storage
bot.use(session({
  initial: (): SessionData => ({}),
  storage: {
    read: async (key) => {
      const data = await redis.get(`telegram:session:${key}`);
      return data ? JSON.parse(data) : undefined;
    },
    write: async (key, value) => {
      await redis.set(`telegram:session:${key}`, JSON.stringify(value), 'EX', 86400);
    },
    delete: async (key) => {
      await redis.del(`telegram:session:${key}`);
    },
  },
}));

// Conversations middleware
bot.use(conversations());

// =============================================================================
// MENUS
// =============================================================================

const mainMenu = new Menu<BotContext>('main-menu')
  .webApp('🏛️ Open Embassy', config.miniAppUrl)
  .row()
  .text('🔐 Verify Wallet', async (ctx) => {
    await ctx.reply(
      '🔗 *Connect Your Wallet*\n\n' +
      'To verify your identity and access exclusive features, please connect your wallet through our Mini App.\n\n' +
      'This will link your Telegram account to your on-chain identity.',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .webApp('Connect Wallet', `${config.miniAppUrl}/verify`),
      }
    );
  })
  .text('📊 My Profile', async (ctx) => {
    await handleProfile(ctx);
  })
  .row()
  .text('🏆 Leaderboard', async (ctx) => {
    await handleLeaderboard(ctx);
  })
  .text('❓ Help', async (ctx) => {
    await handleHelp(ctx);
  });

bot.use(mainMenu);

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

bot.command('start', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  // Check for deep link parameters
  const startParam = ctx.match;
  
  if (startParam === 'verify') {
    // Direct to verification flow
    await ctx.reply(
      '🔐 *Wallet Verification*\n\n' +
      'Connect your wallet to access the Sietch community and sync your roles across platforms.',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .webApp('Connect Wallet', `${config.miniAppUrl}/verify`),
      }
    );
    return;
  }

  // Standard welcome message
  await ctx.reply(
    `🏜️ *Welcome to the Sietch, ${user.first_name}!*\n\n` +
    'This is the unified embassy for our cross-platform community. ' +
    'Here you can:\n\n' +
    '• 🔐 Verify your wallet to prove conviction\n' +
    '• 🤝 Sync roles across Discord and Telegram\n' +
    '• 📊 View your profile and ranking\n' +
    '• 🏆 Browse the community leaderboard\n\n' +
    '_"The spice must flow, and so must our community."_',
    {
      parse_mode: 'Markdown',
      reply_markup: mainMenu,
    }
  );

  // Log new user interaction
  logger.info({ userId: user.id, username: user.username }, 'User started bot');
});

bot.command('verify', async (ctx) => {
  await ctx.reply(
    '🔐 *Wallet Verification*\n\n' +
    'Connect your wallet through our secure Mini App to:\n\n' +
    '• Link your Telegram to your on-chain identity\n' +
    '• Automatically receive community roles based on your BGT holdings\n' +
    '• Sync your status across Discord and Telegram\n\n' +
    'Your wallet signature proves ownership without sharing private keys.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .webApp('🔗 Connect Wallet', `${config.miniAppUrl}/verify`),
    }
  );
});

bot.command('profile', handleProfile);

bot.command('rank', async (ctx) => {
  await handleProfile(ctx);
});

bot.command('leaderboard', handleLeaderboard);

bot.command('help', handleHelp);

bot.command('directory', async (ctx) => {
  await ctx.reply(
    '📖 *Community Directory*\n\n' +
    'Browse verified community members in our Mini App directory. ' +
    'Find fellow holders, view profiles, and connect with the community.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .webApp('📖 Open Directory', `${config.miniAppUrl}/directory`),
    }
  );
});

// =============================================================================
// HANDLER FUNCTIONS
// =============================================================================

async function handleProfile(ctx: BotContext) {
  const user = ctx.from;
  if (!user) return;

  try {
    // Try to fetch user's profile from API
    const profile = await callApi<{
      nym?: string;
      tier: string;
      rank?: number;
      activityScore: number;
      badges: Array<{ type: string; earnedAt: string }>;
      memberSince: string;
    }>(`/api/profile/telegram/${user.id}`);

    const tierEmoji = profile.tier === 'naib' ? '👑' : profile.tier === 'fedaykin' ? '⚔️' : '👤';
    const badgeList = profile.badges.length > 0 
      ? profile.badges.map(b => getBadgeEmoji(b.type)).join(' ')
      : 'None yet';

    await ctx.reply(
      `📊 *Your Profile*\n\n` +
      `*Nym:* ${profile.nym || 'Anonymous'}\n` +
      `*Tier:* ${tierEmoji} ${profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)}\n` +
      `*Rank:* ${profile.rank ? `#${profile.rank}` : 'Unranked'}\n` +
      `*Activity Score:* ${profile.activityScore.toFixed(1)}\n` +
      `*Badges:* ${badgeList}\n` +
      `*Member Since:* ${new Date(profile.memberSince).toLocaleDateString()}\n\n` +
      '_Open the Mini App for full profile management._',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .webApp('✏️ Edit Profile', `${config.miniAppUrl}/profile`),
      }
    );
  } catch (error) {
    // User not verified yet
    await ctx.reply(
      '📊 *Profile Not Found*\n\n' +
      'You haven\'t verified your wallet yet. ' +
      'Connect your wallet to create your profile and access community features.',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .webApp('🔗 Verify Now', `${config.miniAppUrl}/verify`),
      }
    );
  }
}

async function handleLeaderboard(ctx: BotContext) {
  try {
    const leaderboard = await callApi<{
      entries: Array<{
        rank: number;
        nym: string;
        tier: string;
        score: number;
      }>;
    }>('/api/directory?limit=10&sort=rank');

    const lines = leaderboard.entries.map((entry, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${entry.rank}.`;
      const tierEmoji = entry.tier === 'naib' ? '👑' : '⚔️';
      return `${medal} ${tierEmoji} *${entry.nym}* — ${entry.score.toFixed(1)} pts`;
    });

    await ctx.reply(
      `🏆 *Top 10 Leaderboard*\n\n` +
      lines.join('\n') +
      '\n\n_Updated every 6 hours based on conviction metrics._',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .webApp('📖 Full Directory', `${config.miniAppUrl}/directory`),
      }
    );
  } catch (error) {
    await ctx.reply(
      '🏆 *Leaderboard*\n\n' +
      'Unable to fetch leaderboard at the moment. Please try again later.',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .webApp('📖 View in App', `${config.miniAppUrl}/directory`),
      }
    );
  }
}

async function handleHelp(ctx: BotContext) {
  await ctx.reply(
    '❓ *Sietch Embassy Help*\n\n' +
    '*Commands:*\n' +
    '/start — Main menu\n' +
    '/verify — Connect your wallet\n' +
    '/profile — View your profile\n' +
    '/rank — Check your ranking\n' +
    '/leaderboard — Top 10 members\n' +
    '/directory — Browse members\n' +
    '/help — This message\n\n' +
    '*What is the Sietch?*\n' +
    'A unified community spanning Discord and Telegram. ' +
    'Verify your wallet once, and your roles sync across both platforms.\n\n' +
    '*Tiers:*\n' +
    '👑 *Naib* — Top 7 by conviction score\n' +
    '⚔️ *Fedaykin* — Ranks 8-69\n\n' +
    '*Need more help?*\n' +
    'Join our Discord or reach out to the community.',
    {
      parse_mode: 'Markdown',
      reply_markup: mainMenu,
    }
  );
}

function getBadgeEmoji(badgeType: string): string {
  const badges: Record<string, string> = {
    first_wave: '🌊',
    veteran: '🎖️',
    diamond_hands: '💎',
    council: '👑',
    survivor: '🛡️',
    streak_master: '🔥',
    engaged: '💬',
    contributor: '⭐',
    pillar: '🏛️',
    achievement: '🏆',
  };
  return badges[badgeType] || '📛';
}

// =============================================================================
// CALLBACK QUERY HANDLERS (for inline buttons)
// =============================================================================

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  // Handle various callback patterns
  if (data.startsWith('profile:')) {
    const userId = data.split(':')[1];
    // Could show a specific user's profile
    await ctx.answerCallbackQuery({ text: 'Opening profile...' });
  } else {
    await ctx.answerCallbackQuery();
  }
});

// =============================================================================
// WEB APP DATA HANDLER
// =============================================================================

bot.on('message:web_app_data', async (ctx) => {
  const data = ctx.message.web_app_data;
  
  try {
    const payload = JSON.parse(data.data);
    
    if (payload.type === 'verification_complete') {
      const { wallet, tier, rank } = payload;
      const tierEmoji = tier === 'naib' ? '👑' : tier === 'fedaykin' ? '⚔️' : '✅';
      
      await ctx.reply(
        `${tierEmoji} *Verification Successful!*\n\n` +
        `Your wallet \`${wallet.slice(0, 6)}...${wallet.slice(-4)}\` has been linked.\n\n` +
        (tier !== 'none' 
          ? `Welcome to the ${tier.charAt(0).toUpperCase() + tier.slice(1)}! You are rank #${rank}.`
          : 'Keep accumulating BGT to climb the ranks!'),
        {
          parse_mode: 'Markdown',
          reply_markup: mainMenu,
        }
      );
      
      logger.info({ userId: ctx.from?.id, wallet, tier }, 'Verification completed via Mini App');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to process web app data');
  }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

bot.catch((err) => {
  const ctx = err.ctx;
  logger.error({
    error: err.error,
    update: ctx.update,
  }, 'Bot error');
});

// =============================================================================
// STARTUP
// =============================================================================

async function start() {
  // Validate config
  if (!config.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
  if (!config.miniAppUrl) {
    throw new Error('TELEGRAM_MINIAPP_URL is required');
  }

  // Test Redis connection
  await redis.ping();
  logger.info('Redis connected');

  // Set bot commands
  await bot.api.setMyCommands([
    { command: 'start', description: 'Main menu' },
    { command: 'verify', description: 'Connect your wallet' },
    { command: 'profile', description: 'View your profile' },
    { command: 'rank', description: 'Check your ranking' },
    { command: 'leaderboard', description: 'Top 10 members' },
    { command: 'directory', description: 'Browse community members' },
    { command: 'help', description: 'Get help' },
  ]);

  // Start bot with runner for graceful handling
  const runner = run(bot);

  logger.info('Telegram bot started');

  // Graceful shutdown
  const stopRunner = () => {
    logger.info('Shutting down...');
    runner.stop();
    redis.disconnect();
  };

  process.on('SIGINT', stopRunner);
  process.on('SIGTERM', stopRunner);
}

start().catch((error) => {
  logger.fatal({ error }, 'Failed to start bot');
  process.exit(1);
});

export { bot };

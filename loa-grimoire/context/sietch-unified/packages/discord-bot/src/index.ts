import {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ButtonInteraction,
} from 'discord.js';
import pino from 'pino';
import { DiscordRoleManager } from './services/role-manager.service';

const logger = pino({ name: 'discord-bot' });

// =============================================================================
// CONFIGURATION
// =============================================================================

const config = {
  token: process.env.DISCORD_BOT_TOKEN!,
  clientId: process.env.DISCORD_CLIENT_ID!,
  guildId: process.env.DISCORD_GUILD_ID!,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
};

// =============================================================================
// API HELPERS
// =============================================================================

async function callApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }
  
  return response.json();
}

// =============================================================================
// SLASH COMMANDS DEFINITIONS
// =============================================================================

const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link your wallet to verify your identity and receive roles'),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your or another member\'s profile')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view (leave empty for yourself)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your current rank and conviction score'),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top holders leaderboard')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of entries to show (default: 10)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(25)
    ),

  new SlashCommandBuilder()
    .setName('directory')
    .setDescription('Search the community directory')
    .addStringOption(option =>
      option
        .setName('search')
        .setDescription('Search by nym')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('tier')
        .setDescription('Filter by tier')
        .setRequired(false)
        .addChoices(
          { name: 'Naib (Top 7)', value: 'naib' },
          { name: 'Fedaykin (8-69)', value: 'fedaykin' }
        )
    ),

  new SlashCommandBuilder()
    .setName('setnym')
    .setDescription('Set your display name (nym) in the community')
    .addStringOption(option =>
      option
        .setName('nym')
        .setDescription('Your new nym (3-32 characters)')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(32)
    ),

  new SlashCommandBuilder()
    .setName('badges')
    .setDescription('View your earned badges'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with Sietch commands'),
].map(command => command.toJSON());

// =============================================================================
// CLIENT INITIALIZATION
// =============================================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

let roleManager: DiscordRoleManager;

// =============================================================================
// EVENT HANDLERS
// =============================================================================

client.once(Events.ClientReady, async (readyClient) => {
  logger.info({ user: readyClient.user.tag }, 'Discord bot ready');
  
  // Initialize role manager
  const guild = await client.guilds.fetch(config.guildId);
  roleManager = new DiscordRoleManager(guild);
  
  // Ensure stillsuit channel exists
  await roleManager.ensureStillsuitChannel();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (error) {
    logger.error({ error, interaction: interaction.id }, 'Interaction error');
    
    const reply = {
      content: '❌ An error occurred while processing your request.',
      ephemeral: true,
    };
    
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  // Check if new member has verified wallet
  try {
    const identity = await callApi<{ verified: boolean; tier?: string }>(
      `/api/identity/discord/${member.id}`
    );
    
    if (identity.verified && identity.tier) {
      // Auto-assign roles to returning verified members
      logger.info({ userId: member.id, tier: identity.tier }, 'Auto-assigning roles to returning member');
    }
  } catch {
    // Not verified, send welcome DM
    await roleManager.startDMOnboarding(member);
  }
});

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

async function handleCommand(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;
  
  switch (commandName) {
    case 'verify':
      await handleVerify(interaction);
      break;
    case 'profile':
      await handleProfile(interaction);
      break;
    case 'rank':
      await handleRank(interaction);
      break;
    case 'leaderboard':
      await handleLeaderboard(interaction);
      break;
    case 'directory':
      await handleDirectory(interaction);
      break;
    case 'setnym':
      await handleSetNym(interaction);
      break;
    case 'badges':
      await handleBadges(interaction);
      break;
    case 'help':
      await handleHelp(interaction);
      break;
  }
}

async function handleVerify(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  
  // Check if already verified
  try {
    const identity = await callApi<{ verified: boolean }>(
      `/api/identity/discord/${interaction.user.id}`
    );
    
    if (identity.verified) {
      await interaction.editReply({
        content: '✅ You\'re already verified! Use `/profile` to view your status.',
      });
      return;
    }
  } catch {
    // Not verified, continue with flow
  }
  
  // Create verification session
  const session = await callApi<{ sessionId: string; verifyUrl: string }>(
    '/api/identity/session',
    {
      method: 'POST',
      body: JSON.stringify({
        platform: 'discord',
        platformId: interaction.user.id,
        platformUsername: interaction.user.username,
      }),
    }
  );
  
  const embed = new EmbedBuilder()
    .setTitle('🔐 Wallet Verification')
    .setDescription(
      'Connect your wallet to verify your identity and receive community roles.\n\n' +
      '**What happens:**\n' +
      '• Your Discord account links to your wallet address\n' +
      '• Your BGT holdings determine your tier (Naib/Fedaykin)\n' +
      '• Roles sync automatically across Discord and Telegram\n\n' +
      '*Click the button below to start verification.*'
    )
    .setColor(0x9945FF)
    .setFooter({ text: 'Session expires in 15 minutes' });
  
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Connect Wallet')
        .setStyle(ButtonStyle.Link)
        .setURL(session.verifyUrl)
        .setEmoji('🔗'),
      new ButtonBuilder()
        .setCustomId(`verify_check:${session.sessionId}`)
        .setLabel('I\'ve Verified')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✅')
    );
  
  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });
}

async function handleProfile(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  const targetUser = interaction.options.getUser('user') || interaction.user;
  
  try {
    const profile = await callApi<{
      nym: string;
      tier: string;
      rank: number | null;
      activityScore: number;
      badges: Array<{ type: string; earnedAt: string }>;
      memberSince: string;
      bio?: string;
    }>(`/api/profile/discord/${targetUser.id}`);
    
    const tierEmoji = profile.tier === 'naib' ? '👑' : profile.tier === 'fedaykin' ? '⚔️' : '👤';
    const tierColor = profile.tier === 'naib' ? 0xFFD700 : profile.tier === 'fedaykin' ? 0x9945FF : 0x808080;
    
    const embed = new EmbedBuilder()
      .setTitle(`${tierEmoji} ${profile.nym}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor(tierColor)
      .addFields(
        { 
          name: 'Tier', 
          value: profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1), 
          inline: true 
        },
        { 
          name: 'Rank', 
          value: profile.rank ? `#${profile.rank}` : 'Unranked', 
          inline: true 
        },
        { 
          name: 'Activity', 
          value: profile.activityScore.toFixed(1), 
          inline: true 
        },
        {
          name: 'Badges',
          value: profile.badges.length > 0 
            ? profile.badges.map(b => getBadgeDisplay(b.type)).join(' ')
            : 'None yet',
          inline: false,
        },
        {
          name: 'Member Since',
          value: `<t:${Math.floor(new Date(profile.memberSince).getTime() / 1000)}:R>`,
          inline: true,
        }
      );
    
    if (profile.bio) {
      embed.setDescription(profile.bio);
    }
    
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({
      content: targetUser.id === interaction.user.id
        ? '❌ You haven\'t verified yet. Use `/verify` to get started!'
        : '❌ This user hasn\'t verified their wallet yet.',
    });
  }
}

async function handleRank(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const result = await callApi<{
      rank: number;
      tier: string;
      score: number;
      percentile: number;
    }>(`/api/conviction/discord/${interaction.user.id}`);
    
    const tierEmoji = result.tier === 'naib' ? '👑' : result.tier === 'fedaykin' ? '⚔️' : '👤';
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Your Conviction Score')
      .setColor(result.tier === 'naib' ? 0xFFD700 : 0x9945FF)
      .addFields(
        { name: 'Rank', value: `#${result.rank}`, inline: true },
        { name: 'Tier', value: `${tierEmoji} ${result.tier}`, inline: true },
        { name: 'Score', value: result.score.toFixed(2), inline: true },
        { name: 'Percentile', value: `Top ${result.percentile.toFixed(1)}%`, inline: true }
      )
      .setFooter({ text: 'Scores update every 6 hours' });
    
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({
      content: '❌ Unable to fetch your rank. Make sure you\'ve verified with `/verify`.',
    });
  }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  const limit = interaction.options.getInteger('limit') || 10;
  
  const leaderboard = await callApi<{
    entries: Array<{
      rank: number;
      nym: string;
      tier: string;
      score: number;
    }>;
  }>(`/api/directory?limit=${limit}&sort=rank`);
  
  const lines = leaderboard.entries.map((entry, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${entry.rank}.\``;
    const tierEmoji = entry.tier === 'naib' ? '👑' : '⚔️';
    return `${medal} ${tierEmoji} **${entry.nym}** — ${entry.score.toFixed(1)}`;
  });
  
  const embed = new EmbedBuilder()
    .setTitle('🏆 Conviction Leaderboard')
    .setDescription(lines.join('\n'))
    .setColor(0xFFD700)
    .setFooter({ text: `Top ${limit} • Updated every 6 hours` })
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleDirectory(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  const search = interaction.options.getString('search');
  const tier = interaction.options.getString('tier');
  
  const params = new URLSearchParams({ limit: '10' });
  if (search) params.set('search', search);
  if (tier) params.set('tier', tier);
  
  const directory = await callApi<{
    entries: Array<{
      nym: string;
      tier: string;
      activityScore: number;
      badges: string[];
    }>;
    total: number;
  }>(`/api/directory?${params}`);
  
  if (directory.entries.length === 0) {
    await interaction.editReply({ content: '📖 No members found matching your criteria.' });
    return;
  }
  
  const lines = directory.entries.map(entry => {
    const tierEmoji = entry.tier === 'naib' ? '👑' : '⚔️';
    const badges = entry.badges.slice(0, 3).map(b => getBadgeDisplay(b)).join('');
    return `${tierEmoji} **${entry.nym}** ${badges} — Activity: ${entry.activityScore.toFixed(1)}`;
  });
  
  const embed = new EmbedBuilder()
    .setTitle('📖 Community Directory')
    .setDescription(lines.join('\n'))
    .setColor(0x9945FF)
    .setFooter({ text: `Showing ${directory.entries.length} of ${directory.total} members` });
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleSetNym(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  
  const nym = interaction.options.getString('nym', true);
  
  try {
    await callApi('/api/profile/nym', {
      method: 'PUT',
      body: JSON.stringify({
        platform: 'discord',
        platformId: interaction.user.id,
        nym,
      }),
    });
    
    await interaction.editReply({
      content: `✅ Your nym has been set to **${nym}**!`,
    });
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ Failed to set nym: ${error.message}`,
    });
  }
}

async function handleBadges(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const badges = await callApi<{
      earned: Array<{ type: string; earnedAt: string; description: string }>;
      available: Array<{ type: string; description: string; requirement: string }>;
    }>(`/api/profile/badges/discord/${interaction.user.id}`);
    
    const earnedList = badges.earned.length > 0
      ? badges.earned.map(b => `${getBadgeDisplay(b.type)} **${formatBadgeName(b.type)}**\n└ ${b.description}`).join('\n\n')
      : '*No badges earned yet*';
    
    const availableList = badges.available.slice(0, 5)
      .map(b => `${getBadgeDisplay(b.type)} **${formatBadgeName(b.type)}**\n└ ${b.requirement}`)
      .join('\n\n');
    
    const embed = new EmbedBuilder()
      .setTitle('🏅 Your Badges')
      .setColor(0x9945FF)
      .addFields(
        { name: `Earned (${badges.earned.length})`, value: earnedList, inline: false },
        { name: 'Available to Earn', value: availableList || '*All badges earned!*', inline: false }
      );
    
    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({
      content: '❌ Unable to fetch badges. Make sure you\'ve verified with `/verify`.',
    });
  }
}

async function handleHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('❓ Sietch Help')
    .setColor(0x9945FF)
    .setDescription(
      'Welcome to the Sietch! Here\'s what you can do:'
    )
    .addFields(
      { 
        name: '🔐 Getting Started', 
        value: '`/verify` — Connect your wallet to join\n`/setnym` — Set your display name',
        inline: false 
      },
      { 
        name: '📊 Your Status', 
        value: '`/profile` — View your or others\' profile\n`/rank` — Check your conviction score\n`/badges` — View earned and available badges',
        inline: false 
      },
      { 
        name: '🏆 Community', 
        value: '`/leaderboard` — Top holders\n`/directory` — Search members',
        inline: false 
      },
      {
        name: 'Tiers',
        value: '👑 **Naib** — Top 7 by conviction\n⚔️ **Fedaykin** — Ranks 8-69',
        inline: false,
      }
    )
    .setFooter({ text: 'Roles sync across Discord & Telegram' });
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// =============================================================================
// BUTTON HANDLERS
// =============================================================================

async function handleButton(interaction: ButtonInteraction) {
  const [action, ...params] = interaction.customId.split(':');
  
  if (action === 'verify_check') {
    await interaction.deferUpdate();
    
    const sessionId = params[0];
    
    try {
      const result = await callApi<{ verified: boolean; tier?: string; rank?: number }>(
        `/api/identity/session/${sessionId}/status`
      );
      
      if (result.verified) {
        const tierEmoji = result.tier === 'naib' ? '👑' : result.tier === 'fedaykin' ? '⚔️' : '✅';
        
        await interaction.editReply({
          content: `${tierEmoji} **Verification Complete!**\n\nWelcome to the ${result.tier || 'community'}! ${result.rank ? `You are rank #${result.rank}.` : ''}`,
          embeds: [],
          components: [],
        });
        
        // Sync roles
        if (result.tier && interaction.member) {
          await roleManager.grantRoles(interaction.member as any, result.tier as 'naib' | 'fedaykin');
        }
      } else {
        await interaction.followUp({
          content: '⏳ Verification not complete yet. Please connect your wallet using the link above.',
          ephemeral: true,
        });
      }
    } catch (error) {
      await interaction.followUp({
        content: '❌ Session expired. Please run `/verify` again.',
        ephemeral: true,
      });
    }
  }
}

// =============================================================================
// MODAL HANDLERS
// =============================================================================

async function handleModal(interaction: ModalSubmitInteraction) {
  // Handle any modal submissions here
}

// =============================================================================
// HELPERS
// =============================================================================

function getBadgeDisplay(badgeType: string): string {
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

function formatBadgeName(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================================================
// STARTUP
// =============================================================================

async function deployCommands() {
  const rest = new REST().setToken(config.token);
  
  logger.info('Deploying slash commands...');
  
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  );
  
  logger.info('Slash commands deployed');
}

async function start() {
  // Validate config
  if (!config.token) throw new Error('DISCORD_BOT_TOKEN required');
  if (!config.clientId) throw new Error('DISCORD_CLIENT_ID required');
  if (!config.guildId) throw new Error('DISCORD_GUILD_ID required');
  
  // Deploy commands
  await deployCommands();
  
  // Login
  await client.login(config.token);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    client.destroy();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    client.destroy();
    process.exit(0);
  });
}

start().catch((error) => {
  logger.fatal({ error }, 'Failed to start Discord bot');
  process.exit(1);
});

export { client };

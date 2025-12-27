/**
 * Discord Role Manager Service
 * 
 * Handles automated role management and private 'Stillsuit' channels.
 * Uses discord.js for all Discord interactions.
 */

import {
  Client,
  GatewayIntentBits,
  Guild,
  GuildMember,
  Role,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { TierName, TierDefinition, ConvictionConfig } from '@sietch/shared/types';

// =============================================================================
// TYPES
// =============================================================================

interface DiscordRoleManagerConfig {
  botToken: string;
  clientId: string;
  guildId: string;
  convictionConfig: ConvictionConfig;
}

interface RoleMapping {
  tierId: TierName;
  roleId: string;
  roleName: string;
}

interface ChannelMapping {
  name: string;
  channelId: string;
  tier: TierName;
}

// =============================================================================
// DISCORD ROLE MANAGER
// =============================================================================

/**
 * Discord Role Manager
 * 
 * Manages:
 * - Tier role assignment (Naib, Fedaykin)
 * - Achievement role assignment (based on badges)
 * - Private channel access (Stillsuits)
 * - Role syncing on conviction changes
 */
export class DiscordRoleManager {
  private client: Client;
  private config: DiscordRoleManagerConfig;
  private guild: Guild | null = null;
  private roleMapping: Map<TierName, string> = new Map();
  private ready: boolean = false;

  constructor(config: DiscordRoleManagerConfig) {
    this.config = config;
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.setupEventHandlers();
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  /**
   * Start the Discord client
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('ready', async () => {
        console.log(`Discord bot logged in as ${this.client.user?.tag}`);
        
        try {
          // Fetch the guild
          this.guild = await this.client.guilds.fetch(this.config.guildId);
          
          // Initialize role mappings
          await this.initializeRoleMappings();
          
          // Register slash commands
          await this.registerSlashCommands();
          
          this.ready = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.client.login(this.config.botToken).catch(reject);
    });
  }

  /**
   * Stop the Discord client
   */
  async stop(): Promise<void> {
    this.client.destroy();
  }

  private async initializeRoleMappings(): Promise<void> {
    if (!this.guild) return;

    for (const [tierName, tierDef] of Object.entries(this.config.convictionConfig.tiers)) {
      const roleId = this.resolveEnvVar(tierDef.discordRoleId);
      if (roleId) {
        this.roleMapping.set(tierName as TierName, roleId);
      }
    }
  }

  private resolveEnvVar(value: string): string {
    if (value.startsWith('${') && value.endsWith('}')) {
      const envKey = value.slice(2, -1);
      return process.env[envKey] || '';
    }
    return value;
  }

  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    this.client.on('guildMemberRemove', async (member) => {
      // Handle member leaving - could emit event for cleanup
      console.log(`Member left: ${member.id}`);
    });
  }

  // ---------------------------------------------------------------------------
  // ROLE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Grant tier roles to a user
   */
  async grantRoles(userId: string, tier: TierName): Promise<string[]> {
    if (!this.guild || !this.ready) {
      throw new Error('Discord bot not ready');
    }

    try {
      const member = await this.guild.members.fetch(userId);
      const grantedRoles: string[] = [];

      // Remove any existing tier roles first
      await this.revokeAllTierRoles(userId);

      if (tier === 'none') {
        return [];
      }

      // Grant the new tier role
      const roleId = this.roleMapping.get(tier);
      if (roleId) {
        const role = await this.guild.roles.fetch(roleId);
        if (role) {
          await member.roles.add(role);
          grantedRoles.push(role.name);
        }
      }

      return grantedRoles;
    } catch (error) {
      console.error(`Failed to grant roles to ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Revoke all tier roles from a user
   */
  async revokeAllTierRoles(userId: string): Promise<void> {
    if (!this.guild || !this.ready) return;

    try {
      const member = await this.guild.members.fetch(userId);
      
      for (const roleId of this.roleMapping.values()) {
        const role = await this.guild.roles.fetch(roleId);
        if (role && member.roles.cache.has(roleId)) {
          await member.roles.remove(role);
        }
      }
    } catch (error) {
      console.error(`Failed to revoke roles from ${userId}:`, error);
    }
  }

  /**
   * Grant an achievement role (based on badges)
   */
  async grantAchievementRole(userId: string, roleName: string): Promise<void> {
    if (!this.guild || !this.ready) return;

    try {
      const member = await this.guild.members.fetch(userId);
      const role = this.guild.roles.cache.find(r => r.name === roleName);
      
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }
    } catch (error) {
      console.error(`Failed to grant achievement role ${roleName} to ${userId}:`, error);
    }
  }

  /**
   * Get user's current tier based on roles
   */
  async getUserTier(userId: string): Promise<TierName> {
    if (!this.guild || !this.ready) return 'none';

    try {
      const member = await this.guild.members.fetch(userId);
      
      for (const [tier, roleId] of this.roleMapping) {
        if (member.roles.cache.has(roleId)) {
          return tier;
        }
      }
      
      return 'none';
    } catch (error) {
      return 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // CHANNEL MANAGEMENT (STILLSUITS)
  // ---------------------------------------------------------------------------

  /**
   * Create or get a private Stillsuit channel for a tier
   */
  async ensureStillsuitChannel(
    channelName: string,
    tier: TierName
  ): Promise<TextChannel | null> {
    if (!this.guild || !this.ready) return null;

    const existing = this.guild.channels.cache.find(
      c => c.name === channelName && c.type === ChannelType.GuildText
    ) as TextChannel | undefined;

    if (existing) return existing;

    try {
      const tierRole = this.roleMapping.get(tier);
      
      const channel = await this.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: this.guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          ...(tierRole ? [{
            id: tierRole,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          }] : []),
        ],
      });

      return channel as TextChannel;
    } catch (error) {
      console.error(`Failed to create channel ${channelName}:`, error);
      return null;
    }
  }

  /**
   * Send a message to a specific channel
   */
  async sendChannelMessage(channelId: string, content: string): Promise<void> {
    if (!this.guild || !this.ready) return;

    try {
      const channel = await this.guild.channels.fetch(channelId);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send(content);
      }
    } catch (error) {
      console.error(`Failed to send message to channel ${channelId}:`, error);
    }
  }

  /**
   * Send a DM to a user
   */
  async sendDM(userId: string, content: string): Promise<boolean> {
    try {
      const user = await this.client.users.fetch(userId);
      await user.send(content);
      return true;
    } catch (error) {
      console.error(`Failed to send DM to ${userId}:`, error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // ONBOARDING
  // ---------------------------------------------------------------------------

  /**
   * Start DM onboarding flow for a new member
   */
  async startDMOnboarding(
    userId: string,
    verificationUrl: string
  ): Promise<void> {
    const message = `
**Welcome to Sietch!** 🏜️

To access the community, you need to verify your wallet and prove your conviction.

**Step 1:** Click the link below to verify your wallet:
${verificationUrl}

**Step 2:** Once verified, you'll automatically receive your role based on your conviction metrics.

If you have any questions, visit #support in the server.

*"The mystery of life isn't a problem to solve, but a reality to experience."* - Frank Herbert
    `.trim();

    await this.sendDM(userId, message);
  }

  /**
   * Send welcome message after successful verification
   */
  async sendWelcomeMessage(userId: string, tier: TierName, rank: number): Promise<void> {
    const tierMessages: Record<TierName, string> = {
      naib: `You have been granted **Naib** status (Rank #${rank}). Welcome to the Council! 👑`,
      fedaykin: `You have been granted **Fedaykin** status (Rank #${rank}). Welcome, warrior! ⚔️`,
      none: 'Your conviction was evaluated but you do not currently meet the requirements.',
    };

    await this.sendDM(userId, tierMessages[tier]);
  }

  // ---------------------------------------------------------------------------
  // SLASH COMMANDS
  // ---------------------------------------------------------------------------

  private async registerSlashCommands(): Promise<void> {
    const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
      {
        name: 'verify',
        description: 'Start wallet verification process',
      },
      {
        name: 'profile',
        description: 'View your Sietch profile',
      },
      {
        name: 'rank',
        description: 'Check your current conviction rank',
      },
      {
        name: 'directory',
        description: 'Browse the member directory',
      },
    ];

    const rest = new REST({ version: '10' }).setToken(this.config.botToken);

    try {
      await rest.put(
        Routes.applicationGuildCommands(this.config.clientId, this.config.guildId),
        { body: commands }
      );
      console.log('Discord slash commands registered');
    } catch (error) {
      console.error('Failed to register slash commands:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // GETTERS
  // ---------------------------------------------------------------------------

  get isReady(): boolean {
    return this.ready;
  }

  get botUserId(): string | null {
    return this.client.user?.id || null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { DiscordRoleManagerConfig, RoleMapping, ChannelMapping };

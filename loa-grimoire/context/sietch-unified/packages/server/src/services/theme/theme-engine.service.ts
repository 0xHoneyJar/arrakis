/**
 * =============================================================================
 * SIETCH UNIFIED - THEME ENGINE SERVICE
 * =============================================================================
 * 
 * Abstracts all branding, naming, and UI text from core business logic.
 * Reads from config/community-theme.yaml to provide themed content.
 * 
 * ENTERPRISE STANDARD: Allows white-label deployments without code changes.
 * 
 * @module services/theme/theme-engine.service
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// =============================================================================
// TYPES
// =============================================================================

export interface ThemeTier {
  name: string;
  emoji: string;
  description: string;
}

export interface ThemeEmbed {
  title: string;
  color: number;
}

export interface ThemeConfig {
  metadata: {
    name: string;
    description: string;
    author: string;
  };
  branding: {
    product_name: string;
    tagline: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
  };
  tiers: {
    none: ThemeTier;
    low: ThemeTier;
    high: ThemeTier;
  };
  features: {
    conviction_score: string;
    member_directory: string;
    private_channel: string;
    badge: string;
    boost: string;
  };
  messages: {
    welcome: string;
    verification_start: string;
    verification_complete: string;
    verification_failed: string;
    tier_upgrade: string;
    tier_downgrade: string;
    boost_thanks: string;
    badge_display: string;
  };
  embeds: {
    verification: ThemeEmbed;
    leaderboard: ThemeEmbed;
    profile: ThemeEmbed;
  };
}

export type TierLevel = 'none' | 'low' | 'high';
export type EmbedType = 'verification' | 'leaderboard' | 'profile';
export type FeatureType = keyof ThemeConfig['features'];
export type MessageType = keyof ThemeConfig['messages'];

// =============================================================================
// THEME ENGINE SERVICE
// =============================================================================

export class ThemeEngineService {
  private themes: Record<string, ThemeConfig> = {};
  private activeTheme: string = 'sietch';
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'community-theme.yaml');
    this.loadConfig();
  }

  /**
   * Load theme configuration from YAML file.
   */
  private loadConfig(): void {
    try {
      const fileContents = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.parse(fileContents);
      
      this.activeTheme = config.active_theme || 'sietch';
      this.themes = config.themes || {};
      
      console.log(`✅ Theme Engine loaded: ${this.activeTheme}`);
    } catch (error) {
      console.warn('⚠️ Failed to load theme config, using defaults:', error);
      this.loadDefaultTheme();
    }
  }

  /**
   * Load default theme if config file is missing.
   */
  private loadDefaultTheme(): void {
    this.activeTheme = 'minimal';
    this.themes = {
      minimal: {
        metadata: {
          name: 'Minimal',
          description: 'Default fallback theme',
          author: 'System',
        },
        branding: {
          product_name: 'Community Bot',
          tagline: 'Community management',
          logo_url: null,
          primary_color: '#374151',
          secondary_color: '#111827',
        },
        tiers: {
          none: { name: 'Unverified', emoji: '○', description: 'Not verified' },
          low: { name: 'Member', emoji: '●', description: 'Verified member' },
          high: { name: 'VIP', emoji: '◆', description: 'VIP member' },
        },
        features: {
          conviction_score: 'Score',
          member_directory: 'Directory',
          private_channel: 'Private',
          badge: 'Badge',
          boost: 'Boost',
        },
        messages: {
          welcome: 'Welcome, {username}.',
          verification_start: 'Verifying...',
          verification_complete: 'Verified.',
          verification_failed: 'Failed.',
          tier_upgrade: 'Status: {tier}',
          tier_downgrade: 'Status: {tier}',
          boost_thanks: 'Thanks for boosting.',
          badge_display: '{score} | {tier}',
        },
        embeds: {
          verification: { title: 'Verification', color: 0x374151 },
          leaderboard: { title: 'Leaderboard', color: 0x374151 },
          profile: { title: 'Profile', color: 0x374151 },
        },
      },
    };
  }

  /**
   * Get current theme configuration.
   */
  getTheme(): ThemeConfig {
    return this.themes[this.activeTheme] || this.themes.minimal;
  }

  /**
   * Get active theme name.
   */
  getActiveThemeName(): string {
    return this.activeTheme;
  }

  /**
   * Get all available theme names.
   */
  getAvailableThemes(): string[] {
    return Object.keys(this.themes);
  }

  /**
   * Switch to a different theme at runtime.
   */
  setActiveTheme(themeName: string): boolean {
    if (this.themes[themeName]) {
      this.activeTheme = themeName;
      console.log(`✅ Theme switched to: ${themeName}`);
      return true;
    }
    console.warn(`⚠️ Theme not found: ${themeName}`);
    return false;
  }

  /**
   * Reload configuration from disk.
   */
  reloadConfig(): void {
    this.loadConfig();
  }

  // ===========================================================================
  // CONVENIENCE ACCESSORS
  // ===========================================================================

  /**
   * Get product name.
   */
  getProductName(): string {
    return this.getTheme().branding.product_name;
  }

  /**
   * Get tagline.
   */
  getTagline(): string {
    return this.getTheme().branding.tagline;
  }

  /**
   * Get primary color (as hex number for Discord embeds).
   */
  getPrimaryColor(): number {
    const hex = this.getTheme().branding.primary_color.replace('#', '');
    return parseInt(hex, 16);
  }

  /**
   * Get tier configuration by level.
   */
  getTier(level: TierLevel): ThemeTier {
    return this.getTheme().tiers[level];
  }

  /**
   * Get tier name by level.
   */
  getTierName(level: TierLevel): string {
    return this.getTier(level).name;
  }

  /**
   * Get tier emoji by level.
   */
  getTierEmoji(level: TierLevel): string {
    return this.getTier(level).emoji;
  }

  /**
   * Get feature name (abstracted).
   */
  getFeatureName(feature: FeatureType): string {
    return this.getTheme().features[feature];
  }

  /**
   * Get embed configuration.
   */
  getEmbed(type: EmbedType): ThemeEmbed {
    return this.getTheme().embeds[type];
  }

  /**
   * Get formatted message with variable substitution.
   */
  getMessage(type: MessageType, variables?: Record<string, string>): string {
    let message = this.getTheme().messages[type];
    
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
    }
    
    return message;
  }

  // ===========================================================================
  // HELPER METHODS FOR COMMON PATTERNS
  // ===========================================================================

  /**
   * Format badge display text.
   */
  formatBadgeDisplay(score: number, tierLevel: TierLevel): string {
    const tierName = this.getTierName(tierLevel);
    return this.getMessage('badge_display', {
      score: String(score),
      tier: tierName,
    });
  }

  /**
   * Get welcome message for user.
   */
  getWelcomeMessage(username: string): string {
    return this.getMessage('welcome', { username });
  }

  /**
   * Get tier change message.
   */
  getTierChangeMessage(newTier: TierLevel, isUpgrade: boolean): string {
    const tierName = this.getTierName(newTier);
    const messageType = isUpgrade ? 'tier_upgrade' : 'tier_downgrade';
    return this.getMessage(messageType, { tier: tierName });
  }

  /**
   * Build Discord embed object.
   */
  buildEmbed(type: EmbedType, options?: {
    description?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: string;
    thumbnail?: string;
  }): {
    title: string;
    color: number;
    description?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string };
    thumbnail?: { url: string };
  } {
    const embedConfig = this.getEmbed(type);
    
    return {
      title: embedConfig.title,
      color: embedConfig.color,
      ...(options?.description && { description: options.description }),
      ...(options?.fields && { fields: options.fields }),
      ...(options?.footer && { footer: { text: options.footer } }),
      ...(options?.thumbnail && { thumbnail: { url: options.thumbnail } }),
    };
  }

  /**
   * Map internal tier level to themed tier name.
   * Handles conversion from score-based tiers to theme tiers.
   */
  mapConvictionTierToTheme(internalTier: string): TierLevel {
    // Map internal tier names to theme tier levels
    const mapping: Record<string, TierLevel> = {
      'none': 'none',
      'naib': 'low',
      'fedaykin': 'high',
      // Support generic names too
      'low': 'low',
      'medium': 'low',
      'high': 'high',
      'guest': 'none',
      'member': 'low',
      'vip': 'high',
    };
    
    return mapping[internalTier.toLowerCase()] || 'none';
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let themeEngineInstance: ThemeEngineService | null = null;

export function getThemeEngine(configPath?: string): ThemeEngineService {
  if (!themeEngineInstance) {
    themeEngineInstance = new ThemeEngineService(configPath);
  }
  return themeEngineInstance;
}

// =============================================================================
// EXPORTS FOR DIRECT ACCESS
// =============================================================================

export const theme = {
  get: () => getThemeEngine(),
  product: () => getThemeEngine().getProductName(),
  tier: (level: TierLevel) => getThemeEngine().getTier(level),
  feature: (type: FeatureType) => getThemeEngine().getFeatureName(type),
  message: (type: MessageType, vars?: Record<string, string>) => 
    getThemeEngine().getMessage(type, vars),
  embed: (type: EmbedType) => getThemeEngine().getEmbed(type),
};

/**
 * Theme Merger
 *
 * Sprint 100: Theme System
 *
 * Merges theme configuration with user overrides.
 * User config always takes precedence over theme defaults.
 *
 * @see SDD §6.0 Theme System
 * @module packages/cli/commands/server/themes/ThemeMerger
 */

import type {
  LoadedTheme,
  ThemeRole,
  ThemeCategory,
  ThemeChannel,
  ThemeServer,
} from './ThemeSchema.js';
import type {
  RoleConfig,
  CategoryConfig,
  ChannelConfig,
  ServerMetadata,
  GaibConfigFile,
  PermissionFlag,
  ChannelPermissions,
} from '../iac/schemas.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of merging a theme with user config
 */
export interface MergedConfig {
  /** Merged server metadata */
  server?: ServerMetadata;

  /** Merged roles */
  roles: RoleConfig[];

  /** Merged categories */
  categories: CategoryConfig[];

  /** Merged channels */
  channels: ChannelConfig[];
}

/**
 * Options for theme merging
 */
export interface MergeOptions {
  /**
   * Whether to include theme-only items not in user config
   * Default: true
   */
  includeThemeDefaults?: boolean;

  /**
   * Whether to deep merge item properties
   * Default: true
   */
  deepMerge?: boolean;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert theme permissions to typed ChannelPermissions
 * Themes use string[], IaC config uses PermissionFlag[]
 */
function convertThemePermissions(
  perms: Record<string, { allow?: string[]; deny?: string[] }> | undefined
): ChannelPermissions | undefined {
  if (!perms) return undefined;

  const result: ChannelPermissions = {};
  for (const [role, overwrite] of Object.entries(perms)) {
    result[role] = {
      allow: (overwrite.allow ?? []) as PermissionFlag[],
      deny: (overwrite.deny ?? []) as PermissionFlag[],
    };
  }
  return result;
}

/**
 * Convert ThemeRole to RoleConfig
 */
function themeRoleToConfig(role: ThemeRole): RoleConfig {
  return {
    name: role.name,
    color: role.color,
    hoist: role.hoist ?? false,
    mentionable: role.mentionable ?? false,
    // Theme permissions are string[], IaC expects PermissionFlag[]
    permissions: (role.permissions ?? []) as PermissionFlag[],
    position: role.position,
  };
}

/**
 * Convert ThemeCategory to CategoryConfig
 */
function themeCategoryToConfig(cat: ThemeCategory): CategoryConfig {
  return {
    name: cat.name,
    position: cat.position,
    permissions: convertThemePermissions(cat.permissions),
  };
}

/**
 * Convert ThemeChannel to ChannelConfig
 */
function themeChannelToConfig(chan: ThemeChannel): ChannelConfig {
  return {
    name: chan.name,
    type: chan.type ?? 'text',
    category: chan.category,
    topic: chan.topic,
    nsfw: chan.nsfw ?? false,
    slowmode: chan.slowmode ?? 0,
    position: chan.position,
    permissions: convertThemePermissions(chan.permissions),
    bitrate: chan.bitrate,
    userLimit: chan.userLimit,
  };
}

/**
 * Convert ThemeServer to ServerMetadata
 */
function themeServerToMetadata(server: ThemeServer): ServerMetadata {
  return {
    name: server.name,
    description: server.description,
  };
}

// ============================================================================
// Merge Functions
// ============================================================================

/**
 * Deep merge two objects, with source taking precedence
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Merge roles by name
 * User roles override theme roles with the same name
 */
function mergeRoles(
  themeRoles: ThemeRole[],
  userRoles: RoleConfig[],
  options: MergeOptions
): RoleConfig[] {
  const result: RoleConfig[] = [];
  const userRoleMap = new Map(
    userRoles.map((r) => [r.name.toLowerCase(), r])
  );
  const seen = new Set<string>();

  // Start with theme roles, applying user overrides
  if (options.includeThemeDefaults !== false) {
    for (const themeRole of themeRoles) {
      const key = themeRole.name.toLowerCase();
      const userRole = userRoleMap.get(key);

      if (userRole) {
        // User override exists - merge or replace
        if (options.deepMerge !== false) {
          const base = themeRoleToConfig(themeRole);
          result.push(deepMerge(base, userRole));
        } else {
          result.push(userRole);
        }
        seen.add(key);
      } else {
        // Theme-only role
        result.push(themeRoleToConfig(themeRole));
      }
    }
  }

  // Add user-only roles
  for (const userRole of userRoles) {
    const key = userRole.name.toLowerCase();
    if (!seen.has(key)) {
      result.push(userRole);
    }
  }

  return result;
}

/**
 * Merge categories by name
 * User categories override theme categories with the same name
 */
function mergeCategories(
  themeCategories: ThemeCategory[],
  userCategories: CategoryConfig[],
  options: MergeOptions
): CategoryConfig[] {
  const result: CategoryConfig[] = [];
  const userCatMap = new Map(
    userCategories.map((c) => [c.name.toLowerCase(), c])
  );
  const seen = new Set<string>();

  // Start with theme categories, applying user overrides
  if (options.includeThemeDefaults !== false) {
    for (const themeCat of themeCategories) {
      const key = themeCat.name.toLowerCase();
      const userCat = userCatMap.get(key);

      if (userCat) {
        // User override exists - merge or replace
        if (options.deepMerge !== false) {
          const base = themeCategoryToConfig(themeCat);
          result.push(deepMerge(base, userCat));
        } else {
          result.push(userCat);
        }
        seen.add(key);
      } else {
        // Theme-only category
        result.push(themeCategoryToConfig(themeCat));
      }
    }
  }

  // Add user-only categories
  for (const userCat of userCategories) {
    const key = userCat.name.toLowerCase();
    if (!seen.has(key)) {
      result.push(userCat);
    }
  }

  return result;
}

/**
 * Merge channels by name
 * User channels override theme channels with the same name
 */
function mergeChannels(
  themeChannels: ThemeChannel[],
  userChannels: ChannelConfig[],
  options: MergeOptions
): ChannelConfig[] {
  const result: ChannelConfig[] = [];
  const userChanMap = new Map(
    userChannels.map((c) => [c.name.toLowerCase(), c])
  );
  const seen = new Set<string>();

  // Start with theme channels, applying user overrides
  if (options.includeThemeDefaults !== false) {
    for (const themeChan of themeChannels) {
      const key = themeChan.name.toLowerCase();
      const userChan = userChanMap.get(key);

      if (userChan) {
        // User override exists - merge or replace
        if (options.deepMerge !== false) {
          const base = themeChannelToConfig(themeChan);
          result.push(deepMerge(base, userChan));
        } else {
          result.push(userChan);
        }
        seen.add(key);
      } else {
        // Theme-only channel
        result.push(themeChannelToConfig(themeChan));
      }
    }
  }

  // Add user-only channels
  for (const userChan of userChannels) {
    const key = userChan.name.toLowerCase();
    if (!seen.has(key)) {
      result.push(userChan);
    }
  }

  return result;
}

/**
 * Merge server metadata
 * User metadata takes precedence
 */
function mergeServer(
  themeServer: ThemeServer | undefined,
  userServer: ServerMetadata | undefined,
  options: MergeOptions
): ServerMetadata | undefined {
  if (!themeServer && !userServer) {
    return undefined;
  }

  if (!themeServer) {
    return userServer;
  }

  if (!userServer) {
    return themeServerToMetadata(themeServer);
  }

  // Merge with user taking precedence
  if (options.deepMerge !== false) {
    return deepMerge(themeServerToMetadata(themeServer), userServer);
  }

  return userServer;
}

// ============================================================================
// Main Merger Class
// ============================================================================

/**
 * Theme merger - combines theme config with user overrides
 */
export class ThemeMerger {
  private defaultOptions: MergeOptions;

  constructor(options?: MergeOptions) {
    this.defaultOptions = {
      includeThemeDefaults: true,
      deepMerge: true,
      ...options,
    };
  }

  /**
   * Merge a loaded theme with user configuration
   *
   * @param theme - The loaded theme
   * @param userConfig - The user's gaib.yaml configuration
   * @param options - Merge options (overrides constructor defaults)
   * @returns Merged configuration
   */
  merge(
    theme: LoadedTheme,
    userConfig: GaibConfigFile,
    options?: MergeOptions
  ): MergedConfig {
    const opts = { ...this.defaultOptions, ...options };

    return {
      server: mergeServer(theme.server, userConfig.server, opts),
      roles: mergeRoles(theme.roles, userConfig.roles ?? [], opts),
      categories: mergeCategories(theme.categories, userConfig.categories ?? [], opts),
      channels: mergeChannels(theme.channels, userConfig.channels ?? [], opts),
    };
  }

  /**
   * Merge multiple themes in order (later themes override earlier)
   *
   * @param themes - Array of loaded themes (earlier themes are base)
   * @param userConfig - The user's gaib.yaml configuration
   * @param options - Merge options
   * @returns Merged configuration
   */
  mergeMultiple(
    themes: LoadedTheme[],
    userConfig: GaibConfigFile,
    options?: MergeOptions
  ): MergedConfig {
    if (themes.length === 0) {
      return {
        server: userConfig.server,
        roles: userConfig.roles ?? [],
        categories: userConfig.categories ?? [],
        channels: userConfig.channels ?? [],
      };
    }

    // Merge themes together first (later overrides earlier)
    let mergedTheme: LoadedTheme = themes[0];

    for (let i = 1; i < themes.length; i++) {
      mergedTheme = this.mergeThemes(mergedTheme, themes[i]);
    }

    // Then merge with user config
    return this.merge(mergedTheme, userConfig, options);
  }

  /**
   * Merge two themes together (later theme takes precedence)
   */
  private mergeThemes(base: LoadedTheme, override: LoadedTheme): LoadedTheme {
    const opts = this.defaultOptions;

    // Merge roles
    const roleMap = new Map(base.roles.map((r) => [r.name.toLowerCase(), r]));
    for (const role of override.roles) {
      const key = role.name.toLowerCase();
      const existing = roleMap.get(key);
      if (existing && opts.deepMerge !== false) {
        roleMap.set(key, deepMerge(existing, role));
      } else {
        roleMap.set(key, role);
      }
    }

    // Merge categories
    const catMap = new Map(base.categories.map((c) => [c.name.toLowerCase(), c]));
    for (const cat of override.categories) {
      const key = cat.name.toLowerCase();
      const existing = catMap.get(key);
      if (existing && opts.deepMerge !== false) {
        catMap.set(key, deepMerge(existing, cat));
      } else {
        catMap.set(key, cat);
      }
    }

    // Merge channels
    const chanMap = new Map(base.channels.map((c) => [c.name.toLowerCase(), c]));
    for (const chan of override.channels) {
      const key = chan.name.toLowerCase();
      const existing = chanMap.get(key);
      if (existing && opts.deepMerge !== false) {
        chanMap.set(key, deepMerge(existing, chan));
      } else {
        chanMap.set(key, chan);
      }
    }

    // Merge server
    let server = base.server;
    if (override.server) {
      if (server && opts.deepMerge !== false) {
        server = deepMerge(server, override.server);
      } else {
        server = override.server;
      }
    }

    return {
      manifest: override.manifest, // Use override manifest
      server,
      roles: Array.from(roleMap.values()),
      categories: Array.from(catMap.values()),
      channels: Array.from(chanMap.values()),
      sourcePath: override.sourcePath,
    };
  }
}

/**
 * Create a theme merger with default options
 */
export function createThemeMerger(options?: MergeOptions): ThemeMerger {
  return new ThemeMerger(options);
}

/**
 * Quick merge helper - merges a theme with user config using defaults
 */
export function mergeThemeWithConfig(
  theme: LoadedTheme,
  userConfig: GaibConfigFile
): MergedConfig {
  return new ThemeMerger().merge(theme, userConfig);
}

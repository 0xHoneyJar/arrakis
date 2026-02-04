/**
 * Theme Loader
 *
 * Sprint 100: Theme System
 *
 * Loads themes from the filesystem, resolves variables,
 * and returns fully loaded theme data.
 *
 * @see SDD §6.0 Theme System
 * @module packages/cli/commands/server/themes/ThemeLoader
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  ThemeManifestSchema,
  type ThemeManifest,
  type LoadedTheme,
  type ThemeRole,
  type ThemeCategory,
  type ThemeChannel,
  type ThemeServer,
  type ThemeVariable,
  validateVariables,
} from './ThemeSchema.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error codes for theme loading
 */
export enum ThemeErrorCode {
  THEME_NOT_FOUND = 'THEME_NOT_FOUND',
  MANIFEST_NOT_FOUND = 'MANIFEST_NOT_FOUND',
  MANIFEST_INVALID = 'MANIFEST_INVALID',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_INVALID = 'FILE_INVALID',
  VARIABLE_ERROR = 'VARIABLE_ERROR',
  CIRCULAR_EXTENDS = 'CIRCULAR_EXTENDS',
}

/**
 * Theme loading error
 */
export class ThemeError extends Error {
  constructor(
    message: string,
    public readonly code: ThemeErrorCode,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'ThemeError';
  }
}

// ============================================================================
// Theme Paths
// ============================================================================

/**
 * Get the default themes directory paths
 */
export function getThemePaths(): string[] {
  const paths: string[] = [];

  // Built-in themes (relative to package root: packages/cli/src/commands/server/themes -> arrakis/themes)
  // Go up 6 levels: themes/ -> server/ -> commands/ -> src/ -> cli/ -> packages/ -> arrakis/
  const builtinPath = path.resolve(__dirname, '../../../../../../themes');
  if (fs.existsSync(builtinPath)) {
    paths.push(builtinPath);
  }

  // Project-local themes
  const localPath = path.resolve(process.cwd(), 'themes');
  if (fs.existsSync(localPath)) {
    paths.push(localPath);
  }

  // User themes in home directory
  const homePath = process.env.HOME || process.env.USERPROFILE;
  if (homePath) {
    const userPath = path.join(homePath, '.gaib', 'themes');
    if (fs.existsSync(userPath)) {
      paths.push(userPath);
    }
  }

  return paths;
}

/**
 * Find a theme by name in the search paths
 */
export function findThemePath(name: string, searchPaths?: string[]): string | null {
  const paths = searchPaths ?? getThemePaths();

  for (const basePath of paths) {
    const themePath = path.join(basePath, name);
    const manifestPath = path.join(themePath, 'theme.yaml');

    if (fs.existsSync(manifestPath)) {
      return themePath;
    }
  }

  return null;
}

/**
 * List all available themes
 */
export function listThemes(searchPaths?: string[]): ThemeManifest[] {
  const paths = searchPaths ?? getThemePaths();
  const themes: ThemeManifest[] = [];
  const seen = new Set<string>();

  for (const basePath of paths) {
    if (!fs.existsSync(basePath)) continue;

    const entries = fs.readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (seen.has(entry.name)) continue;

      const manifestPath = path.join(basePath, entry.name, 'theme.yaml');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const raw = yaml.load(content);
        const result = ThemeManifestSchema.safeParse(raw);

        if (result.success) {
          themes.push(result.data);
          seen.add(entry.name);
        }
      } catch {
        // Skip invalid themes
      }
    }
  }

  return themes;
}

// ============================================================================
// Variable Interpolation
// ============================================================================

/**
 * Interpolate variables in a string
 * Supports ${variable} syntax
 */
export function interpolateString(
  template: string,
  variables: Record<string, string | number | boolean>
): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const value = variables[varName.trim()];
    if (value === undefined) {
      return match; // Keep original if variable not found
    }
    return String(value);
  });
}

/**
 * Recursively interpolate variables in an object
 */
export function interpolateObject<T>(
  obj: T,
  variables: Record<string, string | number | boolean>
): T {
  if (typeof obj === 'string') {
    return interpolateString(obj, variables) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, variables)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, variables);
    }
    return result as T;
  }

  return obj;
}

// ============================================================================
// Theme Loader
// ============================================================================

/**
 * Theme loader with caching
 */
export class ThemeLoader {
  private cache: Map<string, LoadedTheme> = new Map();
  private searchPaths: string[];

  constructor(searchPaths?: string[]) {
    this.searchPaths = searchPaths ?? getThemePaths();
  }

  /**
   * Load a theme by name
   */
  async load(
    name: string,
    variables: Record<string, string | number | boolean> = {}
  ): Promise<LoadedTheme> {
    // Check cache (with variables in key)
    const cacheKey = `${name}:${JSON.stringify(variables)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Find theme path
    const themePath = findThemePath(name, this.searchPaths);
    if (!themePath) {
      throw new ThemeError(
        `Theme "${name}" not found`,
        ThemeErrorCode.THEME_NOT_FOUND,
        [`Searched paths: ${this.searchPaths.join(', ')}`]
      );
    }

    // Load manifest
    const manifest = this.loadManifest(themePath);

    // Handle theme extension
    let baseTheme: LoadedTheme | undefined;
    if (manifest.extends) {
      baseTheme = await this.load(manifest.extends, variables);
    }

    // Merge variables with defaults
    const resolvedVars = this.resolveVariables(manifest.variables, variables);

    // Validate variables
    const validation = validateVariables(manifest.variables, resolvedVars);
    if (!validation.valid) {
      throw new ThemeError(
        `Invalid theme variables for "${name}"`,
        ThemeErrorCode.VARIABLE_ERROR,
        validation.errors
      );
    }

    // Load component files
    const server = this.loadServerFile(themePath, manifest, resolvedVars);
    const roles = this.loadRolesFile(themePath, manifest, resolvedVars, baseTheme?.roles);
    const categories = this.loadCategoriesFile(themePath, manifest, resolvedVars, baseTheme?.categories);
    const channels = this.loadChannelsFile(themePath, manifest, resolvedVars, baseTheme?.channels);

    const loaded: LoadedTheme = {
      manifest,
      server,
      roles,
      categories,
      channels,
      sourcePath: themePath,
    };

    // Cache result
    this.cache.set(cacheKey, loaded);

    return loaded;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Load and validate theme manifest
   */
  private loadManifest(themePath: string): ThemeManifest {
    const manifestPath = path.join(themePath, 'theme.yaml');

    if (!fs.existsSync(manifestPath)) {
      throw new ThemeError(
        `Theme manifest not found: ${manifestPath}`,
        ThemeErrorCode.MANIFEST_NOT_FOUND
      );
    }

    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const raw = yaml.load(content);
      const result = ThemeManifestSchema.safeParse(raw);

      if (!result.success) {
        throw new ThemeError(
          `Invalid theme manifest: ${manifestPath}`,
          ThemeErrorCode.MANIFEST_INVALID,
          result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof ThemeError) throw error;
      throw new ThemeError(
        `Failed to parse theme manifest: ${manifestPath}`,
        ThemeErrorCode.MANIFEST_INVALID,
        [String(error)]
      );
    }
  }

  /**
   * Resolve variables with defaults
   */
  private resolveVariables(
    definitions: Record<string, ThemeVariable>,
    provided: Record<string, string | number | boolean>
  ): Record<string, string | number | boolean> {
    const resolved: Record<string, string | number | boolean> = {};

    for (const [name, def] of Object.entries(definitions)) {
      if (name in provided) {
        resolved[name] = provided[name];
      } else if (def.default !== undefined) {
        resolved[name] = def.default;
      }
    }

    // Include any extra provided variables
    for (const [name, value] of Object.entries(provided)) {
      if (!(name in resolved)) {
        resolved[name] = value;
      }
    }

    return resolved;
  }

  /**
   * Load server configuration file
   */
  private loadServerFile(
    themePath: string,
    manifest: ThemeManifest,
    variables: Record<string, string | number | boolean>
  ): ThemeServer | undefined {
    const fileName = manifest.files?.server ?? 'server.yaml';
    const filePath = path.join(themePath, fileName);

    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const raw = yaml.load(content) as ThemeServer;
      return interpolateObject(raw, variables);
    } catch (error) {
      throw new ThemeError(
        `Failed to parse server file: ${filePath}`,
        ThemeErrorCode.FILE_INVALID,
        [String(error)]
      );
    }
  }

  /**
   * Load roles configuration file
   */
  private loadRolesFile(
    themePath: string,
    manifest: ThemeManifest,
    variables: Record<string, string | number | boolean>,
    baseRoles?: ThemeRole[]
  ): ThemeRole[] {
    const fileName = manifest.files?.roles ?? 'roles.yaml';
    const filePath = path.join(themePath, fileName);

    let roles: ThemeRole[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const raw = yaml.load(content);

        if (Array.isArray(raw)) {
          roles = interpolateObject(raw, variables) as ThemeRole[];
        } else if (raw && typeof raw === 'object' && 'roles' in raw) {
          roles = interpolateObject((raw as { roles: ThemeRole[] }).roles, variables);
        }
      } catch (error) {
        throw new ThemeError(
          `Failed to parse roles file: ${filePath}`,
          ThemeErrorCode.FILE_INVALID,
          [String(error)]
        );
      }
    }

    // Merge with base theme roles
    if (baseRoles && baseRoles.length > 0) {
      const roleMap = new Map(baseRoles.map((r) => [r.name.toLowerCase(), r]));
      for (const role of roles) {
        roleMap.set(role.name.toLowerCase(), role);
      }
      return Array.from(roleMap.values());
    }

    return roles;
  }

  /**
   * Load categories configuration file
   */
  private loadCategoriesFile(
    themePath: string,
    manifest: ThemeManifest,
    variables: Record<string, string | number | boolean>,
    baseCategories?: ThemeCategory[]
  ): ThemeCategory[] {
    // Categories can be in a separate file or in channels.yaml
    const fileName = manifest.files?.categories ?? 'channels.yaml';
    const filePath = path.join(themePath, fileName);

    let categories: ThemeCategory[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const raw = yaml.load(content);

        if (raw && typeof raw === 'object' && 'categories' in raw) {
          categories = interpolateObject(
            (raw as { categories: ThemeCategory[] }).categories,
            variables
          );
        }
      } catch (error) {
        throw new ThemeError(
          `Failed to parse categories from: ${filePath}`,
          ThemeErrorCode.FILE_INVALID,
          [String(error)]
        );
      }
    }

    // Merge with base theme categories
    if (baseCategories && baseCategories.length > 0) {
      const catMap = new Map(baseCategories.map((c) => [c.name.toLowerCase(), c]));
      for (const cat of categories) {
        catMap.set(cat.name.toLowerCase(), cat);
      }
      return Array.from(catMap.values());
    }

    return categories;
  }

  /**
   * Load channels configuration file
   */
  private loadChannelsFile(
    themePath: string,
    manifest: ThemeManifest,
    variables: Record<string, string | number | boolean>,
    baseChannels?: ThemeChannel[]
  ): ThemeChannel[] {
    const fileName = manifest.files?.channels ?? 'channels.yaml';
    const filePath = path.join(themePath, fileName);

    let channels: ThemeChannel[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const raw = yaml.load(content);

        if (Array.isArray(raw)) {
          channels = interpolateObject(raw, variables) as ThemeChannel[];
        } else if (raw && typeof raw === 'object' && 'channels' in raw) {
          channels = interpolateObject(
            (raw as { channels: ThemeChannel[] }).channels,
            variables
          );
        }
      } catch (error) {
        throw new ThemeError(
          `Failed to parse channels file: ${filePath}`,
          ThemeErrorCode.FILE_INVALID,
          [String(error)]
        );
      }
    }

    // Merge with base theme channels
    if (baseChannels && baseChannels.length > 0) {
      const chanMap = new Map(baseChannels.map((c) => [c.name.toLowerCase(), c]));
      for (const chan of channels) {
        chanMap.set(chan.name.toLowerCase(), chan);
      }
      return Array.from(chanMap.values());
    }

    return channels;
  }
}

/**
 * Create a theme loader with default paths
 */
export function createThemeLoader(): ThemeLoader {
  return new ThemeLoader();
}

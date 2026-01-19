/**
 * Theme System
 *
 * Sprint 100: Theme System
 *
 * Re-exports all theme-related modules for easy importing.
 *
 * @module packages/cli/commands/server/themes
 */

// Schema definitions and validation
export {
  ThemeVariableType,
  ThemeVariableSchema,
  ThemeFilesSchema,
  ThemeManifestSchema,
  ThemeServerSchema,
  ThemeRoleSchema,
  ThemeCategorySchema,
  ThemeChannelSchema,
  ThemeReferenceSchema,
  validateThemeManifest,
  validateVariables,
  type ThemeVariable,
  type ThemeFiles,
  type ThemeManifest,
  type ThemeServer,
  type ThemeRole,
  type ThemeCategory,
  type ThemeChannel,
  type ThemeReference,
  type LoadedTheme,
} from './ThemeSchema.js';

// Theme loading
export {
  ThemeLoader,
  ThemeError,
  ThemeErrorCode,
  createThemeLoader,
  getThemePaths,
  findThemePath,
  listThemes,
  interpolateString,
  interpolateObject,
} from './ThemeLoader.js';

// Theme merging
export {
  ThemeMerger,
  createThemeMerger,
  mergeThemeWithConfig,
  type MergedConfig,
  type MergeOptions,
} from './ThemeMerger.js';

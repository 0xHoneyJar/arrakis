/**
 * Theme Manifest Schema
 *
 * Sprint 100: Theme System
 *
 * Zod schemas for validating theme.yaml manifest files.
 * Defines the structure for theme metadata, variables, and component files.
 *
 * @see SDD §6.0 Theme System
 * @module packages/cli/commands/server/themes/ThemeSchema
 */

import { z } from 'zod';

// ============================================================================
// Theme Variable Definitions
// ============================================================================

/**
 * Supported variable types in theme manifests
 */
export const ThemeVariableType = z.enum(['string', 'color', 'number', 'boolean']);

export type ThemeVariableType = z.infer<typeof ThemeVariableType>;

/**
 * Theme variable definition
 */
export const ThemeVariableSchema = z.object({
  /** Variable type */
  type: ThemeVariableType,

  /** Human-readable description */
  description: z.string().optional(),

  /** Default value (type should match variable type) */
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),

  /** Whether this variable is required */
  required: z.boolean().optional().default(false),

  /** Validation pattern for string types */
  pattern: z.string().optional(),

  /** Minimum value for number types */
  min: z.number().optional(),

  /** Maximum value for number types */
  max: z.number().optional(),
});

export type ThemeVariable = z.infer<typeof ThemeVariableSchema>;

// ============================================================================
// Theme Files Section
// ============================================================================

/**
 * Theme files section - references to component YAML files
 */
export const ThemeFilesSchema = z.object({
  /** Server configuration file */
  server: z.string().optional().default('server.yaml'),

  /** Roles configuration file */
  roles: z.string().optional().default('roles.yaml'),

  /** Channels configuration file */
  channels: z.string().optional().default('channels.yaml'),

  /** Categories configuration file (can also be in channels.yaml) */
  categories: z.string().optional(),
});

export type ThemeFiles = z.infer<typeof ThemeFilesSchema>;

// ============================================================================
// Theme Manifest Schema
// ============================================================================

/**
 * Complete theme manifest schema (theme.yaml)
 */
export const ThemeManifestSchema = z.object({
  /** Theme name (unique identifier) */
  name: z
    .string()
    .min(1, 'Theme name cannot be empty')
    .max(50, 'Theme name must be 50 characters or less')
    .regex(
      /^[a-z0-9-]+$/,
      'Theme name must be lowercase and contain only letters, numbers, and hyphens'
    ),

  /** Theme version (semver) */
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)'),

  /** Human-readable description */
  description: z.string().max(500).optional(),

  /** Theme author */
  author: z.string().max(100).optional(),

  /** License (SPDX identifier or custom) */
  license: z.string().max(50).optional(),

  /** Parent theme to extend */
  extends: z.string().optional(),

  /** Discovery tags */
  tags: z.array(z.string().max(30)).optional().default([]),

  /** Theme variables */
  variables: z.record(ThemeVariableSchema).optional().default({}),

  /** Component file references */
  files: ThemeFilesSchema.optional().default({}),
});

export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;

// ============================================================================
// Loaded Theme Data
// ============================================================================

/**
 * Server component from theme
 */
export const ThemeServerSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

export type ThemeServer = z.infer<typeof ThemeServerSchema>;

/**
 * Role component from theme
 */
export const ThemeRoleSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  position: z.number().optional(),
});

export type ThemeRole = z.infer<typeof ThemeRoleSchema>;

/**
 * Category component from theme
 */
export const ThemeCategorySchema = z.object({
  name: z.string().min(1),
  position: z.number().optional(),
  permissions: z.record(z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  })).optional(),
});

export type ThemeCategory = z.infer<typeof ThemeCategorySchema>;

/**
 * Channel component from theme
 */
export const ThemeChannelSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['text', 'voice', 'announcement', 'stage', 'forum']).optional(),
  category: z.string().optional(),
  topic: z.string().optional(),
  nsfw: z.boolean().optional(),
  slowmode: z.number().optional(),
  position: z.number().optional(),
  permissions: z.record(z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  })).optional(),
  bitrate: z.number().optional(),
  userLimit: z.number().optional(),
});

export type ThemeChannel = z.infer<typeof ThemeChannelSchema>;

/**
 * Loaded theme data (all components resolved)
 */
export interface LoadedTheme {
  /** Theme manifest */
  manifest: ThemeManifest;

  /** Resolved server config */
  server?: ThemeServer;

  /** Resolved roles */
  roles: ThemeRole[];

  /** Resolved categories */
  categories: ThemeCategory[];

  /** Resolved channels */
  channels: ThemeChannel[];

  /** Source path */
  sourcePath: string;
}

// ============================================================================
// Theme Reference in Config
// ============================================================================

/**
 * Theme reference in gaib.yaml
 */
export const ThemeReferenceSchema = z.object({
  /** Theme name or path */
  name: z.string().min(1),

  /** Theme source (local path or registry) */
  source: z.enum(['local', 'builtin']).optional().default('builtin'),

  /** Variable values */
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
});

export type ThemeReference = z.infer<typeof ThemeReferenceSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a theme manifest
 */
export function validateThemeManifest(content: unknown): {
  valid: boolean;
  manifest?: ThemeManifest;
  errors: string[];
} {
  const result = ThemeManifestSchema.safeParse(content);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      ),
    };
  }

  return {
    valid: true,
    manifest: result.data,
    errors: [],
  };
}

/**
 * Validate variable values against definitions
 */
export function validateVariables(
  definitions: Record<string, ThemeVariable>,
  values: Record<string, string | number | boolean>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required variables
  for (const [name, def] of Object.entries(definitions)) {
    if (def.required && !(name in values) && def.default === undefined) {
      errors.push(`Required variable "${name}" is not provided`);
    }
  }

  // Validate provided values
  for (const [name, value] of Object.entries(values)) {
    const def = definitions[name];
    if (!def) {
      errors.push(`Unknown variable "${name}"`);
      continue;
    }

    // Type validation
    switch (def.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Variable "${name}" must be a string`);
        } else if (def.pattern && !new RegExp(def.pattern).test(value)) {
          errors.push(`Variable "${name}" does not match pattern: ${def.pattern}`);
        }
        break;
      case 'color':
        if (typeof value !== 'string' || !/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(value)) {
          errors.push(`Variable "${name}" must be a valid hex color (e.g., #FF0000)`);
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          errors.push(`Variable "${name}" must be a number`);
        } else {
          if (def.min !== undefined && value < def.min) {
            errors.push(`Variable "${name}" must be >= ${def.min}`);
          }
          if (def.max !== undefined && value > def.max) {
            errors.push(`Variable "${name}" must be <= ${def.max}`);
          }
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Variable "${name}" must be a boolean`);
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * DiffEngine - Calculate differences between desired config and current Discord state
 *
 * Sprint 92: Discord Infrastructure-as-Code - Diff Calculation & State Application
 *
 * Compares the desired configuration from YAML with the current Discord server state
 * to determine what changes need to be applied (creates, updates, deletes).
 *
 * @see SDD grimoires/loa/discord-iac-sdd.md §4.2.3
 * @module packages/cli/commands/server/iac/DiffEngine
 */

import type {
  ServerConfig,
  RoleConfig,
  CategoryConfig,
  ChannelConfig,
  PermissionFlag,
} from './schemas.js';
import { colorToInt } from './schemas.js';
import type {
  ServerState,
  RoleState,
  CategoryState,
  ChannelState,
  ServerDiff,
  DiffSummary,
  RoleChange,
  CategoryChange,
  ChannelChange,
  PermissionChange,
  FieldChange,
  Snowflake,
  PermissionOverwriteState,
} from './types.js';

// ============================================================================
// DiffEngine
// ============================================================================

/**
 * Options for diff calculation
 */
export interface DiffOptions {
  /** Include permission overwrite changes (default: true) */
  includePermissions?: boolean;
  /** Only diff managed resources (default: false - includes creates for new resources) */
  managedOnly?: boolean;
}

/**
 * Calculate differences between desired configuration and current Discord state
 *
 * @param config - Desired server configuration from YAML
 * @param state - Current Discord server state
 * @param guildId - Discord guild ID
 * @param options - Diff options
 * @returns ServerDiff with all changes needed
 */
export function calculateDiff(
  config: ServerConfig,
  state: ServerState,
  guildId: Snowflake,
  options: DiffOptions = {}
): ServerDiff {
  const { includePermissions = true, managedOnly = false } = options;

  // Build lookup maps from current state
  const currentRoles = buildRoleMap(state.roles);
  const currentCategories = buildCategoryMap(state.categories);
  const currentChannels = buildChannelMap(state.channels);

  // Calculate diffs for each resource type
  const roleChanges = diffRoles(config.roles, currentRoles, managedOnly);
  const categoryChanges = diffCategories(config.categories, currentCategories, managedOnly);
  const channelChanges = diffChannels(
    config.channels,
    currentChannels,
    currentCategories,
    config.categories,
    managedOnly
  );

  // Calculate permission overwrites if enabled
  let permissionChanges: PermissionChange[] = [];
  if (includePermissions) {
    permissionChanges = diffPermissions(
      config,
      state,
      currentRoles,
      categoryChanges,
      channelChanges
    );
  }

  // Calculate summary
  const summary = calculateSummary(roleChanges, categoryChanges, channelChanges, permissionChanges);

  return {
    guildId,
    hasChanges: summary.total > 0,
    summary,
    roles: roleChanges,
    categories: categoryChanges,
    channels: channelChanges,
    permissions: permissionChanges,
  };
}

// ============================================================================
// Role Diffing
// ============================================================================

function buildRoleMap(roles: RoleState[]): Map<string, RoleState> {
  const map = new Map<string, RoleState>();
  for (const role of roles) {
    // Skip @everyone role - it's immutable
    if (!role.isEveryone) {
      map.set(role.name.toLowerCase(), role);
    }
  }
  return map;
}

function diffRoles(
  desired: RoleConfig[],
  current: Map<string, RoleState>,
  managedOnly: boolean
): RoleChange[] {
  const changes: RoleChange[] = [];
  const desiredNames = new Set<string>();

  // Find creates and updates
  for (const desiredRole of desired) {
    const key = desiredRole.name.toLowerCase();
    desiredNames.add(key);
    const currentRole = current.get(key);

    if (!currentRole) {
      // Create: role doesn't exist
      changes.push({
        operation: 'create',
        name: desiredRole.name,
        desired: configToRoleState(desiredRole),
      });
    } else {
      // Check for updates
      const fieldChanges = getRoleChanges(desiredRole, currentRole);
      if (fieldChanges.length > 0) {
        changes.push({
          operation: 'update',
          name: desiredRole.name,
          current: currentRole,
          desired: configToRoleState(desiredRole, currentRole.id),
          changes: fieldChanges,
        });
      } else {
        // No change
        changes.push({
          operation: 'noop',
          name: desiredRole.name,
          current: currentRole,
          desired: configToRoleState(desiredRole, currentRole.id),
        });
      }
    }
  }

  // Find deletes (only IaC-managed roles not in desired config)
  for (const [name, currentRole] of current) {
    if (!desiredNames.has(name)) {
      if (currentRole.isIacManaged) {
        // Delete: managed role no longer in config
        changes.push({
          operation: 'delete',
          name: currentRole.name,
          current: currentRole,
        });
      } else if (!managedOnly) {
        // Preserve: unmanaged role
        changes.push({
          operation: 'noop',
          name: currentRole.name,
          current: currentRole,
        });
      }
    }
  }

  return changes;
}

function configToRoleState(config: RoleConfig, id?: Snowflake): RoleState {
  return {
    id: id ?? '',
    name: config.name,
    color: config.color ?? '#000000',
    hoist: config.hoist ?? false,
    mentionable: config.mentionable ?? false,
    permissions: config.permissions ?? [],
    position: config.position ?? 0,
    managed: false,
    isEveryone: false,
    isIacManaged: true, // Will be managed by IaC
  };
}

function getRoleChanges(desired: RoleConfig, current: RoleState): FieldChange[] {
  const changes: FieldChange[] = [];

  // Compare color
  const desiredColor = desired.color ?? '#000000';
  const currentColorInt = colorToInt(current.color);
  const desiredColorInt = colorToInt(desiredColor);
  if (desiredColorInt !== currentColorInt) {
    changes.push({ field: 'color', from: current.color, to: desiredColor });
  }

  // Compare hoist
  const desiredHoist = desired.hoist ?? false;
  if (desiredHoist !== current.hoist) {
    changes.push({ field: 'hoist', from: current.hoist, to: desiredHoist });
  }

  // Compare mentionable
  const desiredMentionable = desired.mentionable ?? false;
  if (desiredMentionable !== current.mentionable) {
    changes.push({ field: 'mentionable', from: current.mentionable, to: desiredMentionable });
  }

  // Compare permissions
  const desiredPerms = desired.permissions ?? [];
  if (!permissionsEqual(desiredPerms, current.permissions)) {
    changes.push({ field: 'permissions', from: current.permissions, to: desiredPerms });
  }

  // Compare position (only if explicitly set)
  if (desired.position !== undefined && desired.position !== current.position) {
    changes.push({ field: 'position', from: current.position, to: desired.position });
  }

  return changes;
}

// ============================================================================
// Category Diffing
// ============================================================================

function buildCategoryMap(categories: CategoryState[]): Map<string, CategoryState> {
  const map = new Map<string, CategoryState>();
  for (const category of categories) {
    map.set(category.name.toLowerCase(), category);
  }
  return map;
}

function diffCategories(
  desired: CategoryConfig[],
  current: Map<string, CategoryState>,
  managedOnly: boolean
): CategoryChange[] {
  const changes: CategoryChange[] = [];
  const desiredNames = new Set<string>();

  // Find creates and updates
  for (const desiredCat of desired) {
    const key = desiredCat.name.toLowerCase();
    desiredNames.add(key);
    const currentCat = current.get(key);

    if (!currentCat) {
      // Create: category doesn't exist
      changes.push({
        operation: 'create',
        name: desiredCat.name,
        desired: configToCategoryState(desiredCat),
      });
    } else {
      // Check for updates
      const fieldChanges = getCategoryChanges(desiredCat, currentCat);
      if (fieldChanges.length > 0) {
        changes.push({
          operation: 'update',
          name: desiredCat.name,
          current: currentCat,
          desired: configToCategoryState(desiredCat, currentCat.id),
          changes: fieldChanges,
        });
      } else {
        // No change
        changes.push({
          operation: 'noop',
          name: desiredCat.name,
          current: currentCat,
          desired: configToCategoryState(desiredCat, currentCat.id),
        });
      }
    }
  }

  // Find deletes (only IaC-managed categories not in desired config)
  for (const [name, currentCat] of current) {
    if (!desiredNames.has(name)) {
      if (currentCat.isIacManaged) {
        // Delete: managed category no longer in config
        changes.push({
          operation: 'delete',
          name: currentCat.name,
          current: currentCat,
        });
      } else if (!managedOnly) {
        // Preserve: unmanaged category
        changes.push({
          operation: 'noop',
          name: currentCat.name,
          current: currentCat,
        });
      }
    }
  }

  return changes;
}

function configToCategoryState(config: CategoryConfig, id?: Snowflake): CategoryState {
  return {
    id: id ?? '',
    name: config.name,
    position: config.position ?? 0,
    permissionOverwrites: [], // Permissions handled separately
    isIacManaged: true,
  };
}

function getCategoryChanges(desired: CategoryConfig, current: CategoryState): FieldChange[] {
  const changes: FieldChange[] = [];

  // Compare position (only if explicitly set)
  if (desired.position !== undefined && desired.position !== current.position) {
    changes.push({ field: 'position', from: current.position, to: desired.position });
  }

  return changes;
}

// ============================================================================
// Channel Diffing
// ============================================================================

function buildChannelMap(channels: ChannelState[]): Map<string, ChannelState> {
  const map = new Map<string, ChannelState>();
  for (const channel of channels) {
    map.set(channel.name.toLowerCase(), channel);
  }
  return map;
}

function diffChannels(
  desired: ChannelConfig[],
  current: Map<string, ChannelState>,
  currentCategories: Map<string, CategoryState>,
  _desiredCategories: CategoryConfig[],
  managedOnly: boolean
): ChannelChange[] {
  const changes: ChannelChange[] = [];
  const desiredNames = new Set<string>();

  // Build category name lookup for matching
  const categoryNameToId = new Map<string, Snowflake>();
  for (const [name, cat] of currentCategories) {
    categoryNameToId.set(name, cat.id);
  }

  // Find creates and updates
  for (const desiredChan of desired) {
    const key = desiredChan.name.toLowerCase();
    desiredNames.add(key);
    const currentChan = current.get(key);

    if (!currentChan) {
      // Create: channel doesn't exist
      changes.push({
        operation: 'create',
        name: desiredChan.name,
        desired: configToChannelState(desiredChan, categoryNameToId),
      });
    } else {
      // Check for updates
      const fieldChanges = getChannelChanges(desiredChan, currentChan, categoryNameToId);
      if (fieldChanges.length > 0) {
        changes.push({
          operation: 'update',
          name: desiredChan.name,
          current: currentChan,
          desired: configToChannelState(desiredChan, categoryNameToId, currentChan.id),
          changes: fieldChanges,
        });
      } else {
        // No change
        changes.push({
          operation: 'noop',
          name: desiredChan.name,
          current: currentChan,
          desired: configToChannelState(desiredChan, categoryNameToId, currentChan.id),
        });
      }
    }
  }

  // Find deletes (only IaC-managed channels not in desired config)
  for (const [name, currentChan] of current) {
    if (!desiredNames.has(name)) {
      if (currentChan.isIacManaged) {
        // Delete: managed channel no longer in config
        changes.push({
          operation: 'delete',
          name: currentChan.name,
          current: currentChan,
        });
      } else if (!managedOnly) {
        // Preserve: unmanaged channel
        changes.push({
          operation: 'noop',
          name: currentChan.name,
          current: currentChan,
        });
      }
    }
  }

  return changes;
}

function configToChannelState(
  config: ChannelConfig,
  categoryNameToId: Map<string, Snowflake>,
  id?: Snowflake
): ChannelState {
  const parentId = config.category
    ? categoryNameToId.get(config.category.toLowerCase())
    : undefined;

  return {
    id: id ?? '',
    name: config.name,
    type: config.type ?? 'text',
    parentId,
    parentName: config.category,
    topic: config.topic,
    nsfw: config.nsfw ?? false,
    slowmode: config.slowmode ?? 0,
    position: config.position ?? 0,
    permissionOverwrites: [], // Permissions handled separately
    bitrate: config.bitrate,
    userLimit: config.userLimit,
    isIacManaged: true,
  };
}

function getChannelChanges(
  desired: ChannelConfig,
  current: ChannelState,
  categoryNameToId: Map<string, Snowflake>
): FieldChange[] {
  const changes: FieldChange[] = [];

  // Compare type
  const desiredType = desired.type ?? 'text';
  if (desiredType !== current.type) {
    changes.push({ field: 'type', from: current.type, to: desiredType });
  }

  // Compare parent category
  const desiredParentId = desired.category
    ? categoryNameToId.get(desired.category.toLowerCase())
    : undefined;
  if (desiredParentId !== current.parentId) {
    changes.push({
      field: 'parentId',
      from: current.parentId ?? null,
      to: desiredParentId ?? null,
    });
  }

  // Compare topic
  const desiredTopic = desired.topic ?? undefined;
  if (desiredTopic !== current.topic) {
    changes.push({ field: 'topic', from: current.topic ?? null, to: desiredTopic ?? null });
  }

  // Compare nsfw
  const desiredNsfw = desired.nsfw ?? false;
  if (desiredNsfw !== current.nsfw) {
    changes.push({ field: 'nsfw', from: current.nsfw, to: desiredNsfw });
  }

  // Compare slowmode
  const desiredSlowmode = desired.slowmode ?? 0;
  if (desiredSlowmode !== current.slowmode) {
    changes.push({ field: 'slowmode', from: current.slowmode, to: desiredSlowmode });
  }

  // Compare position (only if explicitly set)
  if (desired.position !== undefined && desired.position !== current.position) {
    changes.push({ field: 'position', from: current.position, to: desired.position });
  }

  // Voice channel specific
  if (desired.bitrate !== undefined && desired.bitrate !== current.bitrate) {
    changes.push({ field: 'bitrate', from: current.bitrate ?? null, to: desired.bitrate });
  }
  if (desired.userLimit !== undefined && desired.userLimit !== current.userLimit) {
    changes.push({ field: 'userLimit', from: current.userLimit ?? null, to: desired.userLimit });
  }

  return changes;
}

// ============================================================================
// Permission Diffing
// ============================================================================

function diffPermissions(
  config: ServerConfig,
  state: ServerState,
  currentRoles: Map<string, RoleState>,
  _categoryChanges: CategoryChange[],
  _channelChanges: ChannelChange[]
): PermissionChange[] {
  const changes: PermissionChange[] = [];

  // Build role name to ID map (include @everyone with guild ID)
  const roleNameToId = new Map<string, Snowflake>();
  roleNameToId.set('@everyone', state.id);
  for (const [name, role] of currentRoles) {
    roleNameToId.set(name, role.id);
    roleNameToId.set(role.name, role.id); // Also map original case
  }

  // Diff category permissions
  for (const category of config.categories) {
    if (!category.permissions) continue;

    // Find current category state
    const currentCat = state.categories.find(
      (c) => c.name.toLowerCase() === category.name.toLowerCase()
    );
    if (!currentCat) continue; // Will be created, permissions applied then

    for (const [roleName, perms] of Object.entries(category.permissions)) {
      const roleId = roleNameToId.get(roleName.toLowerCase()) ?? roleNameToId.get(roleName);
      if (!roleId) continue; // Role not found, skip

      const currentOverwrite = currentCat.permissionOverwrites.find((o) => o.id === roleId);
      const desiredAllow = perms.allow ?? [];
      const desiredDeny = perms.deny ?? [];

      const permChange = getPermissionChange(
        currentCat.id,
        currentCat.name,
        'category',
        roleId,
        roleName,
        'role',
        currentOverwrite,
        desiredAllow,
        desiredDeny
      );

      if (permChange) {
        changes.push(permChange);
      }
    }
  }

  // Diff channel permissions
  for (const channel of config.channels) {
    if (!channel.permissions) continue;

    // Find current channel state
    const currentChan = state.channels.find(
      (c) => c.name.toLowerCase() === channel.name.toLowerCase()
    );
    if (!currentChan) continue; // Will be created, permissions applied then

    for (const [roleName, perms] of Object.entries(channel.permissions)) {
      const roleId = roleNameToId.get(roleName.toLowerCase()) ?? roleNameToId.get(roleName);
      if (!roleId) continue; // Role not found, skip

      const currentOverwrite = currentChan.permissionOverwrites.find((o) => o.id === roleId);
      const desiredAllow = perms.allow ?? [];
      const desiredDeny = perms.deny ?? [];

      const permChange = getPermissionChange(
        currentChan.id,
        currentChan.name,
        'channel',
        roleId,
        roleName,
        'role',
        currentOverwrite,
        desiredAllow,
        desiredDeny
      );

      if (permChange) {
        changes.push(permChange);
      }
    }
  }

  return changes;
}

function getPermissionChange(
  targetId: Snowflake,
  targetName: string,
  targetType: 'channel' | 'category',
  subjectId: Snowflake,
  subjectName: string,
  subjectType: 'role' | 'member',
  current: PermissionOverwriteState | undefined,
  desiredAllow: PermissionFlag[],
  desiredDeny: PermissionFlag[]
): PermissionChange | null {
  const hasDesired = desiredAllow.length > 0 || desiredDeny.length > 0;

  if (!current && !hasDesired) {
    // No change needed
    return null;
  }

  if (!current && hasDesired) {
    // Create new overwrite
    return {
      operation: 'create',
      targetId,
      targetName,
      targetType,
      subjectId,
      subjectName,
      subjectType,
      desired: { allow: desiredAllow, deny: desiredDeny },
    };
  }

  if (current && !hasDesired) {
    // Delete existing overwrite
    return {
      operation: 'delete',
      targetId,
      targetName,
      targetType,
      subjectId,
      subjectName,
      subjectType,
      current: { allow: current.allow, deny: current.deny },
    };
  }

  // Check if update needed
  if (
    current &&
    (!permissionsEqual(desiredAllow, current.allow) ||
     !permissionsEqual(desiredDeny, current.deny))
  ) {
    return {
      operation: 'update',
      targetId,
      targetName,
      targetType,
      subjectId,
      subjectName,
      subjectType,
      current: { allow: current.allow, deny: current.deny },
      desired: { allow: desiredAllow, deny: desiredDeny },
    };
  }

  return null;
}

// ============================================================================
// Summary Calculation
// ============================================================================

function calculateSummary(
  roles: RoleChange[],
  categories: CategoryChange[],
  channels: ChannelChange[],
  permissions: PermissionChange[]
): DiffSummary {
  let create = 0;
  let update = 0;
  let del = 0;
  let noop = 0;

  const allChanges = [...roles, ...categories, ...channels];

  for (const change of allChanges) {
    switch (change.operation) {
      case 'create':
        create++;
        break;
      case 'update':
        update++;
        break;
      case 'delete':
        del++;
        break;
      case 'noop':
        noop++;
        break;
    }
  }

  // Count permission changes
  for (const perm of permissions) {
    switch (perm.operation) {
      case 'create':
        create++;
        break;
      case 'update':
        update++;
        break;
      case 'delete':
        del++;
        break;
    }
  }

  return {
    total: create + update + del,
    create,
    update,
    delete: del,
    noop,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compare two permission arrays for equality (order-independent)
 */
function permissionsEqual(a: PermissionFlag[], b: PermissionFlag[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((perm) => setA.has(perm));
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format a diff for human-readable display
 */
export function formatDiff(diff: ServerDiff): string {
  const lines: string[] = [];

  // Summary
  lines.push(`Diff Summary: ${diff.summary.create} creates, ${diff.summary.update} updates, ${diff.summary.delete} deletes`);
  lines.push('');

  // Roles
  const roleCreates = diff.roles.filter((r) => r.operation === 'create');
  const roleUpdates = diff.roles.filter((r) => r.operation === 'update');
  const roleDeletes = diff.roles.filter((r) => r.operation === 'delete');

  if (roleCreates.length > 0) {
    lines.push('Roles to create:');
    for (const role of roleCreates) {
      lines.push(`  + ${role.name}`);
    }
  }
  if (roleUpdates.length > 0) {
    lines.push('Roles to update:');
    for (const role of roleUpdates) {
      lines.push(`  ~ ${role.name}`);
      for (const change of role.changes ?? []) {
        lines.push(`    ${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`);
      }
    }
  }
  if (roleDeletes.length > 0) {
    lines.push('Roles to delete:');
    for (const role of roleDeletes) {
      lines.push(`  - ${role.name}`);
    }
  }

  // Categories
  const catCreates = diff.categories.filter((c) => c.operation === 'create');
  const catUpdates = diff.categories.filter((c) => c.operation === 'update');
  const catDeletes = diff.categories.filter((c) => c.operation === 'delete');

  if (catCreates.length > 0) {
    lines.push('Categories to create:');
    for (const cat of catCreates) {
      lines.push(`  + ${cat.name}`);
    }
  }
  if (catUpdates.length > 0) {
    lines.push('Categories to update:');
    for (const cat of catUpdates) {
      lines.push(`  ~ ${cat.name}`);
      for (const change of cat.changes ?? []) {
        lines.push(`    ${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`);
      }
    }
  }
  if (catDeletes.length > 0) {
    lines.push('Categories to delete:');
    for (const cat of catDeletes) {
      lines.push(`  - ${cat.name}`);
    }
  }

  // Channels
  const chanCreates = diff.channels.filter((c) => c.operation === 'create');
  const chanUpdates = diff.channels.filter((c) => c.operation === 'update');
  const chanDeletes = diff.channels.filter((c) => c.operation === 'delete');

  if (chanCreates.length > 0) {
    lines.push('Channels to create:');
    for (const chan of chanCreates) {
      lines.push(`  + ${chan.name}`);
    }
  }
  if (chanUpdates.length > 0) {
    lines.push('Channels to update:');
    for (const chan of chanUpdates) {
      lines.push(`  ~ ${chan.name}`);
      for (const change of chan.changes ?? []) {
        lines.push(`    ${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`);
      }
    }
  }
  if (chanDeletes.length > 0) {
    lines.push('Channels to delete:');
    for (const chan of chanDeletes) {
      lines.push(`  - ${chan.name}`);
    }
  }

  // Permissions
  const permCreates = diff.permissions.filter((p) => p.operation === 'create');
  const permUpdates = diff.permissions.filter((p) => p.operation === 'update');
  const permDeletes = diff.permissions.filter((p) => p.operation === 'delete');

  if (permCreates.length > 0 || permUpdates.length > 0 || permDeletes.length > 0) {
    lines.push('Permission overwrites:');
    for (const perm of permCreates) {
      lines.push(`  + ${perm.targetName}/${perm.subjectName}`);
    }
    for (const perm of permUpdates) {
      lines.push(`  ~ ${perm.targetName}/${perm.subjectName}`);
    }
    for (const perm of permDeletes) {
      lines.push(`  - ${perm.targetName}/${perm.subjectName}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get only the changes that need to be applied (excludes noop)
 */
export function getActionableChanges(diff: ServerDiff): ServerDiff {
  return {
    ...diff,
    roles: diff.roles.filter((r) => r.operation !== 'noop'),
    categories: diff.categories.filter((c) => c.operation !== 'noop'),
    channels: diff.channels.filter((c) => c.operation !== 'noop'),
  };
}

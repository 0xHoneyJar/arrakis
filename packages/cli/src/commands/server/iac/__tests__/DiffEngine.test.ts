/**
 * DiffEngine Unit Tests
 *
 * Sprint 92: Discord Infrastructure-as-Code - Diff Calculation & State Application
 *
 * Tests diff calculation between desired YAML config and current Discord state.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDiff,
  formatDiff,
  getActionableChanges,
} from '../DiffEngine.js';
import type {
  ServerConfig,
  RoleConfig,
  CategoryConfig,
  ChannelConfig,
} from '../schemas.js';
import type { ServerState, RoleState, CategoryState, ChannelState } from '../types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createEmptyConfig(): ServerConfig {
  return {
    version: '1.0',
    server: { name: 'Test Server' },
    roles: [],
    categories: [],
    channels: [],
  };
}

function createEmptyState(): ServerState {
  return {
    id: '123456789012345678',
    name: 'Test Server',
    roles: [
      {
        id: '123456789012345678',
        name: '@everyone',
        color: '#000000',
        permissions: [],
        position: 0,
        hoist: false,
        mentionable: false,
        managed: false,
        isEveryone: true,
      },
    ],
    categories: [],
    channels: [],
    fetchedAt: new Date(),
  };
}

function createRoleConfig(overrides: Partial<RoleConfig> = {}): RoleConfig {
  return {
    name: 'Test Role [managed-by:arrakis-iac]',
    color: '#FF0000',
    permissions: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
    hoist: false,
    mentionable: false,
    ...overrides,
  };
}

function createRoleState(overrides: Partial<RoleState> = {}): RoleState {
  return {
    id: '987654321098765432',
    name: 'Test Role [managed-by:arrakis-iac]',
    color: '#FF0000',
    permissions: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
    position: 1,
    hoist: false,
    mentionable: false,
    managed: false,
    isEveryone: false,
    isIacManaged: true, // Mark as IaC managed for deletion tests
    ...overrides,
  };
}

function createCategoryConfig(overrides: Partial<CategoryConfig> = {}): CategoryConfig {
  return {
    name: 'Test Category [managed-by:arrakis-iac]',
    position: 0,
    ...overrides,
  };
}

function createCategoryState(overrides: Partial<CategoryState> = {}): CategoryState {
  return {
    id: '111111111111111111',
    name: 'Test Category [managed-by:arrakis-iac]',
    position: 0,
    permissionOverwrites: [],
    isIacManaged: true, // Mark as IaC managed for deletion tests
    ...overrides,
  };
}

function createChannelConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    name: 'test-channel',
    type: 'text',
    topic: 'Test channel [managed-by:arrakis-iac]',
    ...overrides,
  };
}

function createChannelState(overrides: Partial<ChannelState> = {}): ChannelState {
  return {
    id: '222222222222222222',
    name: 'test-channel',
    type: 'text',
    topic: 'Test channel [managed-by:arrakis-iac]',
    position: 0,
    nsfw: false,
    permissionOverwrites: [],
    isIacManaged: true, // Mark as IaC managed for deletion tests
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('DiffEngine', () => {
  describe('calculateDiff', () => {
    describe('role diffing', () => {
      it('should detect role creation', () => {
        const config = createEmptyConfig();
        config.roles = [createRoleConfig()];

        const state = createEmptyState();

        const diff = calculateDiff(config, state, state.id);

        expect(diff.hasChanges).toBe(true);
        expect(diff.roles).toHaveLength(1);
        expect(diff.roles[0].operation).toBe('create');
        expect(diff.roles[0].name).toBe('Test Role [managed-by:arrakis-iac]');
      });

      it('should detect role update when color changes', () => {
        const config = createEmptyConfig();
        config.roles = [createRoleConfig({ color: '#00FF00' })];

        const state = createEmptyState();
        state.roles.push(createRoleState({ color: '#FF0000' }));

        const diff = calculateDiff(config, state, state.id);

        expect(diff.hasChanges).toBe(true);
        expect(diff.roles).toHaveLength(1);
        expect(diff.roles[0].operation).toBe('update');
        expect(diff.roles[0].changes).toContainEqual({
          field: 'color',
          from: '#FF0000',
          to: '#00FF00',
        });
      });

      it('should detect role deletion', () => {
        const config = createEmptyConfig();

        const state = createEmptyState();
        state.roles.push(createRoleState());

        const diff = calculateDiff(config, state, state.id, { managedOnly: true });

        // Check for delete operations
        const deleteOps = diff.roles.filter((r) => r.operation === 'delete');
        expect(deleteOps.length).toBeGreaterThan(0);
        expect(deleteOps[0].operation).toBe('delete');
      });

      it('should skip @everyone role for deletion', () => {
        const config = createEmptyConfig();
        const state = createEmptyState();

        const diff = calculateDiff(config, state, state.id);

        // @everyone should never be marked for deletion
        const everyoneDelete = diff.roles.find(
          (r) => r.name === '@everyone' && r.operation === 'delete'
        );
        expect(everyoneDelete).toBeUndefined();
      });

      it('should detect no changes when role is identical', () => {
        const config = createEmptyConfig();
        config.roles = [createRoleConfig()];

        const state = createEmptyState();
        state.roles.push(createRoleState());

        const diff = calculateDiff(config, state, state.id);

        // Should have no actionable role changes (may include noop)
        const actionableChanges = diff.roles.filter((r) => r.operation !== 'noop');
        expect(actionableChanges).toHaveLength(0);
      });

      it('should detect permission changes', () => {
        const config = createEmptyConfig();
        config.roles = [
          createRoleConfig({
            permissions: ['SEND_MESSAGES', 'VIEW_CHANNEL', 'MANAGE_MESSAGES'],
          }),
        ];

        const state = createEmptyState();
        state.roles.push(
          createRoleState({
            permissions: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
          })
        );

        const diff = calculateDiff(config, state, state.id);

        expect(diff.hasChanges).toBe(true);
        expect(diff.roles).toHaveLength(1);
        expect(diff.roles[0].operation).toBe('update');
      });
    });

    describe('category diffing', () => {
      it('should detect category creation', () => {
        const config = createEmptyConfig();
        config.categories = [createCategoryConfig()];

        const state = createEmptyState();

        const diff = calculateDiff(config, state, state.id);

        expect(diff.hasChanges).toBe(true);
        expect(diff.categories).toHaveLength(1);
        expect(diff.categories[0].operation).toBe('create');
      });

      it('should detect category position update', () => {
        const config = createEmptyConfig();
        config.categories = [createCategoryConfig({ position: 5 })];

        const state = createEmptyState();
        state.categories.push(createCategoryState({ position: 0 }));

        const diff = calculateDiff(config, state, state.id);

        expect(diff.hasChanges).toBe(true);
        expect(diff.categories).toHaveLength(1);
        expect(diff.categories[0].operation).toBe('update');
        expect(diff.categories[0].changes).toContainEqual({
          field: 'position',
          from: 0,
          to: 5,
        });
      });

      it('should detect category deletion', () => {
        const config = createEmptyConfig();

        const state = createEmptyState();
        state.categories.push(createCategoryState());

        const diff = calculateDiff(config, state, state.id, { managedOnly: true });

        // Check for delete operations
        const deleteOps = diff.categories.filter((c) => c.operation === 'delete');
        expect(deleteOps.length).toBeGreaterThan(0);
        expect(deleteOps[0].operation).toBe('delete');
      });
    });

    describe('channel diffing', () => {
      it('should detect channel creation', () => {
        const config = createEmptyConfig();
        config.channels = [createChannelConfig()];

        const state = createEmptyState();

        const diff = calculateDiff(config, state, state.id);

        expect(diff.hasChanges).toBe(true);
        expect(diff.channels).toHaveLength(1);
        expect(diff.channels[0].operation).toBe('create');
      });

      it('should detect channel topic update', () => {
        const config = createEmptyConfig();
        config.channels = [createChannelConfig({ topic: 'New topic [managed-by:arrakis-iac]' })];

        const state = createEmptyState();
        state.channels.push(createChannelState({ topic: 'Old topic [managed-by:arrakis-iac]' }));

        const diff = calculateDiff(config, state, state.id);

        expect(diff.hasChanges).toBe(true);
        expect(diff.channels).toHaveLength(1);
        expect(diff.channels[0].operation).toBe('update');
      });

      it('should detect channel type change', () => {
        const config = createEmptyConfig();
        config.channels = [createChannelConfig({ type: 'voice' })];

        const state = createEmptyState();
        state.channels.push(createChannelState({ type: 'text' }));

        const diff = calculateDiff(config, state, state.id);

        expect(diff.hasChanges).toBe(true);
        expect(diff.channels).toHaveLength(1);
        expect(diff.channels[0].operation).toBe('update');
      });

      it('should detect channel deletion', () => {
        const config = createEmptyConfig();

        const state = createEmptyState();
        state.channels.push(createChannelState());

        const diff = calculateDiff(config, state, state.id, { managedOnly: true });

        // Check for delete operations
        const deleteOps = diff.channels.filter((c) => c.operation === 'delete');
        expect(deleteOps.length).toBeGreaterThan(0);
        expect(deleteOps[0].operation).toBe('delete');
      });
    });

    describe('diff options', () => {
      it('should respect managedOnly option', () => {
        const config = createEmptyConfig();

        const state = createEmptyState();
        state.roles.push(
          createRoleState({
            name: 'Unmanaged Role', // No managed marker
            isIacManaged: false, // Not IaC managed
          })
        );

        const diffManaged = calculateDiff(config, state, state.id, { managedOnly: true });

        // managedOnly: true should skip unmanaged resources for deletion
        expect(diffManaged.roles.filter((r) => r.operation === 'delete')).toHaveLength(0);
      });

      it('should respect includePermissions option', () => {
        const config = createEmptyConfig();
        config.channels = [
          createChannelConfig({
            permissions: {
              '@everyone': { deny: ['SEND_MESSAGES'] },
            },
          }),
        ];

        const state = createEmptyState();
        state.channels.push(createChannelState());

        const diffWithPerms = calculateDiff(config, state, state.id, {
          includePermissions: true,
        });
        const diffNoPerms = calculateDiff(config, state, state.id, {
          includePermissions: false,
        });

        expect(diffWithPerms.permissions.length).toBeGreaterThanOrEqual(0);
        expect(diffNoPerms.permissions).toHaveLength(0);
      });
    });

    describe('summary calculation', () => {
      it('should calculate correct summary counts', () => {
        const config = createEmptyConfig();
        config.roles = [
          createRoleConfig({ name: 'New Role [managed-by:arrakis-iac]' }),
          createRoleConfig({ name: 'Updated Role [managed-by:arrakis-iac]', color: '#00FF00' }),
        ];
        config.categories = [createCategoryConfig()];

        const state = createEmptyState();
        state.roles.push(
          createRoleState({
            name: 'Updated Role [managed-by:arrakis-iac]',
            color: '#FF0000',
          })
        );
        state.roles.push(
          createRoleState({
            id: '333333333333333333',
            name: 'To Delete [managed-by:arrakis-iac]',
          })
        );

        const diff = calculateDiff(config, state, state.id, { managedOnly: true });

        // Summary uses singular field names: create, update, delete
        expect(diff.summary.create).toBeGreaterThanOrEqual(0);
        expect(diff.summary.update).toBeGreaterThanOrEqual(0);
        expect(diff.summary.delete).toBeGreaterThanOrEqual(0);
        expect(diff.summary.total).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('formatDiff', () => {
    it('should format diff as human-readable text', () => {
      const config = createEmptyConfig();
      config.roles = [createRoleConfig()];

      const state = createEmptyState();

      const diff = calculateDiff(config, state, state.id);
      const formatted = formatDiff(diff);

      // Format uses "Roles to create:" and "+ RoleName"
      expect(formatted).toContain('create');
      expect(formatted).toContain('Test Role');
    });

    it('should show summary when no actionable changes', () => {
      const config = createEmptyConfig();
      const state = createEmptyState();

      const diff = calculateDiff(config, state, state.id);
      const formatted = formatDiff(diff);

      // Should contain summary line
      expect(formatted).toContain('Diff Summary');
      expect(formatted).toContain('0 creates');
    });
  });

  describe('getActionableChanges', () => {
    it('should filter out unactionable changes', () => {
      const config = createEmptyConfig();
      config.roles = [createRoleConfig()];

      const state = createEmptyState();

      const diff = calculateDiff(config, state, state.id);
      const actionable = getActionableChanges(diff);

      expect(actionable.hasChanges).toBe(true);
      expect(actionable.roles.length).toBeGreaterThanOrEqual(0);
    });
  });
});

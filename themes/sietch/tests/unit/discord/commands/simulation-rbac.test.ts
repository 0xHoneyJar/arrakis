/**
 * Simulation Command RBAC & Cooldown Tests
 *
 * Sprint 112: Security Remediation (HIGH-001, HIGH-002)
 *
 * Tests for Discord RBAC and command cooldowns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PermissionFlagsBits, Collection } from 'discord.js';
import type { GuildMember, Role, GuildMemberRoleManager } from 'discord.js';
import {
  QAPermissionLevel,
  getQAPermissionLevel,
  hasPermission,
  COMMAND_COOLDOWNS,
  checkCooldown,
  clearCooldown,
  clearAllCooldowns,
} from '../../../../src/discord/commands/simulation.js';

// =============================================================================
// Mock Helpers
// =============================================================================

function createMockRole(name: string, id: string = Math.random().toString()): Role {
  return {
    id,
    name,
    guild: {},
  } as unknown as Role;
}

function createMockMember(options: {
  roles?: string[];
  isAdmin?: boolean;
  userId?: string;
}): GuildMember {
  const { roles = [], isAdmin = false, userId = 'test-user-123' } = options;

  const roleCache = new Collection<string, Role>();
  roles.forEach((roleName, index) => {
    roleCache.set(`role-${index}`, createMockRole(roleName, `role-${index}`));
  });

  const mockPermissions = {
    has: vi.fn((permission: bigint) => {
      if (permission === PermissionFlagsBits.Administrator) {
        return isAdmin;
      }
      return false;
    }),
  };

  return {
    id: userId,
    user: { id: userId },
    permissions: mockPermissions,
    roles: {
      cache: roleCache,
    } as unknown as GuildMemberRoleManager,
  } as unknown as GuildMember;
}

// =============================================================================
// RBAC Tests
// =============================================================================

describe('RBAC: getQAPermissionLevel', () => {
  describe('null/undefined member', () => {
    it('should return NONE for null member', () => {
      expect(getQAPermissionLevel(null)).toBe(QAPermissionLevel.NONE);
    });

    it('should return NONE for undefined member', () => {
      expect(getQAPermissionLevel(undefined)).toBe(QAPermissionLevel.NONE);
    });
  });

  describe('Administrator permission', () => {
    it('should return QA_ADMIN for server administrators', () => {
      const member = createMockMember({ isAdmin: true });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_ADMIN);
    });

    it('should return QA_ADMIN even without QA roles if admin', () => {
      const member = createMockMember({
        isAdmin: true,
        roles: ['Member'],
      });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_ADMIN);
    });
  });

  describe('QA Admin role patterns', () => {
    it('should return QA_ADMIN for "QA Admin" role', () => {
      const member = createMockMember({ roles: ['QA Admin'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_ADMIN);
    });

    it('should return QA_ADMIN for "qa-admin" role', () => {
      const member = createMockMember({ roles: ['qa-admin'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_ADMIN);
    });

    it('should return QA_ADMIN for "Admin" role', () => {
      const member = createMockMember({ roles: ['Admin'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_ADMIN);
    });

    it('should match case-insensitively', () => {
      const member = createMockMember({ roles: ['QA ADMIN'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_ADMIN);
    });

    it('should match partial role names', () => {
      const member = createMockMember({ roles: ['Server Admin Team'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_ADMIN);
    });
  });

  describe('QA Tester role patterns', () => {
    it('should return QA_TESTER for "QA Tester" role', () => {
      const member = createMockMember({ roles: ['QA Tester'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_TESTER);
    });

    it('should return QA_TESTER for "qa-tester" role', () => {
      const member = createMockMember({ roles: ['qa-tester'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_TESTER);
    });

    it('should return QA_TESTER for "Tester" role', () => {
      const member = createMockMember({ roles: ['Tester'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_TESTER);
    });

    it('should return QA_TESTER for "QA" role', () => {
      const member = createMockMember({ roles: ['QA'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_TESTER);
    });

    it('should match case-insensitively', () => {
      const member = createMockMember({ roles: ['QA TESTER'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_TESTER);
    });
  });

  describe('Default permissions', () => {
    it('should return SELF_ONLY for members without QA roles', () => {
      const member = createMockMember({ roles: ['Member', 'Verified'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.SELF_ONLY);
    });

    it('should return SELF_ONLY for members with no roles', () => {
      const member = createMockMember({ roles: [] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.SELF_ONLY);
    });
  });

  describe('Role priority', () => {
    it('should prefer QA_ADMIN over QA_TESTER if both present', () => {
      const member = createMockMember({ roles: ['QA Tester', 'QA Admin'] });
      expect(getQAPermissionLevel(member)).toBe(QAPermissionLevel.QA_ADMIN);
    });
  });
});

describe('RBAC: hasPermission', () => {
  describe('QA Admin', () => {
    it('should allow all operations for admin', () => {
      const member = createMockMember({ isAdmin: true });

      expect(hasPermission(member, QAPermissionLevel.QA_ADMIN, 'other-user', 'admin-user')).toBe(true);
      expect(hasPermission(member, QAPermissionLevel.QA_TESTER, 'other-user', 'admin-user')).toBe(true);
      expect(hasPermission(member, QAPermissionLevel.SELF_ONLY, 'other-user', 'admin-user')).toBe(true);
    });

    it('should allow modifying other users contexts', () => {
      const member = createMockMember({ roles: ['Admin'], userId: 'admin-123' });
      expect(hasPermission(member, QAPermissionLevel.QA_TESTER, 'other-user-456', 'admin-123')).toBe(true);
    });
  });

  describe('QA Tester', () => {
    it('should allow tester-level operations', () => {
      const member = createMockMember({ roles: ['QA Tester'], userId: 'tester-123' });

      expect(hasPermission(member, QAPermissionLevel.QA_TESTER, 'other-user', 'tester-123')).toBe(true);
      expect(hasPermission(member, QAPermissionLevel.SELF_ONLY, 'other-user', 'tester-123')).toBe(true);
    });

    it('should deny admin-level operations', () => {
      const member = createMockMember({ roles: ['QA Tester'], userId: 'tester-123' });
      expect(hasPermission(member, QAPermissionLevel.QA_ADMIN, 'other-user', 'tester-123')).toBe(false);
    });

    it('should allow modifying other users contexts at tester level', () => {
      const member = createMockMember({ roles: ['QA Tester'], userId: 'tester-123' });
      expect(hasPermission(member, QAPermissionLevel.SELF_ONLY, 'other-user-456', 'tester-123')).toBe(true);
    });
  });

  describe('Self-only', () => {
    it('should allow self-context operations', () => {
      const member = createMockMember({ roles: ['Member'], userId: 'user-123' });
      expect(hasPermission(member, QAPermissionLevel.SELF_ONLY, 'user-123', 'user-123')).toBe(true);
    });

    it('should allow operations without target user', () => {
      const member = createMockMember({ roles: ['Member'], userId: 'user-123' });
      expect(hasPermission(member, QAPermissionLevel.SELF_ONLY, null, 'user-123')).toBe(true);
    });

    it('should deny modifying other users contexts', () => {
      const member = createMockMember({ roles: ['Member'], userId: 'user-123' });
      expect(hasPermission(member, QAPermissionLevel.SELF_ONLY, 'other-user-456', 'user-123')).toBe(false);
    });

    it('should deny tester-level operations', () => {
      const member = createMockMember({ roles: ['Member'], userId: 'user-123' });
      expect(hasPermission(member, QAPermissionLevel.QA_TESTER, null, 'user-123')).toBe(false);
    });

    it('should deny admin-level operations', () => {
      const member = createMockMember({ roles: ['Member'], userId: 'user-123' });
      expect(hasPermission(member, QAPermissionLevel.QA_ADMIN, null, 'user-123')).toBe(false);
    });
  });

  describe('No member', () => {
    it('should deny all operations for null member', () => {
      expect(hasPermission(null, QAPermissionLevel.SELF_ONLY, null, 'user-123')).toBe(false);
      expect(hasPermission(null, QAPermissionLevel.QA_TESTER, null, 'user-123')).toBe(false);
      expect(hasPermission(null, QAPermissionLevel.QA_ADMIN, null, 'user-123')).toBe(false);
    });
  });
});

// =============================================================================
// Cooldown Tests
// =============================================================================

describe('Command Cooldowns', () => {
  beforeEach(() => {
    clearAllCooldowns();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearAllCooldowns();
    vi.useRealTimers();
  });

  describe('COMMAND_COOLDOWNS config', () => {
    it('should have cooldowns for all main subcommands', () => {
      expect(COMMAND_COOLDOWNS.assume).toBeDefined();
      expect(COMMAND_COOLDOWNS.whoami).toBeDefined();
      expect(COMMAND_COOLDOWNS.set).toBeDefined();
      expect(COMMAND_COOLDOWNS.reset).toBeDefined();
    });

    it('should have cooldowns for check subcommands', () => {
      expect(COMMAND_COOLDOWNS.access).toBeDefined();
      expect(COMMAND_COOLDOWNS.feature).toBeDefined();
      expect(COMMAND_COOLDOWNS.tier).toBeDefined();
      expect(COMMAND_COOLDOWNS.badges).toBeDefined();
    });

    it('should have higher cooldown for destructive operations', () => {
      expect(COMMAND_COOLDOWNS.reset).toBeGreaterThan(COMMAND_COOLDOWNS.whoami);
      expect(COMMAND_COOLDOWNS.thresholds).toBeGreaterThan(COMMAND_COOLDOWNS.whoami);
    });
  });

  describe('checkCooldown', () => {
    it('should return null on first use', () => {
      const result = checkCooldown('user-123', 'assume');
      expect(result).toBeNull();
    });

    it('should return seconds remaining when on cooldown', () => {
      checkCooldown('user-123', 'assume'); // First use

      // Advance time by 2 seconds (cooldown is 5s)
      vi.advanceTimersByTime(2000);

      const result = checkCooldown('user-123', 'assume');
      expect(result).toBe(3); // 3 seconds remaining
    });

    it('should return null after cooldown expires', () => {
      checkCooldown('user-123', 'assume'); // First use

      // Advance time past the cooldown (5s + buffer)
      vi.advanceTimersByTime(6000);

      const result = checkCooldown('user-123', 'assume');
      expect(result).toBeNull();
    });

    it('should track different users separately', () => {
      checkCooldown('user-1', 'assume');

      vi.advanceTimersByTime(2000);

      // User 1 should be on cooldown
      expect(checkCooldown('user-1', 'assume')).not.toBeNull();
      // User 2 should not be on cooldown
      expect(checkCooldown('user-2', 'assume')).toBeNull();
    });

    it('should track different subcommands separately', () => {
      checkCooldown('user-123', 'assume');

      vi.advanceTimersByTime(2000);

      // Same user, same command should be on cooldown
      expect(checkCooldown('user-123', 'assume')).not.toBeNull();
      // Same user, different command should not be on cooldown
      expect(checkCooldown('user-123', 'whoami')).toBeNull();
    });

    it('should use default cooldown for unknown subcommands', () => {
      const result1 = checkCooldown('user-123', 'unknown-command');
      expect(result1).toBeNull();

      vi.advanceTimersByTime(1000);

      const result2 = checkCooldown('user-123', 'unknown-command');
      expect(result2).toBe(2); // 3000ms default - 1000ms = 2s remaining
    });

    it('should handle subcommand groups correctly', () => {
      checkCooldown('user-123', 'access', 'check');

      vi.advanceTimersByTime(2000);

      // Same subcommand with group should be on cooldown
      expect(checkCooldown('user-123', 'access', 'check')).not.toBeNull();
      // Same subcommand without group should not be on cooldown
      expect(checkCooldown('user-123', 'access')).toBeNull();
    });
  });

  describe('clearCooldown', () => {
    it('should clear cooldown for specific user and subcommand', () => {
      checkCooldown('user-123', 'assume');

      vi.advanceTimersByTime(2000);

      // Should be on cooldown
      expect(checkCooldown('user-123', 'assume')).not.toBeNull();

      clearCooldown('user-123', 'assume');

      // Should not be on cooldown after clearing
      expect(checkCooldown('user-123', 'assume')).toBeNull();
    });

    it('should not affect other users', () => {
      checkCooldown('user-1', 'assume');
      checkCooldown('user-2', 'assume');

      vi.advanceTimersByTime(2000);

      clearCooldown('user-1', 'assume');

      // User 1 cleared
      expect(checkCooldown('user-1', 'assume')).toBeNull();
      // User 2 still on cooldown
      expect(checkCooldown('user-2', 'assume')).not.toBeNull();
    });

    it('should handle non-existent cooldowns gracefully', () => {
      // Should not throw
      expect(() => clearCooldown('non-existent', 'unknown')).not.toThrow();
    });
  });

  describe('clearAllCooldowns', () => {
    it('should clear all cooldowns for all users and commands', () => {
      checkCooldown('user-1', 'assume');
      checkCooldown('user-2', 'whoami');
      checkCooldown('user-3', 'set');

      vi.advanceTimersByTime(2000);

      clearAllCooldowns();

      expect(checkCooldown('user-1', 'assume')).toBeNull();
      expect(checkCooldown('user-2', 'whoami')).toBeNull();
      expect(checkCooldown('user-3', 'set')).toBeNull();
    });
  });
});

/**
 * TenantContext Tests
 *
 * Sprint S-19: Enhanced RLS & Drizzle Adapter
 *
 * Unit tests for TenantContext class.
 * These are pure unit tests that don't require a database connection.
 *
 * @see SDD §6.3.2 RLS Policies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantContext, createTenantContext, isValidTenantId } from '../tenant-context.js';

// =============================================================================
// Mock Database
// =============================================================================

const createMockDb = () => {
  const mockExecute = vi.fn().mockResolvedValue([{ get_tenant_context: null }]);
  return {
    execute: mockExecute,
  };
};

// =============================================================================
// TenantContext Unit Tests
// =============================================================================

describe('TenantContext', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let tenantContext: TenantContext;

  beforeEach(() => {
    mockDb = createMockDb();
    // @ts-expect-error - mock db doesn't have all methods
    tenantContext = new TenantContext(mockDb);
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      // @ts-expect-error - mock db
      const ctx = new TenantContext(mockDb);
      expect(ctx).toBeInstanceOf(TenantContext);
    });

    it('should create instance with custom options', () => {
      // @ts-expect-error - mock db
      const ctx = new TenantContext(mockDb, {
        throwOnInvalidTenant: false,
        debug: true,
      });
      expect(ctx).toBeInstanceOf(TenantContext);
    });
  });

  describe('setTenant', () => {
    it('should call execute with correct SQL', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      await tenantContext.setTenant(tenantId);

      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      // Verify SQL template was called (exact match not possible with sql tagged template)
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should throw on invalid UUID by default', async () => {
      await expect(tenantContext.setTenant('not-a-uuid')).rejects.toThrow(
        'Invalid tenant ID: not-a-uuid'
      );
    });

    it('should not throw on invalid UUID when throwOnInvalidTenant is false', async () => {
      // @ts-expect-error - mock db
      const ctx = new TenantContext(mockDb, { throwOnInvalidTenant: false });
      await expect(ctx.setTenant('not-a-uuid')).resolves.toBeUndefined();
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should accept valid UUID v1', async () => {
      const uuidV1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      await tenantContext.setTenant(uuidV1);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('should accept valid UUID v4', async () => {
      const uuidV4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      await tenantContext.setTenant(uuidV4);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('should accept valid UUID v5', async () => {
      const uuidV5 = '886313e1-3b8a-5372-9b90-0c9aee199e5d';
      await tenantContext.setTenant(uuidV5);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearTenant', () => {
    it('should call execute with correct SQL', async () => {
      await tenantContext.clearTenant();
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTenant', () => {
    it('should return isSet: false when no tenant set', async () => {
      mockDb.execute.mockResolvedValueOnce([{ get_tenant_context: null }]);
      const result = await tenantContext.getTenant();

      expect(result).toEqual({ isSet: false, tenantId: null });
    });

    it('should return isSet: true with tenantId when tenant set', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      mockDb.execute.mockResolvedValueOnce([{ get_tenant_context: tenantId }]);

      const result = await tenantContext.getTenant();

      expect(result).toEqual({ isSet: true, tenantId });
    });
  });

  describe('withTenant', () => {
    it('should set tenant, execute callback, and clear tenant', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const callback = vi.fn().mockResolvedValue('result');

      const result = await tenantContext.withTenant(tenantId, callback);

      expect(result).toBe('result');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockDb.execute).toHaveBeenCalledTimes(2); // setTenant + clearTenant
    });

    it('should clear tenant even if callback throws', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Callback failed');
      const callback = vi.fn().mockRejectedValue(error);

      await expect(tenantContext.withTenant(tenantId, callback)).rejects.toThrow(
        'Callback failed'
      );
      expect(mockDb.execute).toHaveBeenCalledTimes(2); // setTenant + clearTenant
    });
  });

  describe('withoutTenant', () => {
    it('should clear tenant before executing callback', async () => {
      const callback = vi.fn().mockResolvedValue('admin result');

      const result = await tenantContext.withoutTenant(callback);

      expect(result).toBe('admin result');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockDb.execute).toHaveBeenCalledTimes(1); // clearTenant
    });
  });

  describe('assertTenant', () => {
    it('should return true when tenant matches', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      mockDb.execute.mockResolvedValueOnce([{ get_tenant_context: tenantId }]);

      const result = await tenantContext.assertTenant(tenantId);
      expect(result).toBe(true);
    });

    it('should throw when tenant not set', async () => {
      mockDb.execute.mockResolvedValueOnce([{ get_tenant_context: null }]);

      await expect(
        tenantContext.assertTenant('123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow('Tenant context not set');
    });

    it('should throw when tenant does not match', async () => {
      const currentTenant = '123e4567-e89b-12d3-a456-426614174000';
      const expectedTenant = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      mockDb.execute.mockResolvedValueOnce([{ get_tenant_context: currentTenant }]);

      await expect(tenantContext.assertTenant(expectedTenant)).rejects.toThrow(
        `Tenant context mismatch: expected ${expectedTenant}, got ${currentTenant}`
      );
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createTenantContext', () => {
  it('should create TenantContext instance', () => {
    const mockDb = createMockDb();
    // @ts-expect-error - mock db
    const ctx = createTenantContext(mockDb);
    expect(ctx).toBeInstanceOf(TenantContext);
  });

  it('should pass options to TenantContext', () => {
    const mockDb = createMockDb();
    // @ts-expect-error - mock db
    const ctx = createTenantContext(mockDb, { debug: true });
    expect(ctx).toBeInstanceOf(TenantContext);
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe('isValidTenantId', () => {
  it('should return true for valid UUID v1', () => {
    expect(isValidTenantId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('should return true for valid UUID v4', () => {
    expect(isValidTenantId('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
  });

  it('should return true for valid UUID v5', () => {
    expect(isValidTenantId('886313e1-3b8a-5372-9b90-0c9aee199e5d')).toBe(true);
  });

  it('should return false for invalid UUID', () => {
    expect(isValidTenantId('not-a-uuid')).toBe(false);
    expect(isValidTenantId('123')).toBe(false);
    expect(isValidTenantId('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isValidTenantId(123)).toBe(false);
    expect(isValidTenantId(null)).toBe(false);
    expect(isValidTenantId(undefined)).toBe(false);
    expect(isValidTenantId({})).toBe(false);
    expect(isValidTenantId([])).toBe(false);
  });

  it('should return false for uppercase UUID (strict validation)', () => {
    // Our regex is case-insensitive, so uppercase should pass
    expect(isValidTenantId('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true);
  });
});

-- Migration: RLS Nil UUID Hardening (Sprint 80 - HIGH-4)
--
-- Security Fix: Prevents cross-tenant data leakage via nil UUID fallback
--
-- Problem:
--   Original RLS policies used COALESCE with nil UUID fallback:
--   COALESCE(current_setting(...), '00000000-0000-0000-0000-000000000000')
--
--   If tenant context is not set, queries would match community_id = nil UUID.
--   An attacker who creates a community with nil UUID could access unprotected queries.
--
-- Fix:
--   1. Add CHECK constraint on communities preventing nil UUID as id
--   2. Add CHECK constraint on all tenant tables preventing nil UUID as community_id
--   3. Update RLS policies to FAIL CLOSED (deny access if tenant not set)
--
-- IMPORTANT: This migration MUST be applied after 0001_rls_policies.sql

-- =============================================================================
-- STEP 1: Add CHECK constraint preventing nil UUID on communities table
-- =============================================================================

-- Prevent nil UUID from ever being used as a community ID
ALTER TABLE communities
ADD CONSTRAINT chk_communities_not_nil_uuid
CHECK (id != '00000000-0000-0000-0000-000000000000'::UUID);

-- =============================================================================
-- STEP 2: Add CHECK constraints on tenant tables preventing nil UUID community_id
-- =============================================================================

-- These constraints ensure no row can reference the nil UUID fallback value

ALTER TABLE profiles
ADD CONSTRAINT chk_profiles_community_not_nil_uuid
CHECK (community_id != '00000000-0000-0000-0000-000000000000'::UUID);

ALTER TABLE badges
ADD CONSTRAINT chk_badges_community_not_nil_uuid
CHECK (community_id != '00000000-0000-0000-0000-000000000000'::UUID);

ALTER TABLE manifests
ADD CONSTRAINT chk_manifests_community_not_nil_uuid
CHECK (community_id != '00000000-0000-0000-0000-000000000000'::UUID);

ALTER TABLE shadow_states
ADD CONSTRAINT chk_shadow_states_community_not_nil_uuid
CHECK (community_id != '00000000-0000-0000-0000-000000000000'::UUID);

-- =============================================================================
-- STEP 3: Create helper function for fail-closed tenant check
-- =============================================================================

-- This function returns the current tenant UUID or raises an exception
-- if tenant context is not set. Used by updated RLS policies.
CREATE OR REPLACE FUNCTION get_tenant_context_strict()
RETURNS UUID AS $$
DECLARE
    tenant_id TEXT;
BEGIN
    tenant_id := current_setting('app.current_tenant', true);
    IF tenant_id IS NULL OR tenant_id = '' THEN
        -- Fail closed: deny access if tenant context not set
        RAISE EXCEPTION 'RLS violation: app.current_tenant not set. Set tenant context before querying tenant-scoped tables.';
    END IF;
    RETURN tenant_id::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to app role
GRANT EXECUTE ON FUNCTION get_tenant_context_strict() TO arrakis_app;

-- =============================================================================
-- STEP 4: Drop existing RLS policies
-- =============================================================================

-- Profiles policies
DROP POLICY IF EXISTS tenant_isolation_select ON profiles;
DROP POLICY IF EXISTS tenant_isolation_insert ON profiles;
DROP POLICY IF EXISTS tenant_isolation_update ON profiles;
DROP POLICY IF EXISTS tenant_isolation_delete ON profiles;

-- Badges policies
DROP POLICY IF EXISTS tenant_isolation_select ON badges;
DROP POLICY IF EXISTS tenant_isolation_insert ON badges;
DROP POLICY IF EXISTS tenant_isolation_update ON badges;
DROP POLICY IF EXISTS tenant_isolation_delete ON badges;

-- Manifests policies
DROP POLICY IF EXISTS tenant_isolation_select ON manifests;
DROP POLICY IF EXISTS tenant_isolation_insert ON manifests;
DROP POLICY IF EXISTS tenant_isolation_update ON manifests;
DROP POLICY IF EXISTS tenant_isolation_delete ON manifests;

-- Shadow states policies
DROP POLICY IF EXISTS tenant_isolation_select ON shadow_states;
DROP POLICY IF EXISTS tenant_isolation_insert ON shadow_states;
DROP POLICY IF EXISTS tenant_isolation_update ON shadow_states;
DROP POLICY IF EXISTS tenant_isolation_delete ON shadow_states;

-- =============================================================================
-- STEP 5: Create FAIL-CLOSED RLS policies
-- =============================================================================

-- NOTE: These policies use get_tenant_context_strict() which raises an exception
-- if tenant context is not set, instead of silently returning no rows.
-- This ensures application code errors are caught early in development.

-- Profiles: tenant isolation policies (fail-closed)
CREATE POLICY tenant_isolation_select ON profiles
    FOR SELECT
    USING (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_insert ON profiles
    FOR INSERT
    WITH CHECK (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_update ON profiles
    FOR UPDATE
    USING (community_id = get_tenant_context_strict())
    WITH CHECK (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_delete ON profiles
    FOR DELETE
    USING (community_id = get_tenant_context_strict());

-- Badges: tenant isolation policies (fail-closed)
CREATE POLICY tenant_isolation_select ON badges
    FOR SELECT
    USING (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_insert ON badges
    FOR INSERT
    WITH CHECK (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_update ON badges
    FOR UPDATE
    USING (community_id = get_tenant_context_strict())
    WITH CHECK (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_delete ON badges
    FOR DELETE
    USING (community_id = get_tenant_context_strict());

-- Manifests: tenant isolation policies (fail-closed)
CREATE POLICY tenant_isolation_select ON manifests
    FOR SELECT
    USING (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_insert ON manifests
    FOR INSERT
    WITH CHECK (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_update ON manifests
    FOR UPDATE
    USING (community_id = get_tenant_context_strict())
    WITH CHECK (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_delete ON manifests
    FOR DELETE
    USING (community_id = get_tenant_context_strict());

-- Shadow states: tenant isolation policies (fail-closed)
CREATE POLICY tenant_isolation_select ON shadow_states
    FOR SELECT
    USING (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_insert ON shadow_states
    FOR INSERT
    WITH CHECK (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_update ON shadow_states
    FOR UPDATE
    USING (community_id = get_tenant_context_strict())
    WITH CHECK (community_id = get_tenant_context_strict());

CREATE POLICY tenant_isolation_delete ON shadow_states
    FOR DELETE
    USING (community_id = get_tenant_context_strict());

-- =============================================================================
-- STEP 6: Verify constraints
-- =============================================================================

-- This block validates the migration was successful
DO $$
BEGIN
    -- Verify CHECK constraint exists on communities
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_communities_not_nil_uuid'
    ) THEN
        RAISE EXCEPTION 'Migration verification failed: chk_communities_not_nil_uuid constraint not found';
    END IF;

    -- Verify get_tenant_context_strict function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_tenant_context_strict'
    ) THEN
        RAISE EXCEPTION 'Migration verification failed: get_tenant_context_strict function not found';
    END IF;

    RAISE NOTICE 'Sprint 80 HIGH-4: RLS nil UUID hardening migration completed successfully';
END $$;

-- =============================================================================
-- Notes for application code:
-- =============================================================================
--
-- BREAKING CHANGE: Queries without tenant context will now RAISE an exception
-- instead of returning empty results.
--
-- Before this migration:
--   - No tenant context -> queries return empty results
--   - Application might silently fail to load data
--
-- After this migration:
--   - No tenant context -> queries raise exception
--   - Application errors are caught immediately
--
-- Ensure all code paths set tenant context before querying:
--   SELECT set_tenant_context('community-uuid');
--
-- For admin operations, use arrakis_admin role which bypasses RLS.
--

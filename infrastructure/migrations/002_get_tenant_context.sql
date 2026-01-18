-- Migration: 002_get_tenant_context.sql
-- Sprint S-19: Enhanced RLS & Drizzle Adapter
--
-- Adds get_tenant_context function to retrieve current tenant context.
-- Used by TenantContext.getTenant() for defensive programming.

-- =============================================================================
-- GET TENANT CONTEXT FUNCTION
-- =============================================================================

-- Function to get current tenant context
CREATE OR REPLACE FUNCTION get_tenant_context() RETURNS UUID AS $$
DECLARE
    v_tenant TEXT;
BEGIN
    v_tenant := current_setting('app.current_tenant', true);

    -- Return NULL if empty or not set
    IF v_tenant IS NULL OR v_tenant = '' THEN
        RETURN NULL;
    END IF;

    -- Safely cast to UUID
    BEGIN
        RETURN v_tenant::UUID;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION get_tenant_context IS 'Returns the current tenant UUID from session context, or NULL if not set';

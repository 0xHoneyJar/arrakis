-- Migration: Wallet Verification Sessions Table
--
-- Sprint 78: Native Wallet Verification
--
-- Creates the wallet_verification_sessions table for native wallet
-- verification, enabling Arrakis communities to verify wallet ownership
-- without Collab.Land dependency.
--
-- Session flow:
-- 1. User runs /verify -> session created with status='pending'
-- 2. User signs message with wallet -> session updated to status='completed'
-- 3. Session expires after TTL -> status='expired'
-- 4. Too many failed attempts -> status='failed'

-- =============================================================================
-- STEP 1: Create wallet_verification_sessions table
-- =============================================================================

CREATE TABLE "wallet_verification_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_guild_id" text NOT NULL,
	"discord_username" text NOT NULL,
	"nonce" text NOT NULL,
	"wallet_address" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"error_message" text,
	CONSTRAINT "wallet_verification_sessions_nonce_unique" UNIQUE("nonce")
);

--> statement-breakpoint
ALTER TABLE "wallet_verification_sessions" ADD CONSTRAINT "wallet_verification_sessions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX "idx_wallet_verification_sessions_community" ON "wallet_verification_sessions" USING btree ("community_id");
--> statement-breakpoint
CREATE INDEX "idx_wallet_verification_sessions_discord_user" ON "wallet_verification_sessions" USING btree ("community_id","discord_user_id");
--> statement-breakpoint
CREATE INDEX "idx_wallet_verification_sessions_status" ON "wallet_verification_sessions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_wallet_verification_sessions_expires" ON "wallet_verification_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "idx_wallet_verification_sessions_nonce" ON "wallet_verification_sessions" USING btree ("nonce");

-- =============================================================================
-- STEP 2: Add CHECK constraint for status values
-- =============================================================================

ALTER TABLE "wallet_verification_sessions" ADD CONSTRAINT "wallet_verification_sessions_status_check"
CHECK ("status" IN ('pending', 'completed', 'expired', 'failed'));

-- =============================================================================
-- STEP 3: Grant table permissions to app role
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON wallet_verification_sessions TO arrakis_app;
GRANT ALL ON wallet_verification_sessions TO arrakis_admin;

-- =============================================================================
-- STEP 4: Enable Row-Level Security
-- =============================================================================

ALTER TABLE wallet_verification_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 5: Create tenant isolation policies
-- =============================================================================

-- SELECT policy
CREATE POLICY tenant_isolation_select ON wallet_verification_sessions
    FOR SELECT
    USING (community_id = COALESCE(
        NULLIF(current_setting('app.current_tenant', true), '')::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    ));

-- INSERT policy
CREATE POLICY tenant_isolation_insert ON wallet_verification_sessions
    FOR INSERT
    WITH CHECK (community_id = COALESCE(
        NULLIF(current_setting('app.current_tenant', true), '')::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    ));

-- UPDATE policy
CREATE POLICY tenant_isolation_update ON wallet_verification_sessions
    FOR UPDATE
    USING (community_id = COALESCE(
        NULLIF(current_setting('app.current_tenant', true), '')::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    ))
    WITH CHECK (community_id = COALESCE(
        NULLIF(current_setting('app.current_tenant', true), '')::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    ));

-- DELETE policy
CREATE POLICY tenant_isolation_delete ON wallet_verification_sessions
    FOR DELETE
    USING (community_id = COALESCE(
        NULLIF(current_setting('app.current_tenant', true), '')::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    ));

-- =============================================================================
-- STEP 6: Force RLS for table owner
-- =============================================================================

ALTER TABLE wallet_verification_sessions FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- Notes:
-- =============================================================================
--
-- Usage:
--   1. Set tenant context: SELECT set_tenant_context('community-uuid');
--   2. Create session: INSERT INTO wallet_verification_sessions (...)
--   3. Query sessions: SELECT * FROM wallet_verification_sessions WHERE ...
--   4. Clear context: SELECT clear_tenant_context();
--
-- Session lifecycle:
--   - Sessions expire after 15 minutes (configured in application)
--   - Max 3 verification attempts per session
--   - Cleanup job marks expired sessions periodically
--

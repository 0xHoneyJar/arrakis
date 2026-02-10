-- =============================================================================
-- Agent Usage Log — Hounfour Integration (Sprint 192, cycle-012)
-- =============================================================================
-- Extends agent_usage_log for inbound loa-finn usage reports:
-- 1. Migrates cost_cents from integer to bigint (safe implicit cast)
-- 2. Adds report_id, pool_id, cost_micro_usd, original_jti columns
-- 3. Creates partial unique index on report_id for idempotent writes
--
-- All changes are additive-only. Existing rows unaffected (new columns nullable).
-- @see ADR-005, SDD §3.2 UsageReceiver
-- =============================================================================

-- Step 1: Migrate cost_cents from integer to bigint
-- Safe: int4 → int8 implicit cast, no data rewrite for existing values.
-- If already bigint, this is a no-op (Postgres accepts ALTER to same type).
ALTER TABLE agent_usage_log ALTER COLUMN cost_cents TYPE bigint;

-- Step 2: Add new columns for loa-finn usage reports (all nullable)
ALTER TABLE agent_usage_log ADD COLUMN IF NOT EXISTS report_id TEXT;
ALTER TABLE agent_usage_log ADD COLUMN IF NOT EXISTS pool_id TEXT;
ALTER TABLE agent_usage_log ADD COLUMN IF NOT EXISTS cost_micro_usd BIGINT;
ALTER TABLE agent_usage_log ADD COLUMN IF NOT EXISTS original_jti TEXT;

-- Step 3: Partial unique index on report_id for idempotent dedup
-- Only indexes rows WHERE report_id IS NOT NULL (existing rows unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_usage_log_report_id
  ON agent_usage_log (report_id)
  WHERE report_id IS NOT NULL;

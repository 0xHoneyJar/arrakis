/**
 * PostgreSQL Schema for Eligibility Tables (Sprint 175)
 *
 * These tables are GLOBAL (no community_id foreign key) because eligibility
 * is chain-level data (top 69 BGT holders on Berachain) - the same across
 * all communities.
 *
 * No RLS policies - direct queries without TenantContext wrapper.
 *
 * @module db/pg-schema
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  bigint,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * T-1: Current eligibility (fast lookups for top 69 wallets)
 *
 * Primary table for checking if a wallet is currently eligible.
 * Updated atomically when a new snapshot is saved.
 */
export const eligibilityCurrent = pgTable('eligibility_current', {
  /** Wallet address (lowercase, primary key) */
  address: text('address').primaryKey(),
  /** Rank 1-69 in the eligibility list */
  rank: integer('rank').notNull(),
  /** Total BGT claimed from reward vaults */
  bgtClaimed: bigint('bgt_claimed', { mode: 'bigint' }).notNull(),
  /** Total BGT burned (redeemed for BERA) */
  bgtBurned: bigint('bgt_burned', { mode: 'bigint' }).notNull(),
  /** Net BGT held (claimed - burned) */
  bgtHeld: bigint('bgt_held', { mode: 'bigint' }).notNull(),
  /** Assigned role based on rank: naib (1-7), fedaykin (8-69), none (70+) */
  role: text('role').notNull(),
  /** When this entry was last updated */
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * T-2: Historical snapshots
 *
 * Stores complete eligibility snapshots as JSON for historical analysis
 * and diff computation.
 */
export const eligibilitySnapshots = pgTable('eligibility_snapshots', {
  /** Auto-incrementing ID */
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  /** Full eligibility list as JSON array */
  data: jsonb('data').notNull(),
  /** When this snapshot was created */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * T-3: Admin overrides
 *
 * Manual adjustments to eligibility (add/remove wallets).
 * Used for special cases like team members or banned addresses.
 */
export const eligibilityAdminOverrides = pgTable('eligibility_admin_overrides', {
  /** Auto-incrementing ID */
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  /** Wallet address to override */
  address: text('address').notNull(),
  /** Override action: 'add' or 'remove' */
  action: text('action').notNull(),
  /** Reason for the override */
  reason: text('reason').notNull(),
  /** Admin who created the override (Discord ID or identifier) */
  createdBy: text('created_by').notNull(),
  /** When the override expires (null = permanent) */
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  /** Whether the override is currently active */
  active: boolean('active').default(true).notNull(),
  /** When the override was created */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * T-4: Health status (singleton)
 *
 * Tracks service health for the eligibility sync job.
 * Single row with id=1.
 */
export const eligibilityHealthStatus = pgTable('eligibility_health_status', {
  /** Always 1 (singleton pattern) */
  id: integer('id').primaryKey().default(1),
  /** Last successful sync timestamp */
  lastSuccess: timestamp('last_success', { withTimezone: true }),
  /** Last failed sync timestamp */
  lastFailure: timestamp('last_failure', { withTimezone: true }),
  /** Number of consecutive failures */
  consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
  /** Whether service is in grace period (no revocations) */
  inGracePeriod: boolean('in_grace_period').default(false).notNull(),
  /** Last synced block number for incremental sync */
  lastSyncedBlock: bigint('last_synced_block', { mode: 'bigint' }),
  /** When this row was last updated */
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * T-5: Wallet verifications
 *
 * Maps Discord users to verified wallet addresses.
 * Used for eligibility checks after wallet verification.
 */
export const walletVerifications = pgTable('wallet_verifications', {
  /** Discord user ID (primary key) */
  discordUserId: text('discord_user_id').primaryKey(),
  /** Verified wallet address */
  walletAddress: text('wallet_address').notNull(),
  /** When verification was completed */
  verifiedAt: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
  /** EIP-191 signature (for audit) */
  signature: text('signature'),
  /** Signed message (for audit) */
  message: text('message'),
});

/**
 * T-6: Cached claim events
 *
 * Caches RewardPaid events from reward vaults for faster sync.
 * Composite primary key: (tx_hash, log_index)
 */
export const eligibilityClaimEvents = pgTable('eligibility_claim_events', {
  /** Transaction hash */
  txHash: text('tx_hash').notNull(),
  /** Log index within the transaction */
  logIndex: integer('log_index').notNull(),
  /** Block number */
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  /** Recipient wallet address */
  address: text('address').notNull(),
  /** Amount claimed (wei) */
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  /** Reward vault address */
  vaultAddress: text('vault_address').notNull(),
  /** When this event was cached */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.txHash, table.logIndex] }),
}));

/**
 * T-7: Cached burn events
 *
 * Caches Transfer to 0x0 events (BGT burns) for faster sync.
 * Composite primary key: (tx_hash, log_index)
 */
export const eligibilityBurnEvents = pgTable('eligibility_burn_events', {
  /** Transaction hash */
  txHash: text('tx_hash').notNull(),
  /** Log index within the transaction */
  logIndex: integer('log_index').notNull(),
  /** Block number */
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  /** Wallet that burned BGT */
  fromAddress: text('from_address').notNull(),
  /** Amount burned (wei) */
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  /** When this event was cached */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.txHash, table.logIndex] }),
}));

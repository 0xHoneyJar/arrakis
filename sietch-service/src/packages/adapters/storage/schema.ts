/**
 * Drizzle Schema - PostgreSQL Database Schema
 *
 * Sprint 38: Drizzle Schema Design
 *
 * Multi-tenant schema with Row-Level Security (RLS) support.
 * All tenant-scoped tables include community_id foreign key.
 *
 * Tables:
 * - communities: Tenant root table (theme, subscription)
 * - profiles: Member profiles with wallet, tier, activity
 * - badges: Earned badges with lineage support (awarded_by)
 * - manifests: Configuration versioning with JSONB content
 * - shadow_states: Discord resource mappings for reconciliation
 *
 * @module packages/adapters/storage/schema
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  unique,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// Communities Table
// =============================================================================

/**
 * Communities - Tenant root table
 *
 * Each community represents a single Discord/Telegram server using Arrakis.
 * No RLS on this table (community lookup happens before tenant context is set).
 */
export const communities = pgTable(
  'communities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    themeId: text('theme_id').notNull().default('basic'),
    subscriptionTier: text('subscription_tier').notNull().default('free'),
    discordGuildId: text('discord_guild_id').unique(),
    telegramChatId: text('telegram_chat_id').unique(),
    isActive: boolean('is_active').notNull().default(true),
    settings: jsonb('settings').$type<CommunitySettings>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    themeIdx: index('idx_communities_theme').on(table.themeId),
    discordGuildIdx: index('idx_communities_discord_guild').on(table.discordGuildId),
    subscriptionIdx: index('idx_communities_subscription').on(table.subscriptionTier),
  })
);

/**
 * Community settings stored as JSONB
 */
export interface CommunitySettings {
  /** Custom role prefix for Discord roles */
  rolePrefix?: string;
  /** Whether to sync roles automatically */
  autoSync?: boolean;
  /** Sync interval in minutes */
  syncInterval?: number;
  /** Custom welcome message template */
  welcomeMessage?: string;
  /** Admin notification webhook */
  adminWebhook?: string;
}

// =============================================================================
// Profiles Table
// =============================================================================

/**
 * Profiles - Member profiles with tenant isolation
 *
 * RLS Policy: community_id = current_setting('app.current_tenant')::UUID
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    discordId: text('discord_id'),
    telegramId: text('telegram_id'),
    walletAddress: text('wallet_address'),
    tier: text('tier'),
    currentRank: integer('current_rank'),
    activityScore: integer('activity_score').notNull().default(0),
    convictionScore: integer('conviction_score').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    firstClaimAt: timestamp('first_claim_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<ProfileMetadata>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    communityIdx: index('idx_profiles_community').on(table.communityId),
    walletIdx: index('idx_profiles_wallet').on(table.walletAddress),
    tierIdx: index('idx_profiles_tier').on(table.communityId, table.tier),
    rankIdx: index('idx_profiles_rank').on(table.communityId, table.currentRank),
    discordUnique: unique('uq_profiles_discord').on(table.communityId, table.discordId),
    telegramUnique: unique('uq_profiles_telegram').on(table.communityId, table.telegramId),
  })
);

/**
 * Profile metadata stored as JSONB
 */
export interface ProfileMetadata {
  /** Username from Discord/Telegram */
  username?: string;
  /** Display name */
  displayName?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** ENS name if resolved */
  ensName?: string;
  /** Highest tier ever achieved */
  highestTier?: string;
  /** Highest rank ever achieved */
  highestRank?: number;
  /** Custom user preferences */
  preferences?: Record<string, unknown>;
}

// =============================================================================
// Badges Table
// =============================================================================

/**
 * Badges - Earned badges with lineage support
 *
 * Self-referencing FK for Water Sharer lineage (awarded_by).
 * RLS Policy: community_id = current_setting('app.current_tenant')::UUID
 */
export const badges = pgTable(
  'badges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    badgeType: text('badge_type').notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
    // Self-referencing FK for lineage (Water Sharer)
    awardedBy: uuid('awarded_by').references(() => profiles.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<BadgeMetadata>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index('idx_badges_profile').on(table.profileId),
    typeIdx: index('idx_badges_type').on(table.communityId, table.badgeType),
    awardedByIdx: index('idx_badges_awarded_by').on(table.awardedBy),
    uniqueBadge: unique('uq_badges_profile_type').on(
      table.communityId,
      table.profileId,
      table.badgeType
    ),
  })
);

/**
 * Badge metadata stored as JSONB
 */
export interface BadgeMetadata {
  /** Display name at time of award */
  badgeName?: string;
  /** Emoji at time of award */
  emoji?: string;
  /** Tier at time of award (for tier-based badges) */
  tierAtAward?: string;
  /** Rank at time of award */
  rankAtAward?: number;
  /** Additional context (e.g., lineage chain) */
  context?: Record<string, unknown>;
}

// =============================================================================
// Manifests Table
// =============================================================================

/**
 * Manifests - Configuration versioning with JSONB content
 *
 * Stores the desired state configuration for each community.
 * Version increments on each change for audit trail.
 * RLS Policy: community_id = current_setting('app.current_tenant')::UUID
 */
export const manifests = pgTable(
  'manifests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    content: jsonb('content').$type<ManifestContent>().notNull(),
    checksum: text('checksum').notNull(),
    synthesizedAt: timestamp('synthesized_at', { withTimezone: true }).notNull().defaultNow(),
    synthesizedBy: text('synthesized_by'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    communityIdx: index('idx_manifests_community').on(table.communityId),
    versionIdx: index('idx_manifests_version').on(table.communityId, table.version),
    activeIdx: index('idx_manifests_active').on(table.communityId, table.isActive),
    uniqueVersion: unique('uq_manifests_community_version').on(table.communityId, table.version),
  })
);

/**
 * Manifest content stored as JSONB
 *
 * Represents the desired state of a community's Discord/Telegram configuration.
 */
export interface ManifestContent {
  /** Schema version for forward compatibility */
  schemaVersion: string;
  /** Theme configuration */
  theme: {
    themeId: string;
    tierOverrides?: Record<string, unknown>;
    badgeOverrides?: Record<string, unknown>;
  };
  /** Role definitions */
  roles: ManifestRole[];
  /** Channel definitions */
  channels: ManifestChannel[];
  /** Category definitions */
  categories: ManifestCategory[];
  /** Eligibility rules */
  eligibility?: {
    tokenAddress?: string;
    minBalance?: string;
    nftCollections?: string[];
  };
}

export interface ManifestRole {
  id: string;
  name: string;
  color: string;
  tierId?: string;
  permissions?: string[];
}

export interface ManifestChannel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'announcement' | 'forum';
  categoryId?: string;
  topic?: string;
  tierRestriction?: string;
}

export interface ManifestCategory {
  id: string;
  name: string;
  tierRestriction?: string;
}

// =============================================================================
// Shadow States Table
// =============================================================================

/**
 * Shadow States - Discord resource mappings for reconciliation
 *
 * Maps manifest IDs to actual Discord resource IDs.
 * Used for drift detection and reconciliation.
 * RLS Policy: community_id = current_setting('app.current_tenant')::UUID
 */
export const shadowStates = pgTable(
  'shadow_states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    manifestVersion: integer('manifest_version').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    appliedBy: text('applied_by'),
    resources: jsonb('resources').$type<ShadowResources>().notNull(),
    checksum: text('checksum').notNull(),
    status: text('status').notNull().default('applied'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    communityIdx: index('idx_shadow_community').on(table.communityId),
    statusIdx: index('idx_shadow_status').on(table.communityId, table.status),
  })
);

/**
 * Shadow resources mapping manifest IDs to Discord IDs
 */
export interface ShadowResources {
  /** Role mappings: manifest role ID -> Discord role ID */
  roles: Record<string, string>;
  /** Channel mappings: manifest channel ID -> Discord channel ID */
  channels: Record<string, string>;
  /** Category mappings: manifest category ID -> Discord category ID */
  categories: Record<string, string>;
}

// =============================================================================
// Drizzle Relations
// =============================================================================

/**
 * Community relations
 */
export const communitiesRelations = relations(communities, ({ many }) => ({
  profiles: many(profiles),
  badges: many(badges),
  manifests: many(manifests),
  shadowStates: many(shadowStates),
}));

/**
 * Profile relations
 */
export const profilesRelations = relations(profiles, ({ one, many }) => ({
  community: one(communities, {
    fields: [profiles.communityId],
    references: [communities.id],
  }),
  badges: many(badges),
  awardedBadges: many(badges, { relationName: 'awardedBy' }),
}));

/**
 * Badge relations
 */
export const badgesRelations = relations(badges, ({ one }) => ({
  community: one(communities, {
    fields: [badges.communityId],
    references: [communities.id],
  }),
  profile: one(profiles, {
    fields: [badges.profileId],
    references: [profiles.id],
  }),
  awarder: one(profiles, {
    fields: [badges.awardedBy],
    references: [profiles.id],
    relationName: 'awardedBy',
  }),
}));

/**
 * Manifest relations
 */
export const manifestsRelations = relations(manifests, ({ one }) => ({
  community: one(communities, {
    fields: [manifests.communityId],
    references: [communities.id],
  }),
}));

/**
 * Shadow state relations
 */
export const shadowStatesRelations = relations(shadowStates, ({ one }) => ({
  community: one(communities, {
    fields: [shadowStates.communityId],
    references: [communities.id],
  }),
}));

// =============================================================================
// Type Exports
// =============================================================================

export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;

export type Manifest = typeof manifests.$inferSelect;
export type NewManifest = typeof manifests.$inferInsert;

export type ShadowState = typeof shadowStates.$inferSelect;
export type NewShadowState = typeof shadowStates.$inferInsert;

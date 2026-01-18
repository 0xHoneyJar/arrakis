/**
 * Drizzle Schema - PostgreSQL Database Schema
 *
 * Sprint S-19: Enhanced RLS & Drizzle Adapter
 *
 * Multi-tenant schema with Row-Level Security (RLS) support.
 * All tenant-scoped tables include community_id foreign key.
 *
 * Tables:
 * - communities: Tenant root table (theme, subscription)
 * - profiles: Member profiles with wallet, tier, activity
 * - badges: Earned badges with lineage support (awarded_by)
 *
 * @see SDD §6.3 PostgreSQL Multi-Tenant
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

import type {
  CommunitySettings,
  ProfileMetadata,
  BadgeMetadata,
} from '../../core/ports/storage-provider.js';

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

// =============================================================================
// Drizzle Relations
// =============================================================================

/**
 * Community relations
 */
export const communitiesRelations = relations(communities, ({ many }) => ({
  profiles: many(profiles),
  badges: many(badges),
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

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Inferred community type from Drizzle schema
 */
export type DrizzleCommunity = typeof communities.$inferSelect;
export type DrizzleNewCommunity = typeof communities.$inferInsert;

/**
 * Inferred profile type from Drizzle schema
 */
export type DrizzleProfile = typeof profiles.$inferSelect;
export type DrizzleNewProfile = typeof profiles.$inferInsert;

/**
 * Inferred badge type from Drizzle schema
 */
export type DrizzleBadge = typeof badges.$inferSelect;
export type DrizzleNewBadge = typeof badges.$inferInsert;

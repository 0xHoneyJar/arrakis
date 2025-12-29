# Sprint 38: Drizzle Schema Design - Implementation Report

> Implementation by: Senior Engineer Agent
> Date: 2025-12-28
> Sprint Goal: Design and implement PostgreSQL schema with Drizzle ORM

## Executive Summary

Successfully implemented the PostgreSQL schema with Drizzle ORM for multi-tenant data storage. Created 5 tables with proper foreign keys, indexes, JSONB columns, and prepared for Row-Level Security (RLS). All acceptance criteria met with 54 comprehensive tests.

## Implementation Overview

### Files Created

| File | Lines | Description |
|------|-------|-------------|
| `src/packages/adapters/storage/schema.ts` | ~450 | Core Drizzle schema with all tables |
| `src/packages/adapters/storage/index.ts` | ~45 | Public exports |
| `drizzle.config.ts` | ~20 | Drizzle Kit configuration |
| `drizzle/migrations/0000_swift_sleeper.sql` | ~94 | Initial migration |
| `drizzle/init/01-init.sql` | ~40 | PostgreSQL init script |
| `docker-compose.yml` | ~40 | Dev environment setup |
| `tests/unit/packages/adapters/storage/schema.test.ts` | ~600 | 54 unit tests |

### Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added drizzle-orm, pg, drizzle-kit deps + db:* scripts |

## Technical Implementation

### 1. Communities Table (Tenant Root)

```typescript
communities: {
  id: uuid PK,
  name: text NOT NULL,
  theme_id: text DEFAULT 'basic',
  subscription_tier: text DEFAULT 'free',
  discord_guild_id: text UNIQUE,
  telegram_chat_id: text UNIQUE,
  is_active: boolean DEFAULT true,
  settings: jsonb<CommunitySettings>,
  created_at, updated_at: timestamptz
}
```

**Indexes:**
- `idx_communities_theme`
- `idx_communities_discord_guild`
- `idx_communities_subscription`

### 2. Profiles Table (Tenant-Scoped)

```typescript
profiles: {
  id: uuid PK,
  community_id: uuid FK → communities ON DELETE CASCADE,
  discord_id, telegram_id, wallet_address: text,
  tier: text,
  current_rank, activity_score, conviction_score: integer,
  joined_at, last_seen_at, first_claim_at: timestamptz,
  metadata: jsonb<ProfileMetadata>,
  created_at, updated_at: timestamptz
}
```

**Constraints:**
- `uq_profiles_discord` - UNIQUE(community_id, discord_id)
- `uq_profiles_telegram` - UNIQUE(community_id, telegram_id)

**Indexes:**
- `idx_profiles_community`
- `idx_profiles_wallet`
- `idx_profiles_tier` (community_id, tier)
- `idx_profiles_rank` (community_id, current_rank)

### 3. Badges Table (Lineage Support)

```typescript
badges: {
  id: uuid PK,
  community_id: uuid FK → communities ON DELETE CASCADE,
  profile_id: uuid FK → profiles ON DELETE CASCADE,
  badge_type: text NOT NULL,
  awarded_at: timestamptz,
  awarded_by: uuid FK → profiles ON DELETE SET NULL,  // Water Sharer lineage
  revoked_at: timestamptz,
  metadata: jsonb<BadgeMetadata>,
  created_at: timestamptz
}
```

**Key Feature:** Self-referencing FK for Water Sharer badge lineage with `ON DELETE SET NULL` to preserve history.

**Constraint:**
- `uq_badges_profile_type` - UNIQUE(community_id, profile_id, badge_type)

**Indexes:**
- `idx_badges_profile`
- `idx_badges_type` (community_id, badge_type)
- `idx_badges_awarded_by`

### 4. Manifests Table (Configuration Versioning)

```typescript
manifests: {
  id: uuid PK,
  community_id: uuid FK → communities ON DELETE CASCADE,
  version: integer NOT NULL,
  content: jsonb<ManifestContent> NOT NULL,
  checksum: text NOT NULL,
  synthesized_at: timestamptz,
  synthesized_by: text,
  is_active: boolean DEFAULT true,
  created_at: timestamptz
}
```

**JSONB Content Structure:**
```typescript
ManifestContent {
  schemaVersion: string,
  theme: { themeId, tierOverrides?, badgeOverrides? },
  roles: ManifestRole[],
  channels: ManifestChannel[],
  categories: ManifestCategory[],
  eligibility?: { tokenAddress?, minBalance?, nftCollections? }
}
```

**Constraint:**
- `uq_manifests_community_version` - UNIQUE(community_id, version)

### 5. Shadow States Table (Reconciliation)

```typescript
shadow_states: {
  id: uuid PK,
  community_id: uuid FK → communities ON DELETE CASCADE,
  manifest_version: integer NOT NULL,
  applied_at: timestamptz,
  applied_by: text,
  resources: jsonb<ShadowResources> NOT NULL,
  checksum: text NOT NULL,
  status: text DEFAULT 'applied',
  created_at: timestamptz
}
```

**Shadow Resources Mapping:**
```typescript
ShadowResources {
  roles: Record<manifestId, discordId>,
  channels: Record<manifestId, discordId>,
  categories: Record<manifestId, discordId>
}
```

## Dependencies Added

```json
{
  "dependencies": {
    "drizzle-orm": "^0.45.1",
    "postgres": "^3.4.7",
    "pg": "^8.16.3"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.8",
    "@types/pg": "^8.16.0"
  }
}
```

## NPM Scripts Added

| Script | Command |
|--------|---------|
| `db:generate` | `drizzle-kit generate` |
| `db:migrate` | `drizzle-kit migrate` |
| `db:push` | `drizzle-kit push` |
| `db:studio` | `drizzle-kit studio` |
| `db:check` | `drizzle-kit check` |

## Test Coverage

### Schema Tests (54 tests)

| Category | Tests |
|----------|-------|
| Communities table | 8 |
| Profiles table | 10 |
| Badges table | 10 |
| Manifests table | 8 |
| Shadow states table | 6 |
| Type definitions | 5 |
| JSONB types | 5 |
| Multi-tenant design | 2 |

**Test Results:**
```
✓ tests/unit/packages/adapters/storage/schema.test.ts (54 tests) 6ms
```

## Docker Environment

Created `docker-compose.yml` with:
- PostgreSQL 15 Alpine
- Redis 7 Alpine (for future sprints)
- Health checks
- Named volumes for persistence

**Usage:**
```bash
docker-compose up -d      # Start
docker-compose down       # Stop
docker-compose down -v    # Stop + remove volumes
```

## Migration Generated

The initial migration creates all 5 tables with:
- UUID primary keys
- Foreign keys with proper ON DELETE actions
- JSONB columns with type safety
- 14 indexes for query optimization
- 6 unique constraints

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| `communities` table with `theme_id`, `subscription_tier` | ✅ |
| `profiles` table with `community_id` FK | ✅ |
| `badges` table with lineage support (`awarded_by`) | ✅ |
| `manifests` table for configuration versioning | ✅ |
| `shadow_states` table for reconciliation | ✅ |
| All tables have proper indexes | ✅ 14 indexes |
| Schema tests | ✅ 54 tests |
| Docker dev environment | ✅ docker-compose.yml |
| Drizzle migration | ✅ Generated |

## Architecture Alignment

### Multi-Tenant Design

- All tenant-scoped tables have `community_id` FK
- Composite indexes start with `community_id` for RLS efficiency
- CASCADE delete ensures data cleanup on community removal

### Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Core Layer                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ IStorageProvider (Port) - Sprint 40             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
            │
┌───────────┼─────────────────────────────────────────────┐
│           ▼           Adapters Layer                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │ DrizzleStorageAdapter - Sprint 40               │    │
│  │ └── schema.ts ◄── THIS SPRINT                   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Ready for Sprint 39

This sprint provides the schema foundation for:
- **Sprint 39**: Row-Level Security (RLS) policies
- **Sprint 40**: DrizzleStorageAdapter implementation
- **Sprint 41**: Data migration from SQLite

## Type Exports

All types exported from `@/packages/adapters/storage`:
- Table types: `Community`, `Profile`, `Badge`, `Manifest`, `ShadowState`
- Insert types: `NewCommunity`, `NewProfile`, `NewBadge`, `NewManifest`, `NewShadowState`
- JSONB types: `CommunitySettings`, `ProfileMetadata`, `BadgeMetadata`, `ManifestContent`, `ShadowResources`

---

*Sprint 38: Drizzle Schema Design*
*Engineer: Senior Engineer Agent*

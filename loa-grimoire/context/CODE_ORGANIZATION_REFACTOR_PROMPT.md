# Code Organization Refactor: Implementation Prompt

**Version:** 1.0
**Date:** December 30, 2025
**Type:** Technical Debt Sprint (Phase 8)
**Estimated Duration:** 2 sprints (Sprint 53-54)
**Prerequisite:** Sprint 52 (P2 Hardening) COMPLETE

---

## Objective

Refactor large monolithic files in `sietch-service/src/` into domain-specific modules following the established hexagonal architecture patterns. This improves maintainability, testability, and aligns with the `packages/` structure already established in v5.0.

---

## Context

The v5.1 "Post-Audit Hardening" release (Sprints 50-52) addressed security findings from external code review. This phase addresses structural debt identified in the same review—large monolithic files in `src/` that remain from pre-hexagonal architecture:

| File | Lines | Issue |
|------|-------|-------|
| `src/db/queries.ts` | 3,214 | 80+ functions spanning 10+ domains |
| `src/api/routes.ts` | 1,493 | 3 routers with mixed concerns |
| `src/services/discord.ts` | 1,192 | Monolithic class with 40+ methods |
| `src/services/DigestService.ts` | 725 | Could extract template builders |
| `sietch-service/sietch-service/` | — | Empty nested directories (cleanup) |

---

## Implementation Instructions

Act as a **Senior Software Engineer** performing a refactoring sprint. Your goal is to decompose monolithic files into domain-specific modules while maintaining 100% backward compatibility.

### Guiding Principles

1. **Zero Breaking Changes**: All existing imports must continue to work via re-exports
2. **Domain Cohesion**: Group by business domain, not technical layer
3. **Single Responsibility**: Each module handles one domain
4. **Consistent Naming**: Follow existing patterns (`{domain}-queries.ts`, `{domain}.routes.ts`)
5. **Test Preservation**: All 107+ existing tests must pass

### Phase 1: Database Queries Decomposition

**Current:** `src/db/queries.ts` (3,214 lines, 80+ functions)

**Target Structure:**
```
src/db/
├── index.ts                    # Re-exports all (backward compat)
├── connection.ts               # Database init, connection, close
├── queries/
│   ├── index.ts                # Re-exports all query modules
│   ├── eligibility-queries.ts  # Eligibility snapshots, current state
│   ├── profile-queries.ts      # Member profiles, public profiles
│   ├── badge-queries.ts        # Badge definitions, awards, revocations
│   ├── activity-queries.ts     # Activity tracking, decay, leaderboard
│   ├── directory-queries.ts    # Directory listing, search
│   ├── naib-queries.ts         # Naib seats, history, thresholds
│   ├── waitlist-queries.ts     # Waitlist registrations, positions
│   ├── threshold-queries.ts    # Threshold snapshots, entry requirements
│   ├── notification-queries.ts # Preferences, alerts, history
│   ├── tier-queries.ts         # Tier updates, history, distribution
│   ├── audit-queries.ts        # Audit log, admin overrides
│   └── wallet-queries.ts       # Wallet mappings, claim/burn cache
└── schema.ts                   # Unchanged
```

**Domain Mapping:**

| Domain | Functions (approximate) | Lines |
|--------|------------------------|-------|
| Connection | `initDatabase`, `getDatabase`, `closeDatabase` | ~100 |
| Eligibility | `saveEligibilitySnapshot`, `getCurrentEligibility`, `getEligibilityByAddress` | ~200 |
| Profile | `createMemberProfile`, `getMemberProfile*`, `updateMemberProfile`, `getPublicProfile` | ~300 |
| Badge | `getAllBadges`, `awardBadge`, `revokeBadge`, `getMemberBadges` | ~250 |
| Activity | `getMemberActivity`, `applyActivityDecay`, `addActivityPoints`, `getActivityLeaderboard` | ~200 |
| Directory | `getMemberDirectory`, `getMemberCount`, `searchMembersByNym` | ~200 |
| Naib | `insertNaibSeat`, `getCurrentNaibSeats`, `updateNaibSeat`, `getNaibSeatHistory` | ~400 |
| Waitlist | `insertWaitlistRegistration`, `getWaitlistRegistration*`, `getActiveWaitlistRegistrations` | ~200 |
| Threshold | `insertThresholdSnapshot`, `getLatestThresholdSnapshot`, `getWalletPosition` | ~200 |
| Notification | `getNotificationPreferences`, `upsertNotificationPreferences`, `insertAlertRecord` | ~300 |
| Tier | `updateMemberTier`, `getTierHistory`, `getTierDistribution` | ~200 |
| Audit | `logAuditEvent`, `getAuditLog`, `createAdminOverride` | ~150 |
| Wallet | `saveWalletMapping`, `getWalletByDiscordId`, `getCachedClaimEvents` | ~200 |

**Implementation Steps:**

1. Create `src/db/connection.ts` with database lifecycle functions
2. Create `src/db/queries/` directory
3. Extract each domain to its own file with proper types
4. Update `src/db/queries/index.ts` to re-export all
5. Update `src/db/index.ts` to re-export from `queries/` and `connection.ts`
6. Verify all existing imports work unchanged
7. Run full test suite

### Phase 2: API Routes Decomposition

**Current:** `src/api/routes.ts` (1,493 lines, 3 routers)

**Target Structure:**
```
src/api/
├── index.ts                    # Re-exports all routers
├── routes/
│   ├── index.ts                # Combines all routers
│   ├── public.routes.ts        # /eligibility, /health, /metrics, /stats
│   ├── admin.routes.ts         # /override, /audit-log, /badges/award, /water-share, /alerts
│   ├── member.routes.ts        # /profile, /directory, /badges, /leaderboard
│   ├── naib.routes.ts          # /naib, /naib/current, /naib/former
│   ├── threshold.routes.ts     # /threshold, /threshold/history, /waitlist
│   └── notification.routes.ts  # /notifications/preferences, /notifications/history
├── billing.routes.ts           # Unchanged (already separate)
├── badge.routes.ts             # Unchanged (already separate)
├── boost.routes.ts             # Unchanged (already separate)
├── telegram.routes.ts          # Unchanged (already separate)
├── middleware.ts               # Unchanged
└── server.ts                   # Unchanged
```

**Route Mapping:**

| Module | Endpoints | Lines |
|--------|-----------|-------|
| public.routes.ts | `/eligibility`, `/eligibility/:address`, `/health`, `/metrics`, `/stats/community` | ~150 |
| admin.routes.ts | `/override`, `/overrides`, `/audit-log`, `/badges/award`, `/water-share/*`, `/alerts/*`, `/analytics` | ~500 |
| member.routes.ts | `/profile`, `/members/:nym`, `/directory`, `/badges`, `/leaderboard`, `/stats/tiers`, `/me/*` | ~300 |
| naib.routes.ts | `/naib`, `/naib/current`, `/naib/former`, `/naib/member/:memberId` | ~150 |
| threshold.routes.ts | `/threshold`, `/threshold/history`, `/waitlist/status/:address` | ~150 |
| notification.routes.ts | `/notifications/preferences`, `/notifications/history`, `/position` | ~200 |

**Implementation Steps:**

1. Create `src/api/routes/` directory
2. Extract each domain to its own file
3. Create combined router in `src/api/routes/index.ts`
4. Update `src/api/index.ts` to use new structure
5. Verify all endpoints respond correctly
6. Run API integration tests

### Phase 3: Discord Service Decomposition

**Current:** `src/services/discord.ts` (1,192 lines, 1 class)

**Target Structure:**
```
src/services/discord/
├── index.ts                    # Re-exports DiscordService
├── DiscordService.ts           # Main orchestrator (slimmed down)
├── handlers/
│   ├── index.ts
│   ├── InteractionHandler.ts   # Slash commands, buttons, modals
│   ├── EventHandler.ts         # Member updates, messages, reactions
│   └── AutocompleteHandler.ts  # Autocomplete interactions
├── operations/
│   ├── index.ts
│   ├── RoleOperations.ts       # assignRole, removeRole
│   ├── GuildOperations.ts      # findMember, getChannel
│   └── NotificationOps.ts      # sendDM, postToChannel
├── embeds/
│   ├── index.ts
│   ├── EligibilityEmbeds.ts    # Removal, promotion, demotion embeds
│   ├── LeaderboardEmbeds.ts    # Leaderboard formatting
│   └── AnnouncementEmbeds.ts   # New eligible, departures
└── processors/
    ├── index.ts
    └── EligibilityProcessor.ts # processEligibilityChanges logic
```

**Method Distribution:**

| Module | Methods | Responsibility |
|--------|---------|----------------|
| DiscordService.ts | `connect`, `disconnect`, `getGuild` | Lifecycle, coordination |
| InteractionHandler.ts | `handleInteraction`, `handleSlashCommand`, `handleButtonInteraction`, `handleSelectMenuInteraction`, `handleModalInteraction` | User interactions |
| EventHandler.ts | `handleMemberUpdate`, `handleMessageCreate`, `handleReactionAdd`, `handleReactionRemove` | Discord events |
| RoleOperations.ts | `assignRole`, `removeRole` | Role management |
| GuildOperations.ts | `findMemberByWallet`, `getMemberById`, `getBotChannel` | Guild queries |
| NotificationOps.ts | `sendDMWithFallback`, `notifyBadgeAwarded`, `postToTheDoor` | Notifications |
| EligibilityEmbeds.ts | `buildRemovalDMEmbed`, `buildNaibDemotionDMEmbed`, `buildNaibPromotionDMEmbed` | DM embeds |
| AnnouncementEmbeds.ts | `buildDepartureAnnouncementEmbed`, `buildNaibDemotionAnnouncementEmbed`, `buildNewEligibleAnnouncementEmbed` | Channel embeds |
| EligibilityProcessor.ts | `processEligibilityChanges`, `handleMemberRemoval`, `handleNaibDemotion`, `handleNaibPromotion` | State changes |

**Implementation Steps:**

1. Create `src/services/discord/` directory structure
2. Extract handlers to `handlers/`
3. Extract operations to `operations/`
4. Extract embed builders to `embeds/`
5. Extract eligibility processing to `processors/`
6. Slim down `DiscordService.ts` to orchestration
7. Update `src/services/discord/index.ts` to export `discordService`
8. Update `src/services/index.ts` import
9. Run Discord-related tests

### Phase 4: Cleanup

**Tasks:**

1. **Delete empty nested directories:**
   ```bash
   rm -rf sietch-service/sietch-service/
   ```

2. **Update import paths in tests** (if any hardcoded)

3. **Verify no circular dependencies:**
   ```bash
   npx madge --circular src/
   ```

4. **Run full test suite:**
   ```bash
   npm test
   ```

---

## Acceptance Criteria

### Must Have
- [ ] All 107+ existing tests pass
- [ ] All API endpoints respond identically
- [ ] No circular dependencies introduced
- [ ] All existing import paths work via re-exports
- [ ] TypeScript compiles without errors

### Should Have
- [ ] Each new file < 500 lines
- [ ] JSDoc preserved on all exported functions
- [ ] No increase in bundle size > 5%

### Nice to Have
- [ ] New unit tests for extracted modules
- [ ] README.md in each new directory

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking imports | Medium | High | Re-export from original locations |
| Circular dependencies | Medium | Medium | Use dependency injection |
| Missing type exports | Low | Medium | TypeScript will catch |
| Test failures | Low | High | Run tests after each extraction |

---

## Definition of Done

1. All files extracted per target structure
2. Original import paths work unchanged
3. Full test suite passes
4. No TypeScript errors
5. No circular dependencies
6. PR reviewed and merged
7. `sietch-service/sietch-service/` deleted

---

## Notes for Implementation Agent

- **Do NOT modify function signatures** - preserve all parameters and return types
- **Do NOT rename exported functions** - existing code depends on names
- **DO add re-exports** in index.ts files for backward compatibility
- **DO preserve JSDoc comments** when moving functions
- **DO run tests frequently** to catch issues early
- **DO commit after each phase** for easy rollback

---

## Command to Start

```bash
/implement sprint-53
```

This will begin Phase 1 (Database Queries Decomposition). Phases 2-4 will be Sprint 54.

# Sprint Plan: Code Organization Refactor (Phase 8)

**Sprints:** 53-54
**Duration:** 2 weeks
**Dates:** Weeks 20-21
**Type:** Technical Debt
**Priority:** P1 (Maintainability)
**Status:** PLANNED
**PRD Reference:** N/A (Internal Quality)
**SDD Reference:** loa-grimoire/sdd.md (v5.1)
**Implementation Prompt:** `loa-grimoire/context/new-context/CODE_ORGANIZATION_REFACTOR_PROMPT.md`
**Prerequisite:** Sprint 52 (P2 Hardening) COMPLETE

---

## Executive Summary

Decompose 4 monolithic files (~6,600 lines) into domain-specific modules to improve maintainability, testability, and developer experience. Zero breaking changes required. This addresses structural findings from the external code review that were deferred from Phase 7 hardening.

**Impact:**
- `queries.ts`: 3,214 lines → 13 modules (~250 lines each)
- `routes.ts`: 1,493 lines → 6 modules (~250 lines each)  
- `discord.ts`: 1,192 lines → 10 modules (~120 lines each)
- Delete: Empty `sietch-service/sietch-service/` directory

---

## Sprint 53: Database & API Decomposition

**Duration:** 1 week
**Dates:** Week 20

#### Sprint Goal
Extract `queries.ts` and `routes.ts` into domain modules with zero breaking changes.

#### Deliverables
- [ ] `src/db/connection.ts` - Database lifecycle
- [ ] `src/db/queries/` - 13 domain query modules
- [ ] `src/db/queries/index.ts` - Re-exports
- [ ] `src/api/routes/` - 6 route modules
- [ ] `src/api/routes/index.ts` - Combined router
- [ ] All tests passing

#### Acceptance Criteria
- [ ] Original `src/db/queries.ts` deleted (all functions moved)
- [ ] Original `src/api/routes.ts` deleted (all routes moved)
- [ ] All imports via `src/db/index.ts` work unchanged
- [ ] All API endpoints respond correctly
- [ ] Zero TypeScript errors
- [ ] All existing tests pass

#### Technical Tasks

| ID | Task | Priority | Est. Hours | Dependencies |
|----|------|----------|------------|--------------|
| 53.1 | Create `src/db/connection.ts` with lifecycle functions | P0 | 1 | - |
| 53.2 | Create `src/db/queries/eligibility-queries.ts` | P0 | 1 | 53.1 |
| 53.3 | Create `src/db/queries/profile-queries.ts` | P0 | 1.5 | 53.1 |
| 53.4 | Create `src/db/queries/badge-queries.ts` | P0 | 1 | 53.1 |
| 53.5 | Create `src/db/queries/activity-queries.ts` | P0 | 1 | 53.1 |
| 53.6 | Create `src/db/queries/directory-queries.ts` | P0 | 1 | 53.1 |
| 53.7 | Create `src/db/queries/naib-queries.ts` | P0 | 2 | 53.1 |
| 53.8 | Create `src/db/queries/waitlist-queries.ts` | P1 | 1 | 53.1 |
| 53.9 | Create `src/db/queries/threshold-queries.ts` | P1 | 1 | 53.1 |
| 53.10 | Create `src/db/queries/notification-queries.ts` | P1 | 1.5 | 53.1 |
| 53.11 | Create `src/db/queries/tier-queries.ts` | P1 | 1 | 53.1 |
| 53.12 | Create `src/db/queries/audit-queries.ts` | P1 | 0.5 | 53.1 |
| 53.13 | Create `src/db/queries/wallet-queries.ts` | P1 | 1 | 53.1 |
| 53.14 | Create `src/db/queries/index.ts` re-exports | P0 | 0.5 | 53.2-53.13 |
| 53.15 | Update `src/db/index.ts` for backward compat | P0 | 0.5 | 53.14 |
| 53.16 | Create `src/api/routes/public.routes.ts` | P0 | 1 | - |
| 53.17 | Create `src/api/routes/admin.routes.ts` | P0 | 2 | - |
| 53.18 | Create `src/api/routes/member.routes.ts` | P0 | 1.5 | - |
| 53.19 | Create `src/api/routes/naib.routes.ts` | P1 | 0.5 | - |
| 53.20 | Create `src/api/routes/threshold.routes.ts` | P1 | 0.5 | - |
| 53.21 | Create `src/api/routes/notification.routes.ts` | P1 | 1 | - |
| 53.22 | Create `src/api/routes/index.ts` combined router | P0 | 0.5 | 53.16-53.21 |
| 53.23 | Run full test suite, fix any failures | P0 | 2 | 53.15, 53.22 |

**Total Estimated Hours:** ~24 hours

#### Dependencies
- Sprint 52: P2 Hardening (test coverage, naming conventions)

#### Risks & Mitigation
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Missing re-export | Low | Medium | TypeScript compiler will catch |
| Circular dependency | Medium | Medium | Extract shared types first |
| Test import breakage | Low | Low | Update test imports if needed |

#### Success Metrics
- 0 breaking changes to external imports
- All 80%+ test coverage maintained (from Sprint 52)
- <500 lines per new file

---

## Sprint 54: Discord Service & Cleanup

**Duration:** 1 week
**Dates:** Week 21

#### Sprint Goal
Decompose `discord.ts`, clean up nested directories, delete original monolithic files.

#### Deliverables
- [ ] `src/services/discord/` - 10 modules
- [ ] `src/services/discord/DiscordService.ts` - Slimmed orchestrator
- [ ] `src/services/discord/index.ts` - Re-exports
- [ ] Nested `sietch-service/sietch-service/` deleted
- [ ] Original monolithic files deleted
- [ ] CHANGELOG.md updated

#### Acceptance Criteria
- [ ] `discordService` export works unchanged
- [ ] All Discord interactions functional
- [ ] No circular dependencies (`madge` clean)
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Each new file < 500 lines

#### Technical Tasks

| ID | Task | Priority | Est. Hours | Dependencies |
|----|------|----------|------------|--------------|
| 54.1 | Create `src/services/discord/handlers/InteractionHandler.ts` | P0 | 2 | - |
| 54.2 | Create `src/services/discord/handlers/EventHandler.ts` | P0 | 1.5 | - |
| 54.3 | Create `src/services/discord/handlers/AutocompleteHandler.ts` | P1 | 0.5 | - |
| 54.4 | Create `src/services/discord/operations/RoleOperations.ts` | P0 | 1 | - |
| 54.5 | Create `src/services/discord/operations/GuildOperations.ts` | P0 | 1 | - |
| 54.6 | Create `src/services/discord/operations/NotificationOps.ts` | P0 | 1 | - |
| 54.7 | Create `src/services/discord/embeds/EligibilityEmbeds.ts` | P1 | 1 | - |
| 54.8 | Create `src/services/discord/embeds/LeaderboardEmbeds.ts` | P1 | 0.5 | - |
| 54.9 | Create `src/services/discord/embeds/AnnouncementEmbeds.ts` | P1 | 0.5 | - |
| 54.10 | Create `src/services/discord/processors/EligibilityProcessor.ts` | P0 | 2 | - |
| 54.11 | Refactor `DiscordService.ts` to use extracted modules | P0 | 2 | 54.1-54.10 |
| 54.12 | Create `src/services/discord/index.ts` exports | P0 | 0.5 | 54.11 |
| 54.13 | Delete `sietch-service/sietch-service/` nested directory | P0 | 0.1 | - |
| 54.14 | Run `madge --circular src/` to verify no cycles | P0 | 0.5 | 54.12 |
| 54.15 | Run full test suite, fix any failures | P0 | 2 | 54.14 |
| 54.16 | Delete original monolithic files (after backup) | P1 | 0.5 | 54.15 |
| 54.17 | Update CHANGELOG.md with refactoring notes | P2 | 0.5 | 54.16 |

**Total Estimated Hours:** ~17 hours

#### Dependencies
- Sprint 53: Database & API Decomposition

#### Risks & Mitigation
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Class method binding issues | Medium | Medium | Use arrow functions or bind in constructor |
| Missing private method access | Low | Medium | Pass as constructor dependencies |
| Discord.js client state | Low | Low | Keep client in main service |

#### Success Metrics
- 0 breaking changes to `discordService` export
- `madge --circular` reports clean
- All Discord bot functionality verified

---

## Dependencies Map

```
Phase 6 (Sprint 48-49)
  OPA + HITL
         │
         ▼
v5.0 COMPLETE
         │
         ▼
Phase 7 (Sprint 50-52)
  Post-Audit Hardening
         │
         ▼
v5.1 HARDENED
         │
         ▼
Phase 8 (Sprint 53-54)        ◀── YOU ARE HERE
  Code Organization
         │
         ▼
v5.2 MAINTAINABLE
```

---

## File Structure After Refactoring

```
sietch-service/src/
├── api/
│   ├── routes/
│   │   ├── index.ts                 # Combined router
│   │   ├── public.routes.ts         # NEW
│   │   ├── admin.routes.ts          # NEW
│   │   ├── member.routes.ts         # NEW
│   │   ├── naib.routes.ts           # NEW
│   │   ├── threshold.routes.ts      # NEW
│   │   └── notification.routes.ts   # NEW
│   ├── billing.routes.ts            # Unchanged
│   ├── badge.routes.ts              # Unchanged
│   ├── boost.routes.ts              # Unchanged
│   ├── telegram.routes.ts           # Unchanged
│   ├── middleware.ts                # Unchanged
│   ├── server.ts                    # Unchanged
│   └── index.ts                     # Updated imports
│
├── db/
│   ├── queries/
│   │   ├── index.ts                 # NEW - re-exports all
│   │   ├── eligibility-queries.ts   # NEW
│   │   ├── profile-queries.ts       # NEW
│   │   ├── badge-queries.ts         # Moved from root
│   │   ├── activity-queries.ts      # NEW
│   │   ├── directory-queries.ts     # NEW
│   │   ├── naib-queries.ts          # NEW
│   │   ├── waitlist-queries.ts      # NEW
│   │   ├── threshold-queries.ts     # NEW
│   │   ├── notification-queries.ts  # NEW
│   │   ├── tier-queries.ts          # NEW
│   │   ├── audit-queries.ts         # NEW
│   │   └── wallet-queries.ts        # NEW
│   ├── migrations/                  # Unchanged
│   ├── connection.ts                # NEW - db lifecycle
│   ├── billing-queries.ts           # Unchanged
│   ├── boost-queries.ts             # Unchanged
│   ├── schema.ts                    # Unchanged
│   └── index.ts                     # Updated imports
│
├── services/
│   ├── discord/
│   │   ├── handlers/
│   │   │   ├── index.ts             # NEW
│   │   │   ├── InteractionHandler.ts # NEW
│   │   │   ├── EventHandler.ts      # NEW
│   │   │   └── AutocompleteHandler.ts # NEW
│   │   ├── operations/
│   │   │   ├── index.ts             # NEW
│   │   │   ├── RoleOperations.ts    # NEW
│   │   │   ├── GuildOperations.ts   # NEW
│   │   │   └── NotificationOps.ts   # NEW
│   │   ├── embeds/
│   │   │   ├── index.ts             # NEW
│   │   │   ├── EligibilityEmbeds.ts # NEW
│   │   │   ├── LeaderboardEmbeds.ts # NEW
│   │   │   └── AnnouncementEmbeds.ts # NEW
│   │   ├── processors/
│   │   │   ├── index.ts             # NEW
│   │   │   └── EligibilityProcessor.ts # NEW
│   │   ├── DiscordService.ts        # Refactored (slimmer)
│   │   └── index.ts                 # NEW - re-exports
│   │
│   ├── billing/                     # Unchanged
│   ├── boost/                       # Unchanged
│   ├── badge/                       # Unchanged
│   ├── cache/                       # Unchanged
│   └── ... (other services unchanged)
│
└── ... (other directories unchanged)
```

---

## Metrics

### Before

| File | Lines | Functions/Methods |
|------|-------|-------------------|
| `db/queries.ts` | 3,214 | 80+ |
| `api/routes.ts` | 1,493 | 50+ endpoints |
| `services/discord.ts` | 1,192 | 40+ |
| **Total** | **5,899** | **170+** |

### After (Target)

| Module Category | Files | Avg Lines/File |
|-----------------|-------|----------------|
| `db/queries/` | 13 | ~250 |
| `api/routes/` | 6 | ~250 |
| `services/discord/` | 10 | ~120 |
| **Total** | **29** | **~200** |

---

## Success Criteria

1. **Zero Breaking Changes**: All existing code works without modification
2. **Test Coverage Maintained**: All 107+ tests pass
3. **No Circular Dependencies**: `madge --circular` reports clean
4. **Improved Modularity**: No file > 500 lines
5. **Clean Deletion**: Original monolithic files removed
6. **Documentation**: CHANGELOG updated

---

## Post-Refactor Benefits

1. **Faster Navigation**: Find code by domain, not by scrolling 3000 lines
2. **Easier Testing**: Test individual domains in isolation
3. **Reduced Merge Conflicts**: Parallel work on different domains
4. **Better Code Reviews**: Smaller, focused diffs
5. **Onboarding**: New developers understand structure faster
6. **Future Extraction**: Ready for potential microservice split

---

## Commands

```bash
# Start Sprint 53
/implement sprint-53

# Review Sprint 53
/review-sprint sprint-53

# Audit Sprint 53
/audit-sprint sprint-53

# Start Sprint 54
/implement sprint-54

# Final verification
npm test
npx madge --circular src/
```

---

## Appendix

### A. Files to Delete After Migration

| File | Sprint | Condition |
|------|--------|-----------|
| `src/db/queries.ts` | 53 | After all query modules created and tests pass |
| `src/api/routes.ts` | 53 | After all route modules created and tests pass |
| `src/services/discord.ts` | 54 | After all discord modules created and tests pass |
| `sietch-service/sietch-service/` | 54 | Empty nested directory (immediate) |

### B. SDD Component Mapping

| New Component | Sprint | Status |
|---------------|--------|--------|
| `src/db/connection.ts` | 53 | Planned |
| `src/db/queries/*.ts` (13 modules) | 53 | Planned |
| `src/api/routes/*.ts` (6 modules) | 53 | Planned |
| `src/services/discord/handlers/*.ts` | 54 | Planned |
| `src/services/discord/operations/*.ts` | 54 | Planned |
| `src/services/discord/embeds/*.ts` | 54 | Planned |
| `src/services/discord/processors/*.ts` | 54 | Planned |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.0 | 2025-12-28 | v5.0 "The Transformation" - SaaS platform (Sprints 34-49) |
| 5.1 | 2025-12-29 | v5.1 Post-Audit Hardening - Security hardening (Sprints 50-52) |
| 5.2 | 2025-12-30 | v5.2 Code Organization - Structural refactoring (Sprints 53-54) |

---

*Sprint Plan v5.2 generated by Loa planning workflow*
*Based on: External Code Review findings (2025-12-29)*

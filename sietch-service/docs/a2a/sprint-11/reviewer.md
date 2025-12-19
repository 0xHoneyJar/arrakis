# Sprint 11: Naib Foundation - Implementation Report

## Sprint Overview

**Sprint**: 11 - Naib Foundation
**Status**: Complete
**Implementation Date**: 2025-12-20

## Tasks Completed

### S11-T1: Database Schema for Naib Seats
**Status**: Complete

Added `naib_seats` table schema in `src/db/schema.ts`:
- `id` - Auto-increment primary key
- `seat_number` - 1-7 seat identifier
- `member_id` - Foreign key to members
- `seated_at` - Timestamp when member took seat
- `unseated_at` - Nullable timestamp when member lost seat
- `unseat_reason` - Enum: 'bumped', 'left_server', 'ineligible', 'manual'
- `bumped_by_member_id` - Who bumped them (if applicable)
- `bgt_at_seating` - BGT balance when seated
- `bgt_at_unseating` - BGT balance when unseated

Added `is_former_naib` column to `member_profiles` table.

### S11-T2: Type Definitions
**Status**: Complete

Added types in `src/types/index.ts`:
- `NaibSeat` - Database record type
- `NaibMember` - Full member with seat info
- `PublicNaibMember` - Privacy-filtered public view
- `PublicFormerNaib` - Former Naib display info
- `BumpResult` - Result of bump operation
- `NaibEvaluationResult` - Result of new member evaluation
- `NaibChange` - Sync change record
- `NaibEvaluationSyncResult` - Full sync evaluation result

### S11-T3: Database Queries
**Status**: Complete

Added queries in `src/db/queries.ts`:
- `getCurrentNaibSeats()` - Get all active seats
- `getActiveSeatByMember()` - Check if member has active seat
- `getNaibSeatsByMember()` - Get seat history for member
- `countActiveNaibSeats()` - Count filled seats
- `getNextAvailableSeatNumber()` - Find next available 1-7
- `getLowestBgtNaibSeat()` - Get bump candidate
- `insertNaibSeat()` - Create new seat record
- `updateNaibSeat()` - Update existing seat
- `updateMemberFormerNaibStatus()` - Set is_former_naib flag
- `getFormerNaibMembers()` - Get all former Naib profiles
- `hasAnyNaibSeatsEver()` - Check if seats system initialized

### S11-T4: Naib Service
**Status**: Complete

Created `src/services/naib.ts` with NaibService class:
- `getCurrentNaib()` - Get current Naib members with full details
- `getPublicCurrentNaib()` - Privacy-filtered public view
- `getFormerNaib()` - Get former Naib honor roll
- `getMemberNaibHistory()` - Get member's seat history
- `isCurrentNaib()` - Check if member holds seat
- `isFormerNaib()` - Check former Naib status
- `hasEverBeenNaib()` - Check any Naib history
- `getLowestNaibMember()` - Get bump candidate
- `getAvailableSeatCount()` - Count empty seats
- `seatMember()` - Seat a member in available seat
- `bumpMember()` - Bump member from seat
- `unseatMember()` - Remove for non-bump reasons
- `evaluateNewMember()` - Called during onboarding
- `evaluateSeats()` - Full sync evaluation

Key business logic:
- 7 maximum seats (MAX_NAIB_SEATS constant)
- First-come basis when seats available
- BGT-based competition when full (higher BGT wins)
- Tenure tie-breaker (older seated_at keeps seat on equal BGT)
- "Founding Naib" recognition for first 7 (within 1 hour window)

### S11-T5: Role Manager Extension
**Status**: Complete

Extended `src/services/roleManager.ts`:
- `assignNaibRole()` - Assign @Naib, remove @Fedaykin
- `assignFormerNaibRole()` - Add @Former Naib alongside current tier
- `removeNaibRole()` - Remove @Naib, restore @Fedaykin
- `isNaibRolesConfigured()` - Check if naib role configured
- `isFormerNaibRoleConfigured()` - Check if former naib role configured

Updated `src/config.ts`:
- Added `formerNaib` to roles schema
- Added `DISCORD_ROLE_FORMER_NAIB` environment variable

### S11-T6: Naib Slash Command
**Status**: Complete

Created `src/discord/commands/naib.ts`:
- `/naib overview` - Full council overview with current + former
- `/naib current` - Current seated members only
- `/naib former` - Former Naib honor roll

Created `src/discord/embeds/naib.ts`:
- `buildNaibCouncilEmbed()` - Current council display
- `buildFormerNaibEmbed()` - Former Naib honor roll
- `buildNaibOverviewEmbed()` - Combined overview
- `buildNaibSeatEmbed()` - Individual seat card

Updated `src/discord/commands/index.ts` to register command.
Updated `src/discord/embeds/index.ts` to export naib embeds.
Updated `src/services/discord.ts` to handle command.

### S11-T7: Onboarding Integration
**Status**: Complete

Modified `src/services/onboarding.ts`:
- `completeOnboarding()` now calls `naibService.evaluateNewMember()`
- Tracks `becameNaib` result for messaging
- Handles bump notifications (TODO: actual Discord DM)

Updated `src/discord/embeds/profile.ts`:
- `buildOnboardingCompleteEmbed()` accepts `becameNaib` parameter
- Special "Welcome to the Naib Council!" message for new Naib
- Lists Naib privileges and next steps

### S11-T8: REST API Endpoints
**Status**: Complete

Added to `src/api/routes.ts`:
- `GET /api/naib` - Full council overview (current + former + empty seats)
- `GET /api/naib/current` - Current members only
- `GET /api/naib/former` - Former members honor roll
- `GET /api/naib/member/:memberId` - Individual member Naib status

All endpoints return privacy-filtered data (no wallet addresses).

## Technical Notes

### Privacy Design
- No wallet addresses exposed in public APIs
- Public types (`PublicNaibMember`, `PublicFormerNaib`) exclude sensitive data
- Embed footer notes privacy protection

### Tie-Breaker Logic
When BGT is equal between a new member and lowest Naib:
- Incumbent wins (tenure advantage)
- New member must have strictly HIGHER BGT to bump

### Founding Naib Recognition
- `isFounding` flag on NaibMember type
- Determined by seated_at within 1 hour of earliest seat
- Preserved even after bump/reseat

### Database Changes
- New `naib_seats` table with full history tracking
- `is_former_naib` boolean on `member_profiles`
- Audit events logged for all promotions/demotions

## Files Modified

1. `src/db/schema.ts` - Added naib_seats table
2. `src/types/index.ts` - Added Naib-related types
3. `src/db/queries.ts` - Added Naib queries
4. `src/services/naib.ts` - NEW: NaibService
5. `src/services/roleManager.ts` - Extended with Naib functions
6. `src/services/index.ts` - Added exports
7. `src/config.ts` - Added formerNaib role config
8. `src/discord/commands/naib.ts` - NEW: /naib command
9. `src/discord/embeds/naib.ts` - NEW: Naib embeds
10. `src/discord/commands/index.ts` - Registered command
11. `src/discord/embeds/index.ts` - Added exports
12. `src/services/discord.ts` - Added command handler
13. `src/services/onboarding.ts` - Added Naib evaluation
14. `src/discord/embeds/profile.ts` - Updated completion embed
15. `src/api/routes.ts` - Added REST endpoints

## Testing Notes

- TypeScript compilation passes (`npx tsc --noEmit`)
- Fixed non-null assertion issue in `naib.ts` lines 141-142
- All new functions follow existing patterns
- No breaking changes to existing functionality

## Known Limitations

1. Bump notifications are logged but DM not implemented yet
2. Role assignment requires DISCORD_ROLE_FORMER_NAIB env var
3. No admin override commands yet (planned for future sprint)

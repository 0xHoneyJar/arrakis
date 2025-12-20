# Sprint 12: Cave Entrance - Implementation Report

## Sprint Overview

**Sprint**: 12 - Cave Entrance
**Status**: Complete
**Implementation Date**: 2025-12-20

## Tasks Completed

### S12-T1: Database Schema Extension (Threshold)
**Status**: Complete

Added tables in migration `src/db/migrations/005_naib_threshold.ts`:

**waitlist_registrations table:**
- `id` - Auto-increment primary key
- `discord_user_id` - Discord user ID (unique)
- `wallet_address` - Wallet address (unique)
- `position_at_registration` - Position when registered (70-100)
- `bgt_at_registration` - BGT balance at registration
- `registered_at` - Registration timestamp
- `notified` - Whether user was notified of eligibility
- `notified_at` - When notification was sent
- `active` - Whether registration is active

**threshold_snapshots table:**
- `id` - Auto-increment primary key
- `entry_threshold_bgt` - Position 69's BGT (wei)
- `eligible_count` - Number in top 69
- `waitlist_count` - Number in positions 70-100
- `waitlist_top_bgt` - Position 70's BGT
- `waitlist_bottom_bgt` - Position 100's BGT
- `gap_to_entry` - Distance from 70 to 69
- `snapshot_at` - When snapshot was taken

### S12-T2: TypeScript Type Definitions
**Status**: Complete

Added types in `src/types/index.ts`:
- `WaitlistRegistration` - Database record type
- `ThresholdSnapshot` - Historical snapshot record
- `PositionDistance` - Distance calculation info
- `ThresholdData` - Current threshold summary
- `WaitlistPosition` - Position with display info
- `WaitlistRegistrationResult` - Registration attempt result
- `WaitlistEligibilityCheck` - Eligibility check result
- `ThresholdResponse` - API response type
- `ThresholdHistoryResponse` - History API response
- `WaitlistStatusResponse` - Waitlist status API response

Added audit event types: `waitlist_registration`, `waitlist_unregistration`, `waitlist_eligible`

### S12-T3: Database Query Layer
**Status**: Complete

Added queries in `src/db/queries.ts`:
- `insertWaitlistRegistration()` - Create waitlist registration
- `getWaitlistRegistrationByDiscord()` - Lookup by Discord ID
- `getWaitlistRegistrationByWallet()` - Lookup by wallet address
- `updateWaitlistNotified()` - Mark as notified
- `deleteWaitlistRegistration()` - Remove registration
- `getActiveWaitlistRegistrations()` - Get active registrations
- `getAllActiveWaitlistRegistrations()` - Get all active registrations
- `insertThresholdSnapshot()` - Save threshold snapshot
- `getLatestThresholdSnapshot()` - Get most recent snapshot
- `getThresholdSnapshots()` - Get snapshot history
- `getWaitlistPositions()` - Get positions 70-100
- `getEntryThresholdBgt()` - Get position 69's BGT
- `getWalletPosition()` - Get position info for wallet
- `isWalletAssociatedWithMember()` - Check if wallet is already linked

### S12-T4: Threshold Service Implementation
**Status**: Complete

Created `src/services/threshold.ts` with ThresholdService class:
- `getEntryThreshold()` - Get position 69's BGT requirement
- `getWaitlistPositions()` - Get positions 70-100 with distances
- `getTopWaitlistPositions()` - Get top N waitlist positions
- `getMemberDistances()` - Get distance info for a specific wallet
- `calculateDistances()` - Calculate distances for all positions
- `saveSnapshot()` - Save current threshold data to history
- `getLatestSnapshot()` - Get most recent snapshot
- `getThresholdData()` - Get current threshold summary
- `getHistory()` - Get historical snapshots
- `getSnapshotHistory()` - API-compatible history method
- `getWalletPosition()` - Public method for wallet position lookup
- `getActiveRegistrations()` - Get all active waitlist registrations
- `registerWaitlist()` - Register wallet for eligibility alerts
- `unregisterWaitlist()` - Remove waitlist registration
- `getRegistration()` - Get registration by Discord ID
- `getRegistrationByWallet()` - Get registration by wallet
- `checkWaitlistEligibility()` - Check for newly eligible registrations
- `markNotified()` - Mark registration as notified
- `getRegistrationStatus()` - Get current position info for registered user

Key business logic:
- Wei to human-readable BGT conversion (18 decimals)
- Wallet address truncation for privacy
- Position validation (70-100 range)
- Duplicate prevention (wallet and Discord user checks)
- Distance calculations relative to entry threshold

### S12-T5: Taqwa Role Management
**Status**: Complete

Extended `src/services/roleManager.ts`:
- `assignTaqwaRole()` - Assign @Taqwa role to waitlist registrations
- `removeTaqwaRole()` - Remove @Taqwa role
- `isTaqwaRoleConfigured()` - Check if Taqwa role is configured

Updated `src/config.ts`:
- Added `taqwa` to roles schema
- Added `DISCORD_ROLE_TAQWA` environment variable

### S12-T6: Threshold Slash Command
**Status**: Complete

Created `src/discord/commands/threshold.ts`:
- `/threshold` - View entry requirements for joining the Sietch

Created `src/discord/embeds/threshold.ts`:
- `buildThresholdEmbed()` - Main threshold display with entry requirement, stats, waitlist
- `buildThresholdCompactEmbed()` - Compact threshold display
- `buildWaitlistRegistrationEmbed()` - Registration success confirmation
- `buildWaitlistErrorEmbed()` - Error display
- `buildWaitlistUnregisterEmbed()` - Unregistration confirmation
- `buildWaitlistStatusEmbed()` - Current registration status

Color scheme: Desert brown (#8B4513) for Cave Entrance embeds

Updated `src/discord/commands/index.ts` to register command.
Updated `src/discord/embeds/index.ts` to export threshold embeds.
Updated `src/services/discord.ts` to handle command.

### S12-T7: Register Waitlist Slash Command
**Status**: Complete

Created `src/discord/commands/register-waitlist.ts`:
- `/register-waitlist register <wallet>` - Register wallet for eligibility alerts
- `/register-waitlist status` - Check current registration status
- `/register-waitlist unregister` - Remove registration

Validation:
- Wallet address format (0x + 40 hex chars)
- Position must be 70-100 (not already eligible, not too low)
- Wallet not already associated with existing member
- Discord user not already registered
- Assigns @Taqwa role on successful registration

### S12-T8: Threshold REST API Endpoints
**Status**: Complete

Added to `src/api/routes.ts`:
- `GET /api/threshold` - Get current threshold data with top waitlist
- `GET /api/threshold/history` - Get historical threshold snapshots
- `GET /api/waitlist/status/:address` - Check waitlist registration for address

All endpoints use member rate limiting. Threshold endpoint has 1-minute cache headers.

### S12-T9: Discord Channel Configuration
**Status**: Complete

Updated `.env.example`:
- Added `DISCORD_CHANNEL_CAVE_ENTRANCE` for Cave Entrance channel
- Added `DISCORD_ROLE_TAQWA` for waitlist member role

Updated `src/config.ts`:
- Added `caveEntrance` to channels schema and type

## Technical Notes

### Privacy Design
- Wallet addresses are truncated in public displays (`0x1234...5678`)
- Full wallet addresses only visible to the owner in status checks
- Registration data includes truncated address in audit logs

### Distance Calculations
- All calculations use BigInt for precision with wei values
- Human-readable values converted at display time (divide by 1e18)
- Gap to entry = position 69 BGT - position 70 BGT

### Position Ranges
- Eligible: Positions 1-69
- Waitlist: Positions 70-100
- Not tracked: Positions > 100

### Audit Events
- `waitlist_registration` - When user registers
- `waitlist_unregistration` - When user unregisters
- `waitlist_eligible` - When registered user becomes eligible (for future notifications)

## Files Modified/Created

1. `src/db/migrations/005_naib_threshold.ts` - Added Sprint 12 tables
2. `src/types/index.ts` - Added threshold/waitlist types
3. `src/db/queries.ts` - Added query functions
4. `src/services/threshold.ts` - NEW: ThresholdService
5. `src/services/index.ts` - Added exports
6. `src/services/roleManager.ts` - Extended with Taqwa functions
7. `src/config.ts` - Added taqwa role and caveEntrance channel
8. `.env.example` - Added Cave Entrance configuration
9. `src/discord/commands/threshold.ts` - NEW: /threshold command
10. `src/discord/commands/register-waitlist.ts` - NEW: /register-waitlist command
11. `src/discord/embeds/threshold.ts` - NEW: Threshold embeds
12. `src/discord/commands/index.ts` - Registered new commands
13. `src/discord/embeds/index.ts` - Added exports
14. `src/services/discord.ts` - Added command handlers
15. `src/api/routes.ts` - Added REST endpoints

## Testing Notes

- TypeScript compilation passes (`npm run build`)
- All new functions follow existing patterns
- No breaking changes to existing functionality
- Parameterized SQL queries used throughout (SQL injection prevention)

## Known Limitations

1. Eligibility notifications not automatically sent (manual check required)
2. Snapshot saving not automated (needs scheduled task integration)
3. @Taqwa role not removed on unregistration (deliberate - maintains community access)
4. No admin override commands for waitlist management yet

## API Documentation

### GET /api/threshold
Returns current entry threshold and waitlist information.

Response:
```json
{
  "entry_threshold": 1234.56,
  "eligible_count": 69,
  "waitlist_count": 15,
  "gap_to_entry": 50.25,
  "top_waitlist": [
    {
      "position": 70,
      "address_display": "0x1234...5678",
      "bgt": 1184.31,
      "distance_to_entry": 50.25,
      "is_registered": true
    }
  ],
  "updated_at": "2025-12-20T10:00:00.000Z"
}
```

### GET /api/threshold/history
Returns historical threshold snapshots.

Query params:
- `limit` - Max snapshots (1-100, default 24)
- `since` - ISO datetime to start from

### GET /api/waitlist/status/:address
Check waitlist status for a specific wallet address.

Response:
```json
{
  "address": "0x...",
  "is_in_waitlist_range": true,
  "position": 75,
  "bgt": 1100.50,
  "distance_to_entry": 134.06,
  "is_registered": true,
  "registered_at": "2025-12-20T09:00:00.000Z"
}
```

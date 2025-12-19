/**
 * Migration 005: Naib Dynamics & Threshold Schema
 *
 * Sprint 11 (Naib Foundation):
 * - naib_seats: Track Naib seat assignments and history
 * - Add is_former_naib to member_profiles
 *
 * Sprint 12 (Cave Entrance) - placeholder for future:
 * - waitlist_registrations: Track waitlist registrations
 * - threshold_snapshots: Historical threshold data
 *
 * Sprint 13 (Notifications) - placeholder for future:
 * - notification_preferences: Member notification settings
 * - alert_history: Audit trail of sent alerts
 */

export const NAIB_THRESHOLD_SCHEMA_SQL = `
-- =============================================================================
-- Naib Seats (Sprint 11: Naib Foundation)
-- =============================================================================
-- Tracks current and historical Naib seat assignments.
-- First 7 eligible members get Naib seats, defended by BGT holdings.
-- Tenure (seated_at) is the tie-breaker when BGT is equal.

CREATE TABLE IF NOT EXISTS naib_seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Seat assignment
  seat_number INTEGER NOT NULL CHECK (seat_number >= 1 AND seat_number <= 7),
  member_id TEXT NOT NULL,

  -- When the member was seated
  seated_at TEXT DEFAULT (datetime('now')) NOT NULL,

  -- When/if the member was unseated (NULL = currently seated)
  unseated_at TEXT,

  -- Reason for unseating
  unseat_reason TEXT CHECK (unseat_reason IN ('bumped', 'left_server', 'ineligible', 'manual')),

  -- Who bumped them (member_id of the new seat holder, if bumped)
  bumped_by_member_id TEXT,

  -- BGT at time of seating (for historical reference)
  bgt_at_seating TEXT NOT NULL,

  -- BGT at time of unseating (for historical reference)
  bgt_at_unseating TEXT,

  -- Foreign key to member_profiles
  FOREIGN KEY (member_id) REFERENCES member_profiles(member_id) ON DELETE CASCADE,
  FOREIGN KEY (bumped_by_member_id) REFERENCES member_profiles(member_id) ON DELETE SET NULL
);

-- Index for finding current Naib members (unseated_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_naib_seats_current
  ON naib_seats(unseated_at) WHERE unseated_at IS NULL;

-- Index for member seat history
CREATE INDEX IF NOT EXISTS idx_naib_seats_member
  ON naib_seats(member_id);

-- Index for seat number lookups
CREATE INDEX IF NOT EXISTS idx_naib_seats_seat_number
  ON naib_seats(seat_number);

-- Unique constraint: only one active seat per member at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_naib_seats_active_member
  ON naib_seats(member_id) WHERE unseated_at IS NULL;

-- Unique constraint: only one active holder per seat number
CREATE UNIQUE INDEX IF NOT EXISTS idx_naib_seats_active_seat
  ON naib_seats(seat_number) WHERE unseated_at IS NULL;

-- =============================================================================
-- Member Profiles Extension (Sprint 11)
-- =============================================================================
-- Add is_former_naib flag to track members who have held Naib seats

ALTER TABLE member_profiles ADD COLUMN is_former_naib INTEGER DEFAULT 0 NOT NULL;

-- Index for Former Naib lookups
CREATE INDEX IF NOT EXISTS idx_member_profiles_former_naib
  ON member_profiles(is_former_naib) WHERE is_former_naib = 1;
`;

/**
 * SQL to roll back Naib/Threshold schema
 */
export const NAIB_THRESHOLD_ROLLBACK_SQL = `
-- Drop indexes first
DROP INDEX IF EXISTS idx_member_profiles_former_naib;
DROP INDEX IF EXISTS idx_naib_seats_active_seat;
DROP INDEX IF EXISTS idx_naib_seats_active_member;
DROP INDEX IF EXISTS idx_naib_seats_seat_number;
DROP INDEX IF EXISTS idx_naib_seats_member;
DROP INDEX IF EXISTS idx_naib_seats_current;

-- Drop tables
DROP TABLE IF EXISTS naib_seats;

-- Note: SQLite doesn't support DROP COLUMN directly
-- For rollback, we'd need to recreate member_profiles without is_former_naib
-- This is handled by recreating the database from scratch in tests
`;

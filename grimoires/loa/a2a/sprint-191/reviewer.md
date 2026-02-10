# Sprint 191 (Sprint 1) — Implementation Report

**Cycle**: cycle-012 — Hounfour Integration
**Sprint Goal**: Foundation — BudgetUnitBridge + S2SJwtValidator + Config + ADR
**Status**: COMPLETE
**Date**: 2026-02-11

## Tasks Completed

### Task 1.1: BudgetUnitBridge Module
**File**: `packages/adapters/agent/budget-unit-bridge.ts` (68 lines)
**AC Coverage**: AC-4.2 (lossless upward), AC-4.3 (round-trip), AC-4.4 (bounded loss), AC-4.5 (overflow guard), AC-4.6 (invalid input)

Pure function module implementing micro-USD <-> micro-cents conversion using bigint arithmetic. Conversion factor = 100. Safety caps at $100K (100B micro-USD). All edge cases throw typed errors (RangeError for overflow/negative, TypeError for invalid input).

### Task 1.2: BudgetUnitBridge Property Tests
**File**: `themes/sietch/tests/unit/budget-unit-bridge.test.ts` (166 lines)
**Tests**: 21 passing (including 3 property tests at 1000 iterations each)

Property-based tests using fast-check verify: lossless upward conversion, lossless round-trip, bounded truncation loss (<100 micro-cents), overflow rejection, negative rejection, parseMicroUnit for all input types.

### Task 1.3: S2SJwtValidator
**File**: `packages/adapters/agent/s2s-jwt-validator.ts` (220 lines)
**AC Coverage**: AC-2.1 (ES256 validation), AC-2.2 (JWKS caching + kid refresh + cooldown), AC-2.3 (stale-if-error), AC-2.4 (hard reject), AC-2.5/2.6/2.7 (iss/aud/exp rejection)

Validates inbound ES256 JWTs and verifies JWS compact serialization from loa-finn. JWKS tiered caching: fresh (1h) -> stale-if-error (72h) -> hard reject. Single-flight dedup prevents thundering herd. Cross-protocol typ enforcement: JWT requires typ=JWT, JWS rejects typ=JWT. Configurable clock-skew leeway (default 30s). Injectable clock for testability.

Key design decisions:
- Single-flight dedup check ordered BEFORE cooldown check (concurrent callers join inflight rather than hitting cooldown)
- Fetch errors separated from validation errors (empty JWKS propagates "no keys" directly, not wrapped as "fetch failed")
- base64url kid extraction without full verification for efficient JWKS lookup

### Task 1.4: S2SJwtValidator Unit Tests
**File**: `themes/sietch/tests/unit/s2s-jwt-validator.test.ts` (340 lines)
**Tests**: 22 passing

Covers: ES256 happy path, wrong iss/aud/exp rejection, unknown key rejection, typ enforcement (JWT and JWS), clock-skew leeway (10s accepted, 60s rejected), JWKS fresh cache (1h), TTL refresh, unknown kid force-refresh, stale-if-error (72h), hard reject after 72h, 60s cooldown, single-flight dedup (5 concurrent), empty JWKS, HTTP error, no-kid fallback.

### Task 1.5: Config Additions
**File**: `packages/adapters/agent/config.ts` (+65 lines)

Added `S2SValidationConfig` and `UsageReceiverConfig` interfaces. New env vars: `S2S_EXPECTED_ISSUER`, `S2S_EXPECTED_AUDIENCE`, `S2S_JWKS_CACHE_TTL_MS`, `S2S_JWKS_STALE_MAX_MS`, `S2S_JWKS_REFRESH_COOLDOWN_MS`, `S2S_CLOCK_SKEW_LEEWAY_SEC`, `USAGE_MAX_COST_MICRO_USD`, `USAGE_MAX_REPORT_ID_LENGTH`. Added `buildS2SJwtValidatorConfig()` helper that computes JWKS URL from base URL.

### Task 1.6: ADR-005 Budget Unit Convention
**File**: `decisions/005-budget-unit-convention.md` (40 lines)

Documents the micro-USD / micro-cents convention, bigint-only money pipeline, floor division policy, safety caps, and trade-offs.

## Barrel Export Updates
**File**: `packages/adapters/agent/index.ts` — Added exports for BudgetUnitBridge, S2SJwtValidator, S2SJwtValidatorConfig, S2SJwtPayload, S2SValidationConfig, UsageReceiverConfig, buildS2SJwtValidatorConfig.

## Test Summary

| Suite | Tests | Status |
|-------|-------|--------|
| budget-unit-bridge.test.ts | 21 | PASS |
| s2s-jwt-validator.test.ts | 22 | PASS |
| **Total** | **43** | **PASS** |

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `packages/adapters/agent/budget-unit-bridge.ts` | Created | 68 |
| `packages/adapters/agent/s2s-jwt-validator.ts` | Created | 220 |
| `packages/adapters/agent/config.ts` | Modified | +65 |
| `packages/adapters/agent/index.ts` | Modified | +25 |
| `themes/sietch/tests/unit/budget-unit-bridge.test.ts` | Created | 166 |
| `themes/sietch/tests/unit/s2s-jwt-validator.test.ts` | Created | 340 |
| `decisions/005-budget-unit-convention.md` | Created | 40 |

## GPT Review Status

GPT review API unavailable during implementation (curl error 56). S2SJwtValidator is security-critical and should receive GPT code review during sprint review phase.

## Risks / Notes

- S2SJwtValidator uses `fetch()` (Node 18+ global). Ensure runtime compatibility.
- `base64UrlDecode` uses `atob()` — available in Node 16+.
- Config additions are backward-compatible (all new fields have defaults).
- Pre-existing test failures (22 suites) are infrastructure-dependent (Redis, SQLite) — unrelated to Sprint 1 changes.

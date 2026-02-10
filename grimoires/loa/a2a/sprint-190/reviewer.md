# Sprint 14 (Global 190) — Implementation Report

**Sprint**: Distributed SSE + Adaptive Monitoring (Bridgebuilder Round 3)
**Cycle**: cycle-011 (Hounfour Phase 4 v3)
**Status**: COMPLETE
**Date**: 2026-02-10

## Summary

Sprint 14 implements two major findings from the Bridgebuilder deep review:
1. **Distributed SSE Event ID design** (Finding B) — monotonic + composite generators for multi-region SSE resume
2. **Adaptive budget drift thresholds** (Finding D) — throughput-aware thresholds with hard overspend protection

## Tasks Completed

### S14-T1: Distributed SSE Event ID Design (Finding B)

**Files changed**:
- `packages/adapters/agent/sse-event-id.ts` (NEW — 69 lines)
- `packages/adapters/agent/index.ts` (updated barrel)
- `packages/adapters/dist/agent/sse-event-id.js` (NEW — dist mirror)
- `packages/adapters/dist/agent/index.js` (updated barrel)
- `themes/sietch/src/api/routes/agents.routes.ts` (SSE stream handler)
- `themes/sietch/tests/unit/sse-event-id.test.ts` (NEW — 26 tests)

**Implementation**:
- `SseEventIdGenerator` interface with `next()` and `fromLastEventId()` methods
- `MonotonicEventIdGenerator` — default, emits sequential integers ("1", "2", ...)
- `CompositeEventIdGenerator` — multi-region, emits "{serverId}:{seq}" ("us-east-1:1", ...)
- `createEventIdGenerator(config?)` factory — returns Composite when SSE_SERVER_ID env var set
- `parseLastEventId(id)` — parses both formats, handles edge cases
- Route handler updated to use generator instead of raw `++eventSeq` counter
- Server-switch detection: logs warning when Last-Event-ID has different serverId
- Cross-server reconnect defers to STREAM_RESUME_LOST FSM (no replay attempted)

**Tests**: 26/26 pass — parser, both generators, factory, server-switch detection

### S14-T2: Adaptive Budget Drift Thresholds (Finding D)

**Files changed**:
- `packages/adapters/agent/budget-drift-monitor.ts` (adaptive logic)
- `packages/adapters/agent/index.ts` (new exports)
- `packages/adapters/dist/agent/budget-drift-monitor.js` (dist mirror)
- `packages/adapters/dist/agent/index.js` (new exports)
- `themes/sietch/tests/unit/budget-drift-monitor.test.ts` (36 tests — 23 updated + 13 new)

**Implementation**:
- Extended `BudgetUsageQueryProvider` interface with `getRequestRate(communityId, windowMinutes)` returning `{ ratePerMinute, avgCostMicroCents }`
- Adaptive threshold formula: `clamp(static + ratePerMinute * (lagSeconds/60) * avgCost, static, ceiling)`
- Constants: `DRIFT_LAG_FACTOR_SECONDS = 30`, `DRIFT_MAX_THRESHOLD_MICRO_CENTS = 100,000,000` ($100 ceiling)
- Uses 60-minute trailing window (avoids feedback with 15-min drift cycle)
- **Hard overspend rule**: PG > Redis fires `BUDGET_HARD_OVERSPEND` alarm unconditionally
- **Warning level**: drift > static but < adaptive logs warn ("expected lag range")
- Full observability: debug log includes staticThreshold, adaptiveThreshold, ratePerMinute, avgCost
- Two existing tests updated for hard overspend semantics (PG > Redis now always alarms)

**Tests**: 36/36 pass — all legacy tests pass + 13 new adaptive threshold tests

### S14-T3: Drift Monitor Integration Test Under Load

**Files changed**:
- `themes/sietch/tests/unit/budget-drift-adaptive.test.ts` (NEW — 13 tests)

**Implementation**:
- 100-community simulation with varying throughput (0–1000 req/min) and avg costs (1000–10000 μ¢)
- Zero false positives when drift equals expected lag per community
- Anomalous drift (2x expected) at 1000 req/min correctly triggers alarm
- Low-throughput communities correctly use static threshold
- Property tests: monotonicity (increasing throughput never decreases threshold)
- Property tests: bounds (threshold always >= floor, always <= ceiling)
- Property tests: ceiling clamp at extreme throughput, static at zero throughput

**Tests**: 13/13 pass

### S14-T4: Build Dist + Verify Sync

**Files changed**:
- `themes/sietch/tests/bench/dist-verify.ts` (extended for S14 exports)

**Implementation**:
- `dist/agent/sse-event-id.js` created with all generators and parser
- `dist/agent/budget-drift-monitor.js` updated with adaptive threshold logic
- `dist/agent/index.js` updated with new exports
- `dist:verify` script extended to validate SSE and adaptive drift exports
- All 8 dist modules verified OK

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| sse-event-id.test.ts | 26 | PASS |
| budget-drift-monitor.test.ts | 36 | PASS |
| budget-drift-adaptive.test.ts | 13 | PASS |
| jwks-ttl-contract.test.ts | 16 | PASS |
| dist:verify | 8 modules | PASS |
| **Total** | **91 + 8** | **ALL PASS** |

## Ship Gate Validation

| Gate | Metric | Result |
|------|--------|--------|
| SG-1 | JWT p95 < 5ms | 0.477ms (Sprint 13) |
| SG-4 | Gateway overhead p95 < 50ms | 0.348ms (Sprint 13) |
| SG-new | Zero false positives at 1000 req/min | 0 alarms in 100-community sim |
| SG-new | Anomalous drift detected | 2x expected lag → alarm fires |

## Acceptance Criteria Verification

### S14-T1 (SSE Event IDs)
- [x] Monotonic generator produces sequential integers
- [x] Composite generator produces "{serverId}:{seq}" format
- [x] Factory returns Composite when SSE_SERVER_ID env var set
- [x] Parser handles both formats + edge cases (empty, multi-colon, invalid)
- [x] fromLastEventId resumes from correct sequence
- [x] Different-server detection starts fresh (defers to STREAM_RESUME_LOST)
- [x] Route handler updated to use generators

### S14-T2 (Adaptive Drift)
- [x] At zero throughput, threshold equals static DRIFT_THRESHOLD_MICRO_CENTS
- [x] At 1000 req/min with avg cost 5000 μ¢, threshold scales to 3,000,000
- [x] Adaptive threshold always >= static floor (monotonicity)
- [x] Adaptive threshold always <= max ceiling (bounded)
- [x] Hard overspend: PG > Redis always fires alarm
- [x] Warning fires when drift exceeds static but not adaptive
- [x] All BudgetUsageQueryProvider implementers updated with getRequestRate
- [x] Request rate uses 60-min trailing window
- [x] Property tests: monotonicity and bounds verified
- [x] All 23 original drift monitor tests still pass (getRequestRate returns 0)

### S14-T3 (Integration Under Load)
- [x] Zero false positives at simulated 1000 req/min with 30s propagation lag
- [x] Anomalous drift (2x expected) at 1000 req/min fires alarm
- [x] Low-throughput (<10 req/min) communities use static threshold

### S14-T4 (Dist Sync)
- [x] dist/agent/sse-event-id.js created
- [x] dist/agent/budget-drift-monitor.js updated with adaptive logic
- [x] dist/agent/index.js exports all new modules
- [x] dist:verify validates all 8 modules

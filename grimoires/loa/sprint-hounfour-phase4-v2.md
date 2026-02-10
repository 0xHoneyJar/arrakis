# Sprint Plan: Spice Gate v2.0 — PRD v1.3.0 / SDD v2.0.0 Delta

**Version**: 1.1.0
**Date**: February 10, 2026
**Cycle**: cycle-010 (Spice Gate)
**PRD**: `grimoires/loa/prd-hounfour-phase4.md` v1.3.0
**SDD**: `grimoires/loa/sdd-hounfour-phase4.md` v2.0.0
**Branch**: `feature/spice-gate-phase4` (continues existing PR #40)

---

## Overview

| Property | Value |
|----------|-------|
| Total Sprints | 3 (Sprints 10-12, continuing from existing 0-9) |
| Sprint Duration | ~2-3 days each |
| Team Size | 1 developer (AI-assisted) |
| Scope | PRD v1.3.0 delta + 6 Flatline HIGH_CONSENSUS improvements |
| Source | GPT review (4 iterations, APPROVED) + Flatline Protocol (6 HIGH_CONSENSUS, 6 blockers overridden) |
| Global Sprint IDs | 186-188 |

## What Changed (PRD v1.2.0 → v1.3.0, SDD v1.4.0 → v2.0.0)

Sprints 0-9 implemented the original Spice Gate architecture against PRD v1.2.0 / SDD v1.4.0, including two rounds of Bridgebuilder hardening. This sprint plan covers only the **delta** — new requirements and contract improvements:

| Change | Source | Sprint |
|--------|--------|--------|
| Input validation limits (§7.4) | Flatline IMP-006 | Sprint 10 |
| Stream abort propagation (AbortController) | Flatline IMP-002 | Sprint 10 |
| X-RateLimit-Policy header | PRD FR-3.3 | Sprint 10 |
| ALREADY_RESERVED idempotent handling | Flatline IMP-001 | Sprint 10 |
| STREAM_RESUME_LOST handling (§4.6.1) | PRD FR-1.8 | Sprint 11 |
| Per-platform idempotency key derivation (§9.4) | Flatline IMP-010 | Sprint 11 |
| req_hash mismatch contract (400 REQ_HASH_MISMATCH) | Flatline IMP-003 | Sprint 11 |
| HTTP API idempotency enforcement (§9.4) | GPT review gap | Sprint 11 |
| Budget overrun policy — max-cost ceiling (§4.5.1) | Flatline IMP-008 | Sprint 11 |
| Two-layer auth contract tests (§7.2.3) | PRD FR-2.6 | Sprint 12 |
| JWKS 72h safety TTL verification | PRD FR-1.9 | Sprint 12 |
| PII redaction audit (§16) | PRD NF-RET-1/3 | Sprint 12 |
| Budget drift monitoring job | SDD §4.5.1 | Sprint 12 |
| Ship gate checklist (§18) — 14 gates | PRD §11 | Sprint 12 |

## Sprint Dependency Graph

```
Sprint 10 (Input Hardening + Stream Safety)
    ↓
Sprint 11 (Protocol Correctness + Idempotency)
    ↓
Sprint 12 (Ship Gate Verification)
```

Sprint 11 depends on Sprint 10 because:
- STREAM_RESUME_LOST handling uses AbortController patterns from Sprint 10
- Per-platform idempotency key derivation integrates with input validation
- Budget overrun ceiling passes through validated request structure

Sprint 12 depends on Sprint 11 because:
- Ship gate verification validates all Sprint 10-11 implementations
- Contract tests reference behaviors implemented in Sprint 10-11
- Drift monitoring relies on budget overrun policy from Sprint 11

---

## Sprint 10: Input Hardening + Stream Safety (Global ID: 186)

**Goal**: Add input validation middleware, stream abort propagation, and rate limit policy headers. Closes DoS/cost attack surface identified by Flatline Protocol.

### S10-T1: Input Validation Middleware (§7.4, IMP-006)

**Files**: `themes/sietch/src/api/routes/agents.ts`, `packages/adapters/agent/types.ts`
**Description**: Implement input size limits and zod schema validation per SDD §7.4 to prevent DoS via oversized payloads and budget heuristic bypass.

**Implementation**:
1. Set `express.json({ limit: '128kb' })` on agent routes
2. Create `AgentRequestSchema` zod validator (shared between Express routes and bot handlers)
3. Add JWT token size check (4KB max) in auth middleware
4. Add `X-Idempotency-Key` header validation (128 chars, printable ASCII)

**Acceptance Criteria**:
- [ ] Express body parser rejects payloads > 128KB with 413
- [ ] Zod rejects: messages array > 50, single content > 32,000 chars, model_alias > 64 chars, tools > 20
- [ ] JWT > 4KB rejected with 401 `TOKEN_TOO_LARGE` before parse
- [ ] Idempotency key > 128 chars rejected with 400
- [ ] Unit test: oversized payload returns 413/400 (not 500)
- [ ] Unit test: valid payload at boundary sizes passes validation

**Effort**: Small
**Dependencies**: None

### S10-T2: Stream Abort Propagation (IMP-002)

**Files**: `packages/adapters/agent/agent-gateway.ts`, `packages/adapters/agent/loa-finn-client.ts`, `themes/sietch/src/api/routes/agents.ts`
**Description**: Wire AbortController from downstream client disconnect to upstream loa-finn request per SDD §4.7, preventing token waste on abandoned streams.

**Implementation**:
1. `AgentGateway.stream()` accepts optional `downstreamSignal?: AbortSignal`
2. Create `upstreamController = new AbortController()` and link to downstreamSignal
3. Pass `upstreamController.signal` to `LoaFinnClient.stream()`
4. In `finally` block: cleanup event listeners, abort upstream
5. Express SSE handler: pass `req` close event as abort signal
6. Discord handler: pass interaction timeout as abort signal
7. Telegram handler: no native abort signal (skip)
8. **Reconciliation on abort**: Locate finalize/reconcile scheduling code path and verify it runs on abort. If not, refactor to run reconciliation enqueue in `finally` block (idempotent — safe to enqueue even if `usage` event already processed). This ensures budget accounting drift does not accumulate from abandoned streams.

**Acceptance Criteria**:
- [ ] Client disconnect (Express `req.on('close')`) aborts upstream fetch within 1s
- [ ] Discord interaction timeout aborts upstream fetch
- [ ] `finally` block always cleans up event listeners (no memory leak)
- [ ] Reconciliation job enqueued even when stream aborted before `usage` event (verified via test)
- [ ] Unit test: abort before `usage` event → reconciliation job enqueued (idempotent)
- [ ] Integration test: slow client disconnect → verify upstream request cancelled (mock loa-finn)
- [ ] Unit test: AbortController propagation from downstream to upstream

**Effort**: Medium
**Dependencies**: None

### S10-T3: X-RateLimit-Policy Header (FR-3.3)

**Files**: `themes/sietch/src/api/routes/agents.ts`, `packages/adapters/agent/agent-rate-limiter.ts`
**Description**: Add `X-RateLimit-Policy` response header reporting the constraining rate limit dimension per PRD FR-3.3 and SDD §6.1.

**Implementation**:
1. `RateLimitResult` already has `policy: string` field (added in SDD v2.0.0)
2. `AgentRateLimiter.check()` already returns `dimension` (most restrictive)
3. Set `policy` = `dimension ?? 'none'` in `parseRateLimitResult()`
4. Express route handlers: set `res.setHeader('X-RateLimit-Policy', rlResult.policy)` on all agent responses (invoke, stream, models, budget)

**Acceptance Criteria**:
- [ ] All agent API responses include `X-RateLimit-Policy` header
- [ ] Header value matches the most restrictive dimension (community/user/channel/burst)
- [ ] When no limit is close, value is `none`
- [ ] SSE responses include the header in initial response headers
- [ ] Unit test: verify header present on 200 and 429 responses

**Effort**: Small
**Dependencies**: None

### S10-T4: ALREADY_RESERVED Idempotent Handling (IMP-001)

**Files**: `packages/adapters/agent/budget-manager.ts`
**Description**: Ensure `parseBudgetResult()` maps `ALREADY_RESERVED` Lua response to successful `{ status: 'RESERVED' }` per SDD §4.5 IMP-001 clarification.

**Implementation**:
1. In `parseBudgetResult()`: map `ALREADY_RESERVED` → `{ status: 'RESERVED', reservationId: existingId, warningThreshold: false }`
2. Log at `debug` level: `budget-reserve: idempotent hit for {idempotencyKey}`

**Acceptance Criteria**:
- [ ] Duplicate `reserve()` call with same idempotency_key returns success (not error)
- [ ] Reserved counter NOT double-incremented on duplicate
- [ ] Unit test: two concurrent reserves with same key → both succeed, counter incremented once
- [ ] Integration test (real Redis): 10 parallel reserves with same key → counter = 1× estimated cost

**Effort**: Small
**Dependencies**: None

---

## Sprint 11: Protocol Correctness + Idempotency (Global ID: 187)

**Goal**: Implement STREAM_RESUME_LOST handling, per-platform idempotency key derivation, req_hash mismatch contract, HTTP API idempotency enforcement, and budget overrun policy.

### S11-T0: Idempotency State Machine Spec (Flatline SKP-002)

**Files**: `packages/adapters/agent/idempotency.ts` (spec comment block or separate `IDEMPOTENCY.md`)
**Description**: Define a single unified idempotency state machine covering all key lifecycle transitions. This prerequisite spec ensures S11-T1, S11-T2, and S11-T4 implement consistent semantics rather than conflicting ones. (Flatline SKP-002, severity 880.)

**State Machine**:
```
Key States: NEW → ACTIVE → COMPLETED | ABORTED | RESUME_LOST

Transitions:
  NEW → ACTIVE:        First request with this idempotency key
  ACTIVE → COMPLETED:  Stream finishes normally (usage event received)
  ACTIVE → ABORTED:    Client disconnects before completion
  ACTIVE → RESUME_LOST: loa-finn returns 409 STREAM_RESUME_LOST

Key Reuse Rules:
  retry (same key):     Reuse key → hits ALREADY_RESERVED → idempotent success
  SSE reconnect:        Reuse key + Last-Event-ID → resume stream (not new execution)
  STREAM_RESUME_LOST:   Mint NEW key → fresh execution (old key transitions to RESUME_LOST)
  message edit:         Mint NEW key (append :edit) → fresh execution
  platform retry:       Same platform event ID → same key → idempotent

SSE Reconnect Edge Cases:
  - Client reconnects WITHOUT Last-Event-ID: treated as retry (same key, idempotent)
  - Client reconnects WITH Last-Event-ID: resume from event (same key)
  - Proxy strips Last-Event-ID: falls back to retry semantics (safe, may replay events)
  - Client reconnects after STREAM_RESUME_LOST: gets 409, must mint new key
```

**Acceptance Criteria**:
- [ ] State machine documented in `idempotency.ts` as JSDoc or in `IDEMPOTENCY.md`
- [ ] All transitions explicitly defined (no implicit/undefined states)
- [ ] SSE reconnect behavior defined for: with Last-Event-ID, without Last-Event-ID, after RESUME_LOST
- [ ] Key reuse vs key mint rules documented for: retry, reconnect, edit, RESUME_LOST, platform replay
- [ ] S11-T1, S11-T2, S11-T4 reference this spec for their idempotency behavior
- [ ] Unit test: state transition table — verify each transition produces expected key behavior

**Effort**: Small (spec + tests, no new runtime code)
**Dependencies**: None (this is the prerequisite for S11-T1, S11-T2, S11-T4)

### S11-T1: STREAM_RESUME_LOST Handling (§4.6.1, FR-1.8)

**Files**: `packages/adapters/agent/loa-finn-client.ts`, `packages/adapters/agent/agent-gateway.ts`, `packages/adapters/agent/types.ts`
**Description**: Implement `streamWithResume()` method and 409 STREAM_RESUME_LOST error handling per SDD §4.6.1.

**Implementation**:
1. Add `StreamResumeLostError` and `JtiReplayError` error types
2. Implement `LoaFinnClient.streamWithResume()` per SDD §4.6.1 code
3. On 409: parse body — if `STREAM_RESUME_LOST`, throw `StreamResumeLostError`; else throw `JtiReplayError`
4. `executeWithRetry()`: on `JtiReplayError` → mint new JWT, retry; on `StreamResumeLostError` → propagate to caller (do NOT retry)
5. Bot handlers: catch `StreamResumeLostError` → generate new idempotency_key, show "Restarted" indicator to user

**Acceptance Criteria**:
- [ ] 409 with `STREAM_RESUME_LOST` in body throws `StreamResumeLostError` (not retried)
- [ ] 409 without `STREAM_RESUME_LOST` (jti replay) triggers JWT re-mint and retry
- [ ] Discord handler: catch `StreamResumeLostError` → new idempotency_key + "(restarted)" suffix in response
- [ ] Telegram handler: catch `StreamResumeLostError` → new idempotency_key + "(restarted)" suffix
- [ ] `Last-Event-ID` header forwarded when provided
- [ ] Unit test: mock 409 responses → correct error type thrown
- [ ] Integration test: simulate STREAM_RESUME_LOST flow end-to-end

**Effort**: Medium
**Dependencies**: Sprint 10 (AbortController patterns), S11-T0 (idempotency state machine spec)

### S11-T2: Per-Platform Idempotency Key Derivation (§9.4, IMP-010)

**Files**: `packages/adapters/agent/idempotency.ts` (NEW), `themes/sietch/src/discord/commands/agent.ts`, `themes/sietch/src/telegram/commands/agent.ts`
**Description**: Replace UUIDv4 fallback idempotency keys with deterministic platform-derived keys per SDD §9.4.

**Implementation**:
1. Create `deriveIdempotencyKey(platform, ctx)` function per SDD §9.4
2. Discord: use `interaction.id` for slash commands, `message.id` for prefix commands
3. Telegram: use `update.update_id` for commands, `callback_query.id` for callbacks
4. HTTP API: passthrough `X-Idempotency-Key` header
5. Fallback: UUIDv4 with `warn` log for unknown platform contexts
6. Edit semantics: Discord/Telegram message edits → append `:edit` → new execution

**Acceptance Criteria**:
- [ ] Discord slash command: `discord:interaction:{interaction.id}` key
- [ ] Discord message: `discord:msg:{message.id}` key
- [ ] Telegram update: `telegram:update:{update_id}` key
- [ ] HTTP API: `X-Idempotency-Key` header value used directly
- [ ] Same platform event always produces same key (idempotent retries safe)
- [ ] Different events produce different keys (no collisions)
- [ ] Message edits produce new key (triggers fresh execution)
- [ ] Fallback generates UUIDv4 with warn log
- [ ] Unit test: deterministic key generation for each platform
- [ ] Unit test: edit flag changes key

**Effort**: Medium
**Dependencies**: Sprint 10 (input validation for key format), S11-T0 (idempotency state machine spec)

### S11-T3: req_hash Mismatch Contract Test (IMP-003)

**Files**: `packages/adapters/agent/loa-finn-client.ts`, `packages/adapters/agent/req-hash.ts` (NEW), integration tests
**Description**: Handle 400 `REQ_HASH_MISMATCH` from loa-finn per SDD §6.3.2 contract. Includes defining the canonicalization strategy for req_hash computation so the contract test is deterministic.

**Implementation**:
1. **Canonicalization strategy**: Define `computeReqHash(body: object): string` in `req-hash.ts`:
   - Input: the JSON request body object (same object passed to `fetch()`)
   - Canonicalize: `JSON.stringify(body)` (no key sorting — use the same serialization as the fetch call)
   - Hash: `base64url(SHA-256(canonicalBytes))` where `canonicalBytes = new TextEncoder().encode(canonicalJson)`
   - This function MUST be called from the same code path that sends the request, ensuring wire bytes and hash always match
2. `LoaFinnClient.invoke()` / `.stream()`: call `computeReqHash(requestBody)` and include result as `req_hash` claim in JWT
3. `LoaFinnClient`: on 400 with `REQ_HASH_MISMATCH` in body → throw `ReqHashMismatchError` (non-retryable)
4. `executeWithRetry()`: skip retry on 400 (client error, not transient)
5. Log at `warn` level with trace_id, expected_prefix, received_prefix
6. **Contract test harness**: Use HTTP mock that records raw request bytes; assert `base64url(SHA-256(recordedBytes))` equals JWT `req_hash` claim

**Acceptance Criteria**:
- [ ] `computeReqHash()` produces deterministic hash from request body object
- [ ] `req_hash` JWT claim computed from same code path as request serialization (no divergence possible)
- [ ] Contract test: mock records wire bytes, verifies `base64url(SHA-256(wireBytes))` matches JWT `req_hash` claim
- [ ] 400 `REQ_HASH_MISMATCH` not retried (thrown immediately)
- [ ] Error includes trace_id for debugging
- [ ] Log entry at `warn` level with hash prefixes
- [ ] Unit test: mock 400 response → `ReqHashMismatchError` thrown, no retry
- [ ] Unit test: `computeReqHash()` is deterministic (same input → same output across calls)

**Effort**: Small
**Dependencies**: None

### S11-T4: HTTP API Idempotency Enforcement (§9.4, SG-11)

**Files**: `themes/sietch/src/api/routes/agents.ts`, `packages/adapters/agent/idempotency.ts`, integration tests
**Description**: Ensure HTTP invoke and stream endpoints use the `X-Idempotency-Key` header for idempotent execution (not just validation from S10-T1). Without this, ship gate SG-11 ("Idempotency correct") fails for HTTP paths even if Discord/Telegram are deterministic.

**Implementation**:
1. HTTP invoke endpoint: extract `X-Idempotency-Key` from request headers and pass to `AgentGateway.invoke()` as `idempotencyKey` parameter
2. HTTP stream endpoint: extract `X-Idempotency-Key` and pass to `AgentGateway.stream()` as `idempotencyKey` parameter
3. Missing header behavior: generate server-side UUIDv4 key + set `X-Idempotency-Key` response header so client can use it for retries. Log at `info` level: `idempotency-key: generated server-side for HTTP request`
4. SSE reconnect: on `Last-Event-ID` header, use same idempotency key (resume, not new execution)
5. Gateway uses idempotency key for budget reservation (existing `reserve()` path) — ensures retry with same key hits `ALREADY_RESERVED` path from S10-T4

**Acceptance Criteria**:
- [ ] HTTP invoke: `X-Idempotency-Key` header used as budget reservation key
- [ ] HTTP stream: `X-Idempotency-Key` header used as budget reservation key
- [ ] Missing header: server generates key, returns in `X-Idempotency-Key` response header
- [ ] SSE reconnect with `Last-Event-ID`: same idempotency key preserved (not new execution)
- [ ] Integration test: HTTP invoke retry with same `X-Idempotency-Key` → single execution (ALREADY_RESERVED)
- [ ] Integration test: SSE reconnect with `Last-Event-ID` + same key → stream resumes (not restarts)
- [ ] Unit test: missing header → server-generated key in response

**Effort**: Medium
**Dependencies**: S10-T1 (header validation), S10-T4 (ALREADY_RESERVED handling), S11-T0 (idempotency state machine spec), S11-T2 (idempotency.ts module)

### S11-T5: Budget Overrun Policy — Max-Cost Ceiling (§4.5.1, IMP-008)

**Files**: `packages/adapters/agent/agent-gateway.ts`, `packages/adapters/agent/budget-manager.ts`
**Description**: Implement max-cost ceiling and drift alerting per SDD §4.5.1.

**Implementation**:
1. `AgentGateway.invoke()` and `.stream()`: include `max_cost_micro_cents: 3 * estimatedCostMicroCents` in loa-finn request metadata
2. On finalize: if `actualCost > 2 * estimatedCost` → log `warn` + increment `agent_budget_drift_micro_cents` metric
3. If `actualCost > 3 * estimatedCost` → fire `BUDGET_DRIFT_HIGH` alarm
4. `BudgetManager.estimateCost()`: return estimate alongside the check result so gateway can compute ceiling

**Acceptance Criteria**:
- [ ] loa-finn request includes `max_cost_micro_cents` in metadata
- [ ] Finalize logs `warn` when actual > 2× estimated
- [ ] `BUDGET_DRIFT_HIGH` alarm fires when actual > 3× estimated
- [ ] `agent_budget_drift_micro_cents` metric emitted on any overrun
- [ ] Unit test: verify ceiling = 3× estimate in request metadata
- [ ] Unit test: drift detection at 2× and 3× thresholds

**Effort**: Small
**Dependencies**: None

---

## Sprint 12: Ship Gate Verification (Global ID: 188)

**Goal**: Verify all 14 ship gates, run contract tests for two-layer auth and JWKS safety TTL, complete PII redaction audit, deploy drift monitoring job. Final validation before Phase 4 ships.

### S12-T1: Two-Layer Authorization Contract Tests (§7.2.3, FR-2.6)

**Files**: Integration tests, `tests/fixtures/tier-policy-fixtures.json` (NEW)
**Description**: Verify Arrakis per-community policy ∩ loa-finn global ceiling produces correct effective aliases for all tier × access level combinations. Uses versioned test fixtures for deterministic CI execution.

**Implementation**:
1. **Prerequisite — versioned fixtures**: Create `tests/fixtures/tier-policy-fixtures.json` containing:
   - `tiers`: all 9 tiers with their `allowed_model_aliases` mapping
   - `access_levels`: 3 levels (free, pro, enterprise) with alias sets
   - `ceiling_policy`: mock loa-finn global ceiling response (the aliases loa-finn permits per tier)
   - `expected_effective`: pre-computed expected results for all 27 combinations
   - Version field for tracking fixture updates
2. For all 9 tiers × 3 access levels: verify `allowed_model_aliases ⊆ ceiling` using fixture data
3. Test: per-community override that restricts (within ceiling) → honored
4. Test: per-community override that expands (beyond ceiling) → ceiling enforced
5. Test: mock loa-finn rejecting aliases outside ceiling with 403 + `POLICY_ESCALATION` (mock returns canned fixture responses)

**Acceptance Criteria**:
- [ ] `tier-policy-fixtures.json` created with all 9 tiers × 3 access levels + expected results
- [ ] Fixture file is versioned and self-documenting (includes `_version` and `_description` fields)
- [ ] 27 test cases: all driven from fixture data (no hardcoded policy in test code)
- [ ] Community override restricting aliases: effective set is intersection
- [ ] Community override expanding beyond ceiling: loa-finn mock returns 403
- [ ] `POLICY_ESCALATION` alert logged on ceiling violation
- [ ] Test covers: free→{cheap}, pro→{cheap,fast-code,reviewer}, enterprise→{all}
- [ ] Tests run in CI with no external dependencies (all policy responses mocked from fixtures)

**Effort**: Medium
**Dependencies**: None

### S12-T2: JWKS 72h Safety TTL Verification (FR-1.9)

**Files**: Integration tests, `packages/adapters/agent/jwks-cache.ts` (minor refactor for testability)
**Description**: Verify JWKS caching contract per SDD §7.2.2 — particularly the 72h safety TTL and 48h old-kid retention. Requires injectable clock for simulated-time testing (cannot wait 73h in CI).

**Implementation**:
1. **Testability prerequisite**: Introduce injectable `Clock` interface (`now(): number`) in JWKS cache. Production uses `Date.now()`, tests use `FakeClock` with `advance(ms)` method. This is a minimal refactor — add optional `clock` parameter to JWKS cache constructor, default to real clock.
2. Test (simulated time): JWKS endpoint unreachable for 1h → cached keys still accepted
3. Test (simulated time): JWKS endpoint unreachable for 73h → loa-finn fails closed with 503
4. Test (simulated time): key rotation during live traffic → zero 401s (48h overlap)
5. Test (simulated time): old kid removed from JWKS → still accepted for 48h from local cache
6. All TTL tests use `fakeClock.advance(hours * 3600_000)` — no real-time waiting

**Acceptance Criteria**:
- [ ] `Clock` interface injectable in JWKS cache constructor (default: `Date.now()`)
- [ ] `FakeClock` test helper with `advance(ms)` method
- [ ] Cached keys valid during simulated 1h outage
- [ ] Fail closed after simulated 73h outage (503, not 401)
- [ ] Zero 401s during simulated key rotation with 48h overlap
- [ ] Old kid retained 48h (simulated) after removal from JWKS response
- [ ] Thundering herd: concurrent unknown-kid requests coalesced to 1 fetch
- [ ] All TTL tests run in < 5s (simulated time, not real time)

**Effort**: Medium
**Dependencies**: None

### S12-T3: PII Redaction Audit (§16, NF-RET-1/3)

**Files**: All agent-related log sites, `packages/adapters/agent/` directory
**Description**: Audit all structured log sites for PII leakage per SDD §16.

**Implementation**:
1. Grep all `logger.info/warn/error` calls in agent adapters
2. Verify `AGENT_REDACT_PATHS` covers: messages content, response content, thinking traces, JWT tokens
3. Verify wallet addresses use `redactWallet()` (first 6 + last 4)
4. Verify PII patterns (API keys, emails) are caught by regex
5. Run log scan: replay 100 test requests, verify zero PII in output

**Acceptance Criteria**:
- [ ] Zero raw message content in any log line
- [ ] Zero full wallet addresses in logs (only redacted form)
- [ ] Zero JWT tokens in logs
- [ ] Zero thinking traces persisted at rest
- [ ] Log scan script: grep for PII patterns in test log output → zero matches
- [ ] `agent_usage_log` table: no content columns (only metadata)

**Effort**: Small
**Dependencies**: None

### S12-T4: Budget Drift Monitoring Job (§4.5.1)

**Files**: `packages/adapters/agent/budget-drift-monitor.ts` (NEW), BullMQ job registration
**Description**: Implement scheduled job that compares Redis committed counters against PostgreSQL `agent_usage_log` to detect accounting drift per SDD §4.5.1.

**Implementation**:
1. BullMQ repeatable job: every 15 minutes
2. For each active community: `SUM(cost_micro_cents)` from `agent_usage_log` vs Redis `agent:budget:committed:{community}:{month}`
3. If drift > 500,000 micro-cents ($0.50) → fire `BUDGET_ACCOUNTING_DRIFT` alarm
4. Log drift amounts for all communities (even within tolerance) at `debug` level

**Acceptance Criteria**:
- [ ] Job runs every 15 minutes via BullMQ repeatable
- [ ] Compares Redis vs PostgreSQL for each active community
- [ ] `BUDGET_ACCOUNTING_DRIFT` alarm fires when drift > $0.50
- [ ] Job does not block or slow agent request path
- [ ] Unit test: mock Redis/PG values → alarm triggers at threshold
- [ ] Graceful handling of missing communities or empty months

**Effort**: Small
**Dependencies**: None

### S12-T5: Ship Gate Checklist Verification (§18)

**Files**: Ship gate verification script or manual test plan, `tests/load/budget-concurrency.k6.ts` (NEW)
**Description**: Verify all 14 ship gates from SDD §18. This is the final validation task. Includes concrete benchmark harness, load testing, and failover procedure definitions (Flatline IMP-002, IMP-003, IMP-005).

**Benchmark Environment & Harness** (Flatline IMP-002):
- **Runner**: k6 (load tests) + custom Node.js benchmark script (latency micro-benchmarks)
- **Environment**: docker-compose with Redis, PostgreSQL, mock loa-finn (deterministic 200ms response)
- **Warmup**: 100 requests discarded before measurement
- **Pass/Fail**: p95 latency (not mean). SG-1: p95 < 5ms. SG-4: p95 < 50ms.
- **Runs**: 3 consecutive runs, all must pass (no cherry-picking)

**SG-6 Budget Concurrency Load Test** (Flatline IMP-003):
- k6 script: 100 virtual users, each sending 1 invoke request simultaneously with unique idempotency keys
- Mock loa-finn returns deterministic cost (10,000 micro-cents per request)
- After all 100 complete: assert Redis `committed` counter = 100 × 10,000 = 1,000,000 micro-cents (±0)
- "Zero overspend" definition: `committed_total <= sum(actual_costs)`. Under retries/aborts, committed must not exceed actual — verified by reconciliation job run after load test
- Edge case: 10 of 100 requests abort mid-stream → reconciliation corrects, final committed still accurate

**SG-8 Redis Failover Procedure** (Flatline IMP-005):
- Topology: Redis Sentinel (1 master, 1 replica, 3 sentinels) via docker-compose
- Test steps: (1) Start traffic at 10 req/s, (2) `docker pause redis-master`, (3) Measure time until sentinel promotes replica, (4) Measure time until gateway returns 503 (fail-closed), (5) Measure time until gateway reconnects to new master and returns 200
- Pass criteria: Time from master pause → 503 response < 30s. Time from failover → 200 recovery < 60s.
- Fallback (if Sentinel not available in CI): use `iptables` to block Redis port, verify 503 within 30s of `connect_timeout`

**Ship Gate Results** (to be filled during verification):

| # | Gate | Target | Status | Evidence |
|---|------|--------|--------|----------|
| SG-1 | JWT round-trip p95 < 5ms | M-1 | [ ] | Benchmark output (3 runs) |
| SG-2 | Tier→model correct (9×3) | FR-2.6 | [ ] | S12-T1 test results |
| SG-3 | Rate limit zero bypass | M-3 | [ ] | Penetration test output |
| SG-4 | Gateway overhead p95 < 50ms | M-4 | [ ] | Benchmark output (3 runs) |
| SG-5 | 8/8 PR #39 resolved | M-5 | [ ] | Sprint 0 audit (already done) |
| SG-6 | Budget zero overspend (100 concurrent) | FR-7.13 | [ ] | k6 load test + reconciliation verification |
| SG-7 | Key rotation zero 401s | FR-1.9 | [ ] | S12-T2 test results |
| SG-8 | Redis failover 503 <30s | NF-REL-4 | [ ] | Sentinel failover test output |
| SG-9 | No raw prompts persisted | NF-RET-1 | [ ] | S12-T3 audit results |
| SG-10 | No PII in logs | NF-RET-3 | [ ] | S12-T3 log scan |
| SG-11 | Idempotency correct | FR-1.7 | [ ] | S11-T4 integration test output |
| SG-12 | STREAM_RESUME_LOST handled | FR-1.8 | [ ] | S11-T1 test results |
| SG-13 | Trust boundary approved | Sprint 0 | [ ] | Document review (already done) |
| SG-14 | Discord E2E works | — | [ ] | Manual verification |

**Acceptance Criteria**:
- [ ] All 14 gates marked as PASS with evidence
- [ ] Benchmark harness produces reproducible results (3 consecutive runs)
- [ ] k6 load test script committed and runnable in CI
- [ ] Redis failover procedure documented with pass/fail thresholds
- [ ] Any FAIL gate has a documented remediation plan
- [ ] Ship gate results committed to `grimoires/loa/ship-gate-results.md`

**Effort**: Large (upgraded from Medium due to load test + failover harness)
**Dependencies**: S12-T1, S12-T2, S12-T3, S12-T4

---

## Appendix A: Goal Traceability

| Goal ID | Description | Sprint Tasks |
|---------|-------------|-------------|
| G-1 | Secure JWT-based agent access | S10-T1 (input limits), S11-T3 (req_hash), S12-T2 (JWKS TTL) |
| G-2 | Tier-gated model access | S12-T1 (two-layer auth tests) |
| G-3 | Multi-dimensional rate limiting | S10-T3 (X-RateLimit-Policy header) |
| G-4 | Community budget enforcement | S10-T4 (ALREADY_RESERVED), S11-T5 (overrun policy), S12-T4 (drift monitoring) |
| G-5 | Streaming AI responses | S10-T2 (abort propagation), S11-T1 (STREAM_RESUME_LOST) |
| G-6 | Idempotent request handling | S11-T0 (state machine spec), S11-T2 (per-platform key derivation), S11-T4 (HTTP API idempotency) |
| G-7 | Production readiness | S12-T3 (PII audit), S12-T5 (ship gates) |

## Appendix B: Risk Assessment

| Risk | Mitigation | Sprint |
|------|-----------|--------|
| Input validation too restrictive | Start with generous limits (50 messages, 32K chars), monitor 413s, adjust | Sprint 10 |
| AbortController leak on rapid disconnect/reconnect | Always cleanup in `finally`, integration test with rapid connect/disconnect cycle | Sprint 10 |
| STREAM_RESUME_LOST rare in practice | Test with mock; document that it requires loa-finn cooperation (contract v1) | Sprint 11 |
| Per-platform key collisions | Platform prefix prevents cross-platform collisions; Discord/Telegram IDs are unique | Sprint 11 |
| Ship gate SG-8 (Redis failover) hard to test locally | Use docker-compose Redis with `DEBUG SLEEP` to simulate latency; manual failover test in staging | Sprint 12 |

## Appendix C: Files Changed Summary

| Sprint | New Files | Modified Files |
|--------|-----------|---------------|
| Sprint 10 | — | agents.ts (routes), agent-gateway.ts, loa-finn-client.ts, budget-manager.ts, types.ts |
| Sprint 11 | idempotency.ts, req-hash.ts | loa-finn-client.ts, agent-gateway.ts, discord/agent.ts, telegram/agent.ts, agents.ts (routes) |
| Sprint 12 | budget-drift-monitor.ts, tier-policy-fixtures.json, budget-concurrency.k6.ts, ship-gate-results.md | jwks-cache.ts (Clock injection), integration test files |

**Total new files**: 5 (idempotency.ts, req-hash.ts, budget-drift-monitor.ts, tier-policy-fixtures.json, budget-concurrency.k6.ts)
**Total modified files**: ~12
**Estimated LOC**: ~900-1100 (implementation) + ~700 (tests + load tests)

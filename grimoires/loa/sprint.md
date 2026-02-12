# Sprint Plan: The Capability Mesh — Per-Model Accounting & Protocol Architecture

**Version**: 1.1.0
**Date**: February 12, 2026
**Cycle**: cycle-019
**Codename**: The Capability Mesh
**Source**: Bridgebuilder Round 6 findings ([PR #53](https://github.com/0xHoneyJar/arrakis/pull/53))
**PRD**: `prd-hounfour-endgame.md` v1.2.0 (extended)
**SDD**: `sdd-hounfour-endgame.md` v1.2.0 (extended)
**RFC**: [0xHoneyJar/loa-finn#31](https://github.com/0xHoneyJar/loa-finn/issues/31)

---

## Overview

| Attribute | Value |
|-----------|-------|
| **Total Sprints** | 4 |
| **Sprint Timebox** | 1 day per sprint (solo AI-assisted); hard stop + scope cut if exceeded |
| **Developer** | Solo (AI-assisted) |
| **Repos** | arrakis (primary) |
| **Critical Path** | Sprint 1 → Sprint 4 (per-model accounting flows into dashboard metrics) |
| **Parallel Work** | Sprints 2 & 3 are independent of each other |
| **Global Sprint IDs** | 209–212 |

### Context

PR #53 consolidated cycles 015–018 (Hounfour Endgame + Bridgebuilder Rounds 3–4), delivering 15 commits across 65 files. The Bridgebuilder Round 6 review identified 7 architectural findings that advance the system from "feature-complete" to "protocol-grade." This cycle implements all 7.

### Goals

| ID | Goal | BB6 Finding | Metric |
|----|------|-------------|--------|
| G-1 | Per-model-invocation accounting in ensemble results | #6 (Ensemble Budget) | Usage reports include `model_breakdown` array with per-model costs |
| G-2 | Contract package promoted to standalone shared protocol | #2 (Contract Protocol Nucleus) | `@arrakis/loa-finn-contract` importable from root workspace |
| G-3 | POOL_PROVIDER_HINT as configurable routing policy | #5 (Provider Policy) | Provider hints loaded from env/config, not hardcoded |
| G-4 | API key string persistence eliminated from V8 heap | #3 (Security) | Auth headers set via Buffer, no string conversion |
| G-5 | Fleet-wide circuit breaker via Redis | #4 (Circuit Breaker) | CB state shared across ECS containers |
| G-6 | Gateway lifecycle externalized as protocol | #1 (State Machine) | `RequestLifecycle` class drives invoke/stream |
| G-7 | Ensemble fallback incremental reservation release | #6 (Budget Optimization) | Fallback releases reservation capacity per attempt |

### Definition of Done (per sprint)

1. All acceptance criteria marked as passing
2. Unit tests pass (`vitest`)
3. E2E tests pass (13/13 minimum, new scenarios added)
4. No new lint/type errors introduced
5. Code committed to feature branch with sprint prefix
6. `/review-sprint` + `/audit-sprint` quality gates passed

---

## Sprint 1: Per-Model Ensemble Accounting (G-1)

**Global ID**: 209
**Goal**: Decompose ensemble cost attribution to per-model granularity, enabling hybrid BYOK/platform accounting within a single ensemble request.

**Why First**: This is the user's primary request and the highest-value architectural advance. It extends the existing ensemble system without breaking it, and the contract schema changes must land before other sprints can extend the protocol.

### Tasks

#### Task 1.1: `ModelInvocationResult` Type + Ensemble Decomposition

**New File**: `packages/adapters/agent/ensemble-accounting.ts`
**Modified**: `packages/core/ports/agent-gateway.ts`

- Define `ModelInvocationResult` type:
  ```typescript
  interface ModelInvocationResult {
    model_id: string;         // Pool ID or model alias used
    provider: string;         // 'openai' | 'anthropic'
    succeeded: boolean;       // Whether this invocation completed
    input_tokens: number;
    output_tokens: number;
    cost_micro: number;       // Cost in micro-USD for this model
    accounting_mode: 'PLATFORM_BUDGET' | 'BYOK_NO_BUDGET';
    latency_ms: number;       // Per-model latency
    error_code?: string;      // If failed, the error code
  }
  ```
- Define `EnsembleAccountingResult` type:
  ```typescript
  interface EnsembleAccountingResult {
    strategy: EnsembleStrategy;
    n_requested: number;
    n_succeeded: number;
    n_failed: number;
    model_breakdown: ModelInvocationResult[];
    total_cost_micro: number;           // Sum of succeeded model costs
    platform_cost_micro: number;        // Sum of PLATFORM_BUDGET costs only
    byok_cost_micro: number;            // Sum of BYOK_NO_BUDGET costs only
    reserved_cost_micro: number;        // Original N× reservation
    savings_micro: number;              // reserved - total (unused capacity)
  }
  ```
- Add `ensemble_accounting` optional field to `AgentInvokeResponse` port type

**Acceptance Criteria**:
- [ ] AC-1.1: `ModelInvocationResult` type exported from `@arrakis/core/ports`
- [ ] AC-1.2: `EnsembleAccountingResult` type exported from `@arrakis/core/ports`
- [ ] AC-1.3: Types support mixed accounting modes (BYOK + platform in same ensemble)
- [ ] AC-1.4: `savings_micro` correctly computes unused reservation capacity

#### Task 1.2: Contract Schema Extension — `model_breakdown` in Usage Reports

**Modified**: `tests/e2e/contracts/schema/loa-finn-contract.json`, `tests/e2e/contracts/src/index.ts`

- Extend `usage_report` schema with optional `model_breakdown` array:
  ```json
  "model_breakdown": {
    "type": "array",
    "items": {
      "type": "object",
      "required": ["model_id", "provider", "succeeded", "cost_micro", "accounting_mode"],
      "properties": {
        "model_id": { "type": "string" },
        "provider": { "type": "string", "enum": ["openai", "anthropic"] },
        "succeeded": { "type": "boolean" },
        "input_tokens": { "type": "integer", "minimum": 0 },
        "output_tokens": { "type": "integer", "minimum": 0 },
        "cost_micro": { "type": "integer", "minimum": 0 },
        "accounting_mode": { "type": "string", "enum": ["PLATFORM_BUDGET", "BYOK_NO_BUDGET"] },
        "latency_ms": { "type": "integer", "minimum": 0 },
        "error_code": { "type": "string" }
      }
    }
  }
  ```
- Bump contract package version to `1.1.0` (minor — backward-compatible addition)
- Add TypeScript types for `ModelBreakdownEntry` to contract package
- Extend `TestVectorUsageReport` type with optional `model_breakdown`

**Acceptance Criteria**:
- [ ] AC-1.5: Contract schema validates with `model_breakdown` present
- [ ] AC-1.6: Contract schema validates without `model_breakdown` (backward-compatible)
- [ ] AC-1.7: Contract version bumped to `1.1.0`
- [ ] AC-1.8: TypeScript types re-exported from contract package

#### Task 1.3: Hybrid BYOK/Platform Accounting Per Model

**Modified**: `packages/adapters/agent/agent-gateway.ts`, `packages/adapters/agent/ensemble-mapper.ts`

- Extend `AgentGateway.invoke()` and `stream()` to decompose ensemble cost by model:
  - For each model in the ensemble request, check BYOK eligibility via `resolveByokProvider()`
  - Models with BYOK key → `BYOK_NO_BUDGET` (cost_micro = 0 for platform)
  - Models without BYOK key → `PLATFORM_BUDGET` (normal cost accounting)
  - Budget reservation only for PLATFORM_BUDGET models: `multiplier = count(non-BYOK models)`
- Extend `EnsembleMapper.computePartialCost()` to return per-model breakdown
- Update `checkBudgetDrift()` to use `platform_cost_micro` (not total) for drift detection

**Acceptance Criteria**:
- [ ] AC-1.9: Ensemble with 3 models, 1 BYOK + 2 platform → budget reserves 2× (not 3×)
- [ ] AC-1.10: Usage report `model_breakdown` shows correct `accounting_mode` per model
- [ ] AC-1.11: Budget drift detection uses only platform costs
- [ ] AC-1.12: BYOK models tracked in `model_breakdown` with `cost_micro: 0`
- [ ] AC-1.13: Unit test: mixed BYOK/platform ensemble with partial failure — committed ≤ reserved
- [ ] AC-1.22: EMF metric emitted: `PerModelCost` with dimensions `{model_id, provider, accounting_mode}` (unit: micro-USD)
- [ ] AC-1.23: EMF metric emitted: `EnsembleSavings` with `savings_micro` value (unit: micro-USD)

#### Task 1.4: E2E Test Vectors for Per-Model Accounting

**Modified**: `tests/e2e/contracts/vectors/loa-finn-test-vectors.json`, `tests/e2e/agent-gateway-e2e.test.ts`, `tests/e2e/loa-finn-e2e-stub.ts`

- Add `invoke_ensemble_hybrid_byok` test vector:
  - 3-model best_of_n: model A (BYOK/anthropic), model B (platform), model C (platform)
  - Expected: `model_breakdown` with 3 entries, mixed `accounting_mode`
  - Expected: `platform_cost_micro` = sum of B + C, `byok_cost_micro` = 0
- Add `invoke_ensemble_per_model_partial` test vector:
  - 3-model consensus: model A succeeds, model B fails, model C succeeds
  - Expected: `model_breakdown` with 3 entries, `n_succeeded: 2`, `n_failed: 1`
  - Expected: `total_cost_micro` = A + C (failed model excluded)
- Update E2E stub to return `model_breakdown` in usage reports
- Update E2E tests to validate per-model cost attribution

**Acceptance Criteria**:
- [ ] AC-1.14: E2E test validates hybrid BYOK/platform ensemble accounting
- [ ] AC-1.15: E2E test validates per-model partial failure with correct cost attribution
- [ ] AC-1.16: All existing E2E tests still pass (backward compatibility)
- [ ] AC-1.17: E2E count ≥ 15 (up from 13)

#### Task 1.5: loa-finn Contract v1.1.0 Compatibility Verification

**Modified**: `tests/e2e/loa-finn-e2e-stub.ts`, `tests/e2e/agent-gateway-e2e.test.ts`

- Verify loa-finn tolerates the new `model_breakdown` field (additive schema):
  - Update E2E stub to simulate loa-finn receiving usage reports with `model_breakdown`
  - Test that loa-finn stub correctly ignores unknown fields (JSON Schema `additionalProperties: true`)
  - Test that loa-finn stub works with contract v1.0.0 payloads (no `model_breakdown`) AND v1.1.0 (with `model_breakdown`)
- If loa-finn is strict about schema validation, document the required loa-finn change as a cross-repo dependency in NOTES.md
- Add E2E scenario: arrakis sends v1.1.0 usage report → loa-finn stub validates and accepts

**Acceptance Criteria**:
- [ ] AC-1.18: E2E stub simulates loa-finn receiving `model_breakdown` in usage reports
- [ ] AC-1.19: Stub accepts both v1.0.0 (no `model_breakdown`) and v1.1.0 (with `model_breakdown`) payloads
- [ ] AC-1.20: If loa-finn requires changes, cross-repo dependency documented in NOTES.md with PR reference
- [ ] AC-1.21: Contract backward-compatibility proven by E2E (not just schema validation)

---

## Sprint 2: Contract Protocol Promotion + Provider Policy (G-2, G-3)

**Global ID**: 210
**Goal**: Promote the contract package to a standalone shared protocol artifact and make provider routing configurable.

**Why Second**: The contract schema was updated in Sprint 1. This sprint elevates it to protocol status and addresses the routing policy hardcoding.

### Tasks

#### Task 2.1: Contract Package Promotion to Workspace Root

**Modified**: `package.json` (root), `tests/e2e/contracts/package.json`

- Move `@arrakis/loa-finn-contract` from `tests/e2e/contracts/` to `packages/contracts/` (workspace root level)
- Update all imports across the codebase:
  - `tests/e2e/agent-gateway-e2e.test.ts`
  - `packages/adapters/agent/contract-version.ts`
  - Any other references
- Add `packages/contracts` to pnpm workspace configuration
- Ensure `npm pack` produces a publishable artifact
- Add README documenting the package as a protocol specification (not a test utility)

**Acceptance Criteria**:
- [ ] AC-2.1: Package lives at `packages/contracts/` (not `tests/e2e/contracts/`)
- [ ] AC-2.2: All existing imports still resolve
- [ ] AC-2.3: `pnpm build` succeeds with new package location
- [ ] AC-2.4: Package README describes it as protocol specification
- [ ] AC-2.5: `npm pack` in `packages/contracts/` produces valid tarball

#### Task 2.2: Compatibility Matrix + Version Negotiation

**New File**: `packages/contracts/src/compatibility.ts`
**Modified**: `packages/contracts/src/index.ts`

- Create `CompatibilityMatrix` class:
  ```typescript
  interface CompatibilityEntry {
    arrakis_version: string;    // Semver range
    loa_finn_version: string;   // Semver range
    contract_version: string;   // Exact version
    status: 'supported' | 'deprecated' | 'unsupported';
    notes?: string;
  }
  ```
- Load compatibility data from `compatibility.json`
- Export `getCompatibility(arrakisVersion, loaFinnVersion)` function
- Export `validateContractCompatibility(contractVersion, peerVersion)` function
- Add `compatibility.json` with initial entries for current versions

**Acceptance Criteria**:
- [ ] AC-2.6: `getCompatibility()` returns match for current version pair
- [ ] AC-2.7: `validateContractCompatibility()` returns `{ compatible: true }` for matching versions
- [ ] AC-2.8: `validateContractCompatibility()` returns `{ compatible: false, reason }` for mismatched versions
- [ ] AC-2.9: Unit tests for all compatibility scenarios
- [ ] AC-2.20: Negotiation wired into arrakis request path: `contract_version` included in JWT claims sent to loa-finn
- [ ] AC-2.21: `AgentGateway` calls `validateContractCompatibility()` on loa-finn response version; incompatible → fail-fast with `CONTRACT_VERSION_MISMATCH` error code
- [ ] AC-2.22: E2E test: arrakis sends `contract_version` claim → loa-finn stub echoes its version → arrakis validates compatibility
- [ ] AC-2.23: E2E test: version mismatch scenario → arrakis returns explicit error (not silent fallthrough)

#### Task 2.3: POOL_PROVIDER_HINT as Configurable Routing Policy

**Modified**: `packages/adapters/agent/pool-mapping.ts`, `packages/adapters/agent/config.ts`

- Replace hardcoded `POOL_PROVIDER_HINT` constant with configurable policy:
  ```typescript
  // Load from POOL_PROVIDER_HINTS env var (JSON) or use defaults
  // Format: {"cheap":"openai","fast-code":"openai","reviewer":"openai","reasoning":"anthropic","architect":"anthropic"}
  ```
- Add `POOL_PROVIDER_HINTS` to `config.ts` environment loading
- Validate loaded hints against known pool IDs at startup (warn on unknown pools, fail on invalid providers)
- Preserve current defaults as fallback when env var not set
- Document configuration in CLAUDE.md Chain Provider Architecture section

**Acceptance Criteria**:
- [ ] AC-2.10: `POOL_PROVIDER_HINTS` env var overrides default mapping
- [ ] AC-2.11: Missing env var falls back to current hardcoded defaults
- [ ] AC-2.12: Invalid JSON in env var → startup warning + defaults used
- [ ] AC-2.13: Unknown pool ID in hints → startup warning (non-fatal)
- [ ] AC-2.14: Invalid provider value → startup error (fatal — security boundary)
- [ ] AC-2.15: Unit tests for all configuration scenarios

#### Task 2.4: Federation Seed — `delegated_by` JWT Claim

**Modified**: `tests/e2e/contracts/schema/loa-finn-contract.json`, `packages/adapters/agent/jwt-service.ts`

- Add optional `delegated_by` field to JWT claims schema:
  ```json
  "delegated_by": {
    "type": ["string", "null"],
    "description": "Community ID that delegated pool access (federation, future use)"
  }
  ```
- Add `delegated_by` to JWT signing (null for now — placeholder for cross-community delegation)
- Document the field's purpose in contract README: "Reserved for future community federation"

**Acceptance Criteria**:
- [ ] AC-2.16: `delegated_by` field present in JWT schema (optional, nullable)
- [ ] AC-2.17: JWT signing includes `delegated_by: null` by default
- [ ] AC-2.18: E2E tests pass with new claim present
- [ ] AC-2.19: No behavioral change — purely additive schema extension

---

## Sprint 3: Gateway Lifecycle + Security Hardening (G-4, G-5, G-6)

**Global ID**: 211
**Goal**: Externalize the gateway state machine, fix the API key heap persistence, and share circuit breaker state across the fleet.

**Why Third**: These are structural improvements that don't depend on Sprint 2's contract changes. Can be developed in parallel with Sprint 2.

### Tasks

#### Task 3.1: Extract `RequestLifecycle` Protocol Object

**New File**: `packages/adapters/agent/request-lifecycle.ts`
**Modified**: `packages/adapters/agent/agent-gateway.ts`

- Extract the implicit RECEIVED→RESERVED→EXECUTING→FINALIZED state machine into `RequestLifecycle`:
  ```typescript
  type LifecycleState = 'RECEIVED' | 'VALIDATED' | 'RESERVED' | 'EXECUTING' | 'FINALIZED' | 'FAILED';

  class RequestLifecycle {
    private state: LifecycleState = 'RECEIVED';

    // State transition methods with invariant enforcement
    validate(request, context): ValidatedRequest;
    reserve(budget, ensemble, byok): ReservedRequest;
    execute(client, request): Promise<ExecutingRequest>;
    finalize(usage, budget): FinalizedRequest;
    fail(error, budget): FailedRequest;

    // Introspection
    getState(): LifecycleState;
    getDuration(): number;
    getTrace(): LifecycleEvent[];
  }
  ```
- Refactor `AgentGateway.invoke()` and `stream()` to use `RequestLifecycle`
- Each state transition emits a structured log event (for distributed tracing)
- Invalid state transitions throw `LifecycleError` (e.g., can't FINALIZE from RECEIVED)
- The lifecycle trace array provides the complete decision trail for debugging

**Acceptance Criteria**:
- [ ] AC-3.1: `RequestLifecycle` enforces valid state transitions only
- [ ] AC-3.2: Invalid transitions (e.g., RECEIVED → FINALIZED) throw `LifecycleError`
- [ ] AC-3.3: `invoke()` and `stream()` refactored to use `RequestLifecycle`
- [ ] AC-3.4: Each state transition emits structured log with traceId
- [ ] AC-3.5: `getTrace()` returns complete lifecycle event history
- [ ] AC-3.6: All existing tests pass without modification (behavioral equivalence)
- [ ] AC-3.7: Unit tests for all valid and invalid state transitions
- [ ] AC-3.25: EMF metric emitted: `LifecycleFinalState` with dimension `{final_state}` (count, unit: None)

#### Task 3.2: API Key Isolation Boundary for Auth Headers (V8 Heap Fix)

**Modified**: `packages/adapters/agent/byok-proxy-handler.ts`

- Minimize API key string exposure window in auth header construction:
  - Current: `apiKey.toString('utf8')` → string persists in V8 heap after `apiKey.fill(0)`
  - New: Isolate string materialization to the smallest possible scope:
    1. Keep key encrypted in memory (Buffer) until the last possible moment
    2. Materialize string only inside an isolated helper that constructs the HTTP request
    3. Use `undici.request()` (low-level, avoids global fetch header caching) for the proxy call
    4. Null all local references immediately after request dispatch
    5. `apiKey.fill(0)` in `finally` block clears the Buffer copy
  - Investigate: if `undici` dispatchers support Buffer header values natively, prefer that path (zero string copies)
  - If full Buffer-through is infeasible with the chosen HTTP client, document the limitation and implement the isolation boundary approach
- Add `@security` JSDoc annotation documenting the rationale and chosen approach
- Add heap snapshot regression test: after request completion, V8 heap snapshot searched for key substring (must not appear outside of `undici` internals)

**Acceptance Criteria**:
- [ ] AC-3.8: No application-level `toString()` on key Buffer outside the isolated dispatch boundary
- [ ] AC-3.9: Key materialized as string only at HTTP dispatch point (not in `AgentGateway` or `BYOKProxyHandler` class scope)
- [ ] AC-3.10: `apiKey.fill(0)` in `finally` block clears the Buffer; all string references nulled
- [ ] AC-3.11: Existing BYOK proxy tests pass
- [ ] AC-3.12: Heap snapshot regression test: key substring not found in V8 heap after request finalization (tolerance: undici internal buffers exempt)
- [ ] AC-3.24: HTTP client choice documented with security rationale (undici preferred over global fetch)

#### Task 3.3: Fleet-Wide Redis Circuit Breaker

**New File**: `packages/adapters/agent/redis-circuit-breaker.ts`
**Modified**: `packages/adapters/agent/byok-manager.ts`

- Implement `RedisCircuitBreaker` that shares state across ECS containers:
  ```typescript
  class RedisCircuitBreaker {
    // State stored in Redis key: `circuit:{component}`
    // Uses atomic Lua script for state transitions
    constructor(redis, component, config);

    async isAllowed(): Promise<boolean>;  // Check + transition half-open
    async onSuccess(): Promise<void>;     // Transition to closed
    async onFailure(): Promise<void>;     // Record failure, potentially open

    async getState(): Promise<CircuitState>;
  }
  ```
- Atomic state transitions via Redis Lua scripts (no TOCTOU between check and transition)
- Fallback to process-local circuit breaker if Redis unavailable (graceful degradation)
- Replace `CircuitBreaker` in `BYOKManager` with `RedisCircuitBreaker`
- Add `circuit_breaker_state_change` structured log event

**Acceptance Criteria**:
- [ ] AC-3.13: Circuit breaker state visible across multiple container instances (Redis key)
- [ ] AC-3.14: State transitions are atomic (Lua script, no race conditions)
- [ ] AC-3.15: Redis unavailable → falls back to process-local breaker
- [ ] AC-3.16: State change emits structured log event
- [ ] AC-3.17: Unit tests with mock Redis for all state transitions
- [ ] AC-3.18: Integration test: two `RedisCircuitBreaker` instances (distinct `instance_id`) sharing a single testcontainer Redis — assert shared state transitions (open/half-open/closed propagation)
- [ ] AC-3.26: EMF metric emitted: `CircuitBreakerState` with dimensions `{component, state}` (gauge, unit: None)

#### Task 3.4: `estimateInputTokens()` Calibration Harness

**New File**: `packages/adapters/agent/token-estimator.ts`
**Modified**: `packages/adapters/agent/agent-gateway.ts`

- Extract `estimateInputTokens()` from `AgentGateway` into `TokenEstimator` class:
  ```typescript
  class TokenEstimator {
    // Current: ~4 chars per token (rough estimate)
    // New: configurable chars-per-token with model-specific overrides
    estimate(messages, options?: { modelAlias?: string }): number;

    // Calibration: compare estimates vs actuals
    recordActual(estimated: number, actual: number, modelAlias: string): void;
    getCalibrationStats(): { meanError: number, p95Error: number, sampleCount: number };
  }
  ```
- Default 4 chars/token with per-model overrides (e.g., Claude models tend to ~3.5)
- `recordActual()` stores estimate/actual pairs in-memory circular buffer (last 1000)
- Emit `token_estimate_drift` metric when error > 50%
- Log calibration stats every 100 requests

**Acceptance Criteria**:
- [ ] AC-3.19: `TokenEstimator` extracted with configurable chars-per-token
- [ ] AC-3.20: Model-specific overrides via configuration
- [ ] AC-3.21: Calibration stats computed from estimate/actual pairs
- [ ] AC-3.22: EMF metric emitted: `TokenEstimateDrift` with dimensions `{model_alias}` when estimate error > 50% (unit: Percent)
- [ ] AC-3.23: Unit tests for estimation and calibration

---

## Sprint 4: Ensemble Budget Optimization + Observability (G-7)

**Global ID**: 212
**Goal**: Optimize ensemble fallback budget reservation and update observability for all new capabilities.

**Why Last**: Depends on per-model accounting (Sprint 1) and lifecycle tracing (Sprint 3). Dashboard updates require all metrics to be flowing.

### Tasks

#### Task 4.1: Incremental Reservation Release for Fallback Strategy

**Modified**: `packages/adapters/agent/ensemble-mapper.ts`, `packages/adapters/agent/agent-gateway.ts`

- Change fallback strategy budget behavior:
  - Current: Reserve N× upfront, hold until finalization
  - New: Reserve 1× initially. On each failed attempt, reserve 1× more (incremental)
  - Total reservation never exceeds N× (invariant preserved)
  - On success at attempt K: release remaining (N-K) capacity
- **BYOK/platform composition rule** (interacts with Sprint 1 Task 1.3):
  - Reservation unit = cost estimate for **platform-only** models in the current attempt
  - BYOK attempts do NOT increment the reservation counter (they cost 0 for platform budget)
  - `attemptNumber` for reservation purposes counts only platform attempts, not total attempts
  - Example: fallback [BYOK-A, platform-B, platform-C] → reserve 1× on attempt to B, reserve 1× more on attempt to C. BYOK-A attempt is free-pass (no reservation change)
- Add `EnsembleMapper.computeIncrementalReservation()`:
  ```typescript
  computeIncrementalReservation(
    strategy: EnsembleStrategy,
    attemptNumber: number,  // 1-indexed, platform attempts only
    platformModelCount: number,  // count of non-BYOK models in ensemble
    baseCost: number,
    accountingMode: 'PLATFORM_BUDGET' | 'BYOK_NO_BUDGET',
  ): { reserveAdditional: number; releaseCapacity: number; }
  ```
- Update `AgentGateway` to call incremental reservation for fallback strategy only
- `best_of_n` and `consensus` remain N× upfront (parallel execution requires it)

**Acceptance Criteria**:
- [ ] AC-4.1: Fallback strategy starts with 1× reservation (platform models only)
- [ ] AC-4.2: Each failed platform attempt adds 1× additional reservation
- [ ] AC-4.3: Successful attempt releases all remaining capacity
- [ ] AC-4.4: Total reservation never exceeds platformModelCount× (invariant)
- [ ] AC-4.5: `best_of_n` and `consensus` unchanged (still N× upfront)
- [ ] AC-4.6: Unit tests for fallback with success at attempt 1, 2, N
- [ ] AC-4.7: Unit test: fallback exhausts all N attempts → total reserved = platformModelCount×
- [ ] AC-4.22: Unit test: mixed BYOK/platform fallback [BYOK, platform, platform] — BYOK attempt skips reservation, platform attempts reserve incrementally
- [ ] AC-4.23: Unit test: all-BYOK fallback → zero platform reservation (edge case)
- [ ] AC-4.24: Budget invariant `committed ≤ reserved` proven for all mixed fallback scenarios (at least 3 test vectors)

#### Task 4.2: Capability Audit Log

**New File**: `packages/adapters/agent/capability-audit.ts`
**Modified**: `packages/adapters/agent/agent-gateway.ts`

- Emit structured audit events for every capability exercise:
  ```typescript
  interface CapabilityAuditEvent {
    event_type: 'pool_access' | 'byok_usage' | 'ensemble_invocation' | 'model_access';
    timestamp: string;
    trace_id: string;
    community_id: string;
    user_id: string;
    pool_id: string;
    access_level: string;
    // Capability-specific fields
    ensemble_strategy?: string;
    ensemble_n?: number;
    byok_provider?: string;
    model_breakdown?: ModelInvocationResult[];
    budget_reserved_micro?: number;
    budget_committed_micro?: number;
  }
  ```
- Emit via structured log (CloudWatch Log Metric Filters can aggregate)
- Include lifecycle trace from `RequestLifecycle.getTrace()`
- Respect data retention policy: no PII, no message content

**Acceptance Criteria**:
- [ ] AC-4.8: Every request emits at least one `capability_audit` event
- [ ] AC-4.9: Ensemble requests emit `ensemble_invocation` with `model_breakdown`
- [ ] AC-4.10: BYOK requests emit `byok_usage` with provider
- [ ] AC-4.11: Events include lifecycle trace for debugging
- [ ] AC-4.12: No PII or message content in audit events

#### Task 4.3: Dashboard + Alarm Updates for Per-Model Metrics

**Modified**: `infrastructure/terraform/agent-monitoring.tf`

- Add new CloudWatch dashboard widgets:
  - **Per-Model Cost Distribution**: Stacked bar chart showing cost by model ID
  - **BYOK vs Platform Accounting**: Pie chart of `accounting_mode` distribution
  - **Ensemble Savings**: Time series of `savings_micro` (reservation vs committed delta)
  - **Token Estimate Accuracy**: Line chart of mean estimate error over time
  - **Lifecycle State Distribution**: Bar chart of requests by final lifecycle state
  - **Fleet Circuit Breaker**: Gauge showing shared CB state across containers
- Add new alarms:
  - **Token Estimate Drift**: Alert when mean estimate error > 100% for 15 min
  - **Ensemble Budget Overrun**: Alert when any ensemble `savings_micro` < 0

**Acceptance Criteria**:
- [ ] AC-4.13: 6 new dashboard widgets added, each referencing an EMF metric emitted in Sprints 1/3: `PerModelCost`, `EnsembleSavings`, `TokenEstimateDrift`, `LifecycleFinalState`, `CircuitBreakerState`, and `accounting_mode` dimension on `PerModelCost`
- [ ] AC-4.14: 2 new alarms configured with SNS: `TokenEstimateDrift` (mean > 100% for 15 min), `EnsembleSavings` (< 0 for any request)
- [ ] AC-4.15: `terraform plan` validates cleanly
- [ ] AC-4.16: Dashboard total ≥ 17 widgets (11 existing + 6 new)
- [ ] AC-4.21: Smoke test: EMF log lines for each metric name validated against Terraform widget metric references (no orphan widgets)

#### Task 4.4: Full E2E Regression + Documentation

**Modified**: `tests/e2e/agent-gateway-e2e.test.ts`, `CLAUDE.md`

- Run full E2E suite — verify all existing + new scenarios pass
- Update CLAUDE.md Chain Provider Architecture section:
  - Add per-model accounting documentation
  - Add provider policy configuration documentation
  - Add capability audit event format
  - Update key files table with new files
- Verify beads task closure for all sprint tasks

**Acceptance Criteria**:
- [ ] AC-4.17: All E2E tests pass (≥ 17 scenarios)
- [ ] AC-4.18: CLAUDE.md updated with new architecture
- [ ] AC-4.19: No lint/type errors across codebase
- [ ] AC-4.20: All beads tasks closed

---

## Dependency Graph

```
Sprint 1 (Per-Model Accounting)
  ├─→ Sprint 2 (Contract Protocol + Policy) ────────┐
  └─→ Sprint 3 (Lifecycle + Security) ──────────────┤
                                                      ▼
                                               Sprint 4 (Budget Optimization + Observability)
```

Sprints 2 and 3 are **independent** and can be developed in either order.
Sprint 4 **depends** on Sprints 1–3 (needs per-model metrics, lifecycle traces, and fleet CB before dashboard updates).

---

## Rollback Criteria & Procedures

### Sprint 1: Per-Model Accounting

**Rollback trigger**: Usage report schema change breaks loa-finn consumption
**Rollback steps**:
1. Revert contract schema to `1.0.0` (remove `model_breakdown`)
2. Revert `ensemble-accounting.ts` and gateway changes
3. Run E2E suite to verify original 13 scenarios pass
**Data safety**: Schema extension is additive — `model_breakdown` is optional. loa-finn should ignore unknown fields.

### Sprint 2: Contract Package Move

**Rollback trigger**: Import paths break across workspace
**Rollback steps**:
1. Restore `tests/e2e/contracts/` as import source
2. Revert workspace configuration
3. `pnpm install` to re-resolve
**Data safety**: No runtime data affected — purely build-time change.

### Sprint 3: Buffer Auth Headers

**Rollback trigger**: Provider API rejects Buffer-based headers
**Rollback steps**:
1. Revert to string-based header construction (known working)
2. Document that the V8 heap risk is accepted for now
**Data safety**: No data loss — purely auth mechanism change.

### Sprint 4: Incremental Reservation

**Rollback trigger**: Budget accounting inconsistency in fallback strategy
**Rollback steps**:
1. Revert to N× upfront reservation for fallback
2. Verify budget invariant (committed ≤ reserved) holds
**Data safety**: Budget reservations auto-expire via TTL — no manual cleanup needed.

---

## Risk Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Per-model accounting breaks existing E2E tests | Low | High | `model_breakdown` is optional in schema — backward compatible |
| Buffer auth headers rejected by fetch API | Medium | Medium | Fallback to `node:http` module which natively supports Buffer headers |
| Redis circuit breaker adds latency to BYOK path | Low | Medium | Lua script executes in <1ms; fallback to process-local if slow |
| Contract package move breaks CI | Medium | Low | Update all imports in single commit; workspace resolution handles it |
| Incremental reservation creates race condition | Medium | High | All reservation operations are atomic Redis INCRBY — no race window |

---

## Sprint Metrics Targets

| Sprint | Tasks | New Files | Modified Files | New Tests |
|--------|-------|-----------|----------------|-----------|
| Sprint 1 | 5 | 1 | 6 | 10+ |
| Sprint 2 | 4 | 1 | 6 | 8+ |
| Sprint 3 | 4 | 2 | 4 | 12+ |
| Sprint 4 | 4 | 1 | 4 | 6+ |
| **Total** | **17** | **5** | **20** | **36+** |

### EMF Metric ↔ Dashboard Widget Map

| Metric Name | Emitted In | Unit | Dimensions | Dashboard Widget |
|-------------|-----------|------|------------|------------------|
| `PerModelCost` | Sprint 1 (Task 1.3) | micro-USD | `model_id`, `provider`, `accounting_mode` | Per-Model Cost Distribution, BYOK vs Platform |
| `EnsembleSavings` | Sprint 1 (Task 1.3) | micro-USD | `strategy` | Ensemble Savings |
| `LifecycleFinalState` | Sprint 3 (Task 3.1) | Count | `final_state` | Lifecycle State Distribution |
| `TokenEstimateDrift` | Sprint 3 (Task 3.4) | Percent | `model_alias` | Token Estimate Accuracy |
| `CircuitBreakerState` | Sprint 3 (Task 3.3) | None (gauge) | `component`, `state` | Fleet Circuit Breaker |

---

## FAANG Precedent Map

| Sprint | Pattern | Precedent |
|--------|---------|-----------|
| Sprint 1 | Per-model cost attribution | AWS Cost Explorer: per-service, per-tag cost breakdown that enabled the entire FinOps discipline |
| Sprint 2 | Protocol extraction from test infra | Protocol Buffers: Google's `.proto` files evolved from internal docs to the internet's serialization standard |
| Sprint 3 | Fleet-wide circuit breaker | Netflix Hystrix → resilience4j: process-local CB was insufficient at scale, leading to shared state patterns |
| Sprint 4 | Incremental resource reservation | AWS EC2 Spot: capacity released incrementally as winning bids are determined, not held until auction closes |

---

**Document Owner**: Hounfour Integration Team
**Review Cadence**: Per sprint completion
**Bridgebuilder Review**: Requested after Sprint 4 (Round 7)

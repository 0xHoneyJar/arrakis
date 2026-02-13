# SDD: The Spice Must Flow — Production Readiness & Protocol Unification

**Version:** 1.0.0
**Cycle:** 023
**Date:** 2026-02-13
**Status:** Draft
**PRD:** grimoires/loa/prd.md v1.1.0
**References:** [Issue #54](https://github.com/0xHoneyJar/arrakis/issues/54) · [RFC #31](https://github.com/0xHoneyJar/loa-finn/issues/31)

---

## 1. Executive Summary

This SDD designs four workstreams to bring Arrakis to production readiness:

1. **Protocol Unification** — Replace `@arrakis/loa-finn-contract` with `@0xhoneyjar/loa-hounfour`, reconciling tier representation and pool mapping divergences at the adapter boundary.
2. **Gateway Resurrection** — Fix all compilation errors in the Rust Discord gateway by aligning twilight, metrics, and async-nats APIs.
3. **CI/CD Hardening** — Add agent subsystem and gateway CI workflows with proper caching and service containers.
4. **Housekeeping** — Remove dead code (`sites/web/`, duplicate contract packages).

The design preserves Arrakis's hexagonal architecture: the core ports layer (`packages/core/ports/`) remains unchanged, and all loa-hounfour adoption occurs at the adapter boundary.

---

## 2. System Architecture

### 2.1 Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Discord / Telegram                                     │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────┐    ┌─────────────────────────────┐
│  Rust Gateway       │    │  apps/worker/               │
│  (apps/gateway/)    │───▶│  (background jobs)          │
│  twilight + NATS    │    └─────────────────────────────┘
└──────────┬──────────┘
           │ NATS JetStream
┌──────────▼──────────┐
│  Sietch API         │
│  (themes/sietch/)   │
│  Express + Redis    │
└──────────┬──────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│  Agent Adapter Layer (packages/adapters/agent/)         │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌────────┐ │
│  │ Gateway  │ │ Budget    │ │ Pool       │ │ LoaFinn│ │
│  │ Facade   │ │ Manager   │ │ Mapping    │ │ Client │ │
│  └──────────┘ └───────────┘ └────────────┘ └────────┘ │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌────────┐ │
│  │ Rate     │ │ Idempot-  │ │ Contract   │ │ Req    │ │
│  │ Limiter  │ │ ency      │ │ Version    │ │ Hash   │ │
│  └──────────┘ └───────────┘ └────────────┘ └────────┘ │
└──────────┬──────────────────────────────────────────────┘
           │ HTTPS (circuit-broken, retried)
┌──────────▼──────────┐
│  loa-finn           │
│  (external service) │
└─────────────────────┘
```

### 2.2 Dependency Graph (Pre-Migration)

```
packages/core/ports/agent-gateway.ts
  ├── defines: IAgentGateway, AgentInvokeRequest, AgentStreamEvent,
  │            AccessLevel, ModelAlias, UsageInfo, BudgetStatus
  └── no external dependencies (pure types)

packages/contracts/ (@arrakis/loa-finn-contract)
  ├── schema/loa-finn-contract.json (JSON Schema fixtures)
  ├── vectors/loa-finn-test-vectors.json (E2E vectors)
  └── src/index.ts (CONTRACT_VERSION, getVector, validateContractCompatibility)

packages/adapters/agent/
  ├── imports from: @arrakis/core/ports (types)
  ├── imports from: @arrakis/loa-finn-contract (version only, via contract-version.ts)
  └── 38 files implementing IAgentGateway port
```

### 2.3 Post-Migration Target

```
@0xhoneyjar/loa-hounfour (external, pinned #v1.1.0)
  ├── schemas: JwtClaimsSchema, TierSchema, PoolIdSchema, ...
  ├── integrity: computeReqHash, verifyReqHash, deriveIdempotencyKey
  ├── vocabulary: POOL_IDS, TIER_POOL_ACCESS, TIER_DEFAULT_POOL
  ├── versioning: CONTRACT_VERSION, validateCompatibility
  └── 90 golden test vectors

packages/core/ports/agent-gateway.ts  (UNCHANGED — keeps local type definitions)

packages/adapters/agent/
  ├── imports from: @arrakis/core/ports (types — unchanged)
  ├── imports from: @0xhoneyjar/loa-hounfour (schemas, integrity, vocabulary)
  ├── NEW: tier-mapping.ts (canonicalizeTier boundary function)
  └── REMOVED: contract-version.ts, req-hash.ts, idempotency.ts (replaced by hounfour)

packages/contracts/        → DELETED
tests/e2e/contracts/       → DELETED
```

---

## 3. Component Design

### 3.1 Protocol Unification — Tier Canonicalization Layer

**Problem:** Arrakis has two tier representations that must be reconciled:
- `AgentRequestContext.tier` (integer 1-9) — from Discord role resolution
- `AgentRequestContext.accessLevel` (string `'free'|'pro'|'enterprise'`) — already canonical, used in JWT claims and pool routing

The existing code already maps integer → string in `tier-access-mapper.ts` during Discord role resolution, before the JWT is minted. The JWT `accessLevel` claim is already a canonical string. loa-hounfour's `Tier` type matches `AccessLevel` exactly.

**Design:** The canonicalization boundary is at **Discord role resolution** (where NFT/role data produces `accessLevel`), NOT at JWT middleware ingress. The JWT already carries the canonical string. No integer-to-string mapping occurs in the agent request path.

#### 3.1.1 Tier Contract Clarification

**Tier source-of-truth:** The JWT `accessLevel` claim IS the canonical Tier. It is set during Discord role resolution and never changes downstream.

```
Discord Role Resolution (packages/adapters/discord/)
  │
  ├── NFT ownership check → integer tier (1-9)
  ├── tier-access-mapper.ts: mapTierToAccessLevel(tier) → AccessLevel string
  └── Mints JWT with accessLevel: 'free' | 'pro' | 'enterprise'
      │
      ▼
Agent Auth Middleware (packages/adapters/agent/agent-auth-middleware.ts)
  │
  ├── Validates JWT signature (jose)
  ├── Validates claims against JwtClaimsSchema (loa-hounfour)
  ├── Reads accessLevel directly from claims (already canonical string)
  └── Builds AgentRequestContext with accessLevel as Tier
      │
      ▼
  ├──▶ pool-mapping.ts (resolvePoolId using Tier)
  ├──▶ computeReqHash() (loa-hounfour, using Tier)
  └──▶ deriveIdempotencyKey() (loa-hounfour, using Tier)
```

**What changes:** The `AccessLevel` type in `core/ports/agent-gateway.ts` is already `'free' | 'pro' | 'enterprise'`, which matches loa-hounfour's `Tier` exactly. No new `canonicalizeTier()` function is needed in the agent request path. The existing `tier-access-mapper.ts` in the Discord adapter continues to handle integer → string mapping.

**Negative test:** Add a test that a JWT with `accessLevel: 'enterprise'` is accepted without any integer mapping, and a JWT with `accessLevel: 7` (integer) is rejected by `JwtClaimsSchema` validation.

**New file `packages/adapters/agent/tier-mapping.ts`** is NOT needed — the mapping already exists in `tier-access-mapper.ts` in the Discord adapter layer. What IS needed is updating `tier-access-mapper.ts` to import the `Tier` type from loa-hounfour and validate against it.

#### 3.1.2 Import Migration Map

Each local module is replaced by a loa-hounfour import. The mapping preserves the existing call sites — only the import path changes.

| Local File | Export | Replaced By | Notes |
|-----------|--------|-------------|-------|
| `contract-version.ts` | `CONTRACT_VERSION` | `import { CONTRACT_VERSION } from '@0xhoneyjar/loa-hounfour'` | Dynamic `require()` removed |
| `contract-version.ts` | `validateContractCompatibility` | `import { validateCompatibility } from '@0xhoneyjar/loa-hounfour'` | Function renamed |
| `req-hash.ts` | `computeReqHash` | `import { computeReqHash } from '@0xhoneyjar/loa-hounfour'` | Must verify byte-identical output |
| `idempotency.ts` | `deriveIdempotencyKey` | `import { deriveIdempotencyKey } from '@0xhoneyjar/loa-hounfour'` | See §3.1.2.1 for split details |
| `pool-mapping.ts` | `POOL_IDS` | `import { POOL_IDS } from '@0xhoneyjar/loa-hounfour'` | Local `POOL_IDS` deleted |
| `pool-mapping.ts` | `ACCESS_LEVEL_POOLS` | `import { TIER_POOL_ACCESS } from '@0xhoneyjar/loa-hounfour'` | Renamed constant |
| `pool-mapping.ts` | enterprise default `'architect'` | `import { TIER_DEFAULT_POOL } from '@0xhoneyjar/loa-hounfour'` | Changes to `'reviewer'` |

##### 3.1.2.1 Idempotency Module Split

`idempotency.ts` currently contains two concerns that are split during migration:

| Concern | Current Location | Post-Migration Location |
|---------|-----------------|------------------------|
| Key derivation (`deriveIdempotencyKey`) | `idempotency.ts:112` | `@0xhoneyjar/loa-hounfour` — all call sites updated to use hounfour import |
| State machine (`IdempotencyKeyState`, `isValidTransition`, `isTerminal`, `IDEMPOTENCY_TRANSITIONS`) | `idempotency.ts:57-137` | Stays in local `idempotency.ts` — Redis state management is Arrakis-specific |

After migration, `idempotency.ts` is renamed to `idempotency-state.ts` to make the scope explicit. The local `deriveIdempotencyKey` function is deleted — every call site uses the hounfour import. An integration test verifies that the hounfour-derived key is accepted by the local state machine (i.e., keys from the new derivation function are valid Redis keys for the existing state transitions).

**Files that keep local code** (not replaced by hounfour):

| File | Reason |
|------|--------|
| `agent-gateway.ts` | Orchestration logic, not protocol contract |
| `loa-finn-client.ts` | HTTP client, circuit breaker, SSE parsing — Arrakis-specific |
| `budget-manager.ts` | Redis Lua scripts, pricing table — Arrakis-specific |
| `idempotency.ts` (state machine only) | `IdempotencyKeyState` transitions are local to Arrakis's Redis state management. Only `deriveIdempotencyKey` moves to hounfour. |
| `pool-mapping.ts` (routing logic) | `resolvePoolId()`, `validatePoolClaims()`, provider hints — Arrakis-specific routing. Constants move to hounfour, logic stays. |

#### 3.1.3 Migration Phases

**Phase 1 — Transformation validation (non-breaking):**
1. Install `@0xhoneyjar/loa-hounfour#v1.1.0` in `packages/adapters/`
2. Add new test file: `tests/unit/protocol-conformance.test.ts`
   - Test: validated JWT claims with string `accessLevel` produce req-hashes matching loa-hounfour golden vectors
   - Test: a JWT with non-string `accessLevel` (e.g., integer `7`) is rejected by `JwtClaimsSchema` validation
   - Test: cross-tenant isolation (different `sub` claims → different hashes and idempotency keys)
3. Separately in the Discord adapter layer: verify `tier-access-mapper.ts` correctly maps integer role tiers to canonical string `AccessLevel` values. Integer tiers must NEVER reach `computeReqHash()` or `deriveIdempotencyKey()` inputs.
4. Run loa-hounfour's 90 golden test vectors via `vitest`
5. Gate: all vectors pass before proceeding to Phase 2

**Phase 2 — Replace imports (breaking, single PR):**
1. Swap imports per the migration map above (6 adapter files)
2. Update `pool-mapping.ts` to import constants from hounfour, keep routing logic local
3. Keep `core/ports/agent-gateway.ts` unchanged — `MODEL_ALIAS_VALUES` stays as a local port-level definition. The adapter layer validates/translates against `POOL_IDS` from loa-hounfour at the boundary. This preserves the hexagonal invariant: core/ports has zero external dependencies.
4. Run full test suite (unit + integration + E2E)

**Phase 3 — Remove local packages:**
1. Delete `packages/contracts/`
2. Delete `tests/e2e/contracts/`
3. Remove `"@arrakis/loa-finn-contract": "file:../contracts"` from `packages/adapters/package.json`
4. Remove `packages/contracts` from `pnpm-workspace.yaml`

### 3.2 Protocol Unification — Security Invariants

Per PRD §4.5, protocol unification must preserve tenant isolation.

#### 3.2.1 Tenant-Scoped Hashing

The `computeReqHash()` and `deriveIdempotencyKey()` inputs MUST include the tenant identifier (`sub` claim from JWT). Current implementation in `req-hash.ts` already includes `tenantId` in the hash input. After migration to loa-hounfour's `computeReqHash()`, verify the same field is included.

**Verification test** (`tests/integration/cross-tenant-isolation.test.ts`):

Both `computeReqHash` and `deriveIdempotencyKey` accept typed input objects defined by loa-hounfour. The tenant identifier is the `sub` field from JWT claims in both cases. Use the validated JWT claims object (or a typed projection satisfying loa-hounfour's input types) at every call site to prevent field name mismatches.

```typescript
import { computeReqHash, deriveIdempotencyKey } from '@0xhoneyjar/loa-hounfour';
import type { ReqHashInput, IdempotencyKeyInput } from '@0xhoneyjar/loa-hounfour';

// Same request body, different tenant → different hash
const claimsA: ReqHashInput = { ...basePayload, sub: 'tenant-a' };
const claimsB: ReqHashInput = { ...basePayload, sub: 'tenant-b' };
expect(computeReqHash(claimsA)).not.toBe(computeReqHash(claimsB));

// Same for idempotency keys — uses same `sub` field name
const ctxA: IdempotencyKeyInput = { ...baseCtx, sub: 'tenant-a' };
const ctxB: IdempotencyKeyInput = { ...baseCtx, sub: 'tenant-b' };
expect(deriveIdempotencyKey(ctxA)).not.toBe(deriveIdempotencyKey(ctxB));
```

The typed imports (`ReqHashInput`, `IdempotencyKeyInput`) provide compile-time guarantees that `sub` is included — a missing field is a type error, not a runtime bug.

#### 3.2.2 JWT Validation

After migration, `JwtClaimsSchema` is imported from loa-hounfour and validated on every inbound request in `agent-auth-middleware.ts`. The middleware rejects requests where:
- JWT signature is invalid (jose verification)
- Claims don't conform to `JwtClaimsSchema` (TypeBox validation)
- Contract version is incompatible (`validateCompatibility()`)

#### 3.2.3 mTLS Assumptions

| Environment | Transport Security | Enforcement Point |
|-------------|-------------------|-------------------|
| Production (ECS) | mTLS via AWS App Mesh / service mesh sidecar | Load balancer + sidecar proxy |
| Staging | TLS (not mutual) | ALB termination |
| Local (docker-compose) | Plain HTTP | N/A (trusted network) |
| CI | Plain HTTP | N/A (isolated containers) |

mTLS is enforced at the infrastructure layer (service mesh sidecar), not at the application layer. Arrakis and loa-finn do not implement mTLS themselves — they verify JWT claims for authentication and rely on the mesh for transport encryption. This is out of scope for this cycle (IaC is excluded per PRD §6).

---

### 3.3 Gateway Resurrection

#### 3.3.1 Architecture Overview

```
Discord WebSocket API
  │
  ▼
┌──────────────────────────────────────┐
│  ShardPool (25 shards per pod)       │
│  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ Shard 0 │ │ Shard 1 │ │ ...    │ │
│  │ (tokio) │ │ (tokio) │ │        │ │
│  └────┬────┘ └────┬────┘ └───┬────┘ │
│       │           │          │       │
│  ┌────▼───────────▼──────────▼────┐  │
│  │  Event Serialization           │  │
│  │  serialize.rs                  │  │
│  │  Discord Event → GatewayEvent  │  │
│  └────────────────┬───────────────┘  │
│                   │                  │
│  ┌────────────────▼───────────────┐  │
│  │  NATS JetStream Publisher      │  │
│  │  publisher.rs                  │  │
│  │  COMMANDS stream | EVENTS stream│  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Metrics + Health (Axum)       │  │
│  │  /health /ready /metrics       │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

#### 3.3.2 Compilation Error Checklist

All errors are enumerated from `cargo check` output. Each must be linked to a resolving commit.

**Category A: Module Visibility (2 errors)**

| # | File | Line | Error | Fix |
|---|------|------|-------|-----|
| A1 | `events/mod.rs` | 5 | `mod serialize` is private | Change to `pub mod serialize;` |
| A2 | (cascading from A1) | — | Cannot import `serialize::*` | Resolved by A1 |

**Category B: Twilight API 0.15 → 0.17 (12+ errors)**

| # | File | Line | Error | Fix |
|---|------|------|-------|-----|
| B1 | `shard/pool.rs` | 68 | `Config::builder()` does not exist | `Config::new(token, intents)` |
| B2 | `shard/pool.rs` | 70 | `ShardId::new(u64, u64)` type mismatch | Cast to `(u32, u32)` |
| B3 | `shard/pool.rs` | 104 | `shard.id().number()` returns u32, expected u64 | `.into()` cast |
| B4 | `shard/pool.rs` | 148 | Same as B3 | `.into()` cast |
| B5 | `shard/pool.rs` | 156 | `shard.next_event()` may not exist in 0.17 | Use `shard.next_message()` or equivalent 0.17 API |
| B6 | `shard/pool.rs` | 160 | u32/u64 mismatch in metrics call | Cast `shard_id as u64` |
| B7 | `shard/pool.rs` | 175 | u32/u64 mismatch in state call | Cast `shard_id as u64` |
| B8 | `shard/pool.rs` | 200 | u32/u64 mismatch | Cast |
| B9 | `shard/pool.rs` | 228-229 | u32/u64 mismatch (2 sites) | Cast |
| B10 | `events/serialize.rs` | 53 | `guild.id` is now `guild.id()` | Method call syntax |
| B11 | `events/serialize.rs` | 57-59 | `guild.name`, `member_count`, `owner_id` fields removed | Use `serde_json::to_value(&guild)` for full payload |
| B12 | `shard/pool.rs` | 162 | `ReceiveMessageError` API changed | Adapt error matching to 0.17 variants |

**Category C: Metrics 0.21 → 0.24 Macro Syntax (9 errors)**

| # | File | Line | Macro | Fix |
|---|------|------|-------|-----|
| C1 | `metrics/mod.rs` | 99 | `counter!` | Update to 0.24 label syntax |
| C2 | `metrics/mod.rs` | 109 | `counter!` | Same |
| C3 | `metrics/mod.rs` | 115 | `histogram!` | Same |
| C4 | `metrics/mod.rs` | 124 | `counter!` | Same |
| C5 | `metrics/mod.rs` | 133 | `counter!` | Same |
| C6 | `metrics/mod.rs` | 143 | `gauge!` | Same |
| C7 | `metrics/mod.rs` | 157 | `gauge!` | Same |
| C8 | `metrics/mod.rs` | 166 | `gauge!` | Same |
| C9 | `metrics/mod.rs` | 173 | `gauge!` | Same |

**Approach:** The exact breaking changes between metrics 0.21 → 0.24 and metrics-exporter-prometheus 0.12 → 0.18 must be determined empirically during implementation, not assumed. The implementation sprint will:

1. Pin exact versions in `Cargo.toml`: `metrics = "0.24"`, `metrics-exporter-prometheus = "0.18"`
2. Run `cargo check` and capture the exact compiler errors for all 9 sites
3. Consult the `metrics` CHANGELOG for the 0.22/0.23/0.24 migration guides
4. The breaking change is likely in **recorder installation** (`PrometheusBuilder` API in `metrics-exporter-prometheus`) and/or **label syntax** in macros. Both must be checked.
5. Fix recorder init first (if applicable), then fix macro call sites
6. Verify with `cargo check` after each fix

**Category D: async-nats 0.46 (2 errors)**

| # | File | Line | Error | Fix |
|---|------|------|-------|-----|
| D1 | `nats/publisher.rs` | 98 | `ack.stream` field does not exist | Await `PublishAckFuture`, access result fields |
| D2 | `nats/publisher.rs` | 99 | `ack.sequence` field does not exist | Same — `.await` the future first |

**Fix pattern:**
```rust
// Old: ack is PublishAckFuture, not PublishAck
let ack = js.publish(subject, payload).await?;
tracing::debug!(stream = %ack.stream, seq = ack.sequence);

// New: await the future to get PublishAck
let ack = js.publish(subject, payload).await?.await?;  // double await
tracing::debug!(stream = %ack.stream, seq = ack.sequence);
```

**Category E: Dockerfile (1 change, no compilation error)**

| # | File | Line | Change |
|---|------|------|--------|
| E1 | `Dockerfile` | 6 | `rust:1.75-alpine` → `rust:1.85-alpine` |

#### 3.3.3 Fix Order

Errors have dependencies. Fix in this order:

1. **A1** (module visibility) — unblocks all other imports
2. **B1-B2** (Config + ShardId constructors) — unblocks shard spawning
3. **B3-B9** (u32/u64 casts) — cascading from B2, mechanical fixes
4. **B5, B12** (next_event + error handling) — core event loop
5. **B10-B11** (GuildCreate field access) — event serialization
6. **C1-C9** (metrics macros) — independent, can be done in parallel
7. **D1-D2** (async-nats await) — independent
8. **E1** (Dockerfile) — last, after `cargo check` passes

After each category, run `cargo check` to verify error count decreases.

#### 3.3.4 Docker Build Parity

The Dockerfile must use `--locked` to match CI:

```dockerfile
FROM rust:1.85-alpine AS builder
# build-base includes gcc/g++/make; openssl-dev provides headers for OpenSSL crates.
# If gateway dependencies use rustls instead of openssl, openssl-dev can be removed.
RUN apk add --no-cache build-base musl-dev openssl-dev openssl-libs-static pkgconfig
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
RUN cargo build --release --locked

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
RUN adduser -D -u 1001 gateway
COPY --from=builder /app/target/release/arrakis-gateway /usr/local/bin/
USER gateway
EXPOSE 9090
CMD ["arrakis-gateway"]
```

**Note:** The CI gateway workflow runs `docker build` as its final step, ensuring Docker build parity is verified on every PR. If Alpine/musl linkage fails in Docker but passes in CI's ubuntu runner, the Docker build step will catch it.

---

### 3.4 CI/CD Hardening

#### 3.4.1 Agent Subsystem Workflow

**File:** `.github/workflows/agent-ci.yml`

```yaml
name: Agent Subsystem CI
on:
  pull_request:
    paths:
      - 'packages/**'
      - 'tests/unit/**'
      - 'tests/integration/**'
      - 'pnpm-lock.yaml'

jobs:
  agent-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    services:
      nats:
        image: nats:2
        ports:
          - 4222:4222
          - 8222:8222
        options: --health-cmd "wget -qO- http://localhost:8222/healthz || exit 1" --health-interval 5s --health-timeout 3s --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: --health-cmd "redis-cli ping" --health-interval 5s --health-timeout 3s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm -w install --frozen-lockfile
      - name: Verify services
        run: |
          redis-cli -h localhost -p 6379 ping
          timeout 10 bash -c 'until echo > /dev/tcp/localhost/4222; do sleep 0.5; done'
          # Verify JetStream is enabled via monitoring endpoint
          curl -sf http://localhost:8222/jsz | grep -q '"config"' || (echo "JetStream not enabled" && exit 1)
      - run: pnpm --filter @arrakis/adapters exec tsc --noEmit
      - run: pnpm --filter @arrakis/core exec tsc --noEmit
      - name: Unit tests
        run: vitest run tests/unit/ --reporter=verbose
      - name: Integration tests
        run: vitest run tests/integration/ --reporter=verbose
        env:
          REDIS_URL: redis://localhost:6379
          NATS_URL: nats://localhost:4222
```

**Key decisions:**
- Node 22 (matches loa-hounfour requirement)
- Redis service container with health check (required by integration tests for budget/rate limiting)
- NATS container started without JetStream by default; a pre-test step writes a config and restarts or the workflow uses a sidecar approach (see NATS JetStream note below)
- Pre-test connectivity verification probes `/jsz` monitoring endpoint to confirm JetStream (fail fast if not available)
- Port mapping via `ports:` field only (not `-p` in `options:` — GitHub Actions best practice)

**NATS JetStream note:** GitHub Actions `services:` do not support `command:` overrides or volume mounts. Two viable approaches for enforcing JetStream:

*Option A (Recommended) — Run NATS in a pre-test step instead of as a service:*
```yaml
steps:
  - name: Start NATS with JetStream
    run: |
      docker run -d --name nats -p 4222:4222 -p 8222:8222 nats:2 -js -m 8222
      timeout 10 bash -c 'until curl -sf http://localhost:8222/jsz; do sleep 0.5; done'
```

*Option B — Use a custom image with config baked in:*
Create `tests/ci/nats.conf` with `jetstream {}` and `http: 8222`, build a thin wrapper image.

The implementation sprint should use Option A for simplicity. The service definition in the YAML above serves as a reference; the actual NATS startup moves to a step.
- `pnpm -w install --frozen-lockfile` at workspace root (deterministic)
- 10-minute timeout (NFR-3)

#### 3.4.2 Gateway CI Workflow

**File:** `.github/workflows/gateway-ci.yml`

```yaml
name: Gateway CI
on:
  pull_request:
    paths:
      - 'apps/gateway/**'

jobs:
  gateway-build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy
      - uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            apps/gateway/target
          key: cargo-${{ hashFiles('apps/gateway/Cargo.lock') }}
      - name: Check
        working-directory: apps/gateway
        run: cargo check --locked
      - name: Clippy
        working-directory: apps/gateway
        run: cargo clippy --locked -- -D warnings
      - name: Test
        working-directory: apps/gateway
        run: cargo test --locked
      - name: Docker build
        run: docker build -f apps/gateway/Dockerfile apps/gateway/
```

**Key decisions:**
- `--locked` on all cargo commands (parity with Dockerfile)
- Cargo registry + target caching (speeds up subsequent runs)
- Docker build verification (catches Dockerfile-only issues)
- 10-minute timeout (NFR-3)
- Clippy with `-D warnings` (treat warnings as errors)

#### 3.4.3 E2E CI Workflow (Stretch — P2)

**File:** `.github/workflows/e2e-ci.yml`

Only triggered on push to `main` or manual dispatch (not on every PR — too expensive).

```yaml
name: E2E Tests
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20  # NFR-3 does NOT apply
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm -w install --frozen-lockfile
      - name: Run E2E suite
        run: ./tests/e2e/scripts/run-e2e.sh
        env:
          SKIP_E2E: 'false'
```

Note: This uses the existing `run-e2e.sh` which handles Docker Compose lifecycle, ephemeral key generation, and cleanup.

---

### 3.5 Housekeeping

#### 3.5.1 Remove `sites/web/`

```bash
# Remove tracked files
git rm -r sites/web/

# Add to .gitignore
echo 'sites/web/' >> .gitignore
```

Files being removed:
- `sites/web/next-env.d.ts` — Next.js type declaration (no source code)
- `sites/web/.env.local` — **Credentials risk** (NFR-4)
- `sites/web/.vercel/project.json` — Vercel project linking

#### 3.5.2 Deduplicate Contract Packages

After Phase 3 of import migration:

1. Delete `packages/contracts/` directory
2. Delete `tests/e2e/contracts/` directory
3. Remove from `packages/adapters/package.json`:
   ```json
   "@arrakis/loa-finn-contract": "file:../contracts"
   ```
4. Remove `packages/contracts` from `pnpm-workspace.yaml` (if listed)
5. Run `pnpm install` to update lockfile

#### 3.5.3 Node Engine Enforcement

**Root `package.json`:**
```json
{
  "engines": {
    "node": ">=22"
  }
}
```

**`.npmrc`:**
```ini
engine-strict=true
```

This ensures `pnpm install` fails if Node < 22, catching mismatches before runtime.

---

## 4. Data Architecture

No database schema changes in this cycle. The existing PostgreSQL schema (managed by Drizzle ORM in `themes/sietch/`) and Redis key structures (budget Lua scripts in `packages/adapters/agent/lua/`) are unchanged.

**Redis key impact from pool mapping change:**
- Enterprise default pool changes from `'architect'` to `'reviewer'` (TIER_DEFAULT_POOL)
- Budget keys are scoped by `communityId:month` — pool ID is not part of the key
- No Redis data migration needed

---

## 5. API Design

No API endpoint changes in this cycle. The agent gateway HTTP API (exposed via Sietch) maintains the same request/response contracts. The change is internal: which package provides the schema validators and hash functions.

**Wire format impact:** None. The JSON payloads between Arrakis and loa-finn are unchanged. The JWT already carries `accessLevel` as a canonical string (`'free'|'pro'|'enterprise'`) — this is the same representation as loa-hounfour's `Tier` type. The integer `tier` field exists only in the Discord role resolution layer and never appears in JWT claims or loa-finn payloads. No wire format migration is needed.

---

## 6. Security Architecture

### 6.1 JWT Claim Validation Chain

```
Inbound Request (JWT with accessLevel: 'free'|'pro'|'enterprise')
  │
  ▼
agent-auth-middleware.ts
  ├── 1. Verify JWT signature (jose library, JWKS rotation)
  ├── 2. Validate claims against JwtClaimsSchema (loa-hounfour TypeBox)
  │      → Rejects non-string accessLevel (e.g., integer 7 fails validation)
  ├── 3. Extract tenant ID (sub claim)
  ├── 4. Read accessLevel directly from validated claims (already canonical Tier)
  └── 5. Build AgentRequestContext with accessLevel as Tier
  │
  ▼
agent-gateway.ts
  ├── 6. computeReqHash(claims) — typed input includes sub, different tenants → different hashes
  ├── 7. deriveIdempotencyKey(claims) — typed input includes sub, prevents cross-tenant replay
  └── 8. validateCompatibility() checks CONTRACT_VERSION header
```

### 6.2 Threat Mitigations

| Threat | Mitigation | Verification |
|--------|-----------|-------------|
| Cross-tenant replay | `sub` included in req-hash and idempotency key inputs | Integration test (§3.2.1) |
| Schema bypass | JwtClaimsSchema validated on every request, imported from loa-hounfour | Middleware unit test |
| Hash mismatch | Golden test vectors run in CI (Phase 1 gate) | 90 vectors in test suite |
| Contract version drift | `validateCompatibility()` checks on every loa-finn response | loa-finn-client.ts:457 |

---

## 7. Integration Points

| Integration | Protocol | Auth | Changes This Cycle |
|------------|----------|------|-------------------|
| Arrakis → loa-finn | HTTPS + SSE | JWT (ES256) | Schema validation source changes to loa-hounfour |
| Gateway → NATS | NATS protocol | Token auth | Fix compilation errors (async-nats 0.46) |
| Gateway → Discord | WebSocket | Bot token | Fix compilation errors (twilight 0.17) |
| Sietch → Redis | Redis protocol | Password | No changes |
| Sietch → PostgreSQL | TCP | Password | No changes |
| CI → GitHub | HTTPS | GITHUB_TOKEN | New workflows added |

---

## 8. Scalability & Performance

No performance-impacting changes. The protocol unification is a build-time change (different import paths) with identical runtime behavior. The gateway fixes restore existing functionality without architectural changes.

**Gateway performance targets** (unchanged):
- ~40MB memory per 1000 guilds
- 25 shards per pod
- <1ms event serialization
- <5ms NATS publish latency

---

## 9. Deployment Architecture

No deployment changes in this cycle (IaC is out of scope per PRD §6). The existing ECS deployment via `deploy-production.yml` workflow continues to work. The gateway Dockerfile update (rust:1.75 → 1.85) requires rebuilding the container image.

**Deployment sequence for gateway:**
1. Fix compilation errors → `cargo check` passes
2. Update Dockerfile base image → `docker build` passes
3. Gateway CI workflow catches regressions going forward
4. Deploy via existing ECS workflow (manual trigger)

---

## 10. Development Workflow

### 10.1 Branch Strategy

Single feature branch for this cycle: `feature/spice-must-flow`

Sprint commits use conventional commit format:
- `feat(protocol): install loa-hounfour dependency`
- `feat(protocol): add tier canonicalization layer`
- `refactor(protocol): replace contract-version imports with loa-hounfour`
- `fix(gateway): align twilight-model to 0.17`
- `fix(gateway): update metrics macro syntax for 0.24`
- `ci: add agent subsystem CI workflow`
- `ci: add gateway CI workflow`
- `chore: remove sites/web/ dead code`

### 10.2 Testing Strategy

| Test Type | When | What |
|-----------|------|------|
| Golden vectors (90) | Phase 1 gate | loa-hounfour conformance |
| Cross-tenant isolation | Phase 1 | Hash and idempotency key isolation |
| Unit tests | Every commit | Tier mapping, pool mapping, budget manager |
| Integration tests | Every PR (new CI) | Full adapter layer with Redis + NATS |
| `cargo check --locked` | Every gateway PR (new CI) | Compilation verification |
| `cargo clippy` | Every gateway PR | Lint quality |
| E2E tests | Post-merge to main (stretch) | Full contract compliance |

---

## 11. Technical Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| loa-hounfour `computeReqHash` produces different output than local implementation | P0 — protocol interop failure | Low (golden vectors) | Phase 1 gate: run 90 vectors before replacing imports |
| Twilight 0.17 has undocumented breaking changes beyond the 12 identified | P0 — gateway still broken | Medium | Fix incrementally, `cargo check` after each category |
| Enterprise default pool change (`architect` → `reviewer`) breaks existing users | P1 — wrong model routing | Low | This is adopting the canonical value; loa-finn already uses `reviewer` |
| NATS service container in CI is flaky | P1 — unreliable CI | Low | Use official `nats:latest` image with health check |
| Node 22 requirement breaks existing dev environments | P1 — developer friction | Low | Most devs already on 22+; `.npmrc` engine-strict catches mismatches early |

---

## 12. Future Considerations

| Item | Cycle | Notes |
|------|-------|-------|
| Worker event handler stubs | Next | Guild join/leave, member join/leave, eligibility |
| Pool claim enforcement | loa-finn scope | loa-finn #53 |
| IaC (Terraform/CDK) | Next | Currently deploying via ECS API |
| sietch TypeScript type debt | Future | 20+ files with TODO headers |
| npm registry publication of loa-hounfour | Future | Switch from GitHub dep to `@0xhoneyjar/loa-hounfour: "^1.1.0"` |

---

*"The spice must flow." — And now we've drawn the blueprints for the pipes.*

# PRD: The Spice Must Flow — Production Readiness & Protocol Unification

**Version:** 1.1.0
**Cycle:** 023
**Date:** 2026-02-13
**Status:** Draft
**References:** [Issue #54](https://github.com/0xHoneyJar/arrakis/issues/54) · [RFC #31](https://github.com/0xHoneyJar/loa-finn/issues/31) · [loa-hounfour](https://github.com/0xHoneyJar/loa-hounfour)

---

## 1. Problem Statement

Arrakis is at 95-96% completion on the Hounfour multi-model architecture (RFC #31), but three categories of work prevent production deployment:

1. **Protocol drift risk.** Arrakis maintains its own `@arrakis/loa-finn-contract` package with hand-written JSON Schema fixtures. loa-finn already consumes from `@0xhoneyjar/loa-hounfour` (the canonical shared protocol package). The two have structural divergences — integer tiers vs string tiers, different default pool mappings, separate req-hash implementations. Any further drift means interop failure at runtime.

2. **Gateway is dead code.** The Rust Discord gateway (`apps/gateway/`) has 34 compilation errors from version skew (`twilight-gateway` 0.17 vs `twilight-model` 0.15, `async-nats` 0.46 API changes, `metrics` macro syntax). It has no CI pipeline and cannot be built or deployed.

3. **CI coverage gap.** The 38-file agent adapter layer (`packages/adapters/agent/`), 7 unit tests, 1 integration test, and 9-scenario E2E suite have no CI workflow. The `pr-validation.yml` only covers `themes/sietch/`. Production changes to the agent gateway subsystem are untested in CI.

> Sources: Gap analysis of `packages/adapters/agent/`, `tests/e2e/`, `apps/gateway/`, `.github/workflows/`, confirmed against issue #54 and RFC #31 coverage maps.

---

## 2. Goals & Success Metrics

| ID | Goal | Metric | Priority |
|----|------|--------|----------|
| G-1 | Adopt loa-hounfour as single source of truth for protocol contracts | Zero remaining imports of `@arrakis/loa-finn-contract`; all schema validation uses loa-hounfour exports | P0 |
| G-2 | Gateway compiles and passes tests | `cargo check` exits 0; `cargo test` exits 0; Dockerfile builds successfully | P0 |
| G-3 | Agent subsystem has CI coverage | PR validation workflow runs unit + integration tests on `packages/**` changes | P1 |
| G-4 | E2E tests run in CI | E2E suite passes in Docker Compose with `SKIP_E2E=false` | P2 |
| G-5 | Clean up dead code and credential risks | `sites/web/` removed or properly scaffolded; no `.env.local` tracked | P1 |

---

## 3. Users & Stakeholders

| Persona | Needs |
|---------|-------|
| **Platform team (us)** | Confidence that agent gateway works end-to-end with loa-finn before production rollout |
| **loa-finn** | Arrakis speaks the same protocol contract version — schemas, hashes, and version negotiation must agree |
| **Community operators** | Reliable Discord/Telegram bot that doesn't drop events (gateway must compile and deploy) |

---

## 4. Functional Requirements

### 4.1 Protocol Unification (loa-hounfour Adoption)

**Ref:** Issue #54, BridgeBuilder comment on incremental migration

#### 4.1.1 Install loa-hounfour

Add `@0xhoneyjar/loa-hounfour` as a dependency of `packages/adapters/`, pinned to an immutable commit SHA for reproducibility:

```bash
pnpm add "github:0xHoneyJar/loa-hounfour#v1.1.0"
```

The package commits `dist/` to the repo, so no build step is needed on install. When `@0xhoneyjar` npm scope auth is configured, switch to `"@0xhoneyjar/loa-hounfour": "^1.1.0"`.

**Node engine requirement:** loa-hounfour requires Node >= 22. Arrakis's worker already requires >= 20. Enforce Node 22 in CI via `actions/setup-node` and add `"engines": { "node": ">=22" }` to the root `package.json`. Enable `engine-strict=true` in `.npmrc`.

(src: `packages/adapters/package.json`, `package.json`, `.npmrc`)

#### 4.1.2 Reconcile Schema Divergences

Before replacing imports, reconcile structural differences:

| Divergence | Arrakis Current | loa-hounfour | Resolution |
|-----------|----------------|--------------|------------|
| Tier representation | Integer 1-9 (`tests/e2e/contracts/schema/loa-finn-contract.json:24`) | String enum `'free' \| 'pro' \| 'enterprise'` (`TierSchema`) | Adopt loa-hounfour's `Tier` type. Map integer tiers to canonical strings at the Arrakis external boundary only (Discord role → `Tier`). See §4.1.2.1 for canonicalization rule. |
| Enterprise default pool | `'architect'` (`packages/adapters/agent/pool-mapping.ts:110`) | `'reviewer'` (`TIER_DEFAULT_POOL`) | Adopt loa-hounfour's `TIER_DEFAULT_POOL`. Update `pool-mapping.ts` to use imported constant. |
| Model alias source | Hardcoded `MODEL_ALIAS_VALUES` (`packages/core/ports/agent-gateway.ts:22`) | `POOL_IDS` from loa-hounfour | Replace hardcoded values with `POOL_IDS` import. Resolves `TODO(hounfour)`. |

##### 4.1.2.1 Tier Canonicalization Rule

**Contract rule:** The payload passed to `computeReqHash()` and `deriveIdempotencyKey()` MUST use loa-hounfour's canonical `Tier` string representation. Integer-to-string mapping occurs exclusively at the Arrakis external boundary (Discord role → canonical Tier) and NEVER inside the hashed message.

**Canonical mapping:**

| Discord Role Tier (integer) | loa-hounfour `Tier` (string) |
|----------------------------|------------------------------|
| 1–3 | `'free'` |
| 4–6 | `'pro'` |
| 7–9 | `'enterprise'` |

The mapping function `canonicalizeTier(roleTier: number): Tier` is implemented once in `packages/adapters/agent/tier-mapping.ts` and imported wherever Discord role tiers enter the system. All downstream code (pool mapping, request hashing, idempotency) operates exclusively on canonical `Tier` strings.

**Verification:** Add a test that constructs a request with a known Discord role tier, canonicalizes it, computes the req-hash, and asserts the hash matches the golden vector from loa-hounfour for the same canonical payload. This proves Arrakis and loa-finn produce identical hashes for equivalent requests.

#### 4.1.3 Migrate Imports (Incremental)

Per the BridgeBuilder migration strategy, migrate in three phases:

**Phase 1 — Transformation validation:** Import loa-hounfour schemas alongside existing fixtures. Validate that legacy payloads can be transformed into canonical loa-hounfour payloads via the tier canonicalization rule (§4.1.2.1), then validate the transformed payload against loa-hounfour schemas only. This tests the *transformation + canonical validation* path, not naive dual-schema acceptance of identical bytes. Run loa-hounfour's 90 golden test vectors in CI as the acceptance gate for Phase 2.

**Phase 2 — Replace imports:** Swap each local import for its loa-hounfour equivalent:

| Local Module | loa-hounfour Replacement |
|-------------|------------------------|
| `packages/contracts/src/index.ts` (JwtClaimsSchema) | `import { JwtClaimsSchema } from '@0xhoneyjar/loa-hounfour'` |
| `packages/adapters/agent/contract-version.ts` (CONTRACT_VERSION, validateCompatibility) | `import { CONTRACT_VERSION, validateCompatibility } from '@0xhoneyjar/loa-hounfour'` |
| `packages/adapters/agent/req-hash.ts` (computeReqHash) | `import { computeReqHash, verifyReqHash } from '@0xhoneyjar/loa-hounfour'` |
| `packages/adapters/agent/idempotency.ts` (deriveIdempotencyKey) | `import { deriveIdempotencyKey } from '@0xhoneyjar/loa-hounfour'` |
| `packages/adapters/agent/pool-mapping.ts` (POOL_IDS, TIER_POOL_ACCESS) | `import { POOL_IDS, TIER_POOL_ACCESS, TIER_DEFAULT_POOL, isValidPoolId, tierHasAccess } from '@0xhoneyjar/loa-hounfour'` |
| `tests/e2e/agent-gateway-e2e.test.ts` (getVector, CONTRACT_VERSION) | `import { CONTRACT_VERSION, validateCompatibility } from '@0xhoneyjar/loa-hounfour'` |

**Phase 3 — Remove local packages:** Delete `packages/contracts/` and `tests/e2e/contracts/` once all imports are migrated and tests pass.

#### 4.1.4 Run Golden Test Vectors

loa-hounfour ships 90 golden test vectors. After migration, run them against Arrakis's implementation to verify cross-system conformance.

### 4.2 Gateway Resurrection

**Ref:** Pre-existing compilation errors in `apps/gateway/`

**Error budget closure:** Before starting, capture `cargo check 2>&1` output and enumerate all 34 errors into a tracking checklist. Each error must be linked to a commit that resolves it. The Docker build must use `--locked` and the same feature flags as CI to prevent "compiles locally but not in container" divergence.

Fix all 34 compilation errors across 4 categories:

#### 4.2.1 Twilight Version Alignment

Upgrade `twilight-model` and `twilight-http` from 0.15 to 0.17 to match `twilight-gateway` 0.17. Fix all breaking API changes:

| Change | Files Affected | Fix |
|--------|---------------|-----|
| `Config::builder()` removed | `shard/pool.rs:68` | Use `Config::new(token, intents)` |
| `ShardId::new()` takes `(u32, u32)` | `shard/pool.rs:70` | Cast pool/shard IDs to `u32` at twilight boundary |
| `shard.id().number()` returns `u32` | `shard/pool.rs:104,148` | Cast to `u64` via `.into()` for internal methods |
| `GuildCreate.id` is now method | `events/serialize.rs:53` | Change `guild.id` to `guild.id()` |
| `GuildCreate` fields removed | `events/serialize.rs:57-59` | Serialize full payload via `serde_json::to_value()` |
| `ReceiveMessageError` API changed | `shard/pool.rs:162` | Adapt error handling to 0.17 API |

(src: `apps/gateway/Cargo.toml`, `apps/gateway/src/shard/pool.rs`, `apps/gateway/src/events/serialize.rs`)

#### 4.2.2 Metrics Macro Syntax

Upgrade `metrics` to 0.24 and `metrics-exporter-prometheus` to 0.18. Update all macro invocations in `apps/gateway/src/metrics/mod.rs` to use the 0.24 label syntax.

(src: `apps/gateway/src/metrics/mod.rs` — 9 macro sites at lines 99, 109, 115, 124, 133, 143, 157, 166, 173)

#### 4.2.3 async-nats PublishAckFuture

Fix `apps/gateway/src/nats/publisher.rs:98-99` to await the `PublishAckFuture` before accessing `.stream` and `.sequence`.

#### 4.2.4 Module Visibility

Change `mod serialize;` to `pub mod serialize;` in `apps/gateway/src/events/mod.rs:5`.

#### 4.2.5 Dockerfile Update

Update `apps/gateway/Dockerfile:6` from `rust:1.75-alpine` to `rust:1.85-alpine` (or latest stable).

### 4.3 CI/CD Hardening

**CI execution contracts (apply to all workflows below):**

1. All TypeScript workflows run `pnpm -w install --frozen-lockfile` at repo root (single lockfile, deterministic).
2. All Rust workflows use `--locked` flag (Cargo.lock must be committed and match).
3. Required service containers for integration tests: NATS/JetStream (`nats:latest` with `-js` flag).
4. Caching: pnpm store (`actions/cache` on `~/.local/share/pnpm/store`), Cargo registry + target (`actions/cache` on `~/.cargo/registry` + `apps/gateway/target`).
5. Explicit timeouts per workflow (see NFR-3 scope below).

#### 4.3.1 Agent Subsystem CI

Add a workflow that triggers on `packages/**`, `tests/unit/**`, `tests/integration/**` changes and runs:
- TypeScript type checking (`tsc --noEmit`)
- Unit tests (`vitest run` on `tests/unit/`)
- Integration tests (`vitest run` on `tests/integration/`) with NATS service container

(src: `.github/workflows/pr-validation.yml` — extend or create new workflow)

#### 4.3.2 Gateway CI

Add a workflow that triggers on `apps/gateway/**` changes and runs:
- `cargo check --locked`
- `cargo test --locked`
- `cargo clippy --locked -- -D warnings`
- Docker build verification (`docker build apps/gateway/`)

(src: `.github/workflows/` — new `gateway-ci.yml`)

#### 4.3.3 E2E CI (Stretch)

Add a workflow that runs the E2E suite via `docker-compose.e2e.yml`. Requires the existing `loa-finn-e2e-stub.ts` mock server (19k lines, already in-tree). This may be deferred if the Docker Compose setup is complex. **NFR-3 (< 10 min) does NOT apply to this P2 workflow** — E2E with Docker Compose may exceed 10 minutes and that is acceptable.

### 4.4 Housekeeping

#### 4.4.1 Remove `sites/web/`

The `sites/web/` directory contains only `next-env.d.ts`, `.env.local`, and `.vercel/project.json` — no source code. Remove it and add `sites/web/` to `.gitignore`.

(src: `sites/web/`)

#### 4.4.2 Deduplicate Contract Packages

After loa-hounfour migration (4.1.3 Phase 3), remove both:
- `packages/contracts/`
- `tests/e2e/contracts/`

Update `packages/adapters/package.json` to remove the `"@arrakis/loa-finn-contract": "file:../contracts"` dependency.

### 4.5 Security Acceptance Criteria

Protocol unification (§4.1) touches JWT claims, hashing, idempotency, and compatibility negotiation — exactly the surfaces that can accidentally drop tenant scoping or accept cross-tenant replay. The following P0 acceptance criteria apply:

1. **JWT validation:** The `JwtClaimsSchema` used in agent adapters MUST be imported from loa-hounfour and validated on every inbound request. No request may bypass schema validation.

2. **Tenant-scoped integrity:** `computeReqHash()` and `deriveIdempotencyKey()` inputs MUST include the tenant identifier (`sub` claim from JWT). This ensures that identical request bodies from different tenants produce different hashes and idempotency keys.

3. **Cross-tenant isolation test:** Add at least one integration test asserting that two requests with identical bodies but different tenant identifiers produce different req-hashes and different idempotency keys. This prevents cross-tenant replay.

4. **mTLS assumption:** Document in the SDD how mTLS is configured between services in production and how it is simulated in local Docker Compose / CI (even if IaC is out of scope). At minimum, state whether mTLS is enforced at the load balancer, sidecar, or application layer.

---

## 5. Technical & Non-Functional Requirements

| ID | Requirement | Rationale |
|----|-------------|-----------|
| NFR-1 | loa-hounfour `computeReqHash()` output must be byte-identical to loa-finn's for identical inputs | Integrity verification at the protocol boundary |
| NFR-2 | Gateway must compile on Rust 1.85+ stable | Current Dockerfile pins 1.75 which is 14 months old |
| NFR-3 | P0/P1 CI workflows (agent subsystem, gateway) must complete in < 10 minutes | Developer feedback loop. Excludes P2 E2E workflow (§4.3.3) which may exceed this SLA. |
| NFR-4 | No secrets or `.env.local` files committed to repository | Security baseline |

---

## 6. Scope & Prioritization

### In Scope (This Cycle)

| Priority | Workstream | Sections |
|----------|-----------|----------|
| P0 | Protocol Unification | 4.1.1 — 4.1.4 |
| P0 | Gateway Resurrection | 4.2.1 — 4.2.5 |
| P1 | Agent CI + Gateway CI | 4.3.1, 4.3.2 |
| P1 | Housekeeping | 4.4.1, 4.4.2 |

### Stretch (If Time Permits)

| Priority | Item | Section |
|----------|------|---------|
| P2 | E2E CI integration | 4.3.3 |

### Out of Scope

| Item | Reason |
|------|--------|
| Worker event handler stubs (guild join/leave, member join/leave, eligibility) | Separate feature work, not blocking production |
| sietch TypeScript type debt (20+ files with TODO headers) | Existing debt, not new to this cycle |
| Infrastructure as Code (Terraform/CDK) | Separate cycle — deploy workflows work via ECS API |
| loa-finn pool claim enforcement (loa-finn #53) | loa-finn repo scope, not Arrakis |

---

## 7. Risks & Dependencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| loa-hounfour tier type change breaks E2E tests | P0 | Run dual validation (Phase 1) before removing old schemas |
| twilight 0.17 has more breaking changes than documented | P0 | Fix incrementally, compile after each change category |
| loa-hounfour Node >= 22 requirement conflicts with Arrakis | P1 | Check `engines` in root `package.json`; likely already >= 20 |
| E2E CI requires loa-finn mock server | P2 | Use existing `loa-finn-e2e-stub.ts` (19k lines); may not need external dep |
| `sites/web/` removal might break Vercel project linking | Low | Confirm with stakeholder before deleting |

---

## 8. Dependencies

| Dependency | Source | Status |
|-----------|--------|--------|
| `@0xhoneyjar/loa-hounfour` v1.1.0 | GitHub | Published, 91 tests passing |
| `twilight-model` 0.17 | crates.io | Available |
| `twilight-http` 0.17 | crates.io | Available |
| `metrics` 0.24 | crates.io | Available |

---

*"The spice must flow." — But first, the pipes must connect.*

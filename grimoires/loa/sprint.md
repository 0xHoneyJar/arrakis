# Sprint Plan: The Spice Must Flow — Production Readiness & Protocol Unification

**Cycle:** 023
**PRD:** grimoires/loa/prd.md v1.1.0
**SDD:** grimoires/loa/sdd.md v1.0.0
**Team:** 1 AI agent (autonomous)
**Sprint Duration:** Single session each
**Total Sprints:** 7 (4 completed + 3 new)
**Bridge Reference:** [PR #60](https://github.com/0xHoneyJar/arrakis/pull/60) — Bridgebuilder review converged 26 → 6 → 0

---

## Completed Sprints (1–4)

> Sprints 1–4 executed in the initial `/run sprint-plan` pass and validated through 3 Bridgebuilder iterations. Summary:
>
> | Sprint | Goal | Status |
> |--------|------|--------|
> | Sprint 1 | Housekeeping & Protocol Foundation | COMPLETED |
> | Sprint 2 | Protocol Unification (Import Migration) | COMPLETED |
> | Sprint 3 | Gateway Resurrection | COMPLETED |
> | Sprint 4 | CI/CD Hardening | COMPLETED |
>
> **Bridge findings addressed:** 10 of 18 findings resolved across iterations. Remaining architectural recommendations and low-priority findings are addressed in Sprints 5–7 below.

---

## Sprint 5: NATS Wire Schema Contract

**Goal:** Eliminate the cross-language type duplication between the Rust gateway and TypeScript worker by creating a shared schema package. Prevent future BB60-20-class wire format bugs (field renames, type mismatches) through mechanical enforcement rather than code review.

**Bridgebuilder Reference:** Meditation §II (Wire Format Lesson), Meditation §2.1 (Schema Registry investment), BB60-20 (interaction_token field rename caught by review — should be caught by tests)

### Architectural Context

> *"When two processes communicate across a language boundary, the wire format must be governed by a schema that neither side owns unilaterally."* — Bridgebuilder, The Architecture of Convergence
>
> The Hounfour RFC already defines this pattern for the ModelPort interface (§5.3 Tool Calling Contract). The NATS layer between gateway and worker deserves the same rigor. Confluent's Schema Registry for Kafka demonstrated that schema governance at the message layer prevents more production incidents than any amount of integration testing.

### Tasks

#### S5-T1: Create `packages/shared/nats-schemas/` workspace package

**Description:** Initialize a new TypeScript package in the pnpm workspace that serves as the single source of truth for all NATS wire format types. This package has zero runtime dependencies — it exports only TypeScript types, Zod schemas, and string constants.

**Acceptance Criteria:**
- `packages/shared/nats-schemas/package.json` exists with name `@arrakis/nats-schemas`
- Package added to `pnpm-workspace.yaml`
- `pnpm install` succeeds
- Package exports from `src/index.ts`
- Zero runtime dependencies (devDependencies only: `zod`, `typescript`)
- `tsconfig.json` with `strict: true`, `declaration: true`
- Committed JSON fixture directory `packages/shared/nats-schemas/fixtures/` for cross-language validation (consumed by both Rust and TypeScript tests)

**Effort:** Small
**Dependencies:** None

#### S5-T2: Define GatewayEvent schema and compatibility aliases

**Description:** Create the canonical TypeScript definition of the `GatewayEvent` wire format. The Rust gateway is the **producer** — its `serialize.rs` output defines reality. This schema package **codifies** that reality as TypeScript types + Zod schemas + committed JSON fixtures, then both sides validate against the fixtures. Include JSDoc comments that reference the Rust source file and line numbers. Export a `GatewayEventPayload` type alias for backward compatibility with `EventNatsConsumer.ts`.

**Schema ownership model:** The fixtures (committed JSON files in `fixtures/`) are the neutral contract. Rust tests assert serialization output matches fixtures. TypeScript Zod schemas validate fixtures parse correctly. Neither language "owns" the schema unilaterally — the fixtures are the source of truth.

**Types to define:**
```typescript
// Codifies apps/gateway/src/events/serialize.rs:12-21 output
export interface GatewayEvent {
  event_id: string;      // UUID v4
  event_type: string;    // Discord event type (e.g., "INTERACTION_CREATE")
  shard_id: number;      // u64 in Rust, safe as number for <2^53
  timestamp: number;     // Unix epoch ms (u64 in Rust)
  guild_id: string | null;
  channel_id: string | null;
  user_id: string | null;
  data: Record<string, unknown>;
}

// Backward compatibility alias for EventNatsConsumer.ts
export type GatewayEventPayload = GatewayEvent;
```

**Acceptance Criteria:**
- `GatewayEvent` interface defined with JSDoc citing `serialize.rs` line numbers
- `GatewayEventPayload` exported as type alias for backward compatibility
- `GatewayEventSchema` Zod schema validates all fields with correct types
- `shard_id` and `timestamp` are `z.number().int().nonnegative()` (documents the Rust u64 → JS number constraint)
- `event_id` is `z.string().uuid()`
- Export both the interface, alias, and Zod schema from package index
- Committed JSON fixtures in `packages/shared/nats-schemas/fixtures/` for at least `interaction_create.json`, `guild_create.json`, `guild_delete.json` (deterministic: fixed UUIDs, fixed timestamps)

**Effort:** Medium
**Dependencies:** S5-T1

#### S5-T3: Define InteractionPayload and event-specific schemas

**Description:** Define the `InteractionPayload` shape (the `data` field contents for `INTERACTION_CREATE` events) matching the Rust serialization in `serialize.rs:127-137`. This is the exact type that caused BB60-20 — the `interaction_token` field that was renamed in Rust but not TypeScript.

**Types to define:**
```typescript
// Mirrors serialize.rs:127-137 (InteractionCreate data payload)
export interface InteractionPayload {
  interaction_id: string;
  interaction_type: string;
  interaction_token: string;  // BB60-20: defense-in-depth naming
  guild_id: string | null;
  channel_id: string | null;
  member: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
}

// Mirrors serialize.rs:49-62 (GuildCreate data payload)
export interface GuildCreatePayload {
  guild_id: string;
  guild_name: string;
  member_count: number | null;
  payload: Record<string, unknown>;  // Full guild object
}
```

**Acceptance Criteria:**
- `InteractionPayload` interface matches Rust `InteractionCreate` serialization exactly
- `GuildCreatePayload` interface matches Rust `GuildCreate` serialization
- Zod schemas for both with field-level validation
- `interaction_token` field explicitly documented with `@see BB60-20` reference
- Exported from package index

**Effort:** Medium
**Dependencies:** S5-T2

#### S5-T4: Define shared NATS subject and stream constants (language-neutral)

**Description:** Extract the NATS stream names and subject routing patterns into a language-neutral JSON file (`packages/shared/nats-schemas/nats-routing.json`) that both Rust and TypeScript consume. Currently these are independently hardcoded on both sides — a comment cannot prevent drift, only a shared artifact can.

**Language-neutral artifact:**
```json
{
  "streams": {
    "COMMANDS": "arrakis-commands",
    "EVENTS": "arrakis-events"
  },
  "subjects": {
    "INTERACTION_CREATE": "discord.interaction.create",
    "GUILD_CREATE": "discord.guild.create",
    "GUILD_DELETE": "discord.guild.delete",
    "MEMBER_ADD": "discord.member.add",
    "MEMBER_REMOVE": "discord.member.remove"
  }
}
```

**TypeScript consumption:**
```typescript
import routing from './nats-routing.json' assert { type: 'json' };
export const NATS_STREAMS = routing.streams;
export const NATS_SUBJECTS = routing.subjects;
```

**Rust consumption:** Add a Rust test in `apps/gateway/tests/nats_routing.rs` that reads `../../packages/shared/nats-schemas/nats-routing.json`, deserializes it, and asserts each subject/stream matches the hardcoded constants in `nats/publisher.rs`. This CI-enforced check fails if either side diverges.

**Acceptance Criteria:**
- `packages/shared/nats-schemas/nats-routing.json` exists as the neutral artifact
- TypeScript consumers (`CommandNatsConsumer.ts`, `EventNatsConsumer.ts`) import subjects from `@arrakis/nats-schemas`
- Rust test asserts publisher constants match the JSON artifact (fails CI on mismatch)
- No hardcoded stream/subject strings remain in TypeScript consumer files
- Rust hardcoded constants remain for zero-overhead at runtime, but are CI-validated against the shared artifact

**Effort:** Medium
**Dependencies:** S5-T2

#### S5-T5: Migrate TypeScript consumers to shared schemas

**Description:** Update `CommandNatsConsumer.ts` and `EventNatsConsumer.ts` to import types from `@arrakis/nats-schemas` instead of defining them inline. Add Zod validation at the NATS trust boundary (message receipt) using the shared schemas.

**Acceptance Criteria:**
- `CommandNatsConsumer.ts` imports `GatewayEvent`, `InteractionPayload` from `@arrakis/nats-schemas`
- `EventNatsConsumer.ts` imports `GatewayEventPayload` (the backward-compat alias exported from S5-T2) from `@arrakis/nats-schemas`
- Inline `InteractionPayload` interface in `CommandNatsConsumer.ts` deleted
- Inline `GatewayEventPayload` interface in `EventNatsConsumer.ts` deleted
- Zod `.safeParse()` applied to incoming NATS messages with structured error logging on parse failure
- All existing unit and integration tests pass
- `pnpm -w vitest run tests/unit/` passes
- `pnpm -w vitest run tests/integration/` passes

**Effort:** Medium
**Dependencies:** S5-T3, S5-T4

#### S5-T6: Add wire format conformance tests

**Description:** Create tests that validate the TypeScript schema definitions match what the Rust gateway actually produces. These tests use snapshot fixtures of real gateway output (captured from `serialize.rs` logic) and validate them against the Zod schemas. This mechanically prevents BB60-20-class bugs.

**Test cases:**
1. Parse a snapshot `InteractionCreate` JSON payload through `GatewayEventSchema` — must pass
2. Parse a snapshot `GuildCreate` JSON payload through `GatewayEventSchema` — must pass
3. Parse a payload with `token` instead of `interaction_token` — must FAIL (regression guard for BB60-20)
4. Parse a payload with missing `event_id` — must FAIL
5. Parse a payload with `shard_id` as string — must FAIL (type coercion guard)

**Acceptance Criteria:**
- `tests/unit/nats-schema-conformance.test.ts` exists
- At least 5 test cases covering happy path and regression guards
- BB60-20 regression test explicitly named and documented
- Tests run via `vitest run tests/unit/nats-schema-conformance.test.ts`
- Tests added to agent-ci.yml trigger paths

**Effort:** Medium
**Dependencies:** S5-T3

---

## Sprint 6: Rust Domain Error Types

**Goal:** Replace `anyhow::Result` with `thiserror`-based domain error types in the Rust gateway. Make the error space navigable for on-call engineers and enable compile-time exhaustive handling.

**Bridgebuilder Reference:** Meditation §V.1 (Rust Error Taxonomy Gap), Meditation §2.2 (Domain Error Types investment)

### Architectural Context

> *"When an on-call engineer sees `GatewayError::ShardCircuitBroken { shard_id: 3, count: 10, max: 10 }` in a log, they know exactly what happened. When they see `anyhow::Error: 'Error receiving event'`, they're guessing."* — Bridgebuilder, The Architecture of Convergence
>
> `thiserror = "2"` is already in `Cargo.toml` but unused. Cloudflare's `wrangler` CLI and Tokio's internal error types demonstrate the pattern. The Rust compiler will verify that every error variant is handled somewhere, turning runtime surprises into compile-time guarantees.

### Tasks

#### S6-T0: Inventory all `anyhow::Result` usages

**Description:** Run `rg 'anyhow::Result|anyhow::Context|anyhow::Error|anyhow::bail|anyhow::ensure' apps/gateway/src/` and enumerate every module that uses anyhow. This creates the migration checklist for S6-T2 through S6-T4.

**Acceptance Criteria:**
- Complete list of files and line numbers using any anyhow API
- Each usage categorized: migrate (application code) or keep (process boundary in main.rs only)
- Total count documented

**Effort:** Small
**Dependencies:** None

#### S6-T1: Define `GatewayError` enum

**Description:** Create `apps/gateway/src/error.rs` with a `thiserror`-derived error enum covering all error categories identified in S6-T0. Reference Cloudflare's `wrangler` CLI pattern.

```rust
#[derive(thiserror::Error, Debug)]
pub enum GatewayError {
    #[error("shard {shard_id} exceeded consecutive error threshold ({count}/{max})")]
    ShardCircuitBroken { shard_id: u64, count: u32, max: u32 },

    #[error("shard {shard_id} reconnection failed")]
    ShardReconnectFailed { shard_id: u64, #[source] source: Box<dyn std::error::Error + Send + Sync> },

    #[error("NATS publish failed for subject '{subject}'")]
    NatsPublishFailed { subject: String, #[source] source: async_nats::Error },

    #[error("NATS connection failed: {0}")]
    NatsConnectionFailed(#[source] async_nats::ConnectError),

    #[error("event serialization failed for {event_type} on shard {shard_id}")]
    SerializationFailed { event_type: String, shard_id: u64, #[source] source: serde_json::Error },

    #[error("configuration error: {0}")]
    Config(String),

    #[error("shard ID overflow: {value} exceeds u32::MAX")]
    ShardIdOverflow { value: u64 },
}
```

**Acceptance Criteria:**
- `apps/gateway/src/error.rs` exists with `GatewayError` enum
- All variants have structured context fields (shard_id, subject, etc.)
- `#[source]` annotations for error chain propagation
- `pub mod error;` added to `lib.rs` or `main.rs`
- `cargo check` passes

**Effort:** Medium
**Dependencies:** None

#### S6-T2: Migrate shard pool to domain errors

**Description:** Replace `anyhow::Result` usage in `shard/pool.rs` with `GatewayError` variants. The circuit breaker (BB60-2) should return `GatewayError::ShardCircuitBroken` instead of opaque `anyhow::Error`. Add the shard ID safe cast (BB60-19: `u64 as u32` → `TryFrom` with `GatewayError::ShardIdOverflow`).

**Acceptance Criteria:**
- `pool.rs` returns `Result<_, GatewayError>` instead of `anyhow::Result`
- Circuit breaker at line ~182 returns `GatewayError::ShardCircuitBroken { shard_id, count: consecutive_errors, max: MAX_CONSECUTIVE_ERRORS }`
- Shard ID conversion uses `u32::try_from(shard_id).map_err(|_| GatewayError::ShardIdOverflow { value: shard_id })?` instead of `shard_id as u32`
- Reconnection failure returns `GatewayError::ShardReconnectFailed`
- `cargo check` passes
- `cargo test` passes

**Effort:** Large
**Dependencies:** S6-T1

#### S6-T3: Migrate NATS publisher to domain errors

**Description:** Replace `anyhow::Result` in `nats/publisher.rs` with `GatewayError::NatsPublishFailed` and `GatewayError::NatsConnectionFailed`. The NATS subject is now carried in the error for diagnostics.

**Acceptance Criteria:**
- `publisher.rs` returns `Result<_, GatewayError>` for publish operations
- Failed publishes carry the subject string in the error
- Connection failures use `GatewayError::NatsConnectionFailed`
- `cargo check` passes

**Effort:** Medium
**Dependencies:** S6-T1

#### S6-T4: Migrate config, remaining modules, and main to domain errors

**Description:** Replace `anyhow::Context` usage in `config.rs` with `GatewayError::Config`. Migrate any remaining modules identified in S6-T0 (e.g., event serialization, shard runner). Update `main.rs` to handle `GatewayError` at the top level — `main()` is the ONLY function allowed to return `anyhow::Result` (process boundary). Add a CI lint to enforce this boundary.

**Acceptance Criteria:**
- `config.rs` returns `Result<_, GatewayError>` for configuration loading
- All modules identified in S6-T0 inventory migrated to `GatewayError` (except main.rs)
- `main.rs` is the ONLY file containing `anyhow::Result` (process boundary exception)
- All `anyhow::Context` calls in config.rs replaced with `GatewayError::Config`
- `cargo check` passes
- `cargo test` passes
- CI step added to `gateway-ci.yml`: `rg 'anyhow::Result' apps/gateway/src/ --glob '!main.rs' && exit 1 || true` (fails if anyhow leaks outside main.rs)

**Effort:** Medium
**Dependencies:** S6-T1, S6-T0 (inventory must be complete)

#### S6-T5: Derive metrics from error types

**Description:** Add a method on `GatewayError` that returns a static label string suitable for Prometheus metrics. Update the existing `gateway_errors_total` counter to use the error type label, enabling per-error-type monitoring.

```rust
impl GatewayError {
    pub fn error_type_label(&self) -> &'static str {
        match self {
            Self::ShardCircuitBroken { .. } => "circuit_broken",
            Self::ShardReconnectFailed { .. } => "reconnect_failed",
            Self::NatsPublishFailed { .. } => "nats_publish",
            Self::NatsConnectionFailed(_) => "nats_connection",
            Self::SerializationFailed { .. } => "serialization",
            Self::Config(_) => "config",
            Self::ShardIdOverflow { .. } => "shard_overflow",
        }
    }
}
```

**Acceptance Criteria:**
- `error_type_label()` method exists on `GatewayError`
- `gateway_errors_total` counter uses `error_type` label from this method
- Existing Prometheus metrics still export correctly
- `cargo check` passes
- `cargo test` passes

**Effort:** Small
**Dependencies:** S6-T2, S6-T3 (errors must be used before adding metrics labels)

---

## Sprint 7: Wire Format Safety & BB60 Polish

**Goal:** Add integration-level wire format tests, address remaining low-priority Bridgebuilder findings, and document the cross-language schema governance for future contributors.

**Bridgebuilder Reference:** BB60-3 (shard ID cast), BB60-8 (access level fallback logging), BB60-10 (enterprise pool changelog), BB60-11 (pnpm version pinning), Meditation §V.3 (Observability — NOTE: Prometheus metrics already exist; this sprint focuses on documentation, not implementation)

### Tasks

#### S7-T1: Wire format round-trip property tests (committed fixtures)

**Description:** Validate that Rust serialization output and TypeScript Zod schemas agree on the wire format, using **committed JSON fixtures** as the neutral contract (defined in S5-T2).

**Approach — committed fixtures (not generated at test time):**
The fixtures in `packages/shared/nats-schemas/fixtures/` are committed artifacts with deterministic values (fixed UUIDs, fixed timestamps). Both sides validate against them:

1. **Rust conformance test** (`apps/gateway/tests/wire_format.rs`): Serializes a `GatewayEvent` with the same deterministic inputs, then asserts the output is byte-identical to the committed fixture. If Rust serialization changes, this test fails until the fixture is updated.
2. **TypeScript conformance test** (`tests/unit/wire-format-roundtrip.test.ts`): Loads committed fixtures, parses them through `@arrakis/nats-schemas` Zod schemas, asserts success. If the schema changes in a way that rejects the fixture, this test fails.
3. **CI freshness check** (in `gateway-ci.yml`): A step that regenerates fixtures from Rust via `cargo test -p gateway --test wire_format -- --generate-fixtures`, then runs `git diff --exit-code packages/shared/nats-schemas/fixtures/`. If Rust output has changed but fixtures weren't updated, CI fails with a clear message: "Wire format fixtures are stale. Regenerate and commit."

**Root-level script** for developer convenience:
```bash
# scripts/test-wireformat.sh
set -euo pipefail
cd apps/gateway && cargo test --test wire_format -- --generate-fixtures
cd ../..
pnpm -w vitest run tests/unit/wire-format-roundtrip.test.ts
git diff --exit-code packages/shared/nats-schemas/fixtures/ || {
  echo "ERROR: Wire format fixtures changed. Commit the updated fixtures."
  exit 1
}
```

**Acceptance Criteria:**
- Committed fixtures exist in `packages/shared/nats-schemas/fixtures/` (from S5-T2): `interaction_create.json`, `guild_create.json`, `guild_delete.json`
- Rust test in `apps/gateway/tests/wire_format.rs` asserts serialization output matches committed fixtures (byte-identical comparison)
- Rust test supports `--generate-fixtures` flag to overwrite fixture files (for intentional updates)
- TypeScript test in `tests/unit/wire-format-roundtrip.test.ts` loads fixtures and validates with Zod schemas
- `scripts/test-wireformat.sh` runs both sides and checks for staleness
- CI step in `gateway-ci.yml` runs the freshness check
- At least 3 event types covered with deterministic inputs (fixed UUID `00000000-0000-4000-8000-000000000001`, fixed timestamp `1707868800000`)

**Effort:** Large
**Dependencies:** Sprint 5 complete (schemas and fixtures must exist), Sprint 6 complete (error types used in serialization)

#### S7-T2: Document cross-language schema governance

**Description:** Add a `packages/shared/nats-schemas/SCHEMA-GOVERNANCE.md` that documents the wire format contract between Rust and TypeScript. Future contributors must understand: (1) where the schema lives, (2) how to add a new event type, (3) how to validate changes, (4) what BB60-20 was and why this exists.

**Sections:**
1. Purpose and history (BB60-20 incident)
2. Schema ownership model (TypeScript package is authoritative for types, Rust must conform)
3. How to add a new event type (checklist)
4. How to rename a field (checklist with mandatory fixture update)
5. CI verification (how the round-trip tests catch regressions)

**Acceptance Criteria:**
- `packages/shared/nats-schemas/SCHEMA-GOVERNANCE.md` exists
- References BB60-20 as the motivating incident
- Includes step-by-step checklists for common schema changes
- References the Hounfour RFC's Tool Calling Contract (§5.3) as the upstream pattern

**Effort:** Small
**Dependencies:** S7-T1 (reference the test infrastructure)

#### S7-T3: Address remaining BB60 low-priority findings

**Description:** Batch-fix the remaining low-severity Bridgebuilder findings that weren't addressed in the initial iterations.

**Sub-tasks:**
1. **BB60-11 — pnpm version pinning in CI:** Add `packageManager: "pnpm@9.x"` to root `package.json` to ensure CI uses a consistent pnpm version via corepack
2. **BB60-8 — Access level fallback logging:** In `pool-mapping.ts`, add `logger.warn()` when `resolvePoolId` falls back to default pool for an unknown access level, with the original access level value for debugging
3. **BB60-10 — Enterprise pool changelog:** Add a CHANGELOG entry documenting the enterprise default pool change from `'architect'` to `'reviewer'` (TIER_DEFAULT_POOL from loa-hounfour)

**Acceptance Criteria:**
- Root `package.json` has `"packageManager"` field
- `resolvePoolId()` logs a warning on access level fallback with the original value
- CHANGELOG.md has an entry for the enterprise pool default change
- All existing tests pass

**Effort:** Small
**Dependencies:** None

#### S7-T4: Update Prometheus metrics documentation

**Description:** The Bridgebuilder meditation recommended adding Prometheus metrics to the gateway. In fact, the gateway ALREADY has comprehensive metrics (`apps/gateway/src/metrics/mod.rs`) including `gateway_events_received_total`, `gateway_events_routed_total`, `gateway_route_failures_total`, `gateway_event_route_duration_seconds`, `gateway_shards_ready`, `gateway_guilds_total`, `gateway_nats_connected`, and `gateway_last_heartbeat_timestamp`. Document these existing metrics and their Prometheus scrape endpoint for operators.

**Acceptance Criteria:**
- `apps/gateway/METRICS.md` documents all exported Prometheus metrics with descriptions and labels
- Includes example Prometheus scrape config for the gateway
- References the `metrics-exporter-prometheus = "0.18"` dependency
- Notes the new `error_type` label on `gateway_errors_total` from Sprint 6

**Effort:** Small
**Dependencies:** S6-T5 (error type labels must be added first)

---

## Dependency Graph (Sprints 5–7)

```
Sprint 5:  S5-T1 ──▶ S5-T2 ──┬──▶ S5-T3 ──▶ S5-T5
                               ├──▶ S5-T4 ──▶ S5-T5
                               └──▶ S5-T6

Sprint 6:  S6-T0 ──▶ S6-T1 ──┬──▶ S6-T2 ──┐
                               ├──▶ S6-T3 ──┼──▶ S6-T5
                               └──▶ S6-T4   │
                                             │
Sprint 7:  S7-T3 (no deps)                  │
           S7-T1 (needs Sprint 5 + Sprint 6)
           S7-T2 (needs S7-T1)
           S7-T4 (needs S6-T5)
```

**Sprint 5 and Sprint 6 are independent** — they can be executed in parallel or in either order. Sprint 7 depends on both being complete (for wire format round-trip tests).

**Schema ownership model:** Committed JSON fixtures are the neutral contract. Rust tests assert output matches fixtures. TypeScript Zod schemas validate fixtures parse correctly. CI freshness checks prevent silent drift on either side.

---

## Success Metrics (Sprints 5–7)

| Goal | Metric | Sprint |
|------|--------|--------|
| G-6 | Zero inline NATS type definitions in consumer files | Sprint 5 |
| G-7 | All NATS messages validated via Zod at trust boundary | Sprint 5 |
| G-8 | Zero `anyhow::Result` in gateway application code; only `main.rs` allowed (CI-enforced via rg lint) | Sprint 6 |
| G-9 | `gateway_errors_total` counter carries `error_type` label | Sprint 6 |
| G-10 | Cross-language wire format validated by CI tests | Sprint 7 |
| G-11 | All BB60 findings addressed (score remains at 0) | Sprint 7 |

---

## Risk Mitigation (Sprints 5–7)

| Risk | Sprint | Mitigation |
|------|--------|------------|
| Zod validation rejects valid gateway payloads | Sprint 5 | Use `.passthrough()` for `data` field; snapshot fixtures from real gateway output |
| thiserror migration introduces runtime behavior change | Sprint 6 | Error messages preserved; only the type structure changes |
| Cross-language fixture tests are fragile | Sprint 7 | Use deterministic UUIDs and timestamps in fixtures; document update process |
| pnpm version pin breaks existing contributors | Sprint 7 | Pin to `9.x` range, not exact version; corepack handles resolution |

---

## Bridgebuilder Meditation Investments — Status

| Investment | Status | Sprint |
|-----------|--------|--------|
| 1. Wire Format Schema Registry | **Addressed** — `packages/shared/nats-schemas/` | Sprint 5 |
| 2. Domain Error Types in Gateway | **Addressed** — `thiserror`-based `GatewayError` | Sprint 6 |
| 3. Prometheus Metrics in Gateway | **Already exists** — `metrics-exporter-prometheus 0.18` with 9 metrics | Sprint 7 (docs only) |

---

*"The permission scape is the infrastructure that makes safe collaboration possible. Without it, multi-model collaboration is a free-for-all. With it, each model operates within defined boundaries."* — Bridgebuilder, The Permission Scape

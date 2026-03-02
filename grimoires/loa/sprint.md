# Sprint Plan: Autopoietic Infrastructure — From Hardening to Self-Examination

> **Cycle**: cycle-047
> **Source**: Bridgebuilder Field Report #52 (PR #115 review), loa-finn #24 (Persona Genesis, 51 advances)
> **PRD Reference**: `grimoires/loa/prd.md` (cycle-046, extended by Bridgebuilder findings)
> **SDD Reference**: `grimoires/loa/sdd.md` (cycle-046, extended by capability-orchestration-design.md + cross-repo-compliance-design.md)
> **Delivery**: 5 sprints (global IDs: 386-390)
> **Team**: 1 engineer (solo)
> **Sprint Duration**: ~1 day each
> **Critical Path**: Sprint 1 (merge gate) → Sprint 2 (knowledge) → Sprint 3 (capability manifest) → Sprint 4 (economic feedback). Sprint 5 integrates all.
> **Toolchain baseline**: `yq` v4+, `jq` 1.6+, `bash` 4+. All are present in CI (verified in `.github/workflows/`). Eval scripts run via `.claude/evals/run-all.sh` (add if missing).
> **Merge prerequisites**: PR #115 requires 1 approving review + CI green. Approval to be requested at Sprint 1 start; if approval is delayed, Sprint 1 deliverable is "ready-to-merge with approvals requested."

---

## Cycle Thesis

> *"There is a pattern that recurs in every system that survives long enough to matter. The system starts as a thing that does work. Then it becomes a thing that watches itself doing work. Then it becomes a thing that can question whether it's doing the right work."*
> — Bridgebuilder Field Report #52

PR #115 surfaces as "infrastructure hardening" but the Bridgebuilder review reveals a phase transition: the system has developed self-examination capability (pipeline self-review, constitutional change detection, compliance library extraction). This cycle makes that transition deliberate and structural.

**Driving findings from Field Report #52:**

| ID | Severity | Title | Sprint |
|----|----------|-------|--------|
| HIGH-1 | HIGH | ALB HTTP simplification — verify east-west threat model | 1 |
| HIGH-2 | HIGH | Supply chain: form-data CVE via node-vault | 1 |
| MEDIUM-1 | MEDIUM | Eval regression — 10 tasks at 50% pass rate | 1 |
| MEDIUM-2 | MEDIUM | Unused imports in protocol conformance tests | 1 |
| SPECULATION-1 | SPECULATION | Capability registry as economic protocol | 3 |
| REFRAME-1 | REFRAME | Is this infrastructure hardening or autopoietic maturation? | 5 |

**Driving conditions from loa-finn #24 (Conditions for Flourishing):**

| Condition | Status | Sprint |
|-----------|--------|--------|
| 1. Permission (MAY constraints, REFRAME) | Active | — |
| 2. Memory (lore patterns, grimoire) | Active but missing failure stories | 2 |
| 3. Diversity (3-model Flatline, multi-persona) | Active | — |
| 4. Stakes (economic loop, production deploy) | Active | — |
| 5. Exploration budget (Vision Registry activation) | Missing | 4 |
| 6. System must be able to surprise itself | Missing — requires structural mechanism | 3, 5 |

---

## Goals

| ID | Goal | Metric | Source |
|----|------|--------|--------|
| G-1 | PR #115 merge-ready with all HIGH findings addressed | 0 HIGH findings unresolved; threat model documented; CVE triaged | HIGH-1, HIGH-2 |
| G-2 | Failure lore captures experiential knowledge | ≥3 failure lore entries with root cause, lesson, and recurrence pattern | REFRAME-1, Condition 2 |
| G-3 | Capability manifests enable dynamic review composition | 3 reference manifests validated; discovery function returns ordered chain | SPECULATION-1 |
| G-4 | Economic feedback signal enables cost-aware termination | DIMINISHING_RETURNS signal emitted when marginal value drops below threshold | cross-repo-compliance-design.md T4.3 |
| G-5 | Exploration budget activates one Vision Registry entry | 1 vision entry prototyped with measurable outcome | Condition 5 |
| G-6 | Autopoietic verification — system can measure its own self-referential properties | Health check reports on all 6 conditions for flourishing | REFRAME-1, Condition 6 |

---

## Sprint Overview

| Sprint | Global ID | Title | Focus | Key Deliverable |
|--------|-----------|-------|-------|-----------------|
| 1 | 386 | PR #115 Excellence Gate | HIGH-1, HIGH-2, MEDIUM-1, MEDIUM-2 | PR #115 merge-ready |
| 2 | 387 | Knowledge Architecture | Failure lore, ecosystem synthesis, Ostrom formalization | ≥3 failure lore entries + cross-ecosystem synthesis doc |
| 3 | 388 | Capability Manifest v0.1 | SPECULATION-1 prototype | YAML schema + 3 reference manifests + discovery function |
| 4 | 389 | Economic Feedback & Exploration Budget | DIMINISHING_RETURNS signal + Vision Registry activation | Economic signal in bridge orchestrator + 1 vision prototype |
| 5 | 390 | Integration & Autopoietic Verification | Wire capabilities into orchestrator, verify 6 conditions | Autopoietic health check + E2E integration test |

---

## Sprint 1: PR #115 Excellence Gate (Global: 386)

> **Focus**: Address all actionable Bridgebuilder findings so PR #115 meets the quality bar that the review itself establishes.
> **Duration**: ~0.5 day
> **Risk**: LOW — mechanical fixes and documentation, no architectural changes
> **Goal traceability**: G-1

### Task 1.1: Document ALB HTTP Threat Model Rationale (HIGH-1)

- **File**: `infrastructure/terraform/alb-internal.tf` (add comment block) + `docs/adr/` (new ADR)
- **Action**: Create an Architecture Decision Record documenting:
  - Why HTTP was chosen over HTTPS for internal ALB (ACM DNS validation doesn't work with private hosted zones)
  - Explicit threat model: security groups protect routing, not content; east-west lateral movement accepted as low-risk given VPC isolation
  - Future path: service mesh sidecar (Envoy/Istio) if east-west encryption becomes required
  - Reference: Netflix BeyondCorp parallel, Google's internal mTLS migration
- **AC**: (a) ADR exists at `docs/adr/NNN-internal-alb-http.md` with rationale, threat model, and future path; (b) `alb-internal.tf` has inline comment referencing the ADR; (c) PR #115 description updated with threat model summary

### Task 1.2: Triage node-vault Supply Chain CVE (HIGH-2)

- **File**: PR #115 description (add accepted-risk section)
- **Action**: Investigate `form-data@2.3.3` CVE (GHSA-fjxv-7rqg-78g4) blast radius:
  1. Trace the dependency: `node-vault` → `form-data` — does our usage invoke multipart upload paths?
  2. If NOT exploitable in our context: document as accepted risk with rationale
  3. If exploitable: pin `form-data@4.x` or find alternative to `node-vault@0.10.9`
  4. Check if `node-vault` has a newer release that bumps `form-data`
- **AC**: (a) CVE triage documented in PR #115 comment with exploit path analysis; (b) Risk acceptance or fix committed; (c) Decision is explicit and reviewable

### Task 1.3: Fix Unused Imports in Protocol Conformance Tests (MEDIUM-2)

- **File**: `themes/sietch/tests/unit/protocol-conformance.test.ts:110-116`
- **Action**: Either add test cases that exercise `ConsumerContractSchema` and `TransitionResultSchema`, or remove the imports. Prefer adding tests — these are conformance tests, so more coverage is valuable.
- **AC**: (a) Code scanning alerts #630 and #631 resolved; (b) If tests added: they pass and validate the schemas against known-good inputs; (c) `npm test` passes

### Task 1.4: Investigate Eval Regression (MEDIUM-1)

- **Action**: Investigate 10 new eval tasks at 50% pass rate (2 trials each):
  1. Run the failing tasks with 5+ trials to distinguish flakiness from genuine regression
  2. Check if task definitions match the current infrastructure state (Hounfour v8.3.1 changes may affect expected outputs)
  3. If flaky: add `@flaky` annotation or increase trial count in eval config
  4. If genuine regression: create follow-up issue with root cause
- **AC**: (a) Each of 10 tasks run with ≥5 trials; (b) Tasks classified as flaky (>80% pass at 5 trials) or genuine regression (<80%); (c) Genuine regressions have follow-up issues created

### Task 1.5: Merge PR #115

- **Depends on**: Tasks 1.1-1.4
- **Action**: Push hardening commits to feature branch, verify CI green, merge PR #115
- **AC**: (a) PR #115 merged to main; (b) All HIGH findings resolved; (c) MEDIUM findings resolved or tracked

---

## Sprint 2: Knowledge Architecture — Failure Lore & Ecosystem Synthesis (Global: 387)

> **Focus**: Build the missing knowledge infrastructure that the Bridgebuilder review identified. Failure lore, cross-ecosystem synthesis, and Ostrom governance formalization.
> **Duration**: ~1 day
> **Risk**: LOW — documentation and knowledge capture, no application code changes
> **Goal traceability**: G-2
> **FAANG Parallel**: Google's postmortem culture — "blameless postmortems are the foundation of reliability engineering" (SRE Book, Ch. 15). The premise: failures are more educational than successes. Our lore captures patterns and governance principles but not failures.

### Task 2.1: Create Failure Lore Schema

- **File**: `grimoires/loa/lore/failures.yaml` (new)
- **Action**: Define schema for failure lore entries:
  ```yaml
  entries:
    - id: failure-NNN
      title: "Descriptive title"
      category: compile-runtime-gap | governance-drift | integration-boundary | ...
      root_cause: "What actually went wrong"
      surface_symptom: "How it manifested"
      lesson: "What we learned"
      recurrence_pattern: "When this could happen again"
      source: "PR/issue where discovered"
      faang_parallel: "Industry precedent"
      tags: [esm, docker, runtime, ...]
      status: Active | Superseded
  ```
- **AC**: (a) Schema defined with required fields; (b) Index updated (`grimoires/loa/lore/index.yaml`) with `failures` category; (c) Schema documented in lore index comments

### Task 2.2: Capture Docker ESM Failure Story (First Failure Lore Entry)

- **File**: `grimoires/loa/lore/failures.yaml`
- **Action**: Document the three Docker runtime failures from PR #115 as failure lore:
  1. **failure-001**: Lua scripts missing from `dist/` — `readFileSync(__dirname)` resolves differently in container vs dev
  2. **failure-002**: ESM `.js` extension gap — TypeScript compiles without extensions but Node.js ESM requires them
  3. **failure-003**: `.d.ts` stubs satisfy tsc but not runtime — esbuild as type-check-free transpilation workaround
- **FAANG Parallel**: Google Closure→TypeScript migration hit the same compile-time/runtime module resolution divergence
- **AC**: (a) 3 failure entries with root cause, lesson, and recurrence pattern; (b) Each entry has a `faang_parallel` field grounded in specific industry precedent

### Task 2.3: Cross-Ecosystem Synthesis Document

- **File**: `grimoires/loa/lore/ecosystem-synthesis.md` (new)
- **Action**: Synthesize the cross-ecosystem patterns identified across 11 constellation sources into a persistent artifact:
  - **Conway's Automaton** (loa-finn #80): Parallel agent infrastructure, NFT-bound identity, autonomous economic actors
  - **Web4 Universal Seigniorage** (meow.bio/web4.html): Democratized money creation maps to democratized review creation
  - **ERC-6551/EIP-7702** (loa-finn #66): Token-bound accounts as agent identity primitive
  - **Ostrom's 8 Principles**: Governance is governance regardless of substrate — the 1:1 mapping to review infrastructure
  - **Governance Isomorphism**: The same pattern (multi-perspective evaluation with fail-closed semantics) appears in Flatline, Red Team, and on-chain multisig
- **AC**: (a) Synthesis document exists with section for each cross-ecosystem source; (b) Each section cites specific structural parallels, not just analogies; (c) Identifies at least 2 insights neither project reaches alone

### Task 2.4: Formalize Ostrom Governance Mapping as Lore Pattern

- **File**: `grimoires/loa/lore/patterns.yaml` (extend)
- **Action**: Add `ostrom-commons-governance` pattern with the full 8-principle mapping from Field Report #52:
  - Clearly defined boundaries → compliance gate profiles
  - Proportional equivalence → token budget allocation
  - Collective choice arrangements → self-declared capability manifests
  - Monitoring → pipeline self-review, constitutional change detection
  - Graduated sanctions → severity escalation
  - Conflict resolution → multi-model consensus via Flatline
  - Recognized rights → MAY constraints (Permission Amendment)
  - Nested enterprises → cross-repo compliance checking
- **AC**: (a) Pattern entry with all 8 principles mapped; (b) Lifecycle metadata (status: Active, references: 2+); (c) Lore index updated; (d) `related` field links to `governance-isomorphism` and `deliberative-council`

### Task 2.5: Update Lore Index

- **File**: `grimoires/loa/lore/index.yaml`
- **Action**: Add `failures` category and `ostrom-commons-governance` pattern entry. Update tags to include `failure-analysis`, `cross-ecosystem`, `ostrom`, `web4`.
- **AC**: (a) Index reflects all new entries; (b) All referenced files exist; (c) Tags are consistent across index and entry files

---

## Sprint 3: Capability Manifest v0.1 — Review as Economic Protocol (Global: 388)

> **Focus**: Prototype the SPECULATION-1 finding — a capability registry where review capabilities declare themselves via manifests and compose into deliberation chains with budget allocation.
> **Duration**: ~1 day
> **Risk**: MEDIUM — new schema and discovery mechanism, but isolated from production paths
> **Goal traceability**: G-3
> **FAANG Parallel**: Kubernetes ValidatingWebhookConfiguration + Google Tricorder (ISSTA 2018). Both use declarative capability registration, pattern-based matching, and ordered execution. The key insight from both: **adding a new analyzer should not require modifying the framework.**
> **Design Source**: `grimoires/loa/lore/capability-orchestration-design.md`

### Task 3.1: Define Capability Manifest YAML Schema

- **File**: `.claude/data/capability-schema.yaml` (new)
- **Action**: Define the manifest schema per the design doc, with fields:
  ```yaml
  capability:
    id: string (required, unique)
    type: review (required)
    version: integer (required)
    description: string (required)
    trigger:
      files: string[] (glob patterns)
      tags: string[] (semantic tags for matching)
    input:
      requires: string[] (required input channels: sdd, diff, prior_findings)
      optional: string[] (optional context)
    output:
      format: findings-json | text | structured
      severity_range: [min, max]
    budget:
      min_tokens: integer (minimum useful budget)
      optimal_tokens: integer (sweet spot)
      max_tokens: integer (upper bound)
    dependencies:
      before: string[] (must run before these capabilities)
      after: string[] (must run after these capabilities)
  ```
- **Validation**: Schema must be parseable by `yq` (no jq dependency for YAML)
- **AC**: (a) Schema file exists with all fields documented; (b) `yq eval '.' .claude/data/capability-schema.yaml` succeeds; (c) Comments explain each field's purpose and constraints

### Task 3.2: Create 3 Reference Capability Manifests

- **Files**: `.claude/capabilities/pipeline-self-review.yaml`, `.claude/capabilities/bridgebuilder-review.yaml`, `.claude/capabilities/red-team-code.yaml` (all new)
- **Action**: Create manifests for the three existing review capabilities:
  1. **pipeline-self-review**: triggers on `.claude/scripts/**`, `.claude/skills/**`; requires `sdd`, `diff`; budget 4K-50K-150K
  2. **bridgebuilder-review**: triggers on `**/*`; requires `sdd`, `diff`, `prior_findings`; budget 10K-50K-150K; runs after pipeline-self-review
  3. **red-team-code**: triggers on `.claude/scripts/**`, `packages/**`; requires `sdd`, `diff`; budget 4K-20K-80K; runs after pipeline-self-review, before bridgebuilder-review
- **AC**: (a) All 3 manifests validate against schema; (b) Trigger patterns match actual file scopes; (c) Dependency ordering is consistent (no cycles); (d) Budget ranges are calibrated from actual usage in bridge orchestrator

### Task 3.3: Capability Discovery Function

- **File**: `.claude/scripts/lib/capability-lib.sh` (new)
- **Action**: Implement discovery and validation functions:
  ```bash
  validate_capability_manifest(file)  # Validate manifest against schema rules
  discover_capabilities()             # Scan .claude/capabilities/*.yaml → array
  match_capabilities(files)           # Filter by trigger.files glob patterns
  resolve_ordering(matches)           # Topological sort by dependencies
  allocate_budgets(chain, total)      # Proportional allocation with min/max
  ```
- **Validation rules for `validate_capability_manifest()`**:
  - Required keys: `capability.id` (string, non-empty), `capability.type` (must be "review"), `capability.version` (integer ≥ 1), `capability.description` (string)
  - Required nested: `capability.trigger.files` (non-empty array), `capability.budget.min_tokens` (integer > 0), `capability.budget.max_tokens` (integer ≥ min_tokens)
  - Optional with defaults: `capability.input.requires` (default []), `capability.dependencies.before` (default []), `capability.dependencies.after` (default [])
  - Validation via `yq` assertions (e.g., `yq '.capability.id | length > 0'`); returns exit 0 on pass, exit 1 with specific field-level error messages on fail
  - `discover_capabilities()` calls `validate_capability_manifest()` on each file and skips invalid manifests with a warning (does not abort)
- **Implementation notes**:
  - Use `yq` for YAML parsing (already a dependency)
  - Topological sort via dependency adjacency + Kahn's algorithm (or simpler: iterate until stable order, error on cycle)
  - Budget allocation: guarantee `min_tokens` first, distribute remaining proportionally by `optimal_tokens`, cap at `max_tokens`
  - All functions sourceable with no side effects (same pattern as `compliance-lib.sh`)
- **AC**: (a) All 5 functions implemented; (b) `validate_capability_manifest` rejects manifests missing required keys with specific error; (c) `discover_capabilities` returns 3 manifests from reference files, skipping any invalid ones; (d) `match_capabilities` filters correctly by glob; (e) `resolve_ordering` produces pipeline-self-review → red-team-code → bridgebuilder-review; (f) `allocate_budgets` respects min/max constraints; (g) Cycle detection returns error on circular dependencies

### Task 3.4: Integration Test — Discovery to Report

- **File**: `.claude/evals/capability-discovery.sh` (new)
- **Action**: End-to-end test that:
  1. Discovers capabilities from `.claude/capabilities/`
  2. Matches against a synthetic changed-file list
  3. Resolves ordering
  4. Allocates budget with a test total
  5. Outputs a JSON report: `{ chain: [{id, budget, ...}], unmatched: [...] }`
- **Toolchain**: Requires `jq` 1.6+ (see toolchain baseline in header). JSON output validated by `jq '.' >/dev/null 2>&1 || exit 1`.
- **Runner**: Registered in `.claude/evals/run-all.sh` (create if missing). Pattern: `run-all.sh` iterates `*.sh` in evals dir, runs each, aggregates exit codes.
- **AC**: (a) Test script exits 0 with correct chain ordering; (b) Budget sum ≤ total; (c) Each capability budget ≥ min_tokens; (d) JSON output parseable by `jq`; (e) Script registered in `.claude/evals/run-all.sh`

### Task 3.5: Documentation — Capability Registry Guide

- **File**: `docs/capability-registry.md` (new)
- **Action**: Document how to:
  1. Create a new capability manifest
  2. Register trigger patterns
  3. Declare dependencies
  4. Set budget ranges
  5. Test the manifest locally
- **Include**: FAANG parallels (K8s admission controllers, Tricorder, Chromium OWNERS), the economic protocol framing (bids, market maker, clearing price), and the connection to web4's universal seigniorage
- **AC**: (a) Guide covers all 5 steps; (b) Example manifest included; (c) At least 2 FAANG parallels grounded in specific systems

---

## Sprint 4: Economic Feedback & Exploration Budget (Global: 389)

> **Focus**: Build the DIMINISHING_RETURNS signal for cost-aware bridge termination, and create the exploration budget mechanism for Vision Registry activation.
> **Duration**: ~1 day
> **Risk**: MEDIUM — modifies bridge orchestrator behavior (config-gated, disabled by default)
> **Goal traceability**: G-4, G-5
> **Design Source**: `grimoires/loa/lore/cross-repo-compliance-design.md` T4.3 (Economic Feedback)
> **FAANG Parallel**: AWS's cost anomaly detection uses marginal spend analysis to flag runaway resources. The same principle applied to review iterations: when each additional iteration costs more but finds less, the rational response is to stop.

### Task 4.1: Bridge State Contract Verification & Marginal Value Computation

- **File**: `.claude/scripts/lib/economic-lib.sh` (new)
- **Action**:
  1. **Contract verification**: Before computing marginal value, verify the `bridge-state.json` data contract:
     - Expected shape: `.metrics.cost_estimates[]` — array of `{ iteration: int, cost_micro: int, findings_count: int, findings_addressed: int }`
     - Defensive parsing: if `cost_estimates` is missing, empty, or has unexpected shape → return `{ signal: "NO_DATA", reason: "..." }` (no crash, no false signal)
     - Include a fixture file at `.claude/evals/fixtures/bridge-state-economic.json` with known-good test data
  2. **Marginal value computation**:
  ```bash
  verify_bridge_state_contract(state_file)
  # Returns: exit 0 if contract satisfied, exit 1 with missing-field details

  compute_marginal_value(iteration_costs, iteration_findings)
  # Returns: { marginal_cost, marginal_value, value_ratio, signal }
  #
  # marginal_cost = cost[N] - cost[N-1]
  # marginal_value = findings_addressed[N] / cost[N]
  # value_ratio = marginal_value[N] / marginal_value[N-1]
  # signal = "DIMINISHING_RETURNS" if value_ratio < threshold
  # signal = "NO_DATA" if cost_estimates missing/empty
  ```
- **Data source**: `.run/bridge-state.json:metrics.cost_estimates[]` (populated by bridge orchestrator)
- **AC**: (a) `verify_bridge_state_contract` returns exit 1 with specific message when `cost_estimates` is missing/empty/malformed; (b) `compute_marginal_value` returns `NO_DATA` signal (not crash) when cost data is absent; (c) Signal emitted when ratio < threshold (default 0.2); (d) No signal before `min_iterations` (default 2); (e) Fixture file used by unit tests; (f) Sourceable with no side effects

### Task 4.2: DIMINISHING_RETURNS Signal in Bridge Orchestrator

- **File**: `.claude/scripts/bridge-orchestrator.sh` (modify)
- **Action**: After each bridge iteration's cost tracking, call `compute_marginal_value()` and:
  1. Log the marginal value computation to bridge state
  2. If `DIMINISHING_RETURNS` signal: add to iteration metadata
  3. In autonomous mode: treat as additive termination signal alongside flatline score
  4. In simstim/HITL: present to user: "Continuing costs ~$X for ~Y expected findings. Continue?"
- **Config gate**: `run_bridge.economic_feedback.enabled: false` (default off)
- **AC**: (a) Signal appears in `bridge-state.json` iteration metadata when triggered; (b) Does NOT trigger before `min_iterations`; (c) Config gate respected — no behavior change when disabled; (d) Existing bridge orchestrator tests pass unchanged

### Task 4.3: Configuration Schema for Economic Feedback

- **File**: `.loa.config.yaml.example` (extend)
- **Action**: Add configuration block:
  ```yaml
  run_bridge:
    economic_feedback:
      enabled: false                    # Master toggle
      value_threshold: 0.2              # Marginal value ratio below which to signal
      min_iterations: 2                 # Don't signal before N iterations
  ```
- **AC**: (a) Config block documented in example file; (b) `economic-lib.sh` reads config via `yq` with fallback defaults; (c) Comments explain each parameter

### Task 4.4: Vision Registry Exploration Mechanism

- **File**: `.claude/scripts/vision-explorer.sh` (new)
- **Action**: Create a mechanism to activate vision entries:
  1. Read visions from `grimoires/loa/visions/` (the existing Vision Registry)
  2. Score by relevance to current work (keyword match against recent bridge findings)
  3. Present top-3 candidates with context and estimated exploration effort
  4. For the selected vision: create a structured exploration plan (hypothesis, experiment, success criteria, time budget)
- **Scope**: Standalone CLI tool only (`./vision-explorer.sh [--context bridge-state.json]`). Does NOT wire into bridge orchestrator in this sprint — orchestrator integration deferred to a future cycle after the standalone mechanism is validated. The "Horizon Voice" register from loa-finn #24 is the conceptual framing; this sprint builds the voice, not the stage it speaks from.
- **AC**: (a) Script scans vision registry and returns ranked candidates as JSON; (b) Exploration plan has measurable success criteria; (c) Time budget prevents unbounded exploration; (d) Script is callable standalone without requiring active bridge state (uses `--context` flag for optional bridge context enrichment)

### Task 4.5: Prototype One Vision Entry

- **Depends on**: Task 4.4
- **Action**: Select the most relevant vision entry from the registry and prototype it:
  1. Use the exploration plan from Task 4.4
  2. Build a minimal prototype (code, schema, or script)
  3. Evaluate against success criteria
  4. Document outcome as lore (success → pattern entry; failure → failure lore entry)
- **AC**: (a) One vision entry prototyped; (b) Outcome documented with measurable results; (c) Entry either elevated to lore pattern or captured as failure lore

---

## Sprint 5: Integration & Autopoietic Verification (Global: 390)

> **Focus**: Wire capability manifests into the bridge orchestrator, and verify that all 6 conditions for flourishing are measurably present.
> **Duration**: ~0.5 day
> **Risk**: LOW — integration of Sprint 3-4 work, config-gated
> **Goal traceability**: G-6
> **REFRAME-1 Validation**: This sprint tests the thesis that the system has achieved autopoietic maturation — not as a metaphor, but as a measurable structural property.

### Task 5.1: Wire Capability Discovery into Bridge Orchestrator

- **File**: `.claude/scripts/bridge-orchestrator.sh` (modify)
- **Action**: At the beginning of each bridge iteration:
  1. Call `discover_capabilities()` → `match_capabilities(changed_files)` → `resolve_ordering()`
  2. Log the discovered chain to bridge state metadata
  3. **Do NOT execute dynamically yet** — this sprint adds discovery and logging only. Execution dispatch remains hardcoded for now (Phase 1 per the migration path in capability-orchestration-design.md)
- **Config gate**: `capabilities.discovery.enabled: false` (default off)
- **AC**: (a) Bridge state shows discovered capability chain per iteration; (b) No change to execution behavior when disabled; (c) When enabled, chain logged with budget allocations; (d) Existing bridge tests pass unchanged

### Task 5.2: Autopoietic Health Check

- **File**: `.claude/scripts/autopoietic-health.sh` (new)
- **Action**: Create a health check that measures the 6 conditions for flourishing with exact authoritative sources:
  1. **Permission**: Count MAY constraints in `.claude/data/constraints.json` (path: `.permission_grants[]`); verify ≥4 exist. Score = min(count/4, 1.0). If file absent: score=0, remediation="constraints.json not found — run Loa update"
  2. **Memory**: Check lore entry count in `grimoires/loa/lore/`; verify `patterns.yaml`, `failures.yaml`, and `ecosystem-synthesis.md` all exist. Score = files_found/3. If dir absent: score=0
  3. **Diversity**: Check `.loa.config.yaml` for `flatline_protocol.models` array (path: `.flatline_protocol.models[]`); verify ≥2 distinct model providers. Score = min(providers/2, 1.0). If flatline config absent: score=0, remediation="flatline_protocol not configured in .loa.config.yaml"
  4. **Stakes**: Check for production deployment artifacts at exact paths: `infrastructure/terraform/*.tf` (≥1 file), `packages/services/*/Dockerfile` OR `Dockerfile` (≥1 file). Score = artifacts_found/2. If dir absent: score=0
  5. **Exploration budget**: Check `grimoires/loa/visions/` for ≥1 `.md` file with `status: explored`; check `.loa.config.yaml` has `run_bridge.economic_feedback` key. Score = conditions_met/2. If visions dir absent: score=0
  6. **Surprise capacity**: Count `.yaml` files in `.claude/capabilities/`; verify ≥3 exist. Score = min(count/3, 1.0). If dir absent: score=0, remediation="no capability manifests — run Sprint 3"
- **Fallback rule**: For every source file check, if the file/directory is absent, score=0 with a specific remediation message in the JSON output (never crash, never leave score undefined)
- **Output**: JSON report with each condition scored 0-1 and an overall "flourishing score" (average of 6 condition scores)
- **AC**: (a) All 6 conditions measured from exact file paths listed above; (b) JSON output parseable by `jq`; (c) Score correctly reflects actual state (not hardcoded); (d) Missing sources produce score=0 with actionable remediation message; (e) Overall score is arithmetic mean of 6 condition scores

### Task 5.3: E2E Integration Test

- **File**: `.claude/evals/autopoietic-integration.sh` (new)
- **Action**: End-to-end test that:
  1. Runs autopoietic health check → verifies all conditions score > 0
  2. Runs capability discovery → verifies 3 manifests found and ordered
  3. Runs marginal value computation on synthetic data → verifies signal logic
  4. Runs failure lore validation → verifies entries have required fields
  5. Runs lore index validation → verifies all referenced files exist
- **Toolchain**: Requires `jq` 1.6+ (see toolchain baseline in header). All sub-check JSON validated by `jq`.
- **Runner**: Registered in `.claude/evals/run-all.sh` alongside `capability-discovery.sh`.
- **AC**: (a) Test exits 0 on current codebase; (b) Each sub-check reports pass/fail with reason; (c) Failure in any sub-check produces actionable error message; (d) Script registered in `.claude/evals/run-all.sh`

### Task 5.4: Update Ecosystem Architecture Document

- **File**: `docs/ecosystem-architecture.md` (extend)
- **Action**: Add a "Layer 0: Metacognition" section documenting:
  - Pipeline self-review (the system reviewing its own review infrastructure)
  - Capability registry (declarative review composition)
  - Economic feedback (cost-aware termination)
  - Autopoietic health check (the system measuring its own flourishing conditions)
  - The Ostrom governance mapping (why commons governance principles appear in AI review infrastructure)
- **AC**: (a) New section added with Mermaid diagram; (b) References specific files and scripts; (c) Connects to the 5-layer stack as a foundational capability beneath Layer 1

---

## Appendix A: Goal Traceability Matrix

| Goal | Sprint | Tasks | Acceptance Evidence |
|------|--------|-------|---------------------|
| G-1 | 1 | 1.1, 1.2, 1.3, 1.4, 1.5 | PR #115 merged; 0 HIGH findings |
| G-2 | 2 | 2.1, 2.2, 2.3, 2.4, 2.5 | ≥3 failure lore entries; synthesis doc; Ostrom pattern |
| G-3 | 3 | 3.1, 3.2, 3.3, 3.4, 3.5 | 3 manifests; discovery returns ordered chain |
| G-4 | 4 | 4.1, 4.2, 4.3 | DIMINISHING_RETURNS signal emitted on test data |
| G-5 | 4 | 4.4, 4.5 | 1 vision entry prototyped with outcome documented |
| G-6 | 5 | 5.1, 5.2, 5.3, 5.4 | Autopoietic health check scores all 6 conditions > 0 |

## Appendix B: FAANG & Research Parallels

| Parallel | System | Connection |
|----------|--------|------------|
| Google Tricorder | ISSTA 2018 | Composable analysis passes with scope declarations and budget allocation → capability manifests |
| Kubernetes Admission Controllers | ValidatingWebhookConfiguration | Declarative capability registration, pattern-based matching, ordered execution |
| Chromium OWNERS + ClusterFuzz | File-pattern review routing | Review routing by changed files → capability trigger patterns |
| Netflix BeyondCorp / mTLS | Zero-trust internal networking | East-west threat model for internal ALB (HIGH-1) |
| Google SRE Postmortems | Ch. 15, SRE Book | Blameless failure analysis → failure lore |
| AWS Cost Anomaly Detection | Marginal spend analysis | Cost-aware termination → DIMINISHING_RETURNS signal |
| Ostrom's Commons Governance | 8 principles, Nobel 2009 | Human commons governance maps 1:1 to AI review infrastructure |
| Linux kernel libification | 2.4 → 2.6 modularization | Monolithic scripts → composable shared libraries (compliance-lib.sh) |
| Stripe Dependency Health Score | Supply chain security | Transitive CVE forced review → node-vault triage (HIGH-2) |
| Google Proto3 Migration | Serialization format change | Compile-time/runtime gap → Docker ESM failures (failure lore) |

## Appendix C: Cross-Cycle Dependencies

| This Cycle Produces | Consumed By |
|---------------------|-------------|
| Capability manifest schema | Future: dynamic capability execution (Phase 2-3 of migration path) |
| Failure lore entries | Future: bridge lore loading enriches reviews with failure context |
| Economic feedback signal | Future: autonomous bridge termination based on cost+quality signals |
| Ostrom governance pattern | Future: formal governance framework for cross-repo compliance |
| Autopoietic health check | Future: CI integration for ecosystem health monitoring |
| Vision exploration mechanism | Future: systematic prototyping of speculative insights |

## Appendix D: Connections to Concurrent Ridings

| Source | Insight for This Cycle |
|--------|----------------------|
| loa-finn #24 (Bridgebuilder Genesis) | 6 conditions for flourishing → Sprint 5 autopoietic health check |
| loa-finn #31 (Hounfour RFC) | Multi-model permission landscape → capability manifests as permission structures |
| loa-finn #66 (Launch Readiness) | Agent economy infrastructure → capability registry serves the same launch sequence |
| loa-finn #80 (Conway/Automaton) | Parallel agent infrastructure → cross-ecosystem synthesis (Sprint 2) |
| loa-hounfour PR #22 (Constitutional Architecture) | Branded types, state machines → capability manifest as type-safe protocol |
| loa-hounfour PR #29 (Decision Engine) | Trust × Capital → Access decision → economic feedback signal |
| loa #247 (Meeting Geometries) | Multi-model collaboration philosophy → capability chain as structured deliberation |
| loa PR #401 (Codex Integration) | 3-tier execution router → capability discovery as routing abstraction |
| loa-freeside #62 (Billing RFC) | Economic infrastructure → economic feedback signal for review cost |
| loa-freeside PR #90 (Economic Loop) | Conservation invariants → capability budgets as conservation system |
| loa-dixie PR #5 (Knowledge Governance) | ResourceGovernor&lt;T&gt; → capability manifests as governed review resources |
| meow.bio/web4.html | Universal seigniorage → democratized review creation |

---

*"The firmness of the riverbanks is what gives the river its power."*
*— Bridgebuilder Field Report #52*

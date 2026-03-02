# Sprint Plan: Bridge Iteration 2 — Findings Remediation

> **Cycle**: cycle-047 (iteration 2)
> **Source**: Bridgebuilder Review `bridge-20260302-2ccafc` iteration 1
> **Findings Addressed**: 3 MEDIUM, 2 LOW (severity score: 8)
> **Delivery**: 1 sprint (global ID: 391)
> **Team**: 1 engineer (solo)
> **Sprint Duration**: ~2 hours
> **All fixes are in shell scripts — no application code changes.**

---

## Sprint 1: Correctness & Portability Fixes (Global Sprint 391)

### Task 1.1: Fix glob-to-regex conversion in capability matching

**Finding**: `medium-1` | **File**: `.claude/scripts/lib/capability-lib.sh:210`
**Severity**: MEDIUM | **Category**: correctness

The `match_capabilities()` function converts glob patterns to regex using a naive sed substitution that fails for:
- Regex metacharacters in patterns (dots, brackets, parentheses)
- `**` recursive glob (becomes `[^/]*[^/]*` instead of `.*`)

**Implementation**:
- Create a `glob_to_regex()` helper function that:
  1. Escapes regex metacharacters first (`.`, `(`, `)`, `[`, `]`, `{`, `}`, `+`, `^`, `$`, `|`)
  2. Converts `**` → `.*` (recursive match)
  3. Converts `*` → `[^/]*` (single-segment match)
  4. Converts `?` → `[^/]` (single char match)
- Replace the inline sed in `match_capabilities()` with `glob_to_regex()` call

**Acceptance Criteria**:
- [ ] `glob_to_regex "packages/**/foo.ts"` produces `packages/.*/foo\.ts`
- [ ] `glob_to_regex "*.yaml"` produces `[^/]*\.yaml`
- [ ] `glob_to_regex "packages/core/*.ts"` escapes no metacharacters (clean path)
- [ ] Dots in patterns are escaped: `glob_to_regex "foo.bar"` produces `foo\.bar`
- [ ] Existing capability-discovery eval still passes
- [ ] Note: Brace expansion (`{a,b}`) is out of scope — not used in current manifests

### Task 1.2: Use fixed-string grep for manifest lookup

**Finding**: `medium-2` | **File**: `.claude/scripts/lib/capability-lib.sh:271`
**Severity**: MEDIUM | **Category**: correctness

The `resolve_ordering()` function uses `grep -l "id: ${id}"` where `${id}` is interpolated as a regex pattern. IDs containing dots (e.g., `red.team.code`) would match unintended manifests.

**Implementation**:
- Change `grep -l "id: ${id}"` to `grep -Fl "id: ${id}"` (fixed string matching)
- Apply same fix to any other grep calls using capability IDs

**Acceptance Criteria**:
- [ ] `grep -Fl` used for all capability ID lookups
- [ ] Existing capability-discovery eval still passes

### Task 1.3: Configurable base branch in bridge orchestrator

**Finding**: `medium-3` | **File**: `.claude/scripts/bridge-orchestrator.sh:397`
**Severity**: MEDIUM | **Category**: portability

The capability discovery block hardcodes `main` as the base branch for `git diff`. This is a portability issue for repos with different default branch names.

**Implementation**:
- Add `base_branch` variable at orchestrator init, loaded from config:
  ```bash
  BASE_BRANCH=$(yq '.run_bridge.base_branch // "main"' "$CONFIG_FILE" 2>/dev/null || echo "main")
  ```
- Replace hardcoded `"main...HEAD"` in the capability discovery block with `"${BASE_BRANCH}...HEAD"`
- Scope change to the new capability discovery block only (pre-existing hardcoding is out of scope for this iteration)

**Acceptance Criteria**:
- [ ] Capability discovery uses `$BASE_BRANCH` instead of hardcoded `main`
- [ ] Default value is `"main"` when config key is missing
- [ ] Existing evals pass

### Task 1.4: Remainder distribution in budget allocator

**Finding**: `low-1` | **File**: `.claude/scripts/lib/capability-lib.sh:419`
**Severity**: LOW | **Category**: correctness

Integer division in proportional budget allocation truncates, leaving tokens unallocated. Add a remainder distribution step after proportional allocation.

**Implementation**:
- After the proportional allocation loop, compute `remainder = total - sum(allocations)`
- Distribute remainder using a deterministic loop:
  ```
  while remainder > 0:
    distributed_this_pass = false
    for id in ids (priority order):
      if allocated[id] < max[id] and remainder > 0:
        allocated[id] += 1
        remainder -= 1
        distributed_this_pass = true
    if not distributed_this_pass:
      break  # all at max, drop remainder (document this)
  ```
- Add a comment documenting the rounding behavior and the edge case where all capabilities are at max

**Acceptance Criteria**:
- [ ] `allocate_budgets()` distributes all available tokens (sum == total budget) when headroom exists
- [ ] No capability exceeds its max_tokens
- [ ] Edge case: when top capability is at max, remainder flows to next capability
- [ ] Edge case: when all at max, remainder is dropped (documented)
- [ ] Existing capability-discovery eval passes

### Task 1.5: Principled surprise_capacity scoring

**Finding**: `low-2` | **File**: `.claude/scripts/autopoietic-health.sh:253`
**Severity**: LOW | **Category**: design

The surprise_capacity condition scores based on count ≥ 3 manifests, which is arbitrary and invites Goodhart's Law gaming. Replace with a principled binary check.

**Implementation**:
- Change scoring to: `score = (count > 0) ? 1.0 : 0.0`
- A non-empty capability registry demonstrates surprise capacity; count is informational only
- Update the detail JSON to include count as metadata, not as threshold input
- Update autopoietic-integration eval to match new scoring

**Acceptance Criteria**:
- [ ] Score is 1.0 when any manifests exist, 0.0 when none exist
- [ ] Count still reported in detail JSON for observability
- [ ] Autopoietic integration eval passes with updated expectations

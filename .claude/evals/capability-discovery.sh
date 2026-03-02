#!/usr/bin/env bash
# =============================================================================
# capability-discovery.sh — End-to-end test for capability manifest system
# =============================================================================
# Part of: Capability Manifest v0.1 (cycle-047, Sprint 388 Task 3.4)
#
# Tests the full pipeline: discover → match → order → budget → JSON report.
# Uses the 3 reference manifests in .claude/capabilities/.
#
# Dependencies: yq v4+, jq 1.6+, bash 4+
# Runner: Registered in .claude/evals/run-all.sh
#
# Exit codes:
#   0 — All tests pass
#   1 — Test failure (details on stderr)
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source the capability library
source "$REPO_ROOT/.claude/scripts/lib/capability-lib.sh"

PASS=0
FAIL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label — expected '$expected', got '$actual'" >&2
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle" 2>/dev/null; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label — '$needle' not found in output" >&2
    FAIL=$((FAIL + 1))
  fi
}

assert_true() {
  local label="$1" exit_code="$2"
  if [[ "$exit_code" -eq 0 ]]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label — expected success, got exit $exit_code" >&2
    FAIL=$((FAIL + 1))
  fi
}

assert_false() {
  local label="$1" exit_code="$2"
  if [[ "$exit_code" -ne 0 ]]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label — expected failure, got exit 0" >&2
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Capability Discovery Integration Test ==="
echo ""

# ---- Test 1: Validation ----
echo "--- Test 1: validate_capability_manifest ---"

validate_capability_manifest "$REPO_ROOT/.claude/capabilities/pipeline-self-review.yaml" 2>/dev/null; rc=$?
assert_true "pipeline-self-review validates" "$rc"

validate_capability_manifest "$REPO_ROOT/.claude/capabilities/bridgebuilder-review.yaml" 2>/dev/null; rc=$?
assert_true "bridgebuilder-review validates" "$rc"

validate_capability_manifest "$REPO_ROOT/.claude/capabilities/red-team-code.yaml" 2>/dev/null; rc=$?
assert_true "red-team-code validates" "$rc"

# Reject a non-existent file
validate_capability_manifest "/tmp/nonexistent-manifest.yaml" 2>/dev/null; rc=$?
assert_false "rejects nonexistent file" "$rc"

# Create and test an invalid manifest (missing required fields)
invalid_manifest="/tmp/test-invalid-cap-$$.yaml"
cat > "$invalid_manifest" << 'YAML'
capability:
  type: review
  version: 1
YAML
validate_capability_manifest "$invalid_manifest" 2>/dev/null; rc=$?
assert_false "rejects manifest missing required fields" "$rc"
rm -f "$invalid_manifest"

echo ""

# ---- Test 2: Discovery ----
echo "--- Test 2: discover_capabilities ---"

discovered=$(CAPABILITY_DIR="$REPO_ROOT/.claude/capabilities" discover_capabilities)
cap_count=$(echo "$discovered" | jq 'length')
assert_eq "discovers 3 capabilities" "3" "$cap_count"

assert_contains "discovers pipeline-self-review" "$discovered" "pipeline-self-review"
assert_contains "discovers bridgebuilder-review" "$discovered" "bridgebuilder-review"
assert_contains "discovers red-team-code" "$discovered" "red-team-code"

# Verify JSON is parseable
echo "$discovered" | jq '.' >/dev/null 2>&1; rc=$?
assert_true "discovery output is valid JSON" "$rc"

echo ""

# ---- Test 3: Matching ----
echo "--- Test 3: match_capabilities ---"

# Files that match pipeline-self-review and red-team-code
matched=$(CAPABILITY_DIR="$REPO_ROOT/.claude/capabilities" match_capabilities \
  ".claude/scripts/bridge-orchestrator.sh" \
  "packages/core/ports/chain-provider.ts")
assert_contains "matches pipeline-self-review for .claude/ files" "$matched" "pipeline-self-review"
assert_contains "matches red-team-code for packages/ files" "$matched" "red-team-code"
assert_contains "matches bridgebuilder-review (wildcard trigger)" "$matched" "bridgebuilder-review"

# Only application files — should NOT match pipeline-self-review
matched_app=$(CAPABILITY_DIR="$REPO_ROOT/.claude/capabilities" match_capabilities \
  "packages/core/ports/chain-provider.ts")
# bridgebuilder matches everything, red-team matches packages/**
assert_contains "matches red-team for packages/ only" "$matched_app" "red-team-code"
assert_contains "matches bridgebuilder for any file" "$matched_app" "bridgebuilder-review"

echo ""

# ---- Test 4: Ordering ----
echo "--- Test 4: resolve_ordering ---"

ordered=$(CAPABILITY_DIR="$REPO_ROOT/.claude/capabilities" resolve_ordering \
  "pipeline-self-review" "red-team-code" "bridgebuilder-review")

# Verify JSON
echo "$ordered" | jq '.' >/dev/null 2>&1; rc=$?
assert_true "ordering output is valid JSON" "$rc"

# Expected order: pipeline-self-review → red-team-code → bridgebuilder-review
first=$(echo "$ordered" | jq -r '.[0]')
second=$(echo "$ordered" | jq -r '.[1]')
third=$(echo "$ordered" | jq -r '.[2]')
assert_eq "first in chain: pipeline-self-review" "pipeline-self-review" "$first"
assert_eq "second in chain: red-team-code" "red-team-code" "$second"
assert_eq "third in chain: bridgebuilder-review" "bridgebuilder-review" "$third"

echo ""

# ---- Test 5: Budget Allocation ----
echo "--- Test 5: allocate_budgets ---"

total_budget=200000
budgets=$(CAPABILITY_DIR="$REPO_ROOT/.claude/capabilities" allocate_budgets "$total_budget" \
  "pipeline-self-review" "red-team-code" "bridgebuilder-review")

# Verify JSON
echo "$budgets" | jq '.' >/dev/null 2>&1; rc=$?
assert_true "budget output is valid JSON" "$rc"

# Check each budget >= min_tokens
psr_budget=$(echo "$budgets" | jq '.["pipeline-self-review"]')
rtc_budget=$(echo "$budgets" | jq '.["red-team-code"]')
bbr_budget=$(echo "$budgets" | jq '.["bridgebuilder-review"]')

[[ "$psr_budget" -ge 4000 ]]; rc=$?
assert_true "pipeline-self-review budget >= 4000 min" "$rc"

[[ "$rtc_budget" -ge 4000 ]]; rc=$?
assert_true "red-team-code budget >= 4000 min" "$rc"

[[ "$bbr_budget" -ge 10000 ]]; rc=$?
assert_true "bridgebuilder-review budget >= 10000 min" "$rc"

# Check sum <= total
budget_sum=$(( psr_budget + rtc_budget + bbr_budget ))
[[ "$budget_sum" -le "$total_budget" ]]; rc=$?
assert_true "budget sum ($budget_sum) <= total ($total_budget)" "$rc"

# Check no budget exceeds max
[[ "$psr_budget" -le 150000 ]]; rc=$?
assert_true "pipeline-self-review budget <= 150000 max" "$rc"

[[ "$rtc_budget" -le 80000 ]]; rc=$?
assert_true "red-team-code budget <= 80000 max" "$rc"

[[ "$bbr_budget" -le 150000 ]]; rc=$?
assert_true "bridgebuilder-review budget <= 150000 max" "$rc"

echo ""

# ---- Test 6: Full Chain Report ----
echo "--- Test 6: Full chain JSON report ---"

# Build the full report
chain_ids=$(CAPABILITY_DIR="$REPO_ROOT/.claude/capabilities" resolve_ordering \
  "pipeline-self-review" "red-team-code" "bridgebuilder-review")
chain_budgets=$(CAPABILITY_DIR="$REPO_ROOT/.claude/capabilities" allocate_budgets 200000 \
  "pipeline-self-review" "red-team-code" "bridgebuilder-review")

# Compose report JSON
report=$(jq -n \
  --argjson chain "$chain_ids" \
  --argjson budgets "$chain_budgets" \
  --arg total "$total_budget" \
  '{
    chain: [($chain[] as $id | {id: $id, budget: ($budgets[$id])})],
    total_budget: ($total | tonumber),
    allocated: ($budgets | to_entries | map(.value) | add),
    unmatched: []
  }')

echo "$report" | jq '.' >/dev/null 2>&1; rc=$?
assert_true "full report is valid JSON" "$rc"

report_chain_len=$(echo "$report" | jq '.chain | length')
assert_eq "report has 3 chain entries" "3" "$report_chain_len"

echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "FAIL: $FAIL test(s) failed" >&2
  exit 1
fi

echo "OK: All tests passed"
exit 0

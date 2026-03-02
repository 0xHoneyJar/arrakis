#!/usr/bin/env bash
# =============================================================================
# economic-lib.sh — Economic feedback signal for bridge iteration termination
# =============================================================================
# Part of: Economic Feedback (cycle-047, Sprint 389 Task 4.1)
# Design Source: grimoires/loa/lore/cross-repo-compliance-design.md T4.3
#
# Verifies the bridge-state.json data contract and computes marginal value
# of bridge iterations. Emits DIMINISHING_RETURNS signal when the cost per
# iteration exceeds the value per iteration.
#
# FAANG Parallel: AWS Cost Anomaly Detection — marginal spend analysis flags
# runaway resources. Same principle: when each additional iteration costs more
# but finds less, the rational response is to stop.
#
# Functions (all sourceable with no side effects):
#   verify_bridge_state_contract(state_file) — Validate cost_estimates shape
#   compute_marginal_value(state_file)       — Compute signal from iteration data
#
# Dependencies: jq 1.6+, yq v4+, bash 4+
#
# Usage:
#   source .claude/scripts/lib/economic-lib.sh
# =============================================================================

# Config defaults (overridden by .loa.config.yaml)
ECONOMIC_VALUE_THRESHOLD="${ECONOMIC_VALUE_THRESHOLD:-0.2}"
ECONOMIC_MIN_ITERATIONS="${ECONOMIC_MIN_ITERATIONS:-2}"

# -----------------------------------------------------------------------------
# _load_economic_config()
# Reads config from .loa.config.yaml with fallback defaults.
# -----------------------------------------------------------------------------
_load_economic_config() {
  local config_file=".loa.config.yaml"
  if [[ -f "$config_file" ]]; then
    local threshold
    threshold=$(yq eval '.run_bridge.economic_feedback.value_threshold // ""' "$config_file" 2>/dev/null)
    [[ -n "$threshold" && "$threshold" != "null" ]] && ECONOMIC_VALUE_THRESHOLD="$threshold"

    local min_iter
    min_iter=$(yq eval '.run_bridge.economic_feedback.min_iterations // ""' "$config_file" 2>/dev/null)
    [[ -n "$min_iter" && "$min_iter" != "null" ]] && ECONOMIC_MIN_ITERATIONS="$min_iter"
  fi
}

# Load config on source
_load_economic_config

# -----------------------------------------------------------------------------
# verify_bridge_state_contract(state_file)
# Validates that bridge-state.json has the expected cost_estimates shape.
# Returns exit 0 if contract satisfied, exit 1 with missing-field details.
# Output: JSON { "valid": bool, "errors": [...] } to stdout
# -----------------------------------------------------------------------------
verify_bridge_state_contract() {
  local state_file="${1:-.run/bridge-state.json}"
  local errors=()

  # File existence
  if [[ ! -f "$state_file" ]]; then
    echo '{"valid":false,"errors":["bridge-state.json not found at '"$state_file"'"]}'
    return 1
  fi

  # Valid JSON
  if ! jq '.' "$state_file" >/dev/null 2>&1; then
    echo '{"valid":false,"errors":["bridge-state.json is not valid JSON"]}'
    return 1
  fi

  # Check .metrics exists
  local has_metrics
  has_metrics=$(jq 'has("metrics")' "$state_file" 2>/dev/null)
  if [[ "$has_metrics" != "true" ]]; then
    echo '{"valid":false,"errors":[".metrics key missing from bridge-state.json"]}'
    return 1
  fi

  # Check .metrics.cost_estimates exists and is array
  local cost_type
  cost_type=$(jq '.metrics.cost_estimates | type' "$state_file" 2>/dev/null)
  if [[ "$cost_type" != '"array"' ]]; then
    echo '{"valid":false,"errors":[".metrics.cost_estimates missing or not an array (got '"$cost_type"')"]}'
    return 1
  fi

  # Check array is non-empty
  local cost_len
  cost_len=$(jq '.metrics.cost_estimates | length' "$state_file" 2>/dev/null)
  if [[ "$cost_len" -eq 0 ]]; then
    echo '{"valid":false,"errors":[".metrics.cost_estimates is empty array"]}'
    return 1
  fi

  # Check each entry has required fields
  local invalid_entries
  invalid_entries=$(jq '[.metrics.cost_estimates[] | select(
    (.iteration | type) != "number" or
    (.cost_micro | type) != "number" or
    (.findings_count | type) != "number" or
    (.findings_addressed | type) != "number"
  )] | length' "$state_file" 2>/dev/null)

  if [[ "$invalid_entries" -gt 0 ]]; then
    echo '{"valid":false,"errors":["'"$invalid_entries"' cost_estimates entries missing required fields (iteration, cost_micro, findings_count, findings_addressed)"]}'
    return 1
  fi

  echo '{"valid":true,"errors":[]}'
  return 0
}

# -----------------------------------------------------------------------------
# compute_marginal_value(state_file)
# Computes marginal value ratio and emits signal.
# Output: JSON { signal, marginal_cost, marginal_value, value_ratio, reason }
# Signals:
#   NO_DATA            — cost data absent or insufficient
#   HEALTHY            — value ratio above threshold
#   DIMINISHING_RETURNS — value ratio below threshold
# -----------------------------------------------------------------------------
compute_marginal_value() {
  local state_file="${1:-.run/bridge-state.json}"

  # Verify contract first
  local contract
  contract=$(verify_bridge_state_contract "$state_file" 2>/dev/null)
  local contract_valid
  contract_valid=$(echo "$contract" | jq -r '.valid' 2>/dev/null)

  if [[ "$contract_valid" != "true" ]]; then
    local reason
    reason=$(echo "$contract" | jq -r '.errors[0] // "unknown contract violation"' 2>/dev/null)
    echo '{"signal":"NO_DATA","marginal_cost":0,"marginal_value":0,"value_ratio":0,"reason":"'"$reason"'"}'
    return 0
  fi

  # Check iteration count against minimum
  local iteration_count
  iteration_count=$(jq '.metrics.cost_estimates | length' "$state_file")

  if [[ "$iteration_count" -lt "$ECONOMIC_MIN_ITERATIONS" ]]; then
    echo '{"signal":"NO_DATA","marginal_cost":0,"marginal_value":0,"value_ratio":0,"reason":"only '"$iteration_count"' iterations, need '"$ECONOMIC_MIN_ITERATIONS"' minimum"}'
    return 0
  fi

  # Compute marginal values using jq
  local result
  result=$(jq --arg threshold "$ECONOMIC_VALUE_THRESHOLD" '
    .metrics.cost_estimates | sort_by(.iteration) |
    . as $data |
    ($data | length) as $n |

    # Current and previous iteration
    $data[$n - 1] as $curr |
    $data[$n - 2] as $prev |

    # Marginal cost
    ($curr.cost_micro - $prev.cost_micro) as $marginal_cost |

    # Marginal value: findings_addressed per cost unit
    (if $curr.cost_micro > 0 then ($curr.findings_addressed / $curr.cost_micro) else 0 end) as $curr_value |
    (if $prev.cost_micro > 0 then ($prev.findings_addressed / $prev.cost_micro) else 0 end) as $prev_value |

    # Value ratio
    (if $prev_value > 0 then ($curr_value / $prev_value) else 0 end) as $value_ratio |

    # Signal
    (if $value_ratio < ($threshold | tonumber) then "DIMINISHING_RETURNS"
     else "HEALTHY"
     end) as $signal |

    {
      signal: $signal,
      marginal_cost: $marginal_cost,
      marginal_value: $curr_value,
      value_ratio: $value_ratio,
      reason: (if $signal == "DIMINISHING_RETURNS"
               then "value_ratio \($value_ratio) < threshold \($threshold)"
               else "value_ratio \($value_ratio) >= threshold \($threshold)"
               end)
    }
  ' "$state_file")

  echo "$result"
  return 0
}

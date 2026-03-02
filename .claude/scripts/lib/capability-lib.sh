#!/usr/bin/env bash
# =============================================================================
# capability-lib.sh — Capability manifest discovery, validation, and orchestration
# =============================================================================
# Part of: Capability Manifest v0.1 (cycle-047, Sprint 388 Task 3.3)
# Design Source: grimoires/loa/lore/capability-orchestration-design.md
#
# Discovers review capabilities from .claude/capabilities/*.yaml, validates
# manifests, matches capabilities to changed files, resolves dependency
# ordering via topological sort, and allocates token budgets.
#
# FAANG Parallel: Kubernetes ValidatingWebhookConfiguration (declarative
# registration), Google Tricorder (composable analysis passes, ISSTA 2018).
#
# Functions (all sourceable with no side effects):
#   validate_capability_manifest(file)  — Validate manifest against schema
#   discover_capabilities()             — Scan .claude/capabilities/*.yaml
#   match_capabilities(files...)        — Filter by trigger.files globs
#   resolve_ordering(ids...)            — Topological sort by dependencies
#   allocate_budgets(total, ids...)     — Proportional with min/max constraints
#
# Dependencies: yq v4+, jq 1.6+ (for JSON output), bash 4+
#
# Usage:
#   source .claude/scripts/lib/capability-lib.sh
# =============================================================================

# Directory where capability manifests are stored
CAPABILITY_DIR="${CAPABILITY_DIR:-.claude/capabilities}"

# -----------------------------------------------------------------------------
# glob_to_regex(pattern)
# Converts a glob pattern to a POSIX extended regex pattern.
# Handles: ** (recursive), * (single-segment), ? (single char), dot escaping.
# Brace expansion ({a,b}) is NOT supported — not used in current manifests.
# Order of operations:
#   1. Escape regex metacharacters (. + ^ $ | ( ) [ ] { })
#   2. Convert ** → .* (must happen before * conversion)
#   3. Convert * → [^/]* (single path segment)
#   4. Convert ? → [^/] (single character)
# -----------------------------------------------------------------------------
glob_to_regex() {
  local pattern="$1"
  local result=""

  # Step 1: Escape regex metacharacters (preserve * and ? for glob conversion)
  result=$(printf '%s' "$pattern" | sed \
    -e 's/\./\\./g' \
    -e 's/+/\\+/g' \
    -e 's/\^/\\^/g' \
    -e 's/\$/\\$/g' \
    -e 's/|/\\|/g' \
    -e 's/(/\\(/g' \
    -e 's/)/\\)/g' \
    -e 's/\[/\\[/g' \
    -e 's/\]/\\]/g' \
    -e 's/{/\\{/g' \
    -e 's/}/\\}/g')

  # Step 2: Convert ** → .* (recursive glob — must happen before single *)
  # Use a sentinel to avoid double-conversion
  result=$(printf '%s' "$result" | sed 's/\*\*/.GLOBLOB_DOUBLESTAR/g')

  # Step 3: Convert remaining * → [^/]* (single path segment)
  result=$(printf '%s' "$result" | sed 's/\*/[^\/]*/g')

  # Step 4: Restore ** sentinel → .*
  result=$(printf '%s' "$result" | sed 's/\.GLOBLOB_DOUBLESTAR/.*/g')

  # Step 5: Convert ? → [^/] (single character, not path separator)
  result=$(printf '%s' "$result" | sed 's/?/[^\/]/g')

  printf '%s' "$result"
}

# -----------------------------------------------------------------------------
# validate_capability_manifest(file)
# Validates a manifest against schema rules. Returns exit 0 on pass,
# exit 1 with specific field-level error messages on fail.
# -----------------------------------------------------------------------------
validate_capability_manifest() {
  local file="$1"
  local errors=()

  if [[ ! -f "$file" ]]; then
    echo "ERROR: File not found: $file" >&2
    return 1
  fi

  # Check yq can parse the file
  if ! yq eval '.' "$file" >/dev/null 2>&1; then
    echo "ERROR: Invalid YAML: $file" >&2
    return 1
  fi

  # Required: capability.id (string, non-empty)
  local cap_id
  cap_id=$(yq eval '.capability.id // ""' "$file" 2>/dev/null)
  if [[ -z "$cap_id" || "$cap_id" == "null" ]]; then
    errors+=("capability.id: required, must be non-empty string")
  fi

  # Required: capability.type (must be "review")
  local cap_type
  cap_type=$(yq eval '.capability.type // ""' "$file" 2>/dev/null)
  if [[ "$cap_type" != "review" ]]; then
    errors+=("capability.type: required, must be 'review' (got '${cap_type}')")
  fi

  # Required: capability.version (integer >= 1)
  local cap_version
  cap_version=$(yq eval '.capability.version // 0' "$file" 2>/dev/null)
  if [[ "$cap_version" -lt 1 ]] 2>/dev/null; then
    errors+=("capability.version: required, must be integer >= 1 (got '${cap_version}')")
  fi

  # Required: capability.description (non-empty)
  local cap_desc
  cap_desc=$(yq eval '.capability.description // ""' "$file" 2>/dev/null)
  if [[ -z "$cap_desc" || "$cap_desc" == "null" ]]; then
    errors+=("capability.description: required, must be non-empty string")
  fi

  # Required: capability.trigger.files (non-empty array)
  local trigger_count
  trigger_count=$(yq eval '.capability.trigger.files | length' "$file" 2>/dev/null)
  if [[ "$trigger_count" -lt 1 ]] 2>/dev/null; then
    errors+=("capability.trigger.files: required, must be non-empty array")
  fi

  # Required: capability.budget.min_tokens (integer > 0)
  local min_tokens
  min_tokens=$(yq eval '.capability.budget.min_tokens // 0' "$file" 2>/dev/null)
  if [[ "$min_tokens" -lt 1 ]] 2>/dev/null; then
    errors+=("capability.budget.min_tokens: required, must be integer > 0 (got '${min_tokens}')")
  fi

  # Required: capability.budget.max_tokens (integer >= min_tokens)
  local max_tokens
  max_tokens=$(yq eval '.capability.budget.max_tokens // 0' "$file" 2>/dev/null)
  if [[ "$max_tokens" -lt 1 ]] 2>/dev/null; then
    errors+=("capability.budget.max_tokens: required, must be integer > 0 (got '${max_tokens}')")
  elif [[ "$max_tokens" -lt "$min_tokens" ]] 2>/dev/null; then
    errors+=("capability.budget.max_tokens: must be >= min_tokens (${max_tokens} < ${min_tokens})")
  fi

  # Report errors
  if [[ ${#errors[@]} -gt 0 ]]; then
    echo "VALIDATION FAILED: $file" >&2
    for err in "${errors[@]}"; do
      echo "  - $err" >&2
    done
    return 1
  fi

  return 0
}

# -----------------------------------------------------------------------------
# discover_capabilities()
# Scans CAPABILITY_DIR for *.yaml files, validates each, returns JSON array
# of valid capability IDs and their file paths.
# Invalid manifests are skipped with a warning (does not abort).
# Output: JSON array to stdout
# -----------------------------------------------------------------------------
discover_capabilities() {
  local caps=()
  local dir="${CAPABILITY_DIR}"

  if [[ ! -d "$dir" ]]; then
    echo "[]"
    return 0
  fi

  local found_files=()
  while IFS= read -r -d '' f; do
    found_files+=("$f")
  done < <(find "$dir" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null | sort -z)

  if [[ ${#found_files[@]} -eq 0 ]]; then
    echo "[]"
    return 0
  fi

  local json_entries=()
  for file in "${found_files[@]}"; do
    if validate_capability_manifest "$file" 2>/dev/null; then
      local cap_id
      cap_id=$(yq eval '.capability.id' "$file")
      json_entries+=("{\"id\":\"${cap_id}\",\"file\":\"${file}\"}")
    else
      echo "WARNING: Skipping invalid manifest: $file" >&2
      validate_capability_manifest "$file" >&2  # re-run for error output
    fi
  done

  # Build JSON array
  local result="["
  local first=true
  for entry in "${json_entries[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      result+=","
    fi
    result+="$entry"
  done
  result+="]"

  echo "$result"
}

# -----------------------------------------------------------------------------
# match_capabilities(files...)
# Given a list of changed files, returns capability IDs whose trigger.files
# globs match at least one changed file.
# Output: JSON array of matched capability IDs to stdout
# -----------------------------------------------------------------------------
match_capabilities() {
  local changed_files=("$@")
  local dir="${CAPABILITY_DIR}"
  local matched_ids=()

  if [[ ${#changed_files[@]} -eq 0 || ! -d "$dir" ]]; then
    echo "[]"
    return 0
  fi

  local cap_files=()
  while IFS= read -r -d '' f; do
    cap_files+=("$f")
  done < <(find "$dir" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null | sort -z)

  for cap_file in "${cap_files[@]}"; do
    if ! validate_capability_manifest "$cap_file" 2>/dev/null; then
      continue
    fi

    local cap_id
    cap_id=$(yq eval '.capability.id' "$cap_file")

    # Get trigger file patterns
    local patterns=()
    while IFS= read -r pattern; do
      [[ -n "$pattern" ]] && patterns+=("$pattern")
    done < <(yq eval '.capability.trigger.files[]' "$cap_file" 2>/dev/null)

    # Check if any changed file matches any pattern
    local matched=false
    for changed in "${changed_files[@]}"; do
      for pattern in "${patterns[@]}"; do
        # Convert glob to regex using proper glob_to_regex function
        local regex_pattern
        regex_pattern=$(glob_to_regex "$pattern")
        if printf '%s' "$changed" | grep -qE "^${regex_pattern}$" 2>/dev/null; then
          matched=true
          break 2
        fi
      done
    done

    if [[ "$matched" == "true" ]]; then
      matched_ids+=("$cap_id")
    fi
  done

  # Output JSON array
  local result="["
  local first=true
  for id in "${matched_ids[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      result+=","
    fi
    result+="\"${id}\""
  done
  result+="]"

  echo "$result"
}

# -----------------------------------------------------------------------------
# resolve_ordering(ids...)
# Given a list of capability IDs, performs topological sort based on
# dependency declarations (before/after). Returns ordered JSON array.
# Detects cycles and returns error.
# Algorithm: Kahn's algorithm (iterative, not recursive)
# Output: JSON array of ordered capability IDs to stdout
# -----------------------------------------------------------------------------
resolve_ordering() {
  local input_ids=("$@")
  local dir="${CAPABILITY_DIR}"

  if [[ ${#input_ids[@]} -eq 0 ]]; then
    echo "[]"
    return 0
  fi

  # Build adjacency: collect edges (from → to means "from must run before to")
  # "before: [X]" means this → X (this runs before X)
  # "after: [Y]" means Y → this (Y runs before this)
  declare -A in_degree
  declare -A adjacency  # adjacency[from] = "to1 to2 to3"

  # Initialize
  for id in "${input_ids[@]}"; do
    in_degree["$id"]=0
    adjacency["$id"]=""
  done

  # Build edges from manifest declarations
  for id in "${input_ids[@]}"; do
    local cap_file
    cap_file=$(find "$dir" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null | xargs -0 grep -Fl "id: ${id}" 2>/dev/null | head -1)
    [[ -z "$cap_file" ]] && continue

    # "before" means this capability runs before the listed ones
    while IFS= read -r before_id; do
      [[ -z "$before_id" || "$before_id" == "null" ]] && continue
      # Only add edge if before_id is in our input set
      if [[ -n "${in_degree[$before_id]+x}" ]]; then
        adjacency["$id"]="${adjacency[$id]} ${before_id}"
        in_degree["$before_id"]=$(( ${in_degree[$before_id]} + 1 ))
      fi
    done < <(yq eval '.capability.dependencies.before[]' "$cap_file" 2>/dev/null)

    # "after" means the listed ones run before this capability
    while IFS= read -r after_id; do
      [[ -z "$after_id" || "$after_id" == "null" ]] && continue
      # Only add edge if after_id is in our input set
      if [[ -n "${in_degree[$after_id]+x}" ]]; then
        adjacency["$after_id"]="${adjacency[$after_id]} ${id}"
        in_degree["$id"]=$(( ${in_degree[$id]} + 1 ))
      fi
    done < <(yq eval '.capability.dependencies.after[]' "$cap_file" 2>/dev/null)
  done

  # Kahn's algorithm
  local queue=()
  for id in "${input_ids[@]}"; do
    if [[ "${in_degree[$id]}" -eq 0 ]]; then
      queue+=("$id")
    fi
  done

  local sorted=()
  while [[ ${#queue[@]} -gt 0 ]]; do
    # Dequeue first element
    local current="${queue[0]}"
    queue=("${queue[@]:1}")
    sorted+=("$current")

    # Process neighbors
    for neighbor in ${adjacency[$current]}; do
      in_degree["$neighbor"]=$(( ${in_degree[$neighbor]} - 1 ))
      if [[ "${in_degree[$neighbor]}" -eq 0 ]]; then
        queue+=("$neighbor")
      fi
    done
  done

  # Cycle detection: if sorted count != input count, there's a cycle
  if [[ ${#sorted[@]} -ne ${#input_ids[@]} ]]; then
    echo "ERROR: Circular dependency detected among capabilities" >&2
    local remaining=()
    for id in "${input_ids[@]}"; do
      local found=false
      for s in "${sorted[@]}"; do
        [[ "$s" == "$id" ]] && found=true && break
      done
      [[ "$found" == "false" ]] && remaining+=("$id")
    done
    echo "  Involved capabilities: ${remaining[*]}" >&2
    return 1
  fi

  # Output JSON array
  local result="["
  local first=true
  for id in "${sorted[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      result+=","
    fi
    result+="\"${id}\""
  done
  result+="]"

  echo "$result"
}

# -----------------------------------------------------------------------------
# allocate_budgets(total, ids...)
# Distributes total token budget across capabilities:
#   1. Guarantee min_tokens to all
#   2. Distribute remaining proportionally by optimal_tokens
#   3. Cap each at max_tokens
# Output: JSON object mapping capability ID to allocated budget
# Returns exit 1 if total < sum of minimums
# -----------------------------------------------------------------------------
allocate_budgets() {
  local total="$1"
  shift
  local ids=("$@")
  local dir="${CAPABILITY_DIR}"

  if [[ ${#ids[@]} -eq 0 ]]; then
    echo "{}"
    return 0
  fi

  # Collect budget params for each capability
  declare -A min_t optimal_t max_t
  local total_min=0
  local total_optimal=0

  for id in "${ids[@]}"; do
    local cap_file
    cap_file=$(find "$dir" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null | xargs -0 grep -Fl "id: ${id}" 2>/dev/null | head -1)
    if [[ -z "$cap_file" ]]; then
      echo "ERROR: Manifest not found for capability: $id" >&2
      return 1
    fi

    min_t["$id"]=$(yq eval '.capability.budget.min_tokens' "$cap_file")
    optimal_t["$id"]=$(yq eval '.capability.budget.optimal_tokens // 0' "$cap_file")
    max_t["$id"]=$(yq eval '.capability.budget.max_tokens' "$cap_file")

    # Default optimal to midpoint if not set
    if [[ "${optimal_t[$id]}" -eq 0 ]]; then
      optimal_t["$id"]=$(( (${min_t[$id]} + ${max_t[$id]}) / 2 ))
    fi

    total_min=$(( total_min + ${min_t[$id]} ))
    total_optimal=$(( total_optimal + ${optimal_t[$id]} ))
  done

  # Check if total budget can cover minimums
  if [[ "$total" -lt "$total_min" ]]; then
    echo "ERROR: Total budget ($total) < sum of minimums ($total_min)" >&2
    return 1
  fi

  # Step 1: Allocate minimums
  declare -A allocated
  local remaining=$(( total - total_min ))

  for id in "${ids[@]}"; do
    allocated["$id"]=${min_t[$id]}
  done

  # Step 2: Distribute remaining proportionally by optimal_tokens
  if [[ "$remaining" -gt 0 && "$total_optimal" -gt 0 ]]; then
    for id in "${ids[@]}"; do
      local headroom=$(( ${max_t[$id]} - ${min_t[$id]} ))
      if [[ "$headroom" -le 0 ]]; then
        continue
      fi

      # Proportional share based on optimal_tokens weight
      local share=$(( remaining * ${optimal_t[$id]} / total_optimal ))

      # Cap at headroom (max - min)
      if [[ "$share" -gt "$headroom" ]]; then
        share=$headroom
      fi

      allocated["$id"]=$(( ${allocated[$id]} + share ))
    done
  fi

  # Step 3: Ensure no allocation exceeds max
  for id in "${ids[@]}"; do
    if [[ "${allocated[$id]}" -gt "${max_t[$id]}" ]]; then
      allocated["$id"]=${max_t[$id]}
    fi
  done

  # Step 4: Distribute integer division remainder
  # Integer division truncates, so sum(allocations) may be < total.
  # Distribute leftover tokens one-at-a-time to capabilities with headroom,
  # iterating in priority order (ids array order from topological sort).
  # If all capabilities are at max, remaining tokens are intentionally dropped.
  local alloc_sum=0
  for id in "${ids[@]}"; do
    alloc_sum=$(( alloc_sum + ${allocated[$id]} ))
  done
  local remainder=$(( total - alloc_sum ))

  while [[ "$remainder" -gt 0 ]]; do
    local distributed_this_pass=false
    for id in "${ids[@]}"; do
      if [[ "${allocated[$id]}" -lt "${max_t[$id]}" && "$remainder" -gt 0 ]]; then
        allocated["$id"]=$(( ${allocated[$id]} + 1 ))
        remainder=$(( remainder - 1 ))
        distributed_this_pass=true
      fi
    done
    if [[ "$distributed_this_pass" == "false" ]]; then
      break  # All capabilities at max — drop remaining tokens
    fi
  done

  # Output JSON object
  local result="{"
  local first=true
  for id in "${ids[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      result+=","
    fi
    result+="\"${id}\":${allocated[$id]}"
  done
  result+="}"

  echo "$result"
}

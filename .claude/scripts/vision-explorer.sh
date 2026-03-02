#!/usr/bin/env bash
# =============================================================================
# vision-explorer.sh — Vision Registry exploration mechanism
# =============================================================================
# Part of: Exploration Budget (cycle-047, Sprint 389 Task 4.4)
#
# Standalone CLI tool that scans the Vision Registry, scores entries by
# relevance, and generates structured exploration plans.
#
# Usage:
#   vision-explorer.sh                           # Scan and rank all visions
#   vision-explorer.sh --context bridge-state.json  # Enrich with bridge context
#   vision-explorer.sh --explore vision-004      # Generate exploration plan
#   vision-explorer.sh --top 3                   # Show top N candidates
#
# Output: JSON to stdout
#
# The "Horizon Voice" register from loa-finn #24 is the conceptual framing;
# this tool builds the voice, not the stage it speaks from. Orchestrator
# integration deferred to future cycle.
#
# Dependencies: yq v4+, jq 1.6+, bash 4+
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VISION_DIR="${REPO_ROOT}/grimoires/loa/visions"
VISION_ENTRIES="${VISION_DIR}/entries"
CONTEXT_FILE=""
EXPLORE_ID=""
TOP_N=3
TIME_BUDGET_HOURS=2

# =============================================================================
# Argument Parsing
# =============================================================================

while [[ $# -gt 0 ]]; do
  case "$1" in
    --context) CONTEXT_FILE="$2"; shift 2 ;;
    --explore) EXPLORE_ID="$2"; shift 2 ;;
    --top) TOP_N="$2"; shift 2 ;;
    --time-budget) TIME_BUDGET_HOURS="$2"; shift 2 ;;
    --help)
      echo "Usage: vision-explorer.sh [--context FILE] [--explore ID] [--top N] [--time-budget H]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# =============================================================================
# Vision Scanning
# =============================================================================

scan_visions() {
  local entries=()

  if [[ ! -d "$VISION_ENTRIES" ]]; then
    echo "[]"
    return 0
  fi

  for vision_file in "$VISION_ENTRIES"/vision-*.md; do
    [[ ! -f "$vision_file" ]] && continue

    local filename
    filename=$(basename "$vision_file" .md)

    # Extract metadata from markdown frontmatter-style headers
    local id status tags_raw insight potential
    id=$(grep -m1 "^\*\*ID\*\*:" "$vision_file" 2>/dev/null | sed 's/.*: //')
    status=$(grep -m1 "^\*\*Status\*\*:" "$vision_file" 2>/dev/null | sed 's/.*: //')
    tags_raw=$(grep -m1 "^\*\*Tags\*\*:" "$vision_file" 2>/dev/null | sed 's/.*: //' | tr -d '[]' | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$')

    # Convert tags to JSON array
    local tags_json="[]"
    if [[ -n "$tags_raw" ]]; then
      tags_json=$(echo "$tags_raw" | jq -R . | jq -s .)
    fi

    # Extract insight (first paragraph after ## Insight)
    insight=$(awk '/^## Insight/{found=1; next} found && /^$/{exit} found{print}' "$vision_file" 2>/dev/null | head -3 | tr '\n' ' ')

    # Extract potential (first paragraph after ## Potential)
    potential=$(awk '/^## Potential/{found=1; next} found && /^$/{exit} found{print}' "$vision_file" 2>/dev/null | head -3 | tr '\n' ' ')

    # Skip already-explored or superseded visions
    if [[ "$status" == "Explored" || "$status" == "Superseded" ]]; then
      continue
    fi

    local entry
    entry=$(jq -n \
      --arg id "${id:-$filename}" \
      --arg status "${status:-Captured}" \
      --argjson tags "$tags_json" \
      --arg insight "$insight" \
      --arg potential "$potential" \
      '{id: $id, status: $status, tags: $tags, insight: $insight, potential: $potential}')
    entries+=("$entry")
  done

  # Build JSON array
  local result="["
  local first=true
  for entry in "${entries[@]}"; do
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

# =============================================================================
# Relevance Scoring
# =============================================================================

score_visions() {
  local visions="$1"
  local context_keywords=""

  # Extract keywords from bridge context if provided
  if [[ -n "$CONTEXT_FILE" && -f "$CONTEXT_FILE" ]]; then
    # Extract recent finding titles and tags as context keywords
    context_keywords=$(jq -r '
      [
        (.iterations[]?.findings[]?.title // empty),
        (.iterations[]?.findings[]?.tags[]? // empty)
      ] | unique | join(" ")
    ' "$CONTEXT_FILE" 2>/dev/null || echo "")
  fi

  # Score each vision based on:
  # - Status: Captured=1.0, Exploring=0.5 (already in progress)
  # - Tag overlap with context: +0.5 per overlapping keyword
  # - Recency: newer visions score slightly higher
  echo "$visions" | jq --arg ctx "$context_keywords" --arg top "$TOP_N" '
    [.[] | . as $v |
      # Base score by status
      (if $v.status == "Captured" then 1.0
       elif $v.status == "Exploring" then 0.5
       else 0.2 end) as $base |

      # Context overlap score
      (if ($ctx | length) > 0 then
        ([$v.tags | if type == "array" then .[] else empty end |
          if ($ctx | test(.; "i")) then 0.5 else 0 end
        ] | add // 0)
       else 0 end) as $ctx_score |

      # Total score
      ($base + $ctx_score) as $total |

      $v + {score: $total}
    ] |
    sort_by(-.score) |
    .[:($top | tonumber)]
  '
}

# =============================================================================
# Exploration Plan Generation
# =============================================================================

generate_exploration_plan() {
  local vision_id="$1"
  local vision_file="${VISION_ENTRIES}/${vision_id}.md"

  if [[ ! -f "$vision_file" ]]; then
    echo '{"error":"Vision file not found: '"$vision_id"'"}' >&2
    return 1
  fi

  local insight potential
  insight=$(awk '/^## Insight/{found=1; next} found && /^$/{exit} found{print}' "$vision_file" 2>/dev/null | tr '\n' ' ')
  potential=$(awk '/^## Potential/{found=1; next} found && /^$/{exit} found{print}' "$vision_file" 2>/dev/null | tr '\n' ' ')

  # Generate structured exploration plan
  jq -n \
    --arg id "$vision_id" \
    --arg insight "$insight" \
    --arg potential "$potential" \
    --arg time_budget "${TIME_BUDGET_HOURS}h" \
    '{
      vision_id: $id,
      exploration_plan: {
        hypothesis: ("The insight described in " + $id + " can be validated through a minimal prototype"),
        experiment: "Build the smallest possible implementation that tests the core insight",
        success_criteria: [
          "Prototype demonstrates the mechanism described in the vision",
          "At least one measurable outcome (performance, correctness, or usability)",
          "Clear documentation of whether the insight holds or fails"
        ],
        time_budget: $time_budget,
        deliverables: [
          "Working prototype (code, schema, or script)",
          "Outcome evaluation against success criteria",
          "Lore entry: pattern (if successful) or failure story (if not)"
        ]
      },
      context: {
        insight: $insight,
        potential: $potential
      }
    }'
}

# =============================================================================
# Main
# =============================================================================

if [[ -n "$EXPLORE_ID" ]]; then
  generate_exploration_plan "$EXPLORE_ID"
else
  visions=$(scan_visions)
  score_visions "$visions"
fi

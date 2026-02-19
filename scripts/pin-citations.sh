#!/usr/bin/env bash
# pin-citations.sh — Citation validation and cross-repo pinning
# Usage: scripts/pin-citations.sh [--validate-only] [--check-stale] [--verbose]
#
# Scans <!-- cite: repo[@ref]:path[#Lstart-Lend] --> tags across all docs.
# Validates local file references, optionally resolves cross-repo refs
# to commit SHA permalinks via gh api.
#
# Modes:
#   (default)        Validate local + pin cross-repo (requires GITHUB_TOKEN)
#   --validate-only  Format + local file checks only (no API calls)
#   --check-stale    Report pins older than 30 days

set -euo pipefail

CACHE_FILE="grimoires/loa/cache/citation-pins.json"
VALIDATE_ONLY=false
CHECK_STALE=false
VERBOSE=false
MAX_RETRIES=3
STALE_DAYS=30

for arg in "$@"; do
  case "$arg" in
    --validate-only) VALIDATE_ONLY=true ;;
    --check-stale) CHECK_STALE=true ;;
    --verbose) VERBOSE=true ;;
    --help|-h)
      echo "Usage: $0 [--validate-only] [--check-stale] [--verbose]"
      exit 0
      ;;
  esac
done

# Citation regex: <!-- cite: repo[@ref]:path[#Lstart-Lend] -->
CITE_REGEX='<!-- cite: ([a-zA-Z0-9_-]+)(@[a-f0-9]+)?:([^ ]+?) -->'

log() {
  if [[ "$VERBOSE" == "true" ]]; then
    echo "  [DBG] $*" >&2
  fi
}

pass=0
fail=0
warn=0
total=0

# Collect all markdown files
doc_files=()
while IFS= read -r f; do
  doc_files+=("$f")
done < <(find docs/ -name '*.md' -type f 2>/dev/null; find . -maxdepth 1 -name '*.md' -type f 2>/dev/null | grep -v node_modules)

if [[ ${#doc_files[@]} -eq 0 ]]; then
  echo "No markdown files found."
  exit 0
fi

echo "=== Citation Validation ==="
echo "Mode: $(if $VALIDATE_ONLY; then echo 'validate-only (no API)'; else echo 'full (local + cross-repo)'; fi)"
echo "Files: ${#doc_files[@]}"
echo ""

for file in "${doc_files[@]}"; do
  file_citations=0

  while IFS= read -r line; do
    total=$((total + 1))
    file_citations=$((file_citations + 1))

    # Extract components
    repo=$(echo "$line" | sed -E "s/.*<!-- cite: ([a-zA-Z0-9_-]+)(@[a-f0-9]+)?:.*/\1/")
    ref=$(echo "$line" | sed -E "s/.*<!-- cite: [a-zA-Z0-9_-]+(@[a-f0-9]+)?.*/\1/" | tr -d '@')
    path_part=$(echo "$line" | sed -E "s/.*<!-- cite: [a-zA-Z0-9_-]+(@[a-f0-9]+)?:([^ ]+) -->.*/\2/")

    # Separate path and line range
    file_path=$(echo "$path_part" | sed 's/#.*//')
    line_range=$(echo "$path_part" | grep -oE '#L[0-9]+-L?[0-9]*' || true)

    log "Cite: repo=$repo ref=$ref path=$file_path range=$line_range"

    # Check 1: Format validation
    if [[ -z "$repo" || -z "$file_path" ]]; then
      echo "  FAIL: Malformed citation in $file: $line"
      fail=$((fail + 1))
      continue
    fi

    # Check 2: Local reference validation
    if [[ "$repo" == "loa-freeside" ]]; then
      if [[ -f "$file_path" || -d "$file_path" ]]; then
        # Validate line range if specified
        if [[ -n "$line_range" ]]; then
          start_line=$(echo "$line_range" | sed -E 's/#L([0-9]+).*/\1/')
          file_lines=$(wc -l < "$file_path")
          if [[ "$start_line" -gt "$file_lines" ]]; then
            echo "  WARN: Line $start_line exceeds file length ($file_lines) in $file: $file_path"
            warn=$((warn + 1))
          else
            pass=$((pass + 1))
          fi
        else
          pass=$((pass + 1))
        fi
        log "  LOCAL OK: $file_path"
      else
        echo "  FAIL: Local file not found: $file_path (in $file)"
        fail=$((fail + 1))
      fi
    else
      # Cross-repo reference
      if [[ "$VALIDATE_ONLY" == "true" ]]; then
        # In validate-only mode, just check format
        if [[ -n "$ref" ]]; then
          # Already pinned to a SHA — good
          pass=$((pass + 1))
          log "  CROSS-REPO PINNED: $repo@$ref:$file_path"
        else
          # Branch-relative — warn but don't fail in validate-only
          echo "  WARN: Branch-relative cross-repo link: $repo:$file_path (in $file)"
          warn=$((warn + 1))
        fi
      else
        # Full mode — resolve via gh api
        if [[ -z "$ref" ]]; then
          echo "  INFO: Would pin $repo:$file_path to HEAD SHA (requires gh auth)"
          warn=$((warn + 1))
        else
          pass=$((pass + 1))
        fi
      fi
    fi

  done < <(grep -nE '<!-- cite:' "$file" 2>/dev/null | grep -oE '<!-- cite: [^>]+ -->' || true)

  if [[ "$file_citations" -gt 0 ]]; then
    log "$file: $file_citations citations"
  fi
done

# Stale check
if [[ "$CHECK_STALE" == "true" && -f "$CACHE_FILE" ]]; then
  echo ""
  echo "--- Stale Pin Check ---"
  stale_count=0
  now=$(date +%s)
  threshold=$((STALE_DAYS * 86400))

  while IFS= read -r entry; do
    pinned_at=$(echo "$entry" | jq -r '.pinned_at // empty')
    if [[ -n "$pinned_at" ]]; then
      pin_epoch=$(date -d "$pinned_at" +%s 2>/dev/null || echo 0)
      age=$((now - pin_epoch))
      if [[ "$age" -gt "$threshold" ]]; then
        cite=$(echo "$entry" | jq -r '.cite')
        echo "  STALE (${age}s old): $cite"
        stale_count=$((stale_count + 1))
      fi
    fi
  done < <(jq -c '.[]' "$CACHE_FILE" 2>/dev/null || true)

  if [[ "$stale_count" -eq 0 ]]; then
    echo "  No stale pins found."
  else
    echo "  $stale_count stale pins (> ${STALE_DAYS} days)"
  fi
fi

echo ""
echo "Results: $total citations scanned"
echo "  PASS: $pass"
echo "  FAIL: $fail"
echo "  WARN: $warn"

if [[ "$fail" -gt 0 ]]; then
  echo ""
  echo "=== VALIDATION FAILED ==="
  exit 1
else
  echo ""
  echo "=== VALIDATION PASSED ==="
  exit 0
fi

# Capability Registry Guide

> **Version**: 0.1 (cycle-047, Sprint 388)
> **Design Source**: `grimoires/loa/lore/capability-orchestration-design.md`
> **Schema**: `.claude/data/capability-schema.yaml`
> **Library**: `.claude/scripts/lib/capability-lib.sh`

## Overview

The capability registry enables review capabilities to declare themselves via YAML manifests. The bridge orchestrator discovers, matches, orders, and budgets capabilities dynamically — adding a new review capability does not require modifying the orchestrator.

This follows two proven patterns from industry:

1. **Kubernetes ValidatingWebhookConfiguration**: External processes register themselves as admission controllers via declarative configuration. The API server discovers and invokes them without code changes.

2. **Google Tricorder** (Sadowski et al., ISSTA 2018): Composable analysis passes where each analyzer declares its scope, resource requirements, and dependencies. New analyzers are added by writing a plugin, not modifying the framework.

## How It Works

```
bridge-orchestrator.sh
  ├── discover_capabilities()          # Scan .claude/capabilities/*.yaml
  ├── match_capabilities(changed_files) # Filter by trigger file patterns
  ├── resolve_ordering(matches)        # Topological sort by dependencies
  ├── allocate_budgets(chain, total)   # Distribute token budget per capability
  └── execute_chain(ordered_caps)      # Sequential execution with context passing
```

Each capability in the chain receives:
- Its own input channels (SDD sections, code diff)
- Accumulated findings from prior stages (Deliberative Council pattern)
- Relevant lore entries (tag-matched)

## Step 1: Create a Capability Manifest

Create a YAML file in `.claude/capabilities/`:

```yaml
# .claude/capabilities/my-new-review.yaml
capability:
  id: my-new-review
  type: review
  version: 1
  description: >-
    What this capability reviews and why it matters.

  trigger:
    files:
      - "packages/**/*.ts"
      - "themes/**/*.ts"
    tags:
      - quality
      - patterns

  input:
    requires:
      - sdd
      - diff
    optional:
      - prior_findings
      - lore

  output:
    format: findings-json
    severity_range: [0, 1000]

  budget:
    min_tokens: 4000
    optimal_tokens: 30000
    max_tokens: 100000

  dependencies:
    before:
      - bridgebuilder-review
    after:
      - pipeline-self-review
```

## Step 2: Register Trigger Patterns

The `trigger.files` array uses glob patterns to match changed files:

| Pattern | Matches |
|---------|---------|
| `"**/*"` | All files (use for universal reviewers like Bridgebuilder) |
| `"packages/**/*.ts"` | All TypeScript files in packages/ |
| `".claude/scripts/**"` | All pipeline scripts |
| `"infrastructure/**"` | All infrastructure files |
| `"*.md"` | Markdown files in repo root |

The capability is included in the chain if **any** changed file matches **any** trigger pattern.

Optional `trigger.tags` enable semantic matching beyond file paths.

## Step 3: Declare Dependencies

Dependencies control execution order:

- **`before`**: Capabilities that must run AFTER this one
- **`after`**: Capabilities that must run BEFORE this one

The orchestrator performs topological sort (Kahn's algorithm). Circular dependencies are detected and cause an error.

**Current reference chain:**

```
pipeline-self-review → red-team-code → bridgebuilder-review
```

## Step 4: Set Budget Ranges

| Field | Purpose |
|-------|---------|
| `min_tokens` | Minimum for useful output |
| `optimal_tokens` | Sweet spot for quality — used as proportional weight |
| `max_tokens` | Upper bound |

**Allocation algorithm:** Guarantee minimums → distribute remaining proportionally → cap at maximums.

**Reference budgets:**

| Capability | Min | Optimal | Max |
|-----------|-----|---------|-----|
| pipeline-self-review | 4,000 | 50,000 | 150,000 |
| red-team-code | 4,000 | 20,000 | 80,000 |
| bridgebuilder-review | 10,000 | 50,000 | 150,000 |

## Step 5: Test the Manifest Locally

```bash
# Validate
source .claude/scripts/lib/capability-lib.sh
validate_capability_manifest .claude/capabilities/my-new-review.yaml

# Discover all
discover_capabilities

# Match against changed files
match_capabilities "packages/core/foo.ts" ".claude/scripts/bar.sh"

# Resolve ordering
resolve_ordering "pipeline-self-review" "red-team-code" "my-new-review" "bridgebuilder-review"

# Allocate budgets
allocate_budgets 200000 "pipeline-self-review" "red-team-code" "bridgebuilder-review"

# Run full integration test
bash .claude/evals/capability-discovery.sh
```

## FAANG Parallels

**Kubernetes Admission Controllers**: Declarative YAML registration, pattern-based matching, ordered execution, no API server modifications needed.

**Google Tricorder (ISSTA 2018)**: Analyzers declare scope and resource requirements, results cascade to later stages, new analyzers added by plugin not framework modification.

**Chromium OWNERS**: Specification-based review routing where directories declare reviewers and reviews auto-assign based on changed files.

## Economic Protocol Connection

The registry implements review-as-economic-protocol: capabilities bid for attention via budget ranges, the orchestrator acts as market maker with proportional allocation, and consensus thresholds prevent finding inflation. This connects to Web4's universal seigniorage — finding creation is democratized but scarcity is enforced.

See `grimoires/loa/lore/ecosystem-synthesis.md` for the full cross-ecosystem analysis.

## Reference

| File | Purpose |
|------|---------|
| `.claude/data/capability-schema.yaml` | Schema definition |
| `.claude/capabilities/*.yaml` | Capability manifests |
| `.claude/scripts/lib/capability-lib.sh` | Discovery, validation, ordering, budgets |
| `.claude/evals/capability-discovery.sh` | Integration test |
| `grimoires/loa/lore/capability-orchestration-design.md` | Design document |

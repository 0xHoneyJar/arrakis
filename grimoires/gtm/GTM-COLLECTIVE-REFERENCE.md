# GTM Collective - Flows & Commands Reference

**Version:** 1.0.0
**Pack:** gtm-collective
**Publisher:** The Honey Jar

---

## Overview

The GTM Collective is a comprehensive suite of AI-powered skills and commands for go-to-market strategy. It provides structured workflows for market research, competitive analysis, positioning, pricing, partnership development, developer relations, and executive communication.

The pack includes **14 commands** and **8 skills** that must be executed in a specific order due to dependencies between artifacts.

---

## Directory Structure

```
gtm-grimoire/
├── context/
│   ├── product-brief.md        # Product overview (from /gtm-setup)
│   ├── product-reality.md      # Code-derived reality (from /gtm-adopt)
│   └── competitors.md          # Known competitors
├── research/
│   ├── market-landscape.md     # TAM/SAM/SOM, trends
│   ├── competitive-analysis.md # Feature matrix, positioning gaps
│   └── icp-profiles.md         # Ideal customer profiles
├── strategy/
│   ├── positioning.md          # Positioning strategy
│   ├── messaging.md            # Messaging framework
│   ├── pricing-strategy.md     # Pricing strategy
│   ├── partnership-strategy.md # Partnership strategy
│   └── devrel-strategy.md      # DevRel strategy
├── execution/
│   ├── launch-plan.md          # Launch activities
│   └── pitch-deck.md           # Pitch deck content
├── launch/
│   └── announcements/          # Release communications
└── NOTES.md                    # Working memory and decision log
```

---

## Phase 0: Setup

Choose one entry point based on your situation.

### Option A: `/gtm-setup` (New Product)

**When to use:** Starting fresh with a new product, no existing development artifacts.

**Type:** Interactive wizard

**Prerequisites:**
- `.loa-setup-complete` exists
- `gtm-grimoire/` directory exists

**Gathers:**
1. Product description (what it does, problem solved, uniqueness)
2. Target market (audience, industry, company size)
3. Competitors (known competitors, alternatives, differentiation)
4. Constraints (timeline, budget, team size)
5. Launch goals (signups, revenue, awareness metrics)

**Output:**
- `gtm-grimoire/context/product-brief.md`

**Next steps:** `/analyze-market`

---

### Option B: `/gtm-adopt` (Existing Codebase)

**When to use:** You have an existing codebase with PRD/SDD from Loa development workflow.

**Type:** Interactive wizard

**Prerequisites:**
- `.loa-setup-complete` exists
- `gtm-grimoire/` directory exists

**Reads from:**
- `loa-grimoire/prd.md` (optional)
- `loa-grimoire/sdd.md` (optional)

**Output:**
- `gtm-grimoire/context/product-reality.md`

**Next steps:** `/analyze-market`

---

## Phase 1: Research

### `/analyze-market`

**Purpose:** Conduct comprehensive market research for GTM strategy.

**Skill:** `analyzing-market`

**Prerequisites:**
- `gtm-grimoire/context/product-brief.md` exists

**Outputs:**
| File | Description |
|------|-------------|
| `research/market-landscape.md` | TAM/SAM/SOM sizing, market trends, dynamics |
| `research/competitive-analysis.md` | Competitor deep dive, feature matrix |
| `research/icp-profiles.md` | Ideal Customer Profile definitions |

**Next steps:** `/position`

---

## Phase 2: Core Strategy

Execute these commands **sequentially** - each depends on the previous.

### `/position`

**Purpose:** Define product positioning and messaging framework.

**Skill:** `positioning-product`

**Prerequisites:**
- Market research complete (`research/market-landscape.md`)
- Competitive analysis complete (`research/competitive-analysis.md`)
- ICP profiles complete (`research/icp-profiles.md`)

**Outputs:**
| File | Description |
|------|-------------|
| `strategy/positioning.md` | Positioning strategy and differentiation |
| `strategy/messaging.md` | Messaging framework and value propositions |

**Next steps:** `/price`

---

### `/price`

**Purpose:** Define pricing strategy and tier structure.

**Skill:** `pricing-strategist`

**Prerequisites:**
- Positioning complete (`strategy/positioning.md`)

**Outputs:**
| File | Description |
|------|-------------|
| `strategy/pricing-strategy.md` | Pricing model, tiers, packaging |

**Next steps:** `/plan-partnerships`, `/plan-devrel`, or `/plan-launch`

---

## Phase 3: Expansion Strategy

These commands can be executed **in parallel** after Phase 2 is complete. Both are optional.

### `/plan-partnerships`

**Purpose:** Develop partnership and business development strategy.

**Skill:** `building-partnerships`

**Prerequisites:**
- Positioning complete (`strategy/positioning.md`)

**Outputs:**
| File | Description |
|------|-------------|
| `strategy/partnership-strategy.md` | Partner ecosystem, BD strategy |

---

### `/plan-devrel`

**Purpose:** Develop developer relations and education strategy.

**Skill:** `educating-developers`

**Prerequisites:**
- Positioning complete (`strategy/positioning.md`)
- ICP profiles complete (`research/icp-profiles.md`)

**Outputs:**
| File | Description |
|------|-------------|
| `strategy/devrel-strategy.md` | DevRel strategy, documentation plan |

---

## Phase 4: Launch Execution

### `/plan-launch`

**Purpose:** Create comprehensive launch plan and content strategy.

**Skill:** `crafting-narratives`

**Prerequisites:**
- Pricing complete (`strategy/pricing-strategy.md`)

**Optional inputs:**
- `strategy/partnership-strategy.md`
- `strategy/devrel-strategy.md`

**Outputs:**
| File | Description |
|------|-------------|
| `execution/launch-plan.md` | Launch activities, content calendar |

**Next steps:** `/create-deck`, `/announce-release`

---

### `/create-deck`

**Purpose:** Create pitch deck and executive materials.

**Skill:** `translating-for-stakeholders`

**Prerequisites:**
- Positioning complete (`strategy/positioning.md`)
- Pricing complete (`strategy/pricing-strategy.md`)
- Market research complete (`research/market-landscape.md`)

**Outputs:**
| File | Description |
|------|-------------|
| `execution/pitch-deck.md` | Slide-by-slide deck content |

---

### `/announce-release`

**Purpose:** Generate launch content from release artifacts.

**Skill:** `crafting-narratives`

**Arguments:**
- `version` (optional): Release version (e.g., `v1.0.0`)
- `sprint` (optional): Sprint to announce (e.g., `sprint-5`)

**Optional inputs:**
- `strategy/positioning.md`
- `context/product-reality.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

**Outputs:**
| File | Description |
|------|-------------|
| `launch/announcements/*` | Blog post, social media, email content |

---

## Review & Sync Commands

These can be run anytime after Phase 1 is complete.

### `/review-gtm`

**Purpose:** Conduct adversarial review of all GTM artifacts.

**Skill:** `reviewing-gtm`

**Prerequisites:**
- Research artifacts exist (`gtm-grimoire/research/`)
- Strategy artifacts exist (`gtm-grimoire/strategy/`)

**Outputs:**
| File | Description |
|------|-------------|
| `a2a/reviews/gtm-review-{date}.md` | Review findings and recommendations |

---

### `/sync-from-dev`

**Purpose:** Pull development artifact changes into GTM context.

**Type:** Interactive wizard

**Prerequisites:**
- `loa-grimoire/prd.md` exists

**Reads from:**
- `loa-grimoire/prd.md`
- `loa-grimoire/sdd.md` (optional)
- `loa-grimoire/sprint.md` (optional)

**Outputs:**
| File | Description |
|------|-------------|
| `context/product-reality.md` | Updated product reality from dev |

---

### `/sync-from-gtm`

**Purpose:** Push GTM requirements to development context.

**Type:** Interactive wizard

**Arguments:**
- `suggest-prd` (optional): Generate PRD update suggestions

**Reads from:**
- `strategy/positioning.md` (optional)
- `research/icp-profiles.md` (optional)
- `strategy/pricing.md` (optional)

**Outputs:**
| File | Description |
|------|-------------|
| `loa-grimoire/context/gtm-requirements.md` | GTM insights for dev team |

---

### `/gtm-feature-requests`

**Purpose:** Generate feature request analysis from GTM perspective.

**Use when:** You need to prioritize features based on market and customer insights.

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     GTM COLLECTIVE WORKFLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 0: SETUP (choose one)                                     │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │ /gtm-setup   │ OR  │ /gtm-adopt   │                          │
│  │ (new product)│     │ (existing)   │                          │
│  └──────┬───────┘     └──────┬───────┘                          │
│         └──────────┬─────────┘                                   │
│                    ▼                                             │
│  PHASE 1: RESEARCH                                               │
│  ┌────────────────────┐                                         │
│  │ /analyze-market    │ → market-landscape.md                   │
│  │                    │ → competitive-analysis.md               │
│  │                    │ → icp-profiles.md                       │
│  └─────────┬──────────┘                                         │
│            ▼                                                     │
│  PHASE 2: CORE STRATEGY (sequential)                             │
│  ┌────────────────────┐                                         │
│  │ /position          │ → positioning.md                        │
│  │                    │ → messaging.md                          │
│  └─────────┬──────────┘                                         │
│            ▼                                                     │
│  ┌────────────────────┐                                         │
│  │ /price             │ → pricing-strategy.md                   │
│  └─────────┬──────────┘                                         │
│            │                                                     │
│            ├──────────────────────┐                             │
│            ▼                      ▼                              │
│  PHASE 3: EXPANSION (parallel, optional)                         │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │ /plan-partnerships │  │ /plan-devrel       │                 │
│  └─────────┬──────────┘  └──────┬─────────────┘                 │
│            └──────────┬─────────┘                               │
│                       ▼                                          │
│  PHASE 4: LAUNCH EXECUTION                                       │
│  ┌────────────────────┐                                         │
│  │ /plan-launch       │ → launch-plan.md                        │
│  └─────────┬──────────┘                                         │
│            ▼                                                     │
│  ┌────────────────────┐                                         │
│  │ /create-deck       │ → pitch-deck.md                         │
│  └─────────┬──────────┘                                         │
│            ▼                                                     │
│  ┌────────────────────┐                                         │
│  │ /announce-release  │ → announcements/*                       │
│  └────────────────────┘                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

ANYTIME COMMANDS (after Phase 1):
• /review-gtm          - Adversarial strategy review
• /sync-from-dev       - Pull dev changes into GTM
• /sync-from-gtm       - Push GTM insights to dev
• /gtm-feature-requests - Generate feature requests
```

---

## Skills Reference

| Skill | Description | Triggered By |
|-------|-------------|--------------|
| `analyzing-market` | Market research, TAM/SAM/SOM sizing, competitive analysis, ICP development | `/analyze-market` |
| `positioning-product` | Product positioning, differentiation, value propositions | `/position` |
| `pricing-strategist` | Pricing models, packaging, value metrics | `/price` |
| `building-partnerships` | Partnership strategy, ecosystem mapping, partner enablement | `/plan-partnerships` |
| `educating-developers` | DevRel strategy, documentation, developer content | `/plan-devrel` |
| `crafting-narratives` | Story development, messaging frameworks, content strategy | `/plan-launch`, `/announce-release` |
| `translating-for-stakeholders` | Executive communication, board decks, investor updates | `/create-deck` |
| `reviewing-gtm` | GTM plan review, feedback, strategy validation | `/review-gtm` |

---

## Quick Start: Minimum Viable GTM

For the fastest path to a complete GTM strategy:

```bash
# 1. Initialize (choose one)
/gtm-setup              # New product
/gtm-adopt              # Existing codebase

# 2. Research
/analyze-market         # Market & competitive analysis

# 3. Core Strategy
/position               # Positioning & messaging
/price                  # Pricing strategy

# 4. Launch
/plan-launch            # Launch plan
/create-deck            # Pitch deck

# 5. Validate
/review-gtm             # Strategy review
```

---

## Command Summary Table

| Phase | Command | Type | Skill | Required Inputs |
|-------|---------|------|-------|-----------------|
| 0 | `/gtm-setup` | wizard | - | - |
| 0 | `/gtm-adopt` | wizard | - | PRD/SDD (optional) |
| 1 | `/analyze-market` | agent | `analyzing-market` | product-brief.md |
| 2 | `/position` | agent | `positioning-product` | research/* |
| 2 | `/price` | agent | `pricing-strategist` | positioning.md |
| 3 | `/plan-partnerships` | agent | `building-partnerships` | positioning.md |
| 3 | `/plan-devrel` | agent | `educating-developers` | positioning.md |
| 4 | `/plan-launch` | agent | `crafting-narratives` | pricing-strategy.md |
| 4 | `/create-deck` | agent | `translating-for-stakeholders` | positioning.md, pricing-strategy.md |
| 4 | `/announce-release` | agent | `crafting-narratives` | - |
| - | `/review-gtm` | agent | `reviewing-gtm` | research/*, strategy/* |
| - | `/sync-from-dev` | wizard | - | loa-grimoire/prd.md |
| - | `/sync-from-gtm` | wizard | - | strategy/* |
| - | `/gtm-feature-requests` | - | - | - |

---

*GTM Collective v1.0.0 - The Honey Jar*

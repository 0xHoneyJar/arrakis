# Comparison Table Components

**Component:** Feature Comparison Tables
**Used On:** Pricing, Compare pages, Features
**Last Updated:** 2026-01-03

---

## Comparison Table: Pricing Tiers

### Full Matrix

| Feature | Free | Premium | Enterprise |
|---------|:----:|:-------:|:----------:|
| **Token-Gating** | | | |
| ERC20 token gating | ✓ | ✓ | ✓ |
| NFT ownership gating | ✓ | ✓ | ✓ |
| Multi-chain support | ✓ | ✓ | ✓ |
| Shadow/coexistence mode | ✓ | ✓ | ✓ |
| **Progression System** | | | |
| Tier system | 3 tiers | 9 tiers | Custom |
| Theme | BasicTheme | SietchTheme | Custom |
| Badges | 5 | 10+ | Unlimited |
| Badge lineage | — | ✓ | ✓ |
| **Intelligence** | | | |
| Conviction scoring | — | ✓ | ✓ |
| Analytics dashboard | — | ✓ | ✓ |
| Holder insights | — | ✓ | ✓ |
| Airdrop planning data | — | ✓ | ✓ |
| **Platform Support** | | | |
| Discord servers | 1 | 3 | Unlimited |
| Telegram groups | — | 1 | Unlimited |
| **Operations** | | | |
| Balance refresh | 24h | 6h | 1h |
| Self-service wizard | ✓ | ✓ | ✓ |
| API access | — | Read-only | Full |
| **Security & Compliance** | | | |
| Row-level security | ✓ | ✓ | ✓ |
| Audit trail | — | — | ✓ |
| White-label | — | — | ✓ |
| Custom SLA | — | — | ✓ |
| **Support** | | | |
| Community Discord | ✓ | ✓ | ✓ |
| Email support | — | ✓ (24h) | ✓ (4h SLA) |
| Dedicated Slack | — | — | ✓ |

---

## Comparison Table: vs Competitors

### Arrakis vs Collab.Land

| Feature | Arrakis | Collab.Land |
|---------|:-------:|:-----------:|
| **Core Capabilities** | | |
| Token-gating | ✓ | ✓ |
| Multi-chain | ✓ | ✓ |
| NFT support | ✓ | ✓ |
| **Engagement Intelligence** | | |
| Conviction scoring | ✓ | — |
| Tiered progression | 9 tiers | — |
| Badge gamification | 10+ types | — |
| Analytics dashboard | ✓ | — |
| **Adoption** | | |
| Shadow mode | ✓ | — |
| Self-service wizard | ✓ | ✓ |
| **Architecture** | | |
| Two-tier resilience | ✓ | — |
| Enterprise RLS | ✓ | Unknown |
| **Pricing** | | |
| Free tier | ✓ | ✓ |
| Premium | $99/mo | $35-499/mo |

**Summary:** Collab.Land gates the door. Arrakis creates the journey.

---

### Arrakis vs Guild.xyz

| Feature | Arrakis | Guild.xyz |
|---------|:-------:|:---------:|
| **Core Capabilities** | | |
| Token-gating | ✓ | ✓ |
| Multi-chain | ✓ | ✓ (60+) |
| NFT support | ✓ | ✓ |
| **Engagement Intelligence** | | |
| Conviction scoring | ✓ | — |
| Tiered progression | 9 tiers | Basic |
| Badge gamification | 10+ types | — |
| Analytics dashboard | ✓ | — |
| **Adoption** | | |
| Shadow mode | ✓ | — |
| Self-service wizard | ✓ | ✓ |
| **Platform** | | |
| Discord | ✓ | ✓ |
| Telegram | ✓ | — |
| **Pricing** | | |
| Free tier | ✓ | ✓ (all features) |
| Premium | $99/mo | Free |

**Summary:** Guild.xyz manages access. Arrakis creates value.

---

## Comparison Row Component

### Structure

```
┌─────────────────────────────────────────────────────────┐
│  Feature Name        │  Arrakis  │  Competitor  │       │
│  [Description]       │    ✓      │      —       │       │
└─────────────────────────────────────────────────────────┘
```

### Cell Values

| Symbol | Meaning | Color |
|--------|---------|-------|
| ✓ | Included | Green |
| — | Not included | Gray |
| ✓✓ | Superior | Green + Bold |
| ~ | Partial | Yellow |
| Number | Quantity | Default |
| Text | Variable | Default |

---

## Quick Comparison Card

### Use Case
Inline comparison on competitor pages

### Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Arrakis vs [Competitor]                               │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │    Arrakis      │  │   [Competitor]  │              │
│  │                 │  │                 │              │
│  │ ✓ Intelligence  │  │ ✓ Access        │              │
│  │ ✓ 9-tier       │  │ — No tiers      │              │
│  │ ✓ Conviction   │  │ — Balance only  │              │
│  │ ✓ Shadow mode  │  │ — Must switch   │              │
│  │                 │  │                 │              │
│  │ $99/mo Premium │  │ $XX/mo          │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  [Try Arrakis Free →]                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Feature Deep Dive Comparison

### Use Case
Detailed feature comparison on compare pages

### Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ## Token-Gating                                        │
│                                                         │
│  │ Aspect        │ Arrakis         │ Competitor      │ │
│  │───────────────│─────────────────│─────────────────│ │
│  │ ERC20         │ ✓               │ ✓               │ │
│  │ NFT           │ ✓               │ ✓               │ │
│  │ Multi-chain   │ ✓ Score Service │ ✓ 40+ chains    │ │
│  │ Conviction    │ ✓ Unique        │ —               │ │
│                                                         │
│  **Bottom Line:** Both handle basic gating.             │
│  Arrakis adds conviction intelligence.                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Visual Specifications

### Table Styles

#### Header Row
- Background: Gray-50
- Text: Gray-700, Semibold, 14px
- Padding: 12px 16px

#### Body Rows
- Background: White (alternating Gray-50)
- Text: Gray-900, Regular, 14px
- Padding: 12px 16px

#### Category Headers
- Background: Gray-100
- Text: Gray-900, Semibold, 14px
- Colspan: Full width

### Cell Alignment
- Feature names: Left
- Values: Center
- Numbers: Center
- Text values: Center

### Icons
- ✓ Checkmark: Green-500, 20px
- — Dash: Gray-400, 20px
- ✓✓ Double check: Green-600, Bold

### Responsive
- Mobile: Horizontal scroll or stack
- Sticky first column on scroll
- Collapsible category sections

---

*Components ready for implementation.*

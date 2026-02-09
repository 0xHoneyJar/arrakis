# Feature Card Components

**Component:** Feature Cards & Grids
**Used On:** Homepage, Features, Use Cases
**Last Updated:** 2026-01-03

---

## Feature Card: Icon + Text

### Structure

```
┌─────────────────────────────────────────┐
│                                         │
│              [Icon]                     │
│                                         │
│         Feature Title                   │
│                                         │
│  Description text explaining the        │
│  feature in 1-2 sentences.              │
│                                         │
└─────────────────────────────────────────┘
```

### Feature Content Library

#### Conviction Scoring
- **Icon:** Diamond / Chart-trending-up
- **Title:** Conviction Scoring
- **Description:** Know who your diamond hands are. We analyze holding duration, trading patterns, and on-chain activity to identify your most committed members.

#### 9-Tier Progression
- **Icon:** Layers / Ladder
- **Title:** 9-Tier Progression
- **Description:** From Outsider to Naib. Create a status hierarchy that rewards commitment and drives engagement through visible recognition.

#### Badge Gamification
- **Icon:** Award / Medal
- **Title:** Badge Gamification
- **Description:** 10+ badge types for tenure, achievements, and community contribution. Create collector culture in your Discord.

#### Shadow Mode
- **Icon:** Shield / Eye
- **Title:** Shadow Mode
- **Description:** Try alongside Collab.Land or Guild.xyz. See your conviction data without changing anything. Switch when you're ready.

#### Multi-Chain
- **Icon:** Link / Globe
- **Title:** Multi-Chain Support
- **Description:** Aggregate holdings across all major EVM chains. One community, many chains, unified scoring.

#### Self-Service Wizard
- **Icon:** Wand / Sparkles
- **Title:** 15-Minute Setup
- **Description:** Our wizard guides you through everything. Enter your contract, configure tiers, deploy. No code required.

#### Analytics Dashboard
- **Icon:** Chart-bar / Insights
- **Title:** Analytics Dashboard
- **Description:** Understand your community composition. See conviction distribution, tier breakdown, and engagement trends.

#### Enterprise Security
- **Icon:** Lock / Shield-check
- **Title:** Enterprise Security
- **Description:** PostgreSQL RLS for tenant isolation. Full audit trail. Two-tier architecture for 99.9% uptime.

---

## Feature Card: Expanded (With Details)

### Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Icon]  Feature Title                    [Badge]       │
│                                                         │
│  Description paragraph explaining the feature in more   │
│  detail. Can be 2-3 sentences for fuller explanation.   │
│                                                         │
│  • Bullet point detail                                  │
│  • Bullet point detail                                  │
│  • Bullet point detail                                  │
│                                                         │
│  [Learn More →]                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Badge Options
- **Premium Feature** — For conviction scoring, analytics
- **Enterprise Feature** — For audit trail, white-label
- **Coming Soon** — For roadmap features
- **New** — For recently launched features

---

## Feature Grid: 2x2

### Use Case
Homepage feature highlights

### Structure

```
┌─────────────────────┐  ┌─────────────────────┐
│    Conviction       │  │    9-Tier           │
│    Scoring          │  │    Progression      │
│                     │  │                     │
│    [description]    │  │    [description]    │
└─────────────────────┘  └─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐
│    Badge            │  │    Shadow           │
│    Gamification     │  │    Mode             │
│                     │  │                     │
│    [description]    │  │    [description]    │
└─────────────────────┘  └─────────────────────┘
```

---

## Feature Grid: 3x2

### Use Case
Features page overview

### Structure

```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Conviction   │  │   9-Tier      │  │    Badge      │
│   Scoring     │  │  Progression  │  │  Gamification │
└───────────────┘  └───────────────┘  └───────────────┘

┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Shadow      │  │  Multi-Chain  │  │   Self-       │
│    Mode       │  │   Support     │  │   Service     │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## Feature Comparison Table

### Use Case
Homepage, Pricing page

### Structure

```
| Feature             | Free | Premium | Enterprise |
|---------------------|:----:|:-------:|:----------:|
| Token-gating        |  ✓   |    ✓    |     ✓      |
| Multi-chain         |  ✓   |    ✓    |     ✓      |
| Shadow mode         |  ✓   |    ✓    |     ✓      |
| Tier progression    |  3   |    9    |   Custom   |
| Badges              |  5   |   10+   | Unlimited  |
| Conviction scoring  |  —   |    ✓    |     ✓      |
| Analytics           |  —   |    ✓    |     ✓      |
| API access          |  —   |  Read   |    Full    |
| Audit trail         |  —   |    —    |     ✓      |
```

### Cell Styles
- ✓ = Included (green checkmark)
- — = Not included (gray dash)
- Number = Limited quantity
- Text = Variable value

---

## Problem/Solution Cards

### Use Case
Homepage problem section

### Problem Card Structure

```
┌─────────────────────────────────────────┐
│  [Icon/Emoji]                           │
│                                         │
│  Problem Headline                       │
│                                         │
│  Description of the pain point in       │
│  1-2 sentences. Make it relatable.      │
│                                         │
└─────────────────────────────────────────┘
```

### Problem Card Content

#### Same Balance, Different Believers
Everyone with 100 tokens looks the same. But someone who held through the bear market is not the same as someone who bought yesterday.

#### Airdrops Go to Farmers
Millions in tokens distributed to bots and mercenaries. Your real community gets diluted.

#### Flat Discord Experience
Your biggest supporters get the same experience as day-one flippers. No recognition, no progression, no reason to stay engaged.

#### Tool Sprawl
Collab.Land for gating. MEE6 for levels. Guild.xyz for requirements. Custom scripts for analytics. It's a mess.

---

## Visual Specifications

### Icon Style
- Line icons (not filled)
- 24x24px or 32x32px
- Brand primary color or gray
- Consistent stroke width

### Card Style
- Background: White
- Border: 1px Gray-200 or shadow-sm
- Border radius: 8px
- Padding: 24px
- Hover: Slight lift (shadow-md)

### Typography
- Title: Semibold, 18px
- Description: Regular, 14-16px, Gray-600
- Bullets: Regular, 14px, Gray-600

### Grid Spacing
- Gap: 24px (mobile), 32px (desktop)
- Cards equal height in row

---

*Components ready for implementation.*

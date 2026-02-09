# Pricing Card Components

**Component:** Pricing Tier Cards
**Used On:** Pricing page, Homepage preview
**Last Updated:** 2026-01-03

---

## Pricing Card: Full (Pricing Page)

### Structure

```
┌─────────────────────────────────────────┐
│  [Badge: Most Popular]                  │
│                                         │
│  Tier Name                              │
│                                         │
│  $XX                                    │
│  /month                                 │
│  or $XX/month billed annually           │
│                                         │
│  Description of who this tier           │
│  is best suited for.                    │
│                                         │
│  ────────────────────────               │
│                                         │
│  ✓ Feature included                     │
│  ✓ Feature included                     │
│  ✓ Feature included                     │
│  ✓ Feature included                     │
│  ✓ Feature included                     │
│                                         │
│  ────────────────────────               │
│                                         │
│  Limits:                                │
│  • Limit description                    │
│  • Limit description                    │
│                                         │
│  [Primary CTA Button]                   │
│                                         │
│  Note text (e.g., "No credit card")     │
│                                         │
└─────────────────────────────────────────┘
```

---

## Tier Card Content

### Free Tier: Explorer

```yaml
name: "Explorer"
tagline: "Free"
price: "$0"
price_suffix: "/month forever"
annual_price: null
description: "Everything you need to get started with token-gated community management."

features:
  - "Token-gating (ERC20 & NFT)"
  - "Multi-chain support"
  - "BasicTheme (3 tiers: Gold, Silver, Bronze)"
  - "5 badge types"
  - "1 Discord server"
  - "Shadow mode (try alongside current setup)"
  - "Self-service wizard"
  - "Community support"

limits:
  - "Balance refresh: Every 24 hours"
  - "No conviction scoring"
  - "No analytics"

cta_text: "Start Free →"
cta_style: "secondary"
note: "No credit card required"
badge: null
highlighted: false
```

### Premium Tier: Sietch

```yaml
name: "Sietch"
tagline: "Premium"
price: "$99"
price_suffix: "/month"
annual_price: "$79/month billed annually"
description: "Engagement intelligence for communities that want to identify and reward their most valuable members."

features:
  - "Everything in Free, plus:"
  - "**Conviction scoring** — identify diamond hands"
  - "**SietchTheme** (9 tiers: Naib → Outsider)"
  - "**10+ badge types** with lineage tracking"
  - "**Analytics dashboard** — community insights"
  - "Up to 3 Discord servers"
  - "1 Telegram group"
  - "Balance refresh: Every 6 hours"
  - "Priority email support"

limits:
  - "3 Discord servers (add more at $29/mo each)"
  - "1 Telegram group (add more at $19/mo each)"

cta_text: "Start Premium →"
cta_style: "primary"
note: null
badge: "🔥 Most Popular"
highlighted: true

special_offer:
  text: "🎁 Founding 50: Get 50% off for life ($49/mo forever)"
  cta: "Claim Founding Pricing →"
```

### Enterprise Tier: Naib Council

```yaml
name: "Naib Council"
tagline: "Enterprise"
price: "$399"
price_suffix: "/month"
annual_price: "$319/month billed annually"
description: "Enterprise-grade infrastructure for protocols and multi-community operators with security and compliance requirements."

features:
  - "Everything in Premium, plus:"
  - "**Custom themes** — your brand, your tiers"
  - "**Unlimited Discord servers**"
  - "**Unlimited Telegram groups**"
  - "**Full API access** — build integrations"
  - "**Audit trail** — compliance-ready logging"
  - "**White-label option** — custom bot name/avatar"
  - "Balance refresh: Every 1 hour"
  - "Dedicated Slack support"
  - "SLA with 4-hour response time"

limits: null

cta_text: "Contact Sales →"
cta_style: "secondary"
note: "Custom pricing available for 10+ communities"
badge: null
highlighted: false
```

---

## Pricing Card: Compact (Homepage Preview)

### Structure

```
┌─────────────────────┐
│  Tier Name          │
│                     │
│  $XX/month          │
│                     │
│  • Key feature      │
│  • Key feature      │
│  • Key feature      │
│                     │
│  [CTA Button]       │
└─────────────────────┘
```

### Compact Content

#### Free
- **Price:** $0/month
- **Features:** BasicTheme (3 tiers) • Token-gating • 1 Discord server
- **CTA:** Start Free →

#### Premium
- **Price:** $99/month
- **Features:** SietchTheme (9 tiers) • Conviction scoring • Analytics dashboard
- **CTA:** Start Premium →

#### Enterprise
- **Price:** $399/month
- **Features:** Custom themes • Unlimited servers • API access
- **CTA:** Contact Sales →

---

## Pricing Toggle Component

### Structure

```
┌─────────────────────────────────────────┐
│                                         │
│      [ Monthly ]  [ Annual — Save 20% ] │
│                                         │
└─────────────────────────────────────────┘
```

### Behavior
- Default: Monthly selected
- Annual: Show discounted prices
- Animation: Smooth price transition

### Prices by Toggle

| Tier | Monthly | Annual (per month) | Savings |
|------|---------|-------------------|---------|
| Free | $0 | $0 | — |
| Premium | $99 | $79 | 20% |
| Enterprise | $399 | $319 | 20% |

---

## Add-On Cards

### Structure

```
┌─────────────────────────────────────────┐
│                                         │
│  Add-On Name                            │
│  $XX/month or $XX one-time              │
│                                         │
│  Brief description of what this         │
│  add-on provides.                       │
│                                         │
│  Available on: [Tier badge]             │
│                                         │
└─────────────────────────────────────────┘
```

### Add-On Content

#### Additional Discord Server
- **Price:** $29/month per server
- **Description:** Add more Discord servers to your Premium plan
- **Available on:** Premium

#### Additional Telegram Group
- **Price:** $19/month per group
- **Description:** Add more Telegram groups to your Premium plan
- **Available on:** Premium

#### Custom Badge Design
- **Price:** $199 one-time
- **Description:** Professional badge artwork designed for your theme
- **Available on:** Premium, Enterprise

#### Theme Customization
- **Price:** $499 one-time
- **Description:** Custom theme design with your branding
- **Available on:** Premium (upgrade to custom theme)

---

## Visual Specifications

### Card Dimensions
- Width: 320-360px
- Min-height: Auto (content-driven)
- Equal height in row

### Highlighted Card (Premium)
- Border: 2px Brand Primary
- Shadow: shadow-lg
- Badge: Positioned top-right or top-center
- Scale: 1.02x (subtle)

### Standard Card
- Border: 1px Gray-200
- Shadow: shadow-sm
- Background: White

### Typography
- Tier name: Bold, 24px
- Price: Bold, 48px
- Price suffix: Regular, 16px, Gray-500
- Annual price: Regular, 14px, Gray-500
- Description: Regular, 14px, Gray-600
- Features: Regular, 14px
- Feature bold: Semibold

### Colors
- Checkmarks: Green-500
- Highlighted border: Brand Primary
- Badge background: Brand Primary
- Badge text: White

### Spacing
- Card padding: 32px
- Feature list gap: 12px
- Section divider: 24px margin

---

## Founding 50 Promotion Banner

### Inline with Premium Card

```
┌─────────────────────────────────────────┐
│  🎁 Founding 50                         │
│                                         │
│  First 50 customers get 50% off         │
│  Premium for life.                      │
│                                         │
│  $49/mo instead of $99/mo — forever     │
│                                         │
│  [X] spots remaining                    │
│                                         │
│  [Claim Your Spot →]                    │
└─────────────────────────────────────────┘
```

### Counter Logic
- Display remaining spots
- Update in real-time or on page load
- Hide when 0 spots remaining
- Replace with "Founding 50 sold out" message

---

*Components ready for implementation.*

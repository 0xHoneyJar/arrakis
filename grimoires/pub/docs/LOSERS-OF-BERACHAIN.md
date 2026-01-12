# LOSERS OF BERACHAIN

> Productive self-FUD: Convert your losses into social currency.

## Overview

A viral GTM campaign that calculates users' USD losses on Berachain and converts them into SPICE credits on Arrakis. The goal is to create chaos on the TL, drive registrations, and establish cultural gravity around the SCORE system.

**Inspired by:** ETH burned gas trackers, but inverted - we celebrate the rekt.

---

## Entry Point Options (NEEDS DECISION)

### Option A: Landing Page First (Recommended)

```
arrakis.community/losers
    ↓
Connect Wallet (see loss amount + tier preview)
    ↓
"Login with Discord to claim SPICE"
    ↓
Discord OAuth → auto-join THJ Discord
    ↓
Roles assigned based on tier
    ↓
Generate full card → share to Twitter
```

**Pros:**
- Public landing page = SEO, shareable link
- Wallet captured before Discord join (data)
- Can show "X people lost $Y" social proof on page
- Twitter share can link back to landing page (viral loop)

**Cons:**
- Two-step friction (wallet + Discord OAuth)
- Need to build landing page claim UI

---

### Option B: Discord First

```
arrakis.community/losers → redirects to Discord invite
    ↓
Join THJ Discord
    ↓
/losers command (or dedicated channel)
    ↓
Arrakis bot prompts wallet connect
    ↓
Bot generates card, posts in channel/DM
    ↓
User downloads → shares to Twitter manually
```

**Pros:**
- All in Discord (home turf)
- Lower dev lift if bot infra exists
- Direct Discord member growth

**Cons:**
- No public preview (must join to see anything)
- Harder viral loop (no shareable landing page)
- Manual screenshot/download for Twitter sharing

---

### Key Decision Points

| Question | Option A | Option B |
|----------|----------|----------|
| Where does wallet connect happen? | Landing page | Discord bot |
| Where does card generate? | Backend → served on landing page | Bot → posted in Discord |
| How does Twitter share work? | One-click share button on landing page | Manual download from Discord |
| Where does SPICE credit? | After Discord OAuth completes | After bot wallet verify |
| Where does mint happen? | Landing page (web3 modal) | Bot command triggers tx |

---

### Hybrid Consideration

Could do landing page for **discovery + wallet** but Discord for **claim + share**:

```
Landing page: wallet connect → see losses → blurred card preview
    ↓
CTA: "Join Discord to unlock full card + claim SPICE"
    ↓
Discord: /claim-loser → full card + SPICE + shareable image
```

This captures wallet data early but keeps the "reward" in Discord.

---

## Campaign Flow (Once Entry Point Decided)

---

## Credit System: SPICE

### Singular Currency

**Name:** SPICE (or MELANGE)

**Conversion:** `$1 USD loss = 1 SPICE`

Like GP in RuneScape - flat, fungible, spendable within Arrakis.

**Properties:**
- Initially non-transferable
- Offchain for simplicity
- Used for Arrakis features/integrations
- Marketing budget in credit form

**Visual Treatment:**
```
◆ 4,392 SPICE
```
- Gem icon (◆) in brand spice color (#f4a460)
- Monospace display
- Subtle sandstorm particle effect on hover

---

## Flex Tiers: LOSS RANKS

Non-transferable badges that unlock card backgrounds and flex symbols.

### Tier Table

| Tier | Loss Range | Title | Card Background | Symbol |
|------|------------|-------|-----------------|--------|
| 0 | $0-100 | **Tourist** | Plain dark | None |
| 1 | $100-1K | **Outsider** | Subtle sand texture | Single worm track |
| 2 | $1K-10K | **Fremen** | Sand dunes | Crysknife |
| 3 | $10K-50K | **Fedaykin** | Deep desert storm | Maker hooks |
| 4 | $50K-100K | **Naib** | Spice blow eruption | Stilsuit mask |
| 5 | $100K+ | **Kwisatz Haderach** | Full sandworm emergence | The sleeper has awakened |

### Alternative Names (Meme-able)

| Dune Title | Degen Title |
|------------|-------------|
| Tourist | Paper Hands |
| Outsider | Bag Holder |
| Fremen | Diamond Hands (Cope) |
| Fedaykin | Professional Loser |
| Naib | Generational Wealth Destroyer |
| Kwisatz Haderach | The Liquidated One |

### Tier Colors (Brand Palette)

| Tier | Color | Hex |
|------|-------|-----|
| Tourist | Sand dim | `#6b6245` |
| Outsider | Sand | `#c9b99a` |
| Fremen | Spice | `#f4a460` |
| Fedaykin | Ruby | `#c45c4a` |
| Naib | Blue | `#5b8fb9` |
| Kwisatz Haderach | Bright gold | `#ffd700` |

---

## Shareable Card Design

```
┌─────────────────────────────────────────┐
│  [tier background - sandstorm/worms]    │
│                                         │
│                              ┌───┐      │
│                              │ F │ ←tier│
│    0xABC...123               └───┘      │
│    ─────────────                        │
│                                         │
│    ◆ 47,293 SPICE                       │
│                                         │
│    "I am become loss,                   │
│     destroyer of portfolios"            │
│                                         │
│    ───────────────────────────          │
│    LOSERS OF BERACHAIN                  │
│    arrakis.community                    │
└─────────────────────────────────────────┘
```

### Card Background Concepts

| Tier | Background |
|------|------------|
| Tourist | Flat dark (#0a0a0a) |
| Outsider | Faint topographic contour lines |
| Fremen | Animated sand particles drifting slowly |
| Fedaykin | Subtle spice glow radiating from center |
| Naib | Sandworm silhouettes in deep background |
| Kwisatz Haderach | Full animated sandworm emergence with spice explosion |

### Badge Placement Options

1. Top right corner letter (like CQ cards)
2. Watermark symbol behind loss amount
3. Border treatment (subtle glow in tier color)

---

## Gating Mechanics

### To Claim SPICE

1. Connect wallet
2. System calculates total USD losses on Berachain
3. Generate shareable card with graffiti'd Milady art
4. **Mint NFT** (1 BERA fee) - mental barrier / skin in game
5. **Share to X/Twitter** (required) - social distribution
6. SPICE credited to Arrakis account

### Why 1 BERA Mint?

- Creates mental barrier (they've invested something)
- Skin in the game psychology
- Nominal revenue
- Filters drive-by claimers

---

## SCORE Integration (Phase 2)

Only users with **SCORE >= 70** can sell SPICE in the marketplace.

**Effects:**
- Drives attention to SCORE system
- Rewards aligned community members
- Creates FOMO from non-aligned users
- Marketplace fees = revenue

### Marketplace Rules

| SCORE | Capability |
|-------|------------|
| < 70 | Hold, spend, or gift SPICE only |
| >= 70 | Can list SPICE for sale |
| >= 90 | Reduced marketplace fees |

---

## Future Considerations

### Pendle-style Separation (Phase 3+)

For select high-SCORE accounts:
- **PT (Principal Token):** One-time SPICE position
- **YT (Yield Token):** Ongoing credit stream

### Revenue Share Raise

Potential structure:
- Raise funds for % of revenue share
- Participants receive:
  - Pro-rata revenue share
  - Allocated SPICE credits to sell/use/gift
  - Access to native marketplace

**NOT tokens** - but speculative instruments with real output.

### Multi-Chain Expansion

If campaign succeeds:
- Partner with other L1/L2 foundations
- Create chain-specific "LOSERS OF [CHAIN]" campaigns
- Foundations subsidize SCORE model development
- Cross-ecosystem healing events

---

## Data Requirements

### Loss Calculation Formula

```
Total Loss = Σ(Amount Spent USD) - Σ(Current Value USD)
```

**Data points needed:**
- All wallet transactions on Berachain
- Historical USD prices at time of transaction
- Current holdings and their USD value
- Exclude: bridged assets (only native activity)

### Dune Query Structure

```sql
-- Pseudo-query
SELECT
  wallet_address,
  SUM(usd_value_at_tx_time) as total_spent,
  SUM(current_usd_value) as current_value,
  total_spent - current_value as total_loss
FROM berachain_transactions
GROUP BY wallet_address
```

---

## Success Metrics

### Phase 1 (Launch)

- [ ] X viral cards shared
- [ ] X unique wallet connections
- [ ] X NFTs minted (1 BERA each)
- [ ] X Arrakis registrations

### Phase 2 (Conversion)

- [ ] X% of registrants become paying subscribers
- [ ] X SPICE spent on integrations
- [ ] X marketplace transactions (SCORE >= 70)

---

## Timeline

| Phase | Milestone |
|-------|-----------|
| **NOW** | Prepare Dune data queries |
| **Week 1** | Card design + shareable generation |
| **Week 2** | Mint contract + claim flow |
| **Week 3** | Launch campaign |
| **Week 4+** | Monitor virality, iterate |
| **TBD** | Enable marketplace (requires subscribers) |

---

## Technical Dependencies

### What We Need to Build/Verify

| Component | Option A (Landing Page) | Option B (Discord) | Status |
|-----------|------------------------|--------------------| -------|
| Wallet connect | Web3 modal on landing page | Arrakis bot verify | ? |
| Loss calculation | Dune API call | Dune API call | Need query |
| Card generation | Server-side (Sharp/Canvas) | Bot-side or shared API | TBD |
| Card storage | S3/Cloudflare R2 | Same | TBD |
| Discord OAuth | NextAuth or similar | N/A (already in Discord) | - |
| SPICE ledger | Drizzle (Arrakis DB) | Same | Exists? |
| Mint contract | Web3 modal trigger | Bot command trigger | Need contract |
| Twitter share | Intent URL with card link | Manual download | - |

### Arrakis Bot - What Exists (sietch-service)

**Wallet Verification:** YES - via Collab.Land
- `IdentityService` handles verification sessions
- `wallet-queries.ts` stores Discord ↔ wallet mappings
- Flow: Create session → Collab.Land verify URL → callback confirms

**Existing Commands:**
- `/profile`, `/stats`, `/leaderboard`, `/position`
- `/badges`, `/alerts`, `/threshold`
- `/naib` (admin), `/onboard`

**Can post images:** Yes (Discord embeds support image URLs)

**DB:** SQLite via Drizzle - has `wallet_mappings` table

**What we'd add:**
- `/losers` command (or integrate into existing flow)
- SPICE ledger table
- Card generation service
- Loss calculation via Dune API

### Image Serving for Shareables

**Size:** 1200 x 675 (works on both Twitter + Discord)

**Flow:**
```
Generate card (server-side)
    → Store in R2/S3
    → Return public URL
    → Use in Discord embed / Twitter card meta
```

Discord can display images via URL embed. Twitter needs `og:image` meta tag on a public URL.

---

## Open Questions

- [ ] **Entry point:** Option A (landing page) or Option B (Discord)?
- [ ] Final art direction for graffiti'd Miladies?
- [ ] Exact SCORE threshold for marketplace access?
- [ ] SPICE sink mechanics beyond marketplace?
- [ ] Integration partners for SPICE spending?
- [ ] Multi-sig or custodial for SPICE ledger?

---

## References

- [ETH Burned Gas Tracker](https://ultrasound.money/)
- [Drip.haus Credit System](https://drip.haus/)
- [CQ Flex Mechanics](internal)
- [Paddle Billing](https://paddle.com/)

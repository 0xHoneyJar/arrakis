# Henlocker BGT Redemption Tracking Guide

## Overview

This document explains how BGT (Berachain Governance Token) flows through the Henlocker ecosystem on Berachain, and how to track redemptions and user behavior.

---

## What is BGT?

BGT is Berachain's governance token with unique properties:

- **Non-transferable** (soulbound) - cannot be sold or traded directly
- **Earned through staking** - validators distribute BGT to reward vaults
- **Can be burned/redeemed** - users can burn BGT to receive BERA (the native gas token)
- **Used for governance** - voting on protocol decisions

---

## What are Henlockers?

Henlockers are liquidity lockers in the HENLO token ecosystem on Berachain. They come in different tiers based on capacity:

| Tier | Gauge Address |
|------|---------------|
| 100M | `0x4D615305Fe6c7A93e16c174D9076efEFbbA0C9A6` |
| 330M | `0x6A0dFE7c04346E5f718a1ecc24FAbe9ef57eDC0e` |
| 420M | `0x679fB5d465e082e398f1E05C0071E606A3651f55` |
| 690M | `0xE7F25F8C17D478e387756B588Bf7F32e9152bae6` |
| 1B   | `0x7941Dd6fc9519514B185B5D3966f673F910E1e7d` |

Each locker has an associated **reward vault** that receives BGT emissions from validators.

---

## BGT Flow Diagram

```
                    VALIDATORS
                        │
                        │ distributor_evt_distributed
                        ▼
            ┌───────────────────────┐
            │   HENLOCKER REWARD    │
            │       VAULTS          │
            │   (query_4875010)     │
            └───────────────────────┘
                   │         │
                   │         │
          claimed  │         │  unclaimed
                   │         │
                   ▼         ▼
            ┌──────────┐  ┌──────────────┐
            │  USERS   │  │  SITTING IN  │
            │          │  │    VAULT     │
            └──────────┘  └──────────────┘
                   │
                   │ rewardvault_evt_rewardpaid
                   ▼
            ┌───────────────────────┐
            │     RECIPIENTS        │
            │  (users or contracts) │
            └───────────────────────┘
                   │         │
                   │         │
           burned  │         │  held
                   │         │
                   ▼         ▼
            ┌──────────┐  ┌──────────┐
            │  BURNED  │  │   HELD   │
            │ (0x000)  │  │ BY USER  │
            └──────────┘  └──────────┘
```

---

## Key Concepts

### 1. BGT Distribution (Validators → Vaults)

Validators earn BGT through block production and distribute it to reward vaults based on gauge weights. This is tracked via:

```sql
berachain_berachain.distributor_evt_distributed
```

**Key fields:**
- `receiver` - the reward vault address
- `amount` - BGT distributed (in wei, divide by 1e18)

### 2. BGT Claims (Vaults → Users)

Users who have staked in henlockers can claim their BGT rewards. When they call `getReward()`, the vault emits:

```sql
berachain_berachain.rewardvault_evt_rewardpaid
```

**Key fields:**
- `contract_address` - the reward vault
- `account` - user who earned the reward
- `reward` - amount claimed (in wei)
- `to` - recipient address (may differ from account if using aggregators)

### 3. BGT Burns (Users → Redemption)

Users can burn BGT to receive BERA. Burns are detected by transfers to the zero address:

```sql
berachain_berachain.bgt_evt_transfer
WHERE "to" = 0x0000000000000000000000000000000000000000
```

---

## Tracking Metrics

### What We Can Measure

| Metric | Description | Source |
|--------|-------------|--------|
| **Total BGT to Vaults** | BGT distributed to henlocker reward vaults | `distributor_evt_distributed` |
| **Total BGT Claimed** | BGT withdrawn by users | `rewardvault_evt_rewardpaid` |
| **Unclaimed in Vaults** | BGT sitting in vaults (to_vaults - claimed) | Calculated |
| **BGT Burned** | BGT redeemed for BERA | `bgt_evt_transfer` to 0x0 |
| **BGT Held** | Claimed but not burned | Calculated |

### Percentages

- **% Claimed** = claimed / to_vaults
- **% Unclaimed** = unclaimed / to_vaults
- **% Burned of Claimed** = burned / claimed
- **% Held of Claimed** = held / claimed

---

## Important Caveats

### 1. Recipient vs Account

The `to` field in `rewardvault_evt_rewardpaid` may not be the user's wallet. Common patterns:

- Direct claims: `to` = user's wallet
- Aggregator/autocompounder: `to` = contract address (e.g., `0xb71b3daea39012fb0f2b14d2a9c86da9292fc126`)

### 2. Attribution Limitations

When tracking burns, we can only attribute burns to "addresses that received BGT from henlockers." These addresses may have:

- Received BGT from multiple sources (not just henlockers)
- Transferred BGT to another address before burning

This means burn tracking is an **approximation**, not exact attribution.

### 3. BGT is Non-Transferable (Mostly)

While BGT cannot be freely transferred between users, it can be:

- Distributed from validators to vaults
- Claimed from vaults to users
- Delegated for governance
- Burned/redeemed

---

## Dune Tables Reference

| Table | Purpose |
|-------|---------|
| `berachain_berachain.distributor_evt_distributed` | BGT distribution to reward vaults |
| `berachain_berachain.rewardvault_evt_rewardpaid` | User claims from reward vaults |
| `berachain_berachain.bgt_evt_transfer` | All BGT transfers (mints, burns) |
| `query_4875010` | Henlocker reward vault addresses |
| `query_4875121` | Henlocker daily locked amounts |

### BGT Transfer Patterns

| From | To | Meaning |
|------|----|---------|
| `0x000...000` | Any | BGT minted (new supply) |
| Any | `0x000...000` | BGT burned (redeemed for BERA) |
| Distributor | Vault | Validator emissions to vault |

---

## Related Queries

### henlockers.txt
Calculates ROI for henlocker depositors by comparing:
- Initial deposit value (HENLO locked)
- Cumulative emissions received (BGT + OBERO)

### henlocker-bgt-redemptions.sql
Tracks the full BGT lifecycle for henlockers:
- Distribution to vaults
- Claims by users
- Burns/redemptions

---

## Example Use Cases

### 1. "What % of henlocker BGT rewards are being redeemed?"

Run `henlocker-bgt-redemptions.sql` and look at `pct_burned_of_claimed`.

### 2. "How much BGT is sitting unclaimed in henlocker vaults?"

Check `unclaimed_in_vaults` from the query output.

### 3. "Are henlocker users holding or selling their BGT?"

Compare `pct_burned_of_claimed` vs `pct_held_of_claimed`. High burn rate suggests users are converting to BERA.

---

## Notes

- All amounts in queries are converted from wei (divide by 1e18)
- Timestamps are in UTC
- `query_4875010` must be accessible in your Dune account for the redemption tracker to work

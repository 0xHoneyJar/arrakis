-- ============================================================================
-- HENLOCKER BGT REDEMPTION TRACKER (CHART VERSION)
-- ============================================================================
-- Tracks BGT flow: Validators → Reward Vaults → Users → Burn/Hold
-- Burns are CAPPED at the amount each recipient claimed from henlockers
-- Output formatted for donut/pie chart visualization
-- ============================================================================

with henlocker_vaults as (
    select distinct reward_vault
    from query_4875010
),

-- ============================================================================
-- STEP 1: BGT distributed TO henlocker vaults (from validators)
-- ============================================================================
bgt_to_vaults as (
    select
        receiver           as vault,
        sum(amount / 1e18) as bgt_distributed
    from berachain_berachain.distributor_evt_distributed
    where receiver in (select reward_vault from henlocker_vaults)
    group by 1
),

-- ============================================================================
-- STEP 2: BGT claimed BY users FROM henlocker vaults (RewardPaid events)
-- ============================================================================
bgt_claimed as (
    select
        "to"               as recipient,
        sum(reward / 1e18) as bgt_claimed
    from berachain_berachain.rewardvault_evt_rewardpaid
    where contract_address in (select reward_vault from henlocker_vaults)
    group by 1
),

-- ============================================================================
-- STEP 3: Total BGT claimed per recipient (for capping burns)
-- ============================================================================
recipient_totals as (
    select
        recipient,
        sum(bgt_claimed) as total_claimed_by_recipient
    from bgt_claimed
    group by 1
),

-- ============================================================================
-- STEP 4: Total BGT burned per recipient (all burns, uncapped)
-- ============================================================================
recipient_burns_raw as (
    select
        "from"            as recipient,
        sum(value / 1e18) as total_burned_by_recipient
    from berachain_berachain.bgt_evt_transfer
    where "to" = 0x0000000000000000000000000000000000000000
      and "from" in (select recipient from recipient_totals)
    group by 1
),

-- ============================================================================
-- STEP 5: Cap burns at claimed amount (can't burn more than you got)
-- ============================================================================
recipient_burns_capped as (
    select
        r.recipient,
        least(
            coalesce(b.total_burned_by_recipient, 0),
            r.total_claimed_by_recipient
        ) as capped_burned
    from recipient_totals r
    left join recipient_burns_raw b on b.recipient = r.recipient
),

-- ============================================================================
-- STEP 6: Aggregate totals
-- ============================================================================
totals as (
    select
        (select coalesce(sum(bgt_distributed), 0) from bgt_to_vaults)        as total_bgt_to_vaults,
        (select coalesce(sum(bgt_claimed), 0) from bgt_claimed)              as total_bgt_claimed,
        (select coalesce(sum(capped_burned), 0) from recipient_burns_capped) as total_bgt_burned
)

-- ============================================================================
-- FINAL OUTPUT (for donut/pie chart)
-- ============================================================================
select category, value, pct from (
    select
        1 as sort,
        'Unclaimed in Vaults' as category,
        total_bgt_to_vaults - total_bgt_claimed as value,
        round(100.0 * (total_bgt_to_vaults - total_bgt_claimed) / total_bgt_to_vaults, 1) as pct
    from totals

    union all

    select
        2,
        'Claimed & Burned',
        total_bgt_burned,
        round(100.0 * total_bgt_burned / total_bgt_to_vaults, 1)
    from totals

    union all

    select
        3,
        'Claimed & Held',
        total_bgt_claimed - total_bgt_burned,
        round(100.0 * (total_bgt_claimed - total_bgt_burned) / total_bgt_to_vaults, 1)
    from totals
) t
order by sort

-- ============================================================================
-- HENLOCKER VAULTS BGT STATUS (for stacked bar chart)
-- ============================================================================
-- DUNE PARAMETER: Create "sort_by" dropdown with these values:
--   received_desc, burned_raw_desc, burned_raw_asc, burned_pct_desc, burned_pct_asc
-- ============================================================================

with
henlocker_vaults as (
    select distinct reward_vault
    from query_4875010
),

bgt_distributed as (
    select
        receiver as vault,
        sum(amount / 1e18) as total_distributed
    from berachain_berachain.distributor_evt_distributed
    where receiver in (select reward_vault from henlocker_vaults)
    group by 1
),

claims_by_vault_recipient as (
    select
        contract_address as vault,
        "to" as recipient,
        sum(reward / 1e18) as claimed
    from berachain_berachain.rewardvault_evt_rewardpaid
    where contract_address in (select reward_vault from henlocker_vaults)
    group by 1, 2
),

claims_by_vault as (
    select vault, sum(claimed) as total_claimed
    from claims_by_vault_recipient
    group by 1
),

all_burns as (
    select
        "from" as recipient,
        sum(value / 1e18) as total_burned
    from berachain_berachain.bgt_evt_transfer
    where "to" = 0x0000000000000000000000000000000000000000
    group by 1
),

burns_capped_by_vault as (
    select
        c.vault,
        least(coalesce(b.total_burned, 0), c.claimed) as capped_burned
    from claims_by_vault_recipient c
    left join all_burns b on b.recipient = c.recipient
),

burns_by_vault as (
    select vault, sum(capped_burned) as total_burned
    from burns_capped_by_vault
    group by 1
),

vault_summary as (
    select
        d.vault,
        d.total_distributed,
        coalesce(c.total_claimed, 0) as total_claimed,
        coalesce(b.total_burned, 0) as total_burned,
        d.total_distributed - coalesce(c.total_claimed, 0) as unclaimed,
        coalesce(c.total_claimed, 0) - coalesce(b.total_burned, 0) as held,
        round(100.0 * coalesce(b.total_burned, 0) / nullif(d.total_distributed, 0), 2) as pct_burned
    from bgt_distributed d
    left join claims_by_vault c on c.vault = d.vault
    left join burns_by_vault b on b.vault = d.vault
    where d.total_distributed > 0
),

ranked_vaults as (
    select
        *,
        row_number() over (order by total_distributed desc) as rank_received,
        row_number() over (order by total_burned desc) as rank_burned_raw,
        row_number() over (order by total_burned asc) as rank_burned_raw_least,
        row_number() over (order by pct_burned desc) as rank_burned_pct,
        row_number() over (order by pct_burned asc) as rank_burned_pct_least
    from vault_summary
),

top_vaults as (
    select
        vault,
        total_distributed,
        total_burned,
        unclaimed,
        held,
        pct_burned,
        case '{{sort_by}}'
            when 'burned_raw_desc' then rank_burned_raw
            when 'burned_raw_asc' then rank_burned_raw_least
            when 'burned_pct_desc' then rank_burned_pct
            when 'burned_pct_asc' then rank_burned_pct_least
            else rank_received
        end as display_order
    from ranked_vaults
    where
        case '{{sort_by}}'
            when 'burned_raw_desc' then rank_burned_raw
            when 'burned_raw_asc' then rank_burned_raw_least
            when 'burned_pct_desc' then rank_burned_pct
            when 'burned_pct_asc' then rank_burned_pct_least
            else rank_received
        end <= 42
)

select vault, display_order, total_distributed, pct_burned, 'Unclaimed' as category, unclaimed as value from top_vaults
union all
select vault, display_order, total_distributed, pct_burned, 'Burned' as category, total_burned as value from top_vaults
union all
select vault, display_order, total_distributed, pct_burned, 'Held' as category, held as value from top_vaults
order by display_order, case category when 'Unclaimed' then 1 when 'Held' then 2 when 'Burned' then 3 end

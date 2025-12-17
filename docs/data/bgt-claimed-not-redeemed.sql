-- Users who claimed BGT but never redeemed (burned) any
-- Ordered by most BGT held

with bgt_claimed as (
    select
        "to"               as recipient,
        sum(reward / 1e18) as bgt_claimed
    from berachain_berachain.rewardvault_evt_rewardpaid
    group by 1
),

bgt_burned as (
    select
        "from"            as recipient,
        sum(value / 1e18) as bgt_burned
    from berachain_berachain.bgt_evt_transfer
    where "to" = 0x0000000000000000000000000000000000000000
    group by 1
)

select
    c.recipient,
    c.bgt_claimed as bgt_held
from bgt_claimed c
left join bgt_burned b on b.recipient = c.recipient
where coalesce(b.bgt_burned, 0) = 0
order by c.bgt_claimed desc

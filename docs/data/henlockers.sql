with drom_gauges as (
    select '100M' as name,0x4D615305Fe6c7A93e16c174D9076efEFbbA0C9A6 as gauge
    UNION
    select '330M',0x6A0dFE7c04346E5f718a1ecc24FAbe9ef57eDC0e
    UNION
    select '420M',0x679fB5d465e082e398f1E05C0071E606A3651f55
    UNION
    select '690M',0xE7F25F8C17D478e387756B588Bf7F32e9152bae6
    UNION
    select '1B',0x7941Dd6fc9519514B185B5D3966f673F910E1e7d
),
henlocked_capacity as (
    select * from (
        select l.day, locker_name, locked_amount,
                locked_amount*price as locked_usd_value,
                sum(locked_amount) over (partition by locker_name order by l.day) as cumulative_locked_amount,
                cumulative_locked_amount*price as cumulative_usd_value
        from query_4875121 l
        join (
            select day, price from prices.usd_daily
            where blockchain='berachain' and symbol='HENLO'
        ) p
        on p.day=l.day
        order by 1 desc
    )
    where day = timestamp '{{deposit_date}}'
),
daily_obero as (
    select day, name, max(obero_emissions) as obero_emissions, max(obero_emissions)*avg(price) as obero_usd_value 
    from (
        select date_trunc('day',evt_block_time) as week,name,
                    sum(value/1e18) as obero_emissions
        from erc20_berachain.evt_transfer t
        join drom_gauges g on g.gauge=t.to
        where "from"=0xd7ea36eca1ca3e73bc262a6d05db01e60ae4ad47
        and contract_address=0x40a8d9efe6a2c6c9d193cc0a4476767748e68133
        group by 1,2
    ) e
    join query_4741016 p on p.day=e.week
    where day >= timestamp '{{deposit_date}}'
    group by 1,2
),
bgt_emissions as (
    select day, locker_name, bgt_received, usd_value,
            sum(bgt_received) over (partition by locker_name order by day) as cumulative_bgt_per,
            sum(usd_value) over (partition by locker_name order by day) as cumulative_usd_value_per
    from (
        select b.day,locker_name, max(bgt_received) as bgt_received, max(bgt_received*price) as usd_value from (
            select date_trunc('day',evt_block_time) as day,receiver,sum(b.amount/1e18) as bgt_received 
            from berachain_berachain.distributor_evt_distributed b
            where receiver in (select distinct reward_vault from query_4875010)
            group by 1,2
        ) b
        join query_4875010 r on r.reward_vault=b.receiver
        join prices.usd_daily d on d.day=b.day
        where blockchain='berachain' and symbol='iBGT'
        and b.day >= timestamp '{{deposit_date}}'
        group by 1,2
    )
    order by day desc
),
data as (
    select day, locker_name, bgt_received, obero_emissions, bgt_usd_value, obero_usd_value,
            sum(bgt_usd_value) over (partition by locker_name order by day) as cumulative_bgt_usd_value_per,
            sum(obero_usd_value) over (partition by locker_name order by day) as cumulative_obero_usd_value_per,
            /*sum(bgt_usd_value) over (order by day) as cumulative_bgt_usd_value,
            sum(obero_usd_value) over (order by day) as cumulative_obero_usd_value,*/
            sum(bgt_usd_value+obero_usd_value) over (partition by locker_name order by day) as cumulative_usd_value_per
            --sum(bgt_usd_value+obero_usd_value) over (order by day) as cumulative__usd_value
    from (
        select coalesce(b.day,o.day) as day, coalesce(b.locker_name,name) as locker_name,
                coalesce(bgt_received,0) as bgt_received, coalesce(obero_emissions,0) as obero_emissions,
                coalesce(usd_value,0) as bgt_usd_value, coalesce(obero_usd_value,0) as obero_usd_value
                --coalesce(cumulative_locked_amount,0) as cumulative_locked_amount, coalesce(cumulative_usd_value,0) as cumulative_usd_value
        from bgt_emissions b
        full join daily_obero o on o.day=b.day and o.name=b.locker_name
        --full join henlocked_capacity h on h.day=b.day and h.locker_name=b.locker_name
    )
    where bgt_usd_value>0
    order by 1 desc
),
daily_values as (
    select d.day, d.locker_name, cumulative_bgt_usd_value_per,cumulative_obero_usd_value_per,cumulative_usd_value_per, 
            cumulative_locked_amount,cumulative_usd_value as cumulative_locked_usd_value_per,
            cumulative_usd_value_per - cumulative_usd_value as profits,
            (cumulative_usd_value_per*1.00 / cumulative_usd_value) as profits_percent,
            (cumulative_usd_value_per*1.00 / cumulative_usd_value)-1.00 as roi_percent
    from data d
    join henlocked_capacity h on h.locker_name=d.locker_name
    order by 1 desc
),
daily_sums as (
    select day, sum(cumulative_usd_value_per) as total_emissions_usd, sum(cumulative_locked_usd_value_per) as value_locked
    from daily_values group by 1
)

select d.day, locker_name, cumulative_bgt_usd_value_per,cumulative_obero_usd_value_per,cumulative_usd_value_per,cumulative_locked_usd_value_per,
        profits, profits_percent, total_emissions_usd, value_locked,roi_percent
from daily_values d
join daily_sums s on d.day=s.day
order by 1 desc

--lock value on given day was $x
--$y worth of emissions have been received by the locker since that given day
--so y - x = profits from locking on that day
--current version is using $ value of henlo deposit on given DAY (so compares initial henlo usd value and locking)
--make alternate version using daily henlo price instead, to compare holding and locking
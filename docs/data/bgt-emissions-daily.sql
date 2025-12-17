select d_day,sum(bgt_emissioned) as bgt_emissioned,sum(bgt_burnt) as bgt_burnt from(
select date_trunc('day',t.evt_block_time) as d_day
,sum(t.value/1e18) as bgt_emissioned
,0 as bgt_burnt
from berachain_berachain.bgt_evt_transfer t 
where "from" = 0x0000000000000000000000000000000000000000
group by 1
union all
select date_trunc('day',t.evt_block_time) as d_day
,0 as bgt_emissioned
,-sum(t.value/1e18) as bgt_burnt
from berachain_berachain.bgt_evt_transfer t 
where "to" = 0x0000000000000000000000000000000000000000
group by 1)
group by 1
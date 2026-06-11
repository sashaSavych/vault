-- Custom sort order for accounts list.
-- Safe to re-run. Run after account.sql.

alter table public.accounts
  add column if not exists sort_order int not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by is_default desc, created_at asc
    ) - 1 as rn
  from public.accounts
)
update public.accounts as a
set sort_order = ranked.rn
from ranked
where a.id = ranked.id
  and a.sort_order = 0
  and ranked.rn > 0;

create index if not exists accounts_user_sort_idx
  on public.accounts (user_id, sort_order);

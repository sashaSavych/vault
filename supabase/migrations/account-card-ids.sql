-- Multiple 4-digit card IDs per account (for statement import matching).
-- Safe to re-run. Run this ENTIRE script (not only the constraint section).

-- 1) Add new column
alter table public.accounts
  add column if not exists card_ids text[];

-- 2) Copy data from legacy card_id column when present
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'card_id'
  ) then
    update public.accounts
    set card_ids = array[card_id]
    where card_ids is null;
  end if;
end;
$$;

-- 3) Default for any remaining rows
update public.accounts
set card_ids = array['0000']
where card_ids is null;

alter table public.accounts
  alter column card_ids set default array['0000'];

alter table public.accounts
  alter column card_ids set not null;

-- 4) Validation helper (CHECK constraints cannot use subqueries)
create or replace function public.valid_account_card_ids(ids text[])
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  id text;
begin
  if coalesce(array_length(ids, 1), 0) < 1 then
    return false;
  end if;

  foreach id in array ids loop
    if id !~ '^\d{4}$' then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.accounts drop constraint if exists accounts_card_ids_format_check;
alter table public.accounts
  add constraint accounts_card_ids_format_check
  check (public.valid_account_card_ids(card_ids));

-- 5) Drop legacy column
alter table public.accounts drop constraint if exists accounts_card_id_format_check;
alter table public.accounts drop column if exists card_id;

-- Debts: borrow/lend with account balance updates.
-- Safe to re-run. Requires account.sql.
-- Then run debt-operations.sql — or run debts-setup.sql for both in one go.

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  amount numeric(19, 4) not null check (amount > 0),
  balance numeric(19, 4) not null check (balance >= 0),
  date date not null default current_date,
  type text not null check (type in ('borrow', 'lend')),
  created_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on public.debts (user_id);
create index if not exists debts_account_id_idx on public.debts (account_id);
create index if not exists debts_date_idx on public.debts (date desc);

alter table public.debts enable row level security;

drop policy if exists "debts_select_own" on public.debts;
create policy "debts_select_own"
  on public.debts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "debts_insert_own" on public.debts;
create policy "debts_insert_own"
  on public.debts
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "debts_update_own" on public.debts;
create policy "debts_update_own"
  on public.debts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "debts_delete_own" on public.debts;
create policy "debts_delete_own"
  on public.debts
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.debts_prepare_insert()
returns trigger
language plpgsql
as $$
begin
  new.balance := new.amount;
  return new;
end;
$$;

drop trigger if exists debts_prepare_insert on public.debts;
create trigger debts_prepare_insert
  before insert on public.debts
  for each row
  execute function public.debts_prepare_insert();

create or replace function public.debts_account_delta(p_debt_type text, p_amount numeric)
returns numeric
language sql
immutable
as $$
  select case p_debt_type
    when 'borrow' then p_amount
    when 'lend' then -p_amount
    else 0
  end;
$$;

create or replace function public.debts_apply_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric(19, 4);
begin
  if tg_op = 'INSERT' then
    v_delta := public.debts_account_delta(new.type, new.amount);
    update public.accounts
    set balance = balance + v_delta
    where id = new.account_id and user_id = new.user_id;
    return new;
  elsif tg_op = 'UPDATE' then
    v_delta := public.debts_account_delta(old.type, old.amount);
    update public.accounts
    set balance = balance - v_delta
    where id = old.account_id and user_id = old.user_id;

    v_delta := public.debts_account_delta(new.type, new.amount);
    update public.accounts
    set balance = balance + v_delta
    where id = new.account_id and user_id = new.user_id;
    return new;
  elsif tg_op = 'DELETE' then
    v_delta := public.debts_account_delta(old.type, old.amount);
    update public.accounts
    set balance = balance - v_delta
    where id = old.account_id and user_id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists debts_balance_insert on public.debts;
create trigger debts_balance_insert
  after insert on public.debts
  for each row
  execute function public.debts_apply_balance();

drop trigger if exists debts_balance_update on public.debts;
create trigger debts_balance_update
  after update on public.debts
  for each row
  execute function public.debts_apply_balance();

drop trigger if exists debts_balance_delete on public.debts;
create trigger debts_balance_delete
  after delete on public.debts
  for each row
  execute function public.debts_apply_balance();

grant select, insert, update, delete on table public.debts to authenticated;
grant all on table public.debts to service_role;

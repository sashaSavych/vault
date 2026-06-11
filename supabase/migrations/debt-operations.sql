-- Debt repay/increase operations.
-- Safe to re-run. Run debts.sql FIRST (or use debts-setup.sql for both).
-- ERROR "relation public.debts does not exist" => run debts.sql before this file.

create table if not exists public.debt_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  amount numeric(19, 4) not null check (amount > 0),
  date date not null default current_date,
  notes text,
  type text not null check (type in ('repay', 'increase')),
  created_at timestamptz not null default now()
);

create index if not exists debt_operations_user_id_idx on public.debt_operations (user_id);
create index if not exists debt_operations_debt_id_idx on public.debt_operations (debt_id);
create index if not exists debt_operations_account_id_idx on public.debt_operations (account_id);
create index if not exists debt_operations_date_idx on public.debt_operations (date desc);

alter table public.debt_operations enable row level security;

drop policy if exists "debt_operations_select_own" on public.debt_operations;
create policy "debt_operations_select_own"
  on public.debt_operations
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "debt_operations_insert_own" on public.debt_operations;
create policy "debt_operations_insert_own"
  on public.debt_operations
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debts d
      where d.id = debt_id and d.user_id = auth.uid()
    )
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "debt_operations_update_own" on public.debt_operations;
create policy "debt_operations_update_own"
  on public.debt_operations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debts d
      where d.id = debt_id and d.user_id = auth.uid()
    )
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "debt_operations_delete_own" on public.debt_operations;
create policy "debt_operations_delete_own"
  on public.debt_operations
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.debt_operations_account_delta(
  p_debt_type text,
  p_operation_type text,
  p_amount numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_debt_type = 'borrow' and p_operation_type = 'repay' then -p_amount
    when p_debt_type = 'borrow' and p_operation_type = 'increase' then p_amount
    when p_debt_type = 'lend' and p_operation_type = 'repay' then p_amount
    when p_debt_type = 'lend' and p_operation_type = 'increase' then -p_amount
    else 0
  end;
$$;

create or replace function public.debt_operations_balance_delta(
  p_operation_type text,
  p_amount numeric
)
returns numeric
language sql
immutable
as $$
  select case p_operation_type
    when 'repay' then -p_amount
    when 'increase' then p_amount
    else 0
  end;
$$;

create or replace function public.debt_operations_validate()
returns trigger
language plpgsql
as $$
declare
  v_balance numeric(19, 4);
begin
  if new.type = 'repay' then
    select balance into v_balance
    from public.debts
    where id = new.debt_id
    for update;

    if v_balance is null then
      raise exception 'Debt not found';
    end if;

    if v_balance < new.amount then
      raise exception 'Repayment exceeds outstanding balance';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists debt_operations_validate on public.debt_operations;
create trigger debt_operations_validate
  before insert or update on public.debt_operations
  for each row
  execute function public.debt_operations_validate();

create or replace function public.debt_operations_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt_type text;
  v_account_delta numeric(19, 4);
  v_balance_delta numeric(19, 4);
begin
  if tg_op = 'INSERT' then
    select type into v_debt_type from public.debts where id = new.debt_id;

    v_account_delta := public.debt_operations_account_delta(v_debt_type, new.type, new.amount);
    v_balance_delta := public.debt_operations_balance_delta(new.type, new.amount);

    update public.accounts
    set balance = balance + v_account_delta
    where id = new.account_id and user_id = new.user_id;

    update public.debts
    set balance = balance + v_balance_delta
    where id = new.debt_id and user_id = new.user_id;

    return new;
  elsif tg_op = 'UPDATE' then
    select type into v_debt_type from public.debts where id = old.debt_id;

    v_account_delta := public.debt_operations_account_delta(v_debt_type, old.type, old.amount);
    v_balance_delta := public.debt_operations_balance_delta(old.type, old.amount);

    update public.accounts
    set balance = balance - v_account_delta
    where id = old.account_id and user_id = old.user_id;

    update public.debts
    set balance = balance - v_balance_delta
    where id = old.debt_id and user_id = old.user_id;

    select type into v_debt_type from public.debts where id = new.debt_id;

    v_account_delta := public.debt_operations_account_delta(v_debt_type, new.type, new.amount);
    v_balance_delta := public.debt_operations_balance_delta(new.type, new.amount);

    update public.accounts
    set balance = balance + v_account_delta
    where id = new.account_id and user_id = new.user_id;

    update public.debts
    set balance = balance + v_balance_delta
    where id = new.debt_id and user_id = new.user_id;

    return new;
  elsif tg_op = 'DELETE' then
    select type into v_debt_type from public.debts where id = old.debt_id;

    v_account_delta := public.debt_operations_account_delta(v_debt_type, old.type, old.amount);
    v_balance_delta := public.debt_operations_balance_delta(old.type, old.amount);

    update public.accounts
    set balance = balance - v_account_delta
    where id = old.account_id and user_id = old.user_id;

    update public.debts
    set balance = balance - v_balance_delta
    where id = old.debt_id and user_id = old.user_id;

    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists debt_operations_apply_insert on public.debt_operations;
create trigger debt_operations_apply_insert
  after insert on public.debt_operations
  for each row
  execute function public.debt_operations_apply();

drop trigger if exists debt_operations_apply_update on public.debt_operations;
create trigger debt_operations_apply_update
  after update on public.debt_operations
  for each row
  execute function public.debt_operations_apply();

drop trigger if exists debt_operations_apply_delete on public.debt_operations;
create trigger debt_operations_apply_delete
  after delete on public.debt_operations
  for each row
  execute function public.debt_operations_apply();

grant select, insert, update, delete on table public.debt_operations to authenticated;
grant all on table public.debt_operations to service_role;

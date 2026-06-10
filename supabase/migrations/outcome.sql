-- Outcomes (expenses): debit account balance via triggers.
-- Safe to re-run. Requires account.sql and category.sql.

create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  amount numeric(19, 4) not null check (amount > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists outcomes_user_id_idx on public.outcomes (user_id);
create index if not exists outcomes_account_id_idx on public.outcomes (account_id);
create index if not exists outcomes_date_idx on public.outcomes (date desc);

alter table public.outcomes enable row level security;

drop policy if exists "outcomes_select_own" on public.outcomes;
create policy "outcomes_select_own"
  on public.outcomes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "outcomes_insert_own" on public.outcomes;
create policy "outcomes_insert_own"
  on public.outcomes
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = auth.uid() and c.type = 'outcome'
    )
  );

drop policy if exists "outcomes_delete_own" on public.outcomes;
create policy "outcomes_delete_own"
  on public.outcomes
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "outcomes_update_own" on public.outcomes;
create policy "outcomes_update_own"
  on public.outcomes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = auth.uid() and c.type = 'outcome'
    )
  );

create or replace function public.outcomes_apply_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.accounts
    set balance = balance - new.amount
    where id = new.account_id and user_id = new.user_id;
    return new;
  elsif tg_op = 'UPDATE' then
    update public.accounts
    set balance = balance + old.amount
    where id = old.account_id and user_id = old.user_id;

    update public.accounts
    set balance = balance - new.amount
    where id = new.account_id and user_id = new.user_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.accounts
    set balance = balance + old.amount
    where id = old.account_id and user_id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists outcomes_balance_insert on public.outcomes;
create trigger outcomes_balance_insert
  after insert on public.outcomes
  for each row
  execute function public.outcomes_apply_balance();

drop trigger if exists outcomes_balance_delete on public.outcomes;
create trigger outcomes_balance_delete
  after delete on public.outcomes
  for each row
  execute function public.outcomes_apply_balance();

drop trigger if exists outcomes_balance_update on public.outcomes;
create trigger outcomes_balance_update
  after update on public.outcomes
  for each row
  execute function public.outcomes_apply_balance();

grant select, insert, update, delete on table public.outcomes to authenticated;
grant all on table public.outcomes to service_role;

-- Incomes: credit account balance via triggers.
-- Safe to re-run. Requires account.sql and category.sql.

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  amount numeric(19, 4) not null check (amount > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists incomes_user_id_idx on public.incomes (user_id);
create index if not exists incomes_account_id_idx on public.incomes (account_id);
create index if not exists incomes_date_idx on public.incomes (date desc);

alter table public.incomes enable row level security;

drop policy if exists "incomes_select_own" on public.incomes;
create policy "incomes_select_own"
  on public.incomes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "incomes_insert_own" on public.incomes;
create policy "incomes_insert_own"
  on public.incomes
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
      where c.id = category_id and c.user_id = auth.uid() and c.type = 'income'
    )
  );

drop policy if exists "incomes_delete_own" on public.incomes;
create policy "incomes_delete_own"
  on public.incomes
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.incomes_apply_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.accounts
    set balance = balance + new.amount
    where id = new.account_id and user_id = new.user_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.accounts
    set balance = balance - old.amount
    where id = old.account_id and user_id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists incomes_balance_insert on public.incomes;
create trigger incomes_balance_insert
  after insert on public.incomes
  for each row
  execute function public.incomes_apply_balance();

drop trigger if exists incomes_balance_delete on public.incomes;
create trigger incomes_balance_delete
  after delete on public.incomes
  for each row
  execute function public.incomes_apply_balance();

grant select, insert, delete on table public.incomes to authenticated;
grant all on table public.incomes to service_role;

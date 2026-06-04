-- Transfers between accounts; balances update via triggers.
-- Safe to re-run. Requires account.sql.

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount_from numeric(19, 4) not null check (amount_from > 0),
  amount_to numeric(19, 4) not null check (amount_to > 0),
  exchange_rate numeric(19, 8),
  date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint transfers_accounts_must_differ check (from_account_id <> to_account_id),
  constraint transfers_from_account_fkey
    foreign key (from_account_id) references public.accounts (id) on delete restrict,
  constraint transfers_to_account_fkey
    foreign key (to_account_id) references public.accounts (id) on delete restrict
);

create index if not exists transfers_user_id_idx on public.transfers (user_id);
create index if not exists transfers_date_idx on public.transfers (date desc);

alter table public.transfers enable row level security;

drop policy if exists "transfers_select_own" on public.transfers;
create policy "transfers_select_own"
  on public.transfers
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "transfers_insert_own" on public.transfers;
create policy "transfers_insert_own"
  on public.transfers
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = from_account_id and a.user_id = auth.uid()
    )
    and exists (
      select 1 from public.accounts a
      where a.id = to_account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "transfers_delete_own" on public.transfers;
create policy "transfers_delete_own"
  on public.transfers
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.transfers_apply_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.accounts
    set balance = balance - new.amount_from
    where id = new.from_account_id and user_id = new.user_id;

    update public.accounts
    set balance = balance + new.amount_to
    where id = new.to_account_id and user_id = new.user_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.accounts
    set balance = balance + old.amount_from
    where id = old.from_account_id and user_id = old.user_id;

    update public.accounts
    set balance = balance - old.amount_to
    where id = old.to_account_id and user_id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists transfers_balance_insert on public.transfers;
create trigger transfers_balance_insert
  after insert on public.transfers
  for each row
  execute function public.transfers_apply_balance();

drop trigger if exists transfers_balance_delete on public.transfers;
create trigger transfers_balance_delete
  after delete on public.transfers
  for each row
  execute function public.transfers_apply_balance();

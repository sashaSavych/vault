-- Accounts: balance, 4-digit card_id, RLS, single default trigger.
-- Safe to re-run. Run before transfer.sql.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  icon text not null default 'pi-wallet',
  card_id char(4) not null default '0000' check (card_id ~ '^\d{4}$'),
  balance numeric(19, 4) not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.accounts
  add column if not exists balance numeric(19, 4) not null default 0;

alter table public.accounts
  add column if not exists card_id char(4);

alter table public.accounts drop constraint if exists accounts_card_id_required_check;
alter table public.accounts drop constraint if exists accounts_account_type_check;

update public.accounts
set card_id = '0000'
where card_id is null;

alter table public.accounts
  alter column card_id set default '0000';

alter table public.accounts
  alter column card_id set not null;

alter table public.accounts drop constraint if exists accounts_card_id_format_check;
alter table public.accounts
  add constraint accounts_card_id_format_check
  check (card_id ~ '^\d{4}$');

alter table public.accounts drop column if exists account_type;

create index if not exists accounts_user_id_idx on public.accounts (user_id);

drop index if exists accounts_one_default_per_user;
create unique index accounts_one_default_per_user
  on public.accounts (user_id)
  where is_default;

alter table public.accounts enable row level security;

drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own"
  on public.accounts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own"
  on public.accounts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own"
  on public.accounts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own"
  on public.accounts
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.accounts_clear_other_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default then
    update public.accounts
    set is_default = false
    where user_id = new.user_id
      and id <> new.id
      and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_single_default on public.accounts;
create trigger accounts_single_default
  before insert or update of is_default on public.accounts
  for each row
  execute function public.accounts_clear_other_defaults();

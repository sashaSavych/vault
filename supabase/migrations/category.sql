-- Categories for incomes and outcomes (tree, icons, default seed).
-- Safe to re-run.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type text not null check (type in ('income', 'outcome')),
  parent_id uuid references public.categories (id) on delete cascade,
  icon text not null default 'pi-tag',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories
  add column if not exists parent_id uuid references public.categories (id) on delete cascade;

alter table public.categories
  add column if not exists icon text not null default 'pi-tag';

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists categories_user_type_idx on public.categories (user_id, type, sort_order);
create index if not exists categories_parent_id_idx on public.categories (parent_id);

drop index if exists categories_unique_name_per_type;

drop index if exists categories_unique_root_name;
create unique index categories_unique_root_name
  on public.categories (user_id, type, lower(trim(name)))
  where parent_id is null;

drop index if exists categories_unique_child_name;
create unique index categories_unique_child_name
  on public.categories (user_id, type, parent_id, lower(trim(name)))
  where parent_id is not null;

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own"
  on public.categories
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
  on public.categories
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.seed_default_categories()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_parent_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.categories where user_id = v_user_id and type = 'income'
  ) then
    insert into public.categories (user_id, name, type, parent_id, icon, sort_order)
    values (v_user_id, 'Salary', 'income', null, 'pi-briefcase', 0)
    returning id into v_parent_id;

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'S', 'income', v_parent_id, 'pi-wallet', 0),
      (v_user_id, 'K', 'income', v_parent_id, 'pi-wallet', 1);

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order)
    values (v_user_id, 'Rent', 'income', null, 'pi-home', 1)
    returning id into v_parent_id;

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'R1', 'income', v_parent_id, 'pi-building-columns', 0),
      (v_user_id, 'R2', 'income', v_parent_id, 'pi-building-columns', 1);

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'Gift', 'income', null, 'pi-gift', 2),
      (v_user_id, 'Sale', 'income', null, 'pi-money-bill', 3),
      (v_user_id, 'Other', 'income', null, 'pi-tag', 4);
  end if;

  if not exists (
    select 1 from public.categories where user_id = v_user_id and type = 'outcome'
  ) then
    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'Food', 'outcome', null, 'pi-shopping-cart', 0),
      (v_user_id, 'Entertainment', 'outcome', null, 'pi-play', 1);

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order)
    values (v_user_id, 'Life needs', 'outcome', null, 'pi-home', 2)
    returning id into v_parent_id;

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'Beauty', 'outcome', v_parent_id, 'pi-sparkles', 0),
      (v_user_id, 'Clothes', 'outcome', v_parent_id, 'pi-shopping-bag', 1),
      (v_user_id, 'Health', 'outcome', v_parent_id, 'pi-heart', 2),
      (v_user_id, 'Home', 'outcome', v_parent_id, 'pi-home', 3);

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'Traveling', 'outcome', null, 'pi-globe', 3),
      (v_user_id, 'Transport', 'outcome', null, 'pi-car', 4),
      (v_user_id, 'Donations', 'outcome', null, 'pi-gift', 5),
      (v_user_id, 'Other', 'outcome', null, 'pi-tag', 6),
      (v_user_id, 'Out of report', 'outcome', null, 'pi-eye-slash', 7);
  end if;
end;
$$;

revoke all on function public.seed_default_categories() from public;
grant execute on function public.seed_default_categories() to authenticated;

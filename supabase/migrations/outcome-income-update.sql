-- Patch: enable editing incomes/outcomes (update RLS, balance triggers, grants).
-- Safe to re-run. Run if edits fail with "Cannot coerce the result to a single JSON object".

-- Outcomes
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

drop trigger if exists outcomes_balance_update on public.outcomes;
create trigger outcomes_balance_update
  after update on public.outcomes
  for each row
  execute function public.outcomes_apply_balance();

grant select, insert, update, delete on table public.outcomes to authenticated;

-- Incomes
drop policy if exists "incomes_update_own" on public.incomes;
create policy "incomes_update_own"
  on public.incomes
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
      where c.id = category_id and c.user_id = auth.uid() and c.type = 'income'
    )
  );

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
  elsif tg_op = 'UPDATE' then
    update public.accounts
    set balance = balance - old.amount
    where id = old.account_id and user_id = old.user_id;

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

drop trigger if exists incomes_balance_update on public.incomes;
create trigger incomes_balance_update
  after update on public.incomes
  for each row
  execute function public.incomes_apply_balance();

grant select, insert, update, delete on table public.incomes to authenticated;

-- Account archive + permanent delete with related records.
-- Safe to re-run. Run after account.sql, income.sql, outcome.sql, transfer.sql.

alter table public.accounts
  add column if not exists archived_at timestamptz;

create index if not exists accounts_archived_at_idx
  on public.accounts (user_id, archived_at);

create or replace function public.delete_account_permanently(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.accounts
    where id = p_account_id and user_id = v_user_id
  ) then
    raise exception 'Account not found';
  end if;

  delete from public.transfers
  where user_id = v_user_id
    and (from_account_id = p_account_id or to_account_id = p_account_id);

  delete from public.incomes
  where user_id = v_user_id and account_id = p_account_id;

  delete from public.outcomes
  where user_id = v_user_id and account_id = p_account_id;

  delete from public.accounts
  where id = p_account_id and user_id = v_user_id;
end;
$$;

revoke all on function public.delete_account_permanently(uuid) from public;
grant execute on function public.delete_account_permanently(uuid) to authenticated;

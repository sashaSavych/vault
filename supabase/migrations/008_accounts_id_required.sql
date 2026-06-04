-- 4-digit ID on every account; drop account_type. Safe to re-run.
-- Drop legacy constraints from 007 before backfilling card_id.

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

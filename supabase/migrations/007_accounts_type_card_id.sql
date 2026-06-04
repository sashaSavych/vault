-- Account type and 4-digit card ID. Safe to re-run.

alter table public.accounts
  add column if not exists account_type text not null default 'wallet';

alter table public.accounts
  add column if not exists card_id char(4);

alter table public.accounts drop constraint if exists accounts_account_type_check;
alter table public.accounts
  add constraint accounts_account_type_check
  check (account_type in ('wallet', 'bank', 'cash', 'card'));

alter table public.accounts drop constraint if exists accounts_card_id_format_check;
alter table public.accounts
  add constraint accounts_card_id_format_check
  check (card_id is null or card_id ~ '^\d{4}$');

alter table public.accounts drop constraint if exists accounts_card_id_required_check;
alter table public.accounts
  add constraint accounts_card_id_required_check
  check (
    (account_type = 'card' and card_id is not null)
    or (account_type <> 'card' and card_id is null)
  );

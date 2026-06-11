import type { Account } from '../../core/models/account';

export interface AccountSelectOption {
  label: string;
  value: string;
  icon: string;
}

export interface AccountFilterOption {
  label: string;
  value: string | null;
  icon: string | null;
}

export function accountSelectOptions(accounts: Account[]): AccountSelectOption[] {
  return accounts.map((account) => ({
    label: `${account.name} (${account.currency})`,
    value: account.id,
    icon: account.icon,
  }));
}

export function accountFilterOptions(accounts: Account[]): AccountFilterOption[] {
  return [
    { label: 'All accounts', value: null, icon: null },
    ...accountSelectOptions(accounts),
  ];
}

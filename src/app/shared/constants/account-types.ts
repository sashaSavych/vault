export interface AccountType {
  value: string;
  label: string;
  bgClass: string;
  textClass: string;
}

export const ACCOUNT_TYPES: AccountType[] = [
  {
    value: 'pi-credit-card',
    label: 'Card',
    bgClass: 'bg-violet-500/10',
    textClass: 'text-violet-600 dark:text-violet-400',
  },
  {
    value: 'pi-money-bill',
    label: 'Cash',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'pi-wallet',
    label: 'Wallet',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'pi-briefcase',
    label: 'Business',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
];

const DEFAULT_TYPE = ACCOUNT_TYPES[0];

export function accountTypeStyle(type: string): Pick<AccountType, 'bgClass' | 'textClass'> {
  const found = ACCOUNT_TYPES.find((item) => item.value === type);
  return found ?? { bgClass: DEFAULT_TYPE.bgClass, textClass: DEFAULT_TYPE.textClass };
}

export function accountTypeClasses(type: string): string {
  const style = accountTypeStyle(type);
  return `${style.bgClass} ${style.textClass}`;
}

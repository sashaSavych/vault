export interface AccountType {
  value: string;
  label: string;
  bgClass: string;
  textClass: string;
}

export const ACCOUNT_TYPES: AccountType[] = [
  {
    value: 'pi-wallet',
    label: 'Wallet',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'pi-credit-card',
    label: 'Card',
    bgClass: 'bg-violet-500/10',
    textClass: 'text-violet-600 dark:text-violet-400',
  },
  {
    value: 'pi-building-columns',
    label: 'Bank',
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    value: 'pi-money-bill',
    label: 'Cash',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'pi-save',
    label: 'Savings',
    bgClass: 'bg-teal-500/10',
    textClass: 'text-teal-600 dark:text-teal-400',
  },
  {
    value: 'pi-briefcase',
    label: 'Business',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'pi-shopping-bag',
    label: 'Shopping',
    bgClass: 'bg-pink-500/10',
    textClass: 'text-pink-600 dark:text-pink-400',
  },
  {
    value: 'pi-globe',
    label: 'Travel',
    bgClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-600 dark:text-cyan-400',
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

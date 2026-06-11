import type { DebtOperationType, DebtType } from '../../core/models/debt';

export const DEBT_TYPE_OPTIONS: { label: string; value: DebtType }[] = [
  { label: 'Borrow', value: 'borrow' },
  { label: 'Lend', value: 'lend' },
];

export function debtTypeLabel(type: DebtType): string {
  return type === 'borrow' ? 'Borrow' : 'Lend';
}

export function debtTypeColorClass(type: DebtType): string {
  return type === 'borrow'
    ? 'text-red-600 dark:text-red-400'
    : 'text-green-600 dark:text-green-400';
}

export function debtTypeBadgeClass(type: DebtType): string {
  return type === 'borrow'
    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
    : 'bg-green-500/10 text-green-600 dark:text-green-400';
}

export function debtOperationTypeLabel(type: DebtOperationType): string {
  return type === 'repay' ? 'Repay' : 'Increase';
}

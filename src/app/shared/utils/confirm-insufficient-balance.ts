import { ConfirmationService } from 'primeng/api';

import { formatBalance } from './format-balance';

export function insufficientBalanceWarning(
  available: number,
  required: number,
  currency: string,
): string | null {
  if (available >= required) {
    return null;
  }

  return `This account has ${formatBalance(available, currency)} available but the operation requires ${formatBalance(required, currency)}.`;
}

export function confirmInsufficientBalance(
  confirmation: ConfirmationService,
  warning: string,
  proceed: () => void | Promise<void>,
): void {
  confirmation.confirm({
    message: `${warning} The account balance will go negative. Continue anyway?`,
    header: 'Insufficient balance',
    icon: 'pi pi-exclamation-triangle',
    rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    acceptButtonProps: { label: 'Continue', severity: 'warn' },
    accept: () => void proceed(),
  });
}

export async function proceedOrConfirmInsufficientBalance(
  confirmation: ConfirmationService,
  warning: string | null,
  proceed: () => void | Promise<void>,
): Promise<void> {
  if (!warning) {
    await proceed();
    return;
  }

  confirmInsufficientBalance(confirmation, warning, proceed);
}

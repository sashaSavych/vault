export function roundMoneyAmount(value: number): number {
  return Math.round(value);
}

export function formatBalance(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(roundMoneyAmount(amount));

  return `${formatted} ${currency}`;
}

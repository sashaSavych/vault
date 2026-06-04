export function formatBalance(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formatted} ${currency}`;
}

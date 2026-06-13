export function roundMoneyAmount(value: number): number {
  return Math.round(value);
}

export function getCurrencySymbol(code: string): string {
  const map: Record<string, string> = {
    UAH: '₴',
    USD: '$',
    EUR: '€',
  };

  return map[code] ?? code;
}

export function formatBalance(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(roundMoneyAmount(amount));

  const symbol = getCurrencySymbol(currency);

  // Keep original placement (amount followed by currency) to avoid layout shifts.
  return `${formatted} ${symbol}`;
}

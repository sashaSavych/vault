export type ReportViewMode = 'list' | 'grid';

export interface ReportCategoryAmountRow {
  currencies: { amount: number }[];
}

export function reportRowTotalAmount(row: ReportCategoryAmountRow): number {
  return row.currencies.reduce((sum, item) => sum + item.amount, 0);
}

export function formatThousandsAbs(amount: number): string {
  return String(Math.round(Math.abs(amount) / 1000));
}

/** Tab-separated line — pastes into Excel as two columns; still copies as multiple rows. */
export function formatReportGridLine(amount: number, categoryName: string): string {
  return `${formatThousandsAbs(amount)}\t${categoryName}`;
}

export function formatPercentOfTotal(part: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((Math.abs(part) / Math.abs(total)) * 100)}%`;
}

import type { Category } from '../../core/models/category';
import type { IncomeWithDetails } from '../../core/models/income';

import { categorySortIndex } from './category-tree';

export interface IncomeCategoryCurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

export interface IncomeCategoryReportRow {
  categoryId: string;
  categoryName: string;
  currencies: IncomeCategoryCurrencyTotal[];
  totalCount: number;
}

export interface IncomeReportCurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

export function aggregateIncomesByCategory(
  incomes: IncomeWithDetails[],
  categories: Category[] = [],
): IncomeCategoryReportRow[] {
  const byCategory = new Map<string, IncomeCategoryReportRow>();

  for (const income of incomes) {
    let row = byCategory.get(income.categoryId);
    if (!row) {
      row = {
        categoryId: income.categoryId,
        categoryName: income.categoryName,
        currencies: [],
        totalCount: 0,
      };
      byCategory.set(income.categoryId, row);
    }

    row.totalCount += 1;

    const currencyTotal = row.currencies.find((item) => item.currency === income.accountCurrency);
    if (currencyTotal) {
      currencyTotal.amount += income.amount;
      currencyTotal.count += 1;
    } else {
      row.currencies.push({
        currency: income.accountCurrency,
        amount: income.amount,
        count: 1,
      });
    }
  }

  const rows = [...byCategory.values()];

  if (categories.length === 0) {
    return rows.sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: 'base' }),
    );
  }

  const order = categorySortIndex(categories, 'income');
  return rows.sort((a, b) => {
    const left = order.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER;
    const right = order.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: 'base' });
  });
}

export function sumIncomesByCurrency(incomes: IncomeWithDetails[]): IncomeReportCurrencyTotal[] {
  const totals = new Map<string, IncomeReportCurrencyTotal>();

  for (const income of incomes) {
    const existing = totals.get(income.accountCurrency);
    if (existing) {
      existing.amount += income.amount;
      existing.count += 1;
    } else {
      totals.set(income.accountCurrency, {
        currency: income.accountCurrency,
        amount: income.amount,
        count: 1,
      });
    }
  }

  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

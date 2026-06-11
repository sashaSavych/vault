import type { Category } from '../../core/models/category';
import type { OutcomeWithDetails } from '../../core/models/outcome';

import { categorySortIndex } from './category-tree';

export interface OutcomeCategoryCurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

export interface OutcomeCategoryReportRow {
  categoryId: string;
  categoryName: string;
  currencies: OutcomeCategoryCurrencyTotal[];
  totalCount: number;
}

export interface OutcomeReportCurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

export function aggregateOutcomesByCategory(
  outcomes: OutcomeWithDetails[],
  categories: Category[] = [],
): OutcomeCategoryReportRow[] {
  const byCategory = new Map<string, OutcomeCategoryReportRow>();

  for (const outcome of outcomes) {
    let row = byCategory.get(outcome.categoryId);
    if (!row) {
      row = {
        categoryId: outcome.categoryId,
        categoryName: outcome.categoryName,
        currencies: [],
        totalCount: 0,
      };
      byCategory.set(outcome.categoryId, row);
    }

    row.totalCount += 1;

    const currencyTotal = row.currencies.find((item) => item.currency === outcome.accountCurrency);
    if (currencyTotal) {
      currencyTotal.amount += outcome.amount;
      currencyTotal.count += 1;
    } else {
      row.currencies.push({
        currency: outcome.accountCurrency,
        amount: outcome.amount,
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

  const order = categorySortIndex(categories, 'outcome');
  return rows.sort((a, b) => {
    const left = order.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER;
    const right = order.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: 'base' });
  });
}

export function sumOutcomesByCurrency(
  outcomes: OutcomeWithDetails[],
): OutcomeReportCurrencyTotal[] {
  const totals = new Map<string, OutcomeReportCurrencyTotal>();

  for (const outcome of outcomes) {
    const existing = totals.get(outcome.accountCurrency);
    if (existing) {
      existing.amount += outcome.amount;
      existing.count += 1;
    } else {
      totals.set(outcome.accountCurrency, {
        currency: outcome.accountCurrency,
        amount: outcome.amount,
        count: 1,
      });
    }
  }

  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

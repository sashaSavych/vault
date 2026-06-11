import { Injectable, inject } from '@angular/core';

import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import type { Account } from '../models/account';
import type { Category } from '../models/category';
import type {
  Income,
  IncomeInput,
  IncomeListFilters,
  IncomeRow,
  IncomeWithDetails,
} from '../models/income';
import { mapIncome } from '../models/income';
import { AuthService } from '../auth/auth.service';
import { getSupabaseClient } from '../supabase/supabase';
import { categoryLabel } from '../../shared/utils/category-select-options';
import { roundMoneyAmount } from '../../shared/utils/format-balance';

@Injectable({ providedIn: 'root' })
export class IncomesService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);

  async list(filters: IncomeListFilters = {}): Promise<IncomeWithDetails[]> {
    let query = this.supabase
      .from('incomes')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.accountId) {
      query = query.eq('account_id', filters.accountId);
    }
    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }
    if (filters.dateFrom) {
      query = query.gte('date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('date', filters.dateTo);
    }

    const [incomesResult, accounts, categories] = await Promise.all([
      query,
      this.accountsService.list(),
      this.categoriesService.list('income'),
    ]);

    if (incomesResult.error) {
      throw incomesResult.error;
    }

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    return (incomesResult.data as IncomeRow[] | null)?.map((row) =>
      enrichIncome(mapIncome(row), accountMap, categories),
    ) ?? [];
  }

  async create(input: IncomeInput): Promise<Income> {
    this.validate(input);

    const { data, error } = await this.supabase
      .from('incomes')
      .insert({
        user_id: this.requireUserId(),
        name: input.name.trim(),
        account_id: input.accountId,
        category_id: input.categoryId,
        amount: roundMoneyAmount(input.amount),
        date: input.date,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapIncome(data as IncomeRow);
  }

  async update(id: string, input: IncomeInput): Promise<Income> {
    this.validate(input);
    const userId = this.requireUserId();

    const { data, error } = await this.supabase
      .from('incomes')
      .update({
        name: input.name.trim(),
        account_id: input.accountId,
        category_id: input.categoryId,
        amount: roundMoneyAmount(input.amount),
        date: input.date,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*');

    if (error) {
      throw error;
    }

    const row = (data as IncomeRow[] | null)?.[0];
    if (!row) {
      throw new Error(
        'Income was not updated. Re-run supabase/migrations/income.sql in the Supabase SQL Editor.',
      );
    }

    return mapIncome(row);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('incomes').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  private validate(input: IncomeInput): void {
    if (input.amount <= 0) {
      throw new Error('Amount must be greater than zero.');
    }
  }

  private requireUserId(): string {
    const userId = this.auth.user()?.id;
    if (!userId) {
      throw new Error('Not authenticated');
    }
    return userId;
  }
}

function enrichIncome(
  income: Income,
  accountMap: Map<string, Account>,
  categories: Category[],
): IncomeWithDetails {
  const account = accountMap.get(income.accountId);

  return {
    ...income,
    accountName: account?.name ?? 'Unknown',
    accountCurrency: account?.currency ?? '',
    categoryName: categoryLabel(categories, income.categoryId),
  };
}

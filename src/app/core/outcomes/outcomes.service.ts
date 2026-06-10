import { Injectable, inject } from '@angular/core';

import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import type { Account } from '../models/account';
import type { Category } from '../models/category';
import type {
  Outcome,
  OutcomeInput,
  OutcomeListFilters,
  OutcomeRow,
  OutcomeWithDetails,
} from '../models/outcome';
import { mapOutcome } from '../models/outcome';
import { AuthService } from '../auth/auth.service';
import { getSupabaseClient } from '../supabase/supabase';
import { categoryLabel } from '../../shared/utils/category-select-options';

@Injectable({ providedIn: 'root' })
export class OutcomesService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);

  async list(filters: OutcomeListFilters = {}): Promise<OutcomeWithDetails[]> {
    let query = this.supabase
      .from('outcomes')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.accountId) {
      query = query.eq('account_id', filters.accountId);
    }
    if (filters.dateFrom) {
      query = query.gte('date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('date', filters.dateTo);
    }

    const [outcomesResult, accounts, categories] = await Promise.all([
      query,
      this.accountsService.list(),
      this.categoriesService.list('outcome'),
    ]);

    if (outcomesResult.error) {
      throw outcomesResult.error;
    }

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    return (outcomesResult.data as OutcomeRow[] | null)?.map((row) =>
      enrichOutcome(mapOutcome(row), accountMap, categories),
    ) ?? [];
  }

  async create(input: OutcomeInput): Promise<Outcome> {
    this.validate(input);

    const { data, error } = await this.supabase
      .from('outcomes')
      .insert({
        user_id: this.requireUserId(),
        name: input.name.trim(),
        account_id: input.accountId,
        category_id: input.categoryId,
        amount: input.amount,
        date: input.date,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapOutcome(data as OutcomeRow);
  }

  async createMany(inputs: OutcomeInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    for (const input of inputs) {
      this.validate(input);
    }

    const { data, error } = await this.supabase
      .from('outcomes')
      .insert(
        inputs.map((input) => ({
          user_id: this.requireUserId(),
          name: input.name.trim(),
          account_id: input.accountId,
          category_id: input.categoryId,
          amount: input.amount,
          date: input.date,
        })),
      )
      .select('id');

    if (error) {
      throw error;
    }

    return data?.length ?? inputs.length;
  }

  async update(id: string, input: OutcomeInput): Promise<Outcome> {
    this.validate(input);
    const userId = this.requireUserId();

    const { data, error } = await this.supabase
      .from('outcomes')
      .update({
        name: input.name.trim(),
        account_id: input.accountId,
        category_id: input.categoryId,
        amount: input.amount,
        date: input.date,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*');

    if (error) {
      throw error;
    }

    const row = (data as OutcomeRow[] | null)?.[0];
    if (!row) {
      throw new Error(
        'Outcome was not updated. Re-run supabase/migrations/outcome.sql in the Supabase SQL Editor.',
      );
    }

    return mapOutcome(row);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('outcomes').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  private validate(input: OutcomeInput): void {
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

function enrichOutcome(
  outcome: Outcome,
  accountMap: Map<string, Account>,
  categories: Category[],
): OutcomeWithDetails {
  const account = accountMap.get(outcome.accountId);

  return {
    ...outcome,
    accountName: account?.name ?? 'Unknown',
    accountCurrency: account?.currency ?? '',
    categoryName: categoryLabel(categories, outcome.categoryId),
  };
}

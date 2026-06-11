import { Injectable, inject } from '@angular/core';

import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from '../auth/auth.service';
import type { Account } from '../models/account';
import type {
  Debt,
  DebtInput,
  DebtListFilters,
  DebtOperation,
  DebtOperationInput,
  DebtOperationRow,
  DebtOperationWithDetails,
  DebtRow,
  DebtWithDetails,
} from '../models/debt';
import { mapDebt, mapDebtOperation } from '../models/debt';
import { getSupabaseClient } from '../supabase/supabase';

@Injectable({ providedIn: 'root' })
export class DebtsService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);
  private readonly accountsService = inject(AccountsService);

  async list(filters: DebtListFilters = {}): Promise<DebtWithDetails[]> {
    let query = this.supabase
      .from('debts')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.accountId) {
      query = query.eq('account_id', filters.accountId);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.dateFrom) {
      query = query.gte('date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('date', filters.dateTo);
    }

    const [debtsResult, accounts, operationsResult] = await Promise.all([
      query,
      this.accountsService.list(),
      this.supabase
        .from('debt_operations')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);

    if (debtsResult.error) {
      throw debtsResult.error;
    }
    if (operationsResult.error) {
      throw operationsResult.error;
    }

    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    const operationsByDebt = groupOperationsByDebt(
      (operationsResult.data as DebtOperationRow[] | null) ?? [],
      accountMap,
    );

    return ((debtsResult.data as DebtRow[] | null) ?? []).map((row) =>
      enrichDebt(mapDebt(row), accountMap, operationsByDebt.get(row.id) ?? []),
    );
  }

  async create(input: DebtInput): Promise<Debt> {
    this.validateAmount(input.amount);

    const { data, error } = await this.supabase
      .from('debts')
      .insert({
        user_id: this.requireUserId(),
        name: input.name.trim(),
        account_id: input.accountId,
        amount: input.amount,
        balance: input.amount,
        date: input.date,
        type: input.type,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapDebt(data as DebtRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('debts').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  async createOperation(input: DebtOperationInput): Promise<DebtOperation> {
    this.validateAmount(input.amount);

    const { data, error } = await this.supabase
      .from('debt_operations')
      .insert({
        user_id: this.requireUserId(),
        debt_id: input.debtId,
        name: input.name.trim(),
        account_id: input.accountId,
        amount: input.amount,
        date: input.date,
        notes: input.notes.trim() || null,
        type: input.type,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapDebtOperation(data as DebtOperationRow);
  }

  async removeOperation(id: string): Promise<void> {
    const { error } = await this.supabase.from('debt_operations').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  private validateAmount(amount: number): void {
    if (amount <= 0) {
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

function groupOperationsByDebt(
  rows: DebtOperationRow[],
  accountMap: Map<string, Account>,
): Map<string, DebtOperationWithDetails[]> {
  const grouped = new Map<string, DebtOperationWithDetails[]>();

  for (const row of rows) {
    const operation = enrichOperation(mapDebtOperation(row), accountMap);
    const list = grouped.get(row.debt_id) ?? [];
    list.push(operation);
    grouped.set(row.debt_id, list);
  }

  return grouped;
}

function enrichDebt(
  debt: Debt,
  accountMap: Map<string, Account>,
  operations: DebtOperationWithDetails[],
): DebtWithDetails {
  const account = accountMap.get(debt.accountId);

  return {
    ...debt,
    accountName: account?.name ?? 'Unknown',
    accountCurrency: account?.currency ?? '',
    operations,
  };
}

function enrichOperation(
  operation: DebtOperation,
  accountMap: Map<string, Account>,
): DebtOperationWithDetails {
  const account = accountMap.get(operation.accountId);

  return {
    ...operation,
    accountName: account?.name ?? 'Unknown',
    accountCurrency: account?.currency ?? '',
  };
}

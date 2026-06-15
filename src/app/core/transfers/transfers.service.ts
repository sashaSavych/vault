import { Injectable, inject } from '@angular/core';

import { AccountsService } from '../accounts/accounts.service';
import type { Account } from '../models/account';
import type { Transfer, TransferInput, TransferRow, TransferWithAccounts } from '../models/transfer';
import { mapTransfer } from '../models/transfer';
import { AuthService } from '../auth/auth.service';
import { getSupabaseClient } from '../supabase/supabase';
import { roundMoneyAmount } from '../../shared/utils/format-balance';

@Injectable({ providedIn: 'root' })
export class TransfersService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);
  private readonly accountsService = inject(AccountsService);

  async list(): Promise<TransferWithAccounts[]> {
    const [transfersResult, accounts] = await Promise.all([
      this.supabase
        .from('transfers')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      this.accountsService.list(),
    ]);

    if (transfersResult.error) {
      throw transfersResult.error;
    }

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    return (transfersResult.data as TransferRow[] | null)?.map((row) =>
      enrichTransfer(mapTransfer(row), accountMap),
    ) ?? [];
  }

  async create(input: TransferInput): Promise<Transfer> {
    this.validate(input);

    const { data, error } = await this.supabase
      .from('transfers')
      .insert({
        user_id: this.requireUserId(),
        name: input.name.trim(),
        from_account_id: input.fromAccountId,
        to_account_id: input.toAccountId,
        amount_from: roundMoneyAmount(input.amountFrom),
        amount_to: roundMoneyAmount(input.amountTo),
        exchange_rate: input.exchangeRate,
        date: input.date,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapTransfer(data as TransferRow);
  }

  async update(id: string, input: TransferInput): Promise<Transfer> {
    this.validate(input);

    const { data, error } = await this.supabase
      .from('transfers')
      .update({
        name: input.name.trim(),
        from_account_id: input.fromAccountId,
        to_account_id: input.toAccountId,
        amount_from: roundMoneyAmount(input.amountFrom),
        amount_to: roundMoneyAmount(input.amountTo),
        exchange_rate: input.exchangeRate,
        date: input.date,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapTransfer(data as TransferRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('transfers').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  private validate(input: TransferInput): void {
    if (input.fromAccountId === input.toAccountId) {
      throw new Error('Source and destination accounts must be different.');
    }
    if (input.amountFrom <= 0 || input.amountTo <= 0) {
      throw new Error('Amounts must be greater than zero.');
    }
    if (input.exchangeRate <= 0) {
      throw new Error('Exchange rate must be greater than zero.');
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

function enrichTransfer(transfer: Transfer, accountMap: Map<string, Account>): TransferWithAccounts {
  const from = accountMap.get(transfer.fromAccountId);
  const to = accountMap.get(transfer.toAccountId);

  return {
    ...transfer,
    fromAccountName: from?.name ?? 'Unknown',
    fromAccountCurrency: from?.currency ?? '',
    toAccountName: to?.name ?? 'Unknown',
    toAccountCurrency: to?.currency ?? '',
  };
}

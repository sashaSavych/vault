import { Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import type { Account, AccountInput, AccountListOptions, AccountRow } from '../models/account';
import { mapAccount } from '../models/account';
import { getSupabaseClient } from '../supabase/supabase';
import { roundMoneyAmount } from '../../shared/utils/format-balance';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);

  async list(options: AccountListOptions = {}): Promise<Account[]> {
    let query = this.supabase
      .from('accounts')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!options.includeArchived) {
      query = query.is('archived_at', null);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data as AccountRow[] | null)?.map(mapAccount) ?? [];
  }

  async create(input: AccountInput): Promise<Account> {
    const { data, error } = await this.supabase
      .from('accounts')
      .insert({
        ...this.toPayload(input),
        user_id: this.requireUserId(),
        sort_order: await this.nextSortOrder(),
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapAccount(data as AccountRow);
  }

  async update(id: string, input: AccountInput): Promise<Account> {
    const { data, error } = await this.supabase
      .from('accounts')
      .update(this.toPayload(input))
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapAccount(data as AccountRow);
  }

  async reorder(accountIds: string[]): Promise<void> {
    const userId = this.requireUserId();

    const results = await Promise.all(
      accountIds.map((id, index) =>
        this.supabase
          .from('accounts')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('user_id', userId),
      ),
    );

    const error = results.find((result) => result.error)?.error;
    if (error) {
      throw error;
    }
  }

  async archive(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('accounts')
      .update({
        archived_at: new Date().toISOString(),
        is_default: false,
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async restore(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('accounts')
      .update({ archived_at: null })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async removePermanent(id: string): Promise<void> {
    const { error } = await this.supabase.rpc('delete_account_permanently', {
      p_account_id: id,
    });

    if (error) {
      throw error;
    }
  }

  private async nextSortOrder(): Promise<number> {
    const userId = this.requireUserId();
    const { data, error } = await this.supabase
      .from('accounts')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    const current = (data as { sort_order: number }[] | null)?.[0]?.sort_order;
    return current == null ? 0 : current + 1;
  }

  private toPayload(input: AccountInput) {
    return {
      name: input.name.trim(),
      currency: input.currency,
      icon: input.icon,
      card_ids: input.cardIds,
      balance: roundMoneyAmount(input.balance),
      is_default: input.isDefault,
    };
  }

  private requireUserId(): string {
    const userId = this.auth.user()?.id;
    if (!userId) {
      throw new Error('Not authenticated');
    }
    return userId;
  }
}

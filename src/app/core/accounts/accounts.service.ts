import { Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import type { Account, AccountInput, AccountListOptions, AccountRow } from '../models/account';
import { mapAccount } from '../models/account';
import { getSupabaseClient } from '../supabase/supabase';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);

  async list(options: AccountListOptions = {}): Promise<Account[]> {
    let query = this.supabase
      .from('accounts')
      .select('*')
      .order('is_default', { ascending: false })
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
      .insert({ ...this.toPayload(input), user_id: this.requireUserId() })
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

  private toPayload(input: AccountInput) {
    return {
      name: input.name.trim(),
      currency: input.currency,
      icon: input.icon,
      card_id: input.cardId,
      balance: input.balance,
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

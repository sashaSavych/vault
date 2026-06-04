import { Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import type { Account, AccountInput, AccountRow } from '../models/account';
import { mapAccount } from '../models/account';
import { getSupabaseClient } from '../supabase/supabase';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);

  async list(): Promise<Account[]> {
    const { data, error } = await this.supabase
      .from('accounts')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

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

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('accounts').delete().eq('id', id);

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

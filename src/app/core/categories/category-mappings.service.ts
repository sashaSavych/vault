import { Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { getSupabaseClient } from '../supabase/supabase';

interface CategoryMappingRow {
  bank_category: string;
  category_id: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryMappingsService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);

  /** bank_category (normalized) → category_id */
  async listByBankCategory(): Promise<Record<string, string>> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return {};
    }

    const { data, error } = await this.supabase
      .from('category_mappings')
      .select('bank_category, category_id')
      .eq('user_id', userId);

    if (error) {
      console.warn('Could not load category_mappings:', error.message);
      return {};
    }

    const mapping: Record<string, string> = {};
    for (const row of (data as CategoryMappingRow[] | null) ?? []) {
      const key = normalizeMappingKey(row.bank_category);
      if (key) {
        mapping[key] = row.category_id;
      }
    }
    return mapping;
  }
}

export function normalizeMappingKey(value: string): string {
  return value.trim().toLowerCase();
}

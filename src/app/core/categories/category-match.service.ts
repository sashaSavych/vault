import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import { getSupabaseClient } from '../supabase/supabase';

export interface VaultCategoryOption {
  id: string;
  label: string;
}

export interface MatchCategoriesResponse {
  model: string;
  bankCategories: string[];
  mapping: Record<string, string>;
  fromDb: string[];
  fromExact: string[];
  fromAi: string[];
  saved: number;
  vaultCategories: VaultCategoryOption[];
}

@Injectable({ providedIn: 'root' })
export class CategoryMatchService {
  private readonly supabase = getSupabaseClient();

  async matchFromStatement(statementText: string): Promise<MatchCategoriesResponse> {
    const endpoint = environment.chatAiEndpoint?.trim();
    if (!endpoint) {
      throw new Error('chatAiEndpoint is not configured in environment.');
    }

    const {
      data: { session },
    } = await this.supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated.');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: environment.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ statementText }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: string }).error)
          : `Category match failed (${response.status}).`;
      throw new Error(message);
    }

    return normalizeMatchResponse(data);
  }
}

function normalizeMatchResponse(data: unknown): MatchCategoriesResponse {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  return {
    model: typeof raw['model'] === 'string' ? raw['model'] : '',
    bankCategories: Array.isArray(raw['bankCategories'])
      ? raw['bankCategories'].map((value) => String(value))
      : [],
    mapping:
      raw['mapping'] && typeof raw['mapping'] === 'object' && !Array.isArray(raw['mapping'])
        ? (raw['mapping'] as Record<string, string>)
        : {},
    fromDb: stringArray(raw['fromDb']),
    fromExact: stringArray(raw['fromExact']),
    fromAi: stringArray(raw['fromAi']),
    saved: typeof raw['saved'] === 'number' ? raw['saved'] : 0,
    vaultCategories: Array.isArray(raw['vaultCategories'])
      ? (raw['vaultCategories'] as VaultCategoryOption[])
      : [],
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

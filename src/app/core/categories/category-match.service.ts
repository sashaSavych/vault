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
      throw new CategoryMatchError(
        'Import requires Gemini category matching. Set chatAiEndpoint in environment and deploy the match-categories edge function.',
      );
    }

    const {
      data: { session },
    } = await this.supabase.auth.getSession();

    if (!session?.access_token) {
      throw new CategoryMatchError('Sign in again to import outcomes.');
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: environment.supabasePublishableKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ statementText }),
      });
    } catch (error) {
      throw new CategoryMatchError(
        'Could not reach the category matching service. Check your connection and chatAiEndpoint.',
        { cause: error },
      );
    }

    const data = await readResponseJson(response);

    if (!response.ok) {
      throw new CategoryMatchError(formatCategoryMatchFailure(response.status, data));
    }

    return normalizeMatchResponse(data);
  }
}

export class CategoryMatchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CategoryMatchError';
  }
}

function formatCategoryMatchFailure(status: number, data: unknown): string {
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const detail = typeof body['error'] === 'string' ? body['error'].trim() : '';
  const model = typeof body['model'] === 'string' ? body['model'].trim() : '';
  const combined = `${detail} ${model}`.toLowerCase();

  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    combined.includes('gemini') ||
    combined.includes('gemini_api_key') ||
    combined.includes('api key') ||
    (combined.includes('model') &&
      (combined.includes('not found') ||
        combined.includes('unavailable') ||
        combined.includes('invalid') ||
        combined.includes('does not exist')))
  ) {
    const modelHint = model ? ` (${model})` : '';
    const suffix = detail ? ` ${detail}` : '';
    return `Gemini model${modelHint} is not available. Set GEMINI_API_KEY and GEMINI_MODEL in Supabase Edge Function secrets and redeploy match-categories.${suffix}`;
  }

  if (status === 401 || status === 403) {
    return 'Category matching is not authorized. Sign in again and retry import.';
  }

  if (detail) {
    return `Category matching failed: ${detail}`;
  }

  return `Category matching failed (HTTP ${status}).`;
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
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

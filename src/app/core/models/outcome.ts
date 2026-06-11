export const OUTCOME_NAME_MAX_LENGTH = 80;

export interface Outcome {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  name: string;
  amount: number;
  date: string;
  createdAt: string;
}

export interface OutcomeInput {
  name: string;
  accountId: string;
  categoryId: string;
  amount: number;
  date: string;
}

export interface OutcomeRow {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string;
  name: string;
  amount: number | string;
  date: string;
  created_at: string;
}

export interface OutcomeWithDetails extends Outcome {
  accountName: string;
  accountCurrency: string;
  categoryName: string;
}

export interface OutcomeListFilters {
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function normalizeOutcomeName(name: string): string {
  const trimmed = name.trim();
  const value = trimmed || 'Outcome';
  return value.length > OUTCOME_NAME_MAX_LENGTH
    ? value.slice(0, OUTCOME_NAME_MAX_LENGTH)
    : value;
}

export function mapOutcome(row: OutcomeRow): Outcome {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    categoryId: row.category_id,
    name: row.name,
    amount: Number(row.amount),
    date: row.date,
    createdAt: row.created_at,
  };
}

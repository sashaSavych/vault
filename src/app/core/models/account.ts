export interface Account {
  id: string;
  userId: string;
  name: string;
  currency: string;
  icon: string;
  cardIds: string[];
  balance: number;
  isDefault: boolean;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface AccountInput {
  name: string;
  currency: string;
  icon: string;
  cardIds: string[];
  balance: number;
  isDefault: boolean;
}

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  icon: string;
  card_ids: string[] | null;
  balance: number | string;
  is_default: boolean;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export function mapAccount(row: AccountRow): Account {
  const cardIds = row.card_ids?.length ? row.card_ids : ['0000'];

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    currency: row.currency,
    icon: row.icon,
    cardIds,
    balance: Number(row.balance),
    isDefault: row.is_default,
    sortOrder: row.sort_order ?? 0,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
  };
}

export interface AccountListOptions {
  includeArchived?: boolean;
}

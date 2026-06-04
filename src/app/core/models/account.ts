export interface Account {
  id: string;
  userId: string;
  name: string;
  currency: string;
  icon: string;
  cardId: string;
  balance: number;
  isDefault: boolean;
  createdAt: string;
}

export interface AccountInput {
  name: string;
  currency: string;
  icon: string;
  cardId: string;
  balance: number;
  isDefault: boolean;
}

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  icon: string;
  card_id: string;
  balance: number | string;
  is_default: boolean;
  created_at: string;
}

export function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    currency: row.currency,
    icon: row.icon,
    cardId: row.card_id ?? '0000',
    balance: Number(row.balance),
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

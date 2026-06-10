export interface Income {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  name: string;
  amount: number;
  date: string;
  createdAt: string;
}

export interface IncomeInput {
  name: string;
  accountId: string;
  categoryId: string;
  amount: number;
  date: string;
}

export interface IncomeRow {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string;
  name: string;
  amount: number | string;
  date: string;
  created_at: string;
}

export interface IncomeWithDetails extends Income {
  accountName: string;
  accountCurrency: string;
  categoryName: string;
}

export interface IncomeListFilters {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function mapIncome(row: IncomeRow): Income {
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

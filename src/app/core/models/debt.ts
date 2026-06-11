export type DebtType = 'borrow' | 'lend';
export type DebtOperationType = 'repay' | 'increase';

export interface Debt {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  amount: number;
  balance: number;
  date: string;
  type: DebtType;
  createdAt: string;
}

export interface DebtInput {
  name: string;
  accountId: string;
  amount: number;
  date: string;
  type: DebtType;
}

export interface DebtRow {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  amount: number | string;
  balance: number | string;
  date: string;
  type: DebtType;
  created_at: string;
}

export interface DebtOperation {
  id: string;
  userId: string;
  debtId: string;
  accountId: string;
  name: string;
  amount: number;
  date: string;
  notes: string | null;
  type: DebtOperationType;
  createdAt: string;
}

export interface DebtOperationInput {
  debtId: string;
  name: string;
  accountId: string;
  amount: number;
  date: string;
  notes: string;
  type: DebtOperationType;
}

export interface DebtOperationRow {
  id: string;
  user_id: string;
  debt_id: string;
  account_id: string;
  name: string;
  amount: number | string;
  date: string;
  notes: string | null;
  type: DebtOperationType;
  created_at: string;
}

export interface DebtWithDetails extends Debt {
  accountName: string;
  accountCurrency: string;
  operations: DebtOperationWithDetails[];
}

export interface DebtOperationWithDetails extends DebtOperation {
  accountName: string;
  accountCurrency: string;
}

export interface DebtListFilters {
  accountId?: string;
  type?: DebtType;
  dateFrom?: string;
  dateTo?: string;
}

export function mapDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    name: row.name,
    amount: Number(row.amount),
    balance: Number(row.balance),
    date: row.date,
    type: row.type,
    createdAt: row.created_at,
  };
}

export function mapDebtOperation(row: DebtOperationRow): DebtOperation {
  return {
    id: row.id,
    userId: row.user_id,
    debtId: row.debt_id,
    accountId: row.account_id,
    name: row.name,
    amount: Number(row.amount),
    date: row.date,
    notes: row.notes,
    type: row.type,
    createdAt: row.created_at,
  };
}

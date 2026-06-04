export interface Transfer {
  id: string;
  userId: string;
  name: string;
  fromAccountId: string;
  toAccountId: string;
  amountFrom: number;
  amountTo: number;
  exchangeRate: number | null;
  date: string;
  createdAt: string;
}

export interface TransferInput {
  name: string;
  fromAccountId: string;
  toAccountId: string;
  amountFrom: number;
  amountTo: number;
  exchangeRate: number;
  date: string;
}

export interface TransferRow {
  id: string;
  user_id: string;
  name: string;
  from_account_id: string;
  to_account_id: string;
  amount_from: number | string;
  amount_to: number | string;
  exchange_rate: number | string | null;
  date: string;
  created_at: string;
}

export interface TransferWithAccounts extends Transfer {
  fromAccountName: string;
  fromAccountCurrency: string;
  toAccountName: string;
  toAccountCurrency: string;
}

export function mapTransfer(row: TransferRow): Transfer {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amountFrom: Number(row.amount_from),
    amountTo: Number(row.amount_to),
    exchangeRate: row.exchange_rate === null ? null : Number(row.exchange_rate),
    date: row.date,
    createdAt: row.created_at,
  };
}

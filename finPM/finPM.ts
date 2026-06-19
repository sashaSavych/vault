/**
 * TypeScript model for a Finance PM backup/export JSON file (e.g. `financePM.json`).
 *
 * Format version observed: `2`.
 *
 * Relationships:
 * - `transactions` are the ledger entries (income or expense). Each row affects one `accountId`.
 * - `transfers` pair two transactions (`transactionIdFrom` = expense, `transactionIdTo` = income)
 *   with `source = 1` and usually `categoryId = -1`.
 * - `arrears` are debts/credits; `arrear_transaction_relations` links them to transactions
 *   (`source` 2–4, `categoryId = -1`).
 * - `accounts.balance`, `arrears.balance`, and `transactions.sum` are decimal strings.
 * - Dates (`transactions.date`, `arrears.date`) are Unix epoch milliseconds stored as strings.
 * - `categories.parentId = 0` means a top-level category; nested categories reference a parent id.
 * - `categories.type` and `transactions.type` use the same income/expense codes.
 * - `categoryId = -1` on a transaction means “no category” (transfers, debts, opening balances).
 * - `available` / `active` flags use `1` = visible/active, `0` = hidden/inactive.
 */

/** Export file schema version (`financePM.json` → `version`). */
export type FinPMVersion = 2;

/** Decimal amount as exported by Finance PM, e.g. `"150.0"`, `"-12.5"`. */
export type FinPMMoneyString = string;

/** Unix timestamp in milliseconds, e.g. `"1507766400000"`. */
export type FinPMEpochMsString = string;

/** `1` = active/visible, `0` = inactive/hidden. */
export type FinPMAvailability = 0 | 1;

/** Category kind: `1` = income, `2` = expense/outcome. */
export type FinPMCategoryType = 1 | 2;

/** Transaction kind: `1` = income (credits account), `2` = expense (debits account). */
export type FinPMTransactionType = 1 | 2;

/**
 * How a transaction was created.
 * Inferred from `financePM.json`:
 * - `0` — manual entry
 * - `1` — transfer (see `transfers`)
 * - `2` — debt/arrear, income side
 * - `3` — debt/arrear, expense side
 * - `4` — debt-related income
 * - `5` — opening / initial account balance
 */
export type FinPMTransactionSource = 0 | 1 | 2 | 3 | 4 | 5;

/** Numeric row id used by accounts and categories. */
export type FinPMNumericId = number;

/** String row id used by transactions, transfers, arrears, and join tables. */
export type FinPMStringId = string;

/** `0` = no parent (root category). */
export type FinPMParentId = FinPMNumericId;

/** `-1` = no category assigned. */
export type FinPMCategoryRef = FinPMNumericId | -1;

export interface FinPMAccount {
  id: FinPMNumericId;
  name: string;
  /** Icon index in the Finance PM icon set (0–49 in sample export). */
  icon: number;
  balance: FinPMMoneyString;
  /** `1` = active, `0` = archived/inactive. */
  active: FinPMAvailability;
  /** `1` = default account. */
  isDef: FinPMAvailability;
  currencyId: FinPMNumericId;
  orderId: number;
}

export interface FinPMCurrency {
  id: FinPMNumericId;
  name: string;
  shortName: string;
  /** Decimal places shown for this currency. */
  point: number;
  available: FinPMAvailability;
}

export interface FinPMCategory {
  id: FinPMNumericId;
  name: string;
  type: FinPMCategoryType;
  available: FinPMAvailability;
  orderId: number;
  /** `0` for top-level categories; otherwise parent category id. */
  parentId: FinPMParentId;
}

export interface FinPMTransaction {
  id: FinPMStringId;
  name: string;
  type: FinPMTransactionType;
  categoryId: FinPMCategoryRef;
  date: FinPMEpochMsString;
  sum: FinPMMoneyString;
  accountId: FinPMNumericId;
  description: string;
  source: FinPMTransactionSource;
  available: FinPMAvailability;
}

export interface FinPMTransfer {
  id: FinPMStringId;
  name: string;
  /** Expense transaction id (`type = 2`). */
  transactionIdFrom: FinPMStringId;
  /** Income transaction id (`type = 1`). */
  transactionIdTo: FinPMStringId;
  available: FinPMAvailability;
}

/** Debt / money lent or borrowed (Finance PM “arrear”). */
export interface FinPMArrear {
  id: FinPMStringId;
  name: string;
  balance: FinPMMoneyString;
  accountId: FinPMNumericId;
  date: FinPMEpochMsString;
  description: string;
  available: FinPMAvailability;
}

export interface FinPMArrearTransactionRelation {
  id: FinPMStringId;
  arrearId: FinPMStringId;
  transactionId: FinPMStringId;
}

/** Recurring transaction template (empty in sample export). */
export interface FinPMPattern {
  id: FinPMStringId;
  [key: string]: unknown;
}

/** Planned/budget operation (empty in sample export). */
export interface FinPMPlanOperation {
  id: FinPMStringId;
  [key: string]: unknown;
}

/** Spending limit (empty in sample export). */
export interface FinPMLimit {
  id: FinPMStringId;
  [key: string]: unknown;
}

/** Limit configuration row (empty in sample export). */
export interface FinPMLimitParameter {
  id: FinPMStringId;
  [key: string]: unknown;
}

/** Receipt photo attachment (empty in sample export). */
export interface FinPMTransactionPhoto {
  id: FinPMStringId;
  [key: string]: unknown;
}

/** Root document shape of a Finance PM JSON export. */
export interface FinPMExport {
  version: FinPMVersion;
  accounts: FinPMAccount[];
  currencies: FinPMCurrency[];
  categories: FinPMCategory[];
  transactions: FinPMTransaction[];
  transfers: FinPMTransfer[];
  arrears: FinPMArrear[];
  arrear_transaction_relations: FinPMArrearTransactionRelation[];
  patterns: FinPMPattern[];
  plan_operations: FinPMPlanOperation[];
  limits: FinPMLimit[];
  limit_parameters: FinPMLimitParameter[];
  transaction_photos: FinPMTransactionPhoto[];
}

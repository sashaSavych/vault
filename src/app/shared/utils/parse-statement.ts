import type { Account } from '../../core/models/account';
import type { Category } from '../../core/models/category';
import type { OutcomeInput } from '../../core/models/outcome';
import { categoryLabel } from './category-select-options';

export const COL_DATE = 'Дата';
export const COL_CATEGORY = 'Категорія';
export const COL_CARD = 'Картка';
export const COL_NAME = 'Опис операції';
export const COL_CARD_AMOUNT = 'Сума в валюті картки';
export const COL_TX_AMOUNT = 'Сума в валюті транзакції';

export interface StatementRow {
  dateRaw: string;
  bankCategory: string;
  card: string;
  name: string;
  cardAmount: number;
  transactionAmount: number;
}

export const UNDEFINED_ACCOUNT_NAME = 'Undefined';

export interface OutcomeImportItem extends OutcomeInput {
  bankCategory: string;
  cardLast4?: string;
  accountCardId?: string;
  accountName?: string;
  accountFallback?: boolean;
  categoryName?: string;
  error?: string;
}

export function parseStatementRows(text: string): StatementRow[] {
  const grid = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split('\t'));

  return parseStatementGrid(grid);
}

export function parseStatementGrid(grid: unknown[][]): StatementRow[] {
  const headerIdx = grid.findIndex((row) => {
    const headers = row.map(cellText);
    return (
      headers.includes(COL_CATEGORY) &&
      headers.includes(COL_CARD_AMOUNT) &&
      headers.includes(COL_NAME)
    );
  });

  if (headerIdx < 0) {
    throw new Error(`Statement header not found (expected "${COL_CATEGORY}").`);
  }

  const headers = grid[headerIdx].map(cellText);
  const dateIdx = headers.indexOf(COL_DATE);
  const categoryIdx = headers.indexOf(COL_CATEGORY);
  const cardIdx = headers.indexOf(COL_CARD);
  const nameIdx = headers.indexOf(COL_NAME);
  const cardAmountIdx = headers.indexOf(COL_CARD_AMOUNT);
  const txAmountIdx = headers.indexOf(COL_TX_AMOUNT);

  if (
    dateIdx < 0 ||
    categoryIdx < 0 ||
    cardIdx < 0 ||
    nameIdx < 0 ||
    cardAmountIdx < 0 ||
    txAmountIdx < 0
  ) {
    throw new Error('Statement is missing required columns.');
  }

  const rows: StatementRow[] = [];

  for (let i = headerIdx + 1; i < grid.length; i++) {
    const cells = grid[i] ?? [];
    const cardAmount = parseAmount(cells[cardAmountIdx]);

    if (cardAmount === null || cardAmount >= 0) {
      continue;
    }

    const transactionAmount = parseAmount(cells[txAmountIdx]);
    if (transactionAmount === null) {
      continue;
    }

    rows.push({
      dateRaw: cellText(cells[dateIdx]),
      bankCategory: cellText(cells[categoryIdx]),
      card: cellText(cells[cardIdx]),
      name: cellText(cells[nameIdx]),
      cardAmount,
      transactionAmount: Math.abs(transactionAmount),
    });
  }

  return rows;
}

export function extractBankCategories(rows: StatementRow[]): string[] {
  return [...new Set(rows.map((row) => row.bankCategory).filter(Boolean))];
}

export function extractBankCategoriesFromStatement(text: string): string[] {
  return extractBankCategories(parseStatementRows(text));
}

/** TSV text from grid rows — used for category-matching edge function. */
export function gridToStatementText(grid: unknown[][]): string {
  return grid.map((row) => row.map(cellText).join('\t')).join('\n');
}

export function parseCardLast4(card: string): string | null {
  const trimmed = card.trim();
  const endMatch = trimmed.match(/(\d{4})\s*$/);
  if (endMatch) {
    return endMatch[1];
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 4) {
    return digits.slice(-4);
  }

  return null;
}

export function normalizeAccountCardId(cardId: string): string {
  const digits = cardId.replace(/\D/g, '');
  if (digits.length === 0) {
    return '';
  }
  return digits.slice(-4).padStart(4, '0');
}

export function findAccountByCardLast4(
  cardValue: string,
  accounts: Account[],
): { account?: Account; cardLast4: string | null } {
  const cardLast4 = parseCardLast4(cardValue);
  if (!cardLast4) {
    return { cardLast4: null };
  }

  const account = accounts.find(
    (item) => normalizeAccountCardId(item.cardId) === cardLast4,
  );

  return { account, cardLast4 };
}

export function findUndefinedAccount(accounts: Account[]): Account | undefined {
  return accounts.find(
    (account) => account.name.trim().toLowerCase() === UNDEFINED_ACCOUNT_NAME.toLowerCase(),
  );
}

export function parseStatementDate(raw: string): string | null {
  const datePart = raw.trim().split(/\s+/)[0] ?? '';
  const match = datePart.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function buildOutcomeImports(
  rows: StatementRow[],
  accounts: Account[],
  categories: Category[],
  categoryMapping: Record<string, string>,
): OutcomeImportItem[] {
  const undefinedAccount = findUndefinedAccount(accounts);

  return rows.map((row) => {
    const { account: matchedAccount, cardLast4 } = findAccountByCardLast4(row.card, accounts);
    const accountFallback = !matchedAccount && undefinedAccount !== undefined;
    const account = matchedAccount ?? undefinedAccount;
    const categoryId = categoryMapping[row.bankCategory] ?? '';
    const date = parseStatementDate(row.dateRaw);
    const errors: string[] = [];

    if (!account) {
      errors.push(
        cardLast4
          ? `No account with ID ${cardLast4} and no "${UNDEFINED_ACCOUNT_NAME}" account found`
          : `Could not read last 4 digits from card "${row.card}" and no "${UNDEFINED_ACCOUNT_NAME}" account found`,
      );
    }
    if (!categoryId) {
      errors.push(`No category for "${row.bankCategory}"`);
    }
    if (!date) {
      errors.push(`Invalid date "${row.dateRaw}"`);
    }
    if (row.transactionAmount <= 0) {
      errors.push('Invalid amount');
    }

    return {
      name: row.name.trim() || 'Outcome',
      accountId: account?.id ?? '',
      categoryId,
      amount: row.transactionAmount,
      date: date ?? '',
      bankCategory: row.bankCategory,
      cardLast4: cardLast4 ?? undefined,
      accountCardId: account ? normalizeAccountCardId(account.cardId) : undefined,
      accountName: account?.name,
      accountFallback: accountFallback || undefined,
      categoryName: categoryId ? categoryLabel(categories, categoryId) : undefined,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  });
}

export function isImportSavable(item: OutcomeImportItem): boolean {
  return (
    !item.error &&
    Boolean(item.accountId) &&
    Boolean(item.categoryId) &&
    Boolean(item.date) &&
    item.amount > 0
  );
}

export function toOutcomeInput(item: OutcomeImportItem): OutcomeInput {
  return {
    name: item.name,
    accountId: item.accountId,
    categoryId: item.categoryId,
    amount: item.amount,
    date: item.date,
  };
}

export function fallbackCategoryMapping(
  bankCategories: string[],
  categories: Category[],
): Record<string, string> {
  const other =
    categories.find((category) => category.name.toLowerCase() === 'other' && !category.parentId) ??
    categories.find((category) => category.name.toLowerCase() === 'other');

  if (!other) {
    return {};
  }

  return Object.fromEntries(bankCategories.map((bankCategory) => [bankCategory, other.id]));
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    const day = value.getDate().toString().padStart(2, '0');
    const month = (value.getMonth() + 1).toString().padStart(2, '0');
    const hours = value.getHours().toString().padStart(2, '0');
    const minutes = value.getMinutes().toString().padStart(2, '0');
    const seconds = value.getSeconds().toString().padStart(2, '0');
    return `${day}.${month}.${value.getFullYear()} ${hours}:${minutes}:${seconds}`;
  }

  return String(value).trim();
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

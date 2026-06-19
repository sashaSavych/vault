import type { Account } from '../../core/models/account';
import type { Category } from '../../core/models/category';
import type { OutcomeInput, OutcomeWithDetails } from '../../core/models/outcome';
import { categoryLabel } from './category-select-options';

export const PENDING_OUTCOME_ID_PREFIX = 'pending:';

export function isPendingOutcomeId(id: string): boolean {
  return id.startsWith(PENDING_OUTCOME_ID_PREFIX);
}

export function createPendingOutcomeId(): string {
  return `${PENDING_OUTCOME_ID_PREFIX}${crypto.randomUUID()}`;
}

export function toOutcomeWithDetails(
  id: string,
  input: OutcomeInput,
  accounts: Account[],
  categories: Category[],
): OutcomeWithDetails {
  const account = accounts.find((item) => item.id === input.accountId);

  return {
    id,
    userId: '',
    accountId: input.accountId,
    categoryId: input.categoryId,
    name: input.name,
    amount: input.amount,
    date: input.date,
    createdAt: '',
    accountName: account?.name ?? 'Unknown',
    accountCurrency: account?.currency ?? '',
    categoryName: categoryLabel(categories, input.categoryId),
  };
}

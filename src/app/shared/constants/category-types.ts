import type { CategoryType } from '../../core/models/category';

export const CATEGORY_TYPES: { value: CategoryType; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'outcome', label: 'Outcome' },
];

export function categoryTypeLabel(type: CategoryType): string {
  return CATEGORY_TYPES.find((t) => t.value === type)?.label ?? type;
}

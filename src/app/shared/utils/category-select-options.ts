import type { Category } from '../../core/models/category';

import { categoryPath, orderedCategories } from './category-tree';

export function categoryLabel(categories: Category[], categoryId: string): string {
  if (!categories.some((category) => category.id === categoryId)) {
    return 'Unknown';
  }

  return categoryPath(categories, categoryId);
}

export interface CategoryFilterOption {
  label: string;
  value: string | null;
}

export function categoryFilterOptions(categories: Category[]): CategoryFilterOption[] {
  return [{ label: 'All categories', value: null }, ...categorySelectOptions(categories)];
}

export function categorySelectOptions(categories: Category[]): { label: string; value: string }[] {
  if (categories.length === 0) {
    return [];
  }

  const type = categories[0].type;

  return orderedCategories(categories, type).map((category) => ({
    label: categoryPath(categories, category.id),
    value: category.id,
  }));
}

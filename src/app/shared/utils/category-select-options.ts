import type { Category } from '../../core/models/category';

import { orderedCategories } from './category-tree';

export function categoryLabel(categories: Category[], categoryId: string): string {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    return 'Unknown';
  }

  const parent = category.parentId
    ? categories.find((c) => c.id === category.parentId)
    : undefined;

  return parent ? `${parent.name} / ${category.name}` : category.name;
}

export function categorySelectOptions(categories: Category[]): { label: string; value: string }[] {
  if (categories.length === 0) {
    return [];
  }

  const byId = new Map(categories.map((c) => [c.id, c]));
  const type = categories[0].type;

  return orderedCategories(categories, type).map((category) => {
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    return {
      label: parent ? `${parent.name} / ${category.name}` : category.name,
      value: category.id,
    };
  });
}

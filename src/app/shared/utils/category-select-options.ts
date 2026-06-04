import type { Category } from '../../core/models/category';

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
  const byId = new Map(categories.map((c) => [c.id, c]));

  return categories.map((c) => {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    return {
      label: parent ? `${parent.name} / ${c.name}` : c.name,
      value: c.id,
    };
  });
}

import type { Category, CategoryType } from '../../core/models/category';

export interface CategoryNode {
  category: Category;
  children: Category[];
}

export function buildCategoryTree(categories: Category[], type: CategoryType): CategoryNode[] {
  const ofType = categories.filter((c) => c.type === type);
  const roots = ofType
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return roots.map((root) => ({
    category: root,
    children: ofType
      .filter((c) => c.parentId === root.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  }));
}

export function orderedCategories(categories: Category[], type: CategoryType): Category[] {
  return buildCategoryTree(categories, type).flatMap((node) => [node.category, ...node.children]);
}

export function categorySortIndex(
  categories: Category[],
  type: CategoryType,
): Map<string, number> {
  const order = new Map<string, number>();
  orderedCategories(categories, type).forEach((category, index) => {
    order.set(category.id, index);
  });
  return order;
}

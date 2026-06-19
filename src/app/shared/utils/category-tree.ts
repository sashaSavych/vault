import type { Category, CategoryType } from '../../core/models/category';

export interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

export function buildCategoryTree(categories: Category[], type: CategoryType): CategoryNode[] {
  const ofType = categories.filter((c) => c.type === type);
  const byParent = new Map<string | null, Category[]>();

  for (const category of ofType) {
    const siblings = byParent.get(category.parentId) ?? [];
    siblings.push(category);
    byParent.set(category.parentId, siblings);
  }

  const sortSiblings = (items: Category[]): Category[] =>
    [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const buildNodes = (parentId: string | null): CategoryNode[] =>
    sortSiblings(byParent.get(parentId) ?? []).map((category) => ({
      category,
      children: buildNodes(category.id),
    }));

  return buildNodes(null);
}

export function flattenCategoryTree(nodes: CategoryNode[]): Category[] {
  return nodes.flatMap((node) => [node.category, ...flattenCategoryTree(node.children)]);
}

export function orderedCategories(categories: Category[], type: CategoryType): Category[] {
  return flattenCategoryTree(buildCategoryTree(categories, type));
}

export function categoryPath(categories: Category[], categoryId: string): string {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const parts: string[] = [];
  let current = byId.get(categoryId);

  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return parts.join(' / ');
}

export function categoryDescendantIds(categories: Category[], categoryId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [categoryId];

  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const category of categories) {
      if (category.parentId === id && !descendants.has(category.id)) {
        descendants.add(category.id);
        queue.push(category.id);
      }
    }
  }

  return descendants;
}

export function isCategoryUnder(
  categories: Category[],
  categoryId: string,
  ancestorId: string,
): boolean {
  let current = categories.find((category) => category.id === categoryId);

  while (current?.parentId) {
    if (current.parentId === ancestorId) {
      return true;
    }
    current = categories.find((item) => item.id === current!.parentId);
  }

  return false;
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

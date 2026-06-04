export type CategoryType = 'income' | 'outcome';

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
  icon: string;
  sortOrder: number;
  createdAt: string;
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  parentId: string | null;
  icon: string;
  sortOrder: number;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  parent_id: string | null;
  icon: string;
  sort_order: number;
  created_at: string;
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    parentId: row.parent_id,
    icon: row.icon,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

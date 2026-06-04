import { Injectable, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import type { Category, CategoryInput, CategoryRow, CategoryType } from '../models/category';
import { mapCategory } from '../models/category';
import { getSupabaseClient } from '../supabase/supabase';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly supabase = getSupabaseClient();
  private readonly auth = inject(AuthService);

  async list(type?: CategoryType): Promise<Category[]> {
    let query = this.supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data as CategoryRow[] | null)?.map(mapCategory) ?? [];
  }

  async ensureDefaults(): Promise<void> {
    const { error } = await this.supabase.rpc('seed_default_categories');

    if (error) {
      throw error;
    }
  }

  async create(input: CategoryInput): Promise<Category> {
    await this.validateParent(input.parentId, input.type);

    const { data, error } = await this.supabase
      .from('categories')
      .insert({
        user_id: this.requireUserId(),
        name: input.name.trim(),
        type: input.type,
        parent_id: input.parentId,
        icon: input.icon,
        sort_order: input.sortOrder,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapCategory(data as CategoryRow);
  }

  async update(id: string, input: CategoryInput): Promise<Category> {
    if (input.parentId === id) {
      throw new Error('A category cannot be its own parent.');
    }

    await this.validateParent(input.parentId, input.type, id);

    const { data, error } = await this.supabase
      .from('categories')
      .update({
        name: input.name.trim(),
        type: input.type,
        parent_id: input.parentId,
        icon: input.icon,
        sort_order: input.sortOrder,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapCategory(data as CategoryRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('categories').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  nextSortOrder(categories: Category[], type: CategoryType, parentId: string | null): number {
    const siblings = categories.filter((c) => c.type === type && c.parentId === parentId);
    if (siblings.length === 0) {
      return 0;
    }
    return Math.max(...siblings.map((c) => c.sortOrder)) + 1;
  }

  private async validateParent(
    parentId: string | null,
    type: CategoryType,
    editingId?: string,
  ): Promise<void> {
    if (!parentId) {
      return;
    }

    if (editingId && parentId === editingId) {
      throw new Error('A category cannot be its own parent.');
    }

    const { data, error } = await this.supabase
      .from('categories')
      .select('id, type, parent_id')
      .eq('id', parentId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Parent category not found.');
    }

    const parent = data as Pick<CategoryRow, 'id' | 'type' | 'parent_id'>;
    if (parent.type !== type) {
      throw new Error('Parent must be the same type (income or outcome).');
    }

    if (parent.parent_id) {
      throw new Error('Parent must be a top-level category.');
    }

    if (editingId) {
      const { data: children, error: childrenError } = await this.supabase
        .from('categories')
        .select('id')
        .eq('parent_id', editingId);

      if (childrenError) {
        throw childrenError;
      }

      if (children && children.length > 0) {
        throw new Error(
          'Remove or reassign subcategories before assigning a parent to this category.',
        );
      }

      if (children?.some((c) => c.id === parentId)) {
        throw new Error('Cannot set parent to a subcategory of this category.');
      }
    }
  }

  private requireUserId(): string {
    const userId = this.auth.user()?.id;
    if (!userId) {
      throw new Error('Not authenticated');
    }
    return userId;
  }
}

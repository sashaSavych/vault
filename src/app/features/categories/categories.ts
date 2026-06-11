import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { CategoriesService } from '../../core/categories/categories.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Category, CategoryType } from '../../core/models/category';
import { CATEGORY_ICONS } from '../../shared/constants/category-icons';
import { CATEGORY_TYPES } from '../../shared/constants/category-types';
import { buildCategoryTree, type CategoryNode } from '../../shared/utils/category-tree';
import { toErrorMessage } from '../../shared/utils/to-error-message';

const NO_PARENT = '';

@Component({
  selector: 'app-categories',
  imports: [
    DragDropModule,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Select,
    ConfirmDialog,
    Message,
  ],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
})
export class Categories implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  protected readonly auth = inject(AuthService);
  protected readonly categoryTypes = [...CATEGORY_TYPES];
  protected readonly icons = [...CATEGORY_ICONS];

  protected readonly categories = signal<Category[]>([]);
  protected readonly incomeTree = computed(() => buildCategoryTree(this.categories(), 'income'));
  protected readonly outcomeTree = computed(() => buildCategoryTree(this.categories(), 'outcome'));
  protected readonly incomeCount = computed(
    () => this.categories().filter((category) => category.type === 'income').length,
  );
  protected readonly outcomeCount = computed(
    () => this.categories().filter((category) => category.type === 'outcome').length,
  );

  protected readonly incomeExpanded = signal(false);
  protected readonly outcomeExpanded = signal(false);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly reordering = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly presetParentId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    type: ['income' as CategoryType, Validators.required],
    parentId: [NO_PARENT],
    icon: ['pi-tag', Validators.required],
  });

  ngOnInit(): void {
    void this.reload();
  }

  protected toggleIncomeSection(): void {
    this.incomeExpanded.update((expanded) => !expanded);
  }

  protected toggleOutcomeSection(): void {
    this.outcomeExpanded.update((expanded) => !expanded);
  }

  protected parentOptions(): { label: string; value: string }[] {
    const type = this.form.getRawValue().type;
    const editingId = this.editingId();

    if (editingId && this.hasSubcategories(editingId)) {
      return [{ label: 'None (top level)', value: NO_PARENT }];
    }

    const roots = buildCategoryTree(this.categories(), type)
      .map((node) => node.category)
      .filter((category) => category.id !== editingId);

    return [
      { label: 'None (top level)', value: NO_PARENT },
      ...roots.map((category) => ({ label: category.name, value: category.id })),
    ];
  }

  protected parentFieldHint(): string {
    if (this.presetParentId()) {
      return 'Parent is set for this subcategory.';
    }
    if (this.editingId() && this.hasSubcategories(this.editingId()!)) {
      return 'Top-level only while this category has subcategories.';
    }
    return 'Choose a top-level parent, or None to keep at top level.';
  }

  protected parentName(parentId: string | null): string | null {
    if (!parentId) {
      return null;
    }
    return this.categories().find((c) => c.id === parentId)?.name ?? null;
  }

  protected iconClass(icon: string): string {
    return icon.startsWith('pi-') ? `pi ${icon}` : `pi pi-${icon}`;
  }

  protected openCreate(type: CategoryType, parentId: string | null = null): void {
    this.editingId.set(null);
    this.presetParentId.set(parentId);
    this.errorMessage.set(null);
    this.dialogErrorMessage.set(null);
    this.form.reset({
      name: '',
      type,
      parentId: parentId ?? NO_PARENT,
      icon: 'pi-tag',
    });
    this.syncFormDisabledState();
    this.dialogVisible.set(true);
  }

  protected openEdit(category: Category): void {
    this.editingId.set(category.id);
    this.presetParentId.set(null);
    this.dialogErrorMessage.set(null);
    this.form.reset({
      name: category.name,
      type: category.type,
      parentId: category.parentId ?? NO_PARENT,
      icon: category.icon,
    });
    this.syncFormDisabledState();
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingId.set(null);
    this.presetParentId.set(null);
    this.dialogErrorMessage.set(null);
    this.form.controls.type.enable({ emitEvent: false });
    this.form.controls.parentId.enable({ emitEvent: false });
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const parentId = raw.parentId === NO_PARENT ? null : raw.parentId;

    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    try {
      const id = this.editingId();
      const sortOrder = id
        ? (this.categories().find((c) => c.id === id)?.sortOrder ?? 0)
        : this.categoriesService.nextSortOrder(this.categories(), raw.type, parentId);

      const input = {
        name: raw.name,
        type: raw.type,
        parentId,
        icon: raw.icon,
        sortOrder,
      };

      if (id) {
        await this.categoriesService.update(id, input);
      } else {
        await this.categoriesService.create(input);
      }

      this.closeDialog();
      await this.reload();
    } catch (error) {
      this.dialogErrorMessage.set(toCategoryErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async dropRootCategory(
    event: CdkDragDrop<CategoryNode[]>,
    type: CategoryType,
  ): Promise<void> {
    if (event.previousIndex === event.currentIndex || this.reordering()) {
      return;
    }

    const tree = [...(type === 'income' ? this.incomeTree() : this.outcomeTree())];
    moveItemInArray(tree, event.previousIndex, event.currentIndex);
    this.applySiblingOrder(tree.map((node) => node.category));

    this.reordering.set(true);
    this.errorMessage.set(null);

    try {
      await this.categoriesService.reorder(tree.map((node) => node.category.id));
    } catch (error) {
      this.errorMessage.set(toCategoryErrorMessage(error));
      await this.reload();
    } finally {
      this.reordering.set(false);
    }
  }

  protected async dropChildCategory(
    event: CdkDragDrop<Category[]>,
    parentId: string,
  ): Promise<void> {
    if (event.previousIndex === event.currentIndex || this.reordering()) {
      return;
    }

    const children = [...event.container.data];
    moveItemInArray(children, event.previousIndex, event.currentIndex);
    this.applySiblingOrder(children);

    this.reordering.set(true);
    this.errorMessage.set(null);

    try {
      await this.categoriesService.reorder(children.map((child) => child.id));
    } catch (error) {
      this.errorMessage.set(toCategoryErrorMessage(error));
      await this.reload();
    } finally {
      this.reordering.set(false);
    }
  }

  protected confirmDelete(category: Category, event: Event): void {
    const hasChildren = this.categories().some((c) => c.parentId === category.id);
    const detail = hasChildren ? ' Its subcategories will also be deleted.' : '';

    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: `Delete "${category.name}"?${detail}`,
      header: 'Delete category',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => void this.deleteCategory(category.id),
    });
  }

  protected showError(controlName: 'name'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  private syncFormDisabledState(): void {
    const disableType = !!this.editingId() || !!this.presetParentId();
    const disableParent = !!this.presetParentId();

    if (disableType) {
      this.form.controls.type.disable({ emitEvent: false });
    } else {
      this.form.controls.type.enable({ emitEvent: false });
    }

    if (disableParent) {
      this.form.controls.parentId.disable({ emitEvent: false });
    } else {
      this.form.controls.parentId.enable({ emitEvent: false });
    }
  }

  private hasSubcategories(categoryId: string): boolean {
    return this.categories().some((c) => c.parentId === categoryId);
  }

  private async deleteCategory(id: string): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.categoriesService.remove(id);
      await this.reload();
    } catch (error) {
      this.errorMessage.set(toCategoryErrorMessage(error));
    }
  }

  private applySiblingOrder(siblings: Category[]): void {
    const categories = [...this.categories()];

    siblings.forEach((sibling, index) => {
      const position = categories.findIndex((category) => category.id === sibling.id);
      if (position >= 0) {
        categories[position] = { ...categories[position], sortOrder: index };
      }
    });

    this.categories.set(categories);
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.categoriesService.ensureDefaults();
      this.categories.set(await this.categoriesService.list());
    } catch (error) {
      this.errorMessage.set(toCategoryErrorMessage(error));
      this.categories.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}

function toCategoryErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505') {
    return 'A category with this name already exists under the same parent.';
  }
  return toErrorMessage(error);
}

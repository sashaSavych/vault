import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';

import { AccountsService } from '../../../core/accounts/accounts.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CategoriesService } from '../../../core/categories/categories.service';
import type { Account } from '../../../core/models/account';
import type { Category } from '../../../core/models/category';
import type { OutcomeWithDetails } from '../../../core/models/outcome';
import { OutcomesService } from '../../../core/outcomes/outcomes.service';
import {
  aggregateOutcomesByCategory,
  sumOutcomesByCurrency,
  type OutcomeCategoryReportRow,
  type OutcomeReportCurrencyTotal,
} from '../../../shared/utils/aggregate-outcomes-by-category';
import { AccountSelectLabel } from '../../../shared/components/account-select-label/account-select-label';
import { accountSelectOptions } from '../../../shared/utils/account-select-options';
import { categorySelectOptions } from '../../../shared/utils/category-select-options';
import {
  insufficientBalanceWarning,
  proceedOrConfirmInsufficientBalance,
} from '../../../shared/utils/confirm-insufficient-balance';
import { formatBalance } from '../../../shared/utils/format-balance';
import { formatDate, parseIsoDate, toIsoDateString } from '../../../shared/utils/format-date';
import { toErrorMessage } from '../../../shared/utils/to-error-message';

interface SelectedCategory {
  id: string;
  name: string;
}

@Component({
  selector: 'app-outcomes-by-category-report',
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    Button,
    Select,
    DatePicker,
    Dialog,
    InputText,
    InputNumber,
    ConfirmDialog,
    Message,
    AccountSelectLabel,
  ],
  templateUrl: './outcomes-by-category.html',
  styleUrl: './outcomes-by-category.scss',
})
export class OutcomesByCategoryReport implements OnInit {
  private readonly outcomesService = inject(OutcomesService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  protected readonly auth = inject(AuthService);
  protected readonly formatBalance = formatBalance;
  protected readonly formatDate = formatDate;

  protected readonly accounts = signal<Account[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly rows = signal<OutcomeCategoryReportRow[]>([]);
  protected readonly grandTotals = signal<OutcomeReportCurrencyTotal[]>([]);
  protected readonly categoryOutcomes = signal<OutcomeWithDetails[]>([]);
  protected readonly outcomeCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingOutcome = signal<OutcomeWithDetails | null>(null);
  protected readonly selectedCategory = signal<SelectedCategory | null>(null);

  protected readonly filterCategoryId = signal<string | null>(null);
  protected readonly filterDateFrom = signal<Date | null>(null);
  protected readonly filterDateTo = signal<Date | null>(null);

  protected readonly dialogTitle = computed(() =>
    this.editingId() ? 'Edit outcome' : 'Create outcome',
  );

  protected readonly categoryOptions = computed(() => [
    { label: 'All categories', value: null as string | null },
    ...categorySelectOptions(this.categories()),
  ]);

  protected readonly formCategoryOptions = computed(() =>
    categorySelectOptions(this.categories()),
  );

  protected readonly formAccountOptions = computed(() => accountSelectOptions(this.accounts()));

  protected readonly form = this.fb.nonNullable.group({
    name: ['Outcome', [Validators.required, Validators.maxLength(80)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    categoryId: ['', Validators.required],
    accountId: ['', Validators.required],
  });

  ngOnInit(): void {
    void this.reload();
  }

  protected accountBalance(accountId: string): string | null {
    const account = this.accounts().find((item) => item.id === accountId);
    if (!account) {
      return null;
    }
    return formatBalance(account.balance, account.currency);
  }

  protected async applyFilters(): Promise<void> {
    await this.runReport();
    if (this.selectedCategory()) {
      await this.loadCategoryOutcomes();
    }
  }

  protected async clearFilters(): Promise<void> {
    this.filterCategoryId.set(null);
    this.filterDateFrom.set(null);
    this.filterDateTo.set(null);
    this.closeCategoryDetail();
    await this.runReport();
  }

  protected openCategory(row: OutcomeCategoryReportRow): void {
    this.selectedCategory.set({ id: row.categoryId, name: row.categoryName });
    void this.loadCategoryOutcomes();
  }

  protected closeCategoryDetail(): void {
    this.selectedCategory.set(null);
    this.categoryOutcomes.set([]);
  }

  protected openEdit(outcome: OutcomeWithDetails): void {
    this.editingId.set(outcome.id);
    this.editingOutcome.set(outcome);
    this.dialogErrorMessage.set(null);
    this.form.reset({
      name: outcome.name,
      amount: outcome.amount,
      date: parseIsoDate(outcome.date),
      categoryId: outcome.categoryId,
      accountId: outcome.accountId,
    });
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingId.set(null);
    this.editingOutcome.set(null);
    this.dialogErrorMessage.set(null);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    await proceedOrConfirmInsufficientBalance(
      this.confirmation,
      this.outcomeInsufficientBalanceWarning(),
      () => this.performSave(),
    );
  }

  private outcomeInsufficientBalanceWarning(): string | null {
    const raw = this.form.getRawValue();
    const editing = this.editingOutcome();
    const account = this.accounts().find((item) => item.id === raw.accountId);

    if (!account || !editing) {
      return null;
    }

    const available =
      raw.accountId === editing.accountId
        ? account.balance + editing.amount
        : account.balance;

    return insufficientBalanceWarning(available, raw.amount, account.currency);
  }

  private async performSave(): Promise<void> {
    const raw = this.form.getRawValue();

    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    const input = {
      name: raw.name,
      accountId: raw.accountId,
      categoryId: raw.categoryId,
      amount: raw.amount,
      date: toIsoDateString(raw.date),
    };

    try {
      const id = this.editingId();
      if (!id) {
        return;
      }

      await this.outcomesService.update(id, input);
      this.closeDialog();
      await this.refreshAfterChange();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(outcome: OutcomeWithDetails, event: Event): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: `Delete "${outcome.name}"? The account balance will be restored.`,
      header: 'Delete outcome',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => void this.deleteOutcome(outcome.id),
    });
  }

  protected showError(controlName: 'name'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  private async deleteOutcome(id: string): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.outcomesService.remove(id);
      await this.refreshAfterChange();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    }
  }

  private async refreshAfterChange(): Promise<void> {
    const accounts = await this.accountsService.list();
    this.accounts.set(accounts);
    await this.runReport();

    const selected = this.selectedCategory();
    if (!selected) {
      return;
    }

    const stillVisible = this.rows().some((row) => row.categoryId === selected.id);
    if (!stillVisible) {
      this.closeCategoryDetail();
      return;
    }

    await this.loadCategoryOutcomes();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.categoriesService.ensureDefaults();
      const [accounts, categories] = await Promise.all([
        this.accountsService.list(),
        this.categoriesService.list('outcome'),
      ]);
      this.accounts.set(accounts);
      this.categories.set(categories);
      await this.runReport();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.rows.set([]);
      this.grandTotals.set([]);
      this.outcomeCount.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  private async runReport(): Promise<void> {
    this.errorMessage.set(null);

    try {
      const outcomes = await this.outcomesService.list(this.reportFilters());

      this.outcomeCount.set(outcomes.length);
      this.rows.set(aggregateOutcomesByCategory(outcomes));
      this.grandTotals.set(sumOutcomesByCurrency(outcomes));
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.rows.set([]);
      this.grandTotals.set([]);
      this.outcomeCount.set(0);
    }
  }

  private async loadCategoryOutcomes(): Promise<void> {
    const selected = this.selectedCategory();
    if (!selected) {
      return;
    }

    this.detailLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.categoryOutcomes.set(
        await this.outcomesService.list({
          ...this.reportFilters(),
          categoryId: selected.id,
        }),
      );
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.categoryOutcomes.set([]);
    } finally {
      this.detailLoading.set(false);
    }
  }

  private reportFilters() {
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();

    return {
      categoryId: this.filterCategoryId() ?? undefined,
      dateFrom: dateFrom ? toIsoDateString(dateFrom) : undefined,
      dateTo: dateTo ? toIsoDateString(dateTo) : undefined,
    };
  }
}

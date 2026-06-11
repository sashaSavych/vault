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
import { IncomesService } from '../../../core/incomes/incomes.service';
import type { Account } from '../../../core/models/account';
import type { Category } from '../../../core/models/category';
import type { IncomeWithDetails } from '../../../core/models/income';
import {
  aggregateIncomesByCategory,
  sumIncomesByCurrency,
  type IncomeCategoryReportRow,
  type IncomeReportCurrencyTotal,
} from '../../../shared/utils/aggregate-incomes-by-category';
import { AccountSelectLabel } from '../../../shared/components/account-select-label/account-select-label';
import { accountSelectOptions } from '../../../shared/utils/account-select-options';
import { categorySelectOptions } from '../../../shared/utils/category-select-options';
import { formatBalance } from '../../../shared/utils/format-balance';
import {
  formatPercentOfTotal,
  formatReportGridLine,
  formatThousandsAbs,
  reportRowTotalAmount,
  type ReportViewMode,
} from '../../../shared/utils/format-report-grid';
import { formatDate, parseIsoDate, toIsoDateString } from '../../../shared/utils/format-date';
import { toErrorMessage } from '../../../shared/utils/to-error-message';

interface SelectedCategory {
  id: string;
  name: string;
}

@Component({
  selector: 'app-incomes-by-category-report',
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
  templateUrl: './incomes-by-category.html',
  styleUrl: './incomes-by-category.scss',
})
export class IncomesByCategoryReport implements OnInit {
  private readonly incomesService = inject(IncomesService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  protected readonly auth = inject(AuthService);
  protected readonly formatBalance = formatBalance;
  protected readonly formatDate = formatDate;
  protected readonly formatPercentOfTotal = formatPercentOfTotal;
  protected readonly formatReportGridLine = formatReportGridLine;
  protected readonly formatThousandsAbs = formatThousandsAbs;
  protected readonly reportRowTotalAmount = reportRowTotalAmount;

  protected readonly accounts = signal<Account[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly rows = signal<IncomeCategoryReportRow[]>([]);
  protected readonly grandTotals = signal<IncomeReportCurrencyTotal[]>([]);
  protected readonly categoryIncomes = signal<IncomeWithDetails[]>([]);
  protected readonly incomeCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly selectedCategory = signal<SelectedCategory | null>(null);

  protected readonly reportView = signal<ReportViewMode>('list');
  protected readonly filtersExpanded = signal(false);
  protected readonly filterCategoryId = signal<string | null>(null);
  protected readonly filterDateFrom = signal<Date | null>(null);
  protected readonly filterDateTo = signal<Date | null>(null);

  protected readonly dialogTitle = computed(() =>
    this.editingId() ? 'Edit income' : 'Create income',
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
    name: ['Income', [Validators.required, Validators.maxLength(80)]],
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

  protected toggleFilters(): void {
    this.filtersExpanded.update((expanded) => !expanded);
  }

  protected async applyFilters(): Promise<void> {
    await this.runReport();
    if (this.selectedCategory()) {
      await this.loadCategoryIncomes();
    }
  }

  protected async clearFilters(): Promise<void> {
    this.filterCategoryId.set(null);
    this.filterDateFrom.set(null);
    this.filterDateTo.set(null);
    this.closeCategoryDetail();
    await this.runReport();
  }

  protected grandTotalForCurrency(currency: string): number {
    return this.grandTotals().find((total) => total.currency === currency)?.amount ?? 0;
  }

  protected openCategory(row: IncomeCategoryReportRow): void {
    this.selectedCategory.set({ id: row.categoryId, name: row.categoryName });
    void this.loadCategoryIncomes();
  }

  protected closeCategoryDetail(): void {
    this.selectedCategory.set(null);
    this.categoryIncomes.set([]);
  }

  protected openEdit(income: IncomeWithDetails): void {
    this.editingId.set(income.id);
    this.dialogErrorMessage.set(null);
    this.form.reset({
      name: income.name,
      amount: income.amount,
      date: parseIsoDate(income.date),
      categoryId: income.categoryId,
      accountId: income.accountId,
    });
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingId.set(null);
    this.dialogErrorMessage.set(null);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    const raw = this.form.getRawValue();
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

      await this.incomesService.update(id, input);
      this.closeDialog();
      await this.refreshAfterChange();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(income: IncomeWithDetails, event: Event): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: `Delete "${income.name}"? The account balance will be adjusted.`,
      header: 'Delete income',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => void this.deleteIncome(income.id),
    });
  }

  protected showError(controlName: 'name'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  private async deleteIncome(id: string): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.incomesService.remove(id);
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

    await this.loadCategoryIncomes();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.categoriesService.ensureDefaults();
      const [accounts, categories] = await Promise.all([
        this.accountsService.list(),
        this.categoriesService.list('income'),
      ]);
      this.accounts.set(accounts);
      this.categories.set(categories);
      await this.runReport();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.rows.set([]);
      this.grandTotals.set([]);
      this.incomeCount.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  private async runReport(): Promise<void> {
    this.errorMessage.set(null);

    try {
      const incomes = await this.incomesService.list(this.reportFilters());

      this.incomeCount.set(incomes.length);
      this.rows.set(aggregateIncomesByCategory(incomes, this.categories()));
      this.grandTotals.set(sumIncomesByCurrency(incomes));
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.rows.set([]);
      this.grandTotals.set([]);
      this.incomeCount.set(0);
    }
  }

  private async loadCategoryIncomes(): Promise<void> {
    const selected = this.selectedCategory();
    if (!selected) {
      return;
    }

    this.detailLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.categoryIncomes.set(
        await this.incomesService.list({
          ...this.reportFilters(),
          categoryId: selected.id,
        }),
      );
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.categoryIncomes.set([]);
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

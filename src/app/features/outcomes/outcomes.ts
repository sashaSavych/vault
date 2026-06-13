import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
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

import { AccountsService } from '../../core/accounts/accounts.service';
import { AuthService } from '../../core/auth/auth.service';
import { CategoryMappingsService } from '../../core/categories/category-mappings.service';
import { CategoryMatchService } from '../../core/categories/category-match.service';
import { CategoriesService } from '../../core/categories/categories.service';
import type { Account } from '../../core/models/account';
import type { Category } from '../../core/models/category';
import {
  OUTCOME_NAME_MAX_LENGTH,
  type OutcomeWithDetails,
} from '../../core/models/outcome';
import { OutcomesService } from '../../core/outcomes/outcomes.service';
import {
  buildOutcomeImports,
  gridToStatementText,
  isImportSavable,
  parseStatementGrid,
  toOutcomeInput,
} from '../../shared/utils/parse-statement';
import { AccountSelectLabel } from '../../shared/components/account-select-label/account-select-label';
import {
  accountFilterOptions,
  accountSelectOptions,
} from '../../shared/utils/account-select-options';
import {
  categoryFilterOptions,
  categorySelectOptions,
} from '../../shared/utils/category-select-options';
import {
  insufficientBalanceWarning,
  proceedOrConfirmInsufficientBalance,
} from '../../shared/utils/confirm-insufficient-balance';
import { formatBalance } from '../../shared/utils/format-balance';
import { formatDate, parseIsoDate, toIsoDateString } from '../../shared/utils/format-date';
import { toErrorMessage } from '../../shared/utils/to-error-message';

@Component({
  selector: 'app-outcomes',
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    InputNumber,
    Select,
    DatePicker,
    ConfirmDialog,
    Message,
    AccountSelectLabel,
  ],
  templateUrl: './outcomes.html',
  styleUrl: './outcomes.scss',
})
export class Outcomes implements OnInit {
  private readonly outcomesService = inject(OutcomesService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly categoryMappingsService = inject(CategoryMappingsService);
  private readonly categoryMatch = inject(CategoryMatchService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  private readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');

  protected readonly auth = inject(AuthService);
  protected readonly formatBalance = formatBalance;
  protected readonly formatDate = formatDate;
  protected readonly outcomeNameMaxLength = OUTCOME_NAME_MAX_LENGTH;

  protected readonly accounts = signal<Account[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly outcomes = signal<OutcomeWithDetails[]>([]);
  protected readonly loading = signal(true);
  protected readonly importing = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingOutcome = signal<OutcomeWithDetails | null>(null);

  protected readonly dialogTitle = computed(() =>
    this.editingId() ? 'Edit outcome' : 'Create outcome',
  );

  protected readonly filtersExpanded = signal(false);
  protected readonly filterAccountId = signal<string | null>(null);
  protected readonly filterCategoryId = signal<string | null>(null);
  protected readonly filterDateFrom = signal<Date | null>(null);
  protected readonly filterDateTo = signal<Date | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['Outcome', [Validators.required, Validators.maxLength(OUTCOME_NAME_MAX_LENGTH)]],
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date(), Validators.required],
    categoryId: ['', Validators.required],
    accountId: ['', Validators.required],
  });

  protected readonly accountOptions = computed(() => accountFilterOptions(this.accounts()));

  protected readonly categoryFilterSelectOptions = computed(() =>
    categoryFilterOptions(this.categories()),
  );

  protected readonly categoryOptions = computed(() =>
    categorySelectOptions(this.categories()),
  );

  protected readonly formAccountOptions = computed(() => accountSelectOptions(this.accounts()));

  ngOnInit(): void {
    void this.reload();
  }

  protected accountBalance(accountId: string): string | null {
    const account = this.accounts().find((a) => a.id === accountId);
    if (!account) {
      return null;
    }
    return formatBalance(account.balance, account.currency);
  }

  protected openCreate(): void {
    const accs = this.accounts();
    const cats = this.categories();

    if (accs.length === 0) {
      this.errorMessage.set('Create at least one account before recording outcomes.');
      return;
    }

    if (cats.length === 0) {
      this.errorMessage.set('Add at least one outcome category first.');
      return;
    }

    const defaultAccount = accs.find((a) => a.isDefault) ?? accs[0];

    this.editingId.set(null);
    this.editingOutcome.set(null);
    this.errorMessage.set(null);
    this.dialogErrorMessage.set(null);
    this.form.reset({
      name: 'Outcome',
      amount: 0,
      date: new Date(),
      categoryId: cats[0].id,
      accountId: defaultAccount.id,
    });
    this.dialogVisible.set(true);
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

  protected openImportPicker(): void {
    if (this.accounts().length === 0) {
      this.errorMessage.set('Create at least one account before importing.');
      return;
    }

    if (this.categories().length === 0) {
      this.errorMessage.set('Add at least one outcome category first.');
      return;
    }

    this.errorMessage.set(null);
    this.importInput()?.nativeElement.click();
  }

  protected onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    void this.importFromFile(file);
  }

  private async importFromFile(file: File): Promise<void> {
    this.importing.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const { readStatementXlsx } = await import('../../shared/utils/read-xlsx');
      const grid = await readStatementXlsx(file);
      const rows = parseStatementGrid(grid);
      const statementText = gridToStatementText(grid);

      const match = await this.categoryMatch.matchFromStatement(statementText);
      const categoryMapping = match.mapping;

      if (Object.keys(categoryMapping).length === 0) {
        throw new Error(
          'Category matching returned no results. Check outcome categories and Gemini configuration.',
        );
      }

      console.log('Category match:', {
        model: match.model,
        fromDb: match.fromDb,
        fromExact: match.fromExact,
        fromAi: match.fromAi,
      });

      const storedMappings = await this.categoryMappingsService.listByBankCategory();

      const items = buildOutcomeImports(
        rows,
        this.accounts(),
        this.categories(),
        categoryMapping,
        storedMappings,
      );

      const savable = items.filter(isImportSavable);
      const skipped = items.length - savable.length;

      if (savable.length === 0) {
        throw new Error(
          skipped > 0
            ? `No rows could be imported (${skipped} skipped). Check console for details.`
            : 'No debit rows found in the file.',
        );
      }

      const saved = await this.outcomesService.createMany(savable.map(toOutcomeInput));

      console.group('Outcome import');
      console.log('Source:', file.name);
      console.log('Category mapping source:', 'edge-function');
      console.log('Debit rows parsed:', rows.length);
      console.log('Saved to DB:', saved);
      console.log('Skipped:', skipped);
      console.table(
        items.map((item) => ({
          name: item.name,
          date: item.date,
          amount: item.amount,
          card: item.cardLast4 ?? '',
          accountId: item.accountCardId ?? '',
          account: item.accountFallback
            ? `${item.accountName} (fallback)`
            : (item.accountName ?? ''),
          bankCategory: item.bankCategory,
          category: item.categoryName ?? item.categoryId,
          categoryBy: item.categoryMatchedBy ?? '',
          saved: isImportSavable(item) ? 'yes' : 'no',
          error: item.error ?? '',
        })),
      );
      console.groupEnd();

      await this.reload();

      const summary =
        skipped > 0
          ? `Imported ${saved} outcome${saved === 1 ? '' : 's'}. ${skipped} row${skipped === 1 ? '' : 's'} skipped.`
          : `Imported ${saved} outcome${saved === 1 ? '' : 's'}.`;
      this.successMessage.set(summary);
    } catch (error) {
      console.error('Import failed:', error);
      this.errorMessage.set(toErrorMessage(error));
    } finally {
      this.importing.set(false);
    }
  }

  protected toggleFilters(): void {
    this.filtersExpanded.update((expanded) => !expanded);
  }

  protected async applyFilters(): Promise<void> {
    await this.reloadOutcomes();
  }

  protected async clearFilters(): Promise<void> {
    this.filterAccountId.set(null);
    this.filterCategoryId.set(null);
    this.filterDateFrom.set(null);
    this.filterDateTo.set(null);
    await this.reloadOutcomes();
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

    if (!account) {
      return null;
    }

    const available =
      editing && raw.accountId === editing.accountId
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
      if (id) {
        await this.outcomesService.update(id, input);
      } else {
        await this.outcomesService.create(input);
      }

      this.closeDialog();
      await this.reload();
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
      await this.reload();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.categoriesService.ensureDefaults();
      const accounts = await this.accountsService.list();
      const categories = await this.categoriesService.list('outcome');

      this.accounts.set(accounts);
      this.categories.set(categories);

      await this.reloadOutcomes();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.outcomes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadOutcomes(): Promise<void> {
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();

    this.outcomes.set(
      await this.outcomesService.list({
        accountId: this.filterAccountId() ?? undefined,
        categoryId: this.filterCategoryId() ?? undefined,
        dateFrom: dateFrom ? toIsoDateString(dateFrom) : undefined,
        dateTo: dateTo ? toIsoDateString(dateTo) : undefined,
      }),
    );
  }
}

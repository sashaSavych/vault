import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';

import { AccountsService } from '../../core/accounts/accounts.service';
import { CategoryMappingsService } from '../../core/categories/category-mappings.service';
import { CategoryMatchService } from '../../core/categories/category-match.service';
import { CategoriesService } from '../../core/categories/categories.service';
import type { Account } from '../../core/models/account';
import type { Category } from '../../core/models/category';
import {
  OUTCOME_NAME_MAX_LENGTH,
  type OutcomeInput,
  type OutcomeWithDetails,
} from '../../core/models/outcome';
import { OutcomesService } from '../../core/outcomes/outcomes.service';
import { TransfersService } from '../../core/transfers/transfers.service';
import {
  buildOutcomeImports,
  dedupeOutcomeImports,
  gridToStatementText,
  isImportSavable,
  outcomeImportFingerprint,
  parseStatementGrid,
  toOutcomeInput,
  type OutcomeImportItem,
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
import {
  createPendingOutcomeId,
  isPendingOutcomeId,
  toOutcomeWithDetails,
} from '../../shared/utils/outcome-with-details';
import { categorySelfAndDescendantIds } from '../../shared/utils/category-tree';
import { toErrorMessage } from '../../shared/utils/to-error-message';

interface PendingCreate {
  tempId: string;
  input: OutcomeInput;
}

interface OutcomeImportReviewRow {
  key: string;
  selected: boolean;
  item: OutcomeImportItem;
}

interface OutcomeImportMeta {
  fileName: string;
  parsedRowCount: number;
  skippedCount: number;
  duplicateCount: number;
  allItems: OutcomeImportItem[];
}

@Component({
  selector: 'app-outcomes',
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    Button,
    Checkbox,
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
  private readonly transfersService = inject(TransfersService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly categoryMappingsService = inject(CategoryMappingsService);
  private readonly categoryMatch = inject(CategoryMatchService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  private readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');
  private leaveResolver: ((allowed: boolean) => void) | null = null;
  private transferFormSyncing = false;

  protected readonly formatBalance = formatBalance;
  protected readonly formatDate = formatDate;
  protected readonly outcomeNameMaxLength = OUTCOME_NAME_MAX_LENGTH;

  protected readonly accounts = signal<Account[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly serverOutcomes = signal<OutcomeWithDetails[]>([]);
  protected readonly pendingCreates = signal<PendingCreate[]>([]);
  protected readonly pendingUpdates = signal<Map<string, OutcomeInput>>(new Map());
  protected readonly pendingDeletes = signal<Set<string>>(new Set());
  protected readonly outcomes = computed(() => this.buildDisplayedOutcomes());
  protected readonly loading = signal(true);
  protected readonly importing = signal(false);
  protected readonly importConfirming = signal(false);
  protected readonly saving = signal(false);
  protected readonly syncing = signal(false);
  protected readonly convertDialogVisible = signal(false);
  protected readonly convertDialogError = signal<string | null>(null);
  protected readonly convertSaving = signal(false);
  protected readonly convertingOutcome = signal<OutcomeWithDetails | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly importDialogVisible = signal(false);
  protected readonly importDialogError = signal<string | null>(null);
  protected readonly importReviewRows = signal<OutcomeImportReviewRow[]>([]);
  protected readonly importMeta = signal<OutcomeImportMeta | null>(null);
  protected readonly leaveDialogVisible = signal(false);
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

  protected readonly transferForm = this.fb.nonNullable.group({
    name: ['Transfer', [Validators.required, Validators.maxLength(80)]],
    fromAccountId: ['', Validators.required],
    toAccountId: ['', Validators.required],
    amountFrom: [0, [Validators.required, Validators.min(1)]],
    amountTo: [0, [Validators.required, Validators.min(1)]],
    exchangeRate: [1, [Validators.required, Validators.min(0.00000001)]],
    date: [new Date(), Validators.required],
  });

  protected readonly accountOptions = computed(() => accountFilterOptions(this.accounts()));

  protected readonly categoryFilterSelectOptions = computed(() =>
    categoryFilterOptions(this.categories()),
  );

  protected readonly categoryOptions = computed(() =>
    categorySelectOptions(this.categories()),
  );

  protected readonly formAccountOptions = computed(() => accountSelectOptions(this.accounts()));

  protected readonly transferAccountOptions = computed(() => accountSelectOptions(this.accounts()));

  protected readonly selectedImportCount = computed(
    () => this.importReviewRows().filter((row) => row.selected).length,
  );

  protected readonly allImportSelected = computed(() => {
    const rows = this.importReviewRows();
    return rows.length > 0 && rows.every((row) => row.selected);
  });

  protected readonly hasPendingChanges = computed(
    () =>
      this.pendingCreates().length > 0 ||
      this.pendingUpdates().size > 0 ||
      this.pendingDeletes().size > 0,
  );

  protected readonly pendingChangeCount = computed(
    () =>
      this.pendingCreates().length + this.pendingUpdates().size + this.pendingDeletes().size,
  );

  ngOnInit(): void {
    void this.reload();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.hasPendingChanges()) {
      return true;
    }

    return this.promptLeaveConfirmation();
  }

  protected stayOnPage(): void {
    this.finishLeaveConfirmation(false);
  }

  protected leavePage(): void {
    this.finishLeaveConfirmation(true);
  }

  protected onLeaveDialogHide(): void {
    if (this.leaveResolver) {
      this.finishLeaveConfirmation(false);
    }
  }

  protected isPending(outcomeId: string): boolean {
    return isPendingOutcomeId(outcomeId);
  }

  protected accountBalance(accountId: string): string | null {
    const account = this.accounts().find((a) => a.id === accountId);
    if (!account) {
      return null;
    }
    return formatBalance(account.balance, account.currency);
  }

  protected importAccountCurrency(accountId: string): string {
    return this.accounts().find((account) => account.id === accountId)?.currency ?? '';
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

  protected openConvertToTransfer(outcome: OutcomeWithDetails): void {
    const accs = this.accounts();
    if (accs.length < 2) {
      this.errorMessage.set('Create at least two accounts before converting to a transfer.');
      return;
    }

    const toAccount = accs.find((account) => account.id !== outcome.accountId);
    if (!toAccount) {
      this.errorMessage.set('Choose a different destination account for the transfer.');
      return;
    }

    this.convertingOutcome.set(outcome);
    this.convertDialogError.set(null);
    this.transferForm.reset({
      name: outcome.name,
      fromAccountId: outcome.accountId,
      toAccountId: toAccount.id,
      amountFrom: outcome.amount,
      amountTo: outcome.amount,
      exchangeRate: 1,
      date: parseIsoDate(outcome.date),
    });
    this.onTransferAccountsChange();
    this.convertDialogVisible.set(true);
  }

  protected closeConvertDialog(): void {
    this.convertDialogVisible.set(false);
    this.convertingOutcome.set(null);
    this.convertDialogError.set(null);
  }

  protected isTransferCrossCurrency(): boolean {
    const raw = this.transferForm.getRawValue();
    const from = this.accounts().find((account) => account.id === raw.fromAccountId);
    const to = this.accounts().find((account) => account.id === raw.toAccountId);
    return !!from && !!to && from.currency !== to.currency;
  }

  protected transferAccountBalance(accountId: string): string | null {
    const account = this.accounts().find((item) => item.id === accountId);
    if (!account) {
      return null;
    }
    return formatBalance(account.balance, account.currency);
  }

  protected onTransferAccountsChange(): void {
    if (this.isTransferCrossCurrency()) {
      this.syncTransferFromAmount();
    } else {
      this.syncTransferSameCurrency();
    }
  }

  protected onTransferAmountFromChange(): void {
    if (this.isTransferCrossCurrency()) {
      this.syncTransferFromAmount();
    } else {
      this.syncTransferSameCurrency();
    }
  }

  protected onTransferExchangeRateChange(): void {
    this.syncTransferFromAmount();
  }

  protected onTransferAmountToChange(): void {
    if (!this.isTransferCrossCurrency()) {
      return;
    }

    const { amountFrom, amountTo } = this.transferForm.getRawValue();
    if (amountFrom <= 0) {
      return;
    }

    this.patchTransferForm({ exchangeRate: roundTransferRate(amountTo / amountFrom) });
  }

  protected async confirmConvertToTransfer(): Promise<void> {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }

    const raw = this.transferForm.getRawValue();
    if (raw.fromAccountId === raw.toAccountId) {
      this.convertDialogError.set('Choose different source and destination accounts.');
      return;
    }

    await proceedOrConfirmInsufficientBalance(
      this.confirmation,
      this.convertInsufficientBalanceWarning(),
      () => this.performConvertToTransfer(),
    );
  }

  protected showTransferError(controlName: 'name'): boolean {
    const control = this.transferForm.controls[controlName];
    return control.invalid && control.touched;
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

  private promptLeaveConfirmation(): Promise<boolean> {
    this.leaveDialogVisible.set(true);

    return new Promise((resolve) => {
      this.leaveResolver = resolve;
    });
  }

  private finishLeaveConfirmation(allowed: boolean): void {
    const resolver = this.leaveResolver;
    if (!resolver) {
      return;
    }

    this.leaveResolver = null;
    this.leaveDialogVisible.set(false);
    resolver(allowed);
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

      const dates = savable.map((item) => item.date);
      const dateFrom = dates.reduce((min, date) => (date < min ? date : min));
      const dateTo = dates.reduce((max, date) => (date > max ? date : max));
      const existing = await this.outcomesService.list({ dateFrom, dateTo });
      const { unique: toSave, duplicateCount } = dedupeOutcomeImports(savable, existing);

      if (toSave.length === 0) {
        console.group('Outcome import');
        console.log('Source:', file.name);
        console.log('Debit rows parsed:', rows.length);
        console.log('Duplicates skipped:', duplicateCount);
        console.log('Validation skipped:', skipped);
        console.groupEnd();

        const summary =
          duplicateCount > 0
            ? `No new outcomes. ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} skipped.`
            : 'No new outcomes to import.';
        this.successMessage.set(summary);
        return;
      }

      this.importMeta.set({
        fileName: file.name,
        parsedRowCount: rows.length,
        skippedCount: skipped,
        duplicateCount,
        allItems: items,
      });
      this.importReviewRows.set(
        toSave.map((item) => ({
          key: outcomeImportFingerprint(item),
          selected: true,
          item,
        })),
      );
      this.importDialogError.set(null);
      this.importDialogVisible.set(true);
    } catch (error) {
      console.error('Import failed:', error);
      this.errorMessage.set(toErrorMessage(error));
    } finally {
      this.importing.set(false);
    }
  }

  protected closeImportDialog(): void {
    this.importDialogVisible.set(false);
    this.importReviewRows.set([]);
    this.importMeta.set(null);
    this.importDialogError.set(null);
  }

  protected setImportRowSelected(key: string, selected: boolean): void {
    this.importReviewRows.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, selected } : row)),
    );
  }

  protected setAllImportSelected(selected: boolean): void {
    this.importReviewRows.update((rows) => rows.map((row) => ({ ...row, selected })));
  }

  protected async confirmImport(): Promise<void> {
    const selected = this.importReviewRows()
      .filter((row) => row.selected)
      .map((row) => row.item);

    if (selected.length === 0) {
      this.importDialogError.set('Select at least one outcome to import.');
      return;
    }

    this.importConfirming.set(true);
    this.importDialogError.set(null);

    try {
      const dates = selected.map((item) => item.date);
      const dateFrom = dates.reduce((min, date) => (date < min ? date : min));
      const dateTo = dates.reduce((max, date) => (date > max ? date : max));
      const existing = await this.outcomesService.list({ dateFrom, dateTo });
      const existingInputs: OutcomeInput[] = [
        ...existing.map((outcome) => ({
          name: outcome.name,
          accountId: outcome.accountId,
          categoryId: outcome.categoryId,
          amount: outcome.amount,
          date: outcome.date,
        })),
        ...this.pendingCreates().map((pending) => pending.input),
      ];
      const { unique: toStage, duplicateCount: duplicatePending } = dedupeOutcomeImports(
        selected,
        existingInputs,
      );

      if (toStage.length === 0) {
        this.importDialogError.set('All selected rows are already pending or in the database.');
        return;
      }

      const meta = this.importMeta();
      const unchecked = this.importReviewRows().length - selected.length;

      this.pendingCreates.update((pending) => [
        ...pending,
        ...toStage.map((item) => ({
          tempId: createPendingOutcomeId(),
          input: toOutcomeInput(item),
        })),
      ]);

      if (meta) {
        const stagedFingerprints = new Set(toStage.map(outcomeImportFingerprint));
        console.group('Outcome import (pending)');
        console.log('Source:', meta.fileName);
        console.log('Staged locally:', toStage.length);
        console.log('Duplicates skipped:', meta.duplicateCount + duplicatePending);
        console.log('Validation skipped:', meta.skippedCount);
        console.log('Not imported (unchecked):', unchecked);
        console.table(
          meta.allItems.map((item) => ({
            name: item.name,
            date: item.date,
            amount: item.amount,
            staged: stagedFingerprints.has(outcomeImportFingerprint(item)) ? 'yes' : 'no',
            error: item.error ?? '',
          })),
        );
        console.groupEnd();
      }

      this.closeImportDialog();

      const summaryParts: string[] = [
        `Added ${toStage.length} outcome${toStage.length === 1 ? '' : 's'} (unsynced).`,
      ];
      if (meta && meta.duplicateCount + duplicatePending > 0) {
        const dupTotal = meta.duplicateCount + duplicatePending;
        summaryParts.push(`${dupTotal} duplicate${dupTotal === 1 ? '' : 's'} skipped.`);
      }
      if (meta && meta.skippedCount > 0) {
        summaryParts.push(`${meta.skippedCount} row${meta.skippedCount === 1 ? '' : 's'} skipped.`);
      }
      if (unchecked > 0) {
        summaryParts.push(`${unchecked} not added (unchecked).`);
      }
      this.successMessage.set(summaryParts.join(' '));
    } catch (error) {
      this.importDialogError.set(toErrorMessage(error));
    } finally {
      this.importConfirming.set(false);
    }
  }

  protected async syncPendingChanges(): Promise<void> {
    if (!this.hasPendingChanges()) {
      return;
    }

    await proceedOrConfirmInsufficientBalance(
      this.confirmation,
      this.syncInsufficientBalanceWarning(),
      () => this.performSync(),
    );
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

    let available = this.projectedAccountBalance(account.id);

    if (editing && editing.accountId === raw.accountId) {
      if (isPendingOutcomeId(editing.id)) {
        available += editing.amount;
      } else {
        const original = this.serverOutcomes().find((item) => item.id === editing.id);
        if (original) {
          available += original.amount;
        }
      }
    } else if (editing && editing.accountId !== raw.accountId) {
      available = this.projectedAccountBalance(raw.accountId);
    }

    return insufficientBalanceWarning(available, raw.amount, account.currency);
  }

  private applyFormToPending(): void {
    const raw = this.form.getRawValue();
    const input: OutcomeInput = {
      name: raw.name,
      accountId: raw.accountId,
      categoryId: raw.categoryId,
      amount: raw.amount,
      date: toIsoDateString(raw.date),
    };

    const id = this.editingId();
    if (id && isPendingOutcomeId(id)) {
      this.pendingCreates.update((pending) =>
        pending.map((item) => (item.tempId === id ? { ...item, input } : item)),
      );
    } else if (id) {
      this.pendingUpdates.update((updates) => {
        const next = new Map(updates);
        next.set(id, input);
        return next;
      });
    } else {
      this.pendingCreates.update((pending) => [
        ...pending,
        { tempId: createPendingOutcomeId(), input },
      ]);
    }

    this.closeDialog();
    this.successMessage.set(null);
  }

  private async performConvertToTransfer(): Promise<void> {
    const outcome = this.convertingOutcome();
    if (!outcome) {
      return;
    }

    const raw = this.transferForm.getRawValue();

    this.convertSaving.set(true);
    this.convertDialogError.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.transfersService.create({
        name: raw.name,
        fromAccountId: raw.fromAccountId,
        toAccountId: raw.toAccountId,
        amountFrom: raw.amountFrom,
        amountTo: raw.amountTo,
        exchangeRate: this.isTransferCrossCurrency() ? raw.exchangeRate : 1,
        date: toIsoDateString(raw.date),
      });

      await this.removeOutcomeAfterConvert(outcome.id);

      this.accounts.set(await this.accountsService.list());
      this.closeConvertDialog();
      this.successMessage.set('Converted to transfer.');
    } catch (error) {
      this.convertDialogError.set(toErrorMessage(error));
    } finally {
      this.convertSaving.set(false);
    }
  }

  private convertInsufficientBalanceWarning(): string | null {
    const raw = this.transferForm.getRawValue();
    const outcome = this.convertingOutcome();
    const from = this.accounts().find((account) => account.id === raw.fromAccountId);

    if (!from || !outcome) {
      return null;
    }

    let available = this.projectedAccountBalance(raw.fromAccountId);
    if (outcome.accountId === raw.fromAccountId) {
      available += outcome.amount;
    }

    return insufficientBalanceWarning(available, raw.amountFrom, from.currency);
  }

  private async removeOutcomeAfterConvert(outcomeId: string): Promise<void> {
    if (isPendingOutcomeId(outcomeId)) {
      this.pendingCreates.update((pending) => pending.filter((item) => item.tempId !== outcomeId));
      return;
    }

    this.pendingDeletes.update((deleted) => {
      const next = new Set(deleted);
      next.delete(outcomeId);
      return next;
    });
    this.pendingUpdates.update((updates) => {
      if (!updates.has(outcomeId)) {
        return updates;
      }
      const next = new Map(updates);
      next.delete(outcomeId);
      return next;
    });

    await this.outcomesService.remove(outcomeId);
    await this.reloadOutcomes();
  }

  private syncTransferSameCurrency(): void {
    const amount = this.transferForm.getRawValue().amountFrom;
    this.patchTransferForm({ amountTo: amount, exchangeRate: 1 });
  }

  private syncTransferFromAmount(): void {
    const { amountFrom, exchangeRate } = this.transferForm.getRawValue();
    this.patchTransferForm({ amountTo: roundTransferMoney(amountFrom * exchangeRate) });
  }

  private patchTransferForm(value: Partial<typeof this.transferForm.value>): void {
    if (this.transferFormSyncing) {
      return;
    }

    this.transferFormSyncing = true;
    this.transferForm.patchValue(value, { emitEvent: false });
    this.transferFormSyncing = false;
  }

  private async performSync(): Promise<void> {
    this.syncing.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const deletes = [...this.pendingDeletes()];
    const updates = [...this.pendingUpdates()];
    const creates = this.pendingCreates().map((pending) => pending.input);

    try {
      for (const id of deletes) {
        await this.outcomesService.remove(id);
      }

      for (const [id, input] of updates) {
        await this.outcomesService.update(id, input);
      }

      if (creates.length > 0) {
        await this.outcomesService.createMany(creates);
      }

      this.clearPendingChanges();
      await this.reload();
      this.successMessage.set('All changes synced.');
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      await this.reloadOutcomes();
    } finally {
      this.syncing.set(false);
    }
  }

  private async performSave(): Promise<void> {
    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    try {
      this.applyFormToPending();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(outcome: OutcomeWithDetails, event: Event): void {
    const pending = this.isPending(outcome.id);
    const detail = pending
      ? ''
      : ' Balance will be restored when you sync.';

    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: pending
        ? `Remove "${outcome.name}" from unsynced changes?`
        : `Delete "${outcome.name}"?${detail}`,
      header: pending ? 'Remove outcome' : 'Delete outcome',
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

  private deleteOutcome(id: string): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (isPendingOutcomeId(id)) {
      this.pendingCreates.update((pending) => pending.filter((item) => item.tempId !== id));
      return;
    }

    this.pendingDeletes.update((deleted) => new Set(deleted).add(id));
    this.pendingUpdates.update((updates) => {
      if (!updates.has(id)) {
        return updates;
      }
      const next = new Map(updates);
      next.delete(id);
      return next;
    });
  }

  private clearPendingChanges(): void {
    this.pendingCreates.set([]);
    this.pendingUpdates.set(new Map());
    this.pendingDeletes.set(new Set());
  }

  private buildDisplayedOutcomes(): OutcomeWithDetails[] {
    const accounts = this.accounts();
    const categories = this.categories();
    const updates = this.pendingUpdates();
    const deleted = this.pendingDeletes();

    const fromServer = this.serverOutcomes()
      .filter((outcome) => !deleted.has(outcome.id))
      .map((outcome) => {
        const update = updates.get(outcome.id);
        if (!update) {
          return outcome;
        }
        return toOutcomeWithDetails(outcome.id, update, accounts, categories);
      });

    const created = this.pendingCreates().map((pending) =>
      toOutcomeWithDetails(pending.tempId, pending.input, accounts, categories),
    );

    return [...fromServer, ...created]
      .filter((outcome) => this.matchesFilters(outcome))
      .sort((left, right) => {
        const byDate = right.date.localeCompare(left.date);
        if (byDate !== 0) {
          return byDate;
        }
        return right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);
      });
  }

  private matchesFilters(outcome: OutcomeWithDetails): boolean {
    const accountId = this.filterAccountId();
    if (accountId && outcome.accountId !== accountId) {
      return false;
    }

    const categoryId = this.filterCategoryId();
    if (categoryId) {
      const allowed = categorySelfAndDescendantIds(this.categories(), categoryId);
      if (!allowed.includes(outcome.categoryId)) {
        return false;
      }
    }

    const dateFrom = this.filterDateFrom();
    if (dateFrom && outcome.date < toIsoDateString(dateFrom)) {
      return false;
    }

    const dateTo = this.filterDateTo();
    if (dateTo && outcome.date > toIsoDateString(dateTo)) {
      return false;
    }

    return true;
  }

  private projectedAccountBalance(accountId: string): number {
    const account = this.accounts().find((item) => item.id === accountId);
    if (!account) {
      return 0;
    }

    let balance = account.balance;

    for (const id of this.pendingDeletes()) {
      const outcome = this.serverOutcomes().find((item) => item.id === id);
      if (outcome?.accountId === accountId) {
        balance += outcome.amount;
      }
    }

    for (const [id, input] of this.pendingUpdates()) {
      const original = this.serverOutcomes().find((item) => item.id === id);
      if (original?.accountId === accountId) {
        balance += original.amount;
      }
      if (input.accountId === accountId) {
        balance -= input.amount;
      }
    }

    for (const pending of this.pendingCreates()) {
      if (pending.input.accountId === accountId) {
        balance -= pending.input.amount;
      }
    }

    return balance;
  }

  private syncInsufficientBalanceWarning(): string | null {
    for (const account of this.accounts()) {
      const available = this.projectedAccountBalance(account.id);
      if (available < 0) {
        return `Account "${account.name}" would have ${formatBalance(available, account.currency)} after sync.`;
      }
    }

    return null;
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.categoriesService.ensureDefaults();
      const accounts = await this.accountsService.list();
      const categories = await this.categoriesService.list('outcome');

      this.accounts.set(accounts);
      this.categories.set(categories);

      await this.reloadOutcomes();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.serverOutcomes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadOutcomes(): Promise<void> {
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();

    this.serverOutcomes.set(
      await this.outcomesService.list({
        accountId: this.filterAccountId() ?? undefined,
        categoryId: this.filterCategoryId() ?? undefined,
        dateFrom: dateFrom ? toIsoDateString(dateFrom) : undefined,
        dateTo: dateTo ? toIsoDateString(dateTo) : undefined,
      }),
    );
  }
}

function roundTransferMoney(value: number): number {
  return Math.round(value);
}

function roundTransferRate(value: number): number {
  return Math.round(value * 100000000) / 100000000;
}

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
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';

import { AccountsService } from '../../core/accounts/accounts.service';
import { AuthService } from '../../core/auth/auth.service';
import { DebtsService } from '../../core/debts/debts.service';
import type { Account } from '../../core/models/account';
import type {
  DebtOperationType,
  DebtType,
  DebtWithDetails,
} from '../../core/models/debt';
import {
  DEBT_TYPE_OPTIONS,
  debtOperationTypeLabel,
  debtTypeBadgeClass,
  debtTypeColorClass,
  debtTypeLabel,
} from '../../shared/constants/debt-types';
import { formatBalance } from '../../shared/utils/format-balance';
import { formatDate, parseIsoDate, toIsoDateString } from '../../shared/utils/format-date';
import { toErrorMessage } from '../../shared/utils/to-error-message';

@Component({
  selector: 'app-debts',
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Textarea,
    InputNumber,
    Select,
    DatePicker,
    ConfirmDialog,
    Message,
    Tag,
  ],
  templateUrl: './debts.html',
  styleUrl: './debts.scss',
})
export class Debts implements OnInit {
  private readonly debtsService = inject(DebtsService);
  private readonly accountsService = inject(AccountsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  protected readonly auth = inject(AuthService);
  protected readonly formatBalance = formatBalance;
  protected readonly formatDate = formatDate;
  protected readonly debtTypeLabel = debtTypeLabel;
  protected readonly debtTypeColorClass = debtTypeColorClass;
  protected readonly debtTypeBadgeClass = debtTypeBadgeClass;
  protected readonly debtOperationTypeLabel = debtOperationTypeLabel;
  protected readonly debtTypeOptions = DEBT_TYPE_OPTIONS;

  protected readonly accounts = signal<Account[]>([]);
  protected readonly debts = signal<DebtWithDetails[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly debtDialogVisible = signal(false);
  protected readonly operationDialogVisible = signal(false);
  protected readonly operationDebt = signal<DebtWithDetails | null>(null);
  protected readonly operationType = signal<DebtOperationType>('repay');
  protected readonly expandedDebtIds = signal<Set<string>>(new Set());

  protected readonly filterAccountId = signal<string | null>(null);
  protected readonly filterType = signal<DebtType | null>(null);
  protected readonly filterDateFrom = signal<Date | null>(null);
  protected readonly filterDateTo = signal<Date | null>(null);

  protected readonly operationDialogTitle = computed(() => {
    const debt = this.operationDebt();
    if (!debt) {
      return 'Debt operation';
    }
    return `${debtOperationTypeLabel(this.operationType())} — ${debt.name}`;
  });

  protected readonly accountOptions = computed(() => [
    { label: 'All accounts', value: null as string | null },
    ...this.accounts().map((account) => ({
      label: `${account.name} (${account.currency})`,
      value: account.id,
    })),
  ]);

  protected readonly filterTypeOptions = computed(() => [
    { label: 'All types', value: null as DebtType | null },
    ...DEBT_TYPE_OPTIONS,
  ]);

  protected readonly formAccountOptions = computed(() =>
    this.accounts().map((account) => ({
      label: `${account.name} (${account.currency})`,
      value: account.id,
    })),
  );

  protected readonly debtForm = this.fb.nonNullable.group({
    name: ['Debt', [Validators.required, Validators.maxLength(80)]],
    accountId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    type: ['borrow' as DebtType, Validators.required],
  });

  protected readonly operationForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    accountId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    notes: ['', Validators.maxLength(500)],
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

  protected isExpanded(debtId: string): boolean {
    return this.expandedDebtIds().has(debtId);
  }

  protected toggleExpanded(debtId: string): void {
    const next = new Set(this.expandedDebtIds());
    if (next.has(debtId)) {
      next.delete(debtId);
    } else {
      next.add(debtId);
    }
    this.expandedDebtIds.set(next);
  }

  protected openCreate(): void {
    const accs = this.accounts();
    if (accs.length === 0) {
      this.errorMessage.set('Create at least one account before recording debts.');
      return;
    }

    const defaultAccount = accs.find((account) => account.isDefault) ?? accs[0];

    this.dialogErrorMessage.set(null);
    this.debtForm.reset({
      name: 'Debt',
      accountId: defaultAccount.id,
      amount: 0,
      date: new Date(),
      type: 'borrow',
    });
    this.debtDialogVisible.set(true);
  }

  protected closeDebtDialog(): void {
    this.debtDialogVisible.set(false);
    this.dialogErrorMessage.set(null);
  }

  protected openOperation(debt: DebtWithDetails, type: DebtOperationType): void {
    this.operationDebt.set(debt);
    this.operationType.set(type);
    this.dialogErrorMessage.set(null);
    this.operationForm.reset({
      name: type === 'repay' ? 'Repayment' : 'Increase',
      accountId: debt.accountId,
      amount: 0,
      date: new Date(),
      notes: '',
    });
    this.operationDialogVisible.set(true);
  }

  protected closeOperationDialog(): void {
    this.operationDialogVisible.set(false);
    this.operationDebt.set(null);
    this.dialogErrorMessage.set(null);
  }

  protected async applyFilters(): Promise<void> {
    await this.reloadDebts();
  }

  protected async clearFilters(): Promise<void> {
    this.filterAccountId.set(null);
    this.filterType.set(null);
    this.filterDateFrom.set(null);
    this.filterDateTo.set(null);
    await this.reloadDebts();
  }

  protected async saveDebt(): Promise<void> {
    if (this.debtForm.invalid) {
      this.debtForm.markAllAsTouched();
      return;
    }

    const raw = this.debtForm.getRawValue();
    const account = this.accounts().find((item) => item.id === raw.accountId);

    if (raw.type === 'lend' && account && account.balance < raw.amount) {
      this.dialogErrorMessage.set('Insufficient balance in this account.');
      return;
    }

    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    try {
      await this.debtsService.create({
        name: raw.name,
        accountId: raw.accountId,
        amount: raw.amount,
        date: toIsoDateString(raw.date),
        type: raw.type,
      });
      this.closeDebtDialog();
      await this.reload();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveOperation(): Promise<void> {
    if (this.operationForm.invalid) {
      this.operationForm.markAllAsTouched();
      return;
    }

    const debt = this.operationDebt();
    if (!debt) {
      return;
    }

    const raw = this.operationForm.getRawValue();
    const type = this.operationType();

    if (type === 'repay' && raw.amount > debt.balance) {
      this.dialogErrorMessage.set('Repayment cannot exceed the outstanding balance.');
      return;
    }

    const account = this.accounts().find((item) => item.id === raw.accountId);
    const needsBalance =
      (debt.type === 'borrow' && type === 'repay') ||
      (debt.type === 'lend' && type === 'increase');

    if (account && needsBalance && account.balance < raw.amount) {
      this.dialogErrorMessage.set('Insufficient balance in this account.');
      return;
    }

    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    try {
      await this.debtsService.createOperation({
        debtId: debt.id,
        name: raw.name,
        accountId: raw.accountId,
        amount: raw.amount,
        date: toIsoDateString(raw.date),
        notes: raw.notes,
        type,
      });
      this.closeOperationDialog();
      await this.reload();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDeleteDebt(debt: DebtWithDetails, event: Event): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: `Delete "${debt.name}" and all its operations? Account balances will be adjusted.`,
      header: 'Delete debt',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => void this.deleteDebt(debt.id),
    });
  }

  protected confirmDeleteOperation(
    debt: DebtWithDetails,
    operationId: string,
    operationName: string,
    event: Event,
  ): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: `Delete "${operationName}"? The account balance will be adjusted.`,
      header: 'Delete operation',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => void this.deleteOperation(debt.id, operationId),
    });
  }

  protected showDebtError(controlName: 'name'): boolean {
    const control = this.debtForm.controls[controlName];
    return control.invalid && control.touched;
  }

  protected showOperationError(controlName: 'name'): boolean {
    const control = this.operationForm.controls[controlName];
    return control.invalid && control.touched;
  }

  private async deleteDebt(id: string): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.debtsService.remove(id);
      await this.reload();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    }
  }

  private async deleteOperation(debtId: string, operationId: string): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.debtsService.removeOperation(operationId);
      const expanded = new Set(this.expandedDebtIds());
      expanded.add(debtId);
      this.expandedDebtIds.set(expanded);
      await this.reload();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      this.accounts.set(await this.accountsService.list());
      await this.reloadDebts();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.debts.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadDebts(): Promise<void> {
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();

    this.debts.set(
      await this.debtsService.list({
        accountId: this.filterAccountId() ?? undefined,
        type: this.filterType() ?? undefined,
        dateFrom: dateFrom ? toIsoDateString(dateFrom) : undefined,
        dateTo: dateTo ? toIsoDateString(dateTo) : undefined,
      }),
    );
  }
}

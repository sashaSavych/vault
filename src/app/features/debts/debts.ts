import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { Textarea } from 'primeng/textarea';

import { AccountsService } from '../../core/accounts/accounts.service';
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
import { AccountSelectLabel } from '../../shared/components/account-select-label/account-select-label';
import { accountSelectOptions } from '../../shared/utils/account-select-options';
import {
  insufficientBalanceWarning,
  proceedOrConfirmInsufficientBalance,
} from '../../shared/utils/confirm-insufficient-balance';
import { formatBalance } from '../../shared/utils/format-balance';
import { formatDate, parseIsoDate, toIsoDateString } from '../../shared/utils/format-date';
import { toErrorMessage } from '../../shared/utils/to-error-message';

@Component({
  selector: 'app-debts',
  imports: [
    RouterLink,
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
    AccountSelectLabel,
  ],
  templateUrl: './debts.html',
  styleUrl: './debts.scss',
})
export class Debts implements OnInit {
  private readonly debtsService = inject(DebtsService);
  private readonly accountsService = inject(AccountsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

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
  protected readonly selectedDebt = signal<DebtWithDetails | null>(null);
  protected readonly operationDebt = signal<DebtWithDetails | null>(null);
  protected readonly operationType = signal<DebtOperationType>('repay');

  protected readonly operationDialogTitle = computed(() => {
    const debt = this.operationDebt();
    if (!debt) {
      return 'Debt operation';
    }
    return `${debtOperationTypeLabel(this.operationType())} — ${debt.name}`;
  });

  protected readonly formAccountOptions = computed(() => accountSelectOptions(this.accounts()));

  protected readonly debtForm = this.fb.nonNullable.group({
    name: ['Debt', [Validators.required, Validators.maxLength(80)]],
    accountId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date(), Validators.required],
    type: ['borrow' as DebtType, Validators.required],
  });

  protected readonly operationForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    accountId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
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

  protected openDebt(debt: DebtWithDetails): void {
    this.selectedDebt.set(debt);
    this.errorMessage.set(null);
  }

  protected closeDebtDetail(): void {
    this.selectedDebt.set(null);
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

  protected openOperation(type: DebtOperationType): void {
    const debt = this.selectedDebt();
    if (!debt) {
      return;
    }

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

  protected async saveDebt(): Promise<void> {
    if (this.debtForm.invalid) {
      this.debtForm.markAllAsTouched();
      return;
    }

    await proceedOrConfirmInsufficientBalance(
      this.confirmation,
      this.debtInsufficientBalanceWarning(),
      () => this.performSaveDebt(),
    );
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
    if (this.operationType() === 'repay' && raw.amount > debt.balance) {
      this.dialogErrorMessage.set('Repayment cannot exceed the outstanding balance.');
      return;
    }

    await proceedOrConfirmInsufficientBalance(
      this.confirmation,
      this.operationInsufficientBalanceWarning(),
      () => this.performSaveOperation(),
    );
  }

  private debtInsufficientBalanceWarning(): string | null {
    const raw = this.debtForm.getRawValue();

    if (raw.type !== 'lend') {
      return null;
    }

    const account = this.accounts().find((item) => item.id === raw.accountId);
    if (!account) {
      return null;
    }

    return insufficientBalanceWarning(account.balance, raw.amount, account.currency);
  }

  private operationInsufficientBalanceWarning(): string | null {
    const debt = this.operationDebt();
    if (!debt) {
      return null;
    }

    const raw = this.operationForm.getRawValue();
    const type = this.operationType();
    const needsBalance =
      (debt.type === 'borrow' && type === 'repay') ||
      (debt.type === 'lend' && type === 'increase');

    if (!needsBalance) {
      return null;
    }

    const account = this.accounts().find((item) => item.id === raw.accountId);
    if (!account) {
      return null;
    }

    return insufficientBalanceWarning(account.balance, raw.amount, account.currency);
  }

  private async performSaveDebt(): Promise<void> {
    const raw = this.debtForm.getRawValue();

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

  private async performSaveOperation(): Promise<void> {
    const debt = this.operationDebt();
    if (!debt) {
      return;
    }

    const raw = this.operationForm.getRawValue();

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
        type: this.operationType(),
      });
      this.closeOperationDialog();
      await this.refreshAfterChange();
      await this.accountsService.list().then((accounts) => this.accounts.set(accounts));
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDeleteDebt(event: Event): void {
    const debt = this.selectedDebt();
    if (!debt) {
      return;
    }

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
    operationId: string,
    operationName: string,
    event: Event,
  ): void {
    const debt = this.selectedDebt();
    if (!debt) {
      return;
    }

    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: `Delete "${operationName}"? The account balance will be adjusted.`,
      header: 'Delete operation',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => void this.deleteOperation(operationId),
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
      this.closeDebtDetail();
      await this.reload();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    }
  }

  private async deleteOperation(operationId: string): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.debtsService.removeOperation(operationId);
      await this.refreshAfterChange();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    }
  }

  private async refreshAfterChange(): Promise<void> {
    await this.reloadDebts();

    const selected = this.selectedDebt();
    if (!selected) {
      return;
    }

    const updated = this.debts().find((debt) => debt.id === selected.id);
    if (!updated) {
      this.closeDebtDetail();
      return;
    }

    this.selectedDebt.set(updated);
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
    this.debts.set(await this.debtsService.list());
  }
}

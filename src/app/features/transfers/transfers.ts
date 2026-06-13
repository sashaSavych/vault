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

import { AccountsService } from '../../core/accounts/accounts.service';
import type { Account } from '../../core/models/account';
import type { TransferWithAccounts } from '../../core/models/transfer';
import { TransfersService } from '../../core/transfers/transfers.service';
import { AccountSelectLabel } from '../../shared/components/account-select-label/account-select-label';
import { accountSelectOptions } from '../../shared/utils/account-select-options';
import {
  insufficientBalanceWarning,
  proceedOrConfirmInsufficientBalance,
} from '../../shared/utils/confirm-insufficient-balance';
import { formatBalance } from '../../shared/utils/format-balance';
import { formatDate, toIsoDateString } from '../../shared/utils/format-date';
import { toErrorMessage } from '../../shared/utils/to-error-message';

@Component({
  selector: 'app-transfers',
  imports: [
    RouterLink,
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
  templateUrl: './transfers.html',
  styleUrl: './transfers.scss',
})
export class Transfers implements OnInit {
  private readonly transfersService = inject(TransfersService);
  private readonly accountsService = inject(AccountsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  protected readonly formatBalance = formatBalance;
  protected readonly formatDate = formatDate;

  protected readonly accounts = signal<Account[]>([]);
  protected readonly transfers = signal<TransferWithAccounts[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);

  private syncing = false;

  protected readonly form = this.fb.nonNullable.group({
    name: ['Transfer', [Validators.required, Validators.maxLength(80)]],
    fromAccountId: ['', Validators.required],
    toAccountId: ['', Validators.required],
    amountFrom: [0, [Validators.required, Validators.min(1)]],
    amountTo: [0, [Validators.required, Validators.min(1)]],
    exchangeRate: [1, [Validators.required, Validators.min(0.00000001)]],
    date: [new Date(), Validators.required],
  });

  protected readonly accountOptions = computed(() => accountSelectOptions(this.accounts()));

  ngOnInit(): void {
    void this.reload();
  }

  protected isCrossCurrency(): boolean {
    const from = this.findAccount(this.form.getRawValue().fromAccountId);
    const to = this.findAccount(this.form.getRawValue().toAccountId);
    return !!from && !!to && from.currency !== to.currency;
  }

  protected accountBalance(accountId: string): string | null {
    const account = this.findAccount(accountId);
    if (!account) {
      return null;
    }
    return formatBalance(account.balance, account.currency);
  }

  protected openCreate(): void {
    const accs = this.accounts();
    if (accs.length < 2) {
      this.errorMessage.set('Create at least two accounts before transferring.');
      return;
    }

    this.errorMessage.set(null);
    this.dialogErrorMessage.set(null);
    this.form.reset({
      name: 'Transfer',
      fromAccountId: accs[0].id,
      toAccountId: accs[1].id,
      amountFrom: 0,
      amountTo: 0,
      exchangeRate: 1,
      date: new Date(),
    });
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.dialogErrorMessage.set(null);
  }

  protected onAccountsChange(): void {
    if (this.isCrossCurrency()) {
      this.syncFromAmount();
    } else {
      this.syncSameCurrency();
    }
  }

  protected onAmountFromChange(): void {
    if (this.isCrossCurrency()) {
      this.syncFromAmount();
    } else {
      this.syncSameCurrency();
    }
  }

  protected onExchangeRateChange(): void {
    this.syncFromAmount();
  }

  protected onAmountToChange(): void {
    if (!this.isCrossCurrency()) {
      return;
    }

    const { amountFrom, amountTo } = this.form.getRawValue();
    if (amountFrom <= 0) {
      return;
    }

    this.patchForm({ exchangeRate: roundRate(amountTo / amountFrom) });
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.fromAccountId === raw.toAccountId) {
      this.dialogErrorMessage.set('Choose different source and destination accounts.');
      return;
    }

    await proceedOrConfirmInsufficientBalance(
      this.confirmation,
      this.transferInsufficientBalanceWarning(),
      () => this.performSave(),
    );
  }

  private transferInsufficientBalanceWarning(): string | null {
    const raw = this.form.getRawValue();
    const from = this.findAccount(raw.fromAccountId);

    if (!from) {
      return null;
    }

    return insufficientBalanceWarning(from.balance, raw.amountFrom, from.currency);
  }

  private async performSave(): Promise<void> {
    const raw = this.form.getRawValue();

    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    try {
      await this.transfersService.create({
        name: raw.name,
        fromAccountId: raw.fromAccountId,
        toAccountId: raw.toAccountId,
        amountFrom: raw.amountFrom,
        amountTo: raw.amountTo,
        exchangeRate: this.isCrossCurrency() ? raw.exchangeRate : 1,
        date: toIsoDateString(raw.date),
      });

      this.closeDialog();
      await this.reload();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(transfer: TransferWithAccounts, event: Event): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: `Delete transfer "${transfer.name}"? Account balances will be restored.`,
      header: 'Delete transfer',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => void this.deleteTransfer(transfer.id),
    });
  }

  protected showError(controlName: 'name'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  protected transferSummary(transfer: TransferWithAccounts): string {
    return `${formatBalance(transfer.amountFrom, transfer.fromAccountCurrency)} → ${formatBalance(transfer.amountTo, transfer.toAccountCurrency)}`;
  }

  private syncSameCurrency(): void {
    const amount = this.form.getRawValue().amountFrom;
    this.patchForm({ amountTo: amount, exchangeRate: 1 });
  }

  private syncFromAmount(): void {
    const { amountFrom, exchangeRate } = this.form.getRawValue();
    this.patchForm({ amountTo: roundMoney(amountFrom * exchangeRate) });
  }

  private patchForm(value: Partial<typeof this.form.value>): void {
    if (this.syncing) {
      return;
    }
    this.syncing = true;
    this.form.patchValue(value, { emitEvent: false });
    this.syncing = false;
  }

  private findAccount(id: string): Account | undefined {
    return this.accounts().find((a) => a.id === id);
  }

  private async deleteTransfer(id: string): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.transfersService.remove(id);
      await this.reload();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const [accounts, transfers] = await Promise.all([
        this.accountsService.list(),
        this.transfersService.list(),
      ]);
      this.accounts.set(accounts);
      this.transfers.set(transfers);
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.transfers.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function roundRate(value: number): number {
  return Math.round(value * 100000000) / 100000000;
}

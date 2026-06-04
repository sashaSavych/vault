import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { AccountsService } from '../../core/accounts/accounts.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Account } from '../../core/models/account';
import { ACCOUNT_ICONS } from '../../shared/constants/account-icons';
import { CURRENCIES } from '../../shared/constants/currencies';
import { formatBalance } from '../../shared/utils/format-balance';

@Component({
  selector: 'app-accounts',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    InputNumber,
    Select,
    ToggleSwitch,
    ConfirmDialog,
    Message,
    Tag,
  ],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class Accounts implements OnInit {
  private readonly accountsService = inject(AccountsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  protected readonly auth = inject(AuthService);
  protected readonly currencies = [...CURRENCIES];
  protected readonly icons = [...ACCOUNT_ICONS];

  protected readonly accounts = signal<Account[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly editingId = signal<string | null>(null);

  protected readonly dialogTitle = computed(() =>
    this.editingId() ? 'Edit account' : 'Add account',
  );

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    currency: ['UAH', Validators.required],
    icon: ['pi-wallet', Validators.required],
    balance: [0, Validators.required],
    isDefault: [false],
  });

  protected readonly formatBalance = formatBalance;

  ngOnInit(): void {
    void this.reload();
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.errorMessage.set(null);
    this.form.reset({
      name: '',
      currency: 'UAH',
      icon: 'pi-wallet',
      balance: 0,
      isDefault: this.accounts().length === 0,
    });
    this.dialogVisible.set(true);
  }

  protected openEdit(account: Account): void {
    this.editingId.set(account.id);
    this.errorMessage.set(null);
    this.form.reset({
      name: account.name,
      currency: account.currency,
      icon: account.icon,
      balance: account.balance,
      isDefault: account.isDefault,
    });
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingId.set(null);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const input = this.form.getRawValue();
      const id = this.editingId();

      if (id) {
        await this.accountsService.update(id, input);
      } else {
        await this.accountsService.create(input);
      }

      this.closeDialog();
      await this.reload();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(account: Account, event: Event): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: `Delete "${account.name}"? This cannot be undone.`,
      header: 'Delete account',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => void this.deleteAccount(account.id),
    });
  }

  protected showError(controlName: 'name'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  private async deleteAccount(id: string): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.accountsService.remove(id);
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
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.accounts.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}

function toErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message);
  }
  return 'Something went wrong. Please try again.';
}

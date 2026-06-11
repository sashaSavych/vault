import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
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
import {
  ACCOUNT_TYPES,
  accountTypeClasses,
} from '../../shared/constants/account-types';
import { CURRENCIES } from '../../shared/constants/currencies';
import { formatBalance } from '../../shared/utils/format-balance';
import { toErrorMessage } from '../../shared/utils/to-error-message';

const DEFAULT_CARD_ID = '0000';

@Component({
  selector: 'app-accounts',
  imports: [
    RouterLink,
    DragDropModule,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    InputNumber,
    Select,
    ToggleSwitch,
    Message,
    Tag,
  ],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class Accounts implements OnInit {
  private readonly accountsService = inject(AccountsService);
  private readonly fb = inject(FormBuilder);

  protected readonly auth = inject(AuthService);
  protected readonly currencies = [...CURRENCIES];
  protected readonly types = [...ACCOUNT_TYPES];
  protected readonly accountTypeClasses = accountTypeClasses;

  protected readonly activeAccounts = signal<Account[]>([]);
  protected readonly archivedAccounts = signal<Account[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly reordering = signal(false);
  protected readonly deleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);
  protected readonly deleteDialogVisible = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly deletingAccount = signal<Account | null>(null);

  protected readonly dialogTitle = computed(() =>
    this.editingId() ? 'Edit account' : 'Add account',
  );

  protected readonly deleteDialogTitle = computed(() => {
    const account = this.deletingAccount();
    if (!account) {
      return 'Remove account';
    }
    return account.archivedAt ? 'Delete account permanently' : 'Remove account';
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    cardId: [
      DEFAULT_CARD_ID,
      [Validators.required, Validators.pattern(/^\d{4}$/)],
    ],
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
    this.dialogErrorMessage.set(null);
    this.form.reset({
      name: '',
      cardId: DEFAULT_CARD_ID,
      currency: 'UAH',
      icon: 'pi-wallet',
      balance: 0,
      isDefault: this.activeAccounts().length === 0,
    });
    this.dialogVisible.set(true);
  }

  protected openEdit(account: Account): void {
    this.editingId.set(account.id);
    this.errorMessage.set(null);
    this.dialogErrorMessage.set(null);
    this.form.reset({
      name: account.name,
      cardId: account.cardId,
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
    this.dialogErrorMessage.set(null);
  }

  protected openDeleteDialog(account: Account): void {
    this.deletingAccount.set(account);
    this.dialogErrorMessage.set(null);
    this.deleteDialogVisible.set(true);
  }

  protected closeDeleteDialog(): void {
    this.deleteDialogVisible.set(false);
    this.deletingAccount.set(null);
    this.dialogErrorMessage.set(null);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    try {
      const input = {
        name: raw.name,
        currency: raw.currency,
        icon: raw.icon,
        cardId: raw.cardId,
        balance: raw.balance,
        isDefault: raw.isDefault,
      };

      const id = this.editingId();

      if (id) {
        await this.accountsService.update(id, input);
      } else {
        await this.accountsService.create(input);
      }

      this.closeDialog();
      await this.reload();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async archiveAccount(): Promise<void> {
    const account = this.deletingAccount();
    if (!account || account.archivedAt) {
      return;
    }

    this.deleting.set(true);
    this.dialogErrorMessage.set(null);

    try {
      await this.accountsService.archive(account.id);
      this.closeDeleteDialog();
      await this.reload();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.deleting.set(false);
    }
  }

  protected async deletePermanently(): Promise<void> {
    const account = this.deletingAccount();
    if (!account) {
      return;
    }

    this.deleting.set(true);
    this.dialogErrorMessage.set(null);

    try {
      await this.accountsService.removePermanent(account.id);
      this.closeDeleteDialog();
      await this.reload();
    } catch (error) {
      this.dialogErrorMessage.set(toErrorMessage(error));
    } finally {
      this.deleting.set(false);
    }
  }

  protected async restoreAccount(account: Account): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.accountsService.restore(account.id);
      await this.reload();
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
    }
  }

  protected async dropAccount(event: CdkDragDrop<Account[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex || this.reordering()) {
      return;
    }

    const accounts = [...this.activeAccounts()];
    moveItemInArray(accounts, event.previousIndex, event.currentIndex);
    this.activeAccounts.set(accounts);

    this.reordering.set(true);
    this.errorMessage.set(null);

    try {
      await this.accountsService.reorder(accounts.map((account) => account.id));
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      await this.reload();
    } finally {
      this.reordering.set(false);
    }
  }

  protected showError(controlName: 'name' | 'cardId'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const accounts = await this.accountsService.list({ includeArchived: true });
      this.activeAccounts.set(accounts.filter((account) => !account.archivedAt));
      this.archivedAccounts.set(accounts.filter((account) => account.archivedAt));
    } catch (error) {
      this.errorMessage.set(toErrorMessage(error));
      this.activeAccounts.set([]);
      this.archivedAccounts.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}

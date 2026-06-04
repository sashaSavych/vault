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

import { AccountsService } from '../../core/accounts/accounts.service';
import { AuthService } from '../../core/auth/auth.service';
import { CategoriesService } from '../../core/categories/categories.service';
import type { Account } from '../../core/models/account';
import type { Category } from '../../core/models/category';
import type { OutcomeWithDetails } from '../../core/models/outcome';
import { OutcomesService } from '../../core/outcomes/outcomes.service';
import { categorySelectOptions } from '../../shared/utils/category-select-options';
import { formatBalance } from '../../shared/utils/format-balance';
import { formatDate, toIsoDateString } from '../../shared/utils/format-date';
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
  ],
  templateUrl: './outcomes.html',
  styleUrl: './outcomes.scss',
})
export class Outcomes implements OnInit {
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
  protected readonly outcomes = signal<OutcomeWithDetails[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dialogVisible = signal(false);

  protected readonly filterAccountId = signal<string | null>(null);
  protected readonly filterDateFrom = signal<Date | null>(null);
  protected readonly filterDateTo = signal<Date | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['Outcome', [Validators.required, Validators.maxLength(80)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    categoryId: ['', Validators.required],
    accountId: ['', Validators.required],
  });

  protected readonly accountOptions = computed(() => [
    { label: 'All accounts', value: null as string | null },
    ...this.accounts().map((a) => ({
      label: `${a.name} (${a.currency})`,
      value: a.id,
    })),
  ]);

  protected readonly categoryOptions = computed(() =>
    categorySelectOptions(this.categories()),
  );

  protected readonly formAccountOptions = computed(() =>
    this.accounts().map((a) => ({
      label: `${a.name} (${a.currency})`,
      value: a.id,
    })),
  );

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

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.dialogErrorMessage.set(null);
  }

  protected async applyFilters(): Promise<void> {
    await this.reloadOutcomes();
  }

  protected async clearFilters(): Promise<void> {
    this.filterAccountId.set(null);
    this.filterDateFrom.set(null);
    this.filterDateTo.set(null);
    await this.reloadOutcomes();
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const account = this.accounts().find((a) => a.id === raw.accountId);

    if (account && account.balance < raw.amount) {
      this.dialogErrorMessage.set('Insufficient balance in this account.');
      return;
    }

    this.saving.set(true);
    this.dialogErrorMessage.set(null);

    try {
      await this.outcomesService.create({
        name: raw.name,
        accountId: raw.accountId,
        categoryId: raw.categoryId,
        amount: raw.amount,
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
        dateFrom: dateFrom ? toIsoDateString(dateFrom) : undefined,
        dateTo: dateTo ? toIsoDateString(dateTo) : undefined,
      }),
    );
  }
}

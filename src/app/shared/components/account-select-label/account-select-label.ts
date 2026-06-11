import { Component, input } from '@angular/core';

import { accountTypeClasses } from '../../constants/account-types';

@Component({
  selector: 'app-account-select-label',
  template: `
    <div class="flex items-center gap-2">
      @if (icon()) {
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          [class]="accountTypeClasses(icon()!)"
        >
          <i [class]="'pi ' + icon()"></i>
        </span>
      }
      <span class="truncate">{{ label() }}</span>
    </div>
  `,
})
export class AccountSelectLabel {
  readonly label = input.required<string>();
  readonly icon = input<string | null>(null);

  protected readonly accountTypeClasses = accountTypeClasses;
}

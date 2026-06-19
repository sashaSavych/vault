import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { MotionOptions } from '@primeuix/motion';
import { Toast } from 'primeng/toast';

import { AuthService } from './core/auth/auth.service';
import { AppNav } from './shared/components/app-nav/app-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNav, Toast],
  template: `
    <p-toast position="top-center" [motionOptions]="toastMotionOptions" />
    <router-outlet />
    @if (auth.isAuthenticated()) {
      <app-nav />
    }
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly toastMotionOptions: MotionOptions = { disabled: true };
}

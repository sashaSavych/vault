import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth/auth.service';
import { AppNav } from './shared/components/app-nav/app-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNav],
  template: `
    <router-outlet />
    @if (auth.isAuthenticated()) {
      <app-nav />
    }
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
}

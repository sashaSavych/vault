import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitUntilReady(auth);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitUntilReady(auth);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};

function waitUntilReady(auth: AuthService): Promise<void> {
  return auth.initialize();
}

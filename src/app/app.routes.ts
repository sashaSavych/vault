import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { Accounts } from './features/accounts/accounts';
import { Home } from './features/home/home';
import { Login } from './features/auth/login/login';
import { Signup } from './features/auth/signup/signup';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    canActivate: [authGuard],
  },
  {
    path: 'accounts',
    component: Accounts,
    canActivate: [authGuard],
  },
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard],
  },
  {
    path: 'signup',
    component: Signup,
    canActivate: [guestGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

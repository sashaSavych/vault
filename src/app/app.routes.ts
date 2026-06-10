import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { Accounts } from './features/accounts/accounts';
import { Categories } from './features/categories/categories';
import { Incomes } from './features/incomes/incomes';
import { Outcomes } from './features/outcomes/outcomes';
import { OutcomesByCategoryReport } from './features/reports/outcomes-by-category/outcomes-by-category';
import { Reports } from './features/reports/reports';
import { Transfers } from './features/transfers/transfers';
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
    path: 'incomes',
    component: Incomes,
    canActivate: [authGuard],
  },
  {
    path: 'outcomes',
    component: Outcomes,
    canActivate: [authGuard],
  },
  {
    path: 'transfers',
    component: Transfers,
    canActivate: [authGuard],
  },
  {
    path: 'categories',
    component: Categories,
    canActivate: [authGuard],
  },
  {
    path: 'reports',
    component: Reports,
    canActivate: [authGuard],
  },
  {
    path: 'reports/outcomes-by-category',
    component: OutcomesByCategoryReport,
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

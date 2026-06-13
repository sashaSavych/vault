import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { Accounts } from './features/accounts/accounts';
import { Categories } from './features/categories/categories';
import { Debts } from './features/debts/debts';
import { Incomes } from './features/incomes/incomes';
import { More } from './features/more/more';
import { Outcomes } from './features/outcomes/outcomes';
import { IncomesByCategoryReport } from './features/reports/incomes-by-category/incomes-by-category';
import { OutcomesByCategoryReport } from './features/reports/outcomes-by-category/outcomes-by-category';
import { Reports } from './features/reports/reports';
import { Transfers } from './features/transfers/transfers';
import { Login } from './features/auth/login/login';
import { Signup } from './features/auth/signup/signup';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'outcomes',
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
    path: 'debts',
    component: Debts,
    canActivate: [authGuard],
  },
  {
    path: 'categories',
    component: Categories,
    canActivate: [authGuard],
  },
  {
    path: 'more',
    component: More,
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
    path: 'reports/incomes-by-category',
    component: IncomesByCategoryReport,
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
    redirectTo: 'outcomes',
  },
];



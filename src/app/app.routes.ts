import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'outcomes',
  },
  {
    path: 'accounts',
    loadComponent: () => import('./features/accounts/accounts').then((m) => m.Accounts),
    canActivate: [authGuard],
  },
  {
    path: 'incomes',
    loadComponent: () => import('./features/incomes/incomes').then((m) => m.Incomes),
    canActivate: [authGuard],
  },
  {
    path: 'outcomes',
    loadComponent: () => import('./features/outcomes/outcomes').then((m) => m.Outcomes),
    canActivate: [authGuard],
  },
  {
    path: 'transfers',
    loadComponent: () => import('./features/transfers/transfers').then((m) => m.Transfers),
    canActivate: [authGuard],
  },
  {
    path: 'debts',
    loadComponent: () => import('./features/debts/debts').then((m) => m.Debts),
    canActivate: [authGuard],
  },
  {
    path: 'categories',
    loadComponent: () => import('./features/categories/categories').then((m) => m.Categories),
    canActivate: [authGuard],
  },
  {
    path: 'more',
    loadComponent: () => import('./features/more/more').then((m) => m.More),
    canActivate: [authGuard],
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
    canActivate: [authGuard],
  },
  {
    path: 'reports/outcomes-by-category',
    loadComponent: () =>
      import('./features/reports/outcomes-by-category/outcomes-by-category').then((m) => m.OutcomesByCategoryReport),
    canActivate: [authGuard],
  },
  {
    path: 'reports/incomes-by-category',
    loadComponent: () =>
      import('./features/reports/incomes-by-category/incomes-by-category').then((m) => m.IncomesByCategoryReport),
    canActivate: [authGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/auth/signup/signup').then((m) => m.Signup),
    canActivate: [guestGuard],
  },
  {
    path: '**',
    redirectTo: 'outcomes',
  },
];



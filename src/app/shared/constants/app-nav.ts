export interface NavPage {
  path: string;
  label: string;
  icon: string;
}

export const APP_NAV_PAGES: NavPage[] = [
  { path: '/', label: 'Home', icon: 'pi-home' },
  { path: '/accounts', label: 'Accounts', icon: 'pi-wallet' },
  { path: '/categories', label: 'Categories', icon: 'pi-tags' },
  { path: '/incomes', label: 'Incomes', icon: 'pi-plus-circle' },
  { path: '/outcomes', label: 'Outcomes', icon: 'pi-minus-circle' },
  { path: '/transfers', label: 'Transfers', icon: 'pi-arrow-right-arrow-left' },
  { path: '/debts', label: 'Debts', icon: 'pi-book' },
  { path: '/reports', label: 'Reports', icon: 'pi-chart-bar' },
];

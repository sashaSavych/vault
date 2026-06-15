export interface NavPage {
  path: string;
  label: string;
  icon: string;
}

export const APP_NAV_PAGES: NavPage[] = [
  { path: '/accounts', label: 'Accounts', icon: 'pi-wallet' },
  { path: '/incomes', label: 'Incomes', icon: 'pi-plus-circle' },
  { path: '/outcomes', label: 'Outcomes', icon: 'pi-minus-circle' },
  { path: '/transfers', label: 'Transfers', icon: 'pi-arrow-right-arrow-left' },
  { path: '/more', label: 'More', icon: 'pi-ellipsis-h' },
];

export const MORE_NAV_PAGES: NavPage[] = [
  { path: '/categories', label: 'Categories', icon: 'pi-tags' },
  { path: '/debts', label: 'Debts', icon: 'pi-book' },
  { path: '/reports', label: 'Reports', icon: 'pi-chart-bar' },
];

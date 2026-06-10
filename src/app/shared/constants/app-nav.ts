export interface NavSection {
  id: string;
  label: string;
}

export interface NavPage {
  path: string;
  label: string;
  icon: string;
  sections?: NavSection[];
}

export const APP_NAV_PAGES: NavPage[] = [
  { path: '/', label: 'Home', icon: 'pi-home' },
  {
    path: '/accounts',
    label: 'Accounts',
    icon: 'pi-wallet',
    sections: [{ id: 'accounts-list', label: 'List' }],
  },
  {
    path: '/categories',
    label: 'Categories',
    icon: 'pi-tags',
    sections: [
      { id: 'income-categories', label: 'Income' },
      { id: 'outcome-categories', label: 'Outcome' },
    ],
  },
  {
    path: '/incomes',
    label: 'Incomes',
    icon: 'pi-plus-circle',
    sections: [
      { id: 'filters', label: 'Filters' },
      { id: 'income-list', label: 'List' },
    ],
  },
  {
    path: '/outcomes',
    label: 'Outcomes',
    icon: 'pi-minus-circle',
    sections: [
      { id: 'filters', label: 'Filters' },
      { id: 'outcome-list', label: 'List' },
    ],
  },
  {
    path: '/transfers',
    label: 'Transfers',
    icon: 'pi-arrow-right-arrow-left',
    sections: [{ id: 'transfer-list', label: 'List' }],
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: 'pi-chart-bar',
    sections: [{ id: 'reports-list', label: 'List' }],
  },
];

export function navPageForPath(path: string): NavPage | undefined {
  if (path === '/') {
    return APP_NAV_PAGES[0];
  }

  return [...APP_NAV_PAGES]
    .filter((page) => page.path !== '/' && path.startsWith(page.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

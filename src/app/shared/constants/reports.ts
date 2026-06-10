export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: string;
}

export const REPORTS: ReportDefinition[] = [
  {
    id: 'outcomes-by-category',
    title: 'Outcomes by category',
    description: 'Expense totals grouped by outcome category',
    route: '/reports/outcomes-by-category',
    icon: 'pi-chart-pie',
  },
];

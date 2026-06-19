export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function toIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayIsoDate(): string {
  return toIsoDateString(new Date());
}

export function startOfCurrentMonthDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function defaultFilterDateRange(): { from: Date; to: Date } {
  return {
    from: startOfCurrentMonthDate(),
    to: new Date(),
  };
}

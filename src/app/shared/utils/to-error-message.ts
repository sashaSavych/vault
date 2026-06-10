export function toErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as { message?: string; code?: string };
    if (record.code === 'PGRST116') {
      return 'Update did not apply. Re-run supabase/migrations/outcome.sql and income.sql in the Supabase SQL Editor.';
    }
    if (record.message) {
      return record.message;
    }
  }
  return 'Something went wrong. Please try again.';
}

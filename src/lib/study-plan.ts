export type PlanProgress = { done: number; total: number; percent: number };

export const MAX_ITEM_TITLE = 200;

export function planProgress(items: readonly { done: boolean }[]): PlanProgress {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** True for a real calendar date written as YYYY-MM-DD (what a date input and a `date` column use). */
export function isDueDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Trimmed title, or null when empty or over the limit. */
export function cleanItemTitle(value: unknown) {
  if (typeof value !== 'string') return null;
  const title = value.trim();
  return title.length >= 1 && title.length <= MAX_ITEM_TITLE ? title : null;
}

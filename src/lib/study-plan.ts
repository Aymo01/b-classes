export type StudyPlanItem = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
};

/** Share of items ticked off, rounded. An empty plan is 0%. */
export function planProgress(items: { done: boolean }[]) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export const isDueDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

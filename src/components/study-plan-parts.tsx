import { CalendarDays, CheckCircle2, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { planProgress } from '@/lib/study-plan';
import type { StudyPlanItemDTO } from '@/lib/study-plans.functions';

export function formatDueDate(value: string) {
  // A date-only value: read it as local so it never shifts a day.
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day).toLocaleDateString('ar', { dateStyle: 'medium' });
}

export function PlanProgressBar({ items }: { items: readonly { done: boolean }[] }) {
  const { done, total, percent } = planProgress(items);
  return (
    <div className="plan-progress">
      <div className="plan-progress-label">
        <span>{total === 0 ? 'لا توجد مهام بعد' : `${done} من ${total} مهام مكتملة`}</span>
        <strong>{percent}%</strong>
      </div>
      <Progress value={percent} aria-label="تقدّم الخطة" />
    </div>
  );
}

/** Read-only list, used where the plan belongs to someone else (the parent area). */
export function PlanItemsReadOnly({ items }: { items: StudyPlanItemDTO[] }) {
  return (
    <ul className="plan-list">
      {items.map((item) => (
        <li key={item.id} className={item.done ? 'plan-item plan-item-done' : 'plan-item'}>
          <span className="plan-item-state" aria-label={item.done ? 'مكتملة' : 'غير مكتملة'}>{item.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
          <div>
            <h3>{item.title}</h3>
            {(item.dueDate || item.lessonTitle) && (
              <p>
                {item.dueDate && <span className="plan-meta"><CalendarDays size={13} />{formatDueDate(item.dueDate)}</span>}
                {item.lessonTitle && <span className="plan-meta">الدرس: {item.lessonTitle}</span>}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

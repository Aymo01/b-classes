import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CalendarDays, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { PlanProgressBar, formatDueDate } from '@/components/study-plan-parts';
import { useGrade } from '@/components/grade-provider';
import { listLessons } from '@/lib/content.functions';
import { MAX_ITEM_TITLE } from '@/lib/study-plan';
import { addStudyPlanItem, deleteStudyPlanItem, getMyStudyPlan, toggleStudyPlanItem } from '@/lib/study-plans.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/study-plan')({
  head: () => pageMeta('خطتي الدراسية', 'نظّم مهامك الدراسية وتابع تقدّمك في B classes.'),
  component: StudyPlanPage,
});

const NO_LESSON = 'none';

function StudyPlanPage() {
  const queryClient = useQueryClient();
  const { grade } = useGrade();
  const { data: plan, isLoading, error } = useQuery({ queryKey: ['study-plan'], queryFn: () => getMyStudyPlan() });
  const { data: lessons } = useQuery({ queryKey: ['lessons', grade], queryFn: () => listLessons({ data: { grade } }) });
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lessonId, setLessonId] = useState(NO_LESSON);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['study-plan'] });
  const add = useMutation({
    mutationFn: () => addStudyPlanItem({ data: { title, dueDate: dueDate || null, lessonId: lessonId === NO_LESSON ? null : lessonId } }),
    onSuccess: () => { setTitle(''); setDueDate(''); setLessonId(NO_LESSON); void refresh(); },
  });
  const toggle = useMutation({ mutationFn: (v: { itemId: string; done: boolean }) => toggleStudyPlanItem({ data: v }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (itemId: string) => deleteStudyPlanItem({ data: { itemId } }), onSuccess: refresh });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim()) add.mutate();
  }

  const items = plan?.items ?? [];
  return (
    <StudentWorkspace title={plan?.title ?? 'خطتي الأسبوعية'} subtitle="اكتب مهامك الدراسية، وضع علامة عند إنجاز كل مهمة.">
      {isLoading ? (
        <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل خطتك...</p></div>
      ) : error || !plan ? (
        <EmptyState icon={ListChecks} title="تعذر تحميل الخطة" text="حدث خطأ غير متوقع. حاول تحديث الصفحة." />
      ) : (
        <>
          <PlanProgressBar items={items} />
          <form className="teacher-form" onSubmit={submit}>
            <h3>مهمة جديدة</h3>
            <div className="teacher-form-grid">
              <div className="auth-field"><label htmlFor="plan-title">المهمة</label><Input id="plan-title" value={title} maxLength={MAX_ITEM_TITLE} onChange={(e) => setTitle(e.target.value)} required /></div>
              <div className="auth-field"><label htmlFor="plan-due">تاريخ الاستحقاق (اختياري)</label><Input id="plan-due" type="date" dir="ltr" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
              <div className="auth-field"><label>درس مرتبط (اختياري)</label>
                <Select value={lessonId} onValueChange={setLessonId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LESSON}>بدون درس</SelectItem>
                    {(lessons ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {add.error instanceof Error && <p className="auth-error" role="alert">{add.error.message}</p>}
            <Button type="submit" disabled={add.isPending || !title.trim()}>{add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}إضافة المهمة</Button>
          </form>

          {items.length === 0 ? (
            <EmptyState icon={ListChecks} title="خطتك فارغة" text="أضف أول مهمة من النموذج أعلاه." />
          ) : (
            <ul className="plan-list">
              {items.map((item) => (
                <li key={item.id} className={item.done ? 'plan-item plan-item-done' : 'plan-item'}>
                  <Checkbox checked={item.done} onCheckedChange={(v) => toggle.mutate({ itemId: item.id, done: v === true })} aria-label={`إنجاز: ${item.title}`} />
                  <div>
                    <h3>{item.title}</h3>
                    {(item.dueDate || item.lessonTitle) && (
                      <p>
                        {item.dueDate && <span className="plan-meta"><CalendarDays size={13} />{formatDueDate(item.dueDate)}</span>}
                        {item.lessonTitle && <span className="plan-meta">الدرس: {item.lessonTitle}</span>}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`حذف ${item.title}`} onClick={() => remove.mutate(item.id)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </StudentWorkspace>
  );
}

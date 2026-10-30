import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BookOpen, CheckCircle2, ClipboardList, FileQuestion, Link2, ListChecks, Loader2, MessageSquare, Users } from 'lucide-react';
import { MessagesPanel, UnreadBadge } from '@/components/messages-panel';
import { PlanItemsReadOnly, PlanProgressBar } from '@/components/study-plan-parts';
import { getChildStudyPlan } from '@/lib/study-plans.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { getMyProfile, getStudentOverview, linkChildByCode, listMyChildren } from '@/lib/profile.functions';
import { gradeLabel, type Grade } from '@/lib/grades';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/parent')({
  head: () => pageMeta('منطقة ولي الأمر', 'تابع تقدّم أبنائك الدراسي في B classes.'),
  validateSearch: (search: Record<string, unknown>): { c?: string | undefined } => ({ c: typeof search['c'] === 'string' ? search['c'] : undefined }),
  component: ParentPage,
});

function ParentPage() {
  const queryClient = useQueryClient();
  const { c: conversationId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: me } = useQuery({ queryKey: ['my-profile'], queryFn: () => getMyProfile() });
  const { data: childrenData, isLoading } = useQuery({ queryKey: ['my-children'], queryFn: () => listMyChildren() });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);

  const isParent = (me?.roles ?? []).includes('parent');
  const children = childrenData?.children ?? [];
  const activeChild = selectedChild ?? children[0]?.id ?? null;

  const { data: overview } = useQuery({
    queryKey: ['overview', activeChild],
    queryFn: () => getStudentOverview({ data: { studentId: activeChild! } }),
    enabled: !!activeChild,
  });

  const { data: childPlan } = useQuery({
    queryKey: ['child-study-plan', activeChild],
    queryFn: () => getChildStudyPlan({ data: { studentId: activeChild! } }),
    enabled: !!activeChild,
  });

  async function handleLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await linkChildByCode({ data: { code: code.trim() } });
      setCode('');
      setLinked(true);
      await queryClient.invalidateQueries({ queryKey: ['my-children'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر ربط الحساب.');
    } finally {
      setBusy(false);
    }
  }

  if (!me || isLoading) {
    return <StudentWorkspace title="منطقة ولي الأمر" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ التحميل...</p></div></StudentWorkspace>;
  }

  return (
    <StudentWorkspace title="منطقة ولي الأمر" subtitle="تابع تقدّم أبنائك الدراسي خطوة بخطوة.">
      {!isParent && (
        <p className="quiz-hint">حسابك مسجل كطالب. إذا كنت ولي أمر، يمكنك ربط حساب طفلك برمز الدعوة الخاص به.</p>
      )}
      <form className="teacher-form" onSubmit={handleLink}>
        <h3><Link2 size={18} />ربط حساب طالب</h3>
        <p className="quiz-hint">اطلب من طفلك رمز الربط من صفحة «ملفي الشخصي»، ثم أدخله هنا.</p>
        <div className="parent-link-row">
          <Input dir="ltr" placeholder="رمز الربط" value={code} onChange={(e) => setCode(e.target.value)} required aria-label="رمز الربط" />
          <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Link2 />}ربط</Button>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {linked && <p className="auth-notice" role="status"><CheckCircle2 size={16} />تم ربط الحساب بنجاح.</p>}
      </form>

      <section aria-labelledby="parent-messages-title">
        <div className="study-section-title"><h2 id="parent-messages-title" className="messages-heading-badge">رسائل المعلمين<UnreadBadge /></h2><MessageSquare size={20} /></div>
        <MessagesPanel selectedId={conversationId} onSelect={(id) => void navigate({ search: { c: id } })} />
      </section>

      {children.length === 0 ? (
        <EmptyState icon={Users} title="لا يوجد أبناء مرتبطون بعد" text="اربط حساب طفلك برمز الدعوة لمتابعة تقدّمه." />
      ) : (
        <>
          <div className="study-filters" aria-label="اختر الطالب">
            {children.map((child) => (
              <Button key={child.id} variant={activeChild === child.id ? 'default' : 'ghost'} onClick={() => setSelectedChild(child.id)}>
                {child.displayName || 'طالب'}{child.grade ? ` · ${gradeLabel(child.grade as Grade)}` : ''}
              </Button>
            ))}
          </div>
          <section aria-labelledby="child-plan-title">
            <div className="study-section-title"><h2 id="child-plan-title">{childPlan?.title ?? 'خطة الدراسة'}</h2><ListChecks size={20} /></div>
            {childPlan && childPlan.items.length > 0 ? (
              <>
                <PlanProgressBar items={childPlan.items} />
                <PlanItemsReadOnly items={childPlan.items} />
              </>
            ) : (
              <EmptyState icon={ListChecks} title="لا توجد خطة بعد" text="لم يضف طفلك مهام إلى خطته الدراسية بعد." />
            )}
          </section>
          {overview ? (
            <>
              <div className="study-metrics">
                <div className="study-metric"><span><BookOpen /></span><p>الدروس المكتملة</p><strong>{overview.lessonsCompleted} / {overview.lessonsTotal}</strong><small>من دروس الصف</small></div>
                <div className="study-metric"><span><ClipboardList /></span><p>الواجبات المسلّمة</p><strong>{overview.assignmentsSubmitted}</strong><small>{overview.assignmentsAverage != null ? `متوسط الدرجات ${overview.assignmentsAverage}` : 'لا توجد درجات بعد'}</small></div>
                <div className="study-metric"><span><FileQuestion /></span><p>متوسط الاختبارات</p><strong>{overview.quizzesAverage != null ? `${overview.quizzesAverage}%` : '—'}</strong><small>{overview.quizzesTaken > 0 ? `${overview.quizzesTaken} اختبار مكتمل` : 'لا توجد اختبارات بعد'}</small></div>
              </div>
              <div className="workspace-columns">
                <section><div className="study-section-title"><h2>آخر الواجبات</h2><ClipboardList size={20} /></div>
                  {overview.recentSubmissions.length > 0 ? <div className="content-list">{overview.recentSubmissions.map((s) => <div className="content-card" key={s.id}><div><h3>{s.title}</h3><p>{s.status === 'reviewed' ? `تمت المراجعة${s.score != null ? ` · الدرجة ${s.score}` : ''}` : 'بانتظار المراجعة'}</p></div></div>)}</div>
                    : <EmptyState icon={ClipboardList} title="لا توجد تسليمات بعد" text="ستظهر تسليمات الواجبات هنا." />}</section>
                <section><div className="study-section-title"><h2>آخر الاختبارات</h2><FileQuestion size={20} /></div>
                  {overview.recentAttempts.length > 0 ? <div className="content-list">{overview.recentAttempts.map((a) => <div className="content-card" key={a.id}><div><h3>{a.title}</h3><p>النتيجة: {a.score} من {a.total}</p></div></div>)}</div>
                    : <EmptyState icon={FileQuestion} title="لا توجد اختبارات بعد" text="ستظهر نتائج الاختبارات هنا." />}</section>
              </div>
            </>
          ) : (
            <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل التقدّم...</p></div>
          )}
        </>
      )}
    </StudentWorkspace>
  );
}

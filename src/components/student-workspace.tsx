import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ClipboardList, FileQuestion, GraduationCap, LayoutGrid, Lightbulb, ListChecks, Loader2, MessageSquare, Play, Search, Target, Trophy, UserRound, Smile, Video, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGrade } from '@/components/grade-provider';
import { useSession } from '@/lib/session';
import { gradeLabel, themeForGrade } from '@/lib/grades';
import { getMyProfile, getStudentOverview, updateMyProfile } from '@/lib/profile.functions';
import { PlanProgressBar } from '@/components/study-plan-parts';
import { getMyStudyPlan } from '@/lib/study-plans.functions';
import { listAssignments, listClasses, listLessons, listMyCompletions, listMyQuizAttempts, listMySubmissions, listQuizzes, listSubjects } from '@/lib/content.functions';

export const studentNavigation = [
  { to: '/dashboard', title: 'مساحتي', icon: LayoutGrid },
  { to: '/subjects', title: 'المواد الدراسية', icon: BookOpen },
  { to: '/lessons', title: 'الدروس', icon: Play },
  { to: '/classes', title: 'الحصص', icon: Video },
  { to: '/assignments', title: 'الواجبات', icon: ClipboardList },
  { to: '/quizzes', title: 'الاختبارات', icon: FileQuestion },
  { to: '/study-coach', title: 'مرشدي الدراسي', icon: Lightbulb },
  { to: '/study-plan', title: 'خطتي الدراسية', icon: ListChecks },
  { to: '/ai-teacher', title: 'معلّمي الصغير', icon: Smile },
  { to: '/progress', title: 'تقدّمي', icon: Target },
  { to: '/messages', title: 'الرسائل', icon: MessageSquare },
  { to: '/notifications', title: 'الإشعارات', icon: Bell },
  { to: '/profile', title: 'ملفي الشخصي', icon: UserRound },
] as const;

export function StudentWorkspace({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { grade } = useGrade();
  return <div className="student-layout page-width"><aside className="student-sidebar"><div className="student-identity"><span className="student-avatar"><GraduationCap /></span><div><strong>مساحتك الدراسية</strong><span>{grade ? gradeLabel(grade) : 'لم يُحدد الصف بعد'}</span></div></div><nav aria-label="مساحة الطالب">{studentNavigation.map(({ to, title, icon: Icon }) => <Button key={to} variant="ghost" asChild><Link to={to} activeProps={{ className: 'student-nav-active' }}><Icon />{title}</Link></Button>)}</nav><Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}>تغيير الصف<ArrowLeft /></Link></Button></aside><div className="student-content"><header className="workspace-heading"><div className="min-w-0"><span className="section-kicker">B classes · {grade ? gradeLabel(grade) : 'رحلتك الدراسية'}</span><h1>{title}</h1><p>{subtitle}</p></div></header>{!grade && <div className="grade-prompt"><GraduationCap /><p>اختر صفك لتحديد مرحلتك الدراسية.</p><Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}>اختر صفك</Link></Button></div>}{children}</div></div>;
}

export function EmptyState({ icon: Icon = BookOpen, title, text }: { icon?: typeof BookOpen; title: string; text: string }) {
  return <div className="study-empty"><span className="empty-icon"><Icon strokeWidth={1.4} /></span><h2>{title}</h2><p>{text}</p></div>;
}

function LoadingState() {
  return <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ التحميل...</p></div>;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ar', { dateStyle: 'medium' });
}

export function DashboardDesign() {
  const { grade } = useGrade();
  const { user } = useSession();
  const theme = themeForGrade(grade);
  const { data, isLoading } = useQuery({
    queryKey: ['overview', user?.id],
    queryFn: () => getStudentOverview({ data: { studentId: user!.id } }),
    enabled: !!user,
  });
  const { data: lessons } = useQuery({ queryKey: ['lessons', grade], queryFn: () => listLessons({ data: { grade } }), enabled: !!user });
  const { data: completions } = useQuery({ queryKey: ['completions'], queryFn: () => listMyCompletions(), enabled: !!user });
  const completedIds = new Set((completions ?? []).map((c) => c.lessonId));
  const nextLesson = (lessons ?? []).find((l) => !completedIds.has(l.id));
  const { data: studyPlan } = useQuery({ queryKey: ['study-plan'], queryFn: () => getMyStudyPlan(), enabled: !!user });

  return <StudentWorkspace title={theme === 'elementary' ? 'جاهز لاكتشاف شيء جديد؟' : theme === 'secondary' ? 'خطوتك التالية نحو طموحك.' : 'أهلًا بك في رحلة التعلّم.'} subtitle="مساحة تجمع خطوتك القادمة وما أنجزته في رحلتك.">
    <section className="student-welcome"><div><span className="welcome-label">بداية جديدة</span><h2>{theme === 'elementary' ? 'كل سؤال، مغامرة صغيرة.' : 'كل يوم فرصة لتتقدّم.'}</h2><p>ابدأ من موادك الدراسية، وخذ خطوتك التالية بثقة.</p><Button asChild><Link to="/subjects">استكشف موادي<ArrowLeft /></Link></Button></div><span className="welcome-illustration" aria-hidden="true">{theme === 'elementary' ? <Waves /> : <GraduationCap />}</span></section>
    {isLoading ? <LoadingState /> : (
      <div className="study-metrics">
        <div className="study-metric"><span><BookOpen /></span><p>دروسي المكتملة</p><strong>{data ? `${data.lessonsCompleted} / ${data.lessonsTotal}` : '—'}</strong><small>{data && data.lessonsTotal > 0 ? 'من دروس صفك' : 'لا توجد بيانات بعد'}</small></div>
        <div className="study-metric"><span><ClipboardList /></span><p>الواجبات المسلّمة</p><strong>{data?.assignmentsSubmitted ?? '—'}</strong><small>{data && data.assignmentsReviewed > 0 ? `${data.assignmentsReviewed} قيد المراجعة أو مُراجَع` : 'لا توجد بيانات بعد'}</small></div>
        <div className="study-metric"><span><FileQuestion /></span><p>متوسط الاختبارات</p><strong>{data?.quizzesAverage != null ? `${data.quizzesAverage}%` : '—'}</strong><small>{data && data.quizzesTaken > 0 ? `${data.quizzesTaken} اختبار مكتمل` : 'لا توجد بيانات بعد'}</small></div>
      </div>
    )}
    <section className="plan-summary" aria-label="خطتي الدراسية">
      <div className="study-section-title"><h2>{studyPlan?.title ?? 'خطتي الأسبوعية'}</h2><Button variant="link" asChild><Link to="/study-plan">افتح خطتي<ArrowLeft /></Link></Button></div>
      <PlanProgressBar items={studyPlan?.items ?? []} />
    </section>
    <div className="workspace-columns">
      <section><div className="study-section-title"><h2>خطوتك القادمة</h2><Button variant="link" asChild><Link to="/lessons">كل الدروس<ArrowLeft /></Link></Button></div>
        {nextLesson ? <div className="content-card"><div><span className="content-card-kicker">{nextLesson.subject?.title ?? 'درس'}</span><h3>{nextLesson.title}</h3>{nextLesson.description && <p>{nextLesson.description}</p>}</div><Button asChild><Link to="/lessons/$lessonId" params={{ lessonId: nextLesson.id }}><Play />ابدأ الدرس</Link></Button></div>
          : <EmptyState icon={Play} title="رحلتك تنتظر أول درس" text="ستظهر دروسك هنا عندما تصبح متاحة." />}</section>
      <section><div className="study-section-title"><h2>حصصك القادمة</h2><CalendarDays size={19} /></div>
        {data && data.upcomingClasses.length > 0 ? <div className="content-list">{data.upcomingClasses.map((c) => <div className="content-card" key={c.id}><div><span className="content-card-kicker">{c.subjectTitle}</span><h3>{c.title}</h3><p>{new Date(c.scheduledAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div>)}</div>
          : <EmptyState icon={CalendarDays} title="جدولك هادئ الآن" text="لا توجد حصص مجدولة بعد." />}</section>
    </div>
    <nav className="study-shortcuts" aria-label="روابط سريعة">{[{ to: '/assignments', title: 'واجباتي', icon: ClipboardList },{ to: '/quizzes', title: 'اختبر معرفتك', icon: FileQuestion },{ to: '/progress', title: 'رحلة إنجازك', icon: Trophy }].map(({to,title,icon:Icon}) => <Button variant="outline" asChild key={to}><Link to={to as '/assignments' | '/quizzes' | '/progress'}><Icon />{title}<ArrowLeft /></Link></Button>)}</nav>
  </StudentWorkspace>;
}

const catalogueInfo = {
  subjects: { title: 'موادي الدراسية', subtitle: 'كل مادة تفتح بابًا جديدًا للمعرفة.', filters: ['كل المواد'], empty: 'موادك الدراسية ستظهر هنا', text: 'لا توجد مواد مرتبطة بصفك حاليًا.', icon: BookOpen },
  lessons: { title: 'دروسي', subtitle: 'خطوات صغيرة تصنع معرفة أكبر.', filters: ['كل الدروس', 'المكتملة', 'غير المكتملة'], empty: 'لا توجد دروس متاحة بعد', text: 'ستجد هنا دروسك المسجلة ومواد المراجعة.', icon: Play },
  classes: { title: 'حصصي الدراسية', subtitle: 'موعدك مع المعرفة، في مكان واحد.', filters: ['القادمة', 'السابقة'], empty: 'لا توجد حصص في هذا القسم', text: 'ستظهر مواعيد حصصك وتسجيلاتها عندما تصبح متاحة.', icon: Video },
  assignments: { title: 'واجباتي', subtitle: 'فرصة لتطبيق ما تعلّمته، خطوة بخطوة.', filters: ['كل الواجبات', 'المسلّمة', 'غير المسلّمة'], empty: 'لا توجد واجبات بعد', text: 'عندما يُضاف واجب، ستجد تفاصيله وموعد تسليمه هنا.', icon: ClipboardList },
  quizzes: { title: 'اختباراتي', subtitle: 'اكتشف ما أتقنته، وما يمكنك تعلّمه بعد.', filters: ['كل الاختبارات', 'المكتملة', 'غير المكتملة'], empty: 'لا توجد اختبارات متاحة', text: 'ستظهر اختباراتك ونتائجك في هذه المساحة.', icon: FileQuestion },
} as const;

type CatalogueKind = keyof typeof catalogueInfo;

export function CatalogueDesign({ kind }: { kind: CatalogueKind }) {
  const info = catalogueInfo[kind];
  const { grade } = useGrade();
  const { user } = useSession();
  const [filter, setFilter] = useState<string>(info.filters[0]);
  const [search, setSearch] = useState('');

  const subjects = useQuery({ queryKey: ['subjects', grade], queryFn: () => listSubjects({ data: { grade } }), enabled: !!user && kind === 'subjects' });
  const lessons = useQuery({ queryKey: ['lessons', grade], queryFn: () => listLessons({ data: { grade } }), enabled: !!user && kind === 'lessons' });
  const completions = useQuery({ queryKey: ['completions'], queryFn: () => listMyCompletions(), enabled: !!user && kind === 'lessons' });
  const classes = useQuery({ queryKey: ['classes', grade], queryFn: () => listClasses({ data: { grade } }), enabled: !!user && kind === 'classes' });
  const assignments = useQuery({ queryKey: ['assignments', grade], queryFn: () => listAssignments({ data: { grade } }), enabled: !!user && kind === 'assignments' });
  const submissions = useQuery({ queryKey: ['submissions'], queryFn: () => listMySubmissions(), enabled: !!user && kind === 'assignments' });
  const quizzes = useQuery({ queryKey: ['quizzes', grade], queryFn: () => listQuizzes({ data: { grade } }), enabled: !!user && kind === 'quizzes' });
  const attempts = useQuery({ queryKey: ['quiz-attempts'], queryFn: () => listMyQuizAttempts(), enabled: !!user && kind === 'quizzes' });

  const isLoading = subjects.isLoading || lessons.isLoading || classes.isLoading || assignments.isLoading || quizzes.isLoading;
  const term = search.trim();

  let body: ReactNode = null;
  if (isLoading) {
    body = <LoadingState />;
  } else if (kind === 'subjects') {
    const rows = (subjects.data ?? []).filter((s) => !term || s.title.includes(term));
    body = rows.length === 0 ? <EmptyState icon={info.icon} title={term ? 'لا توجد نتائج مطابقة' : info.empty} text={term ? 'جرّب عبارة بحث أخرى.' : info.text} /> : (
      <div className="content-grid">{rows.map((s) => <div className="content-card" key={s.id}><div><span className="content-card-kicker">{gradeLabel(s.grade as 1)}</span><h3>{s.title}</h3>{s.description && <p>{s.description}</p>}</div><Button variant="outline" asChild><Link to="/lessons">دروس المادة<ArrowLeft /></Link></Button></div>)}</div>
    );
  } else if (kind === 'lessons') {
    const done = new Set((completions.data ?? []).map((c) => c.lessonId));
    let rows = (lessons.data ?? []).filter((l) => !term || l.title.includes(term));
    if (filter === 'المكتملة') rows = rows.filter((l) => done.has(l.id));
    if (filter === 'غير المكتملة') rows = rows.filter((l) => !done.has(l.id));
    body = rows.length === 0 ? <EmptyState icon={info.icon} title={term ? 'لا توجد نتائج مطابقة' : info.empty} text={term ? 'جرّب عبارة بحث أخرى.' : info.text} /> : (
      <div className="content-grid">{rows.map((l) => <div className="content-card" key={l.id}><div><span className="content-card-kicker">{l.subject?.title ?? 'درس'}{done.has(l.id) && <span className="status-chip status-done"><CheckCircle2 size={13} />مكتمل</span>}</span><h3>{l.title}</h3>{l.description && <p>{l.description}</p>}</div><Button asChild><Link to="/lessons/$lessonId" params={{ lessonId: l.id }}><Play />{done.has(l.id) ? 'مراجعة الدرس' : 'ابدأ الدرس'}</Link></Button></div>)}</div>
    );
  } else if (kind === 'classes') {
    const now = Date.now();
    let rows = (classes.data ?? []).filter((c) => !term || c.title.includes(term));
    if (filter === 'القادمة') rows = rows.filter((c) => new Date(c.scheduledAt).getTime() >= now);
    if (filter === 'السابقة') rows = rows.filter((c) => new Date(c.scheduledAt).getTime() < now);
    body = rows.length === 0 ? <EmptyState icon={info.icon} title={term ? 'لا توجد نتائج مطابقة' : info.empty} text={term ? 'جرّب عبارة بحث أخرى.' : info.text} /> : (
      <div className="content-grid">{rows.map((c) => <div className="content-card" key={c.id}><div><span className="content-card-kicker">{c.subject?.title ?? 'حصة'}</span><h3>{c.title}</h3><p>{new Date(c.scheduledAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })} · {c.durationMinutes} دقيقة</p></div>{c.meetingUrl && <Button variant="outline" asChild><a href={c.meetingUrl} target="_blank" rel="noreferrer"><Video />رابط الحصة</a></Button>}</div>)}</div>
    );
  } else if (kind === 'assignments') {
    const submitted = new Set((submissions.data ?? []).map((s) => s.assignmentId));
    let rows = (assignments.data ?? []).filter((a) => !term || a.title.includes(term));
    if (filter === 'المسلّمة') rows = rows.filter((a) => submitted.has(a.id));
    if (filter === 'غير المسلّمة') rows = rows.filter((a) => !submitted.has(a.id));
    body = rows.length === 0 ? <EmptyState icon={info.icon} title={term ? 'لا توجد نتائج مطابقة' : info.empty} text={term ? 'جرّب عبارة بحث أخرى.' : info.text} /> : (
      <div className="content-grid">{rows.map((a) => <div className="content-card" key={a.id}><div><span className="content-card-kicker">{a.subject?.title ?? 'واجب'}{submitted.has(a.id) && <span className="status-chip status-done"><CheckCircle2 size={13} />مُسلَّم</span>}</span><h3>{a.title}</h3>{a.dueAt && <p>التسليم: {formatDate(a.dueAt)}</p>}</div><Button asChild><Link to="/assignments/$assignmentId" params={{ assignmentId: a.id }}><ClipboardList />{submitted.has(a.id) ? 'عرض التسليم' : 'تسليم الواجب'}</Link></Button></div>)}</div>
    );
  } else {
    const bestAttempt = new Map<string, number>();
    (attempts.data ?? []).forEach((a) => bestAttempt.set(a.quizId, Math.max(bestAttempt.get(a.quizId) ?? 0, a.score / Math.max(a.total, 1) * 100)));
    let rows = (quizzes.data ?? []).filter((q) => !term || q.title.includes(term));
    if (filter === 'المكتملة') rows = rows.filter((q) => bestAttempt.has(q.id));
    if (filter === 'غير المكتملة') rows = rows.filter((q) => !bestAttempt.has(q.id));
    body = rows.length === 0 ? <EmptyState icon={info.icon} title={term ? 'لا توجد نتائج مطابقة' : info.empty} text={term ? 'جرّب عبارة بحث أخرى.' : info.text} /> : (
      <div className="content-grid">{rows.map((q) => { const best = bestAttempt.get(q.id); return <div className="content-card" key={q.id}><div><span className="content-card-kicker">{q.subject?.title ?? 'اختبار'}{best != null && <span className="status-chip status-done"><CheckCircle2 size={13} />{Math.round(best)}%</span>}</span><h3>{q.title}</h3>{q.dueAt && <p>حتى: {formatDate(q.dueAt)}</p>}</div><Button asChild>{best != null
        ? <Link to="/quizzes/$quizId/results" params={{ quizId: q.id }}><Trophy />عرض النتيجة</Link>
        : <Link to="/quizzes/$quizId" params={{ quizId: q.id }}><FileQuestion />ابدأ الاختبار</Link>}</Button></div>; })}</div>
    );
  }

  return <StudentWorkspace title={info.title} subtitle={info.subtitle}><div className="catalogue-toolbar"><div className="study-filters" aria-label="تصفية المحتوى">{info.filters.map(item => <Button key={item} variant={filter === item ? 'default' : 'ghost'} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</Button>)}</div><div className="study-search"><Search size={17} /><Input aria-label={`البحث في ${info.title}`} placeholder="ابحث هنا..." value={search} onChange={event => setSearch(event.target.value)} /></div></div><div aria-live="polite">{body}</div></StudentWorkspace>;
}

export function ProgressDesign() {
  const { user } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ['overview', user?.id],
    queryFn: () => getStudentOverview({ data: { studentId: user!.id } }),
    enabled: !!user,
  });
  return <StudentWorkspace title="رحلة إنجازي" subtitle="كل خطوة تستحق أن تراها، وكل إنجاز يستحق الاحتفاء.">
    {isLoading ? <LoadingState /> : (
      <>
        <div className="study-metrics">
          <div className="study-metric"><span><BookOpen /></span><p>الدروس المكتملة</p><strong>{data ? `${data.lessonsCompleted} / ${data.lessonsTotal}` : '—'}</strong><small>{data && data.lessonsTotal > 0 ? `${Math.round(data.lessonsCompleted / Math.max(data.lessonsTotal, 1) * 100)}% من دروس صفك` : 'بانتظار أول إنجاز'}</small></div>
          <div className="study-metric"><span><ClipboardList /></span><p>الواجبات المسلّمة</p><strong>{data?.assignmentsSubmitted ?? '—'}</strong><small>{data?.assignmentsAverage != null ? `متوسط الدرجات ${data.assignmentsAverage}` : 'بانتظار أول إنجاز'}</small></div>
          <div className="study-metric"><span><FileQuestion /></span><p>متوسط الاختبارات</p><strong>{data?.quizzesAverage != null ? `${data.quizzesAverage}%` : '—'}</strong><small>{data && data.quizzesTaken > 0 ? `${data.quizzesTaken} اختبار مكتمل` : 'بانتظار أول إنجاز'}</small></div>
        </div>
        <div className="workspace-columns">
          <section><div className="study-section-title"><h2>آخر الواجبات</h2><ClipboardList size={20} /></div>
            {data && data.recentSubmissions.length > 0 ? <div className="content-list">{data.recentSubmissions.map((s) => <div className="content-card" key={s.id}><div><h3>{s.title}</h3><p>{s.status === 'reviewed' ? `تمت المراجعة${s.score != null ? ` · الدرجة ${s.score}` : ''}` : 'بانتظار المراجعة'}</p>{s.feedback && <p>{s.feedback}</p>}</div></div>)}</div>
              : <EmptyState icon={ClipboardList} title="لا توجد تسليمات بعد" text="عندما تسلّم واجبًا ستظهر حالته هنا." />}</section>
          <section><div className="study-section-title"><h2>آخر الاختبارات</h2><Trophy size={20} /></div>
            {data && data.recentAttempts.length > 0 ? <div className="content-list">{data.recentAttempts.map((a) => <div className="content-card" key={a.id}><div><h3>{a.title}</h3><p>النتيجة: {a.score} من {a.total} · {formatDate(a.submittedAt)}</p></div></div>)}</div>
              : <EmptyState icon={Trophy} title="أول إنجاز في انتظارك" text="لا توجد اختبارات مكتملة بعد." />}</section>
        </div>
      </>
    )}
  </StudentWorkspace>;
}

export function ProfileDesign() {
  const { grade, selectGrade } = useGrade();
  const { user } = useSession();
  const { data, refetch } = useQuery({ queryKey: ['my-profile'], queryFn: () => getMyProfile(), enabled: !!user });
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = name ?? data?.profile?.displayName ?? '';

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateMyProfile({ data: { displayName: displayName } });
      await refetch();
      setSaved(true);
    } catch {
      setError('تعذر حفظ البيانات. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  return <StudentWorkspace title="ملفي الشخصي" subtitle="تفاصيلك، وبداية رحلتك الدراسية.">
    <div className="profile-heading"><span className="profile-avatar"><UserRound /></span><div><h2>{displayName || 'طالب B classes'}</h2><p>{grade ? gradeLabel(grade) : 'اختر صفك الدراسي'}</p></div></div>
    <form className="profile-form" onSubmit={handleSave}><h2>معلوماتي</h2>
      <div className="profile-fields">
        <div><label htmlFor="student-name">الاسم</label><Input id="student-name" placeholder="اسمك الكامل" value={displayName} onChange={(event) => { setName(event.target.value); setSaved(false); }} /></div>
        <div><label htmlFor="student-email">البريد الإلكتروني</label><Input id="student-email" type="email" dir="ltr" value={user?.email ?? ''} disabled /></div>
      </div>
      <div className="profile-grade"><div><strong>صفي الدراسي</strong><p>{grade ? gradeLabel(grade) : 'لم يُحدد بعد'}</p></div><Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}>تغيير الصف</Link></Button></div>
      {data?.profile?.inviteCode && (
        <div className="profile-grade"><div><strong>رمز ربط ولي الأمر</strong><p>شارك هذا الرمز مع ولي أمرك ليتابع تقدّمك.</p></div><code className="invite-code" dir="ltr">{data.profile.inviteCode}</code></div>
      )}
      <div className="profile-save"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Check />}حفظ التغييرات</Button></div>
      {saved && <p className="profile-status" role="status"><Check />تم حفظ بياناتك في حسابك.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </form>
  </StudentWorkspace>;
}

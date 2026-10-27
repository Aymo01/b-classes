import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BookOpen, Check, ClipboardList, FileQuestion, Loader2, Play, Plus, Trash2, Video, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { createAssignment, createClass, createLesson, createQuiz, createSubject, deleteContent, gradeSubmission, listTeacherContent } from '@/lib/teacher.functions';
import { getMyProfile } from '@/lib/profile.functions';
import { gradeLabel, type Grade } from '@/lib/grades';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/teacher')({
  head: () => pageMeta('منطقة المعلم', 'إدارة المواد والدروس والحصص والواجبات والاختبارات في B classes.'),
  component: TeacherPage,
});

type SubjectRow = { id: string; title: string; grade: number };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="auth-field"><label>{label}</label>{children}</div>;
}

function SubjectPicker({ subjects, value, onChange }: { subjects: SubjectRow[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
      <SelectContent>
        {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.title} — {gradeLabel(s.grade as Grade)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function TeacherPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['my-profile'], queryFn: () => getMyProfile() });
  const isEditor = (me?.roles ?? []).some((r) => r === 'teacher' || r === 'admin');
  const { data, isLoading, error } = useQuery({ queryKey: ['teacher-content'], queryFn: () => listTeacherContent(), enabled: isEditor });
  const [message, setMessage] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['teacher-content'] });
  const remove = useMutation({
    mutationFn: (input: { table: 'subjects' | 'lessons' | 'classes' | 'assignments' | 'quizzes'; id: string }) => deleteContent({ data: input }),
    onSuccess: invalidate,
  });

  if (!me) {
    return <StudentWorkspace title="منطقة المعلم" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ التحقق من الصلاحيات...</p></div></StudentWorkspace>;
  }
  if (!isEditor) {
    return <StudentWorkspace title="منطقة المعلم" subtitle=""><EmptyState icon={Wrench} title="هذه المنطقة للمعلمين" text="حسابك الحالي لا يملك صلاحية إدارة المحتوى." /></StudentWorkspace>;
  }

  const subjects = data?.subjects ?? [];

  function ContentList({ rows, table, icon: Icon }: { rows: { id: string; title: string; meta: string; subjectTitle: string; grade: number }[]; table: 'lessons' | 'classes' | 'assignments' | 'quizzes'; icon: typeof Play }) {
    if (rows.length === 0) return <EmptyState icon={Icon} title="لا يوجد محتوى بعد" text="أضف أول عنصر من النموذج أدناه." />;
    return (
      <div className="content-list">
        {rows.map((row) => (
          <div className="content-card" key={row.id}>
            <div>
              <span className="content-card-kicker">{row.subjectTitle}{row.grade ? ` · ${gradeLabel(row.grade as Grade)}` : ''}</span>
              <h3>{row.title}</h3>
              <p>{row.meta}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label={`حذف ${row.title}`} onClick={() => remove.mutate({ table, id: row.id })}><Trash2 /></Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <StudentWorkspace title="منطقة المعلم" subtitle="أضف المواد والدروس والحصص والواجبات والاختبارات، وتابع تسليمات الطلاب.">
      {message && <p className="auth-notice" role="status"><Check size={16} />{message}</p>}
      {isLoading ? <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ التحميل...</p></div> : error ? (
        <EmptyState icon={Wrench} title="تعذر تحميل المحتوى" text="حدث خطأ غير متوقع. حاول تحديث الصفحة." />
      ) : (
        <Tabs defaultValue="subjects" dir="rtl">
          <TabsList className="teacher-tabs">
            <TabsTrigger value="subjects"><BookOpen />المواد</TabsTrigger>
            <TabsTrigger value="lessons"><Play />الدروس</TabsTrigger>
            <TabsTrigger value="classes"><Video />الحصص</TabsTrigger>
            <TabsTrigger value="assignments"><ClipboardList />الواجبات</TabsTrigger>
            <TabsTrigger value="quizzes"><FileQuestion />الاختبارات</TabsTrigger>
            <TabsTrigger value="submissions"><Check />التسليمات</TabsTrigger>
          </TabsList>

          <TabsContent value="subjects">
            <SubjectForm onDone={() => { void invalidate(); setMessage('تم إنشاء المادة.'); }} />
            <div className="content-list">
              {subjects.map((s) => (
                <div className="content-card" key={s.id}>
                  <div><span className="content-card-kicker">{gradeLabel(s.grade as Grade)}</span><h3>{s.title}</h3></div>
                  <Button variant="ghost" size="icon" aria-label={`حذف ${s.title}`} onClick={() => remove.mutate({ table: 'subjects', id: s.id })}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="lessons">
            <LessonForm subjects={subjects} onDone={() => { void invalidate(); setMessage('تم إنشاء الدرس وإشعار الطلاب.'); }} />
            <ContentList rows={data?.lessons ?? []} table="lessons" icon={Play} />
          </TabsContent>

          <TabsContent value="classes">
            <ClassForm subjects={subjects} onDone={() => { void invalidate(); setMessage('تمت جدولة الحصة وإشعار الطلاب.'); }} />
            <ContentList rows={data?.classes ?? []} table="classes" icon={Video} />
          </TabsContent>

          <TabsContent value="assignments">
            <AssignmentForm subjects={subjects} onDone={() => { void invalidate(); setMessage('تم إنشاء الواجب وإشعار الطلاب.'); }} />
            <ContentList rows={data?.assignments ?? []} table="assignments" icon={ClipboardList} />
          </TabsContent>

          <TabsContent value="quizzes">
            <QuizForm subjects={subjects} onDone={() => { void invalidate(); setMessage('تم إنشاء الاختبار وإشعار الطلاب.'); }} />
            <ContentList rows={data?.quizzes ?? []} table="quizzes" icon={FileQuestion} />
          </TabsContent>

          <TabsContent value="submissions">
            <SubmissionsList rows={data?.submissions ?? []} onGraded={() => { void invalidate(); setMessage('تم حفظ التقييم.'); }} />
          </TabsContent>
        </Tabs>
      )}
    </StudentWorkspace>
  );
}

function useFormState<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const set = (key: keyof T) => (v: string) => setValues((prev) => ({ ...prev, [key]: v }));
  return { values, set, reset: () => setValues(initial) };
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}{label}</Button>;
}

function SubjectForm({ onDone }: { onDone: () => void }) {
  const { values, set, reset } = useFormState({ title: '', description: '', grade: '1' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createSubject({ data: { title: values.title, description: values.description || null, grade: Number(values.grade) } });
      reset();
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر الإنشاء'); }
    setBusy(false);
  }
  return (
    <form className="teacher-form" onSubmit={submit}>
      <h3>مادة جديدة</h3>
      <div className="teacher-form-grid">
        <Field label="اسم المادة"><Input value={values.title} onChange={(e) => set('title')(e.target.value)} required /></Field>
        <Field label="الصف">
          <Select value={values.grade} onValueChange={set('grade')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <SelectItem key={g} value={String(g)}>{gradeLabel(g as Grade)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="وصف (اختياري)"><Textarea rows={2} value={values.description} onChange={(e) => set('description')(e.target.value)} /></Field>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <SubmitButton busy={busy} label="إضافة المادة" />
    </form>
  );
}

function LessonForm({ subjects, onDone }: { subjects: SubjectRow[]; onDone: () => void }) {
  const { values, set, reset } = useFormState({ subjectId: '', title: '', description: '', videoUrl: '', notes: '', orderIndex: '0' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createLesson({ data: { subjectId: values.subjectId, title: values.title, description: values.description || null, videoUrl: values.videoUrl || null, notes: values.notes || null, orderIndex: Number(values.orderIndex) || 0 } });
      reset();
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر الإنشاء'); }
    setBusy(false);
  }
  return (
    <form className="teacher-form" onSubmit={submit}>
      <h3>درس جديد</h3>
      <div className="teacher-form-grid">
        <Field label="المادة"><SubjectPicker subjects={subjects} value={values.subjectId} onChange={set('subjectId')} /></Field>
        <Field label="عنوان الدرس"><Input value={values.title} onChange={(e) => set('title')(e.target.value)} required /></Field>
        <Field label="رابط الفيديو (اختياري)"><Input dir="ltr" value={values.videoUrl} onChange={(e) => set('videoUrl')(e.target.value)} placeholder="https://..." /></Field>
        <Field label="الترتيب"><Input type="number" dir="ltr" value={values.orderIndex} onChange={(e) => set('orderIndex')(e.target.value)} /></Field>
      </div>
      <Field label="وصف (اختياري)"><Textarea rows={2} value={values.description} onChange={(e) => set('description')(e.target.value)} /></Field>
      <Field label="ملاحظات الدرس (اختياري)"><Textarea rows={3} value={values.notes} onChange={(e) => set('notes')(e.target.value)} /></Field>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <SubmitButton busy={busy} label="إضافة الدرس" />
    </form>
  );
}

function ClassForm({ subjects, onDone }: { subjects: SubjectRow[]; onDone: () => void }) {
  const { values, set, reset } = useFormState({ subjectId: '', title: '', scheduledAt: '', durationMinutes: '45', meetingUrl: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createClass({ data: { subjectId: values.subjectId, title: values.title, scheduledAt: new Date(values.scheduledAt).toISOString(), durationMinutes: Number(values.durationMinutes) || 45, meetingUrl: values.meetingUrl || null } });
      reset();
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر الإنشاء'); }
    setBusy(false);
  }
  return (
    <form className="teacher-form" onSubmit={submit}>
      <h3>حصة جديدة</h3>
      <div className="teacher-form-grid">
        <Field label="المادة"><SubjectPicker subjects={subjects} value={values.subjectId} onChange={set('subjectId')} /></Field>
        <Field label="عنوان الحصة"><Input value={values.title} onChange={(e) => set('title')(e.target.value)} required /></Field>
        <Field label="الموعد"><Input type="datetime-local" dir="ltr" value={values.scheduledAt} onChange={(e) => set('scheduledAt')(e.target.value)} required /></Field>
        <Field label="المدة (دقيقة)"><Input type="number" dir="ltr" value={values.durationMinutes} onChange={(e) => set('durationMinutes')(e.target.value)} /></Field>
      </div>
      <Field label="رابط الاجتماع (اختياري)"><Input dir="ltr" value={values.meetingUrl} onChange={(e) => set('meetingUrl')(e.target.value)} placeholder="https://..." /></Field>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <SubmitButton busy={busy} label="جدولة الحصة" />
    </form>
  );
}

function AssignmentForm({ subjects, onDone }: { subjects: SubjectRow[]; onDone: () => void }) {
  const { values, set, reset } = useFormState({ subjectId: '', title: '', instructions: '', dueAt: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createAssignment({ data: { subjectId: values.subjectId, title: values.title, instructions: values.instructions || null, dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null } });
      reset();
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر الإنشاء'); }
    setBusy(false);
  }
  return (
    <form className="teacher-form" onSubmit={submit}>
      <h3>واجب جديد</h3>
      <div className="teacher-form-grid">
        <Field label="المادة"><SubjectPicker subjects={subjects} value={values.subjectId} onChange={set('subjectId')} /></Field>
        <Field label="عنوان الواجب"><Input value={values.title} onChange={(e) => set('title')(e.target.value)} required /></Field>
        <Field label="موعد التسليم (اختياري)"><Input type="datetime-local" dir="ltr" value={values.dueAt} onChange={(e) => set('dueAt')(e.target.value)} /></Field>
      </div>
      <Field label="التعليمات (اختياري)"><Textarea rows={3} value={values.instructions} onChange={(e) => set('instructions')(e.target.value)} /></Field>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <SubmitButton busy={busy} label="إضافة الواجب" />
    </form>
  );
}

function QuizForm({ subjects, onDone }: { subjects: SubjectRow[]; onDone: () => void }) {
  const { values, set, reset } = useFormState({ subjectId: '', title: '', description: '', dueAt: '' });
  const [questions, setQuestions] = useState<{ questionText: string; options: string[]; correctIndex: number }[]>([
    { questionText: '', options: ['', ''], correctIndex: 0 },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(index: number, patch: Partial<{ questionText: string; options: string[]; correctIndex: number }>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = questions.filter((q) => q.questionText.trim() && q.options.filter((o) => o.trim()).length >= 2);
    if (cleaned.length === 0) {
      setError('أضف سؤالًا واحدًا على الأقل بخيارين.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createQuiz({
        data: {
          subjectId: values.subjectId,
          title: values.title,
          description: values.description || null,
          dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null,
          questions: cleaned.map((q) => ({ questionText: q.questionText, options: q.options.filter((o) => o.trim()), correctIndex: q.correctIndex })),
        },
      });
      reset();
      setQuestions([{ questionText: '', options: ['', ''], correctIndex: 0 }]);
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر الإنشاء'); }
    setBusy(false);
  }

  return (
    <form className="teacher-form" onSubmit={submit}>
      <h3>اختبار جديد</h3>
      <div className="teacher-form-grid">
        <Field label="المادة"><SubjectPicker subjects={subjects} value={values.subjectId} onChange={set('subjectId')} /></Field>
        <Field label="عنوان الاختبار"><Input value={values.title} onChange={(e) => set('title')(e.target.value)} required /></Field>
        <Field label="متاح حتى (اختياري)"><Input type="datetime-local" dir="ltr" value={values.dueAt} onChange={(e) => set('dueAt')(e.target.value)} /></Field>
      </div>
      <Field label="وصف (اختياري)"><Textarea rows={2} value={values.description} onChange={(e) => set('description')(e.target.value)} /></Field>

      <div className="quiz-builder">
        <h4>الأسئلة</h4>
        {questions.map((q, qi) => (
          <div className="quiz-builder-question" key={qi}>
            <Field label={`السؤال ${qi + 1}`}>
              <Input value={q.questionText} onChange={(e) => updateQuestion(qi, { questionText: e.target.value })} placeholder="نص السؤال" />
            </Field>
            <div className="quiz-builder-options">
              {q.options.map((option, oi) => (
                <div className="quiz-builder-option" key={oi}>
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    aria-label={`الخيار ${oi + 1} هو الإجابة الصحيحة`}
                    checked={q.correctIndex === oi}
                    onChange={() => updateQuestion(qi, { correctIndex: oi })}
                  />
                  <Input
                    value={option}
                    placeholder={`الخيار ${oi + 1}`}
                    onChange={(e) => {
                      const next = [...q.options];
                      next[oi] = e.target.value;
                      updateQuestion(qi, { options: next });
                    }}
                  />
                  {q.options.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" aria-label="حذف الخيار" onClick={() => updateQuestion(qi, { options: q.options.filter((_, i) => i !== oi), correctIndex: q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex })}><Trash2 /></Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => updateQuestion(qi, { options: [...q.options, ''] })} disabled={q.options.length >= 6}><Plus />خيار آخر</Button>
            </div>
            <p className="quiz-hint">حدّد الدائرة بجانب الإجابة الصحيحة.</p>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setQuestions((prev) => [...prev, { questionText: '', options: ['', ''], correctIndex: 0 }])}><Plus />سؤال آخر</Button>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <SubmitButton busy={busy} label="إضافة الاختبار" />
    </form>
  );
}

function SubmissionsList({ rows, onGraded }: { rows: { id: string; assignmentTitle: string; studentName: string; status: string; score: number | null; feedback: string | null; submittedAt: string }[]; onGraded: () => void }) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function grade(id: string) {
    setBusyId(id);
    try {
      await gradeSubmission({ data: { submissionId: id, score: Number(scores[id] ?? 0), feedback: feedbacks[id] || null } });
      onGraded();
    } catch { /* surfaced by refetch */ }
    setBusyId(null);
  }

  if (rows.length === 0) return <EmptyState icon={Check} title="لا توجد تسليمات بعد" text="ستظهر تسليمات الطلاب هنا لتقييمها." />;
  return (
    <div className="content-list">
      {rows.map((row) => (
        <div className="content-card submission-card" key={row.id}>
          <div>
            <span className="content-card-kicker">{row.assignmentTitle}</span>
            <h3>{row.studentName}</h3>
            <p>{new Date(row.submittedAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })} · {row.status === 'reviewed' ? `تمت المراجعة${row.score != null ? ` — ${row.score}` : ''}` : 'بانتظار المراجعة'}</p>
            {row.feedback && <p>ملاحظاتك: {row.feedback}</p>}
          </div>
          <div className="submission-grade">
            <Input type="number" dir="ltr" placeholder="الدرجة" value={scores[row.id] ?? (row.score != null ? String(row.score) : '')} onChange={(e) => setScores((p) => ({ ...p, [row.id]: e.target.value }))} aria-label="الدرجة" />
            <Input placeholder="ملاحظة (اختياري)" value={feedbacks[row.id] ?? row.feedback ?? ''} onChange={(e) => setFeedbacks((p) => ({ ...p, [row.id]: e.target.value }))} aria-label="ملاحظة للطالب" />
            <Button onClick={() => void grade(row.id)} disabled={busyId === row.id}>{busyId === row.id ? <Loader2 className="animate-spin" /> : <Check />}حفظ</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, Loader2, Paperclip, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/lib/session';
import { getAssignment, listMySubmissions, submitAssignment } from '@/lib/content.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/assignments/$assignmentId')({
  head: () => pageMeta('تسليم الواجب', 'سلّم واجبك مع مرفق في B classes.'),
  component: AssignmentPage,
  errorComponent: ({ error }) => (
    <StudentWorkspace title="الواجب" subtitle=""><EmptyState icon={ClipboardList} title="تعذر تحميل الواجب" text={error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'} /></StudentWorkspace>
  ),
  notFoundComponent: () => (
    <StudentWorkspace title="الواجب" subtitle=""><EmptyState icon={ClipboardList} title="الواجب غير موجود" text="ربما حُذف الواجب أو أن الرابط غير صحيح." /></StudentWorkspace>
  ),
});

function AssignmentPage() {
  const { assignmentId } = Route.useParams();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: assignment, isLoading } = useQuery({ queryKey: ['assignment', assignmentId], queryFn: () => getAssignment({ data: { assignmentId } }) });
  const { data: submissions } = useQuery({ queryKey: ['submissions'], queryFn: () => listMySubmissions() });
  const existing = (submissions ?? []).find((s) => s.assignmentId === assignmentId);

  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (isLoading) {
    return <StudentWorkspace title="الواجب" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل الواجب...</p></div></StudentWorkspace>;
  }
  if (!assignment) {
    return <StudentWorkspace title="الواجب" subtitle=""><EmptyState icon={ClipboardList} title="الواجب غير موجود" text="ربما حُذف الواجب أو أن الرابط غير صحيح." /></StudentWorkspace>;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      let filePath: string | null = null;
      if (file) {
        filePath = `${user.id}/${assignmentId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('submissions').upload(filePath, file);
        if (uploadError) throw new Error('تعذر رفع الملف. حاول مرة أخرى.');
      }
      await submitAssignment({ data: { assignmentId, content: content || null, filePath } });
      await queryClient.invalidateQueries({ queryKey: ['submissions'] });
      await queryClient.invalidateQueries({ queryKey: ['overview'] });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسليم الواجب.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentWorkspace title={assignment.title} subtitle={assignment.subject ? `واجب مادة ${assignment.subject.title}` : 'واجبك الحالي'}>
      <Button variant="link" asChild><Link to="/assignments"><ArrowRight />العودة إلى الواجبات</Link></Button>
      {assignment.dueAt && <p className="lesson-description">موعد التسليم: {new Date(assignment.dueAt).toLocaleString('ar', { dateStyle: 'full', timeStyle: 'short' })}</p>}
      {assignment.instructions && (
        <section className="lesson-notes">
          <h2><ClipboardList size={19} />تعليمات الواجب</h2>
          <p>{assignment.instructions}</p>
        </section>
      )}

      {existing ? (
        <section className="lesson-notes">
          <h2><CheckCircle2 size={19} />تسليمك</h2>
          <p>سلّمت هذا الواجب في {new Date(existing.submittedAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })}.</p>
          {existing.content && <p>{existing.content}</p>}
          <p className="quiz-hint">
            {existing.status === 'reviewed'
              ? `تمت المراجعة${existing.score != null ? ` — الدرجة: ${existing.score}` : ''}${existing.feedback ? ` — ملاحظات المعلم: ${existing.feedback}` : ''}`
              : 'بانتظار مراجعة المعلم.'}
          </p>
        </section>
      ) : done ? (
        <p className="auth-notice" role="status"><CheckCircle2 size={16} />تم تسليم واجبك بنجاح. ستظهر ملاحظات المعلم هنا بعد المراجعة.</p>
      ) : (
        <form className="auth-form submission-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="submission-content">إجابتك (اختياري)</label>
            <Textarea id="submission-content" rows={5} placeholder="اكتب إجابتك هنا..." value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="submission-file">مرفق (اختياري)</label>
            <input
              id="submission-file"
              ref={fileInput}
              type="file"
              className="file-input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="quiz-hint"><Paperclip size={14} />{file.name}</p>}
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button type="submit" size="lg" disabled={busy || (!content.trim() && !file)}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />}تسليم الواجب
          </Button>
          {!content.trim() && !file && <p className="quiz-hint">اكتب إجابة أو أرفق ملفًا لتتمكن من التسليم.</p>}
        </form>
      )}
    </StudentWorkspace>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { StudentWorkspace, EmptyState } from '@/components/student-workspace';
import { Button } from '@/components/ui/button';
import { useGrade } from '@/components/grade-provider';
import { gradeLabel } from '@/lib/grades';
import { pageMeta } from '@/lib/page-meta';
import { generateStudyGuidance } from '@/lib/study-coach.functions';

export const Route = createFileRoute('/_authenticated/study-coach')({
  head: () => pageMeta('مرشدي الدراسي', 'صف موضوع درسك أو تحديك الدراسي واحصل على خطة عملية مخصصة في B classes.'),
  component: StudyCoach,
});

function StudyCoach() {
  const { grade } = useGrade();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [guidance, setGuidance] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(''); setGuidance('');
    try {
      const r = await generateStudyGuidance({ data: { topic, grade: grade ? gradeLabel(grade) : null } });
      if (r.ok) setGuidance(r.guidance); else setError(r.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally { setLoading(false); }
  }

  return (
    <StudentWorkspace title="مرشدي الدراسي" subtitle="صف ما تدرسه أو ما يصعب عليك، واحصل على خطة تناسبك.">
      <form className="profile-form" onSubmit={submit}>
        <label htmlFor="coach-topic" className="mb-2 block font-semibold">ما الموضوع أو التحدي؟</label>
        <textarea
          id="coach-topic"
          className="min-h-32 w-full rounded-md border border-input bg-background p-3 text-sm leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="مثال: لا أفهم الكسور العشرية، أو أنسى ما أذاكره قبل الاختبار."
          value={topic}
          maxLength={1500}
          onChange={e => setTopic(e.target.value)}
        />
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={loading || topic.trim().length < 5}>
            {loading ? <Loader2 className="animate-spin" /> : <Lightbulb />}
            {loading ? 'جارٍ إعداد خطتك...' : 'أنشئ خطتي'}
          </Button>
        </div>
      </form>
      <div aria-live="polite" className="mt-6">
        {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
        {guidance && <article className="rounded-lg border border-border bg-card p-5 text-sm leading-8 text-card-foreground whitespace-pre-wrap">{guidance}</article>}
        {!guidance && !error && !loading && <EmptyState icon={Lightbulb} title="خطتك ستظهر هنا" text="اكتب ما تحتاج المساعدة فيه، وسنقترح خطوات عملية تبدأ بها." />}
      </div>
    </StudentWorkspace>
  );
}

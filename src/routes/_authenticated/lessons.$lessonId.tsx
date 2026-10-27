import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, CheckCircle2, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { getLesson, listMyCompletions, setLessonCompleted } from '@/lib/content.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/lessons/$lessonId')({
  head: () => pageMeta('الدرس', 'شاهد الدرس وراجع ملاحظاته في B classes.'),
  component: LessonPage,
  errorComponent: ({ error }) => (
    <StudentWorkspace title="الدرس" subtitle=""><EmptyState icon={BookOpen} title="تعذر تحميل الدرس" text={error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'} /></StudentWorkspace>
  ),
  notFoundComponent: () => (
    <StudentWorkspace title="الدرس" subtitle=""><EmptyState icon={BookOpen} title="الدرس غير موجود" text="ربما حُذف الدرس أو أن الرابط غير صحيح." /></StudentWorkspace>
  ),
});

function isEmbed(url: string) {
  return /youtube|youtu\.be|vimeo|player\./.test(url);
}

function LessonPage() {
  const { lessonId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: lesson, isLoading } = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => getLesson({ data: { lessonId } }) });
  const { data: completions } = useQuery({ queryKey: ['completions'], queryFn: () => listMyCompletions() });
  const completed = (completions ?? []).some((c) => c.lessonId === lessonId);

  async function toggleCompleted() {
    await setLessonCompleted({ data: { lessonId, completed: !completed } });
    await queryClient.invalidateQueries({ queryKey: ['completions'] });
    await queryClient.invalidateQueries({ queryKey: ['overview'] });
  }

  if (isLoading) {
    return <StudentWorkspace title="الدرس" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل الدرس...</p></div></StudentWorkspace>;
  }
  if (!lesson) {
    return <StudentWorkspace title="الدرس" subtitle=""><EmptyState icon={BookOpen} title="الدرس غير موجود" text="ربما حُذف الدرس أو أن الرابط غير صحيح." /></StudentWorkspace>;
  }

  return (
    <StudentWorkspace title={lesson.title} subtitle={lesson.subject ? `${lesson.subject.title}` : 'درسك الحالي'}>
      <Button variant="link" asChild><Link to="/lessons"><ArrowRight />العودة إلى الدروس</Link></Button>
      {lesson.videoUrl ? (
        <div className="lesson-player">
          {isEmbed(lesson.videoUrl) ? (
            <iframe src={lesson.videoUrl} title={`فيديو درس ${lesson.title}`} allowFullScreen className="lesson-video" />
          ) : (
            <video controls className="lesson-video" src={lesson.videoUrl}>متصفحك لا يدعم تشغيل الفيديو.</video>
          )}
        </div>
      ) : (
        <EmptyState icon={Play} title="لا يوجد فيديو لهذا الدرس بعد" text="سيظهر الفيديو هنا عندما يضيفه المعلم." />
      )}
      {lesson.description && <p className="lesson-description">{lesson.description}</p>}
      {lesson.notes && (
        <section className="lesson-notes">
          <h2><BookOpen size={19} />ملاحظات الدرس</h2>
          <p>{lesson.notes}</p>
        </section>
      )}
      <div className="lesson-actions">
        <Button onClick={() => void toggleCompleted()} variant={completed ? 'outline' : 'default'}>
          <CheckCircle2 />{completed ? 'مكتمل — اضغط للتراجع' : 'أنهيت هذا الدرس'}
        </Button>
      </div>
    </StudentWorkspace>
  );
}

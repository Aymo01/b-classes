import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowRight, FileQuestion, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { getQuizToTake, submitQuizAttempt } from '@/lib/content.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/quizzes/$quizId')({
  head: () => pageMeta('الاختبار', 'أجب عن أسئلة الاختبار في B classes.'),
  component: QuizPage,
  errorComponent: ({ error }) => (
    <StudentWorkspace title="الاختبار" subtitle=""><EmptyState icon={FileQuestion} title="تعذر تحميل الاختبار" text={error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'} /></StudentWorkspace>
  ),
  notFoundComponent: () => (
    <StudentWorkspace title="الاختبار" subtitle=""><EmptyState icon={FileQuestion} title="الاختبار غير موجود" text="ربما حُذف الاختبار أو أن الرابط غير صحيح." /></StudentWorkspace>
  ),
});

function QuizPage() {
  const { quizId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: quiz, isLoading } = useQuery({ queryKey: ['quiz-take', quizId], queryFn: () => getQuizToTake({ data: { quizId } }) });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <StudentWorkspace title="الاختبار" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل الاختبار...</p></div></StudentWorkspace>;
  }
  if (!quiz) {
    return <StudentWorkspace title="الاختبار" subtitle=""><EmptyState icon={FileQuestion} title="الاختبار غير موجود" text="ربما حُذف الاختبار أو أن الرابط غير صحيح." /></StudentWorkspace>;
  }
  if (quiz.questions.length === 0) {
    return <StudentWorkspace title={quiz.title} subtitle=""><EmptyState icon={FileQuestion} title="لا توجد أسئلة بعد" text="لم يضف المعلم أسئلة لهذا الاختبار بعد." /></StudentWorkspace>;
  }

  const answered = Object.keys(answers).length;
  const total = quiz.questions.length;

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await submitQuizAttempt({ data: { quizId, answers } });
      await queryClient.invalidateQueries({ queryKey: ['quiz-attempts'] });
      await queryClient.invalidateQueries({ queryKey: ['overview'] });
      void navigate({ to: '/quizzes/$quizId/results', params: { quizId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الإجابات.');
      setBusy(false);
    }
  }

  return (
    <StudentWorkspace title={quiz.title} subtitle={quiz.subject ? `${quiz.subject.title} · ${total} سؤال` : `${total} سؤال`}>
      <Button variant="link" asChild><Link to="/quizzes"><ArrowRight />العودة إلى الاختبارات</Link></Button>
      {quiz.description && <p className="lesson-description">{quiz.description}</p>}
      <div className="quiz-progress" role="status">أجبت عن {answered} من {total} سؤالًا</div>
      <ol className="quiz-questions">
        {quiz.questions.map((q, index) => (
          <li key={q.id} className="quiz-question">
            <fieldset>
              <legend><span className="quiz-number">{index + 1}</span>{q.questionText}<span className="quiz-points">({q.points} {q.points === 1 ? 'نقطة' : 'نقاط'})</span></legend>
              <div className="quiz-options">
                {q.options.map((option, optionIndex) => {
                  const selected = answers[q.id] === optionIndex;
                  return (
                    <label key={optionIndex} className={selected ? 'quiz-option quiz-option-selected' : 'quiz-option'}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optionIndex }))}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="lesson-actions">
        <Button size="lg" onClick={() => void handleSubmit()} disabled={busy || answered < total}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />}إرسال الإجابات
        </Button>
        {answered < total && <p className="quiz-hint">أجب عن جميع الأسئلة لتتمكن من الإرسال.</p>}
      </div>
    </StudentWorkspace>
  );
}

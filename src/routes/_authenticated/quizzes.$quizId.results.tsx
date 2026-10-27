import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, Trophy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { getQuizResult } from '@/lib/content.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/quizzes/$quizId/results')({
  head: () => pageMeta('نتيجة الاختبار', 'نتيجتك ومراجعة إجاباتك في B classes.'),
  component: QuizResultsPage,
  errorComponent: ({ error }) => (
    <StudentWorkspace title="نتيجة الاختبار" subtitle=""><EmptyState icon={Trophy} title="لا توجد نتيجة بعد" text={error instanceof Error ? error.message : 'أكمل الاختبار أولًا لتظهر نتيجتك هنا.'} /></StudentWorkspace>
  ),
  notFoundComponent: () => (
    <StudentWorkspace title="نتيجة الاختبار" subtitle=""><EmptyState icon={Trophy} title="لا توجد نتيجة بعد" text="أكمل الاختبار أولًا لتظهر نتيجتك هنا." /></StudentWorkspace>
  ),
});

function QuizResultsPage() {
  const { quizId } = Route.useParams();
  const { data: result, isLoading } = useQuery({ queryKey: ['quiz-result', quizId], queryFn: () => getQuizResult({ data: { quizId } }) });

  if (isLoading) {
    return <StudentWorkspace title="نتيجة الاختبار" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل النتيجة...</p></div></StudentWorkspace>;
  }
  if (!result) {
    return <StudentWorkspace title="نتيجة الاختبار" subtitle=""><EmptyState icon={Trophy} title="لا توجد نتيجة بعد" text="أكمل الاختبار أولًا لتظهر نتيجتك هنا." /></StudentWorkspace>;
  }

  const percent = Math.round((result.score / Math.max(result.total, 1)) * 100);

  return (
    <StudentWorkspace title="نتيجتك" subtitle={`أُرسلت في ${new Date(result.submittedAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })}`}>
      <Button variant="link" asChild><Link to="/quizzes"><ArrowRight />العودة إلى الاختبارات</Link></Button>
      <section className="quiz-score">
        <span className="quiz-score-icon"><Trophy /></span>
        <strong>{result.score} / {result.total}</strong>
        <p>{percent}% — {percent >= 80 ? 'أداء رائع، واصل!' : percent >= 50 ? 'جيد، ويمكنك التحسن أكثر.' : 'لا بأس، المراجعة تصنع الفرق.'}</p>
      </section>
      <ol className="quiz-questions">
        {result.questions.map((q, index) => {
          const mine = result.answers[q.id];
          const correct = mine === q.correctIndex;
          return (
            <li key={q.id} className="quiz-question">
              <div className="quiz-review-heading">
                <span className="quiz-number">{index + 1}</span>
                <h3>{q.questionText}</h3>
                {correct
                  ? <span className="status-chip status-done"><CheckCircle2 size={14} />إجابة صحيحة</span>
                  : <span className="status-chip status-wrong"><XCircle size={14} />إجابة غير صحيحة</span>}
              </div>
              <div className="quiz-options">
                {q.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === q.correctIndex;
                  const isMine = optionIndex === mine;
                  const cls = isCorrect ? 'quiz-option quiz-review-correct' : isMine ? 'quiz-option quiz-review-mine' : 'quiz-option';
                  return (
                    <div key={optionIndex} className={cls}>
                      <span>{option}</span>
                      {isCorrect && <span className="quiz-option-tag"><CheckCircle2 size={13} />الإجابة الصحيحة</span>}
                      {isMine && !isCorrect && <span className="quiz-option-tag"><XCircle size={13} />إجابتك</span>}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </StudentWorkspace>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Gamepad2, GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { iconFor } from '@/components/games/game-icon';
import { getGameMenu, setMyBranch } from '@/lib/games.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/games/')({
  head: () => pageMeta('الألعاب', 'ألعاب تعليمية لمرحلتك الدراسية في B classes.'),
  component: GamesPage,
});

function GamesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['game-menu'], queryFn: () => getGameMenu() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseBranch(branchId: string) {
    setBusy(true);
    setError(null);
    try {
      await setMyBranch({ data: { branchId } });
      await queryClient.invalidateQueries({ queryKey: ['game-menu'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الفرع.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentWorkspace title="الألعاب" subtitle="اختر لعبة تناسب مرحلتك وابدأ اللعب.">
      {isLoading && <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل الألعاب...</p></div>}
      {isError && <EmptyState icon={Gamepad2} title="تعذر تحميل الألعاب" text="حاول مرة أخرى بعد قليل." />}
      {data && !data.grade && <EmptyState icon={GraduationCap} title="اختر صفك أولًا" text="تظهر الألعاب بحسب صفك الدراسي." />}
      {data?.needsBranch && (
        <section className="game-panel" aria-labelledby="pick-branch">
          <h2 id="pick-branch" className="game-prompt">اختر فرعك الدراسي</h2>
          <p className="quiz-hint">تظهر الألعاب والمواد بحسب فرعك.</p>
          <div className="game-options">
            {data.branches.map((b) => <Button key={b.id} variant="outline" className="game-option" disabled={busy} onClick={() => void chooseBranch(b.id)}>{b.title}</Button>)}
          </div>
          {data.branches.length === 0 && <p className="quiz-hint">لم تُضف فروع لصفك بعد.</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
        </section>
      )}
      {data && data.grade && !data.needsBranch && data.games.length === 0 && <EmptyState icon={Gamepad2} title="لا توجد ألعاب لمرحلتك بعد" text="ستظهر الألعاب هنا عندما تصبح متاحة." />}
      {data && data.games.length > 0 && (
        <div className="game-grid">
          {data.games.map((g) => {
            const Icon = iconFor(g.icon);
            return (
              <Link key={g.id} to="/games/$slug" params={{ slug: g.slug }} className="game-tile">
                <span className="game-tile-icon"><Icon aria-hidden="true" /></span>
                <strong>{g.title}</strong>
                {g.description && <span className="game-tile-text">{g.description}</span>}
                <span className="game-tile-subjects">{g.subjects.length > 0 ? g.subjects.map((s) => s.title).join(' · ') : 'لا توجد مواد'}</span>
                {!g.playable && <span className="status-chip game-soon">قريبًا</span>}
              </Link>
            );
          })}
        </div>
      )}
    </StudentWorkspace>
  );
}

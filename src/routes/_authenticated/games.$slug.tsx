import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Gamepad2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { GamePlayer } from '@/components/games/game-player';
import { getGame } from '@/lib/games.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/games/$slug')({
  head: () => pageMeta('لعبة', 'العب وتعلّم في B classes.'),
  component: GamePage,
});

function GamePage() {
  const { slug } = Route.useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['game', slug], queryFn: () => getGame({ data: { slug } }), retry: false });

  if (isLoading) {
    return <StudentWorkspace title="لعبة" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل اللعبة...</p></div></StudentWorkspace>;
  }
  if (!data) {
    return <StudentWorkspace title="لعبة" subtitle=""><EmptyState icon={Gamepad2} title="تعذر فتح اللعبة" text={error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'} /><Button variant="link" asChild><Link to="/games"><ArrowRight />كل الألعاب</Link></Button></StudentWorkspace>;
  }
  return (
    <StudentWorkspace title={data.game.title} subtitle={data.game.description ?? ''}>
      <Button variant="link" asChild><Link to="/games"><ArrowRight />العودة إلى الألعاب</Link></Button>
      <GamePlayer {...data} />
    </StudentWorkspace>
  );
}

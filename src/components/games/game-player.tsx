import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Clock, Loader2, RotateCcw, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/student-workspace';
import { CardsGame, ChoiceGame, LadderGame, OrderGame, PairGame, type EngineResult } from '@/components/games/engines';
import { getGameItems, listMyGameSessions, recordGameSession, type PlayableGameDTO } from '@/lib/games.functions';
import { percentOf } from '@/lib/games/logic';

type Phase = { name: 'pick' } | { name: 'play'; subjectId: string; round: number } | { name: 'done'; subjectId: string; result: EngineResult; seconds: number };

export function GamePlayer({ game, config }: PlayableGameDTO) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const startedAt = useRef(Date.now());
  const bestBefore = useRef<number | null>(null);

  const subjectId = phase.name === 'pick' ? null : phase.subjectId;
  const { data: loaded, isLoading, isError } = useQuery({
    queryKey: ['game-items', game.slug, subjectId],
    queryFn: () => getGameItems({ data: { slug: game.slug, subjectId: subjectId! } }),
    enabled: subjectId !== null,
    staleTime: 0,
    gcTime: 0,
  });
  const { data: previous } = useQuery({ queryKey: ['game-sessions', 'game', game.id], queryFn: () => listMyGameSessions({ data: { gameId: game.id, limit: 50 } }) });

  function begin(id: string) {
    startedAt.current = Date.now();
    // Best earlier result for this game, captured before this play is saved.
    bestBefore.current = previous && previous.length > 0 ? Math.max(...previous.map((p) => percentOf(p.score, p.maxScore))) : null;
    setSave('idle');
    setPhase({ name: 'play', subjectId: id, round: phase.name === 'play' ? phase.round + 1 : 0 });
  }

  async function onFinish(result: EngineResult) {
    if (phase.name !== 'play') return;
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    setPhase({ name: 'done', subjectId: phase.subjectId, result, seconds });
    if (result.max <= 0) return; // nothing was answered, so there is nothing to save
    setSave('saving');
    try {
      await recordGameSession({ data: { gameId: game.id, subjectId: phase.subjectId, score: result.score, maxScore: result.max, durationSeconds: seconds, details: result.details } });
      setSave('saved');
      await queryClient.invalidateQueries({ queryKey: ['game-sessions'] });
    } catch {
      setSave('failed');
    }
  }

  if (!game.playable) {
    return <EmptyState icon={Clock} title="هذه اللعبة قيد التطوير" text="ستتوفر قريبًا. جرّب لعبة أخرى من القائمة." />;
  }
  if (game.subjects.length === 0) {
    return <EmptyState icon={Clock} title="لا توجد مواد لهذه اللعبة" text="لا توجد مواد مناسبة لصفك وفرعك في هذه اللعبة بعد." />;
  }

  if (phase.name === 'pick') {
    return (
      <section className="game-panel" aria-labelledby="pick-subject">
        <h2 id="pick-subject" className="game-prompt">اختر المادة</h2>
        <div className="game-options">
          {game.subjects.map((s) => <Button key={s.id} variant="outline" className="game-option" onClick={() => begin(s.id)}>{s.title}</Button>)}
        </div>
      </section>
    );
  }

  if (phase.name === 'done') {
    const { result, seconds } = phase;
    const pct = percentOf(result.score, result.max);
    const best = bestBefore.current;
    const answered = result.max > 0;
    return (
      <div className="quiz-score" role="status">
        <span className="quiz-score-icon"><Trophy /></span>
        {answered ? <><strong>{result.score} من {result.max}</strong><p>{pct}% · الزمن {seconds} ثانية</p></> : <p>لم تُجب عن أي سؤال، فلم تُحفظ نتيجة.</p>}
        {answered && config['beatBest'] === true && best !== null && <p>{pct > best ? <><Check size={16} aria-hidden="true" /> تجاوزت أفضل نتيجة سابقة ({best}%)</> : <><X size={16} aria-hidden="true" /> لم تتجاوز أفضل نتيجة سابقة ({best}%)</>}</p>}
        {save === 'saving' && <p><Loader2 className="animate-spin" size={16} aria-hidden="true" /> جارٍ حفظ النتيجة...</p>}
        {save === 'saved' && <p><Check size={16} aria-hidden="true" /> تم حفظ النتيجة</p>}
        {save === 'failed' && <p className="auth-error" role="alert">تعذر حفظ النتيجة. تحقّق من اتصالك ثم العب مرة أخرى.</p>}
        <div className="game-actions">
          <Button onClick={() => begin(phase.subjectId)}><RotateCcw />العب مرة أخرى</Button>
          <Button variant="outline" onClick={() => setPhase({ name: 'pick' })}>مادة أخرى</Button>
          <Button variant="ghost" asChild><Link to="/games"><ArrowRight />كل الألعاب</Link></Button>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل اللعبة...</p></div>;
  if (isError || !loaded) return <EmptyState icon={X} title="تعذر تحميل اللعبة" text="حاول مرة أخرى بعد قليل." />;
  if (loaded.items.length === 0) {
    return (
      <>
        <EmptyState icon={Clock} title="لا يوجد محتوى لهذه اللعبة في هذه المادة بعد" text={loaded.note ?? 'يضيف المعلم محتوى اللعبة، وسيظهر هنا عندما يصبح جاهزًا.'} />
        <Button variant="outline" onClick={() => setPhase({ name: 'pick' })}>اختر مادة أخرى</Button>
      </>
    );
  }

  const props = { items: loaded.items, config, onFinish: (r: EngineResult) => void onFinish(r) };
  const key = `${phase.subjectId}:${phase.round}`;
  return (
    <>
      {loaded.note && <p className="quiz-hint">{loaded.note}</p>}
      {game.engine === 'choice' && <ChoiceGame key={key} {...props} />}
      {game.engine === 'pair' && <PairGame key={key} {...props} />}
      {game.engine === 'order' && <OrderGame key={key} {...props} />}
      {game.engine === 'cards' && <CardsGame key={key} {...props} />}
      {game.engine === 'ladder' && <LadderGame key={key} {...props} />}
    </>
  );
}

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Clock, Loader2, RotateCcw, Swords, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/student-workspace';
import { CardsGame, ChoiceGame, LadderGame, OrderGame, PairGame, type Check as CheckFn, type EngineProps } from '@/components/games/engines';
import { CrosswordGame, MapGame } from '@/components/games/engines-extra';
import {
  checkRunAnswer, createDuel, finishRun, getDailyLeaderboard, getDuelStatus, joinDuel, startRun,
  type FinishDTO, type PlayableGameDTO, type RunStartDTO,
} from '@/lib/games.functions';

type Phase =
  | { name: 'pick' }
  | { name: 'duel'; subjectId: string }
  | { name: 'loading' }
  | { name: 'play'; subjectId: string; run: RunStartDTO }
  | { name: 'finishing'; subjectId: string; run: RunStartDTO }
  | { name: 'done'; subjectId: string; run: RunStartDTO; result: FinishDTO };

const message = (err: unknown) => (err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');

export function GamePlayer({ game, config }: PlayableGameDTO) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDuel = game.engine === 'duel';
  const isDaily = config['daily'] === true;

  async function begin(subjectId: string) {
    setError(null);
    setNotice(null);
    if (isDuel) { setPhase({ name: 'duel', subjectId }); return; }
    setPhase({ name: 'loading' });
    try {
      const r = await startRun({ data: { slug: game.slug, subjectId } });
      if ('empty' in r) { setNotice(config['source'] ? `${r.message} العب ألعابًا أخرى في هذه المادة أولًا.` : r.message); setPhase({ name: 'pick' }); return; }
      setPhase({ name: 'play', subjectId, run: r });
    } catch (err) {
      setError(message(err));
      setPhase({ name: 'pick' });
    }
  }

  async function startDuel(subjectId: string, join: string | null) {
    setError(null);
    setPhase({ name: 'loading' });
    try {
      const r = join ? await joinDuel({ data: { code: join } }) : await createDuel({ data: { slug: game.slug, subjectId } });
      if ('empty' in r) { setNotice(r.message); setPhase({ name: 'duel', subjectId }); return; }
      setPhase({ name: 'play', subjectId, run: r });
    } catch (err) {
      setError(message(err));
      setPhase({ name: 'duel', subjectId });
    }
  }

  async function onDone(subjectId: string, run: RunStartDTO) {
    setPhase({ name: 'finishing', subjectId, run });
    try {
      const result = await finishRun({ data: { runId: run.runId } });
      await queryClient.invalidateQueries({ queryKey: ['game-sessions'] });
      await queryClient.invalidateQueries({ queryKey: ['game-leaderboard'] });
      setPhase({ name: 'done', subjectId, run, result });
    } catch (err) {
      setError(message(err));
      setPhase({ name: 'pick' });
    }
  }

  if (game.subjects.length === 0) {
    return <EmptyState icon={Clock} title="لا توجد مواد لهذه اللعبة" text="لا توجد مواد مناسبة لصفك وفرعك في هذه اللعبة بعد." />;
  }

  if (phase.name === 'loading' || phase.name === 'finishing') {
    return <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>{phase.name === 'loading' ? 'جارٍ تحميل اللعبة...' : 'جارٍ حساب النتيجة...'}</p></div>;
  }

  if (phase.name === 'pick') {
    return (
      <>
        <section className="game-panel" aria-labelledby="pick-subject">
          <h2 id="pick-subject" className="game-prompt">اختر المادة</h2>
          <div className="game-options">
            {game.subjects.map((s) => <Button key={s.id} variant="outline" className="game-option" onClick={() => void begin(s.id)}>{s.title}</Button>)}
          </div>
          {notice && <p className="quiz-hint" role="status"><Clock size={14} aria-hidden="true" />{notice}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
        </section>
        {isDaily && <Leaderboard slug={game.slug} />}
      </>
    );
  }

  if (phase.name === 'duel') {
    return <DuelLobby onCreate={() => void startDuel(phase.subjectId, null)} onJoin={(code) => void startDuel(phase.subjectId, code)} onBack={() => setPhase({ name: 'pick' })} notice={notice} error={error} />;
  }

  if (phase.name === 'done') {
    return (
      <>
        <Result result={phase.result} config={config} />
        {phase.run.duel && <DuelResult duelId={phase.run.duel.id} code={phase.run.duel.code} />}
        {phase.result.review && <Review rows={phase.result.review} />}
        {isDaily && <Leaderboard slug={game.slug} />}
        <div className="game-actions">
          {!isDaily && !isDuel && <Button onClick={() => void begin(phase.subjectId)}><RotateCcw />العب مرة أخرى</Button>}
          <Button variant="outline" onClick={() => setPhase({ name: 'pick' })}>مادة أخرى</Button>
          <Button variant="ghost" asChild><Link to="/games"><ArrowRight />كل الألعاب</Link></Button>
        </div>
      </>
    );
  }

  const { run, subjectId } = phase;
  const check: CheckFn = (itemId, answer) => checkRunAnswer({ data: { runId: run.runId, ...(itemId !== undefined ? { itemId } : {}), answer } });
  const props: EngineProps = { questions: run.questions, layout: run.layout, config, answered: run.answered, check, onDone: () => void onDone(subjectId, run) };
  const key = run.runId;
  return (
    <>
      {run.duel && <p className="quiz-hint" role="status"><Swords size={14} aria-hidden="true" />رمز التحدي: <strong dir="ltr">{run.duel.code}</strong> — شاركه مع زميلك ليلعب الأسئلة نفسها.</p>}
      {(game.engine === 'choice' || game.engine === 'duel') && <ChoiceGame key={key} {...props} />}
      {game.engine === 'pair' && <PairGame key={key} {...props} />}
      {game.engine === 'order' && <OrderGame key={key} {...props} />}
      {game.engine === 'cards' && <CardsGame key={key} {...props} />}
      {game.engine === 'ladder' && <LadderGame key={key} {...props} />}
      {game.engine === 'map' && <MapGame key={key} {...props} />}
      {game.engine === 'crossword' && <CrosswordGame key={key} {...props} />}
    </>
  );
}

function Result({ result, config }: { result: FinishDTO; config: Record<string, unknown> }) {
  return (
    <div className="quiz-score" role="status">
      <span className="quiz-score-icon"><Trophy /></span>
      <strong>{result.score} من {result.max}</strong>
      <p>{result.percent}% · الزمن {result.seconds} ثانية</p>
      {config['beatBest'] === true && result.compare === 'beat' && <p><Check size={16} aria-hidden="true" /> تجاوزت أفضل نتيجة سابقة ({result.previousBest}%)</p>}
      {config['beatBest'] === true && result.compare === 'not' && <p><X size={16} aria-hidden="true" /> لم تتجاوز أفضل نتيجة سابقة ({result.previousBest}%)</p>}
      {config['beatBest'] === true && result.compare === 'first' && <p>هذه أول نتيجة لك في هذه اللعبة، وستكون الرقم الذي تحاول تجاوزه.</p>}
      <p><Check size={16} aria-hidden="true" /> تم حفظ النتيجة</p>
    </div>
  );
}

/** Mock Exam review: every question with the student's answer and the right one, in words and icons. */
export function Review({ rows }: { rows: NonNullable<FinishDTO['review']> }) {
  return (
    <section aria-labelledby="review-title">
      <h2 id="review-title" className="game-prompt">مراجعة الامتحان</h2>
      <ol className="quiz-questions">
        {rows.map((r, n) => (
          <li key={r.id} className="quiz-question">
            <div className="quiz-review-heading"><span className="quiz-number">{n + 1}</span><h3>{r.prompt}</h3>
              <span className="status-chip">{r.correct ? <><Check size={13} aria-hidden="true" />صحيحة</> : <><X size={13} aria-hidden="true" />{r.chosen === null ? 'لم تُجب' : 'خاطئة'}</>}</span></div>
            <div className="quiz-options">
              {r.options.map((o, i) => {
                const right = i === r.correctIndex;
                const mine = i === r.chosen;
                return (
                  <div key={i} className={`quiz-option ${right ? 'quiz-review-correct' : mine ? 'quiz-review-mine' : ''}`}>
                    <span>{o}</span>
                    {right && <span className="quiz-option-tag"><Check size={14} aria-hidden="true" />الإجابة الصحيحة</span>}
                    {mine && !right && <span className="quiz-option-tag"><X size={14} aria-hidden="true" />إجابتك</span>}
                    {mine && right && <span className="quiz-option-tag">إجابتك</span>}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Leaderboard({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['game-leaderboard', slug], queryFn: () => getDailyLeaderboard({ data: { slug } }) });
  return (
    <section className="game-panel" aria-labelledby="board-title">
      <h2 id="board-title" className="game-prompt">ترتيب صفك اليوم</h2>
      {isLoading && <p className="quiz-hint" role="status">جارٍ التحميل...</p>}
      {data && data.length === 0 && <p className="quiz-hint">لم يلعب أحد تحدّي اليوم بعد.</p>}
      {data && data.length > 0 && (
        <ol className="content-list">
          {data.map((r) => (
            <li className="content-card" key={r.rank}>
              <div><h3>{r.rank}. {r.name}{r.isMe ? ' (أنت)' : ''}</h3><p>{r.score} من {r.maxScore} · {r.seconds} ثانية</p></div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DuelLobby({ onCreate, onJoin, onBack, notice, error }: { onCreate: () => void; onJoin: (code: string) => void; onBack: () => void; notice: string | null; error: string | null }) {
  const [code, setCode] = useState('');
  return (
    <section className="game-panel" aria-labelledby="duel-title">
      <h2 id="duel-title" className="game-prompt">مبارزة بين طالبين</h2>
      <p className="quiz-hint">أنشئ تحديًا وشارك رمزه مع زميلك، أو أدخل الرمز الذي وصلك. يلعب الاثنان الأسئلة نفسها، ويفوز من يحصل على نتيجة أعلى (وعند التعادل الأسرع).</p>
      <div className="game-actions"><Button onClick={onCreate}><Swords />أنشئ تحديًا جديدًا</Button></div>
      <form className="game-ladder-form" onSubmit={(e) => { e.preventDefault(); if (code.trim()) onJoin(code.trim()); }}>
        <label htmlFor="duel-code">أو أدخل رمز التحدي</label>
        <Input id="duel-code" dir="ltr" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" />
        <div className="game-actions"><Button type="submit" variant="outline" disabled={code.trim().length < 6}>انضم</Button><Button type="button" variant="ghost" onClick={onBack}>رجوع</Button></div>
      </form>
      {notice && <p className="quiz-hint" role="status">{notice}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </section>
  );
}

export function DuelResult({ duelId, code }: { duelId: string; code: string }) {
  const { data } = useQuery({
    queryKey: ['game-duel', duelId],
    queryFn: () => getDuelStatus({ data: { duelId } }),
    refetchInterval: (q) => (q.state.data?.outcome ? false : 3000),
  });
  if (!data) return <p className="quiz-hint" role="status">جارٍ تحميل نتيجة التحدي...</p>;
  const { me, opponent, outcome } = data;
  return (
    <section className="game-panel" aria-labelledby="duel-result">
      <h2 id="duel-result" className="game-prompt">نتيجة المبارزة</h2>
      {!data.opponentJoined && <p className="quiz-hint" role="status"><Clock size={14} aria-hidden="true" />لم ينضم أحد بعد. شارك الرمز <strong dir="ltr">{code}</strong> مع زميلك.</p>}
      {data.opponentJoined && !outcome && <p className="quiz-hint" role="status"><Clock size={14} aria-hidden="true" />بانتظار أن ينهي {opponent?.name ?? 'زميلك'} اللعب. تتحدث هذه الصفحة تلقائيًا.</p>}
      <div className="game-columns">
        <div className="content-card"><div><h3>أنت</h3><p>{me.score} من {me.max} · {me.seconds} ثانية</p></div></div>
        {opponent && <div className="content-card"><div><h3>{opponent.name}</h3><p>{opponent.finished ? `${opponent.score} من ${opponent.max} · ${opponent.seconds} ثانية` : 'لم ينهِ بعد'}</p></div></div>}
      </div>
      {outcome && (
        <p className={outcome === 'opponent' ? 'game-feedback game-feedback-bad' : 'game-feedback game-feedback-ok'} role="status">
          {outcome === 'me' ? <><Trophy size={18} aria-hidden="true" />فزت!</> : outcome === 'opponent' ? <><X size={18} aria-hidden="true" />فاز {opponent?.name}</> : <><Check size={18} aria-hidden="true" />تعادل</>}
        </p>
      )}
    </section>
  );
}

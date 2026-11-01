import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Flower2, Lock, LockOpen, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CheckDTO, Json } from '@/lib/games.functions';
import { isValidLadderStep, requeueMissed, streakMultiplier } from '@/lib/games/logic';
import type { ClientQuestion, PublicLayout } from '@/lib/games/rules';

/**
 * Play screens. None of them knows an answer: each one sends the student's answer to the server through `check`
 * and shows the verdict it gets back. The score is calculated by the server when the run is finished.
 */
export type Check = (itemId: string | undefined, answer: Json) => Promise<CheckDTO>;
export type EngineProps = {
  questions: ClientQuestion[];
  layout: PublicLayout;
  config: Record<string, Json>;
  /** ids already answered in a resumed run */
  answered?: string[];
  check: Check;
  onDone: () => void;
};

const num = (v: Json | undefined) => (typeof v === 'number' ? v : null);
const message = (err: unknown) => (err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');

/** Correct / wrong is always an icon plus a word, never colour alone. */
export function Feedback({ ok, answer }: { ok: boolean; answer?: string | undefined }) {
  return (
    <p className={ok ? 'game-feedback game-feedback-ok' : 'game-feedback game-feedback-bad'} role="status">
      {ok ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
      {ok ? 'إجابة صحيحة' : `إجابة خاطئة${answer ? ` — الصحيحة: ${answer}` : ''}`}
    </p>
  );
}

const ErrorLine = ({ text }: { text: string | null }) => (text ? <p className="auth-error" role="alert">{text}</p> : null);

// ---------------------------------------------------------------- choice (also Escape Room, timed sprints)

export function ChoiceGame({ questions, config, answered = [], check, onDone }: EngineProps) {
  const queue = useMemo(() => questions.filter((q): q is Extract<ClientQuestion, { kind: 'choice' }> => q.kind === 'choice' && !answered.includes(q.id)), [questions, answered]);
  const timeLimit = num(config['timeLimit']);
  const rooms = num(config['rooms']);
  const growth = config['growth'] === true;

  const [index, setIndex] = useState(0);
  const [verdict, setVerdict] = useState<{ choice: number; correct: boolean; correctIndex: number | null } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [opened, setOpened] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [left, setLeft] = useState(timeLimit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    if (timeLimit === null) return;
    let remaining = timeLimit;
    const timer = setInterval(() => {
      remaining -= 1;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(timer);
        finish();
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLimit]);

  useEffect(() => {
    if (lockUntil === null) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockUntil) setLockUntil(null);
    }, 500);
    return () => clearInterval(timer);
  }, [lockUntil]);

  useEffect(() => { if (verdict) nextRef.current?.focus(); }, [verdict]);

  const q = queue[index];
  if (!q) return null;
  const locked = lockUntil !== null && lockUntil > now;
  const lockSeconds = locked ? Math.ceil((lockUntil - now) / 1000) : 0;

  async function choose(choice: number) {
    if (verdict || busy || locked || !q) return;
    setBusy(true);
    setError(null);
    try {
      const r = await check(q.id, { choice });
      if (r.locked && r.reveal === undefined && r.itemId === undefined) {
        setLockUntil(Date.now() + r.locked.seconds * 1000);
        setNow(Date.now());
        return;
      }
      const correctIndex = typeof r.reveal?.['correctIndex'] === 'number' ? (r.reveal['correctIndex'] as number) : null;
      setVerdict({ choice, correct: r.correct, correctIndex });
      if (r.correct) setCorrectCount((c) => c + 1);
      if (r.opened !== undefined) setOpened(r.opened);
      if (r.locked) { setLockUntil(Date.now() + r.locked.seconds * 1000); setNow(Date.now()); }
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const last = index + 1 >= queue.length;
    if (last || (rooms !== null && opened >= rooms)) finish();
    else { setIndex(index + 1); setVerdict(null); }
  }

  return (
    <div className="game-panel">
      <div className="game-status" aria-label="حالة اللعبة">
        <span>السؤال {index + 1} من {queue.length}</span>
        <span>الصحيحة: {correctCount}</span>
        {left !== null && <span role="timer" aria-live="off">الوقت المتبقي: {left} ث</span>}
        {rooms !== null && <span>الغرف المفتوحة: {opened} من {rooms}</span>}
      </div>
      {growth && (
        <p className="game-garden" aria-label={`عدد الأزهار ${correctCount}`}>
          {Array.from({ length: correctCount }, (_, i) => <Flower2 key={i} size={26} aria-hidden="true" />)}
          <span>الأزهار: {correctCount}</span>
        </p>
      )}
      <h2 className="game-prompt">{q.prompt}</h2>
      {locked && <p className="game-feedback game-feedback-bad" role="status"><Lock size={18} aria-hidden="true" />الغرفة مقفلة بعد ثلاث إجابات خاطئة متتالية. حاول بعد {lockSeconds} ثانية.</p>}
      <div className="game-options" role="group" aria-label="الخيارات">
        {q.options.map((option, i) => {
          const isPicked = verdict?.choice === i;
          const isRight = verdict !== null && verdict.correctIndex === i;
          const state = !verdict ? '' : isRight ? ' game-option-correct' : isPicked ? ' game-option-wrong' : '';
          return (
            <Button key={i} variant="outline" className={`game-option${state}`} onClick={() => void choose(i)} disabled={busy || locked || (verdict !== null && !isPicked && !isRight)}>
              <span>{option}</span>
              {isRight && <span className="game-tag"><Check size={16} aria-hidden="true" />الصحيحة</span>}
              {isPicked && !isRight && <span className="game-tag"><X size={16} aria-hidden="true" />اختيارك</span>}
            </Button>
          );
        })}
      </div>
      <ErrorLine text={error} />
      {verdict && (
        <>
          <Feedback ok={verdict.correct} answer={verdict.correctIndex !== null ? q.options[verdict.correctIndex] : undefined} />
          {rooms !== null && verdict.correct && <p className="game-feedback" role="status"><LockOpen size={18} aria-hidden="true" />فُتحت الغرفة</p>}
          <Button ref={nextRef} onClick={next} disabled={locked}>{index + 1 >= queue.length || (rooms !== null && opened >= rooms) ? 'إنهاء اللعبة' : 'التالي'}</Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pair (flip / match / assign with drag and drop)

export function PairGame({ questions, layout, config, check, onDone }: EngineProps) {
  const mode = String(config['mode'] ?? 'match') as 'flip' | 'match' | 'assign';
  return mode === 'flip' ? <FlipBoard layout={layout} check={check} onDone={onDone} /> : <MatchBoard questions={questions} layout={layout} mode={mode} check={check} onDone={onDone} />;
}

function FlipBoard({ layout, check, onDone }: Pick<EngineProps, 'layout' | 'check' | 'onDone'>) {
  const cards = layout.flipCards ?? [];
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip(i: number) {
    if (busy || open.length >= 2 || open.includes(i) || matched.has(i)) return;
    const nextOpen = [...open, i];
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;
    setBusy(true);
    try {
      const r = await check(undefined, { a: nextOpen[0]!, b: nextOpen[1]! });
      setMsg({ ok: r.correct });
      if (r.correct) {
        const nextMatched = new Set(matched).add(nextOpen[0]!).add(nextOpen[1]!);
        setMatched(nextMatched);
        setOpen([]);
        if (nextMatched.size === cards.length) onDone();
      } else {
        setMisses((m) => m + 1);
        setTimeout(() => setOpen([]), 900);
      }
    } catch (err) {
      setError(message(err));
      setOpen([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="game-panel">
      <div className="game-status"><span>الأزواج: {matched.size / 2} من {cards.length / 2}</span><span>المحاولات الخاطئة: {misses}</span></div>
      <div className="game-cards">
        {cards.map((c, i) => {
          const done = matched.has(i);
          const shown = done || open.includes(i);
          return (
            <Button key={i} variant="outline" className="game-flip" disabled={done} onClick={() => void flip(i)} aria-label={shown ? c.text : `بطاقة ${i + 1} مقلوبة`}>
              {shown ? c.text : '؟'}{done && <Check size={16} aria-hidden="true" />}
            </Button>
          );
        })}
      </div>
      {msg && <Feedback ok={msg.ok} />}
      <ErrorLine text={error} />
    </div>
  );
}

function MatchBoard({ questions, layout, mode, check, onDone }: Pick<EngineProps, 'questions' | 'layout' | 'check' | 'onDone'> & { mode: 'match' | 'assign' }) {
  const lefts = questions.filter((q): q is Extract<ClientQuestion, { kind: 'pair' }> => q.kind === 'pair');
  const rights = layout.rights ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function place(leftId: string | null, right: string) {
    if (!leftId) {
      setMsg({ ok: false, text: mode === 'assign' ? 'اختر الشكل أولًا ثم الحاوية' : 'اختر العنصر الأول أولًا' });
      return;
    }
    if (busy || done.has(leftId)) return;
    const left = lefts.find((l) => l.id === leftId)!;
    setBusy(true);
    setError(null);
    try {
      const r = await check(leftId, { right });
      if (r.correct) {
        const nextDone = new Set(done).add(leftId);
        setDone(nextDone);
        setMsg({ ok: true, text: `${left.left} ← ${right}` });
        if (nextDone.size === lefts.length) onDone();
      } else {
        setMisses((m) => m + 1);
        setMsg({ ok: false, text: `${left.left} لا يناسب ${right}` });
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
      setSelected(null);
      setDragging(null);
    }
  }

  return (
    <div className="game-panel">
      <div className="game-status"><span>المطابقات: {done.size} من {lefts.length}</span><span>المحاولات الخاطئة: {misses}</span></div>
      <p className="quiz-hint">
        {mode === 'assign' ? 'اسحب الشكل إلى الحاوية المناسبة، أو (بلوحة المفاتيح) اختر الشكل ثم الحاوية.' : 'اختر عنصرًا من القائمة الأولى ثم ما يناسبه من الثانية.'}
      </p>
      <div className="game-columns">
        <div className="game-column" role="group" aria-label="العناصر">
          {lefts.map((p) => (
            <Button
              key={p.id}
              variant={selected === p.id ? 'default' : 'outline'}
              className="game-option"
              disabled={done.has(p.id)}
              aria-pressed={selected === p.id}
              draggable={mode === 'assign' && !done.has(p.id)}
              onDragStart={() => { setDragging(p.id); setSelected(p.id); }}
              onDragEnd={() => setDragging(null)}
              onClick={() => { setSelected(p.id); setMsg(null); }}
            >
              {p.left}{done.has(p.id) && <span className="game-tag"><Check size={16} aria-hidden="true" />تمت</span>}
            </Button>
          ))}
        </div>
        <div className="game-column" role="group" aria-label="الحاويات">
          {rights.map((r) => (
            <Button
              key={r}
              variant="outline"
              className="game-option game-drop"
              onClick={() => void place(selected, r)}
              onDragOver={(e) => { if (mode === 'assign') e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); void place(dragging ?? selected, r); }}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>
      {msg && <Feedback ok={msg.ok} />}
      {msg && <p className="quiz-hint">{msg.text}</p>}
      <ErrorLine text={error} />
    </div>
  );
}

// ---------------------------------------------------------------- order

export function OrderGame({ questions, check, onDone }: EngineProps) {
  const rounds = questions.filter((q): q is Extract<ClientQuestion, { kind: 'order' }> => q.kind === 'order');
  const [round, setRound] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = rounds[round];
  if (!current) return null;
  const answer = placed.map((i) => current.chips[i]!);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const r = await check(current!.id, { sequence: answer });
      setChecked(r.correct);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  function next() {
    if (round + 1 >= rounds.length) { onDone(); return; }
    setRound(round + 1);
    setPlaced([]);
    setChecked(null);
  }

  return (
    <div className="game-panel">
      <div className="game-status"><span>الجولة {round + 1} من {rounds.length}</span></div>
      {current.prompt && <h2 className="game-prompt">{current.prompt}</h2>}
      <p className="quiz-hint">اضغط على العناصر بالترتيب الصحيح. اضغط على عنصر في إجابتك لإزالته.</p>
      <ol className="game-answer" aria-label="إجابتك">
        {placed.length === 0 && <li className="game-answer-empty">لم تختر شيئًا بعد</li>}
        {placed.map((i, pos) => (
          <li key={i}><Button variant="secondary" disabled={checked === true} onClick={() => { setPlaced(placed.filter((p) => p !== i)); setChecked(null); }}><span className="game-pos">{pos + 1}</span>{current.chips[i]}</Button></li>
        ))}
      </ol>
      <div className="game-chips" role="group" aria-label="العناصر المتاحة">
        {current.chips.map((text, i) => ({ text, i })).filter((c) => !placed.includes(c.i)).map((c) => (
          <Button key={c.i} variant="outline" disabled={checked === true} onClick={() => { setPlaced([...placed, c.i]); setChecked(null); }}>{c.text}</Button>
        ))}
      </div>
      {checked !== null && <Feedback ok={checked} />}
      <ErrorLine text={error} />
      <div className="game-actions">
        {checked !== true && <Button onClick={() => void verify()} disabled={busy || placed.length !== current.chips.length}>تحقّق</Button>}
        {checked === true && <Button onClick={next}>{round + 1 >= rounds.length ? 'إنهاء اللعبة' : 'التالي'}</Button>}
        {checked === false && <Button variant="outline" onClick={() => { setPlaced([]); setChecked(null); }}><RotateCcw />ابدأ من جديد</Button>}
        {checked === false && <Button variant="ghost" onClick={next}>تخطَّ هذه الجولة</Button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cards (self-assessed)

export function CardsGame({ questions, config, check, onDone }: EngineProps) {
  const useStreak = config['streak'] === true;
  const repeatMissed = config['repeatMissed'] === true;
  const [queue, setQueue] = useState(() => questions.filter((q): q is Extract<ClientQuestion, { kind: 'card' }> => q.kind === 'card'));
  const [shown, setShown] = useState(false);
  const [streak, setStreak] = useState(0);
  const [requeues, setRequeues] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = queue[0];
  if (!card) return null;

  async function answer(known: boolean) {
    setBusy(true);
    setError(null);
    try {
      await check(card!.id, { known });
      setStreak(known ? streak + 1 : 0);
      let rest = queue.slice(1);
      // A missed card comes round again soon, at most twice, so the game always ends.
      if (!known && repeatMissed && (requeues[card!.id] ?? 0) < 2) {
        rest = requeueMissed(rest, card!);
        setRequeues({ ...requeues, [card!.id]: (requeues[card!.id] ?? 0) + 1 });
      }
      setQueue(rest);
      setShown(false);
      if (rest.length === 0) onDone();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="game-panel">
      <div className="game-status">
        <span>المتبقي: {queue.length}</span>
        {useStreak && <span>التتابع: {streak} · المضاعف ×{streakMultiplier(streak)}</span>}
      </div>
      <div className="game-card" aria-live="polite">
        <h2 className="game-prompt">{card.front}</h2>
        {shown && <p className="game-card-back">{card.back}</p>}
      </div>
      <ErrorLine text={error} />
      {!shown ? (
        <Button onClick={() => setShown(true)}>اعرض الإجابة</Button>
      ) : (
        <div className="game-actions">
          <Button disabled={busy} onClick={() => void answer(true)}><Check />عرفتها</Button>
          <Button disabled={busy} variant="outline" onClick={() => void answer(false)}><X />لم أعرفها</Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ladder

export function LadderGame({ questions, check, onDone }: EngineProps) {
  const ladders = questions.filter((q): q is Extract<ClientQuestion, { kind: 'ladder' }> => q.kind === 'ladder');
  const [round, setRound] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const ladder = ladders[round];
  if (!ladder) return null;
  const current = steps[steps.length - 1] ?? ladder.start;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const word = value.trim();
    if (!isValidLadderStep(current, word, ladder!.words)) {
      setError(word.length !== [...current].length ? 'يجب أن تبقى الكلمة بنفس عدد الحروف.' : 'غيّر حرفًا واحدًا فقط، واكتب كلمة صحيحة.');
      return;
    }
    setError(null);
    const nextSteps = [...steps, word];
    setSteps(nextSteps);
    setValue('');
    if (word.toLowerCase() !== ladder!.target.toLowerCase()) return;
    setBusy(true);
    try {
      const r = await check(ladder!.id, { steps: nextSteps });
      if (r.correct) setSolved(true);
      else setError('لم يقبل الخادم هذا السلّم.');
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  async function end(giveUp: boolean) {
    if (giveUp) {
      setBusy(true);
      try { await check(ladder!.id, { giveUp: true }); } catch (err) { setError(message(err)); setBusy(false); return; }
      setBusy(false);
    }
    if (round + 1 >= ladders.length) { onDone(); return; }
    setRound(round + 1);
    setSteps([]);
    setValue('');
    setSolved(false);
    setError(null);
  }

  return (
    <div className="game-panel">
      <div className="game-status"><span>السلّم {round + 1} من {ladders.length}</span><span>الخطوات: {steps.length}</span></div>
      <p className="game-prompt">من «{ladder.start}» إلى «{ladder.target}»</p>
      <ol className="game-answer" aria-label="خطوات السلّم">
        <li><span className="game-word">{ladder.start}</span></li>
        {steps.map((s, i) => <li key={i}><span className="game-word">{s}</span></li>)}
      </ol>
      {solved ? (
        <>
          <p className="game-feedback game-feedback-ok" role="status"><Check size={18} aria-hidden="true" />وصلت إلى الكلمة الهدف</p>
          <Button onClick={() => void end(false)}>{round + 1 >= ladders.length ? 'إنهاء اللعبة' : 'السلّم التالي'}</Button>
        </>
      ) : (
        <form className="game-ladder-form" onSubmit={(e) => void submit(e)}>
          <label htmlFor="ladder-word">الكلمة التالية (غيّر حرفًا واحدًا)</label>
          <input id="ladder-word" className="game-input" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
          <div className="game-actions">
            <Button type="submit" disabled={busy || !value.trim()}>أضف الخطوة</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void end(true)}>استسلم</Button>
          </div>
          {error && <p className="game-feedback game-feedback-bad" role="alert"><X size={18} aria-hidden="true" />{error}</p>}
        </form>
      )}
    </div>
  );
}

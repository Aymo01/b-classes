import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Flower2, Lock, LockOpen, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameItemDTO } from '@/lib/games.functions';
import {
  isValidLadderStep,
  pairScore,
  requeueMissed,
  sameSequence,
  scoreAnswers,
  shuffle,
  streakMultiplier,
} from '@/lib/games/logic';

/** What an engine hands back when a play ends. The shell adds the time and saves it. */
export type EngineResult = { score: number; max: number; details: Record<string, unknown> };
export type EngineProps = { items: GameItemDTO[]; config: Record<string, unknown>; onFinish: (r: EngineResult) => void };

const num = (v: unknown, fallback: number) => (typeof v === 'number' && v > 0 ? v : fallback);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Correct / wrong is always an icon plus a word, never colour alone. */
function Feedback({ ok, answer }: { ok: boolean; answer?: string | undefined }) {
  return (
    <p className={ok ? 'game-feedback game-feedback-ok' : 'game-feedback game-feedback-bad'} role="status">
      {ok ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
      {ok ? 'إجابة صحيحة' : `إجابة خاطئة${answer ? ` — الصحيحة: ${answer}` : ''}`}
    </p>
  );
}

// ---------------------------------------------------------------- choice

type Choice = { id: string; topic: string | null; prompt: string; options: string[]; correct: number };

function readChoice(item: GameItemDTO): Choice | null {
  const options = strs(item.payload['options']);
  const correct = item.payload['correct'];
  const prompt = str(item.payload['prompt']);
  if (!prompt || options.length < 2 || typeof correct !== 'number' || correct < 0 || correct >= options.length) return null;
  return { id: item.id, topic: item.topic, prompt, options, correct };
}

export function ChoiceGame({ items, config, onFinish }: EngineProps) {
  const questions = useMemo(() => {
    const valid = items.map(readChoice).filter((c): c is Choice => c !== null);
    return shuffle(valid).slice(0, num(config['questionCount'], 10));
  }, [items, config]);
  const timeLimit = typeof config['timeLimit'] === 'number' ? (config['timeLimit'] as number) : null;
  const roomSize = typeof config['roomSize'] === 'number' ? (config['roomSize'] as number) : null;
  const growth = config['growth'] === true;

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [log, setLog] = useState<{ correct: boolean; id: string }[]>([]);
  const [left, setLeft] = useState(timeLimit);
  const finished = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const finish = (entries: { correct: boolean; id: string }[], timedOut = false) => {
    if (finished.current) return;
    finished.current = true;
    const s = scoreAnswers(entries, false);
    onFinish({ score: s.score, max: s.max, details: { answered: entries.length, correct: s.correct, timedOut, wrongItemIds: entries.filter((e) => !e.correct).map((e) => e.id) } });
  };

  const logRef = useRef(log);
  logRef.current = log;
  useEffect(() => {
    if (timeLimit === null) return;
    const timer = setInterval(() => {
      setLeft((l) => {
        if (l === null) return l;
        if (l <= 1) {
          clearInterval(timer);
          finish(logRef.current, true);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLimit]);

  useEffect(() => { if (picked !== null) nextRef.current?.focus(); }, [picked]);

  const q = questions[index];
  if (!q) return null;
  const correctCount = log.filter((l) => l.correct).length;
  const roomUnlocked = roomSize !== null && log.length > 0 && log.length % roomSize === 0 && picked !== null;

  function choose(optionIndex: number) {
    if (picked !== null || !q) return;
    setPicked(optionIndex);
    setLog((l) => [...l, { correct: optionIndex === q.correct, id: q.id }]);
  }
  function next() {
    if (index + 1 >= questions.length) finish(log);
    else {
      setIndex(index + 1);
      setPicked(null);
    }
  }

  return (
    <div className="game-panel">
      <div className="game-status" aria-label="حالة اللعبة">
        <span>السؤال {index + 1} من {questions.length}</span>
        <span>الصحيحة: {correctCount}</span>
        {left !== null && <span role="timer" aria-live="off">الوقت المتبقي: {left} ث</span>}
        {roomSize !== null && <span>الغرفة {Math.floor(index / roomSize) + 1}</span>}
      </div>
      {growth && (
        <p className="game-garden" aria-label={`عدد الأزهار ${correctCount}`}>
          {Array.from({ length: correctCount }, (_, i) => <Flower2 key={i} size={26} aria-hidden="true" />)}
          <span>الأزهار: {correctCount}</span>
        </p>
      )}
      <h2 className="game-prompt">{q.prompt}</h2>
      <div className="game-options" role="group" aria-label="الخيارات">
        {q.options.map((option, i) => {
          const state = picked === null ? '' : i === q.correct ? ' game-option-correct' : i === picked ? ' game-option-wrong' : '';
          return (
            <Button key={i} variant="outline" className={`game-option${state}`} onClick={() => choose(i)} disabled={picked !== null && i !== picked && i !== q.correct}>
              <span>{option}</span>
              {picked !== null && i === q.correct && <span className="game-tag"><Check size={16} aria-hidden="true" />الصحيحة</span>}
              {picked !== null && i === picked && i !== q.correct && <span className="game-tag"><X size={16} aria-hidden="true" />اختيارك</span>}
            </Button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <Feedback ok={picked === q.correct} answer={q.options[q.correct]} />
          {roomSize !== null && roomUnlocked && <p className="game-feedback" role="status"><LockOpen size={18} aria-hidden="true" />فُتحت الغرفة التالية</p>}
          <Button ref={nextRef} onClick={next}>{index + 1 >= questions.length ? 'إنهاء اللعبة' : 'التالي'}</Button>
        </>
      )}
      {roomSize !== null && picked === null && log.length % roomSize !== 0 && <p className="quiz-hint"><Lock size={14} aria-hidden="true" />أجب عن {roomSize - (log.length % roomSize)} أسئلة لفتح الغرفة التالية.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- pair (flip / match / assign)

type Pair = { id: string; left: string; right: string };

function readPair(item: GameItemDTO): Pair | null {
  const left = str(item.payload['left']);
  const right = str(item.payload['right']);
  return left && right ? { id: item.id, left, right } : null;
}

export function PairGame({ items, config, onFinish }: EngineProps) {
  const mode = (str(config['mode']) || 'match') as 'flip' | 'match' | 'assign';
  const pairs = useMemo(() => shuffle(items.map(readPair).filter((p): p is Pair => p !== null)).slice(0, num(config['pairCount'], 6)), [items, config]);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const complete = (doneSet: Set<string>, missCount: number) => {
    if (doneSet.size < pairs.length) return;
    const s = pairScore(pairs.length, missCount);
    onFinish({ score: s.score, max: s.max, details: { misses: missCount, wrongItemIds: [] } });
  };

  if (mode === 'flip') return <FlipBoard pairs={pairs} misses={misses} setMisses={setMisses} done={done} setDone={setDone} complete={complete} message={message} setMessage={setMessage} />;
  return <MatchBoard pairs={pairs} mode={mode} misses={misses} setMisses={setMisses} done={done} setDone={setDone} complete={complete} message={message} setMessage={setMessage} />;
}

type BoardProps = {
  pairs: Pair[];
  misses: number;
  setMisses: (n: number) => void;
  done: Set<string>;
  setDone: (s: Set<string>) => void;
  complete: (done: Set<string>, misses: number) => void;
  message: { ok: boolean; text: string } | null;
  setMessage: (m: { ok: boolean; text: string } | null) => void;
};

function FlipBoard({ pairs, misses, setMisses, done, setDone, complete, message, setMessage }: BoardProps) {
  const cards = useMemo(() => shuffle(pairs.flatMap((p) => [{ key: `${p.id}:l`, pair: p.id, text: p.left }, { key: `${p.id}:r`, pair: p.id, text: p.right }])), [pairs]);
  const [open, setOpen] = useState<string[]>([]);

  function flip(key: string) {
    if (open.length >= 2 || open.includes(key)) return;
    const nextOpen = [...open, key];
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;
    const [a, b] = nextOpen.map((k) => cards.find((c) => c.key === k)!);
    if (a!.pair === b!.pair) {
      const nextDone = new Set(done).add(a!.pair);
      setDone(nextDone);
      setMessage({ ok: true, text: 'تطابقت البطاقتان' });
      setOpen([]);
      complete(nextDone, misses);
    } else {
      setMisses(misses + 1);
      setMessage({ ok: false, text: 'لم تتطابق البطاقتان، حاول مرة أخرى' });
      setTimeout(() => setOpen([]), 900);
    }
  }

  return (
    <div className="game-panel">
      <div className="game-status"><span>الأزواج: {done.size} من {pairs.length}</span><span>المحاولات الخاطئة: {misses}</span></div>
      <div className="game-cards">
        {cards.map((c, i) => {
          const matched = done.has(c.pair);
          const shown = matched || open.includes(c.key);
          return (
            <Button key={c.key} variant="outline" className="game-flip" disabled={matched} onClick={() => flip(c.key)} aria-label={shown ? c.text : `بطاقة ${i + 1} مقلوبة`}>
              {shown ? c.text : '؟'}{matched && <Check size={16} aria-hidden="true" />}
            </Button>
          );
        })}
      </div>
      {message && <Feedback ok={message.ok} />}
    </div>
  );
}

function MatchBoard({ pairs, mode, misses, setMisses, done, setDone, complete, message, setMessage }: BoardProps & { mode: 'match' | 'assign' }) {
  const lefts = useMemo(() => shuffle(pairs), [pairs]);
  const rights = useMemo(() => shuffle([...new Set(pairs.map((p) => p.right))]), [pairs]);
  const [selected, setSelected] = useState<string | null>(null);

  function pickRight(right: string) {
    if (!selected) {
      setMessage({ ok: false, text: mode === 'assign' ? 'اختر الشكل أولًا ثم الحاوية' : 'اختر العنصر الأول أولًا' });
      return;
    }
    const left = pairs.find((p) => p.id === selected)!;
    if (left.right === right) {
      const nextDone = new Set(done).add(left.id);
      setDone(nextDone);
      setMessage({ ok: true, text: `${left.left} ← ${right}` });
      complete(nextDone, misses);
    } else {
      setMisses(misses + 1);
      setMessage({ ok: false, text: `${left.left} لا يناسب ${right}` });
    }
    setSelected(null);
  }

  return (
    <div className="game-panel">
      <div className="game-status"><span>المطابقات: {done.size} من {pairs.length}</span><span>المحاولات الخاطئة: {misses}</span></div>
      <p className="quiz-hint">{mode === 'assign' ? 'اختر الشكل ثم الحاوية المناسبة له.' : 'اختر عنصرًا من القائمة الأولى ثم ما يناسبه من الثانية.'}</p>
      <div className="game-columns">
        <div className="game-column" role="group" aria-label="العناصر">
          {lefts.map((p) => (
            <Button key={p.id} variant={selected === p.id ? 'default' : 'outline'} className="game-option" disabled={done.has(p.id)} aria-pressed={selected === p.id} onClick={() => { setSelected(p.id); setMessage(null); }}>
              {p.left}{done.has(p.id) && <span className="game-tag"><Check size={16} aria-hidden="true" />تمت</span>}
            </Button>
          ))}
        </div>
        <div className="game-column" role="group" aria-label="الخيارات">
          {rights.map((r) => (
            <Button key={r} variant="outline" className="game-option" onClick={() => pickRight(r)}>{r}</Button>
          ))}
        </div>
      </div>
      {message && <Feedback ok={message.ok} />}
      {message && <p className="quiz-hint">{message.text}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- order

type Order = { id: string; prompt: string; sequence: string[] };

function readOrder(item: GameItemDTO): Order | null {
  const sequence = strs(item.payload['sequence']);
  return sequence.length >= 2 ? { id: item.id, prompt: str(item.payload['prompt']), sequence } : null;
}

export function OrderGame({ items, config, onFinish }: EngineProps) {
  const rounds = useMemo(() => shuffle(items.map(readOrder).filter((o): o is Order => o !== null)).slice(0, num(config['questionCount'], 5)), [items, config]);
  const [round, setRound] = useState(0);
  const [log, setLog] = useState<{ correct: boolean; id: string }[]>([]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [firstTry, setFirstTry] = useState(true);
  const current = rounds[round];
  const chips = useMemo(() => (current ? shuffle(current.sequence.map((text, i) => ({ text, i }))) : []), [current]);
  if (!current) return null;

  const answer = placed.map((i) => current.sequence[i]!);

  function check() {
    const ok = sameSequence(answer, current!.sequence);
    setChecked(ok);
    if (!ok) setFirstTry(false);
  }
  function next(ok: boolean) {
    const entries = [...log, { correct: ok && firstTry, id: current!.id }];
    setLog(entries);
    if (round + 1 >= rounds.length) {
      const s = scoreAnswers(entries, false);
      onFinish({ score: s.score, max: s.max, details: { wrongItemIds: entries.filter((e) => !e.correct).map((e) => e.id) } });
      return;
    }
    setRound(round + 1);
    setPlaced([]);
    setChecked(null);
    setFirstTry(true);
  }

  return (
    <div className="game-panel">
      <div className="game-status"><span>الجولة {round + 1} من {rounds.length}</span></div>
      {current.prompt && <h2 className="game-prompt">{current.prompt}</h2>}
      <p className="quiz-hint">اضغط على العناصر بالترتيب الصحيح. اضغط على عنصر في إجابتك لإزالته.</p>
      <ol className="game-answer" aria-label="إجابتك">
        {placed.length === 0 && <li className="game-answer-empty">لم تختر شيئًا بعد</li>}
        {placed.map((i, pos) => (
          <li key={i}><Button variant="secondary" disabled={checked === true} onClick={() => { setPlaced(placed.filter((p) => p !== i)); setChecked(null); }}><span className="game-pos">{pos + 1}</span>{current.sequence[i]}</Button></li>
        ))}
      </ol>
      <div className="game-chips" role="group" aria-label="العناصر المتاحة">
        {chips.filter((c) => !placed.includes(c.i)).map((c) => <Button key={c.i} variant="outline" disabled={checked === true} onClick={() => { setPlaced([...placed, c.i]); setChecked(null); }}>{c.text}</Button>)}
      </div>
      {checked !== null && <Feedback ok={checked} />}
      <div className="game-actions">
        {checked !== true && <Button onClick={check} disabled={placed.length !== current.sequence.length}>تحقّق</Button>}
        {checked === true && <Button onClick={() => next(true)}>{round + 1 >= rounds.length ? 'إنهاء اللعبة' : 'التالي'}</Button>}
        {checked === false && <Button variant="outline" onClick={() => { setPlaced([]); setChecked(null); }}><RotateCcw />ابدأ من جديد</Button>}
        {checked === false && <Button variant="ghost" onClick={() => next(false)}>تخطَّ هذه الجولة</Button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cards

type Card = { id: string; front: string; back: string; topic: string | null };

function readCard(item: GameItemDTO): Card | null {
  const front = str(item.payload['front']);
  const back = str(item.payload['back']);
  return front && back ? { id: item.id, front, back, topic: item.topic } : null;
}

export function CardsGame({ items, config, onFinish }: EngineProps) {
  const useStreak = config['streak'] === true;
  const repeatMissed = config['repeatMissed'] === true;
  const initial = useMemo(() => shuffle(items.map(readCard).filter((c): c is Card => c !== null)).slice(0, num(config['questionCount'], 10)), [items, config]);
  const [queue, setQueue] = useState(initial);
  const [shown, setShown] = useState(false);
  const [log, setLog] = useState<{ correct: boolean; id: string }[]>([]);
  const [requeues, setRequeues] = useState<Record<string, number>>({});
  const streak = (() => { let s = 0; for (const l of log) s = l.correct ? s + 1 : 0; return s; })();
  const card = queue[0];
  if (!card) return null;

  function answer(known: boolean) {
    const entries = [...log, { correct: known, id: card!.id }];
    setLog(entries);
    let rest = queue.slice(1);
    // A missed card comes round again soon, at most twice, so the game always ends.
    if (!known && repeatMissed && (requeues[card!.id] ?? 0) < 2) {
      rest = requeueMissed(rest, card!);
      setRequeues({ ...requeues, [card!.id]: (requeues[card!.id] ?? 0) + 1 });
    }
    setQueue(rest);
    setShown(false);
    if (rest.length === 0) {
      const s = scoreAnswers(entries, useStreak);
      onFinish({ score: s.score, max: s.max, details: { bestStreak: s.bestStreak, wrongItemIds: [] } });
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
      {!shown ? (
        <Button onClick={() => setShown(true)}>اعرض الإجابة</Button>
      ) : (
        <div className="game-actions">
          <Button onClick={() => answer(true)}><Check />عرفتها</Button>
          <Button variant="outline" onClick={() => answer(false)}><X />لم أعرفها</Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ladder

type Ladder = { id: string; start: string; target: string; words: string[] | null };

function readLadder(item: GameItemDTO): Ladder | null {
  const start = str(item.payload['start']);
  const target = str(item.payload['target']);
  const words = strs(item.payload['words']);
  return start && target ? { id: item.id, start, target, words: words.length ? words : null } : null;
}

export function LadderGame({ items, config, onFinish }: EngineProps) {
  const ladders = useMemo(() => shuffle(items.map(readLadder).filter((l): l is Ladder => l !== null)).slice(0, num(config['questionCount'], 3)), [items, config]);
  const [round, setRound] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<{ correct: boolean; id: string }[]>([]);
  const ladder = ladders[round];
  if (!ladder) return null;
  const current = steps[steps.length - 1] ?? ladder.start;
  const solved = current === ladder.target;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const word = value.trim();
    if (!isValidLadderStep(current, word, ladder!.words)) {
      setError(word.length !== [...current].length ? 'يجب أن تبقى الكلمة بنفس عدد الحروف.' : 'غيّر حرفًا واحدًا فقط، واكتب كلمة صحيحة.');
      return;
    }
    setError(null);
    setSteps([...steps, word]);
    setValue('');
  }
  function end(ok: boolean) {
    const entries = [...log, { correct: ok, id: ladder!.id }];
    setLog(entries);
    if (round + 1 >= ladders.length) {
      const s = scoreAnswers(entries, false);
      onFinish({ score: s.score, max: s.max, details: { wrongItemIds: entries.filter((e) => !e.correct).map((e) => e.id) } });
      return;
    }
    setRound(round + 1);
    setSteps([]);
    setValue('');
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
          <Button onClick={() => end(true)}>{round + 1 >= ladders.length ? 'إنهاء اللعبة' : 'السلّم التالي'}</Button>
        </>
      ) : (
        <form className="game-ladder-form" onSubmit={submit}>
          <label htmlFor="ladder-word">الكلمة التالية (غيّر حرفًا واحدًا)</label>
          <input id="ladder-word" className="game-input" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
          <div className="game-actions">
            <Button type="submit" disabled={!value.trim()}>أضف الخطوة</Button>
            <Button type="button" variant="ghost" onClick={() => end(false)}>استسلم</Button>
          </div>
          {error && <p className="game-feedback game-feedback-bad" role="alert"><X size={18} aria-hidden="true" />{error}</p>}
        </form>
      )}
    </div>
  );
}

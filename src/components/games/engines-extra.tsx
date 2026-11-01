import { useMemo, useRef, useState } from 'react';
import { Check, Crosshair, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Feedback, type EngineProps } from '@/components/games/engines';
import type { ClientQuestion } from '@/lib/games/rules';

const message = (err: unknown) => (err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
const clamp = (v: number) => Math.min(100, Math.max(0, v));

// ---------------------------------------------------------------- Map Hunt

type Verdict = { correct: boolean; target: { x: number; y: number } | null };

/** Click (or touch) the map to place the marker, or focus the map and use the arrow keys; then confirm. */
export function MapGame({ questions, check, onDone }: EngineProps) {
  const places = questions.filter((q): q is Extract<ClientQuestion, { kind: 'place' }> => q.kind === 'place');
  const [round, setRound] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const place = places[round];
  if (!place) return null;

  function onClick(e: React.MouseEvent) {
    if (verdict || !box.current) return;
    const r = box.current.getBoundingClientRect();
    setPos({ x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) });
  }
  function onKey(e: React.KeyboardEvent) {
    if (verdict) return;
    const step = e.shiftKey ? 8 : 2;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = delta[e.key];
    if (d) {
      e.preventDefault();
      setPos((p) => ({ x: clamp((p?.x ?? 50) + d[0]), y: clamp((p?.y ?? 50) + d[1]) }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void confirm();
    }
  }
  async function confirm() {
    if (!pos || busy || verdict) return;
    setBusy(true);
    setError(null);
    try {
      const r = await check(place!.id, { x: pos.x, y: pos.y });
      const rx = r.reveal?.['x'];
      const ry = r.reveal?.['y'];
      setVerdict({ correct: r.correct, target: typeof rx === 'number' && typeof ry === 'number' ? { x: rx, y: ry } : null });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  function next() {
    if (round + 1 >= places.length) { onDone(); return; }
    setRound(round + 1);
    setPos(null);
    setVerdict(null);
  }

  return (
    <div className="game-panel">
      <div className="game-status"><span>المكان {round + 1} من {places.length}</span></div>
      <h2 className="game-prompt">أين يقع: {place.prompt}؟</h2>
      <p className="quiz-hint">اضغط على الخريطة، أو انتقل إليها بلوحة المفاتيح واستخدم الأسهم لتحريك العلامة (Shift للخطوة الأكبر) ثم Enter.</p>
      <div
        ref={box}
        dir="ltr"
        className="game-map"
        role="group"
        tabIndex={0}
        aria-label={`خريطة للبحث عن ${place.prompt}`}
        onClick={onClick}
        onKeyDown={onKey}
      >
        <img src={place.mapUrl} alt="" draggable={false} />
        {pos && <span className="game-marker" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} aria-hidden="true"><Crosshair /></span>}
        {verdict?.target && <span className="game-marker game-marker-target" style={{ left: `${verdict.target.x}%`, top: `${verdict.target.y}%` }} aria-hidden="true"><Check /></span>}
      </div>
      {pos && !verdict && <p className="quiz-hint">العلامة عند {Math.round(pos.x)}٪ أفقيًا و{Math.round(pos.y)}٪ عموديًا.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {verdict && <Feedback ok={verdict.correct} />}
      {verdict && !verdict.correct && <p className="quiz-hint"><X size={14} aria-hidden="true" />العلامة الخضراء ✓ تبيّن المكان الصحيح.</p>}
      <div className="game-actions">
        {!verdict && <Button onClick={() => void confirm()} disabled={!pos || busy}>تأكيد المكان</Button>}
        {verdict && <Button onClick={next}>{round + 1 >= places.length ? 'إنهاء اللعبة' : 'التالي'}</Button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Crossword

type WordState = 'idle' | 'right' | 'wrong';

export function CrosswordGame({ layout, check, onDone }: EngineProps) {
  const puzzle = layout.crossword;
  const entries = useMemo(() => puzzle?.entries ?? [], [puzzle]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<Record<string, WordState>>({});
  const [checkedOnce, setCheckedOnce] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Letters shown in the grid come from what the student typed in each clue's box.
  const grid = useMemo(() => {
    const cells = new Map<string, { letter: string; number: number | null }>();
    for (const e of entries) {
      const letters = [...(values[e.id] ?? '')];
      for (let i = 0; i < e.length; i++) {
        const key = `${e.row + (e.dir === 'down' ? i : 0)},${e.col + (e.dir === 'across' ? i : 0)}`;
        const prev = cells.get(key);
        cells.set(key, { letter: letters[i] ?? prev?.letter ?? '', number: i === 0 ? e.number : (prev?.number ?? null) });
      }
    }
    return cells;
  }, [entries, values]);

  if (!puzzle || entries.length === 0) return null;

  async function checkAll() {
    setBusy(true);
    setError(null);
    try {
      const nextState = { ...state };
      const seen = new Set(checkedOnce);
      for (const e of entries) {
        const word = (values[e.id] ?? '').trim();
        if (nextState[e.id] === 'right' || [...word].length !== e.length) continue;
        const r = await check(e.id, { word });
        nextState[e.id] = r.correct ? 'right' : 'wrong';
        seen.add(e.id);
      }
      setState(nextState);
      setCheckedOnce(seen);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  const allChecked = entries.every((e) => checkedOnce.has(e.id));
  const rightCount = entries.filter((e) => state[e.id] === 'right').length;

  return (
    <div className="game-panel">
      <div className="game-status"><span>الكلمات الصحيحة: {rightCount} من {entries.length}</span></div>
      <div className="game-crossword" dir="ltr" style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 40px)` }} aria-hidden="true">
        {Array.from({ length: puzzle.rows * puzzle.cols }, (_, n) => {
          const r = Math.floor(n / puzzle.cols);
          const c = n % puzzle.cols;
          const cell = grid.get(`${r},${c}`);
          return cell ? <span key={n} className="game-cell">{cell.number && <small>{cell.number}</small>}{cell.letter}</span> : <span key={n} className="game-cell game-cell-empty" />;
        })}
      </div>
      <ul className="game-clues">
        {entries.map((e) => (
          <li key={e.id}>
            <label htmlFor={`cw-${e.id}`}>{e.number}. {e.dir === 'across' ? 'أفقي' : 'عمودي'} — {e.clue} ({e.length} حروف)</label>
            <input
              id={`cw-${e.id}`}
              className="game-input"
              value={values[e.id] ?? ''}
              maxLength={e.length}
              disabled={state[e.id] === 'right'}
              onChange={(ev) => { setValues({ ...values, [e.id]: ev.target.value }); if (state[e.id] === 'wrong') setState({ ...state, [e.id]: 'idle' }); }}
              autoComplete="off"
            />
            {state[e.id] === 'right' && <span className="game-feedback game-feedback-ok"><Check size={16} aria-hidden="true" />صحيحة</span>}
            {state[e.id] === 'wrong' && <span className="game-feedback game-feedback-bad" role="status"><X size={16} aria-hidden="true" />خاطئة، جرّب مرة أخرى</span>}
          </li>
        ))}
      </ul>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="game-actions">
        <Button onClick={() => void checkAll()} disabled={busy}>تحقّق من الكلمات</Button>
        <Button variant="outline" onClick={onDone} disabled={!allChecked}>إنهاء اللعبة</Button>
      </div>
      {!allChecked && <p className="quiz-hint">اكتب كل الكلمات ثم اضغط «تحقّق» لتتمكن من الإنهاء.</p>}
    </div>
  );
}

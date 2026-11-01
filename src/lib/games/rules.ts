/**
 * Server-side game rules, kept free of I/O so they can be tested. The server picks the questions, checks every
 * answer, records the result and scores the run; the browser only ever sends the student's answers.
 */
import { buildCrossword, type PlacedWord } from '@/lib/games/crossword';
import { POINTS_PER_ANSWER, isValidLadderStep, pairScore, scoreAnswers, shuffle, weakestTopic, type GameRow } from '@/lib/games/logic';

export type ItemKind = 'choice' | 'pair' | 'order' | 'card' | 'ladder' | 'word' | 'place';
export type ItemStatus = 'draft' | 'approved' | 'rejected';
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type ItemRow = {
  id: string;
  subjectId: string;
  kind: ItemKind;
  topic: string | null;
  qtype: string | null;
  payload: Record<string, Json>;
  status: ItemStatus;
};

/** The one filter between the question bank and a student: drafts and rejected questions never pass. */
export const approvedOnly = <T extends { status: ItemStatus }>(items: readonly T[]): T[] => items.filter((i) => i.status === 'approved');

// ---------------------------------------------------------------- payload validation (teacher edits and AI output)

const text = (v: unknown, max = 500): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim().length > 0);
const len = (s: string) => [...s.trim()].length;

/** Returns an Arabic message describing the first problem, or null when the payload is playable. */
export function validatePayload(kind: ItemKind, p: Record<string, unknown>): string | null {
  switch (kind) {
    case 'choice': {
      if (!text(p['prompt'])) return 'نص السؤال مطلوب.';
      const options = p['options'];
      if (!strings(options) || options.length < 2 || options.length > 6) return 'يجب أن يكون للسؤال من 2 إلى 6 خيارات.';
      if (new Set(options.map((o) => o.trim())).size !== options.length) return 'الخيارات يجب ألا تتكرر.';
      const c = p['correct'];
      if (!Number.isInteger(c) || (c as number) < 0 || (c as number) >= options.length) return 'رقم الإجابة الصحيحة غير صالح.';
      return null;
    }
    case 'pair':
      return text(p['left'], 120) && text(p['right'], 120) ? null : 'العنصران مطلوبان.';
    case 'order': {
      const s = p['sequence'];
      if (!strings(s) || s.length < 2 || s.length > 12) return 'يجب أن يحتوي الترتيب على 2 إلى 12 عنصرًا.';
      if (new Set(s.map((x) => x.trim())).size !== s.length) return 'عناصر الترتيب يجب ألا تتكرر.';
      return p['prompt'] === undefined || typeof p['prompt'] === 'string' ? null : 'نص السؤال غير صالح.';
    }
    case 'card':
      return text(p['front'], 300) && text(p['back'], 300) ? null : 'وجها البطاقة مطلوبان.';
    case 'ladder': {
      if (!text(p['start'], 20) || !text(p['target'], 20)) return 'كلمتا البداية والهدف مطلوبتان.';
      if (len(p['start']) !== len(p['target'])) return 'يجب أن تتساوى الكلمتان في عدد الحروف.';
      const words = p['words'];
      if (words !== undefined && (!strings(words) || words.some((w) => len(w) !== len(p['start'] as string)))) return 'كلمات السلّم يجب أن تتساوى في عدد الحروف.';
      return null;
    }
    case 'word':
      if (!text(p['word'], 14) || /\s/.test(p['word'] as string) || len(p['word'] as string) < 2) return 'الكلمة مطلوبة (حرفان على الأقل ودون مسافات).';
      return text(p['clue'], 300) ? null : 'التلميح مطلوب.';
    case 'place': {
      if (!text(p['prompt'])) return 'اسم المكان مطلوب.';
      if (!text(p['mapUrl'], 500) || !/^(https:\/\/|\/)/.test(p['mapUrl'] as string)) return 'رابط الخريطة غير صالح.';
      const { x, y, radius } = p as Record<string, unknown>;
      if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 100 || y < 0 || y > 100) return 'إحداثيات المكان يجب أن تكون بين 0 و100.';
      return typeof radius === 'number' && radius >= 1 && radius <= 50 ? null : 'نصف قطر الإصابة يجب أن يكون بين 1 و50.';
    }
  }
}

/** Reads the JSON array an AI model returns and keeps only the items that pass validation. */
export function parseGeneratedItems(kind: ItemKind, raw: string): { items: { topic: string | null; payload: Record<string, Json> }[]; rejected: number } {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) return { items: [], rejected: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { items: [], rejected: 0 };
  }
  if (!Array.isArray(parsed)) return { items: [], rejected: 0 };
  const items: { topic: string | null; payload: Record<string, Json> }[] = [];
  let rejected = 0;
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) { rejected++; continue; }
    const { topic, ...payload } = entry as Record<string, unknown>;
    if (validatePayload(kind, payload) !== null) { rejected++; continue; }
    items.push({ topic: typeof topic === 'string' && topic.trim() ? topic.trim() : null, payload: payload as Record<string, Json> });
  }
  return { items, rejected };
}

// ---------------------------------------------------------------- what the browser is allowed to see

export type ClientQuestion =
  | { id: string; kind: 'choice'; prompt: string; options: string[] }
  | { id: string; kind: 'pair'; left: string }
  | { id: string; kind: 'order'; prompt: string; chips: string[] }
  | { id: string; kind: 'card'; front: string; back: string }
  | { id: string; kind: 'ladder'; start: string; target: string; words: string[] | null }
  | { id: string; kind: 'word'; clue: string }
  | { id: string; kind: 'place'; prompt: string; mapUrl: string };

export type PublicLayout = {
  /** match / assign: the possible right-hand answers, shuffled */
  rights?: string[];
  /** flip: the cards by position; which two belong together is known only to the server */
  flipCards?: { text: string }[];
  crossword?: { rows: number; cols: number; entries: { id: string; number: number; row: number; col: number; dir: 'across' | 'down'; length: number; clue: string }[] };
};
export type PrivateLayout = { flip?: { itemId: string; side: 'l' | 'r' }[] };

const s = (v: unknown) => (typeof v === 'string' ? v : '');

/** Shuffle that never returns the original order (so an "order" game is never already solved). */
function shuffledDifferent(values: string[], seed: number): string[] {
  const out = shuffle(values, seed);
  if (values.length > 1 && out.every((v, i) => v === values[i])) out.push(out.shift()!);
  return out;
}

export function toClientQuestion(item: ItemRow, seed: number): ClientQuestion {
  const p = item.payload;
  switch (item.kind) {
    case 'choice':
      return { id: item.id, kind: 'choice', prompt: s(p['prompt']), options: p['options'] as string[] };
    case 'pair':
      return { id: item.id, kind: 'pair', left: s(p['left']) };
    case 'order':
      return { id: item.id, kind: 'order', prompt: s(p['prompt']), chips: shuffledDifferent(p['sequence'] as string[], seed) };
    case 'card':
      return { id: item.id, kind: 'card', front: s(p['front']), back: s(p['back']) };
    case 'ladder': {
      const words = p['words'] as string[] | undefined;
      return { id: item.id, kind: 'ladder', start: s(p['start']), target: s(p['target']), words: words && words.length ? words : null };
    }
    case 'word':
      return { id: item.id, kind: 'word', clue: s(p['clue']) };
    case 'place':
      return { id: item.id, kind: 'place', prompt: s(p['prompt']), mapUrl: s(p['mapUrl']) };
  }
}

export type RunPlan = { items: ItemRow[]; questions: ClientQuestion[]; publicLayout: PublicLayout; privateLayout: PrivateLayout };

/** Builds what a run needs from the chosen (already approved) items, for the game's engine. */
export function planRun(game: Pick<GameRow, 'engine' | 'config'>, chosen: ItemRow[], seed: number): RunPlan {
  const mode = game.config['mode'];
  if (game.engine === 'crossword') {
    const placed = buildCrossword(chosen.map((i) => ({ id: i.id, word: s(i.payload['word']), clue: s(i.payload['clue']) })));
    const byId = new Map(chosen.map((i) => [i.id, i]));
    const items = placed.entries.map((e) => byId.get(e.id)!);
    return {
      items,
      questions: items.map((i) => toClientQuestion(i, seed)),
      publicLayout: { crossword: { rows: placed.rows, cols: placed.cols, entries: placed.entries.map(({ word: _word, ...rest }) => rest) } },
      privateLayout: {},
    };
  }
  const questions = chosen.map((i, n) => toClientQuestion(i, seed + n));
  if (game.engine === 'pair' && mode === 'flip') {
    const cards = shuffle(chosen.flatMap((i) => [{ itemId: i.id, side: 'l' as const, text: s(i.payload['left']) }, { itemId: i.id, side: 'r' as const, text: s(i.payload['right']) }]), seed);
    return { items: chosen, questions: [], publicLayout: { flipCards: cards.map((c) => ({ text: c.text })) }, privateLayout: { flip: cards.map(({ itemId, side }) => ({ itemId, side })) } };
  }
  if (game.engine === 'pair') {
    return { items: chosen, questions, publicLayout: { rights: shuffle([...new Set(chosen.map((i) => s(i.payload['right'])))], seed) }, privateLayout: {} };
  }
  return { items: chosen, questions, publicLayout: {}, privateLayout: {} };
}

// ---------------------------------------------------------------- checking one answer

export type CheckResult = { correct: boolean; reveal?: Record<string, Json> };

const norm = (v: string) => v.trim().toLowerCase();

/** Whether `answer` is right for `item`. Returns null when the answer has the wrong shape (the caller rejects it). */
export function checkAnswer(item: ItemRow, answer: unknown): CheckResult | null {
  const a = (typeof answer === 'object' && answer !== null ? answer : {}) as Record<string, unknown>;
  const p = item.payload;
  switch (item.kind) {
    case 'choice': {
      if (!Number.isInteger(a['choice']) || (a['choice'] as number) < 0 || (a['choice'] as number) >= (p['options'] as string[]).length) return null;
      return { correct: a['choice'] === p['correct'], reveal: { correctIndex: p['correct'] as number } };
    }
    case 'pair':
      return typeof a['right'] === 'string' ? { correct: a['right'] === p['right'] } : null;
    case 'order': {
      if (!strings(a['sequence'])) return null;
      const seq = p['sequence'] as string[];
      const given = a['sequence'];
      return { correct: given.length === seq.length && given.every((x, i) => x === seq[i]) };
    }
    case 'card':
      return typeof a['known'] === 'boolean' ? { correct: a['known'] } : null;
    case 'ladder': {
      if (a['giveUp'] === true) return { correct: false };
      if (!strings(a['steps']) || a['steps'].length === 0) return null;
      const words = (p['words'] as string[] | undefined) ?? null;
      let from = s(p['start']);
      for (const step of a['steps']) {
        if (!isValidLadderStep(from, step, words)) return { correct: false };
        from = step.trim();
      }
      return { correct: norm(from) === norm(s(p['target'])) };
    }
    case 'word':
      return typeof a['word'] === 'string' ? { correct: norm(a['word']) === norm(s(p['word'])) } : null;
    case 'place': {
      if (typeof a['x'] !== 'number' || typeof a['y'] !== 'number') return null;
      const r = typeof p['radius'] === 'number' ? p['radius'] : 6;
      const hit = Math.hypot(a['x'] - (p['x'] as number), a['y'] - (p['y'] as number)) <= r;
      return { correct: hit, reveal: { x: p['x'] as number, y: p['y'] as number, radius: r } };
    }
  }
}

/** Flip memory: two card positions, resolved with the private layout. */
export function checkFlip(layout: PrivateLayout, a: unknown, b: unknown): { correct: boolean; itemId: string } | null {
  const cards = layout.flip;
  if (!cards || !Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  const first = cards[a as number];
  const second = cards[b as number];
  if (!first || !second) return null;
  return { correct: first.itemId === second.itemId && first.side !== second.side, itemId: first.itemId };
}

// ---------------------------------------------------------------- run state: events, lock, time

export type RunEvent = { itemId: string; correct: boolean; a?: Json; at: string };

export type LockState = { wrongStreak: number; lockedUntil: number | null };

/** Escape Room: three wrong answers in a row lock the room for a minute; a correct answer resets the streak. */
export function escapeStep(state: LockState, correct: boolean, now: number, cfg: { maxWrong: number; lockMs: number }): LockState {
  if (correct) return { wrongStreak: 0, lockedUntil: null };
  const wrongStreak = state.wrongStreak + 1;
  return wrongStreak >= cfg.maxWrong ? { wrongStreak: 0, lockedUntil: now + cfg.lockMs } : { wrongStreak, lockedUntil: state.lockedUntil };
}

export const isLocked = (state: LockState, now: number) => state.lockedUntil !== null && state.lockedUntil > now;
export const lockSecondsLeft = (state: LockState, now: number) => (state.lockedUntil === null ? 0 : Math.max(0, Math.ceil((state.lockedUntil - now) / 1000)));

/** A timed game accepts answers until the limit plus a short grace for network delay. */
export const withinTime = (startedAt: number, now: number, limitSeconds: number, graceSeconds = 3) => now <= startedAt + (limitSeconds + graceSeconds) * 1000;

/** Escape Room: how many doors are open (one per correct answer, capped at the room count). */
export const roomsOpened = (events: readonly RunEvent[], rooms: number) => Math.min(rooms, events.filter((e) => e.correct).length);

// ---------------------------------------------------------------- scoring a finished run

const cfgNum = (config: Record<string, unknown>, key: string) => (typeof config[key] === 'number' ? (config[key] as number) : null);

export type Scored = { score: number; max: number; correct: number; wrongItemIds: string[]; bestStreak?: number };

/** Why a set of answers cannot be accepted for this run, or null. Answers must belong to the run's question list. */
export function validateEvents(game: Pick<GameRow, 'engine' | 'config'>, itemIds: readonly string[], events: readonly RunEvent[]): string | null {
  const allowed = new Set(itemIds);
  if (events.length === 0) return 'لم تُجب عن أي سؤال.';
  if (events.some((e) => !allowed.has(e.itemId))) return 'الإجابات لا تطابق أسئلة اللعبة.';
  const answered = new Set(events.map((e) => e.itemId));
  const partialOk = cfgNum(game.config, 'timeLimit') !== null || cfgNum(game.config, 'rooms') !== null;
  if (game.engine === 'choice' && events.length !== answered.size) return 'سؤال أُجيب عنه أكثر من مرة.';
  if (!partialOk && itemIds.some((id) => !answered.has(id))) return 'لم تُجب عن كل الأسئلة بعد.';
  if (game.engine === 'pair' && itemIds.some((id) => !events.some((e) => e.itemId === id && e.correct))) return 'لم تكمل كل المطابقات بعد.';
  return null;
}

export function scoreRun(game: Pick<GameRow, 'engine' | 'config'>, itemIds: readonly string[], events: readonly RunEvent[]): Scored {
  const wrong = [...new Set(events.filter((e) => !e.correct).map((e) => e.itemId))];
  if (game.engine === 'pair') {
    const misses = events.filter((e) => !e.correct).length;
    const { score, max } = pairScore(itemIds.length, misses);
    return { score, max, correct: itemIds.length, wrongItemIds: [] };
  }
  if (game.engine === 'cards') {
    const r = scoreAnswers(events.map((e) => ({ correct: e.correct })), game.config['streak'] === true);
    return { score: r.score, max: r.max, correct: r.correct, wrongItemIds: [], bestStreak: r.bestStreak };
  }
  const rooms = cfgNum(game.config, 'rooms');
  if (rooms !== null) {
    // Escape Room: each open door is worth 10; wrong answers cost nothing but time and the lock.
    const opened = roomsOpened(events, rooms);
    return { score: opened * POINTS_PER_ANSWER, max: rooms * POINTS_PER_ANSWER, correct: opened, wrongItemIds: wrong };
  }
  // One point value per question: the first try decides (a retry in order / ladder / crossword scores nothing).
  const first = new Map<string, boolean>();
  for (const e of events) if (!first.has(e.itemId)) first.set(e.itemId, e.correct);
  const timed = cfgNum(game.config, 'timeLimit') !== null;
  const count = timed ? first.size : itemIds.length;
  const correct = [...first.values()].filter(Boolean).length;
  return { score: correct * POINTS_PER_ANSWER, max: count * POINTS_PER_ANSWER, correct, wrongItemIds: wrong };
}

// ---------------------------------------------------------------- daily challenge, mistakes, best, duel

/** Calendar day in Palestine (Asia/Hebron), as YYYY-MM-DD. */
export const dayKey = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hebron', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const hash = (value: string) => {
  let h = 2166136261;
  for (const ch of value) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
};

/** The same set for everyone on the same day and subject: ordering by id first makes it independent of row order. */
export function dailyPick<T extends { id: string }>(items: readonly T[], seedKey: string, count: number): T[] {
  return shuffle([...items].sort((a, b) => a.id.localeCompare(b.id)), hash(seedKey)).slice(0, count);
}

/** Question ids the student got wrong, most recent first, without repeats. */
export function mistakeIds(sessions: readonly { wrongItemIds?: string[] | undefined }[], max = 50): string[] {
  const seen = new Set<string>();
  for (const sess of sessions) for (const id of sess.wrongItemIds ?? []) if (seen.size < max) seen.add(id);
  return [...seen];
}

/** Items for the weakest topic: the topic with the most wrong answers, among approved questions only. */
export function weakSpotItems(wrongItems: readonly ItemRow[], pool: readonly ItemRow[]): { topic: string | null; items: ItemRow[] } {
  const topic = weakestTopic(wrongItems);
  return { topic, items: topic ? approvedOnly(pool).filter((i) => i.topic === topic) : [] };
}

export function compareToBest(percent: number, previousBest: number | null): 'first' | 'beat' | 'not' {
  if (previousBest === null) return 'first';
  return percent > previousBest ? 'beat' : 'not';
}

export type DuelSide = { score: number; seconds: number };
/** Higher score wins; equal scores go to the faster player; equal on both is a draw. */
export function duelOutcome(me: DuelSide, opponent: DuelSide): 'me' | 'opponent' | 'draw' {
  if (me.score !== opponent.score) return me.score > opponent.score ? 'me' : 'opponent';
  if (me.seconds !== opponent.seconds) return me.seconds < opponent.seconds ? 'me' : 'opponent';
  return 'draw';
}

export type { PlacedWord };

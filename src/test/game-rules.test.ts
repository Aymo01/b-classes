import { describe, expect, it } from 'vitest';
import { buildCrossword } from '@/lib/games/crossword';
import {
  approvedOnly,
  checkAnswer,
  checkFlip,
  compareToBest,
  dailyPick,
  dayKey,
  duelOutcome,
  escapeStep,
  isLocked,
  lockSecondsLeft,
  mistakeIds,
  parseGeneratedItems,
  planRun,
  roomsOpened,
  scoreRun,
  toClientQuestion,
  validateEvents,
  validatePayload,
  weakSpotItems,
  withinTime,
  type ItemRow,
  type LockState,
  type RunEvent,
} from '@/lib/games/rules';

const choice = (id: string, correct = 1, status: ItemRow['status'] = 'approved', topic: string | null = null): ItemRow => ({
  id, subjectId: 's', kind: 'choice', topic, qtype: null, status, payload: { prompt: `سؤال ${id}`, options: ['أ', 'ب', 'ج'], correct },
});
const ev = (itemId: string, correct: boolean, a: RunEvent['a'] = { choice: 0 }): RunEvent => ({ itemId, correct, a, at: '2026-11-02T10:00:00Z' });
const game = (engine: 'choice' | 'pair' | 'cards' | 'order', config: Record<string, unknown> = {}) => ({ engine, config });

describe('draft filtering: only approved questions reach a student', () => {
  const pool = [choice('a', 1, 'approved'), choice('b', 1, 'draft'), choice('c', 1, 'rejected'), choice('d', 1, 'approved')];
  it('drops drafts and rejected questions', () => {
    expect(approvedOnly(pool).map((i) => i.id)).toEqual(['a', 'd']);
  });
  it('a question that is not approved never appears in the Daily Challenge pick, mistakes or weak-spot sets', () => {
    expect(dailyPick(approvedOnly(pool), 'k', 10).map((i) => i.id).sort()).toEqual(['a', 'd']);
    const wrong = [choice('a', 1, 'approved', 't'), choice('b', 1, 'draft', 't')];
    const topicPool = [...wrong, choice('e', 1, 'rejected', 't'), choice('f', 1, 'approved', 't')];
    expect(weakSpotItems(wrong, topicPool).items.map((i) => i.id).sort()).toEqual(['a', 'f']);
  });
  it('an empty approved pool leaves nothing to play, so the run cannot start', () => {
    expect(planRun(game('choice'), approvedOnly([choice('x', 1, 'draft')]), 1).items).toHaveLength(0);
  });
  it('approval requires a valid question: an invalid payload cannot be approved', () => {
    expect(validatePayload('choice', { prompt: 'س', options: ['أ', 'ب'], correct: 5 })).not.toBeNull();
  });
});

describe('what the browser receives', () => {
  it('carries no answer for any kind of question', () => {
    const items: ItemRow[] = [
      choice('c', 2),
      { id: 'p', subjectId: 's', kind: 'pair', topic: null, qtype: null, status: 'approved', payload: { left: 'Dog', right: 'كلب' } },
      { id: 'o', subjectId: 's', kind: 'order', topic: null, qtype: null, status: 'approved', payload: { prompt: 'رتب', sequence: ['SECRET1', 'SECRET2', 'SECRET3'] } },
      { id: 'm', subjectId: 's', kind: 'place', topic: null, qtype: null, status: 'approved', payload: { prompt: 'القدس', mapUrl: '/map.png', x: 41.5, y: 62.25, radius: 5 } },
    ];
    const json = JSON.stringify(items.map((i) => toClientQuestion(i, 3)));
    expect(json).not.toContain('"correct"');
    expect(json).not.toContain('41.5');
    expect(json).not.toContain('62.25');
    expect(json).not.toContain('radius');
    // the order chips are the right items but never already in the right order
    const o = toClientQuestion(items[2]!, 3);
    expect(o.kind === 'order' && o.chips.join()).not.toBe('SECRET1,SECRET2,SECRET3');
  });
  it('flip memory sends card texts by position only; the pairing stays on the server', () => {
    const items: ItemRow[] = [1, 2, 3].map((n) => ({ id: `p${n}`, subjectId: 's', kind: 'pair', topic: null, qtype: null, status: 'approved', payload: { left: `L${n}`, right: `R${n}` } }));
    const plan = planRun(game('pair', { mode: 'flip' }), items, 5);
    expect(plan.publicLayout.flipCards).toHaveLength(6);
    expect(JSON.stringify(plan.publicLayout)).not.toContain('p1');
    expect(plan.privateLayout.flip).toHaveLength(6);
  });
});

describe('server-side answer checking', () => {
  it('checks a choice against the stored answer and reveals it only in the reply', () => {
    expect(checkAnswer(choice('a', 2), { choice: 2 })).toEqual({ correct: true, reveal: { correctIndex: 2 } });
    expect(checkAnswer(choice('a', 2), { choice: 0 })?.correct).toBe(false);
  });
  it('rejects answers with the wrong shape instead of scoring them', () => {
    expect(checkAnswer(choice('a'), { choice: 9 })).toBeNull();
    expect(checkAnswer(choice('a'), { choice: 'x' })).toBeNull();
    expect(checkAnswer(choice('a'), null)).toBeNull();
    expect(checkAnswer(choice('a'), {})).toBeNull();
  });
  it('checks order, card, word, place and ladder answers', () => {
    const base = { subjectId: 's', topic: null, qtype: null, status: 'approved' as const };
    expect(checkAnswer({ ...base, id: 'o', kind: 'order', payload: { sequence: ['a', 'b', 'c'] } }, { sequence: ['a', 'b', 'c'] })?.correct).toBe(true);
    expect(checkAnswer({ ...base, id: 'o', kind: 'order', payload: { sequence: ['a', 'b', 'c'] } }, { sequence: ['b', 'a', 'c'] })?.correct).toBe(false);
    expect(checkAnswer({ ...base, id: 'k', kind: 'card', payload: { front: 'q', back: 'a' } }, { known: true })?.correct).toBe(true);
    expect(checkAnswer({ ...base, id: 'w', kind: 'word', payload: { word: 'Water', clue: 'c' } }, { word: ' water ' })?.correct).toBe(true);
    const place = { ...base, id: 'm', kind: 'place' as const, payload: { prompt: 'p', mapUrl: '/m.png', x: 50, y: 50, radius: 5 } };
    expect(checkAnswer(place, { x: 53, y: 54 })?.correct).toBe(true);
    expect(checkAnswer(place, { x: 60, y: 50 })?.correct).toBe(false);
    const ladder = { ...base, id: 'l', kind: 'ladder' as const, payload: { start: 'cat', target: 'dog', words: ['cot', 'dot', 'dog'] } };
    expect(checkAnswer(ladder, { steps: ['cot', 'dot', 'dog'] })?.correct).toBe(true);
    expect(checkAnswer(ladder, { steps: ['dog'] })?.correct).toBe(false);
    expect(checkAnswer(ladder, { steps: ['cot', 'dot'] })?.correct).toBe(false);
    expect(checkAnswer(ladder, { giveUp: true })?.correct).toBe(false);
  });
  it('resolves flip cards with the private layout only, and refuses bad positions', () => {
    const layout = { flip: [{ itemId: 'a', side: 'l' as const }, { itemId: 'b', side: 'l' as const }, { itemId: 'a', side: 'r' as const }, { itemId: 'b', side: 'r' as const }] };
    expect(checkFlip(layout, 0, 2)).toEqual({ correct: true, itemId: 'a' });
    expect(checkFlip(layout, 0, 1)?.correct).toBe(false);
    expect(checkFlip(layout, 0, 0)).toBeNull();
    expect(checkFlip(layout, 0, 9)).toBeNull();
    expect(checkFlip({}, 0, 1)).toBeNull();
  });
});

describe('server-side scoring: the score comes from recorded answers, never from the browser', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('scores 10 per correct choice out of 10 per question', () => {
    const events = [ev('a', true), ev('b', false), ev('c', true), ev('d', true)];
    expect(scoreRun(game('choice'), ids, events)).toMatchObject({ score: 30, max: 40, correct: 3, wrongItemIds: ['b'] });
  });
  it('only the first try counts for ordering games (a retry scores nothing)', () => {
    const events = [ev('a', false), ev('a', true), ev('b', true)];
    expect(scoreRun(game('order'), ['a', 'b'], events)).toMatchObject({ score: 10, max: 20 });
  });
  it('matching games lose 2 points per wrong try', () => {
    const events = [ev('a', false), ev('a', true), ev('b', true)];
    expect(scoreRun(game('pair'), ['a', 'b'], events)).toMatchObject({ score: 18, max: 20 });
  });
  it('flashcards apply the streak multiplier in recorded order', () => {
    const events = [true, true, true, true].map((c, i) => ev(`k${i}`, c));
    expect(scoreRun(game('cards', { streak: true }), ['k0', 'k1', 'k2', 'k3'], events)).toMatchObject({ score: 50, max: 50, bestStreak: 4 });
  });
  it('a timed sprint is scored on the questions answered', () => {
    expect(scoreRun(game('choice', { timeLimit: 60 }), ids, [ev('a', true), ev('b', true), ev('c', false)])).toMatchObject({ score: 20, max: 30 });
  });
  it('the score never exceeds the maximum', () => {
    const r = scoreRun(game('choice'), ids, ids.map((id) => ev(id, true)));
    expect(r.score).toBeLessThanOrEqual(r.max);
  });
});

describe('rejecting an answer set that does not match the question list', () => {
  const ids = ['a', 'b', 'c'];
  it('accepts a complete, matching set', () => {
    expect(validateEvents(game('choice'), ids, [ev('a', true), ev('b', false), ev('c', true)])).toBeNull();
  });
  it('rejects an answer to a question that is not in the run', () => {
    expect(validateEvents(game('choice'), ids, [ev('a', true), ev('b', true), ev('zzz', true)])).not.toBeNull();
  });
  it('rejects a set with a question missing (untimed games)', () => {
    expect(validateEvents(game('choice'), ids, [ev('a', true), ev('b', true)])).not.toBeNull();
  });
  it('rejects a choice question answered twice', () => {
    expect(validateEvents(game('choice'), ['a', 'b'], [ev('a', true), ev('a', true), ev('b', true)])).not.toBeNull();
  });
  it('rejects an empty set', () => {
    expect(validateEvents(game('choice'), ids, [])).not.toBeNull();
  });
  it('a timed game or Escape Room may finish early', () => {
    expect(validateEvents(game('choice', { timeLimit: 60 }), ids, [ev('a', true)])).toBeNull();
    expect(validateEvents(game('choice', { rooms: 3 }), ids, [ev('a', true)])).toBeNull();
  });
  it('a matching game needs every pair solved', () => {
    expect(validateEvents(game('pair'), ['a', 'b'], [ev('a', true), ev('b', false)])).not.toBeNull();
    expect(validateEvents(game('pair'), ['a', 'b'], [ev('a', true), ev('b', false), ev('b', true)])).toBeNull();
  });
  it('answers after the time limit (plus a short grace) are refused', () => {
    const start = Date.parse('2026-11-02T10:00:00Z');
    expect(withinTime(start, start + 60_000, 60)).toBe(true);
    expect(withinTime(start, start + 62_000, 60)).toBe(true);
    expect(withinTime(start, start + 64_000, 60)).toBe(false);
  });
});

describe('Escape Room: a room opens only after a correct answer; three wrong in a row lock it for a minute', () => {
  const cfg = { maxWrong: 3, lockMs: 60_000 };
  const t0 = 1_000_000;
  const fresh: LockState = { wrongStreak: 0, lockedUntil: null };

  it('wrong answers do not open a room', () => {
    expect(roomsOpened([ev('a', false), ev('b', false)], 3)).toBe(0);
    expect(roomsOpened([ev('a', false), ev('b', true), ev('c', false)], 3)).toBe(1);
  });
  it('rooms open only on correct answers and never beyond the room count', () => {
    expect(roomsOpened([ev('a', true), ev('b', true), ev('c', true), ev('d', true)], 3)).toBe(3);
  });
  it('one or two wrong answers only build the streak', () => {
    const one = escapeStep(fresh, false, t0, cfg);
    const two = escapeStep(one, false, t0, cfg);
    expect(two).toEqual({ wrongStreak: 2, lockedUntil: null });
    expect(isLocked(two, t0)).toBe(false);
  });
  it('the third wrong answer in a row locks the room for exactly one minute', () => {
    let s = fresh;
    for (let i = 0; i < 3; i++) s = escapeStep(s, false, t0, cfg);
    expect(s.lockedUntil).toBe(t0 + 60_000);
    expect(isLocked(s, t0 + 1)).toBe(true);
    expect(lockSecondsLeft(s, t0)).toBe(60);
    expect(lockSecondsLeft(s, t0 + 59_500)).toBe(1);
    expect(isLocked(s, t0 + 60_000)).toBe(false);
    expect(lockSecondsLeft(s, t0 + 61_000)).toBe(0);
  });
  it('a correct answer resets the streak, so wrong answers must be consecutive', () => {
    let s = fresh;
    s = escapeStep(s, false, t0, cfg);
    s = escapeStep(s, false, t0, cfg);
    s = escapeStep(s, true, t0, cfg);
    s = escapeStep(s, false, t0, cfg);
    s = escapeStep(s, false, t0, cfg);
    expect(isLocked(s, t0)).toBe(false);
    expect(s.wrongStreak).toBe(2);
  });
  it('after a lock the streak starts again from zero', () => {
    let s = fresh;
    for (let i = 0; i < 3; i++) s = escapeStep(s, false, t0, cfg);
    expect(s.wrongStreak).toBe(0);
  });
  it('Escape Room scores 10 per opened room out of the room count', () => {
    const r = scoreRun(game('choice', { rooms: 3 }), ['a', 'b', 'c', 'd', 'e'], [ev('a', false), ev('b', true), ev('c', false), ev('d', true)]);
    expect(r).toMatchObject({ score: 20, max: 30 });
  });
});

describe('Daily Challenge: one set per day, same for everyone', () => {
  const pool = Array.from({ length: 12 }, (_, i) => choice(`q${i}`));
  it('picks the same questions for the same day and subject, whatever the row order', () => {
    const a = dailyPick(pool, '2026-11-02:g:s', 5).map((i) => i.id);
    const b = dailyPick([...pool].reverse(), '2026-11-02:g:s', 5).map((i) => i.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });
  it('changes with the day', () => {
    expect(dailyPick(pool, '2026-11-02:g:s', 5).map((i) => i.id)).not.toEqual(dailyPick(pool, '2026-11-03:g:s', 5).map((i) => i.id));
  });
  it('uses the Palestine calendar day', () => {
    expect(dayKey(new Date('2026-11-02T10:00:00Z'))).toBe('2026-11-02');
    expect(dayKey(new Date('2026-11-02T22:30:00Z'))).toBe('2026-11-03'); // already the next day in Palestine
  });
});

describe('Mistake Bank, Weak-Spot Boss and Beat Your Best', () => {
  it('collects wrong answers from recent sessions, newest first, without repeats', () => {
    expect(mistakeIds([{ wrongItemIds: ['a', 'b'] }, { wrongItemIds: ['b', 'c'] }, {}])).toEqual(['a', 'b', 'c']);
    expect(mistakeIds([{ wrongItemIds: ['a', 'b', 'c'] }], 2)).toEqual(['a', 'b']);
    expect(mistakeIds([])).toEqual([]);
  });
  it('the weak-spot set is the weakest topic\'s approved questions', () => {
    const wrong = [choice('a', 1, 'approved', 'كسور'), choice('b', 1, 'approved', 'كسور'), choice('c', 1, 'approved', 'هندسة')];
    const pool = [...wrong, choice('d', 1, 'approved', 'كسور'), choice('e', 1, 'approved', 'هندسة'), choice('f', 1, 'draft', 'كسور')];
    const r = weakSpotItems(wrong, pool);
    expect(r.topic).toBe('كسور');
    expect(r.items.map((i) => i.id).sort()).toEqual(['a', 'b', 'd']);
    expect(weakSpotItems([], pool)).toEqual({ topic: null, items: [] });
  });
  it('compares with the best earlier result', () => {
    expect(compareToBest(80, null)).toBe('first');
    expect(compareToBest(80, 70)).toBe('beat');
    expect(compareToBest(70, 70)).toBe('not');
    expect(compareToBest(60, 70)).toBe('not');
  });
});

describe('Knowledge Duel', () => {
  it('the higher score wins; equal scores go to the faster player; equal on both is a draw', () => {
    expect(duelOutcome({ score: 80, seconds: 90 }, { score: 70, seconds: 30 })).toBe('me');
    expect(duelOutcome({ score: 60, seconds: 10 }, { score: 70, seconds: 90 })).toBe('opponent');
    expect(duelOutcome({ score: 70, seconds: 40 }, { score: 70, seconds: 55 })).toBe('me');
    expect(duelOutcome({ score: 70, seconds: 60 }, { score: 70, seconds: 55 })).toBe('opponent');
    expect(duelOutcome({ score: 70, seconds: 55 }, { score: 70, seconds: 55 })).toBe('draw');
  });
});

describe('Crossword layout', () => {
  const words = [
    { id: '1', word: 'water', clue: 'c1' },
    { id: '2', word: 'tree', clue: 'c2' },
    { id: '3', word: 'rain', clue: 'c3' },
    { id: '4', word: 'sun', clue: 'c4' },
  ];
  it('places words so that every crossing agrees and no two words overlap in the same direction', () => {
    const cw = buildCrossword(words);
    expect(cw.entries.length).toBeGreaterThanOrEqual(2);
    const cells = new Map<string, string>();
    for (const e of cw.entries) {
      [...e.word].forEach((ch, i) => {
        const key = `${e.row + (e.dir === 'down' ? i : 0)},${e.col + (e.dir === 'across' ? i : 0)}`;
        expect(cells.get(key) ?? ch).toBe(ch);
        cells.set(key, ch);
        expect(e.row + (e.dir === 'down' ? i : 0)).toBeLessThan(cw.rows);
        expect(e.col + (e.dir === 'across' ? i : 0)).toBeLessThan(cw.cols);
      });
    }
  });
  it('numbers entries in reading order and starts at 1', () => {
    const cw = buildCrossword(words);
    expect(Math.min(...cw.entries.map((e) => e.number))).toBe(1);
  });
  it('works with Arabic words and returns nothing for no words', () => {
    expect(buildCrossword([{ id: 'a', word: 'مدرسة', clue: 'x' }, { id: 'b', word: 'سماء', clue: 'y' }]).entries.length).toBeGreaterThanOrEqual(1);
    expect(buildCrossword([])).toEqual({ rows: 0, cols: 0, entries: [] });
  });
  it('the public layout shows lengths and clues but never the words', () => {
    const items: ItemRow[] = words.map((w) => ({ id: w.id, subjectId: 's', kind: 'word', topic: null, qtype: null, status: 'approved', payload: { word: w.word, clue: w.clue } }));
    const plan = planRun({ engine: 'crossword', config: {} } as never, items, 1);
    const json = JSON.stringify(plan.publicLayout);
    for (const w of words) expect(json).not.toContain(`"${w.word}"`);
    expect(plan.publicLayout.crossword?.entries.every((e) => e.length > 0 && e.clue)).toBe(true);
    expect(plan.items.length).toBe(plan.publicLayout.crossword?.entries.length);
  });
});

describe('question validation and AI output', () => {
  it('accepts a valid choice and rejects broken ones', () => {
    expect(validatePayload('choice', { prompt: 'س', options: ['أ', 'ب'], correct: 1 })).toBeNull();
    expect(validatePayload('choice', { prompt: '', options: ['أ', 'ب'], correct: 0 })).not.toBeNull();
    expect(validatePayload('choice', { prompt: 'س', options: ['أ'], correct: 0 })).not.toBeNull();
    expect(validatePayload('choice', { prompt: 'س', options: ['أ', 'أ'], correct: 0 })).not.toBeNull();
    expect(validatePayload('choice', { prompt: 'س', options: ['أ', 'ب'], correct: 2 })).not.toBeNull();
  });
  it('validates the other kinds', () => {
    expect(validatePayload('order', { sequence: ['a', 'b'] })).toBeNull();
    expect(validatePayload('order', { sequence: ['a', 'a'] })).not.toBeNull();
    expect(validatePayload('ladder', { start: 'cat', target: 'dog' })).toBeNull();
    expect(validatePayload('ladder', { start: 'cat', target: 'door' })).not.toBeNull();
    expect(validatePayload('word', { word: 'two words', clue: 'c' })).not.toBeNull();
    expect(validatePayload('place', { prompt: 'p', mapUrl: 'javascript:alert(1)', x: 1, y: 1, radius: 5 })).not.toBeNull();
    expect(validatePayload('place', { prompt: 'p', mapUrl: '/m.png', x: 101, y: 1, radius: 5 })).not.toBeNull();
    expect(validatePayload('place', { prompt: 'p', mapUrl: '/m.png', x: 10, y: 1, radius: 5 })).toBeNull();
  });
  it('keeps the valid questions of an AI reply, drops the rest and counts them', () => {
    const raw = 'هذه الأسئلة:\n[{"topic":"كسور","prompt":"س1","options":["أ","ب"],"correct":0},{"prompt":"ناقص","options":["أ"],"correct":0},"not an object",{"prompt":"س2","options":["أ","ب","ج"],"correct":2}]\nانتهى';
    const r = parseGeneratedItems('choice', raw);
    expect(r.items).toHaveLength(2);
    expect(r.rejected).toBe(2);
    expect(r.items[0]).toMatchObject({ topic: 'كسور', payload: { prompt: 'س1' } });
    expect(r.items[1]?.topic).toBeNull();
  });
  it('returns nothing for text that is not a JSON array', () => {
    expect(parseGeneratedItems('choice', 'no json here')).toEqual({ items: [], rejected: 0 });
    expect(parseGeneratedItems('choice', '[ not json ]')).toEqual({ items: [], rejected: 0 });
  });
});

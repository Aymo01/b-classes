import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireApprovedMember } from '@/lib/access/middleware';
import {
  branchesForGrade,
  gamesForStudent,
  isPlayable,
  shuffle,
  subjectsForGame,
  subjectsForStudent,
  type BranchRow,
  type GameEngine,
  type GameRow,
  type SubjectRow,
} from '@/lib/games/logic';
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
  planRun,
  roomsOpened,
  scoreRun,
  validateEvents,
  weakSpotItems,
  withinTime,
  type CheckResult,
  type ClientQuestion,
  type ItemKind,
  type ItemRow,
  type Json,
  type PrivateLayout,
  type PublicLayout,
  type RunEvent,
} from '@/lib/games/rules';

export type { Json };

// The games tables are not in the generated Supabase types until the migration is applied, so they are read untyped.
type Db = SupabaseClient;
const db = (client: unknown) => client as Db;
/** Service-role client: the only way to read questions with answers and to write runs and scores. */
async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin as unknown as Db;
}

export type GameCardDTO = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  engine: GameEngine;
  playable: boolean;
  subjects: { id: string; title: string }[];
};

export type GameMenuDTO = {
  grade: number | null;
  branch: { id: string; title: string } | null;
  /** Grades 10-12 must pick a branch before subjects can be shown. */
  needsBranch: boolean;
  branches: { id: string; title: string }[];
  games: GameCardDTO[];
};

type StudentCtx = { grade: number | null; branchId: string | null; branchSlug: string | null; branches: BranchRow[] };

/* eslint-disable @typescript-eslint/no-explicit-any */
const toGame = (r: any): GameRow => ({
  id: r.id, slug: r.slug, title: r.title, description: r.description, icon: r.icon, engine: r.engine, config: r.config ?? {},
  minGrade: r.min_grade, maxGrade: r.max_grade, branchSlugs: r.branch_slugs, categories: r.categories, sortOrder: r.sort_order, active: r.active,
});
const toSubject = (r: any): SubjectRow => ({ id: r.id, title: r.title, grade: r.grade, branchId: r.branch_id ?? null, category: r.category ?? null });
const toBranch = (r: any): BranchRow => ({ id: r.id, slug: r.slug, title: r.title, minGrade: r.min_grade, maxGrade: r.max_grade });
const toItem = (r: any): ItemRow => ({ id: r.id, subjectId: r.subject_id, kind: r.kind, topic: r.topic, qtype: r.qtype, payload: r.payload, status: r.status });
/* eslint-enable @typescript-eslint/no-explicit-any */

async function loadStudent(client: Db, userId: string): Promise<StudentCtx> {
  const [{ data: profile }, { data: branchRows }] = await Promise.all([
    client.from('profiles').select('grade, branch_id').eq('id', userId).maybeSingle(),
    client.from('branches').select('id, slug, title, min_grade, max_grade').order('sort_order'),
  ]);
  const branches = (branchRows ?? []).map(toBranch);
  const grade: number | null = profile?.grade ?? null;
  // A branch left over from another grade (a student who moved from 10 to 11) does not count until they pick again.
  const branch = branchesForGrade(branches, grade).find((b) => b.id === profile?.branch_id);
  return { grade, branchId: branch?.id ?? null, branchSlug: branch?.slug ?? null, branches };
}

async function loadSubjects(client: Db, grade: number | null, branchId: string | null) {
  if (!grade) return [];
  const { data } = await client.from('subjects').select('id, title, grade, branch_id, category').eq('grade', grade).order('title');
  return subjectsForStudent((data ?? []).map(toSubject), grade, branchId);
}

/** The single gate for every game request: the game exists, is on for this student's grade and branch, and the
 *  subject belongs to that game. Used by the play page, starting a run, creating or joining a duel, the leaderboard. */
async function authorize(client: Db, userId: string, slug: string, subjectId?: string) {
  const student = await loadStudent(client, userId);
  const { data: row } = await client.from('games').select('*').eq('slug', slug).maybeSingle();
  if (!row) throw new Error('اللعبة غير موجودة');
  const game = toGame(row);
  if (!gamesForStudent([game], student.grade, student.branchSlug).length) throw new Error('هذه اللعبة غير متاحة لصفك.');
  const subjects = subjectsForGame(game, await loadSubjects(client, student.grade, student.branchId));
  if (subjectId !== undefined && !subjects.some((s) => s.id === subjectId)) throw new Error('هذه المادة غير متاحة في هذه اللعبة.');
  return { student, game, subjects };
}

export const getGameMenu = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<GameMenuDTO> => {
    const client = db(context.supabase);
    const student = await loadStudent(client, context.userId);
    const needsBranch = !!student.grade && student.grade >= 10 && !student.branchId;
    const branches = branchesForGrade(student.branches, student.grade).map((b) => ({ id: b.id, title: b.title }));
    const branch = student.branches.find((b) => b.id === student.branchId);
    if (needsBranch || !student.grade) return { grade: student.grade, branch: null, needsBranch, branches, games: [] };
    const [{ data: gameRows }, subjects] = await Promise.all([
      client.from('games').select('*').eq('active', true),
      loadSubjects(client, student.grade, student.branchId),
    ]);
    const games = gamesForStudent((gameRows ?? []).map(toGame), student.grade, student.branchSlug).map((g) => ({
      id: g.id, slug: g.slug, title: g.title, description: g.description, icon: g.icon, engine: g.engine, playable: isPlayable(g.engine),
      subjects: subjectsForGame(g, subjects).map((s) => ({ id: s.id, title: s.title })),
    }));
    return { grade: student.grade, branch: branch ? { id: branch.id, title: branch.title } : null, needsBranch: false, branches, games };
  });

export const setMyBranch = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { branchId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = db(context.supabase);
    const student = await loadStudent(client, context.userId);
    if (!branchesForGrade(student.branches, student.grade).some((b) => b.id === data.branchId)) throw new Error('هذا الفرع غير متاح لصفك.');
    const { error } = await client.from('profiles').update({ branch_id: data.branchId }).eq('id', context.userId);
    if (error) throw new Error('تعذر حفظ الفرع. حاول مرة أخرى.');
    return { ok: true };
  });

export type PlayableGameDTO = { game: GameCardDTO; config: Record<string, Json> };

export const getGame = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }): Promise<PlayableGameDTO> => {
    const { game, subjects } = await authorize(db(context.supabase), context.userId, data.slug);
    return {
      config: game.config as Record<string, Json>,
      game: { id: game.id, slug: game.slug, title: game.title, description: game.description, icon: game.icon, engine: game.engine, playable: isPlayable(game.engine), subjects: subjects.map((s) => ({ id: s.id, title: s.title })) },
    };
  });

// ---------------------------------------------------------------- starting a run

const kindFor: Record<GameEngine, ItemKind> = { choice: 'choice', pair: 'pair', order: 'order', cards: 'card', ladder: 'ladder', crossword: 'word', map: 'place', duel: 'choice' };
const countFor = (game: GameRow) => {
  const c = game.config;
  const n = (k: string) => (typeof c[k] === 'number' ? (c[k] as number) : null);
  return n('questionCount') ?? n('pairCount') ?? n('wordCount') ?? (game.engine === 'ladder' ? 3 : game.engine === 'order' ? 5 : 10);
};

export type RunStartDTO = {
  runId: string;
  questions: ClientQuestion[];
  layout: PublicLayout;
  /** question ids already answered (a resumed daily challenge) */
  answered: string[];
  duel: { id: string; code: string } | null;
};
export type EmptyDTO = { empty: true; message: string };

/** Approved questions only: this is the one place game_items is read for play. */
async function approvedItems(a: Db, subjectId: string, kind: ItemKind): Promise<ItemRow[]> {
  const { data } = await a.from('game_items').select('*').eq('subject_id', subjectId).eq('kind', kind).eq('status', 'approved');
  return approvedOnly((data ?? []).map(toItem));
}

async function chooseItems(a: Db, userId: string, game: GameRow, subjectId: string): Promise<ItemRow[]> {
  const pool = await approvedItems(a, subjectId, kindFor[game.engine]);
  const count = countFor(game);
  const source = game.config['source'];
  if (source === 'mistakes' || source === 'weakest') {
    const { data: sessions } = await a.from('game_sessions').select('details').eq('student_id', userId).eq('subject_id', subjectId).order('played_at', { ascending: false }).limit(30);
    const ids = mistakeIds((sessions ?? []).map((s) => s.details as { wrongItemIds?: string[] }));
    const wrong = pool.filter((i) => ids.includes(i.id));
    if (source === 'mistakes') return shuffle(wrong, Date.now()).slice(0, count);
    return shuffle(weakSpotItems(wrong, pool).items, Date.now()).slice(0, count);
  }
  if (game.config['daily'] === true) return dailyPick(pool, `${dayKey(new Date())}:${game.id}:${subjectId}`, count);
  // A crossword drops words that cannot cross, so offer a few extra.
  return shuffle(pool, Date.now()).slice(0, game.engine === 'crossword' ? count + 4 : count);
}

async function createRun(a: Db, userId: string, game: GameRow, subjectId: string, items: ItemRow[], extra: { duelId?: string; daily?: boolean } = {}): Promise<RunStartDTO> {
  const plan = planRun(game, items, Date.now());
  if (plan.items.length === 0 || (game.engine === 'crossword' && plan.items.length < 2)) throw new Error('NO_CONTENT');
  const { data: run, error } = await a.from('game_runs').insert({
    student_id: userId, game_id: game.id, subject_id: subjectId, item_ids: plan.items.map((i) => i.id), layout: plan.privateLayout,
    duel_id: extra.duelId ?? null, daily: extra.daily ?? false,
  }).select('id').single();
  if (error || !run) throw new Error('تعذر بدء اللعبة. حاول مرة أخرى.');
  return { runId: run.id, questions: plan.questions, layout: plan.publicLayout, answered: [], duel: null };
}

const noContent = (err: unknown): EmptyDTO | null =>
  err instanceof Error && err.message === 'NO_CONTENT'
    ? { empty: true, message: 'لا توجد أسئلة معتمدة لهذه اللعبة في هذه المادة بعد. يضيفها المعلم ويعتمدها، وستظهر هنا.' }
    : null;

export const startRun = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { slug: string; subjectId: string }) => input)
  .handler(async ({ data, context }): Promise<RunStartDTO | EmptyDTO> => {
    const { game } = await authorize(db(context.supabase), context.userId, data.slug, data.subjectId);
    if (game.engine === 'duel') throw new Error('هذه اللعبة تبدأ بإنشاء تحدٍّ أو الانضمام إليه.');
    const a = await admin();
    const daily = game.config['daily'] === true;
    try {
      if (daily) {
        const { data: existing } = await a.from('game_runs').select('*').eq('student_id', context.userId).eq('game_id', game.id).eq('play_date', dayKey(new Date())).eq('daily', true).maybeSingle();
        if (existing?.finished_at) throw new Error('لعبت تحدّي اليوم بالفعل. عُد غدًا لمجموعة جديدة.');
        if (existing) {
          const { data: rows } = await a.from('game_items').select('*').in('id', existing.item_ids);
          const byId = new Map(approvedOnly((rows ?? []).map(toItem)).map((i) => [i.id, i]));
          const ordered = (existing.item_ids as string[]).map((id) => byId.get(id)).filter((i): i is ItemRow => !!i);
          const plan = planRun(game, ordered, Date.now());
          return { runId: existing.id, questions: plan.questions, layout: plan.publicLayout, answered: ((existing.events ?? []) as RunEvent[]).map((e) => e.itemId), duel: null };
        }
      }
      return await createRun(a, context.userId, game, data.subjectId, await chooseItems(a, context.userId, game, data.subjectId), { daily });
    } catch (err) {
      const empty = noContent(err);
      if (empty) return empty;
      throw err;
    }
  });

// ---------------------------------------------------------------- checking answers

type RunRow = {
  id: string; student_id: string; game_id: string; subject_id: string; item_ids: string[]; layout: PrivateLayout | null; events: RunEvent[];
  wrong_streak: number; locked_until: string | null; duel_id: string | null; started_at: string; finished_at: string | null;
};

async function loadRun(a: Db, userId: string, runId: string): Promise<{ run: RunRow; game: GameRow; items: ItemRow[] }> {
  const { data: run } = await a.from('game_runs').select('*').eq('id', runId).maybeSingle();
  if (!run || run.student_id !== userId) throw new Error('الجولة غير موجودة.');
  const [{ data: gameRow }, { data: itemRows }] = await Promise.all([
    a.from('games').select('*').eq('id', run.game_id).single(),
    a.from('game_items').select('*').in('id', run.item_ids),
  ]);
  return { run: run as RunRow, game: toGame(gameRow), items: approvedOnly((itemRows ?? []).map(toItem)) };
}

export type CheckDTO = { correct: boolean; reveal?: Record<string, Json>; locked?: { seconds: number }; opened?: number; itemId?: string };

export const checkRunAnswer = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { runId: string; itemId?: string; answer: Json }) => input)
  .handler(async ({ data, context }): Promise<CheckDTO> => {
    const a = await admin();
    const { run, game, items } = await loadRun(a, context.userId, data.runId);
    if (run.finished_at) throw new Error('انتهت هذه الجولة.');
    const now = Date.now();
    const limit = typeof game.config['timeLimit'] === 'number' ? (game.config['timeLimit'] as number) : null;
    if (limit !== null && !withinTime(Date.parse(run.started_at), now, limit)) throw new Error('انتهى الوقت.');

    const rooms = typeof game.config['rooms'] === 'number' ? (game.config['rooms'] as number) : null;
    const lock = { wrongStreak: run.wrong_streak, lockedUntil: run.locked_until ? Date.parse(run.locked_until) : null };
    if (rooms !== null && isLocked(lock, now)) return { correct: false, locked: { seconds: lockSecondsLeft(lock, now) } };
    if (rooms !== null && roomsOpened(run.events, rooms) >= rooms) throw new Error('فُتحت كل الغرف.');

    let result: CheckResult | null;
    let itemId = data.itemId;
    if (game.engine === 'pair' && game.config['mode'] === 'flip') {
      const ans = data.answer as { a?: unknown; b?: unknown };
      const flip = checkFlip(run.layout ?? {}, ans.a, ans.b);
      if (!flip) throw new Error('إجابة غير صالحة.');
      result = { correct: flip.correct };
      itemId = flip.itemId;
    } else {
      const item = items.find((i) => i.id === itemId);
      if (!item) throw new Error('الإجابة لا تطابق أسئلة اللعبة.');
      if (game.engine === 'choice' && run.events.some((e) => e.itemId === item.id)) throw new Error('أجبت عن هذا السؤال من قبل.');
      result = checkAnswer(item, data.answer);
    }
    if (!result || !itemId) throw new Error('إجابة غير صالحة.');

    const events: RunEvent[] = [...run.events, { itemId, correct: result.correct, a: data.answer, at: new Date(now).toISOString() }];
    const next = rooms !== null
      ? escapeStep(lock, result.correct, now, { maxWrong: Number(game.config['maxWrong'] ?? 3), lockMs: Number(game.config['lockSeconds'] ?? 60) * 1000 })
      : lock;
    await a.from('game_runs').update({ events, wrong_streak: next.wrongStreak, locked_until: next.lockedUntil ? new Date(next.lockedUntil).toISOString() : null }).eq('id', run.id);
    return {
      correct: result.correct,
      itemId,
      ...(result.reveal ? { reveal: result.reveal } : {}),
      ...(rooms !== null ? { opened: roomsOpened(events, rooms), ...(isLocked(next, now) ? { locked: { seconds: lockSecondsLeft(next, now) } } : {}) } : {}),
    };
  });

// ---------------------------------------------------------------- finishing

export type ReviewRow = { id: string; prompt: string; options: string[]; chosen: number | null; correctIndex: number; correct: boolean };
export type FinishDTO = {
  score: number; max: number; percent: number; seconds: number; correct: number;
  previousBest: number | null; compare: 'first' | 'beat' | 'not';
  review: ReviewRow[] | null; duelId: string | null;
};

export const finishRun = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<FinishDTO> => {
    const a = await admin();
    const { run, game, items } = await loadRun(a, context.userId, data.runId);
    if (run.finished_at) throw new Error('تم حفظ هذه الجولة من قبل.');
    const itemIds = run.item_ids.filter((id) => items.some((i) => i.id === id));
    const problem = validateEvents(game, itemIds, run.events);
    if (problem) throw new Error(problem);
    const scored = scoreRun(game, itemIds, run.events);
    if (scored.max <= 0) throw new Error('لا توجد نتيجة لحفظها.');

    const limit = typeof game.config['timeLimit'] === 'number' ? (game.config['timeLimit'] as number) : null;
    const elapsed = Math.max(0, Math.round((Date.now() - Date.parse(run.started_at)) / 1000));
    const seconds = Math.min(86400, limit !== null ? Math.min(elapsed, limit) : elapsed);
    const percent = Math.round((scored.score / scored.max) * 100);

    const { data: earlier } = await a.from('game_sessions').select('score, max_score').eq('student_id', context.userId).eq('game_id', game.id);
    const best = (earlier ?? []).length ? Math.max(...(earlier ?? []).map((s) => Math.round((s.score / s.max_score) * 100))) : null;

    const { error } = await a.from('game_sessions').insert({
      run_id: run.id, student_id: context.userId, game_id: game.id, subject_id: run.subject_id, duel_id: run.duel_id,
      score: scored.score, max_score: scored.max, duration_seconds: seconds, play_date: dayKey(new Date()),
      details: { correct: scored.correct, wrongItemIds: scored.wrongItemIds, ...(scored.bestStreak !== undefined ? { bestStreak: scored.bestStreak } : {}) },
    });
    if (error) throw new Error('تعذر حفظ نتيجتك. حاول مرة أخرى.');
    await a.from('game_runs').update({ finished_at: new Date().toISOString() }).eq('id', run.id);

    // The answers are revealed only now that the run is over.
    const review = game.config['review'] === true
      ? run.item_ids.map((id) => items.find((i) => i.id === id)).filter((i): i is ItemRow => !!i && i.kind === 'choice').map((i) => {
          const e = run.events.find((ev) => ev.itemId === i.id);
          const chosen = e && typeof (e.a as { choice?: unknown } | undefined)?.choice === 'number' ? (e.a as { choice: number }).choice : null;
          return { id: i.id, prompt: String(i.payload['prompt']), options: i.payload['options'] as string[], chosen, correctIndex: Number(i.payload['correct']), correct: !!e?.correct };
        })
      : null;
    return { score: scored.score, max: scored.max, percent, seconds, correct: scored.correct, previousBest: best, compare: compareToBest(percent, best), review, duelId: run.duel_id };
  });

// ---------------------------------------------------------------- duels

const codeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)]).join('');

export const createDuel = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { slug: string; subjectId: string }) => input)
  .handler(async ({ data, context }): Promise<RunStartDTO | EmptyDTO> => {
    const { game } = await authorize(db(context.supabase), context.userId, data.slug, data.subjectId);
    if (game.engine !== 'duel') throw new Error('هذه ليست لعبة مبارزة.');
    const a = await admin();
    const items = await chooseItems(a, context.userId, game, data.subjectId);
    if (items.length < 2) return { empty: true, message: 'لا توجد أسئلة معتمدة كافية لهذه اللعبة في هذه المادة بعد.' };
    const { data: duel, error } = await a.from('game_duels').insert({
      code: newCode(), game_id: game.id, subject_id: data.subjectId, item_ids: items.map((i) => i.id), created_by: context.userId,
    }).select('id, code').single();
    if (error || !duel) throw new Error('تعذر إنشاء التحدي. حاول مرة أخرى.');
    const start = await createRun(a, context.userId, game, data.subjectId, items, { duelId: duel.id });
    return { ...start, duel: { id: duel.id, code: duel.code } };
  });

export const joinDuel = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }): Promise<RunStartDTO> => {
    const a = await admin();
    const { data: duel } = await a.from('game_duels').select('*').eq('code', data.code.trim().toUpperCase()).maybeSingle();
    if (!duel) throw new Error('لم نجد تحديًا بهذا الرمز.');
    if (duel.created_by === context.userId) throw new Error('لا يمكنك الانضمام إلى تحدٍّ أنشأته أنت.');
    if (duel.opponent_id && duel.opponent_id !== context.userId) throw new Error('انضم طالب آخر إلى هذا التحدي.');
    const { data: gameRow } = await a.from('games').select('slug').eq('id', duel.game_id).single();
    if (!gameRow) throw new Error('اللعبة غير موجودة');
    // The opponent must be allowed to play this game and subject themself (same grade and branch rules).
    const { game } = await authorize(db(context.supabase), context.userId, gameRow.slug, duel.subject_id);
    const { data: mine } = await a.from('game_runs').select('id').eq('duel_id', duel.id).eq('student_id', context.userId).maybeSingle();
    if (mine) throw new Error('انضممت إلى هذا التحدي من قبل.');
    const { data: rows } = await a.from('game_items').select('*').in('id', duel.item_ids);
    const byId = new Map(approvedOnly((rows ?? []).map(toItem)).map((i) => [i.id, i]));
    const items = (duel.item_ids as string[]).map((id) => byId.get(id)).filter((i): i is ItemRow => !!i);
    await a.from('game_duels').update({ opponent_id: context.userId }).eq('id', duel.id);
    const start = await createRun(a, context.userId, game, duel.subject_id, items, { duelId: duel.id });
    return { ...start, duel: { id: duel.id, code: duel.code } };
  });

export type DuelSideDTO = { name: string; finished: boolean; score: number | null; max: number | null; seconds: number | null };
export type DuelStatusDTO = { code: string; opponentJoined: boolean; me: DuelSideDTO; opponent: DuelSideDTO | null; outcome: 'me' | 'opponent' | 'draw' | null };

export const getDuelStatus = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { duelId: string }) => input)
  .handler(async ({ data, context }): Promise<DuelStatusDTO> => {
    const a = await admin();
    const { data: duel } = await a.from('game_duels').select('*').eq('id', data.duelId).maybeSingle();
    if (!duel || (duel.created_by !== context.userId && duel.opponent_id !== context.userId)) throw new Error('التحدي غير موجود.');
    const otherId: string | null = duel.created_by === context.userId ? duel.opponent_id : duel.created_by;
    const ids = [context.userId, ...(otherId ? [otherId] : [])];
    const [{ data: sessions }, { data: profiles }] = await Promise.all([
      a.from('game_sessions').select('student_id, score, max_score, duration_seconds').eq('duel_id', duel.id).in('student_id', ids),
      a.from('profiles').select('id, display_name').in('id', ids),
    ]);
    const side = (id: string): DuelSideDTO => {
      const s = (sessions ?? []).find((x) => x.student_id === id);
      const name = String((profiles ?? []).find((p) => p.id === id)?.display_name ?? 'طالب').split(' ')[0] ?? 'طالب';
      return { name, finished: !!s, score: s?.score ?? null, max: s?.max_score ?? null, seconds: s?.duration_seconds ?? null };
    };
    const me = side(context.userId);
    const opponent = otherId ? side(otherId) : null;
    const outcome = me.finished && opponent?.finished ? duelOutcome({ score: me.score!, seconds: me.seconds! }, { score: opponent.score!, seconds: opponent.seconds! }) : null;
    return { code: duel.code, opponentJoined: !!otherId, me, opponent, outcome };
  });

// ---------------------------------------------------------------- results and leaderboard

export type GameSessionDTO = {
  id: string; gameTitle: string; subjectTitle: string | null; score: number; maxScore: number; durationSeconds: number; playedAt: string;
};

async function sessionsFor(client: Db, studentId: string, limit: number, gameId?: string): Promise<GameSessionDTO[]> {
  let query = client
    .from('game_sessions')
    .select('id, score, max_score, duration_seconds, played_at, game:games(title), subject:subjects(title)')
    .eq('student_id', studentId)
    .order('played_at', { ascending: false })
    .limit(limit);
  if (gameId) query = query.eq('game_id', gameId);
  const { data } = await query;
  return (data ?? []).map((s: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: s.id, gameTitle: s.game?.title ?? 'لعبة', subjectTitle: s.subject?.title ?? null, score: s.score, maxScore: s.max_score,
    durationSeconds: s.duration_seconds, playedAt: s.played_at,
  }));
}

export const listMyGameSessions = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { limit?: number; gameId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => sessionsFor(db(context.supabase), context.userId, Math.min(data?.limit ?? 5, 50), data?.gameId));

/** Read-only, and only for a child linked to this parent. */
export const getChildGameSessions = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { studentId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = db(context.supabase);
    const { data: link } = await client.from('parent_links').select('id').eq('parent_id', context.userId).eq('student_id', data.studentId).maybeSingle();
    if (!link) throw new Error('Forbidden');
    return sessionsFor(client, data.studentId, 10);
  });

export type LeaderboardRowDTO = { rank: number; name: string; score: number; maxScore: number; seconds: number; isMe: boolean };

/** Today's results for students in the same grade and branch (the class), best first. First names only. */
export const getDailyLeaderboard = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }): Promise<LeaderboardRowDTO[]> => {
    const { student, game } = await authorize(db(context.supabase), context.userId, data.slug);
    const a = await admin();
    const { data: sessions } = await a.from('game_sessions').select('student_id, score, max_score, duration_seconds').eq('game_id', game.id).eq('play_date', dayKey(new Date()));
    const ids = (sessions ?? []).map((s) => s.student_id);
    if (ids.length === 0) return [];
    const { data: profiles } = await a.from('profiles').select('id, display_name, grade, branch_id').in('id', ids).eq('grade', student.grade);
    const classmates = (profiles ?? []).filter((p) => (student.branchId ? p.branch_id === student.branchId : true));
    const names = new Map(classmates.map((p) => [p.id, String(p.display_name ?? 'طالب').split(' ')[0] ?? 'طالب']));
    return (sessions ?? [])
      .filter((s) => names.has(s.student_id))
      .sort((x, y) => y.score / y.max_score - x.score / x.max_score || x.duration_seconds - y.duration_seconds)
      .slice(0, 10)
      .map((s, i) => ({ rank: i + 1, name: names.get(s.student_id)!, score: s.score, maxScore: s.max_score, seconds: s.duration_seconds, isMe: s.student_id === context.userId }));
  });

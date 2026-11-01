import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireApprovedMember } from '@/lib/access/middleware';
import {
  branchesForGrade,
  gamesForStudent,
  isPlayable,
  subjectsForGame,
  subjectsForStudent,
  validateSession,
  weakestTopic,
  type BranchRow,
  type GameEngine,
  type GameRow,
  type SessionInput,
  type SubjectRow,
} from '@/lib/games/logic';

// The games tables are not in the generated Supabase types until the migration is applied, so they are read untyped.
type Db = SupabaseClient;
const db = (client: unknown) => client as Db;

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
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description,
  icon: r.icon,
  engine: r.engine,
  config: r.config ?? {},
  minGrade: r.min_grade,
  maxGrade: r.max_grade,
  branchSlugs: r.branch_slugs,
  categories: r.categories,
  sortOrder: r.sort_order,
  active: r.active,
});
const toSubject = (r: any): SubjectRow => ({ id: r.id, title: r.title, grade: r.grade, branchId: r.branch_id ?? null, category: r.category ?? null });
const toBranch = (r: any): BranchRow => ({ id: r.id, slug: r.slug, title: r.title, minGrade: r.min_grade, maxGrade: r.max_grade });
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

export const getGameMenu = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<GameMenuDTO> => {
    const client = db(context.supabase);
    const student = await loadStudent(client, context.userId);
    const needsBranch = !!student.grade && student.grade >= 10 && !student.branchId;
    const branches = branchesForGrade(student.branches, student.grade).map((b) => ({ id: b.id, title: b.title }));
    const branch = student.branches.find((b) => b.id === student.branchId);
    if (needsBranch || !student.grade) {
      return { grade: student.grade, branch: null, needsBranch, branches, games: [] };
    }
    const [{ data: gameRows }, subjects] = await Promise.all([
      client.from('games').select('*').eq('active', true),
      loadSubjects(client, student.grade, student.branchId),
    ]);
    const games = gamesForStudent((gameRows ?? []).map(toGame), student.grade, student.branchSlug).map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      description: g.description,
      icon: g.icon,
      engine: g.engine,
      playable: isPlayable(g.engine),
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
    const allowed = branchesForGrade(student.branches, student.grade).some((b) => b.id === data.branchId);
    if (!allowed) throw new Error('هذا الفرع غير متاح لصفك.');
    const { error } = await client.from('profiles').update({ branch_id: data.branchId }).eq('id', context.userId);
    if (error) throw new Error('تعذر حفظ الفرع. حاول مرة أخرى.');
    return { ok: true };
  });

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type PlayableGameDTO = { game: GameCardDTO; config: Record<string, Json> };

export const getGame = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }): Promise<PlayableGameDTO> => {
    const client = db(context.supabase);
    const student = await loadStudent(client, context.userId);
    const { data: row } = await client.from('games').select('*').eq('slug', data.slug).maybeSingle();
    if (!row) throw new Error('اللعبة غير موجودة');
    const game = toGame(row);
    // The same filter as the menu: a game outside the student's stage or branch cannot be opened by URL.
    if (!gamesForStudent([game], student.grade, student.branchSlug).length) throw new Error('هذه اللعبة غير متاحة لمرحلتك.');
    const subjects = subjectsForGame(game, await loadSubjects(client, student.grade, student.branchId));
    return {
      config: game.config as Record<string, Json>,
      game: { id: game.id, slug: game.slug, title: game.title, description: game.description, icon: game.icon, engine: game.engine, playable: isPlayable(game.engine), subjects: subjects.map((s) => ({ id: s.id, title: s.title })) },
    };
  });

export type GameItemDTO = { id: string; kind: string; topic: string | null; qtype: string | null; payload: Record<string, Json> };

const kindForEngine: Partial<Record<GameEngine, string>> = { choice: 'choice', pair: 'pair', order: 'order', cards: 'card', ladder: 'ladder' };

export const getGameItems = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { slug: string; subjectId: string }) => input)
  .handler(async ({ data, context }): Promise<{ items: GameItemDTO[]; note: string | null }> => {
    const client = db(context.supabase);
    const student = await loadStudent(client, context.userId);
    const { data: row } = await client.from('games').select('*').eq('slug', data.slug).maybeSingle();
    if (!row) throw new Error('اللعبة غير موجودة');
    const game = toGame(row);
    if (!gamesForStudent([game], student.grade, student.branchSlug).length) throw new Error('هذه اللعبة غير متاحة لمرحلتك.');
    const subjects = subjectsForGame(game, await loadSubjects(client, student.grade, student.branchId));
    if (!subjects.some((s) => s.id === data.subjectId)) throw new Error('هذه المادة غير متاحة في هذه اللعبة.');
    const kind = kindForEngine[game.engine];
    if (!kind) return { items: [], note: null };

    const map = (r: any): GameItemDTO => ({ id: r.id, kind: r.kind, topic: r.topic, qtype: r.qtype, payload: r.payload }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const source = game.config['source'];

    if (source === 'mistakes' || source === 'weakest') {
      const { data: sessions } = await client
        .from('game_sessions')
        .select('details')
        .eq('student_id', context.userId)
        .eq('subject_id', data.subjectId)
        .order('played_at', { ascending: false })
        .limit(30);
      const wrongIds = [...new Set((sessions ?? []).flatMap((s) => ((s.details as { wrongItemIds?: string[] } | null)?.wrongItemIds ?? [])))];
      if (wrongIds.length === 0) return { items: [], note: 'لا توجد إجابات خاطئة محفوظة بعد. العب ألعابًا أخرى في هذه المادة أولًا.' };
      const { data: wrong } = await client.from('game_items').select('*').in('id', wrongIds).eq('kind', 'choice');
      const wrongItems = (wrong ?? []).map(map);
      if (source === 'mistakes') return { items: wrongItems, note: null };
      const topic = weakestTopic(wrongItems);
      if (!topic) return { items: [], note: 'لم نجد موضوعًا محددًا لأخطائك بعد.' };
      const { data: topicItems } = await client.from('game_items').select('*').eq('subject_id', data.subjectId).eq('kind', 'choice').eq('topic', topic);
      return { items: (topicItems ?? []).map(map), note: `أضعف موضوع لديك: ${topic}` };
    }

    const { data: items } = await client.from('game_items').select('*').eq('subject_id', data.subjectId).eq('kind', kind);
    return { items: (items ?? []).map(map), note: null };
  });

export const recordGameSession = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: SessionInput) => input)
  .handler(async ({ data, context }) => {
    const problem = validateSession(data);
    if (problem) throw new Error(problem);
    const client = db(context.supabase);
    const { error } = await client.from('game_sessions').insert({
      student_id: context.userId,
      game_id: data.gameId,
      subject_id: data.subjectId,
      score: data.score,
      max_score: data.maxScore,
      duration_seconds: Math.round(data.durationSeconds),
      details: data.details ?? {},
    });
    if (error) throw new Error('تعذر حفظ نتيجتك. حاول مرة أخرى.');
    return { ok: true };
  });

export type GameSessionDTO = {
  id: string;
  gameTitle: string;
  subjectTitle: string | null;
  score: number;
  maxScore: number;
  durationSeconds: number;
  playedAt: string;
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
    id: s.id,
    gameTitle: s.game?.title ?? 'لعبة',
    subjectTitle: s.subject?.title ?? null,
    score: s.score,
    maxScore: s.max_score,
    durationSeconds: s.duration_seconds,
    playedAt: s.played_at,
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

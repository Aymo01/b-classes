/** Pure rules for the games area: what a student sees, and how a play is scored. No I/O here. */

export type GameEngine = 'choice' | 'pair' | 'order' | 'cards' | 'ladder' | 'map' | 'duel' | 'crossword';

/** Every engine now has a play screen. */
export const playableEngines: readonly GameEngine[] = ['choice', 'pair', 'order', 'cards', 'ladder', 'map', 'duel', 'crossword'];
export const isPlayable = (engine: GameEngine) => playableEngines.includes(engine);

export type GameRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  engine: GameEngine;
  config: Record<string, unknown>;
  minGrade: number;
  maxGrade: number;
  branchSlugs: string[] | null;
  categories: string[] | null;
  sortOrder: number;
  active: boolean;
};

export type SubjectRow = { id: string; title: string; grade: number; branchId: string | null; category: string | null };
export type BranchRow = { id: string; slug: string; title: string; minGrade: number; maxGrade: number };

/** Games for one student: the grade must be inside the game's range, and a branch-limited game needs that branch. */
export function gamesForStudent(games: GameRow[], grade: number | null, branchSlug: string | null): GameRow[] {
  if (!grade) return [];
  return games
    .filter((g) => g.active && grade >= g.minGrade && grade <= g.maxGrade)
    .filter((g) => !g.branchSlugs || (branchSlug !== null && g.branchSlugs.includes(branchSlug)))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Subjects of the student's grade. Grades 10-12 only see their own branch; earlier grades have no branch. */
export function subjectsForStudent(subjects: SubjectRow[], grade: number | null, branchId: string | null): SubjectRow[] {
  if (!grade) return [];
  return subjects.filter((s) => s.grade === grade && (grade >= 10 ? s.branchId !== null && s.branchId === branchId : s.branchId === null));
}

/** The subjects a game covers: the student's subjects, narrowed to the game's categories (none = every subject). */
export function subjectsForGame(game: Pick<GameRow, 'categories'>, studentSubjects: SubjectRow[]): SubjectRow[] {
  const cats = game.categories;
  return cats ? studentSubjects.filter((s) => s.category !== null && cats.includes(s.category)) : studentSubjects;
}

/** Branches a student of this grade can pick from. */
export function branchesForGrade(branches: BranchRow[], grade: number | null): BranchRow[] {
  return grade ? branches.filter((b) => grade >= b.minGrade && grade <= b.maxGrade) : [];
}

// ---------- scoring ----------

export const POINTS_PER_ANSWER = 10;

/** Streak multiplier for flashcards: x1 until 3 in a row, then +1 for every 3 more, capped at x4. */
export function streakMultiplier(streak: number): number {
  return Math.min(4, 1 + Math.floor(Math.max(0, streak) / 3));
}

/** Points for one answer. A streak counts the answers before this one. */
export function answerPoints(correct: boolean, streakBefore: number, useStreak: boolean): number {
  if (!correct) return 0;
  return POINTS_PER_ANSWER * (useStreak ? streakMultiplier(streakBefore) : 1);
}

/** Best possible score for n answers, so a session can always be shown as "score of max". */
export function maxScore(count: number, useStreak: boolean): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += answerPoints(true, i, useStreak);
  return total;
}

export type AnswerLog = { correct: boolean }[];

export function scoreAnswers(log: AnswerLog, useStreak: boolean): { score: number; max: number; correct: number; bestStreak: number } {
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let correct = 0;
  for (const a of log) {
    score += answerPoints(a.correct, streak, useStreak);
    if (a.correct) {
      streak += 1;
      correct += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }
  return { score, max: maxScore(log.length, useStreak), correct, bestStreak };
}

/** Matching games: 10 per pair, 2 off for every wrong try, never below 0. */
export function pairScore(pairs: number, misses: number): { score: number; max: number } {
  const max = pairs * POINTS_PER_ANSWER;
  return { score: Math.max(0, max - misses * 2), max };
}

export const percentOf = (score: number, max: number) => (max > 0 ? Math.round((score / max) * 100) : 0);

export type SessionInput = {
  gameId: string;
  subjectId: string | null;
  score: number;
  maxScore: number;
  durationSeconds: number;
  details?: Record<string, unknown>;
};

/** The same checks the database applies; returns an Arabic message or null when the session is valid. */
export function validateSession(s: SessionInput): string | null {
  if (!s.gameId) return 'اللعبة غير محددة.';
  if (!Number.isInteger(s.score) || !Number.isInteger(s.maxScore)) return 'النتيجة غير صالحة.';
  if (s.maxScore <= 0) return 'النتيجة غير صالحة.';
  if (s.score < 0 || s.score > s.maxScore) return 'النتيجة خارج الحد المسموح.';
  if (!Number.isFinite(s.durationSeconds) || s.durationSeconds < 0 || s.durationSeconds > 86400) return 'مدة اللعب غير صالحة.';
  return null;
}

// ---------- game helpers ----------

/** Deterministic shuffle (mulberry32), so tests and "same cards, new order" are reproducible. */
export function shuffle<T>(items: readonly T[], seed = Date.now()): T[] {
  let t = seed >>> 0;
  const rand = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Two words differ by exactly one letter at the same position (same length). */
export function isOneLetterStep(from: string, to: string): boolean {
  const a = [...from.trim()];
  const b = [...to.trim()];
  if (a.length === 0 || a.length !== b.length) return false;
  return a.filter((ch, i) => ch !== b[i]).length === 1;
}

/** A ladder step is valid when it changes one letter and (if a word list is given) is a listed word. */
export function isValidLadderStep(from: string, to: string, words: readonly string[] | null): boolean {
  if (!isOneLetterStep(from, to)) return false;
  if (!words || words.length === 0) return true;
  const norm = (w: string) => w.trim().toLowerCase();
  return words.map(norm).includes(norm(to));
}

export const sameSequence = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Puts a missed card back in the queue a few places later, so it comes round again sooner. */
export function requeueMissed<T>(queue: readonly T[], card: T, gap = 3): T[] {
  const rest = [...queue];
  rest.splice(Math.min(gap, rest.length), 0, card);
  return rest;
}

/** The topic with the most wrong answers (ties go to the first topic seen). null when nothing was missed. */
export function weakestTopic(wrong: readonly { topic: string | null }[]): string | null {
  const counts = new Map<string, number>();
  for (const w of wrong) if (w.topic) counts.set(w.topic, (counts.get(w.topic) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [topic, n] of counts) if (n > bestCount) { best = topic; bestCount = n; }
  return best;
}

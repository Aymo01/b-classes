import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  answerPoints,
  branchesForGrade,
  gamesForStudent,
  isOneLetterStep,
  isPlayable,
  isValidLadderStep,
  maxScore,
  pairScore,
  percentOf,
  requeueMissed,
  sameSequence,
  scoreAnswers,
  shuffle,
  streakMultiplier,
  subjectsForGame,
  subjectsForStudent,
  validateSession,
  weakestTopic,
  type BranchRow,
  type GameEngine,
  type GameRow,
  type SubjectRow,
} from '@/lib/games/logic';

/**
 * The seed file is the source of the catalogue, so these tests read it: the menu is checked against the games and
 * subject lists exactly as they will be loaded into the database.
 */
const seed = readFileSync(resolve(__dirname, '../../db/pending-migrations/0012_games_seed.sql'), 'utf8');

const games: GameRow[] = [...seed.matchAll(/^\s+\('([^']+)', '([^']+)', '([^']*)', '([^']+)', '([^']+)', '(\{[^']*\})'::jsonb, (\d+), (\d+), (null|array\[[^\]]*\]), (null|array\[[^\]]*\]), (\d+)\)/gm)].map((m, i) => ({
  id: `g${i}`,
  slug: m[1]!,
  title: m[2]!,
  description: m[3]!,
  icon: m[4]!,
  engine: m[5] as GameEngine,
  config: JSON.parse(m[6]!) as Record<string, unknown>,
  minGrade: Number(m[7]),
  maxGrade: Number(m[8]),
  branchSlugs: m[9] === 'null' ? null : [...m[9]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!),
  categories: m[10] === 'null' ? null : [...m[10]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!),
  sortOrder: Number(m[11]),
  active: true,
}));

const branches: BranchRow[] = [...seed.matchAll(/^\s+\('([^']+)', '([^']+)', (\d+), (\d+), \d+\)/gm)]
  .filter((m) => !games.some((g) => g.slug === m[1]))
  .map((m) => ({ id: `b-${m[1]}`, slug: m[1]!, title: m[2]!, minGrade: Number(m[3]), maxGrade: Number(m[4]) }));

const subjects: SubjectRow[] = [...seed.matchAll(/select '([^']+)', (\d+), (null|\(select id from public\.branches where slug = '([^']+)'\)), '([^']+)' where/g)].map((m, i) => ({
  id: `s${i}`,
  title: m[1]!,
  grade: Number(m[2]),
  branchId: m[4] ? `b-${m[4]}` : null,
  category: m[5]!,
}));

const slugs = (grade: number, branch: string | null) => gamesForStudent(games, grade, branch).map((g) => g.slug);
const branchId = (slug: string) => `b-${slug}`;

describe('seed parsing (guards the tests below)', () => {
  it('reads all 25 games, 8 branches and the subject lists', () => {
    expect(games).toHaveLength(25);
    expect(branches.map((b) => b.slug)).toEqual(['academic-10', 'vocational-10', 'scientific', 'industrial', 'agricultural', 'literary', 'sharia', 'entrepreneurship']);
    expect(subjects.length).toBeGreaterThan(150);
  });
});

describe('game menu filtering by stage', () => {
  it('grades 1-4 get exactly the five early games', () => {
    for (const grade of [1, 2, 3, 4]) {
      expect(slugs(grade, null)).toEqual(['letter-garden', 'counting-farm', 'memory-pairs', 'shape-sorter', 'story-builder']);
    }
  });
  it('grades 5-9 get the five middle games and none of the early ones', () => {
    for (const grade of [5, 6, 7, 8, 9]) {
      expect(slugs(grade, null)).toEqual(['math-sprint', 'word-ladder', 'science-lab-quiz', 'map-hunt', 'escape-room']);
    }
  });
  it('grade 10 gets its five games, plus Map Hunt (the request names grade 10 for it)', () => {
    expect(slugs(10, 'academic-10')).toEqual(['map-hunt', 'knowledge-duel', 'find-the-mistake', 'timeline-sort', 'crossword', 'flashcard-streak']);
  });
  it('grade 11 gets the grades 11-12 games; the Lab Simulator needs the scientific branch', () => {
    expect(slugs(11, 'scientific')).toEqual(['exam-sprint', 'concept-connect', 'mistake-bank', 'lab-simulator', 'daily-challenge']);
    expect(slugs(11, 'literary')).toEqual(['exam-sprint', 'concept-connect', 'mistake-bank', 'daily-challenge']);
    expect(slugs(11, null)).not.toContain('lab-simulator');
  });
  it('grade 12 gets the grades 11-12 games and the five Tawjihi games', () => {
    expect(slugs(12, 'scientific')).toEqual([
      'exam-sprint', 'concept-connect', 'mistake-bank', 'lab-simulator', 'daily-challenge',
      'mock-exam', 'recall-cards', 'question-type-drill', 'beat-your-best', 'weak-spot-boss',
    ]);
    expect(slugs(12, 'sharia')).not.toContain('lab-simulator');
  });
  it('never shows a game from another stage', () => {
    expect(slugs(4, null)).not.toContain('math-sprint');
    expect(slugs(11, 'scientific')).not.toContain('mock-exam');
    expect(slugs(9, null)).not.toContain('knowledge-duel');
  });
  it('shows nothing without a grade, hides inactive games and orders by sort order', () => {
    expect(gamesForStudent(games, null, null)).toEqual([]);
    const off = games.map((g) => (g.slug === 'letter-garden' ? { ...g, active: false } : g));
    expect(gamesForStudent(off, 1, null).map((g) => g.slug)).not.toContain('letter-garden');
    expect(gamesForStudent([...games].reverse(), 1, null)[0]?.slug).toBe('letter-garden');
  });
  it('lists unfinished engines in the menu but marks them as not playable', () => {
    const unplayable = games.filter((g) => !isPlayable(g.engine)).map((g) => g.slug);
    expect(unplayable.sort()).toEqual(['crossword', 'knowledge-duel', 'map-hunt']);
  });
});

describe('subject loading by grade and branch', () => {
  const titles = (grade: number, branch: string | null) =>
    subjectsForStudent(subjects, grade, branch ? branchId(branch) : null).map((s) => s.title);

  it('has the requested subject counts for each grade band', () => {
    expect(titles(1, null)).toHaveLength(6);
    expect(titles(2, null)).toHaveLength(6);
    expect(titles(3, null)).toHaveLength(7);
    expect(titles(4, null)).toHaveLength(7);
    for (const grade of [5, 6, 7, 8, 9]) expect(titles(grade, null)).toHaveLength(10);
  });
  it('grades 1-2 and 3-4 differ as requested', () => {
    expect(titles(1, null)).toContain('لغتنا الجميلة');
    expect(titles(1, null)).not.toContain('العلوم الحياتية');
    expect(titles(3, null)).toContain('العلوم الحياتية');
    expect(titles(3, null)).toContain('التنشئة الوطنية والاجتماعية');
  });
  it('grade 10 differs between the academic and vocational branches', () => {
    expect(titles(10, 'academic-10')).toHaveLength(11);
    expect(titles(10, 'vocational-10')).toHaveLength(9);
    expect(titles(10, 'academic-10')).toContain('الفيزياء');
    expect(titles(10, 'vocational-10')).not.toContain('الفيزياء');
    expect(titles(10, 'vocational-10')).toContain('العلوم المهنية (نظري وعملي)');
  });
  it('grades 11-12 each load only their own branch', () => {
    const expected: Record<string, number> = { scientific: 9, industrial: 8, agricultural: 9, literary: 10, sharia: 11, entrepreneurship: 9 };
    for (const [branch, count] of Object.entries(expected)) {
      for (const grade of [11, 12]) expect(titles(grade, branch), `${branch} grade ${grade}`).toHaveLength(count);
    }
    expect(titles(11, 'industrial')).toContain('الرسم الصناعي');
    expect(titles(11, 'scientific')).not.toContain('الرسم الصناعي');
    expect(titles(12, 'sharia')).toContain('العقيدة');
    expect(titles(12, 'sharia')).not.toContain('التربية المسيحية');
  });
  it('a grade 10-12 student with no branch sees no subjects, and a branch never leaks into another grade', () => {
    expect(titles(11, null)).toEqual([]);
    expect(titles(11, 'academic-10')).toEqual([]);
    // Grades before 10 have no branches: a leftover branch value is ignored and the grade's own subjects load.
    expect(titles(5, 'scientific')).toHaveLength(10);
    expect(subjectsForStudent(subjects, null, null)).toEqual([]);
  });
  it('branches are offered only for the matching grades', () => {
    expect(branchesForGrade(branches, 10).map((b) => b.slug)).toEqual(['academic-10', 'vocational-10']);
    expect(branchesForGrade(branches, 11)).toHaveLength(6);
    expect(branchesForGrade(branches, 7)).toEqual([]);
    expect(branchesForGrade(branches, null)).toEqual([]);
  });
  it('a game covers only the subjects in its categories (or every subject when it has none)', () => {
    const grade5 = subjectsForStudent(subjects, 5, null);
    const sprint = games.find((g) => g.slug === 'math-sprint')!;
    expect(subjectsForGame(sprint, grade5).map((s) => s.title)).toEqual(['الرياضيات']);
    const escape = games.find((g) => g.slug === 'escape-room')!;
    expect(subjectsForGame(escape, grade5)).toHaveLength(10);
    const lab = games.find((g) => g.slug === 'science-lab-quiz')!;
    expect(subjectsForGame(lab, grade5).map((s) => s.title).sort()).toEqual(['البرمجة', 'التكنولوجيا', 'العلوم الحياتية'].sort());
  });
  it('Map Hunt covers Social Studies in grades 5-9 and Palestine Geography in grade 10', () => {
    const map = games.find((g) => g.slug === 'map-hunt')!;
    expect(subjectsForGame(map, subjectsForStudent(subjects, 6, null)).map((s) => s.title)).toEqual(['الدراسات الاجتماعية']);
    expect(subjectsForGame(map, subjectsForStudent(subjects, 10, branchId('academic-10'))).map((s) => s.title)).toEqual(['جغرافيا فلسطين']);
  });
  it('the Lab Simulator covers only science subjects of the scientific branch', () => {
    const lab = games.find((g) => g.slug === 'lab-simulator')!;
    const found = subjectsForGame(lab, subjectsForStudent(subjects, 11, branchId('scientific'))).map((s) => s.title);
    expect(found.sort()).toEqual(['الفيزياء', 'الكيمياء', 'العلوم الحياتية'].sort());
  });
});

describe('scoring', () => {
  it('scores 10 per correct answer and 0 for a wrong one', () => {
    expect(answerPoints(true, 0, false)).toBe(10);
    expect(answerPoints(false, 5, true)).toBe(0);
    const s = scoreAnswers([{ correct: true }, { correct: false }, { correct: true }], false);
    expect(s).toMatchObject({ score: 20, max: 30, correct: 2 });
  });
  it('an empty play scores 0 of 0', () => {
    expect(scoreAnswers([], false)).toMatchObject({ score: 0, max: 0, correct: 0 });
  });
  it('the streak multiplier grows every 3 correct answers and stops at x4', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 12, 30].map(streakMultiplier)).toEqual([1, 1, 1, 2, 2, 3, 4, 4, 4]);
    expect(streakMultiplier(-3)).toBe(1);
  });
  it('flashcard streaks multiply the points and a miss resets the streak', () => {
    const log = [true, true, true, true, false, true].map((correct) => ({ correct }));
    // 10 + 10 + 10 + (x2) 20 + 0 + 10 (streak reset)
    expect(scoreAnswers(log, true)).toMatchObject({ score: 60, correct: 5, bestStreak: 4 });
  });
  it('the maximum assumes a perfect run, so the score never exceeds it', () => {
    expect(maxScore(4, false)).toBe(40);
    expect(maxScore(4, true)).toBe(10 + 10 + 10 + 20);
    for (let n = 0; n < 20; n++) {
      const log = Array.from({ length: n }, (_, i) => ({ correct: i % 3 !== 0 }));
      const s = scoreAnswers(log, true);
      expect(s.score).toBeLessThanOrEqual(s.max);
    }
  });
  it('matching games lose 2 points per wrong try and never go below 0', () => {
    expect(pairScore(6, 0)).toEqual({ score: 60, max: 60 });
    expect(pairScore(6, 3)).toEqual({ score: 54, max: 60 });
    expect(pairScore(2, 50)).toEqual({ score: 0, max: 20 });
  });
  it('rounds percentages and handles a zero maximum', () => {
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe('session validation (mirrors the table checks)', () => {
  const ok = { gameId: 'g', subjectId: 's', score: 30, maxScore: 50, durationSeconds: 42 };
  it('accepts a normal session, including a full score and a score of 0', () => {
    expect(validateSession(ok)).toBeNull();
    expect(validateSession({ ...ok, score: 50 })).toBeNull();
    expect(validateSession({ ...ok, score: 0 })).toBeNull();
    expect(validateSession({ ...ok, subjectId: null })).toBeNull();
  });
  it('rejects scores above the maximum, negatives, a zero maximum and fractions', () => {
    expect(validateSession({ ...ok, score: 51 })).not.toBeNull();
    expect(validateSession({ ...ok, score: -1 })).not.toBeNull();
    expect(validateSession({ ...ok, maxScore: 0, score: 0 })).not.toBeNull();
    expect(validateSession({ ...ok, score: 1.5 })).not.toBeNull();
  });
  it('rejects bad durations and a missing game', () => {
    expect(validateSession({ ...ok, durationSeconds: -1 })).not.toBeNull();
    expect(validateSession({ ...ok, durationSeconds: 86401 })).not.toBeNull();
    expect(validateSession({ ...ok, durationSeconds: NaN })).not.toBeNull();
    expect(validateSession({ ...ok, gameId: '' })).not.toBeNull();
  });
});

describe('game helpers', () => {
  it('shuffles without losing items and is repeatable for a seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect([...shuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
    expect(shuffle(items, 7)).toEqual(shuffle(items, 7));
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('word ladder steps change exactly one letter, in Arabic or English', () => {
    expect(isOneLetterStep('cat', 'cot')).toBe(true);
    expect(isOneLetterStep('cat', 'cat')).toBe(false);
    expect(isOneLetterStep('cat', 'dog')).toBe(false);
    expect(isOneLetterStep('cat', 'cats')).toBe(false);
    expect(isOneLetterStep('قلم', 'علم')).toBe(true);
    expect(isOneLetterStep('', '')).toBe(false);
  });
  it('a ladder step must also be in the word list when one is given', () => {
    expect(isValidLadderStep('cat', 'cot', ['cot', 'cog'])).toBe(true);
    expect(isValidLadderStep('cat', 'cxt', ['cot', 'cog'])).toBe(false);
    expect(isValidLadderStep('cat', 'cxt', null)).toBe(true);
  });
  it('compares sequences exactly', () => {
    expect(sameSequence(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameSequence(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameSequence(['a'], ['a', 'b'])).toBe(false);
  });
  it('puts a missed card back a few places later without touching the original queue', () => {
    const queue = ['b', 'c', 'd', 'e'];
    expect(requeueMissed(queue, 'a')).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(requeueMissed(['b'], 'a')).toEqual(['b', 'a']);
    expect(requeueMissed([], 'a')).toEqual(['a']);
    expect(queue).toEqual(['b', 'c', 'd', 'e']);
  });
  it('finds the weakest topic from wrong answers', () => {
    expect(weakestTopic([{ topic: 'x' }, { topic: 'y' }, { topic: 'y' }, { topic: null }])).toBe('y');
    expect(weakestTopic([{ topic: null }])).toBeNull();
    expect(weakestTopic([])).toBeNull();
  });
});

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

const branches: BranchRow[] = [...seed.matchAll(/^\s+\('([^']+)', '([^']+)', (\d+), (\d+), \d+\)/gm)].map((m) => ({
  id: `b-${m[1]}`, slug: m[1]!, title: m[2]!, minGrade: Number(m[3]), maxGrade: Number(m[4]),
}));

const subjects: SubjectRow[] = [...seed.matchAll(/select '([^']+)', (\d+), (null|\(select id from public\.branches where slug = '([^']+)'\)), '([^']+)' where/g)].map((m, i) => ({
  id: `s${i}`, title: m[1]!, grade: Number(m[2]), branchId: m[4] ? `b-${m[4]}` : null, category: m[5]!,
}));

const slugs = (grade: number, branch: string | null) => gamesForStudent(games, grade, branch).map((g) => g.slug);
const branchId = (slug: string) => `b-${slug}`;

describe('seed parsing (guards the tests below)', () => {
  it('reads all 25 games, 8 branches and the subject lists', () => {
    expect(games).toHaveLength(25);
    expect(branches.map((b) => b.slug)).toEqual(['academic-10', 'vocational-10', 'scientific', 'industrial', 'agricultural', 'literary', 'sharia', 'entrepreneurship']);
    expect(subjects).toHaveLength(212);
  });
});

describe('grade visibility: each student sees only their own grade\'s games', () => {
  it('grades 1-4 get exactly the five early games', () => {
    for (const grade of [1, 2, 3, 4]) expect(slugs(grade, null)).toEqual(['letter-garden', 'counting-farm', 'memory-pairs', 'shape-sorter', 'story-builder']);
  });
  it('grades 5-9 get the five middle games, including Map Hunt', () => {
    for (const grade of [5, 6, 7, 8, 9]) expect(slugs(grade, null)).toEqual(['math-sprint', 'word-ladder', 'science-lab-quiz', 'map-hunt', 'escape-room']);
  });
  it('Map Hunt covers grades 5 to 10 and nothing else', () => {
    const map = games.find((g) => g.slug === 'map-hunt')!;
    expect([map.minGrade, map.maxGrade]).toEqual([5, 10]);
    for (const grade of [4, 11, 12]) expect(slugs(grade, 'scientific')).not.toContain('map-hunt');
  });
  it('grade 10 gets the grade 10 games, for both the academic and the vocational branch', () => {
    const expected = ['map-hunt', 'knowledge-duel', 'find-the-mistake', 'timeline-sort', 'crossword', 'flashcard-streak'];
    expect(slugs(10, 'academic-10')).toEqual(expected);
    expect(slugs(10, 'vocational-10')).toEqual(expected);
  });
  it('grade 11 gets only the first-secondary games; the Lab Simulator needs the scientific branch', () => {
    expect(slugs(11, 'scientific')).toEqual(['exam-sprint', 'concept-connect', 'mistake-bank', 'lab-simulator', 'daily-challenge']);
    for (const branch of ['industrial', 'agricultural', 'literary', 'sharia', 'entrepreneurship']) {
      expect(slugs(11, branch)).toEqual(['exam-sprint', 'concept-connect', 'mistake-bank', 'daily-challenge']);
    }
  });
  it('grade 12 gets the Tawjihi games only, and none of the grade 11 games, in every branch', () => {
    const tawjihi = ['mock-exam', 'recall-cards', 'question-type-drill', 'beat-your-best', 'weak-spot-boss'];
    const grade11 = ['exam-sprint', 'concept-connect', 'mistake-bank', 'lab-simulator', 'daily-challenge'];
    for (const branch of ['scientific', 'industrial', 'agricultural', 'literary', 'sharia', 'entrepreneurship']) {
      expect(slugs(12, branch)).toEqual(tawjihi);
      for (const g of grade11) expect(slugs(12, branch)).not.toContain(g);
    }
  });
  it('no grade sees a game from another grade band', () => {
    for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const branch = grade === 10 ? 'academic-10' : grade >= 11 ? 'scientific' : null;
      for (const g of gamesForStudent(games, grade, branch)) {
        expect(grade, `${g.slug} for grade ${grade}`).toBeGreaterThanOrEqual(g.minGrade);
        expect(grade, `${g.slug} for grade ${grade}`).toBeLessThanOrEqual(g.maxGrade);
      }
    }
  });
  it('shows nothing without a grade, hides inactive games and orders by sort order', () => {
    expect(gamesForStudent(games, null, null)).toEqual([]);
    const off = games.map((g) => (g.slug === 'letter-garden' ? { ...g, active: false } : g));
    expect(gamesForStudent(off, 1, null).map((g) => g.slug)).not.toContain('letter-garden');
    expect(gamesForStudent([...games].reverse(), 1, null)[0]?.slug).toBe('letter-garden');
  });
  it('every game now has a play screen', () => {
    expect(games.filter((g) => !isPlayable(g.engine))).toEqual([]);
  });
});

describe('subject loading by grade and branch (official names from elearn.edu.ps)', () => {
  const titles = (grade: number, branch: string | null) => subjectsForStudent(subjects, grade, branch ? branchId(branch) : null).map((s) => s.title);

  it('has the subject counts listed on the site for each grade and branch', () => {
    for (const g of [1, 2]) expect(titles(g, null)).toHaveLength(6);
    for (const g of [3, 4]) expect(titles(g, null)).toHaveLength(7);
    for (const g of [5, 6, 7, 8, 9]) expect(titles(g, null)).toHaveLength(10);
    expect(titles(10, 'academic-10')).toHaveLength(11);
    expect(titles(10, 'vocational-10')).toHaveLength(11);
    const counts: Record<string, [number, number]> = { scientific: [9, 9], industrial: [8, 8], agricultural: [9, 9], literary: [11, 11], sharia: [11, 11], entrepreneurship: [9, 9] };
    for (const [branch, [g11, g12]] of Object.entries(counts)) {
      expect(titles(11, branch), `${branch} 11`).toHaveLength(g11);
      expect(titles(12, branch), `${branch} 12`).toHaveLength(g12);
    }
  });
  it('uses the site\'s wording, not translations', () => {
    expect(titles(1, null)).toContain('التربية الوطنية والحياتية');
    expect(titles(3, null)).toContain('العلوم والحياة');
    expect(titles(5, null)).toContain('التلاوة والتجويد');
    expect(titles(10, 'academic-10')).toContain('جغرافية فلسطين | أكاديمي');
    expect(titles(10, 'vocational-10')).toContain('العلوم المهنية | نظري');
    expect(titles(10, 'vocational-10')).toContain('العلوم المهنية | عملي');
    expect(titles(12, 'agricultural')).toContain('علم الزراعة | إنتاج نباتي');
    expect(titles(11, 'literary')).toContain('اللغة الإنجليزية | Reading Plus');
    expect(titles(11, 'entrepreneurship')).toContain('إدارة واقتصاد');
  });
  it('grades 11 and 12 of one branch can differ, as on the site', () => {
    expect(titles(11, 'scientific')).toContain('اللغة العربية');
    expect(titles(12, 'scientific')).toContain('المطالعة والقواعد');
    expect(titles(12, 'scientific')).not.toContain('اللغة العربية');
  });
  it('a grade 10-12 student with no branch sees no subjects, and a wrong branch loads nothing', () => {
    expect(titles(11, null)).toEqual([]);
    expect(titles(11, 'academic-10')).toEqual([]);
    expect(titles(5, 'scientific')).toHaveLength(10); // grades before 10 have no branches: a stray value is ignored
    expect(subjectsForStudent(subjects, null, null)).toEqual([]);
  });
  it('branches are offered only for the matching grades', () => {
    expect(branchesForGrade(branches, 10).map((b) => b.title)).toEqual(['أكاديمي', 'مهني']);
    expect(branchesForGrade(branches, 11)).toHaveLength(6);
    expect(branchesForGrade(branches, 7)).toEqual([]);
    expect(branchesForGrade(branches, null)).toEqual([]);
  });
  it('a game covers only the subjects in its categories (or every subject when it has none)', () => {
    const grade5 = subjectsForStudent(subjects, 5, null);
    expect(subjectsForGame(games.find((g) => g.slug === 'math-sprint')!, grade5).map((s) => s.title)).toEqual(['الرياضيات']);
    expect(subjectsForGame(games.find((g) => g.slug === 'escape-room')!, grade5)).toHaveLength(10);
    expect(subjectsForGame(games.find((g) => g.slug === 'science-lab-quiz')!, grade5).map((s) => s.title).sort()).toEqual(['البرمجة', 'التكنولوجيا', 'العلوم والحياة'].sort());
  });
  it('Map Hunt: Social Studies in grades 5-9, Palestine Geography in grade 10', () => {
    const map = games.find((g) => g.slug === 'map-hunt')!;
    for (const grade of [5, 6, 7, 8, 9]) {
      expect(subjectsForGame(map, subjectsForStudent(subjects, grade, null)).map((s) => s.title)).toEqual(['الدراسات الاجتماعية']);
    }
    expect(subjectsForGame(map, subjectsForStudent(subjects, 10, branchId('academic-10'))).map((s) => s.title)).toEqual(['جغرافية فلسطين | أكاديمي']);
    expect(subjectsForGame(map, subjectsForStudent(subjects, 10, branchId('vocational-10'))).map((s) => s.title)).toEqual(['جغرافية فلسطين']);
  });
  it('the Lab Simulator covers only science subjects of the scientific branch', () => {
    const lab = games.find((g) => g.slug === 'lab-simulator')!;
    expect(subjectsForGame(lab, subjectsForStudent(subjects, 11, branchId('scientific'))).map((s) => s.title).sort()).toEqual(['الفيزياء', 'الكيمياء', 'العلوم الحياتية'].sort());
  });
});

describe('scoring helpers', () => {
  it('scores 10 per correct answer and 0 for a wrong one', () => {
    expect(answerPoints(true, 0, false)).toBe(10);
    expect(answerPoints(false, 5, true)).toBe(0);
    expect(scoreAnswers([{ correct: true }, { correct: false }, { correct: true }], false)).toMatchObject({ score: 20, max: 30, correct: 2 });
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
    expect(scoreAnswers(log, true)).toMatchObject({ score: 60, correct: 5, bestStreak: 4 });
  });
  it('the maximum assumes a perfect run, so the score never exceeds it', () => {
    expect(maxScore(4, false)).toBe(40);
    expect(maxScore(4, true)).toBe(50);
    for (let n = 0; n < 20; n++) {
      const s = scoreAnswers(Array.from({ length: n }, (_, i) => ({ correct: i % 3 !== 0 })), true);
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
  it('accepts a normal session and rejects impossible ones', () => {
    expect(validateSession(ok)).toBeNull();
    expect(validateSession({ ...ok, score: 51 })).not.toBeNull();
    expect(validateSession({ ...ok, score: -1 })).not.toBeNull();
    expect(validateSession({ ...ok, maxScore: 0, score: 0 })).not.toBeNull();
    expect(validateSession({ ...ok, durationSeconds: 86401 })).not.toBeNull();
    expect(validateSession({ ...ok, gameId: '' })).not.toBeNull();
  });
});

describe('game helpers', () => {
  it('shuffles without losing items and is repeatable for a seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect([...shuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
    expect(shuffle(items, 7)).toEqual(shuffle(items, 7));
  });
  it('word ladder steps change exactly one letter, in Arabic or English', () => {
    expect(isOneLetterStep('cat', 'cot')).toBe(true);
    expect(isOneLetterStep('cat', 'cat')).toBe(false);
    expect(isOneLetterStep('cat', 'cats')).toBe(false);
    expect(isOneLetterStep('قلم', 'علم')).toBe(true);
    expect(isValidLadderStep('cat', 'cot', ['cot'])).toBe(true);
    expect(isValidLadderStep('cat', 'cxt', ['cot'])).toBe(false);
  });
  it('compares sequences exactly and requeues missed cards without touching the original', () => {
    expect(sameSequence(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameSequence(['a', 'b'], ['b', 'a'])).toBe(false);
    const queue = ['b', 'c', 'd', 'e'];
    expect(requeueMissed(queue, 'a')).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(queue).toEqual(['b', 'c', 'd', 'e']);
  });
  it('finds the weakest topic from wrong answers', () => {
    expect(weakestTopic([{ topic: 'x' }, { topic: 'y' }, { topic: 'y' }, { topic: null }])).toBe('y');
    expect(weakestTopic([{ topic: null }])).toBeNull();
  });
});

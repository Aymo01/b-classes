import { describe, it, expect } from 'vitest';
import { stages, themeForGrade } from '@/lib/grades';

describe('Grade-based themes (five stages)', () => {
  it('uses stage 1 for every grade 1–4', () => {
    for (const grade of [1, 2, 3, 4]) expect(themeForGrade(grade)).toBe('stage-1');
  });
  it('uses stage 2 for every grade 5–8', () => {
    for (const grade of [5, 6, 7, 8]) expect(themeForGrade(grade)).toBe('stage-2');
  });
  it('uses stage 3 for grades 9 and 10', () => {
    for (const grade of [9, 10]) expect(themeForGrade(grade)).toBe('stage-3');
  });
  it('uses stage 4 for first secondary (grade 11)', () => {
    expect(themeForGrade(11)).toBe('stage-4');
  });
  it('uses stage 5 for Tawjihi (grade 12)', () => {
    expect(themeForGrade(12)).toBe('stage-5');
  });
  it('does not assign a student theme to missing or invalid grades', () => {
    for (const grade of [null, 0, 13, 1.5, NaN, -1]) expect(themeForGrade(grade)).toBeNull();
  });
});

describe('Stage list', () => {
  it('has the five stages in order', () => {
    expect(stages.map((s) => s.id)).toEqual(['stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5']);
  });
  it('lists every grade 1–12 exactly once, in the stage the mapping gives it', () => {
    const listed = stages.flatMap((s) => s.grades);
    expect([...listed].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const stage of stages) for (const grade of stage.grades) expect(themeForGrade(grade)).toBe(stage.id);
  });
});

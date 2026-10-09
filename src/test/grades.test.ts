import { describe, it, expect } from 'vitest';
import { themeForGrade } from '@/lib/grades';

describe('Grade-based themes', () => {
  it('uses elementary for every grade 1–4', () => {
    for (const grade of [1, 2, 3, 4]) expect(themeForGrade(grade)).toBe('elementary');
  });
  it('uses middle for every grade 5–10', () => {
    for (const grade of [5, 6, 7, 8, 9, 10]) expect(themeForGrade(grade)).toBe('middle');
  });
  it('uses secondary for first and second secondary', () => {
    expect(themeForGrade(11)).toBe('secondary');
    expect(themeForGrade(12)).toBe('secondary');
  });
  it('does not assign a student theme to missing or invalid grades', () => {
    for (const grade of [null, 0, 13, 1.5, NaN]) expect(themeForGrade(grade)).toBeNull();
  });
});
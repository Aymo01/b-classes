import { describe, expect, it } from 'vitest';
import { cleanItemTitle, isDueDate, planProgress } from '@/lib/study-plan';

describe('planProgress', () => {
  it('treats an empty plan as 0%', () => {
    expect(planProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('counts finished items and rounds the percentage', () => {
    expect(planProgress([{ done: true }, { done: false }, { done: false }])).toEqual({ done: 1, total: 3, percent: 33 });
    expect(planProgress([{ done: true }, { done: true }])).toEqual({ done: 2, total: 2, percent: 100 });
  });
});

describe('isDueDate', () => {
  it('accepts real YYYY-MM-DD dates', () => {
    expect(isDueDate('2026-11-05')).toBe(true);
    expect(isDueDate('2028-02-29')).toBe(true);
  });

  it('rejects other formats and impossible dates', () => {
    expect(isDueDate('2026-02-30')).toBe(false);
    expect(isDueDate('2027-02-29')).toBe(false);
    expect(isDueDate('2026-13-01')).toBe(false);
    expect(isDueDate('05/11/2026')).toBe(false);
    expect(isDueDate('2026-11-05T10:00:00Z')).toBe(false);
    expect(isDueDate('')).toBe(false);
    expect(isDueDate(null)).toBe(false);
    expect(isDueDate(20261105)).toBe(false);
  });
});

describe('cleanItemTitle', () => {
  it('trims and enforces 1–200 characters', () => {
    expect(cleanItemTitle('  مراجعة الكسور  ')).toBe('مراجعة الكسور');
    expect(cleanItemTitle('   ')).toBeNull();
    expect(cleanItemTitle('x'.repeat(200))).toHaveLength(200);
    expect(cleanItemTitle('x'.repeat(201))).toBeNull();
    expect(cleanItemTitle(5)).toBeNull();
  });
});

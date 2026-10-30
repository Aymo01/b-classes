import { describe, it, expect } from 'vitest';
import { isDueDate, planProgress } from '@/lib/study-plan';

describe('planProgress', () => {
  it('an empty plan is 0%', () => {
    expect(planProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
  it('counts ticked items and rounds the percent', () => {
    expect(planProgress([{ done: true }, { done: false }, { done: false }])).toEqual({ done: 1, total: 3, percent: 33 });
  });
  it('all ticked is 100%', () => {
    expect(planProgress([{ done: true }, { done: true }]).percent).toBe(100);
  });
});

describe('isDueDate', () => {
  it('accepts a real calendar date', () => {
    expect(isDueDate('2026-11-03')).toBe(true);
  });
  it('rejects free text and impossible dates', () => {
    expect(isDueDate('tomorrow')).toBe(false);
    expect(isDueDate('2026-13-45')).toBe(false);
  });
});

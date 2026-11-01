import { describe, it, expect } from 'vitest';
import { gradeLabel, stages } from '@/lib/grades';
import { pageMeta } from '@/lib/page-meta';

describe('Grade labels', () => {
  it('labels grades 1–10 with ordinal names', () => {
    expect(gradeLabel(1)).toBe('الصف الأول');
    expect(gradeLabel(4)).toBe('الصف الرابع');
    expect(gradeLabel(10)).toBe('الصف العاشر');
  });
  it('labels secondary grades distinctly', () => {
    expect(gradeLabel(11)).toBe('الأول الثانوي');
    expect(gradeLabel(12)).toBe('الثاني الثانوي');
  });
  it('names the two single-grade secondary stages after their grade', () => {
    const byId = Object.fromEntries(stages.map((s) => [s.id, s]));
    expect(byId['stage-4']?.range).toBe(gradeLabel(11));
    expect(byId['stage-5']?.range).toBe(gradeLabel(12));
  });
  it('gives every one of the five stages a title, description, range and three highlights', () => {
    expect(stages).toHaveLength(5);
    for (const stage of stages) {
      expect(stage.title.length).toBeGreaterThan(0);
      expect(stage.description.length).toBeGreaterThan(0);
      expect(stage.range.length).toBeGreaterThan(0);
      expect(stage.highlights).toHaveLength(3);
    }
  });
});

describe('Page metadata', () => {
  it('builds titled, social-ready meta for every page', () => {
    const { meta } = pageMeta('عن المنصة', 'وصف الصفحة');
    expect(meta).toContainEqual({ title: 'عن المنصة | B classes' });
    expect(meta).toContainEqual({ name: 'description', content: 'وصف الصفحة' });
    expect(meta).toContainEqual({ property: 'og:title', content: 'عن المنصة | B classes' });
    expect(meta).toContainEqual({ property: 'og:description', content: 'وصف الصفحة' });
    expect(meta).toContainEqual({ property: 'og:type', content: 'website' });
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' });
  });
});

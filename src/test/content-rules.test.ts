import { describe, it, expect } from 'vitest';
import { gradeLabel } from '@/lib/grades';
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

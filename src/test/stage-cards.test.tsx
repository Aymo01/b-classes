import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageCard } from '@/components/stage-card';
import { stageIcon } from '@/components/stage-icon-map';
import { stages } from '@/lib/grades';
import { BookOpen, Library, Sailboat, Target, Trophy } from 'lucide-react';

// Link needs a router; for these tests it only has to expose where it points.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, search, children, ...rest }: { to: string; search?: { stage?: string }; children: React.ReactNode }) => (
    <a href={`${to}?stage=${search?.stage ?? ''}`} {...rest}>{children}</a>
  ),
}));

afterEach(cleanup);

const renderAll = () =>
  render(<div className="stages-grid">{stages.map((stage, index) => <StageCard key={stage.id} stage={stage} index={index} />)}</div>);

describe('home page stage cards', () => {
  it('shows exactly five cards, in stage order, numbered 01 to 05', () => {
    renderAll();
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(5);
    expect(cards.map((c) => c.getAttribute('data-theme'))).toEqual(['stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5']);
    expect(cards.map((c) => c.querySelector('.stage-number')?.textContent)).toEqual(['01', '02', '03', '04', '05']);
  });

  it('each card links to /grades with its own stage', () => {
    renderAll();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/grades?stage=stage-1', '/grades?stage=stage-2', '/grades?stage=stage-3', '/grades?stage=stage-4', '/grades?stage=stage-5']);
  });

  it('keeps the existing text: kicker, title, range, description, highlights and button label', () => {
    renderAll();
    const cards = screen.getAllByRole('article');
    // Stages 2/3 and 4/5 share a title, so cards are matched by position, not by name.
    for (const [i, stage] of stages.entries()) {
      const card = cards[i]!;
      expect(within(card).getByText(stage.range)).toBeTruthy();
      expect(within(card).getByText(stage.description)).toBeTruthy();
      for (const h of stage.highlights) expect(within(card).getByText(h)).toBeTruthy();
      expect(within(card).getByRole('link', { name: /اكتشف المرحلة/ })).toBeTruthy();
    }
  });

  it('the heading is the accessible name, and icons and the wave are hidden from screen readers', () => {
    const { container } = renderAll();
    const cards = screen.getAllByRole('article');
    for (const [i, stage] of stages.entries()) {
      const card = cards[i]!;
      expect(within(card).getByRole('heading', { name: stage.title }).id).toBe(card.getAttribute('aria-labelledby'));
    }
    expect(container.querySelectorAll('.stage-art[aria-hidden="true"]')).toHaveLength(5);
    expect(container.querySelectorAll('svg.stage-wave[aria-hidden="true"]')).toHaveLength(5);
    // Every svg either sits inside a hidden wrapper, is hidden itself, or is the arrow inside the button label.
    for (const svg of container.querySelectorAll('svg')) {
      const hidden = svg.getAttribute('aria-hidden') === 'true' || svg.closest('[aria-hidden="true"]') || svg.closest('a');
      expect(hidden).toBeTruthy();
    }
  });

  it('uses the requested icon for each stage', () => {
    expect([1, 2, 3, 4, 5].map((n) => stageIcon(`stage-${n}` as (typeof stages)[number]['id']))).toEqual([Sailboat, BookOpen, Trophy, Library, Target]);
  });
});

describe('stage card layout (styles.css)', () => {
  const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8');

  it('is five columns on desktop', () => {
    expect(css).toMatch(/\.stages-grid, \.grade-stage-grid \{[^}]*repeat\(5, minmax\(0, 1fr\)\)/);
  });
  it('is three plus two, centred, on tablet', () => {
    const tablet = css.slice(css.indexOf('@media (max-width: 1023px)'));
    expect(tablet).toMatch(/repeat\(6, minmax\(0, 1fr\)\)/);
    expect(tablet).toMatch(/:nth-child\(4\)[^{]*\{ grid-column: 2 \/ span 2/);
    expect(tablet).toMatch(/:nth-child\(5\)[^{]*\{ grid-column: 4 \/ span 2/);
  });
  it('is one card per row with a 16px side margin on phones', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 767px)'));
    expect(phone).toMatch(/grid-template-columns: minmax\(0, 1fr\)/);
    expect(phone).toMatch(/width: calc\(100% - 32px\)/);
  });
  it('colours come from the stage tokens: primary top, background body, secondary wave', () => {
    expect(css).toMatch(/\.stage-art \{[^}]*background: var\(--stage-primary\)/);
    expect(css).toMatch(/\.stage-card, \.grade-stage \{[^}]*background: var\(--stage-background\)/);
    expect(css).toMatch(/\.stage-wave \{[^}]*color: var\(--stage-secondary\)/);
  });
  it('lifts on hover and focus and shows a focus outline', () => {
    expect(css).toMatch(/\.stage-card:hover, \.stage-card:focus-within[^{]*\{ transform: translateY\(-4px\)/);
    expect(css).toMatch(/\.stage-card:focus-within[^{]*\{ outline: 3px solid/);
  });
});

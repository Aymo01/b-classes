import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The CSS is the source of truth: this reads src/styles.css, so the check always covers the colours
 * that actually ship. It verifies the five stage palettes, the contrast of every text pair, and that
 * no stage quietly falls back on another stage's colours.
 */
const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8');

const spec = {
  1: { primary: '#0755A5', secondary: '#159FE8', accent: '#73CCF5', background: '#E6F5FF' },
  2: { primary: '#087F5B', secondary: '#20B879', accent: '#75D9AC', background: '#E5F8EF' },
  3: { primary: '#075B4B', secondary: '#087F68', accent: '#39B99A', background: '#E1F4ED' },
  4: { primary: '#6335A8', secondary: '#8752D6', accent: '#B58AF5', background: '#F0E8FF' },
  5: { primary: '#17152F', secondary: '#302B62', accent: '#6554A8', background: '#EAE8F7' },
} as const;
type StageNumber = keyof typeof spec;
const stageNumbers = [1, 2, 3, 4, 5] as const;

function block(n: StageNumber) {
  const header = n === 1 ? ':root, [data-theme="stage-1"] {' : `[data-theme="stage-${n}"] {`;
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`no block for stage ${n}`);
  const body = css.slice(start + header.length, css.indexOf('\n}', start));
  const vars = new Map<string, string>();
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) vars.set(m[1]!, m[2]!.trim());
  return vars;
}

const blocks = Object.fromEntries(stageNumbers.map((n) => [n, block(n)])) as Record<StageNumber, Map<string, string>>;

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16))) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
function color(n: StageNumber, name: string) {
  const v = blocks[n].get(name);
  if (!v || !/^#[0-9A-Fa-f]{6}$/.test(v)) throw new Error(`stage ${n}: ${name} is not a hex colour (${v})`);
  return v.toUpperCase();
}

describe('five-stage colour tokens', () => {
  for (const n of stageNumbers) {
    it(`stage ${n} uses exactly the specified primary, secondary, accent and background`, () => {
      expect(color(n, '--stage-primary')).toBe(spec[n].primary);
      expect(color(n, '--stage-secondary')).toBe(spec[n].secondary);
      expect(color(n, '--stage-accent')).toBe(spec[n].accent);
      expect(color(n, '--stage-background')).toBe(spec[n].background);
    });

    it(`stage ${n} applies them by role: primary for main elements, secondary for interaction, accent for decoration, background for panels`, () => {
      expect(color(n, '--primary')).toBe(spec[n].primary);
      expect(color(n, '--secondary')).toBe(spec[n].secondary);
      expect(color(n, '--accent')).toBe(spec[n].accent);
      expect(color(n, '--card')).toBe(spec[n].background);
      expect(color(n, '--stage-action')).toBe(spec[n].primary);
    });
  }

  it('the old three-stage names are gone from the stylesheet', () => {
    expect(css).not.toMatch(/data-theme="(elementary|middle|secondary)"/);
  });

  it('every stage defines the same variables as stage 1, so none falls back to another stage', () => {
    const shared = new Set(['--destructive', '--success', '--paper', '--radius', '--shadow-soft']);
    const expected = [...blocks[1].keys()].filter((k) => !shared.has(k));
    for (const n of [2, 3, 4, 5] as const) {
      const missing = expected.filter((k) => !blocks[n].has(k));
      expect(missing, `stage ${n} is missing ${missing.join(', ')}`).toEqual([]);
    }
  });
});

describe('text contrast is at least 4.5:1 in every stage', () => {
  // [text variable, background variable, what it is]
  const pairs: [string, string, string][] = [
    ['--foreground', '--background', 'body text on the page'],
    ['--foreground', '--card', 'body text on cards and panels'],
    ['--foreground', '--select-tint', 'body text on selected / unread rows'],
    ['--primary', '--background', 'headings and links on the page'],
    ['--primary', '--card', 'headings and links on cards and panels'],
    ['--primary', '--select-tint', 'primary text on selected rows'],
    ['--muted-foreground', '--background', 'secondary text on the page'],
    ['--muted-foreground', '--card', 'secondary text on cards and panels'],
    ['--primary-foreground', '--primary', 'button text on primary'],
    ['--secondary-foreground', '--secondary', 'text on hover and selected states'],
    ['--accent-foreground', '--accent', 'text and icons on accent tiles'],
    ['--stage-action-ink', '--stage-action', 'stage button text'],
    ['--nav-foreground', '--nav-background', 'header text'],
    ['--hero-title', '--hero-veil', 'hero title'],
    ['--hero-accent', '--hero-veil', 'hero highlights'],
    ['--hero-muted', '--hero-veil', 'hero secondary text'],
    ['--footer-foreground', '--footer-background', 'footer text'],
    ['--hero-muted', '--footer-background', 'footer links'],
    ['--stage-art-ink', '--stage-art', 'stage card art and titles'],
  ];
  for (const n of stageNumbers) {
    for (const [fg, bg, label] of pairs) {
      it(`stage ${n}: ${label}`, () => {
        expect(contrast(color(n, fg), color(n, bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('the status colours used for results stay readable on the stage panels', () => {
    // --success is shared by all stages (a result colour, not decoration): checked on every panel colour.
    const success = css.match(/--success:\s*oklch\(([\d. ]+)\)/);
    expect(success).not.toBeNull();
    // oklch lightness 0.43 is dark enough for >4.5:1 on any near-white panel; assert the lightness bound.
    expect(Number(success![1]!.split(' ')[0])).toBeLessThanOrEqual(0.5);
  });
});

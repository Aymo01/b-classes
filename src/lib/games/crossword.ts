/** A small crossword layout: words cross on shared letters, no letters are shown to the player. */

export type PlacedWord = { id: string; word: string; clue: string; row: number; col: number; dir: 'across' | 'down'; number: number; length: number };
export type Crossword = { rows: number; cols: number; entries: PlacedWord[] };

type Input = { id: string; word: string; clue: string };

const MAX = 13;

/** Greedy layout: the longest word goes across the middle, each next word crosses an earlier one. Words that
 *  cannot cross anything are left out, so the caller must use the returned entries, not its own list. */
export function buildCrossword(words: readonly Input[]): Crossword {
  const list = words.map((w) => ({ ...w, letters: [...w.word.trim()] })).filter((w) => w.letters.length >= 2 && w.letters.length <= MAX).sort((a, b) => b.letters.length - a.letters.length);
  if (list.length === 0) return { rows: 0, cols: 0, entries: [] };

  const cells = new Map<string, string>();
  const key = (r: number, c: number) => `${r},${c}`;
  const placed: { id: string; word: string; clue: string; row: number; col: number; dir: 'across' | 'down'; letters: string[] }[] = [];

  const fits = (letters: string[], row: number, col: number, dir: 'across' | 'down') => {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    if (cells.has(key(row - dr, col - dc)) || cells.has(key(row + dr * letters.length, col + dc * letters.length))) return false;
    let crossings = 0;
    for (let i = 0; i < letters.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const existing = cells.get(key(r, c));
      if (existing !== undefined) {
        if (existing !== letters[i]) return false;
        crossings++;
      } else if (cells.has(key(r + dc, c + dr)) || cells.has(key(r - dc, c - dr))) {
        return false; // would touch a parallel word
      }
    }
    return crossings === 1;
  };
  const put = (w: (typeof list)[number], row: number, col: number, dir: 'across' | 'down') => {
    for (let i = 0; i < w.letters.length; i++) cells.set(key(row + (dir === 'down' ? i : 0), col + (dir === 'across' ? i : 0)), w.letters[i]!);
    placed.push({ id: w.id, word: w.word, clue: w.clue, row, col, dir, letters: w.letters });
  };

  put(list[0]!, 0, 0, 'across');
  for (const w of list.slice(1)) {
    let done = false;
    for (const prev of placed) {
      if (done) break;
      const dir = prev.dir === 'across' ? 'down' : 'across';
      for (let i = 0; i < prev.letters.length && !done; i++) {
        for (let j = 0; j < w.letters.length && !done; j++) {
          if (prev.letters[i] !== w.letters[j]) continue;
          const row = dir === 'down' ? prev.row - j : prev.row + i;
          const col = dir === 'down' ? prev.col + i : prev.col - j;
          if (fits(w.letters, row, col, dir)) {
            put(w, row, col, dir);
            done = true;
          }
        }
      }
    }
  }

  const minR = Math.min(...placed.map((p) => p.row));
  const minC = Math.min(...placed.map((p) => p.col));
  const shifted = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  const rows = Math.max(...shifted.map((p) => p.row + (p.dir === 'down' ? p.letters.length : 1)));
  const cols = Math.max(...shifted.map((p) => p.col + (p.dir === 'across' ? p.letters.length : 1)));

  // Numbers follow reading order of the start cells; an across and a down word starting together share one.
  const starts = [...new Set(shifted.map((p) => `${p.row},${p.col}`))].sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number) as [number, number];
    const [br, bc] = b.split(',').map(Number) as [number, number];
    return ar - br || ac - bc;
  });
  const entries = shifted
    .map((p) => ({ id: p.id, word: p.word, clue: p.clue, row: p.row, col: p.col, dir: p.dir, length: p.letters.length, number: starts.indexOf(`${p.row},${p.col}`) + 1 }))
    .sort((a, b) => a.number - b.number || (a.dir === 'across' ? -1 : 1));
  return { rows, cols, entries };
}

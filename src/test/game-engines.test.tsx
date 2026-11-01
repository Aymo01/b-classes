import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardsGame, ChoiceGame, LadderGame, OrderGame, PairGame, type Check, type EngineProps } from '@/components/games/engines';
import { CrosswordGame, MapGame } from '@/components/games/engines-extra';
import type { CheckDTO } from '@/lib/games.functions';
import type { ClientQuestion, PublicLayout } from '@/lib/games/rules';

/**
 * These screens never know an answer: every verdict below comes from a fake `check`, standing in for the server.
 * That is also what the tests assert, that the screen asks the server and shows what it says.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Props = Partial<EngineProps> & { check: Check };
const base = { layout: {} as PublicLayout, config: {} as EngineProps['config'], questions: [] as ClientQuestion[] };
function setup(Game: (p: EngineProps) => React.ReactElement | null, props: Props) {
  const onDone = vi.fn();
  render(<Game {...base} {...props} onDone={onDone} />);
  return onDone;
}
const verdict = (v: Partial<CheckDTO> & { correct: boolean }): Check => vi.fn(async () => v as CheckDTO);

const mc = (id: string): ClientQuestion => ({ id, kind: 'choice', prompt: `سؤال ${id}`, options: ['أول', 'ثان', 'ثالث'] });

describe('choice screen', () => {
  it('sends the chosen option to the server and shows its verdict in words', async () => {
    const check = verdict({ correct: true, reveal: { correctIndex: 1 } });
    const onDone = setup(ChoiceGame, { questions: [mc('a')], check });
    fireEvent.click(screen.getByRole('button', { name: 'ثان' }));
    expect(await screen.findByText('إجابة صحيحة')).toBeTruthy();
    expect(check).toHaveBeenCalledWith('a', { choice: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows a wrong answer with the correct option named, using text and not colour alone', async () => {
    setup(ChoiceGame, { questions: [mc('a')], check: verdict({ correct: false, reveal: { correctIndex: 2 } }) });
    fireEvent.click(screen.getByRole('button', { name: 'أول' }));
    expect(await screen.findByText(/إجابة خاطئة — الصحيحة: ثالث/)).toBeTruthy();
    expect(screen.getByText('الصحيحة')).toBeTruthy();
    expect(screen.getByText('اختيارك')).toBeTruthy();
  });

  it('skips questions already answered in a resumed run', () => {
    setup(ChoiceGame, { questions: [mc('a'), mc('b')], answered: ['a'], check: verdict({ correct: true }) });
    expect(screen.getByText('سؤال b')).toBeTruthy();
    expect(screen.queryByText('سؤال a')).toBeNull();
  });

  it('shows the error when the server refuses an answer', async () => {
    const check: Check = vi.fn(async () => { throw new Error('انتهى الوقت.'); });
    setup(ChoiceGame, { questions: [mc('a')], check });
    fireEvent.click(screen.getByRole('button', { name: 'أول' }));
    expect((await screen.findByRole('alert')).textContent).toContain('انتهى الوقت');
  });

  it('answer buttons are real buttons, so every game works from the keyboard', () => {
    setup(ChoiceGame, { questions: [mc('a')], check: verdict({ correct: true }) });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b.tagName).toBe('BUTTON');
  });

  it('a timed sprint calls done when the clock runs out', () => {
    vi.useFakeTimers();
    const onDone = setup(ChoiceGame, { questions: [mc('a')], config: { timeLimit: 60 }, check: verdict({ correct: true }) });
    expect(screen.getByRole('timer').textContent).toContain('60');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Letter Garden grows one flower per correct answer', async () => {
    setup(ChoiceGame, { questions: [mc('a'), mc('b')], config: { growth: true }, check: verdict({ correct: true, reveal: { correctIndex: 0 } }) });
    expect(screen.getByText('الأزهار: 0')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'أول' }));
    expect(await screen.findByText('الأزهار: 1')).toBeTruthy();
  });
});

describe('Escape Room screen', () => {
  const config = { rooms: 3, maxWrong: 3, lockSeconds: 60 };
  const qs = [mc('a'), mc('b'), mc('c'), mc('d')];

  it('a room opens only after a correct answer', async () => {
    const check = vi.fn<Check>()
      .mockResolvedValueOnce({ correct: false, reveal: { correctIndex: 1 }, opened: 0 })
      .mockResolvedValueOnce({ correct: true, reveal: { correctIndex: 0 }, opened: 1 });
    setup(ChoiceGame, { questions: qs, config, check });
    expect(screen.getByText('الغرف المفتوحة: 0 من 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'أول' }));
    await screen.findByText(/إجابة خاطئة/);
    expect(screen.queryByText('فُتحت الغرفة')).toBeNull();
    expect(screen.getByText('الغرف المفتوحة: 0 من 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }));
    fireEvent.click(screen.getByRole('button', { name: 'أول' }));
    expect(await screen.findByText('فُتحت الغرفة')).toBeTruthy();
    expect(screen.getByText('الغرف المفتوحة: 1 من 3')).toBeTruthy();
  });

  it('three wrong answers in a row lock the room and the options cannot be pressed', async () => {
    const check: Check = vi.fn(async () => ({ correct: false, reveal: { correctIndex: 2 }, opened: 0, locked: { seconds: 60 } }));
    setup(ChoiceGame, { questions: qs, config, check });
    fireEvent.click(screen.getByRole('button', { name: 'أول' }));
    expect((await screen.findByText(/الغرفة مقفلة بعد ثلاث إجابات خاطئة متتالية/)).textContent).toContain('60 ثانية');
    for (const b of screen.getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it('the lock lifts after the minute and answering works again', async () => {
    vi.useFakeTimers();
    const check: Check = vi.fn(async () => ({ correct: false, reveal: { correctIndex: 2 }, opened: 0, locked: { seconds: 60 } }));
    setup(ChoiceGame, { questions: qs, config, check });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'أول' })); });
    expect(screen.getByText(/الغرفة مقفلة/)).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(screen.queryByText(/الغرفة مقفلة/)).toBeNull();
  });

  it('a request refused because the room is still locked starts the countdown instead of showing a verdict', async () => {
    const check: Check = vi.fn(async () => ({ correct: false, locked: { seconds: 42 } }));
    setup(ChoiceGame, { questions: qs, config, check });
    fireEvent.click(screen.getByRole('button', { name: 'أول' }));
    expect(await screen.findByText(/حاول بعد 42 ثانية/)).toBeTruthy();
    expect(screen.queryByText(/إجابة خاطئة/)).toBeNull();
  });
});

describe('pair screens', () => {
  const lefts: ClientQuestion[] = [{ id: 'p1', kind: 'pair', left: 'مربع' }, { id: 'p2', kind: 'pair', left: 'دائرة' }];
  const layout: PublicLayout = { rights: ['صندوق', 'كرة'] };
  const checkRight = (map: Record<string, string>): Check => vi.fn(async (id, a) => ({ correct: map[id!] === (a as { right: string }).right }));

  it('match: finishes when every pair is right, and a wrong try is reported in words', async () => {
    const check = checkRight({ p1: 'صندوق', p2: 'كرة' });
    const onDone = setup(PairGame, { questions: lefts, layout, config: { mode: 'match' }, check });
    fireEvent.click(screen.getByRole('button', { name: 'مربع' }));
    fireEvent.click(screen.getByRole('button', { name: 'كرة' }));
    expect(await screen.findByText('إجابة خاطئة')).toBeTruthy();
    expect(screen.getByText(/المحاولات الخاطئة: 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'مربع' }));
    fireEvent.click(screen.getByRole('button', { name: 'صندوق' }));
    await waitFor(() => expect(screen.getByText(/المطابقات: 1 من 2/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'دائرة' }));
    fireEvent.click(screen.getByRole('button', { name: 'كرة' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('assign (Shape Sorter): dragging a shape onto its holder sends that pair to the server', async () => {
    const check = checkRight({ p1: 'صندوق', p2: 'كرة' });
    setup(PairGame, { questions: lefts, layout, config: { mode: 'assign' }, check });
    const shape = screen.getByRole('button', { name: 'مربع' });
    expect(shape.getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(shape);
    fireEvent.dragOver(screen.getByRole('button', { name: 'صندوق' }));
    fireEvent.drop(screen.getByRole('button', { name: 'صندوق' }));
    await waitFor(() => expect(check).toHaveBeenCalledWith('p1', { right: 'صندوق' }));
    expect(await screen.findByText(/المطابقات: 1 من 2/)).toBeTruthy();
  });

  it('assign: keyboard fallback, choose the shape then the holder, works without dragging', async () => {
    const check = checkRight({ p1: 'صندوق', p2: 'كرة' });
    setup(PairGame, { questions: lefts, layout, config: { mode: 'assign' }, check });
    fireEvent.click(screen.getByRole('button', { name: 'دائرة' }));
    expect(screen.getByRole('button', { name: 'دائرة' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'كرة' }));
    await waitFor(() => expect(check).toHaveBeenCalledWith('p2', { right: 'كرة' }));
  });

  it('assign: dropping on a holder with no shape chosen asks to pick the shape first', async () => {
    setup(PairGame, { questions: lefts, layout, config: { mode: 'assign' }, check: checkRight({}) });
    fireEvent.click(screen.getByRole('button', { name: 'كرة' }));
    expect(await screen.findByText('اختر الشكل أولًا ثم الحاوية')).toBeTruthy();
  });

  it('flip: the server decides whether two positions match; the board only shows card texts', async () => {
    const flipLayout: PublicLayout = { flipCards: [{ text: 'Dog' }, { text: 'كلب' }] };
    const check: Check = vi.fn(async () => ({ correct: true, itemId: 'p1' }));
    const onDone = setup(PairGame, { layout: flipLayout, config: { mode: 'flip' }, check });
    const cards = screen.getAllByRole('button');
    fireEvent.click(cards[0]!);
    fireEvent.click(cards[1]!);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(check).toHaveBeenCalledWith(undefined, { a: 0, b: 1 });
  });

  it('flip: a non-matching pair turns back over and counts as a miss', async () => {
    const flipLayout: PublicLayout = { flipCards: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }] };
    setup(PairGame, { layout: flipLayout, config: { mode: 'flip' }, check: verdict({ correct: false, itemId: 'x' }) });
    const cards = screen.getAllByRole('button');
    fireEvent.click(cards[0]!);
    fireEvent.click(cards[1]!);
    expect(await screen.findByText(/المحاولات الخاطئة: 1/)).toBeTruthy();
    expect(screen.getByText('إجابة خاطئة')).toBeTruthy();
  });
});

describe('order screen', () => {
  const sentence: ClientQuestion = { id: 'o1', kind: 'order', prompt: 'رتّب الجملة', chips: ['المدرسة', 'ذهب', 'الولد'] };
  const place = (words: string[]) => words.forEach((w) => fireEvent.click(screen.getByRole('button', { name: w })));

  it('sends the student\'s order to the server and moves on only when it is right', async () => {
    const check: Check = vi.fn(async (_id, a) => ({ correct: (a as { sequence: string[] }).sequence.join(' ') === 'ذهب الولد المدرسة' }));
    const onDone = setup(OrderGame, { questions: [sentence], check });
    expect((screen.getByRole('button', { name: 'تحقّق' }) as HTMLButtonElement).disabled).toBe(true);
    place(['الولد', 'ذهب', 'المدرسة']);
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(await screen.findByText('إجابة خاطئة')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ابدأ من جديد/ }));
    place(['ذهب', 'الولد', 'المدرسة']);
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(await screen.findByText('إجابة صحيحة')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a placed item can be taken back out', () => {
    setup(OrderGame, { questions: [sentence], check: verdict({ correct: true }) });
    fireEvent.click(screen.getByRole('button', { name: 'ذهب' }));
    fireEvent.click(screen.getByRole('button', { name: /ذهب/ }));
    expect(screen.getByText('لم تختر شيئًا بعد')).toBeTruthy();
  });
});

describe('cards screen', () => {
  const card: ClientQuestion = { id: 'c1', kind: 'card', front: 'ما عاصمة فلسطين؟', back: 'القدس' };

  it('hides the answer until asked, then records whether the student knew it', async () => {
    const check = verdict({ correct: true });
    const onDone = setup(CardsGame, { questions: [card], check });
    expect(screen.queryByText('القدس')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    expect(screen.getByText('القدس')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /عرفتها/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(check).toHaveBeenCalledWith('c1', { known: true });
  });

  it('Recall Cards bring a missed card back and finish once it is known', async () => {
    const check = vi.fn<Check>().mockResolvedValueOnce({ correct: false }).mockResolvedValueOnce({ correct: true });
    const onDone = setup(CardsGame, { questions: [card], config: { repeatMissed: true }, check });
    fireEvent.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    fireEvent.click(screen.getByRole('button', { name: /لم أعرفها/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /عرفتها/ })).toBeNull());
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    fireEvent.click(screen.getByRole('button', { name: /عرفتها/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('a card missed again and again still ends the game (at most two repeats)', async () => {
    const onDone = setup(CardsGame, { questions: [card], config: { repeatMissed: true }, check: verdict({ correct: false }) });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(await screen.findByRole('button', { name: 'اعرض الإجابة' }));
      fireEvent.click(screen.getByRole('button', { name: /لم أعرفها/ }));
      await waitFor(() => expect(screen.queryByRole('button', { name: /عرفتها/ })).toBeNull());
    }
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('Flashcard Streak shows the multiplier as the streak grows', async () => {
    const cards: ClientQuestion[] = Array.from({ length: 4 }, (_, i) => ({ id: `k${i}`, kind: 'card', front: `س${i}`, back: `ج${i}` }));
    setup(CardsGame, { questions: cards, config: { streak: true }, check: verdict({ correct: true }) });
    expect(screen.getByText(/المضاعف ×1/)).toBeTruthy();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(await screen.findByRole('button', { name: 'اعرض الإجابة' }));
      fireEvent.click(screen.getByRole('button', { name: /عرفتها/ }));
      await waitFor(() => expect(screen.queryByRole('button', { name: /عرفتها/ })).toBeNull());
    }
    expect(await screen.findByText(/المضاعف ×2/)).toBeTruthy();
  });
});

describe('ladder screen', () => {
  const ladder: ClientQuestion = { id: 'l1', kind: 'ladder', start: 'cat', target: 'cot', words: ['cot'] };
  const type = (value: string) => {
    fireEvent.change(screen.getByLabelText(/الكلمة التالية/), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'أضف الخطوة' }));
  };

  it('rejects a step that changes two letters or the length, with a message, without asking the server', () => {
    const check = verdict({ correct: true });
    setup(LadderGame, { questions: [ladder], check });
    type('dog');
    expect(screen.getByRole('alert').textContent).toContain('حرفًا واحدًا');
    type('cats');
    expect(screen.getByRole('alert').textContent).toContain('بنفس عدد الحروف');
    expect(check).not.toHaveBeenCalled();
  });

  it('reaching the target sends the steps to the server and finishes', async () => {
    const check = verdict({ correct: true });
    const onDone = setup(LadderGame, { questions: [ladder], check });
    type('cot');
    expect(await screen.findByText('وصلت إلى الكلمة الهدف')).toBeTruthy();
    expect(check).toHaveBeenCalledWith('l1', { steps: ['cot'] });
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('giving up tells the server and moves on', async () => {
    const check = verdict({ correct: false });
    const onDone = setup(LadderGame, { questions: [ladder], check });
    fireEvent.click(screen.getByRole('button', { name: 'استسلم' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(check).toHaveBeenCalledWith('l1', { giveUp: true });
  });
});

describe('Map Hunt screen', () => {
  const place: ClientQuestion = { id: 'm1', kind: 'place', prompt: 'القدس', mapUrl: '/maps/palestine.png' };

  it('the map can be used with the keyboard: arrow keys move the marker and Enter confirms', async () => {
    const check = verdict({ correct: true, reveal: { x: 52, y: 50, radius: 5 } });
    setup(MapGame, { questions: [place], check });
    const map = screen.getByRole('group', { name: /خريطة للبحث عن القدس/ });
    expect(map.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    expect(screen.getByText(/52٪ أفقيًا و50٪ عموديًا/)).toBeTruthy();
    fireEvent.keyDown(map, { key: 'Enter' });
    expect(await screen.findByText('إجابة صحيحة')).toBeTruthy();
    expect(check).toHaveBeenCalledWith('m1', { x: 52, y: 50 });
  });

  it('a wrong guess shows the right spot in words as well as on the map', async () => {
    setup(MapGame, { questions: [place], check: verdict({ correct: false, reveal: { x: 10, y: 10, radius: 5 } }) });
    const map = screen.getByRole('group');
    fireEvent.keyDown(map, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد المكان' }));
    expect(await screen.findByText('إجابة خاطئة')).toBeTruthy();
    expect(screen.getByText(/العلامة الخضراء/)).toBeTruthy();
  });

  it('cannot confirm before a place is marked', () => {
    setup(MapGame, { questions: [place], check: verdict({ correct: true }) });
    expect((screen.getByRole('button', { name: 'تأكيد المكان' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the map image is decorative (the place name is in the heading and the group label)', () => {
    const { container } = render(<MapGame {...base} questions={[place]} check={verdict({ correct: true })} onDone={() => {}} />);
    expect(container.querySelector('.game-map img')?.getAttribute('alt')).toBe('');
  });
});

describe('Crossword screen', () => {
  const layout: PublicLayout = { crossword: { rows: 3, cols: 5, entries: [
    { id: 'w1', number: 1, row: 0, col: 0, dir: 'across', length: 5, clue: 'سائل نشربه' },
    { id: 'w2', number: 2, row: 0, col: 2, dir: 'down', length: 3, clue: 'نبات كبير' },
  ] } };

  it('sends each full word to the server, marks right and wrong in words, and finishes only after a check', async () => {
    const check: Check = vi.fn(async (id) => ({ correct: id === 'w1' }));
    const onDone = setup(CrosswordGame, { layout, check });
    expect((screen.getByRole('button', { name: 'إنهاء اللعبة' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/1\. أفقي/), { target: { value: 'water' } });
    fireEvent.change(screen.getByLabelText(/2\. عمودي/), { target: { value: 'tre' } });
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق من الكلمات' }));
    expect(await screen.findByText('صحيحة')).toBeTruthy();
    expect(screen.getByText(/خاطئة، جرّب مرة أخرى/)).toBeTruthy();
    expect(check).toHaveBeenCalledWith('w1', { word: 'water' });
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does not send a word of the wrong length', async () => {
    const check = verdict({ correct: true });
    setup(CrosswordGame, { layout, check });
    fireEvent.change(screen.getByLabelText(/1\. أفقي/), { target: { value: 'wat' } });
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق من الكلمات' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'تحقّق من الكلمات' }) as HTMLButtonElement).disabled).toBe(false));
    expect(check).not.toHaveBeenCalled();
  });

  it('every clue has a labelled input, so the puzzle works without the mouse', () => {
    setup(CrosswordGame, { layout, check: verdict({ correct: true }) });
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });
});

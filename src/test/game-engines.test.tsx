import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardsGame, ChoiceGame, LadderGame, OrderGame, PairGame, type EngineResult } from '@/components/games/engines';
import type { GameItemDTO } from '@/lib/games.functions';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const item = (id: string, kind: string, payload: GameItemDTO['payload'], topic: string | null = null): GameItemDTO => ({ id, kind, topic, qtype: null, payload });
const choice = (id: string, correct = 0) => item(id, 'choice', { prompt: `سؤال ${id}`, options: ['الصحيح', 'الخاطئ', 'آخر'], correct }, 't1');

function setup(ui: (onFinish: (r: EngineResult) => void) => React.ReactElement) {
  const onFinish = vi.fn<(r: EngineResult) => void>();
  render(ui(onFinish));
  return onFinish;
}

describe('choice engine', () => {
  it('scores a correct answer, says so in words, and finishes with the saved result', () => {
    const onFinish = setup((f) => <ChoiceGame items={[choice('a')]} config={{ questionCount: 1 }} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: /الصحيح/ }));
    expect(screen.getByText('إجابة صحيحة')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 10, max: 10, details: { answered: 1, correct: 1, wrongItemIds: [] } });
  });

  it('marks a wrong answer with text and the correct option, scores 0 and records the item for Mistake Bank', () => {
    const onFinish = setup((f) => <ChoiceGame items={[choice('a')]} config={{ questionCount: 1 }} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: /الخاطئ/ }));
    expect(screen.getByText(/إجابة خاطئة — الصحيحة: الصحيح/)).toBeTruthy();
    expect(screen.getByText('الصحيحة')).toBeTruthy();
    expect(screen.getByText('اختيارك')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 0, max: 10, details: { wrongItemIds: ['a'] } });
  });

  it('ignores malformed items and limits the number of questions', () => {
    const bad = item('bad', 'choice', { prompt: 'x', options: ['one'], correct: 0 });
    const onFinish = setup((f) => <ChoiceGame items={[bad, choice('a'), choice('b'), choice('c')]} config={{ questionCount: 2 }} onFinish={f} />);
    expect(screen.getByText(/السؤال 1 من 2/)).toBeTruthy();
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: /الصحيح/ }));
      fireEvent.click(screen.getByRole('button', { name: /التالي|إنهاء اللعبة/ }));
    }
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 20, max: 20 });
  });

  it('every answer button is a real button, so the whole game works from the keyboard', () => {
    setup((f) => <ChoiceGame items={[choice('a')]} config={{}} onFinish={f} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b.tagName).toBe('BUTTON');
  });

  it('the 60-second sprint ends when time runs out and reports what was answered', () => {
    vi.useFakeTimers();
    const onFinish = setup((f) => <ChoiceGame items={[choice('a'), choice('b')]} config={{ timeLimit: 60, questionCount: 60 }} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: /الصحيح/ }));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 10, max: 10, details: { timedOut: true, answered: 1 } });
  });

  it('time out with nothing answered gives 0 of 0, which the shell does not save', () => {
    vi.useFakeTimers();
    const onFinish = setup((f) => <ChoiceGame items={[choice('a')]} config={{ timeLimit: 5 }} onFinish={f} />);
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 0, max: 0 });
  });

  it('Letter Garden grows one flower per correct answer', () => {
    setup((f) => <ChoiceGame items={[choice('a'), choice('b')]} config={{ growth: true }} onFinish={f} />);
    expect(screen.getByText('الأزهار: 0')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /الصحيح/ }));
    expect(screen.getByText('الأزهار: 1')).toBeTruthy();
  });

  it('Escape Room says how many questions open the next room, then opens it', () => {
    setup((f) => <ChoiceGame items={[choice('a'), choice('b'), choice('c'), choice('d')]} config={{ roomSize: 3, questionCount: 4 }} onFinish={f} />);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: /الصحيح/ }));
      if (i < 2) fireEvent.click(screen.getByRole('button', { name: 'التالي' }));
    }
    expect(screen.getByText('فُتحت الغرفة التالية')).toBeTruthy();
  });
});

describe('pair engine', () => {
  const pairs = [item('p1', 'pair', { left: 'Apple', right: 'تفاحة' }), item('p2', 'pair', { left: 'Dog', right: 'كلب' })];

  it('match mode: right pairs finish with a full score', () => {
    const onFinish = setup((f) => <PairGame items={pairs} config={{ mode: 'match' }} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    fireEvent.click(screen.getByRole('button', { name: 'تفاحة' }));
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dog' }));
    fireEvent.click(screen.getByRole('button', { name: 'كلب' }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 20, max: 20, details: { misses: 0 } });
  });

  it('a wrong match costs 2 points and is announced in words', () => {
    const onFinish = setup((f) => <PairGame items={pairs} config={{ mode: 'match' }} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    fireEvent.click(screen.getByRole('button', { name: 'كلب' }));
    expect(screen.getByText('إجابة خاطئة')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    fireEvent.click(screen.getByRole('button', { name: 'تفاحة' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dog' }));
    fireEvent.click(screen.getByRole('button', { name: 'كلب' }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 18, max: 20, details: { misses: 1 } });
  });

  it('asks to pick an item first when a holder is chosen with nothing selected', () => {
    setup((f) => <PairGame items={pairs} config={{ mode: 'assign' }} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: 'كلب' }));
    expect(screen.getByText('اختر الشكل أولًا ثم الحاوية')).toBeTruthy();
  });

  it('assign mode lets several shapes share one holder', () => {
    const shapes = [item('s1', 'pair', { left: 'مربع', right: 'صندوق' }), item('s2', 'pair', { left: 'مستطيل', right: 'صندوق' })];
    const onFinish = setup((f) => <PairGame items={shapes} config={{ mode: 'assign' }} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: 'مربع' }));
    fireEvent.click(screen.getByRole('button', { name: 'صندوق' }));
    fireEvent.click(screen.getByRole('button', { name: /مستطيل/ }));
    fireEvent.click(screen.getByRole('button', { name: 'صندوق' }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 20, max: 20 });
  });

  it('flip mode: flipping both cards of a pair matches them', () => {
    const onFinish = setup((f) => <PairGame items={[pairs[0]!]} config={{ mode: 'flip' }} onFinish={f} />);
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(2);
    fireEvent.click(cards[0]!);
    fireEvent.click(cards[1]!);
    expect(screen.getByText('إجابة صحيحة')).toBeTruthy();
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 10, max: 10 });
  });

  it('flip mode: unmatched cards turn back and count as a miss', () => {
    vi.useFakeTimers();
    setup((f) => <PairGame items={pairs} config={{ mode: 'flip' }} onFinish={f} />);
    const owner = (b: HTMLElement) => b;
    const cards = screen.getAllByRole('button').map(owner);
    // Flip cards until two with different text are open: the first two buttons of a shuffled board may or may not match.
    fireEvent.click(cards[0]!);
    const first = cards[0]!.textContent;
    let other = cards.slice(1).find((c) => c.getAttribute('aria-label')?.includes('مقلوبة'));
    fireEvent.click(other!);
    const matched = screen.queryByText('إجابة صحيحة');
    if (!matched) {
      expect(screen.getByText(/إجابة خاطئة/)).toBeTruthy();
      expect(screen.getByText(/المحاولات الخاطئة: 1/)).toBeTruthy();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(cards[0]!.textContent).not.toBe(first);
    }
    other = undefined;
  });
});

describe('order engine', () => {
  const sentence = item('o1', 'order', { prompt: 'رتّب الجملة', sequence: ['ذهب', 'الولد', 'إلى', 'المدرسة'] });

  function placeInOrder(words: string[]) {
    for (const w of words) fireEvent.click(screen.getByRole('button', { name: w }));
  }

  it('the right order scores 10 on the first check', () => {
    const onFinish = setup((f) => <OrderGame items={[sentence]} config={{}} onFinish={f} />);
    expect((screen.getByRole('button', { name: 'تحقّق' }) as HTMLButtonElement).disabled).toBe(true);
    placeInOrder(['ذهب', 'الولد', 'إلى', 'المدرسة']);
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(screen.getByText('إجابة صحيحة')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 10, max: 10 });
  });

  it('a wrong order says so, lets you retry, and then scores 0 for that round', () => {
    const onFinish = setup((f) => <OrderGame items={[sentence]} config={{}} onFinish={f} />);
    placeInOrder(['الولد', 'ذهب', 'إلى', 'المدرسة']);
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(screen.getByText('إجابة خاطئة')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ابدأ من جديد/ }));
    placeInOrder(['ذهب', 'الولد', 'إلى', 'المدرسة']);
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق' }));
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 0, max: 10, details: { wrongItemIds: ['o1'] } });
  });

  it('a placed item can be taken back out', () => {
    setup((f) => <OrderGame items={[sentence]} config={{}} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: 'ذهب' }));
    expect(screen.getAllByRole('button', { name: /ذهب/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /ذهب/ }));
    expect(screen.getByText('لم تختر شيئًا بعد')).toBeTruthy();
  });
});

describe('cards engine', () => {
  const card = item('c1', 'card', { front: 'ما عاصمة فلسطين؟', back: 'القدس' });

  it('hides the answer until asked, then scores a known card', () => {
    const onFinish = setup((f) => <CardsGame items={[card]} config={{}} onFinish={f} />);
    expect(screen.queryByText('القدس')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    expect(screen.getByText('القدس')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /عرفتها/ }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 10, max: 10 });
  });

  it('Recall Cards bring a missed card back, then finish once it is known', () => {
    const onFinish = setup((f) => <CardsGame items={[card]} config={{ repeatMissed: true }} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    fireEvent.click(screen.getByRole('button', { name: /لم أعرفها/ }));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText('ما عاصمة فلسطين؟')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    fireEvent.click(screen.getByRole('button', { name: /عرفتها/ }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 10, max: 20 });
  });

  it('a card missed over and over still ends the game (at most two repeats)', () => {
    const onFinish = setup((f) => <CardsGame items={[card]} config={{ repeatMissed: true }} onFinish={f} />);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
      fireEvent.click(screen.getByRole('button', { name: /لم أعرفها/ }));
    }
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 0, max: 30 });
  });

  it('Flashcard Streak shows the multiplier and applies it', () => {
    const cards = Array.from({ length: 4 }, (_, i) => item(`k${i}`, 'card', { front: `س${i}`, back: `ج${i}` }));
    const onFinish = setup((f) => <CardsGame items={cards} config={{ streak: true }} onFinish={f} />);
    expect(screen.getByText(/المضاعف ×1/)).toBeTruthy();
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
      fireEvent.click(screen.getByRole('button', { name: /عرفتها/ }));
      if (i === 2) expect(screen.getByText(/المضاعف ×2/)).toBeTruthy();
    }
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 50, max: 50, details: { bestStreak: 4 } });
  });
});

describe('ladder engine', () => {
  const ladder = item('l1', 'ladder', { start: 'cat', target: 'cot', words: ['cot'] });

  function type(value: string) {
    fireEvent.change(screen.getByLabelText(/الكلمة التالية/), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'أضف الخطوة' }));
  }

  it('rejects a step that changes two letters, or a different length, with a message', () => {
    setup((f) => <LadderGame items={[ladder]} config={{}} onFinish={f} />);
    type('dog');
    expect(screen.getByRole('alert').textContent).toContain('حرفًا واحدًا');
    type('cats');
    expect(screen.getByRole('alert').textContent).toContain('بنفس عدد الحروف');
  });

  it('reaching the target finishes with a full score', () => {
    const onFinish = setup((f) => <LadderGame items={[ladder]} config={{}} onFinish={f} />);
    type('cot');
    expect(screen.getByText('وصلت إلى الكلمة الهدف')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء اللعبة' }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 10, max: 10 });
  });

  it('giving up scores 0 for that ladder', () => {
    const onFinish = setup((f) => <LadderGame items={[ladder]} config={{}} onFinish={f} />);
    fireEvent.click(screen.getByRole('button', { name: 'استسلم' }));
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ score: 0, max: 10 });
  });
});

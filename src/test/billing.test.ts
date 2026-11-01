import { describe, expect, it } from 'vitest';
import {
  gradeGroup,
  nextChildPosition,
  quoteCart,
  quoteItem,
  siblingPercent,
  type CartItem,
  type Offer,
  type PricingConfig,
} from '@/lib/billing/pricing';
import { childHasAccess, expiryState, isActive, planWindow, pickPeriod, type Period, type SubscriptionLike } from '@/lib/billing/subscription';
import { checkReferral, generateReferralCode, normalizeReferralCode } from '@/lib/billing/referral';
import { canTransition } from '@/lib/billing/live';

const NOW = new Date('2026-09-15T10:00:00Z');

const offer = (over: Partial<Offer> = {}): Offer => ({
  id: 'launch',
  name: 'launch',
  percent: 10,
  startsAt: '2026-09-01T00:00:00Z',
  endsAt: '2026-09-30T23:59:59Z',
  planTypes: ['monthly', 'term', 'yearly'],
  renewalOnly: false,
  active: true,
  ...over,
});

// Test-only numbers: real prices live in the database.
const cfg = (over: Partial<PricingConfig> = {}): PricingConfig => ({
  fullPrices: [
    { gradeGroup: 'g1-4', planType: 'monthly', price: 100 },
    { gradeGroup: 'g5-8', planType: 'monthly', price: 200 },
    { gradeGroup: 'tawjihi', planType: 'yearly', price: 1000 },
  ],
  subjectPrices: [{ subjectId: 'math', planType: 'monthly', price: 40 }],
  siblingTiers: [
    { position: 2, percent: 10 },
    { position: 3, percent: 15 },
    { position: 4, percent: 20 },
  ],
  offers: [],
  usedOfferIds: new Set(),
  referralPercent: null,
  promoCapPercent: 15,
  now: NOW,
  ...over,
});

const item = (over: Partial<CartItem> = {}): CartItem => ({
  childId: 'c1',
  position: 1,
  grade: 3,
  planType: 'monthly',
  scope: 'grade',
  subjectId: null,
  renewal: false,
  ...over,
});

const final = (i: CartItem, c: PricingConfig) => {
  const q = quoteItem(i, c);
  if (!q.available) throw new Error('unavailable');
  return q;
};

describe('grade groups', () => {
  it('maps grades 1-12 to the five price groups', () => {
    expect([1, 4, 5, 8, 9, 10, 11, 12].map(gradeGroup)).toEqual(['g1-4', 'g1-4', 'g5-8', 'g5-8', 'g9-10', 'g9-10', 'first-secondary', 'tawjihi']);
  });
  it('rejects grades outside 1-12', () => {
    expect(gradeGroup(0)).toBeNull();
    expect(gradeGroup(13)).toBeNull();
    expect(gradeGroup(2.5)).toBeNull();
  });
});

describe('prices come from the config', () => {
  it('full-grade price by group and plan type', () => {
    expect(final(item({ grade: 3 }), cfg()).listPrice).toBe(100);
    expect(final(item({ grade: 6 }), cfg()).listPrice).toBe(200);
    expect(final(item({ grade: 12, planType: 'yearly' }), cfg()).listPrice).toBe(1000);
  });
  it('single-subject price by subject and plan type', () => {
    expect(final(item({ scope: 'subject', subjectId: 'math' }), cfg()).listPrice).toBe(40);
  });
  it('is unavailable when the admin has not set a price', () => {
    expect(quoteItem(item({ grade: 10 }), cfg())).toEqual({ available: false, reason: 'no-price' });
    expect(quoteItem(item({ scope: 'subject', subjectId: 'art' }), cfg())).toEqual({ available: false, reason: 'no-price' });
    expect(quoteItem(item({ scope: 'subject', subjectId: null }), cfg())).toEqual({ available: false, reason: 'no-subject' });
  });
});

describe('sibling discount by position', () => {
  it('is 0 / 10 / 15 / 20 for the 1st, 2nd, 3rd and 4th child', () => {
    expect([1, 2, 3, 4].map((p) => siblingPercent(p, cfg().siblingTiers))).toEqual([0, 10, 15, 20]);
  });
  it('the 4th tier covers every later position', () => {
    expect(siblingPercent(5, cfg().siblingTiers)).toBe(20);
    expect(siblingPercent(9, cfg().siblingTiers)).toBe(20);
  });
  it('is not capped by the 15% promo cap and is not time-limited', () => {
    const q = final(item({ position: 4 }), cfg({ now: new Date('2035-01-01T00:00:00Z') }));
    expect(q).toMatchObject({ discountPercent: 20, discountKind: 'sibling', finalPrice: 80 });
  });
  it('uses whatever percentages the admin set', () => {
    const q = final(item({ position: 2 }), cfg({ siblingTiers: [{ position: 2, percent: 30 }] }));
    expect(q.discountPercent).toBe(30);
  });
  it("each child's discount depends only on their own position", () => {
    const items = [item({ childId: 'a', position: 1 }), item({ childId: 'b', position: 2 }), item({ childId: 'c', position: 3 })];
    const together = quoteCart(items, cfg()).items.map((x) => x.quote);
    const alone = items.map((i) => quoteItem(i, cfg()));
    expect(together).toEqual(alone);
    // Changing child b's plan leaves a and c exactly as they were.
    const changed = quoteCart([items[0]!, item({ childId: 'b', position: 2, grade: 6 }), items[2]!], cfg()).items.map((x) => x.quote);
    expect(changed[0]).toEqual(together[0]);
    expect(changed[2]).toEqual(together[2]);
  });
});

describe('offers', () => {
  it('apply to the first child inside their dates and eligible plans', () => {
    const q = final(item(), cfg({ offers: [offer()] }));
    expect(q).toMatchObject({ discountPercent: 10, discountKind: 'offer', offerId: 'launch', finalPrice: 90 });
  });
  it('do not apply before the start date or after the end date', () => {
    expect(final(item(), cfg({ offers: [offer({ startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-31T00:00:00Z' })] })).discountPercent).toBe(0);
    expect(final(item(), cfg({ offers: [offer({ startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-08-31T00:00:00Z' })] })).discountPercent).toBe(0);
  });
  it('apply only to eligible plan types', () => {
    const o = offer({ planTypes: ['yearly'] });
    expect(final(item({ planType: 'monthly' }), cfg({ offers: [o] })).discountPercent).toBe(0);
  });
  it('are one-time: an offer the parent already used does not apply again', () => {
    expect(final(item(), cfg({ offers: [offer()], usedOfferIds: new Set(['launch']) })).discountPercent).toBe(0);
  });
  it('a renewal offer needs an existing subscription', () => {
    const o = offer({ id: 'renew', percent: 5, renewalOnly: true });
    expect(final(item({ renewal: false }), cfg({ offers: [o] })).discountPercent).toBe(0);
    expect(final(item({ renewal: true }), cfg({ offers: [o] })).discountPercent).toBe(5);
  });
  it('an inactive offer never applies', () => {
    expect(final(item(), cfg({ offers: [offer({ active: false })] })).discountPercent).toBe(0);
  });
  it('a child gets at most one offer: the best one', () => {
    const q = final(item(), cfg({ offers: [offer({ id: 'a', percent: 5 }), offer({ id: 'b', percent: 10 })] }));
    expect(q).toMatchObject({ discountPercent: 10, offerId: 'b' });
  });
});

describe('referral', () => {
  it('gives the referred friend 5% on their first child', () => {
    const q = final(item(), cfg({ referralPercent: 5 }));
    expect(q).toMatchObject({ discountPercent: 5, discountKind: 'referral', referralApplied: true, finalPrice: 95 });
  });
  it('offers and referral together never exceed the 15% cap', () => {
    const q = final(item(), cfg({ referralPercent: 10, offers: [offer({ percent: 10 })] }));
    expect(q.discountPercent).toBe(15);
    expect(q.discountKind).toBe('offer+referral');
  });
  it('offer 10% + referral 5% fits exactly in the cap', () => {
    expect(final(item(), cfg({ referralPercent: 5, offers: [offer({ percent: 10 })] })).discountPercent).toBe(15);
  });
  it('a referred friend with a brother keeps the 5%, and the brother gets the normal sibling discount', () => {
    const c = cfg({ referralPercent: 5 });
    const [first, brother] = quoteCart([item({ childId: 'a', position: 1 }), item({ childId: 'b', position: 2 })], c).items.map((x) => x.quote);
    expect(first).toMatchObject({ discountPercent: 5, discountKind: 'referral' });
    expect(brother).toMatchObject({ discountPercent: 10, discountKind: 'sibling', referralApplied: false });
  });
});

describe('combination rules', () => {
  it('the sibling discount does not combine with offers or referral', () => {
    const q = final(item({ position: 2 }), cfg({ referralPercent: 5, offers: [offer()] }));
    expect(q).toMatchObject({ discountPercent: 10, discountKind: 'sibling', offerId: null, referralApplied: false });
  });
  it('each child gets one kind of discount', () => {
    const q = quoteCart(
      [item({ childId: 'a', position: 1 }), item({ childId: 'b', position: 3 })],
      cfg({ referralPercent: 5, offers: [offer()] }),
    );
    const kinds = q.items.map((x) => (x.quote.available ? x.quote.discountKind : 'n/a'));
    expect(kinds).toEqual(['offer+referral', 'sibling']);
  });
  it('the final price is never below zero', () => {
    const q = final(item({ position: 2 }), cfg({ siblingTiers: [{ position: 2, percent: 250 }] }));
    expect(q.finalPrice).toBe(0);
    expect(q.discountPercent).toBe(100);
    expect(final(item(), cfg({ fullPrices: [{ gradeGroup: 'g1-4', planType: 'monthly', price: -50 }] })).finalPrice).toBe(0);
  });
  it('rounds money to two decimals', () => {
    const q = final(item({ position: 3 }), cfg({ fullPrices: [{ gradeGroup: 'g1-4', planType: 'monthly', price: 33.33 }] }));
    expect(q.finalPrice).toBe(28.33);
    expect(q.discountAmount).toBe(5);
  });
});

describe('cart totals', () => {
  it('sums the final price of every child into one total', () => {
    const q = quoteCart([item({ childId: 'a', position: 1 }), item({ childId: 'b', position: 2 }), item({ childId: 'c', position: 3 })], cfg());
    expect(q.listTotal).toBe(300);
    expect(q.total).toBe(100 + 90 + 85);
  });
  it('skips unavailable items in the totals', () => {
    const q = quoteCart([item({ childId: 'a' }), item({ childId: 'b', position: 2, grade: 10 })], cfg());
    expect(q.total).toBe(100);
  });
});

describe('child positions', () => {
  it('a new child takes the next position, even after a child was archived', () => {
    expect(nextChildPosition([])).toBe(1);
    expect(nextChildPosition([{ position: 1 }, { position: 2 }, { position: 3 }])).toBe(4);
    // Child 2 archived: child 3 keeps 3, the next new child is 4, nobody is renumbered.
    expect(nextChildPosition([{ position: 1 }, { position: 3 }])).toBe(4);
  });
});

const periods: Period[] = [
  { id: 'y', kind: 'year', name: '2026/2027', startsOn: '2026-09-01', endsOn: '2027-06-30' },
  { id: 't1', kind: 'term', name: 'الفصل الأول', startsOn: '2026-09-01', endsOn: '2027-01-15' },
  { id: 't2', kind: 'term', name: 'الفصل الثاني', startsOn: '2027-01-20', endsOn: '2027-06-30' },
];

describe('plan windows', () => {
  it('monthly runs one month from now', () => {
    const w = planWindow('monthly', NOW, periods)!;
    expect(w.startsAt).toEqual(NOW);
    expect(w.endsAt.toISOString()).toBe('2026-10-15T10:00:00.000Z');
  });
  it('monthly renewal continues from a running subscription instead of losing days', () => {
    const w = planWindow('monthly', NOW, periods, new Date('2026-09-20T00:00:00Z'))!;
    expect(w.startsAt.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });
  it('month end does not overflow', () => {
    expect(planWindow('monthly', new Date('2026-01-31T00:00:00Z'), periods)!.endsAt.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });
  it('term and yearly use the dates the admin set', () => {
    const term = planWindow('term', NOW, periods)!;
    expect(term.periodId).toBe('t1');
    expect(term.endsAt.toISOString()).toBe('2027-01-15T23:59:59.999Z');
    expect(planWindow('yearly', NOW, periods)!.endsAt.toISOString()).toBe('2027-06-30T23:59:59.999Z');
  });
  it('a future term starts on its start date', () => {
    const w = planWindow('term', new Date('2027-01-16T00:00:00Z'), periods)!;
    expect(w.periodId).toBe('t2');
    expect(w.startsAt.toISOString()).toBe('2027-01-20T00:00:00.000Z');
  });
  it('is null when no period is open', () => {
    expect(planWindow('term', new Date('2030-01-01T00:00:00Z'), periods)).toBeNull();
    expect(pickPeriod('year', [], NOW)).toBeNull();
  });
});

const sub = (over: Partial<SubscriptionLike> = {}): SubscriptionLike => ({
  childId: 'c1',
  status: 'active',
  scope: 'grade',
  subjectId: null,
  startsAt: '2026-09-01T00:00:00Z',
  endsAt: '2026-10-01T00:00:00Z',
  ...over,
});

describe('access follows the subscription', () => {
  const child = { id: 'c1', grade: 3 };
  const math3 = { id: 'math', grade: 3 };
  const math4 = { id: 'math4', grade: 4 };

  it('is granted only while active and inside the dates', () => {
    expect(isActive(sub(), NOW)).toBe(true);
    expect(isActive(sub({ status: 'pending' }), NOW)).toBe(false);
    expect(isActive(sub({ status: 'cancelled' }), NOW)).toBe(false);
    expect(isActive(sub({ startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' }), NOW)).toBe(false);
  });
  it('stops automatically at the end date and returns when renewed', () => {
    const s = sub();
    expect(childHasAccess([s], child, math3, new Date('2026-09-30T23:59:59Z'))).toBe(true);
    expect(childHasAccess([s], child, math3, new Date('2026-10-01T00:00:00Z'))).toBe(false);
    const renewed = sub({ startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' });
    expect(childHasAccess([s, renewed], child, math3, new Date('2026-10-02T00:00:00Z'))).toBe(true);
  });
  it('a full-grade plan unlocks every subject of the child grade, and no other grade', () => {
    expect(childHasAccess([sub()], child, math3, NOW)).toBe(true);
    expect(childHasAccess([sub()], child, { id: 'sci', grade: 3 }, NOW)).toBe(true);
    expect(childHasAccess([sub()], child, math4, NOW)).toBe(false);
  });
  it('a single-subject plan unlocks only that subject', () => {
    const s = sub({ scope: 'subject', subjectId: 'math' });
    expect(childHasAccess([s], child, math3, NOW)).toBe(true);
    expect(childHasAccess([s], child, { id: 'sci', grade: 3 }, NOW)).toBe(false);
  });
  it("one child's subscription never unlocks another child", () => {
    expect(childHasAccess([sub({ childId: 'c2' })], child, math3, NOW)).toBe(false);
  });
});

describe('expiry warning', () => {
  it('flags subscriptions ending within 7 days', () => {
    const s = sub({ endsAt: '2026-09-22T10:00:00Z' });
    expect(expiryState(s, NOW)).toBe('expiring');
    expect(expiryState(sub({ endsAt: '2026-09-23T10:00:01Z' }), NOW)).toBe('active');
    expect(expiryState(s, new Date('2026-09-22T10:00:00Z'))).toBe('expired');
    expect(expiryState(sub({ status: 'pending' }), NOW)).toBe('pending');
  });
});

describe('referral codes', () => {
  const row = { code: 'ABC', ownerId: 'owner', expiresAt: '2026-10-01T00:00:00Z', redeemedBy: null };
  it('accepts a fresh code from another parent', () => {
    expect(checkReferral(row, 'friend', NOW)).toEqual({ ok: true });
  });
  it('rejects unknown, expired, used and own codes', () => {
    expect(checkReferral(null, 'friend', NOW)).toEqual({ ok: false, reason: 'not-found' });
    expect(checkReferral({ ...row, expiresAt: '2026-09-01T00:00:00Z' }, 'friend', NOW)).toEqual({ ok: false, reason: 'expired' });
    expect(checkReferral({ ...row, redeemedBy: 'x' }, 'friend', NOW)).toEqual({ ok: false, reason: 'used' });
    expect(checkReferral(row, 'owner', NOW)).toEqual({ ok: false, reason: 'own-code' });
  });
  it('generates readable, normalised codes', () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(normalizeReferralCode(' ab-c d ')).toBe('ABCD');
    expect(normalizeReferralCode(5)).toBe('');
  });
});

describe('live session statuses', () => {
  it('moves only forward', () => {
    expect(canTransition('pending', 'accepted')).toBe(true);
    expect(canTransition('accepted', 'completed')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'accepted')).toBe(false);
    expect(canTransition('pending', 'completed')).toBe(false);
  });
});

/**
 * Plan prices and discounts. Pure and deterministic: every number comes from the config the
 * caller loads from the database (nothing is hardcoded here except the grade-to-group mapping
 * and the rule structure itself).
 */

export type PlanType = 'monthly' | 'term' | 'yearly';
export const PLAN_TYPES: readonly PlanType[] = ['monthly', 'term', 'yearly'];

export type GradeGroup = 'g1-4' | 'g5-8' | 'g9-10' | 'first-secondary' | 'tawjihi';
export const GRADE_GROUPS: readonly GradeGroup[] = ['g1-4', 'g5-8', 'g9-10', 'first-secondary', 'tawjihi'];

export function gradeGroup(grade: number): GradeGroup | null {
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  if (grade <= 4) return 'g1-4';
  if (grade <= 8) return 'g5-8';
  if (grade <= 10) return 'g9-10';
  return grade === 11 ? 'first-secondary' : 'tawjihi';
}

export type Offer = {
  id: string;
  name: string;
  percent: number;
  startsAt: string;
  endsAt: string;
  planTypes: PlanType[];
  /** Only for a child who already had a subscription (the renewal offer). */
  renewalOnly: boolean;
  active: boolean;
};

export type SiblingTier = { position: number; percent: number };

export type PricingConfig = {
  fullPrices: { gradeGroup: GradeGroup; planType: PlanType; price: number }[];
  subjectPrices: { subjectId: string; planType: PlanType; price: number }[];
  /** e.g. 2→10, 3→15, 4→20 (4 means "4th and beyond"). */
  siblingTiers: SiblingTier[];
  offers: Offer[];
  /** Ids of offers this parent already used: offers are one-time. */
  usedOfferIds: ReadonlySet<string>;
  /** A valid, unexpired, unredeemed referral code for this parent, if any. */
  referralPercent: number | null;
  /** Cap on offers and referral together (not on the sibling discount). */
  promoCapPercent: number;
  now: Date;
};

export type CartItem = {
  childId: string;
  /** The child's own position in the parent's account (1 = first child). Never reassigned. */
  position: number;
  grade: number;
  planType: PlanType;
  scope: 'grade' | 'subject';
  subjectId: string | null;
  /** The child already had a subscription before this one. */
  renewal: boolean;
};

export type DiscountKind = 'none' | 'sibling' | 'offer' | 'referral' | 'offer+referral';

export type ItemQuote =
  | { available: false; reason: 'no-price' | 'bad-grade' | 'no-subject' }
  | {
      available: true;
      listPrice: number;
      discountPercent: number;
      discountKind: DiscountKind;
      discountAmount: number;
      finalPrice: number;
      offerId: string | null;
      referralApplied: boolean;
    };

const cents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

export const clampPercent = (p: number) => (Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0);

/** Sibling discount for a position: the tier with the highest position not above it. */
export function siblingPercent(position: number, tiers: readonly SiblingTier[]) {
  if (position < 2) return 0;
  const tier = [...tiers].filter((t) => t.position <= position).sort((a, b) => b.position - a.position)[0];
  return tier ? clampPercent(tier.percent) : 0;
}

export function offerApplies(offer: Offer, item: Pick<CartItem, 'planType' | 'renewal'>, now: Date, used: ReadonlySet<string>) {
  if (!offer.active || used.has(offer.id)) return false;
  if (!offer.planTypes.includes(item.planType)) return false;
  if (offer.renewalOnly && !item.renewal) return false;
  const t = now.getTime();
  return t >= new Date(offer.startsAt).getTime() && t <= new Date(offer.endsAt).getTime();
}

export function listPriceFor(item: CartItem, cfg: Pick<PricingConfig, 'fullPrices' | 'subjectPrices'>): ItemQuote | number {
  if (item.scope === 'subject') {
    if (!item.subjectId) return { available: false, reason: 'no-subject' };
    const row = cfg.subjectPrices.find((p) => p.subjectId === item.subjectId && p.planType === item.planType);
    return row ? row.price : { available: false, reason: 'no-price' };
  }
  const group = gradeGroup(item.grade);
  if (!group) return { available: false, reason: 'bad-grade' };
  const row = cfg.fullPrices.find((p) => p.gradeGroup === group && p.planType === item.planType);
  return row ? row.price : { available: false, reason: 'no-price' };
}

/**
 * One child's quote. It depends only on that child's own item and the config, never on the
 * other children in the cart.
 *
 *  - Position 2 and beyond: the sibling discount, and nothing else (it never combines).
 *  - Position 1: the best eligible offer plus the referral, together capped at promoCapPercent.
 *  - The final price never goes below zero.
 */
export function quoteItem(item: CartItem, cfg: PricingConfig): ItemQuote {
  const base = listPriceFor(item, cfg);
  if (typeof base !== 'number') return base;
  const listPrice = Math.max(0, base);

  let percent = 0;
  let kind: DiscountKind = 'none';
  let offerId: string | null = null;
  let referralApplied = false;

  if (item.position >= 2) {
    percent = siblingPercent(item.position, cfg.siblingTiers);
    if (percent > 0) kind = 'sibling';
  } else {
    const offers = cfg.offers.filter((o) => offerApplies(o, item, cfg.now, cfg.usedOfferIds));
    const best = offers.sort((a, b) => b.percent - a.percent)[0];
    const offerPct = best ? clampPercent(best.percent) : 0;
    const referralPct = cfg.referralPercent ? clampPercent(cfg.referralPercent) : 0;
    percent = Math.min(clampPercent(cfg.promoCapPercent), offerPct + referralPct);
    if (offerPct > 0) offerId = best!.id;
    referralApplied = referralPct > 0 && percent > 0;
    if (percent > 0) kind = offerPct > 0 && referralPct > 0 ? 'offer+referral' : offerPct > 0 ? 'offer' : 'referral';
    if (percent === 0) {
      offerId = null;
      referralApplied = false;
    }
  }

  const discountCents = Math.min(cents(listPrice), Math.round((cents(listPrice) * percent) / 100));
  return {
    available: true,
    listPrice,
    discountPercent: percent,
    discountKind: kind,
    discountAmount: fromCents(discountCents),
    finalPrice: Math.max(0, fromCents(cents(listPrice) - discountCents)),
    offerId,
    referralApplied,
  };
}

export type CartQuote = {
  items: { item: CartItem; quote: ItemQuote }[];
  total: number;
  /** Total of the original prices, before discounts. */
  listTotal: number;
};

export function quoteCart(items: readonly CartItem[], cfg: PricingConfig): CartQuote {
  const quoted = items.map((item) => ({ item, quote: quoteItem(item, cfg) }));
  let total = 0;
  let listTotal = 0;
  for (const { quote } of quoted) {
    if (!quote.available) continue;
    total += cents(quote.finalPrice);
    listTotal += cents(quote.listPrice);
  }
  return { items: quoted, total: fromCents(total), listTotal: fromCents(listTotal) };
}

/** The position a new child takes: one more than the highest ever used, archived children included. */
export function nextChildPosition(existing: readonly { position: number }[]) {
  return existing.reduce((max, c) => Math.max(max, c.position), 0) + 1;
}

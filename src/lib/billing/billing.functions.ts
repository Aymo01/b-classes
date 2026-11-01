import { createServerFn } from '@tanstack/react-start';
import { requireApprovedMember } from '@/lib/access/middleware';
import { quoteCart, type CartItem, type DiscountKind, type PlanType } from './pricing';
import { checkReferral, generateReferralCode, normalizeReferralCode, referralMessage } from './referral';
import { expiryState, planWindow, type ExpiryState } from './subscription';
import { loadPeriods, loadPricingConfig, loadSettings, serviceClient, untyped, type Db } from './server';

type Row = Record<string, unknown>;

const FAILED = 'تعذر تنفيذ الطلب. حاول مرة أخرى.';
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const isPlan = (v: unknown): v is PlanType => v === 'monthly' || v === 'term' || v === 'yearly';

export type ChildDTO = { id: string; name: string; grade: number; position: number };

export type SubscriptionDTO = {
  id: string;
  childId: string;
  childName: string;
  planType: PlanType;
  scope: 'grade' | 'subject';
  subjectTitle: string | null;
  status: 'pending' | 'active' | 'cancelled';
  state: ExpiryState;
  startsAt: string;
  endsAt: string;
  listPrice: number;
  discountPercent: number;
  discountKind: DiscountKind;
  finalPrice: number;
};

/* ------------------------------------------------------------------ children */

const toChild = (r: Row): ChildDTO => ({ id: String(r['id']), name: String(r['name']), grade: Number(r['grade']), position: Number(r['position']) });

export const listFamilyChildren = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<ChildDTO[]> => {
    const db = untyped(context.supabase);
    const { data } = await db.from('children').select('id, name, grade, position').eq('parent_id', context.userId).is('archived_at', null).order('position');
    return (data ?? []).map(toChild);
  });

function cleanChild(input: { name: unknown; grade: unknown }) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > 80) throw new Error('اكتب اسم الطفل (حتى 80 حرفًا).');
  const grade = Number(input.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error('اختر صفًا من 1 إلى 12.');
  return { name, grade };
}

export const addChild = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { name: string; grade: number }) => cleanChild(input))
  .handler(async ({ data, context }): Promise<ChildDTO> => {
    const db = untyped(context.supabase);
    // The position is assigned by the database, one past the highest ever used.
    const { data: row, error } = await db.from('children').insert({ parent_id: context.userId, name: data.name, grade: data.grade }).select('id, name, grade, position').single();
    if (error || !row) throw new Error(FAILED);
    return toChild(row);
  });

export const updateChild = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { id: string; name: string; grade: number }) => {
    if (!isId(input.id)) throw new Error(FAILED);
    return { id: input.id, ...cleanChild(input) };
  })
  .handler(async ({ data, context }) => {
    const db = untyped(context.supabase);
    const { error } = await db.from('children').update({ name: data.name, grade: data.grade }).eq('id', data.id).eq('parent_id', context.userId);
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

/** Children are archived, never deleted, so nobody else's position or discount moves. */
export const archiveChild = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { id: string }) => {
    if (!isId(input.id)) throw new Error(FAILED);
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = untyped(context.supabase);
    const { error } = await db.from('children').update({ archived_at: new Date().toISOString() }).eq('id', data.id).eq('parent_id', context.userId);
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

/* ------------------------------------------------------------------ catalog and quotes */

export type CatalogDTO = {
  currencyLabel: string;
  subjects: { id: string; title: string; grade: number }[];
  /** Which plan types can be sold right now (a term or year needs an open period). */
  openPlans: Record<PlanType, boolean>;
  periods: { kind: 'term' | 'year'; name: string; startsOn: string; endsOn: string }[];
};

export const getPlanCatalog = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<CatalogDTO> => {
    const db = untyped(context.supabase);
    const now = new Date();
    const [subjects, periods, settings] = await Promise.all([db.from('subjects').select('id, title, grade').order('grade').order('title'), loadPeriods(db), loadSettings(db)]);
    return {
      currencyLabel: settings.currencyLabel,
      subjects: (subjects.data ?? []).map((s: Row) => ({ id: String(s['id']), title: String(s['title']), grade: Number(s['grade']) })),
      openPlans: {
        monthly: true,
        term: planWindow('term', now, periods) !== null,
        yearly: planWindow('yearly', now, periods) !== null,
      },
      periods: periods.map((p) => ({ kind: p.kind, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn })),
    };
  });

type OrderInput = { items: { childId: string; planType: PlanType; scope: 'grade' | 'subject'; subjectId: string | null }[]; referralCode: string };

function cleanOrder(input: { items: unknown; referralCode?: unknown }): OrderInput {
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 20) throw new Error('اختر خطة لطفل واحد على الأقل.');
  const seen = new Set<string>();
  const items = input.items.map((raw: Row) => {
    const childId = raw['childId'];
    const planType = raw['planType'];
    const scope = raw['scope'];
    const subjectId = raw['subjectId'] ?? null;
    if (!isId(childId) || !isPlan(planType) || (scope !== 'grade' && scope !== 'subject')) throw new Error(FAILED);
    if (scope === 'subject' && !isId(subjectId)) throw new Error('اختر المادة.');
    if (seen.has(childId)) throw new Error('اختر خطة واحدة لكل طفل في الطلب الواحد.');
    seen.add(childId);
    return { childId, planType, scope: scope as 'grade' | 'subject', subjectId: scope === 'subject' ? (subjectId as string) : null };
  });
  const code = normalizeReferralCode(input.referralCode);
  if (code.length > 32) throw new Error(referralMessage['not-found']);
  return { items, referralCode: code };
}

export type QuoteItemDTO = {
  childId: string;
  childName: string;
  position: number;
  available: boolean;
  problem: string | null;
  listPrice: number;
  discountPercent: number;
  discountKind: DiscountKind;
  discountAmount: number;
  finalPrice: number;
  offerName: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type QuoteDTO = {
  items: QuoteItemDTO[];
  total: number;
  listTotal: number;
  currencyLabel: string;
  referral: { state: 'none' | 'valid' | 'invalid'; message: string | null };
  /** Internal to placeOrder; harmless to the client. */
  ready: boolean;
};

type Built = { dto: QuoteDTO; rows: Row[]; referralCodeId: string | null };

/** The one place a price is computed. The client only displays what this returns. */
async function buildQuote(db: Db, userId: string, order: OrderInput): Promise<Built> {
  const now = new Date();
  const svc = await serviceClient();
  const settings = await loadSettings(db);

  const { data: childRows } = await db.from('children').select('id, name, grade, position').eq('parent_id', userId).is('archived_at', null).in('id', order.items.map((i) => i.childId));
  const children = new Map<string, ChildDTO>((childRows ?? []).map((r: Row) => [String(r['id']), toChild(r)]));
  if (children.size !== order.items.length) throw new Error(FAILED);

  const subjectIds = order.items.map((i) => i.subjectId).filter((s): s is string => !!s);
  const { data: subjectRows } = subjectIds.length ? await db.from('subjects').select('id, grade').in('id', subjectIds) : { data: [] as Row[] };
  const subjectGrade = new Map<string, number>((subjectRows ?? []).map((r: Row) => [String(r['id']), Number(r['grade'])]));

  // A child who had a subscription before is renewing; also the running one a monthly renewal continues from.
  const { data: priorRows } = await db.from('subscriptions').select('child_id, scope, subject_id, ends_at').eq('parent_id', userId).eq('status', 'active').in('child_id', [...children.keys()]);
  const prior = priorRows ?? [];

  let referral: QuoteDTO['referral'] = { state: 'none', message: null };
  let referralCodeId: string | null = null;
  let referralPercent: number | null = null;
  if (order.referralCode) {
    const { data: codeRow } = await svc.from('referral_codes').select('id, code, owner_id, expires_at, redeemed_by').eq('code', order.referralCode).maybeSingle();
    const check = checkReferral(
      codeRow ? { code: String(codeRow['code']), ownerId: String(codeRow['owner_id']), expiresAt: String(codeRow['expires_at']), redeemedBy: (codeRow['redeemed_by'] as string | null) ?? null } : null,
      userId,
      now,
    );
    if (check.ok) {
      referral = { state: 'valid', message: null };
      referralCodeId = String(codeRow!['id']);
      referralPercent = settings.referralPercent;
    } else {
      referral = { state: 'invalid', message: referralMessage[check.reason] };
    }
  }

  const [cfg, periods] = await Promise.all([loadPricingConfig(db, { parentId: userId, referralPercent, now }), loadPeriods(db)]);
  const offerNames = new Map(cfg.offers.map((o) => [o.id, o.name]));

  const rows: Row[] = [];
  let ready = true;
  const cart: CartItem[] = [];
  const meta = new Map<string, { problem: string | null; window: ReturnType<typeof planWindow> }>();

  for (const i of order.items) {
    const child = children.get(i.childId)!;
    let problem: string | null = null;
    if (i.scope === 'subject' && subjectGrade.get(i.subjectId ?? '') !== child.grade) problem = 'هذه المادة ليست من صف الطفل.';
    const same = prior.filter((p: Row) => p['child_id'] === child.id && p['scope'] === i.scope && (p['subject_id'] ?? null) === i.subjectId);
    const continueFrom = same.length ? new Date(Math.max(...same.map((p: Row) => new Date(String(p['ends_at'])).getTime()))) : null;
    const window = planWindow(i.planType, now, periods, continueFrom);
    if (!window && !problem) problem = 'هذا النوع غير متاح حاليًا: لم يُحدَّد فصل أو سنة دراسية مفتوحة.';
    meta.set(child.id, { problem, window });
    cart.push({ childId: child.id, position: child.position, grade: child.grade, planType: i.planType, scope: i.scope, subjectId: i.subjectId, renewal: prior.some((p: Row) => p['child_id'] === child.id) });
  }

  const items: QuoteItemDTO[] = [];
  let appliedReferral = false;
  const total = quoteCart(cart, cfg);
  total.items.forEach(({ item, quote }) => {
    const child = children.get(item.childId)!;
    const m = meta.get(item.childId)!;
    if (!quote.available) {
      ready = false;
      items.push({ childId: child.id, childName: child.name, position: child.position, available: false, problem: m.problem ?? 'لم يحدد المشرف سعرًا لهذه الخطة بعد.', listPrice: 0, discountPercent: 0, discountKind: 'none', discountAmount: 0, finalPrice: 0, offerName: null, startsAt: null, endsAt: null });
      return;
    }
    if (m.problem || !m.window) ready = false;
    if (quote.referralApplied) appliedReferral = true;
    items.push({
      childId: child.id,
      childName: child.name,
      position: child.position,
      available: !m.problem,
      problem: m.problem,
      listPrice: quote.listPrice,
      discountPercent: quote.discountPercent,
      discountKind: quote.discountKind,
      discountAmount: quote.discountAmount,
      finalPrice: quote.finalPrice,
      offerName: quote.offerId ? (offerNames.get(quote.offerId) ?? null) : null,
      startsAt: m.window?.startsAt.toISOString() ?? null,
      endsAt: m.window?.endsAt.toISOString() ?? null,
    });
    if (m.window && !m.problem) {
      rows.push({
        parent_id: userId,
        child_id: item.childId,
        plan_type: item.planType,
        scope: item.scope,
        subject_id: item.subjectId,
        period_id: m.window.periodId,
        status: 'pending',
        starts_at: m.window.startsAt.toISOString(),
        ends_at: m.window.endsAt.toISOString(),
        list_price: quote.listPrice,
        discount_percent: quote.discountPercent,
        discount_kind: quote.discountKind,
        offer_id: quote.offerId,
        referral_code_id: quote.referralApplied ? referralCodeId : null,
        final_price: quote.finalPrice,
      });
    }
  });

  if (referral.state === 'valid' && !appliedReferral) {
    referral = { state: 'valid', message: 'الرمز صحيح، ويُطبَّق على الطفل الأول عند اختيار خطته.' };
  }
  return {
    dto: { items, total: total.total, listTotal: total.listTotal, currencyLabel: settings.currencyLabel, referral, ready: ready && items.every((i) => i.available) },
    rows,
    referralCodeId: appliedReferral ? referralCodeId : null,
  };
}

export const quotePlans = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { items: unknown; referralCode?: unknown }) => cleanOrder(input))
  .handler(async ({ data, context }): Promise<QuoteDTO> => (await buildQuote(untyped(context.supabase), context.userId, data)).dto);

/**
 * Records the order as pending subscriptions at the prices quoted now. Payment is not connected, so
 * nothing is active until an admin confirms it; access starts only when a subscription is active.
 */
export const placeOrder = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { items: unknown; referralCode?: unknown }) => cleanOrder(input))
  .handler(async ({ data, context }) => {
    const db = untyped(context.supabase);
    const built = await buildQuote(db, context.userId, data);
    if (!built.dto.ready || built.rows.length === 0) throw new Error(built.dto.items.find((i) => i.problem)?.problem ?? 'تعذر تأكيد الطلب. راجع الخطط المختارة.');
    if (built.dto.referral.state === 'invalid') throw new Error(built.dto.referral.message ?? FAILED);

    const svc = await serviceClient();
    // Claim the referral code first: only one request can flip redeemed_by from null.
    if (built.referralCodeId) {
      const { data: claimed } = await svc
        .from('referral_codes')
        .update({ redeemed_by: context.userId, redeemed_at: new Date().toISOString() })
        .eq('id', built.referralCodeId)
        .is('redeemed_by', null)
        .select('id');
      if (!claimed || claimed.length === 0) throw new Error(referralMessage.used);
    }
    const { error } = await svc.from('subscriptions').insert(built.rows);
    if (error) {
      if (built.referralCodeId) await svc.from('referral_codes').update({ redeemed_by: null, redeemed_at: null }).eq('id', built.referralCodeId);
      throw new Error(FAILED);
    }
    return { ok: true, count: built.rows.length, total: built.dto.total };
  });

/* ------------------------------------------------------------------ subscriptions and referral */

export const listMySubscriptions = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<SubscriptionDTO[]> => {
    const db = untyped(context.supabase);
    const svc = await serviceClient();
    const settings = await loadSettings(db);
    // Best effort: make sure expiry notifications exist (idempotent).
    await svc.rpc('notify_subscription_expiry', { _days: settings.expiryWarningDays }).then(() => undefined, () => undefined);

    const { data } = await db
      .from('subscriptions')
      .select('id, child_id, plan_type, scope, subject_id, status, starts_at, ends_at, list_price, discount_percent, discount_kind, final_price')
      .eq('parent_id', context.userId)
      .order('created_at', { ascending: false });
    const rows = data ?? [];
    const childIds = [...new Set(rows.map((r: Row) => String(r['child_id'])))];
    const subjectIds = [...new Set(rows.map((r: Row) => r['subject_id']).filter((s: unknown): s is string => typeof s === 'string'))];
    const [children, subjects] = await Promise.all([
      childIds.length ? db.from('children').select('id, name').in('id', childIds) : Promise.resolve({ data: [] as Row[] }),
      subjectIds.length ? db.from('subjects').select('id, title').in('id', subjectIds) : Promise.resolve({ data: [] as Row[] }),
    ]);
    const childName = new Map<string, string>((children.data ?? []).map((c: Row) => [String(c['id']), String(c['name'])]));
    const subjectTitle = new Map<string, string>((subjects.data ?? []).map((s: Row) => [String(s['id']), String(s['title'])]));
    const now = new Date();
    return rows.map((r: Row) => ({
      id: String(r['id']),
      childId: String(r['child_id']),
      childName: childName.get(String(r['child_id'])) ?? '—',
      planType: r['plan_type'] as PlanType,
      scope: r['scope'] as 'grade' | 'subject',
      subjectTitle: r['subject_id'] ? (subjectTitle.get(String(r['subject_id'])) ?? null) : null,
      status: r['status'] as SubscriptionDTO['status'],
      state: expiryState({ status: r['status'] as SubscriptionDTO['status'], startsAt: String(r['starts_at']), endsAt: String(r['ends_at']) }, now, settings.expiryWarningDays),
      startsAt: String(r['starts_at']),
      endsAt: String(r['ends_at']),
      listPrice: Number(r['list_price']),
      discountPercent: Number(r['discount_percent']),
      discountKind: r['discount_kind'] as DiscountKind,
      finalPrice: Number(r['final_price']),
    }));
  });

export type ReferralCodeDTO = { id: string; code: string; expiresAt: string; redeemed: boolean };

export const listMyReferralCodes = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<ReferralCodeDTO[]> => {
    const db = untyped(context.supabase);
    const { data } = await db.from('referral_codes').select('id, code, expires_at, redeemed_by').eq('owner_id', context.userId).order('created_at', { ascending: false }).limit(50);
    return (data ?? []).map((r: Row) => ({ id: String(r['id']), code: String(r['code']), expiresAt: String(r['expires_at']), redeemed: !!r['redeemed_by'] }));
  });

/** One code per friend: every call makes a new single-use code. Your own plan is not discounted. */
export const createReferralCode = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<ReferralCodeDTO> => {
    const db = untyped(context.supabase);
    const svc = await serviceClient();
    const settings = await loadSettings(db);
    const { count } = await db.from('referral_codes').select('id', { count: 'exact', head: true }).eq('owner_id', context.userId).is('redeemed_by', null).gt('expires_at', new Date().toISOString());
    if ((count ?? 0) >= 20) throw new Error('لديك رموز كثيرة غير مستخدمة. شارك الرموز الحالية أولًا.');
    const expiresAt = new Date(Date.now() + settings.referralValidDays * 86_400_000).toISOString();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      const { data, error } = await svc.from('referral_codes').insert({ code, owner_id: context.userId, expires_at: expiresAt }).select('id, code, expires_at').single();
      if (!error && data) return { id: String(data['id']), code: String(data['code']), expiresAt: String(data['expires_at']), redeemed: false };
    }
    throw new Error(FAILED);
  });

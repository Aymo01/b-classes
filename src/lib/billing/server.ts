import type { SupabaseClient } from '@supabase/supabase-js';
import type { Offer, PlanType, PricingConfig } from './pricing';
import type { Period } from './subscription';

/**
 * Server-only helpers for the subscription code. The generated database types do not know the new
 * tables until the migration is applied and the types are regenerated, so these clients are untyped.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any>;
export const untyped = (client: unknown) => client as Db;

/** Service-role client: bypasses RLS. Use only after the caller has been checked. */
export async function serviceClient(): Promise<Db> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return untyped(supabaseAdmin);
}

export function assertAdmin(roles: readonly string[]) {
  if (!roles.includes('admin')) throw new Error('غير مصرح');
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v);

export async function loadSettings(db: Db) {
  const { data } = await db.from('app_settings').select('key, value');
  const map = new Map<string, unknown>((data ?? []).map((r: Row) => [String(r['key']), r['value']]));
  const number = (key: string, fallback: number) => {
    const v = Number(map.get(key));
    return Number.isFinite(v) ? v : fallback;
  };
  const modes = map.get('live_modes_enabled');
  return {
    promoCapPercent: number('promo_cap_percent', 15),
    referralPercent: number('referral_percent', 5),
    referralValidDays: number('referral_valid_days', 30),
    expiryWarningDays: number('expiry_warning_days', 7),
    liveModes: (Array.isArray(modes) ? modes : ['individual', 'group']).filter((m): m is 'individual' | 'group' => m === 'individual' || m === 'group'),
    currencyLabel: typeof map.get('currency_label') === 'string' ? (map.get('currency_label') as string) : '',
  };
}

export async function loadPeriods(db: Db): Promise<Period[]> {
  const { data } = await db.from('academic_periods').select('id, kind, name, starts_on, ends_on').order('starts_on');
  return (data ?? []).map((r: Row) => ({
    id: String(r['id']),
    kind: r['kind'] as Period['kind'],
    name: String(r['name']),
    startsOn: String(r['starts_on']),
    endsOn: String(r['ends_on']),
  }));
}

/** Everything quoteItem needs, read from the database. Nothing is hardcoded. */
export async function loadPricingConfig(
  db: Db,
  opts: { parentId: string; referralPercent: number | null; now: Date },
): Promise<PricingConfig> {
  const [full, subject, sibling, offers, used, settings] = await Promise.all([
    db.from('full_plan_prices').select('grade_group, plan_type, price'),
    db.from('subject_plan_prices').select('subject_id, plan_type, price'),
    db.from('sibling_discounts').select('position, percent'),
    db.from('offers').select('id, name, percent, starts_at, ends_at, plan_types, renewal_only, active'),
    db.from('subscriptions').select('offer_id').eq('parent_id', opts.parentId).not('offer_id', 'is', null).neq('status', 'cancelled'),
    loadSettings(db),
  ]);
  return {
    fullPrices: (full.data ?? []).map((r: Row) => ({ gradeGroup: r['grade_group'] as PricingConfig['fullPrices'][number]['gradeGroup'], planType: r['plan_type'] as PlanType, price: num(r['price']) })),
    subjectPrices: (subject.data ?? []).map((r: Row) => ({ subjectId: String(r['subject_id']), planType: r['plan_type'] as PlanType, price: num(r['price']) })),
    siblingTiers: (sibling.data ?? []).map((r: Row) => ({ position: num(r['position']), percent: num(r['percent']) })),
    offers: (offers.data ?? []).map(
      (r: Row): Offer => ({
        id: String(r['id']),
        name: String(r['name']),
        percent: num(r['percent']),
        startsAt: String(r['starts_at']),
        endsAt: String(r['ends_at']),
        planTypes: (r['plan_types'] as PlanType[]) ?? [],
        renewalOnly: Boolean(r['renewal_only']),
        active: Boolean(r['active']),
      }),
    ),
    usedOfferIds: new Set((used.data ?? []).map((r: Row) => String(r['offer_id']))),
    referralPercent: opts.referralPercent,
    promoCapPercent: settings.promoCapPercent,
    now: opts.now,
  };
}

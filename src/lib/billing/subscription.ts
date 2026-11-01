import type { PlanType } from './pricing';

export type SubscriptionStatus = 'pending' | 'active' | 'cancelled';

export type SubscriptionLike = {
  childId: string;
  status: SubscriptionStatus;
  scope: 'grade' | 'subject';
  subjectId: string | null;
  startsAt: string;
  endsAt: string;
};

export type Period = { id: string; kind: 'term' | 'year'; name: string; startsOn: string; endsOn: string };

export const EXPIRY_WARNING_DAYS = 7;
const DAY = 86_400_000;

const endOfDayUtc = (date: string) => new Date(`${date}T23:59:59.999Z`);
const startOfDayUtc = (date: string) => new Date(`${date}T00:00:00.000Z`);

export function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** The term or school year to sell now: the one running today, else the next one to start. */
export function pickPeriod(kind: 'term' | 'year', periods: readonly Period[], now: Date) {
  return (
    periods
      .filter((p) => p.kind === kind && endOfDayUtc(p.endsOn).getTime() >= now.getTime())
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null
  );
}

/**
 * Access window of a new subscription. Monthly runs one month from now (or from the end of a
 * still-running subscription, so renewing early loses nothing). A term or a school year runs from
 * its start date, or from now if it already began, to its end date. Null when no period is open.
 */
export function planWindow(
  planType: PlanType,
  now: Date,
  periods: readonly Period[],
  continueFrom?: Date | null,
): { startsAt: Date; endsAt: Date; periodId: string | null } | null {
  if (planType === 'monthly') {
    const startsAt = continueFrom && continueFrom.getTime() > now.getTime() ? continueFrom : now;
    return { startsAt, endsAt: addMonths(startsAt, 1), periodId: null };
  }
  const period = pickPeriod(planType === 'term' ? 'term' : 'year', periods, now);
  if (!period) return null;
  const periodStart = startOfDayUtc(period.startsOn);
  return {
    startsAt: periodStart.getTime() > now.getTime() ? periodStart : now,
    endsAt: endOfDayUtc(period.endsOn),
    periodId: period.id,
  };
}

/** Access is granted only while the subscription is active and inside its dates. */
export function isActive(sub: Pick<SubscriptionLike, 'status' | 'startsAt' | 'endsAt'>, now: Date) {
  return sub.status === 'active' && new Date(sub.startsAt).getTime() <= now.getTime() && now.getTime() < new Date(sub.endsAt).getTime();
}

export type ExpiryState = 'pending' | 'cancelled' | 'active' | 'expiring' | 'expired' | 'upcoming';

export function expiryState(sub: Pick<SubscriptionLike, 'status' | 'startsAt' | 'endsAt'>, now: Date, warnDays = EXPIRY_WARNING_DAYS): ExpiryState {
  if (sub.status !== 'active') return sub.status;
  if (now.getTime() >= new Date(sub.endsAt).getTime()) return 'expired';
  if (now.getTime() < new Date(sub.startsAt).getTime()) return 'upcoming';
  return new Date(sub.endsAt).getTime() - now.getTime() <= warnDays * DAY ? 'expiring' : 'active';
}

export function daysLeft(sub: Pick<SubscriptionLike, 'endsAt'>, now: Date) {
  return Math.ceil((new Date(sub.endsAt).getTime() - now.getTime()) / DAY);
}

/**
 * Does this child have access to a subject? A full-grade plan unlocks every subject of the child's
 * grade; a single-subject plan unlocks only that subject.
 */
export function childHasAccess(
  subs: readonly SubscriptionLike[],
  child: { id: string; grade: number },
  subject: { id: string; grade: number },
  now: Date,
) {
  return subs.some((s) => {
    if (s.childId !== child.id || !isActive(s, now)) return false;
    return s.scope === 'grade' ? subject.grade === child.grade : s.subjectId === subject.id;
  });
}

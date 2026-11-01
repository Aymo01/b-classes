import type { DiscountKind, PlanType } from './pricing';
import type { ExpiryState } from './subscription';

const number = new Intl.NumberFormat('ar', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatMoney(value: number, currencyLabel = '') {
  const text = number.format(value);
  return currencyLabel ? `${text} ${currencyLabel}` : text;
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ar', { dateStyle: 'medium' });
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });

export const planLabel: Record<PlanType, string> = { monthly: 'شهري', term: 'فصلي', yearly: 'سنوي' };

export const discountLabel: Record<DiscountKind, string> = {
  none: 'بدون خصم',
  sibling: 'خصم الإخوة',
  offer: 'عرض',
  referral: 'خصم الإحالة',
  'offer+referral': 'عرض + إحالة',
};

export const stateLabel: Record<ExpiryState, string> = {
  pending: 'بانتظار التأكيد',
  active: 'نشط',
  expiring: 'ينتهي قريبًا',
  expired: 'منتهٍ',
  cancelled: 'ملغى',
  upcoming: 'لم يبدأ بعد',
};

/** A `datetime-local` input value (local time, no zone) from an ISO string, and back. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : '');

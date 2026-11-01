export type ReferralCodeRow = {
  code: string;
  ownerId: string;
  expiresAt: string;
  redeemedBy: string | null;
};

// No 0/O/1/I/L so a code read aloud or from a screenshot is not misread.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 8, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = random(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const normalizeReferralCode = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase().replace(/[\s-]/g, '') : '';

export type ReferralCheck = { ok: true } | { ok: false; reason: 'not-found' | 'expired' | 'used' | 'own-code' };

/** One code per friend: single use, time-limited, and never for the parent who made it. */
export function checkReferral(row: ReferralCodeRow | null | undefined, userId: string, now: Date): ReferralCheck {
  if (!row) return { ok: false, reason: 'not-found' };
  if (row.ownerId === userId) return { ok: false, reason: 'own-code' };
  if (row.redeemedBy) return { ok: false, reason: 'used' };
  if (new Date(row.expiresAt).getTime() < now.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true };
}

export const referralMessage: Record<Exclude<ReferralCheck, { ok: true }>['reason'], string> = {
  'not-found': 'رمز الإحالة غير صحيح.',
  expired: 'انتهت صلاحية رمز الإحالة.',
  used: 'تم استخدام رمز الإحالة من قبل.',
  'own-code': 'لا يمكنك استخدام رمز الإحالة الخاص بك.',
};

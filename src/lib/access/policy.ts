import type { AccessFacts, AccessResult, AppRole } from './types';

export const normalizeEmail = (email: string | null | undefined) =>
  email ? email.trim().toLowerCase() : null;

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** True only when the signed-in address is the teacher's issued school email. */
export function teacherEmailMatches(teacher: { schoolEmail: string }, email: string | null) {
  const e = normalizeEmail(email);
  return !!e && normalizeEmail(teacher.schoolEmail) === e;
}

/** Pure rule: a user is approved only if they hold at least one role. */
export function resolveAccess(facts: AccessFacts): AccessResult {
  const roles: AppRole[] = [];
  if (facts.isAdmin) roles.push('admin');
  if (facts.teacher && teacherEmailMatches(facts.teacher, facts.email)) roles.push('teacher');
  if (facts.allowlistRole) roles.push(facts.allowlistRole);
  return { status: roles.length > 0 ? 'approved' : 'pending', roles, email: normalizeEmail(facts.email) };
}

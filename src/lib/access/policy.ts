import type { AccessFacts, AccessResult, AllowlistInput, AllowlistRole, AppRole } from './types';

export const normalizeEmail = (email: string | null | undefined) =>
  email ? email.trim().toLowerCase() : null;

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isValidGrade(grade: unknown): grade is number {
  return typeof grade === 'number' && Number.isInteger(grade) && grade >= 1 && grade <= 12;
}

/**
 * A student needs a grade from 1 to 12; a parent has none. Returns the cleaned grade,
 * or null when the combination is not allowed.
 */
export function gradeForRole(role: AllowlistRole, grade: unknown): { grade: number | null } | null {
  if (role === 'student') return isValidGrade(grade) ? { grade } : null;
  if (role === 'parent') return grade == null ? { grade: null } : null;
  return null;
}

/** Validated allowlist entry, or null when the email, role or grade is not acceptable. */
export function cleanAllowlistInput(input: { email: unknown; role: unknown; grade?: unknown }): AllowlistInput | null {
  const email = normalizeEmail(typeof input.email === 'string' ? input.email : null);
  if (!email || !isValidEmail(email)) return null;
  if (input.role !== 'student' && input.role !== 'parent') return null;
  const checked = gradeForRole(input.role, input.grade ?? null);
  return checked ? { email, role: input.role, grade: checked.grade } : null;
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

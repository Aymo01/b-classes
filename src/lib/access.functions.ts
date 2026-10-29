import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireApprovedMember } from '@/lib/access/middleware';
import { emailFromClaims, getAccessRepository, loadAccess } from '@/lib/access';
import { isValidEmail, normalizeEmail } from '@/lib/access/policy';
import type { AllowlistRole } from '@/lib/access/types';

/** Open to any signed-in user (pending ones too): only reports their own status. */
export const getMyAccess = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    loadAccess(getAccessRepository(context.supabase), context.userId, emailFromClaims(context.claims)),
  );

/** Approved members only; each handler then checks the admin role itself. */
const requireAdmin = requireApprovedMember;

function assertAdmin(roles: string[]) {
  if (!roles.includes('admin')) throw new Error('غير مصرح');
}

function cleanEmail(raw: unknown) {
  const email = normalizeEmail(String(raw ?? '')) ?? '';
  if (!isValidEmail(email)) throw new Error('البريد الإلكتروني غير صالح');
  return email;
}

function cleanGrade(raw: unknown) {
  const grade = Number(raw);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error('الصف غير صالح');
  return grade;
}

function cleanRole(raw: unknown): AllowlistRole {
  if (raw !== 'student' && raw !== 'parent') throw new Error('الدور غير صالح');
  return raw;
}

// ---- Teachers (school email only) ----

export const listTeacherAccounts = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    assertAdmin(context.access.roles);
    return context.accessRepo.listTeacherAccounts();
  });

export const addTeacherAccount = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { schoolEmail: string }) => ({ schoolEmail: cleanEmail(input.schoolEmail) }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    await context.accessRepo.addTeacherAccount(data.schoolEmail);
    return { ok: true };
  });

export const removeTeacherAccount = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { schoolEmail: string }) => ({ schoolEmail: cleanEmail(input.schoolEmail) }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    await context.accessRepo.removeTeacherAccount(data.schoolEmail);
    return { ok: true };
  });

// ---- Students and parents (approved list) ----

export const listStudentAllowlist = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    assertAdmin(context.access.roles);
    return context.accessRepo.listStudentAllowlist();
  });

export const addStudentAllowlist = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { email: string; role: AllowlistRole; grade?: number | null }) => {
    const role = cleanRole(input.role);
    return { email: cleanEmail(input.email), role, grade: role === 'student' ? cleanGrade(input.grade) : null };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    await context.accessRepo.addStudentAllowlist(data.email, data.role, data.grade, context.userId);
    return { ok: true };
  });

export const removeStudentAllowlist = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { email: string }) => ({ email: cleanEmail(input.email) }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    await context.accessRepo.removeStudentAllowlist(data.email);
    return { ok: true };
  });

// ---- Pending sign-ups ----

export const listPendingUsers = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    assertAdmin(context.access.roles);
    return context.accessRepo.listPendingUsers();
  });

export const approvePendingUser = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string; email: string; role: AllowlistRole; grade?: number | null }) => {
    const role = cleanRole(input.role);
    return {
      userId: String(input.userId ?? ''),
      email: cleanEmail(input.email),
      role,
      grade: role === 'student' ? cleanGrade(input.grade) : null,
    };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    await context.accessRepo.approvePendingUser(data.userId, data.email, data.role, data.grade, context.userId);
    return { ok: true };
  });

export const rejectPendingUser = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string }) => ({ userId: String(input.userId ?? '') }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    await context.accessRepo.rejectPendingUser(data.userId);
    return { ok: true };
  });

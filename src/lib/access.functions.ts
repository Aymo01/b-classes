import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireApprovedMember } from '@/lib/access/middleware';
import { emailFromClaims, getAccessRepository, loadAccess } from '@/lib/access';
import { cleanAllowlistInput, gradeForRole, isValidEmail, normalizeEmail } from '@/lib/access/policy';
import type { AllowlistRole } from '@/lib/access/types';

/** Open to any signed-in user (pending ones too): only reports their own status. */
export const getMyAccess = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    loadAccess(getAccessRepository(context.supabase), context.userId, emailFromClaims(context.claims)),
  );

// Every function below also checks the admin role: being an approved member is not enough.
function assertAdmin(roles: string[]) {
  if (!roles.includes('admin')) throw new Error('غير مصرح');
}

const INVALID_EMAIL = 'البريد الإلكتروني غير صالح';
const FAILED = 'تعذر تنفيذ الطلب. حاول مرة أخرى.';
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;

/* ---------- Teachers ---------- */

export const listTeachers = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    assertAdmin(context.access.roles);
    return context.accessRepo.listTeachers();
  });

export const addTeacher = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string }) => {
    const email = normalizeEmail(String(input.email ?? '')) ?? '';
    if (!isValidEmail(email)) throw new Error(INVALID_EMAIL);
    return { email };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    try {
      await context.accessRepo.addTeacher(data.email, context.userId);
    } catch {
      throw new Error('تعذر إضافة المعلم');
    }
    return { ok: true };
  });

export const removeTeacher = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string }) => ({ email: normalizeEmail(String(input.email ?? '')) ?? '' }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    try {
      await context.accessRepo.removeTeacher(data.email);
    } catch {
      throw new Error('تعذر إزالة المعلم');
    }
    return { ok: true };
  });

/* ---------- Students and parents ---------- */

export const listStudentAllowlist = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    assertAdmin(context.access.roles);
    return context.accessRepo.listAllowlist();
  });

export const addStudentAllowlist = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string; role: AllowlistRole; grade?: number | null }) => {
    const clean = cleanAllowlistInput(input);
    if (!clean) throw new Error('تحقق من البريد والدور، والصف من 1 إلى 12 للطالب فقط.');
    return clean;
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    try {
      await context.accessRepo.addAllowlist(data, context.userId);
    } catch {
      throw new Error(FAILED);
    }
    return { ok: true };
  });

export const removeStudentAllowlist = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string }) => ({ email: normalizeEmail(String(input.email ?? '')) ?? '' }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    try {
      await context.accessRepo.removeAllowlist(data.email);
    } catch {
      throw new Error(FAILED);
    }
    return { ok: true };
  });

/* ---------- Pending sign-ups ---------- */

export const listPendingSignups = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    assertAdmin(context.access.roles);
    return context.accessRepo.listPendingSignups();
  });

export const approveSignup = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { userId: string; role: AllowlistRole; grade?: number | null }) => {
    if (!isId(input.userId) || (input.role !== 'student' && input.role !== 'parent')) throw new Error(FAILED);
    const checked = gradeForRole(input.role, input.grade ?? null);
    if (!checked) throw new Error('الصف من 1 إلى 12 للطالب فقط، ولا صف لولي الأمر.');
    return { userId: input.userId, role: input.role, grade: checked.grade };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    try {
      await context.accessRepo.approveSignup(data.userId, data.role, data.grade, context.userId);
    } catch {
      throw new Error(FAILED);
    }
    return { ok: true };
  });

export const rejectSignup = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { userId: string }) => {
    if (!isId(input.userId)) throw new Error(FAILED);
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    try {
      await context.accessRepo.rejectSignup(data.userId, context.userId);
    } catch {
      throw new Error(FAILED);
    }
    return { ok: true };
  });

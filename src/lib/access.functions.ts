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

export const getMyTeacherEmails = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    if (!context.access.roles.includes('teacher')) return null;
    return context.accessRepo.getTeacherAccount(context.userId);
  });

export const linkMyPersonalEmail = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string }) => {
    const email = normalizeEmail(String(input.email ?? '')) ?? '';
    if (!isValidEmail(email)) throw new Error('البريد الإلكتروني غير صالح');
    return { email };
  })
  .handler(async ({ data, context }) => {
    if (!context.access.roles.includes('teacher')) throw new Error('هذه الميزة للمعلمين فقط');
    try {
      return await context.accessRepo.linkPersonalEmail(context.userId, data.email);
    } catch {
      throw new Error('تعذر ربط البريد. ربما هو مستخدم مسبقًا.');
    }
  });

function assertAdmin(roles: string[]) {
  if (!roles.includes('admin')) throw new Error('غير مصرح');
}

export const listStudentAllowlist = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    assertAdmin(context.access.roles);
    return context.accessRepo.listStudentAllowlist();
  });

export const addStudentAllowlist = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string; role: AllowlistRole }) => {
    const email = normalizeEmail(String(input.email ?? '')) ?? '';
    if (!isValidEmail(email)) throw new Error('البريد الإلكتروني غير صالح');
    if (input.role !== 'student' && input.role !== 'parent') throw new Error('الدور غير صالح');
    return { email, role: input.role };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    await context.accessRepo.addStudentAllowlist(data.email, data.role, context.userId);
    return { ok: true };
  });

export const removeStudentAllowlist = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string }) => ({ email: normalizeEmail(String(input.email ?? '')) ?? '' }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    await context.accessRepo.removeStudentAllowlist(data.email);
    return { ok: true };
  });

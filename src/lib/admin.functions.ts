import { createServerFn } from '@tanstack/react-start';
import { requireApprovedMember } from '@/lib/access/middleware';

export type TeacherEntryDTO = { email: string; hasAccount: boolean; addedAt: string };

export const listTeachers = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('admin_list_teachers');
    if (error) throw new Error('غير مصرح');
    return (data ?? []).map((r) => ({ email: r.email, hasAccount: r.has_account, addedAt: r.added_at })) as TeacherEntryDTO[];
  });

export const addTeacher = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string }) => {
    const email = String(input.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('البريد الإلكتروني غير صالح');
    return { email };
  })
  .handler(async ({ data, context }) => {
    const { data: existed, error } = await context.supabase.rpc('admin_add_teacher', { _email: data.email });
    if (error) throw new Error('تعذر إضافة المعلم');
    await context.accessRepo.createTeacherAccount(data.email);
    return { hasAccount: Boolean(existed) };
  });

export const removeTeacher = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { email: string }) => ({ email: String(input.email ?? '').trim().toLowerCase() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('admin_remove_teacher', { _email: data.email });
    if (error) throw new Error('تعذر إزالة المعلم');
    return { ok: true };
  });

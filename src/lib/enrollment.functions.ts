import { createServerFn } from '@tanstack/react-start';
import { requireApprovedMember } from '@/lib/access/middleware';
import { toTeacherOptions, type TeacherOption } from '@/lib/enrollment/logic';

const isStudent = (roles: string[]) => roles.includes('student');

/** Teachers a student can pick, flagged with the ones they are already enrolled with. */
export const listTeachersForStudent = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<TeacherOption[]> => {
    const { supabase, userId } = context;
    const [teachers, enrollments] = await Promise.all([
      supabase.rpc('list_teachers'),
      supabase.from('enrollments').select('teacher_id').eq('student_id', userId),
    ]);
    if (teachers.error) throw new Error('تعذر تحميل المعلمين. حاول مرة أخرى.');
    return toTeacherOptions(teachers.data ?? [], (enrollments.data ?? []).map((e) => e.teacher_id));
  });

export const enrollWithTeacher = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { teacherId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!isStudent(context.access.roles as string[])) throw new Error('التسجيل مع معلم متاح للطلاب فقط.');
    const { error } = await context.supabase.from('enrollments').insert({ student_id: context.userId, teacher_id: data.teacherId });
    // 23505: already enrolled, which is the state the student asked for.
    if (error && error.code !== '23505') throw new Error('تعذر التسجيل مع هذا المعلم.');
    return { ok: true };
  });

export const leaveTeacher = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { teacherId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('enrollments').delete().eq('student_id', context.userId).eq('teacher_id', data.teacherId);
    if (error) throw new Error('تعذر إلغاء التسجيل.');
    return { ok: true };
  });

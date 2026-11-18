import { createServerFn } from '@tanstack/react-start';
import { requireApprovedMember } from '@/lib/access/middleware';
import { toRoster, toTeacherOptions, type EnrolledStudent, type TeacherOption } from '@/lib/enrollment/logic';

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

/** The logged-in teacher's own roster, never other teachers' students. */
export const listMyStudents = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<EnrolledStudent[]> => {
    const { supabase, userId } = context;
    const roles = context.access.roles as string[];
    if (!roles.includes('teacher') && !roles.includes('admin')) throw new Error('هذه الصلاحية متاحة للمعلمين فقط.');
    const { data: enrollments } = await supabase.from('enrollments').select('student_id, teacher_id, created_at').eq('teacher_id', userId);
    const ids = [...new Set((enrollments ?? []).map((e) => e.student_id))];
    if (ids.length === 0) return [];
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, grade').in('id', ids);
    return toRoster(userId, enrollments ?? [], profiles ?? []);
  });

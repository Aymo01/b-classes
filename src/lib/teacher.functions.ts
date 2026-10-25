import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

async function assertEditor(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
) {
  const teacher = await supabase.rpc('has_role', { _user_id: userId, _role: 'teacher' });
  const admin = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (!teacher.data && !admin.data) throw new Error('هذه الصلاحية متاحة للمعلمين فقط.');
}

export const createSubject = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { title: string; description?: string | null; grade: number }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: subject, error } = await context.supabase
      .from('subjects')
      .insert({ title: data.title, description: data.description ?? null, grade: data.grade, created_by: context.userId })
      .select('id')
      .single();
    if (error || !subject) throw new Error('تعذر إنشاء المادة');
    return { id: subject.id };
  });

export const createLesson = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subjectId: string;
      title: string;
      description?: string | null;
      videoUrl?: string | null;
      notes?: string | null;
      orderIndex?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: lesson, error } = await context.supabase
      .from('lessons')
      .insert({
        subject_id: data.subjectId,
        title: data.title,
        description: data.description ?? null,
        video_url: data.videoUrl ?? null,
        notes: data.notes ?? null,
        order_index: data.orderIndex ?? 0,
        created_by: context.userId,
      })
      .select('id')
      .single();
    if (error || !lesson) throw new Error('تعذر إنشاء الدرس');
    return { id: lesson.id };
  });

export const createClass = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subjectId: string;
      title: string;
      description?: string | null;
      scheduledAt: string;
      durationMinutes?: number;
      meetingUrl?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: cls, error } = await context.supabase
      .from('classes')
      .insert({
        subject_id: data.subjectId,
        title: data.title,
        description: data.description ?? null,
        scheduled_at: data.scheduledAt,
        duration_minutes: data.durationMinutes ?? 45,
        meeting_url: data.meetingUrl ?? null,
        created_by: context.userId,
      })
      .select('id')
      .single();
    if (error || !cls) throw new Error('تعذر إنشاء الحصة');
    return { id: cls.id };
  });

export const createAssignment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { subjectId: string; title: string; instructions?: string | null; dueAt?: string | null }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: assignment, error } = await context.supabase
      .from('assignments')
      .insert({
        subject_id: data.subjectId,
        title: data.title,
        instructions: data.instructions ?? null,
        due_at: data.dueAt ?? null,
        created_by: context.userId,
      })
      .select('id')
      .single();
    if (error || !assignment) throw new Error('تعذر إنشاء الواجب');
    return { id: assignment.id };
  });

export const createQuiz = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subjectId: string;
      title: string;
      description?: string | null;
      dueAt?: string | null;
      questions: { questionText: string; options: string[]; correctIndex: number; points?: number }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, context.userId);
    if (data.questions.length === 0) throw new Error('أضف سؤالًا واحدًا على الأقل');
    const { data: quiz, error } = await context.supabase
      .from('quizzes')
      .insert({
        subject_id: data.subjectId,
        title: data.title,
        description: data.description ?? null,
        due_at: data.dueAt ?? null,
        created_by: context.userId,
      })
      .select('id')
      .single();
    if (error || !quiz) throw new Error('تعذر إنشاء الاختبار');
    const rows = data.questions.map((q, index) => ({
      quiz_id: quiz.id,
      question_text: q.questionText,
      options: q.options,
      correct_index: q.correctIndex,
      points: q.points ?? 1,
      order_index: index,
    }));
    const { error: questionsError } = await context.supabase.from('quiz_questions').insert(rows);
    if (questionsError) throw new Error('تعذر حفظ أسئلة الاختبار');
    return { id: quiz.id };
  });

export type TeacherRowDTO = { id: string; title: string; meta: string; subjectTitle: string; grade: number };

export const listTeacherContent = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase, context.userId);
    const [subjects, lessons, classes, assignments, quizzes, submissions] = await Promise.all([
      context.supabase.from('subjects').select('id, title, grade').order('grade').order('title'),
      context.supabase.from('lessons').select('id, title, order_index, subject:subjects(title, grade)').order('created_at', { ascending: false }),
      context.supabase.from('classes').select('id, title, scheduled_at, subject:subjects(title, grade)').order('scheduled_at', { ascending: false }),
      context.supabase.from('assignments').select('id, title, due_at, subject:subjects(title, grade)').order('created_at', { ascending: false }),
      context.supabase.from('quizzes').select('id, title, due_at, subject:subjects(title, grade)').order('created_at', { ascending: false }),
      context.supabase
        .from('submissions')
        .select('id, status, score, feedback, submitted_at, assignment_id, student_id')
        .order('submitted_at', { ascending: false })
        .limit(60),
    ]);
    const assignmentMap = new Map(
      ((assignments.data ?? []) as { id: string; title: string }[]).map((a) => [a.id, a.title]),
    );
    const studentIds = [...new Set((submissions.data ?? []).map((s) => s.student_id))];
    const { data: students } = studentIds.length
      ? await context.supabase.from('profiles').select('id, display_name').in('id', studentIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const studentMap = new Map((students ?? []).map((s) => [s.id, s.display_name]));

    return {
      subjects: (subjects.data ?? []) as { id: string; title: string; grade: number }[],
      lessons: (lessons.data ?? []).map((l) => ({
        id: l.id,
        title: l.title,
        meta: `الترتيب ${l.order_index}`,
        subjectTitle: l.subject?.title ?? '',
        grade: l.subject?.grade ?? 0,
      })),
      classes: (classes.data ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        meta: new Date(c.scheduled_at).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }),
        subjectTitle: c.subject?.title ?? '',
        grade: c.subject?.grade ?? 0,
      })),
      assignments: (assignments.data ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        meta: a.due_at ? `التسليم: ${new Date(a.due_at).toLocaleDateString('ar')}` : 'بدون موعد تسليم',
        subjectTitle: a.subject?.title ?? '',
        grade: a.subject?.grade ?? 0,
      })),
      quizzes: (quizzes.data ?? []).map((q) => ({
        id: q.id,
        title: q.title,
        meta: q.due_at ? `التسليم: ${new Date(q.due_at).toLocaleDateString('ar')}` : 'متاح دائمًا',
        subjectTitle: q.subject?.title ?? '',
        grade: q.subject?.grade ?? 0,
      })),
      submissions: (submissions.data ?? []).map((s) => ({
        id: s.id,
        assignmentTitle: assignmentMap.get(s.assignment_id) ?? 'واجب',
        studentName: studentMap.get(s.student_id) ?? 'طالب',
        status: s.status,
        score: s.score == null ? null : Number(s.score),
        feedback: s.feedback,
        submittedAt: s.submitted_at,
      })),
    };
  });

export const gradeSubmission = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { submissionId: string; score: number; feedback?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, context.userId);
    const { error } = await context.supabase
      .from('submissions')
      .update({ status: 'reviewed', score: data.score, feedback: data.feedback ?? null, reviewed_at: new Date().toISOString() })
      .eq('id', data.submissionId);
    if (error) throw new Error('تعذر حفظ التقييم');
    return { ok: true };
  });

export const deleteContent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: 'subjects' | 'lessons' | 'classes' | 'assignments' | 'quizzes'; id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, context.userId);
    const allowed = ['subjects', 'lessons', 'classes', 'assignments', 'quizzes'] as const;
    if (!allowed.includes(data.table)) throw new Error('طلب غير صالح');
    const { error } = await context.supabase.from(data.table).delete().eq('id', data.id);
    if (error) throw new Error('تعذر الحذف');
    return { ok: true };
  });

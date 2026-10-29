import { createServerFn } from '@tanstack/react-start';
import { requireApprovedMember } from '@/lib/access/middleware';

export type ProfileDTO = {
  id: string;
  displayName: string | null;
  grade: number | null;
  inviteCode: string;
};

export const getMyProfile = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      context.supabase
        .from('profiles')
        .select('id, display_name, grade, invite_code')
        .eq('id', context.userId)
        .maybeSingle(),
      context.supabase.from('user_roles').select('role').eq('user_id', context.userId),
    ]);
    return {
      profile: profile
        ? {
            id: profile['id'],
            displayName: profile['display_name'],
            grade: profile['grade'],
            inviteCode: profile['invite_code'],
          }
        : null,
      roles: (roles ?? []).map((row) => row['role']),
    };
  });

export const updateMyProfile = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator(
    (input: { displayName?: string | null; grade?: number | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: { display_name?: string | null; grade?: number | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.grade !== undefined) patch.grade = data.grade;
    const { error } = await context.supabase
      .from('profiles')
      .update(patch)
      .eq('id', context.userId);
    if (error) throw new Error('لم نتمكن من حفظ البيانات. حاول مرة أخرى.');
    return { ok: true };
  });

export const linkChildByCode = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: studentId, error } = await context.supabase.rpc('link_parent_by_code', {
      _code: data.code,
    });
    if (error || !studentId) throw new Error('لم نجد طالبًا بهذا الرمز. تأكد من الرمز وحاول مجددًا.');
    return { studentId };
  });

export type ChildDTO = {
  id: string;
  displayName: string | null;
  grade: number | null;
  linkedAt: string;
};

export const listMyChildren = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    const { data: links } = await context.supabase
      .from('parent_links')
      .select('student_id, created_at')
      .eq('parent_id', context.userId);
    const ids = (links ?? []).map((l) => l.student_id);
    if (ids.length === 0) return { children: [] as ChildDTO[] };
    const { data: students } = await context.supabase
      .from('profiles')
      .select('id, display_name, grade')
      .in('id', ids);
    const byId = new Map((students ?? []).map((s) => [s.id, s]));
    return {
      children: (links ?? []).map((l) => ({
        id: l.student_id,
        displayName: byId.get(l.student_id)?.display_name ?? null,
        grade: byId.get(l.student_id)?.grade ?? null,
        linkedAt: l.created_at,
      })),
    };
  });

export type StudentOverviewDTO = {
  lessonsCompleted: number;
  lessonsTotal: number;
  assignmentsSubmitted: number;
  assignmentsReviewed: number;
  assignmentsAverage: number | null;
  quizzesTaken: number;
  quizzesAverage: number | null;
  upcomingClasses: { id: string; title: string; scheduledAt: string; subjectTitle: string }[];
  recentSubmissions: { id: string; title: string; status: string; score: number | null; feedback: string | null }[];
  recentAttempts: { id: string; title: string; score: number; total: number; submittedAt: string }[];
};

export const getStudentOverview = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { studentId: string }) => input)
  .handler(async ({ data, context }): Promise<StudentOverviewDTO> => {
    const uid = context.userId;
    // Authorization: the student themself, a linked parent, or a teacher/admin.
    if (data.studentId !== uid) {
      const { data: link } = await context.supabase
        .from('parent_links')
        .select('id')
        .eq('parent_id', uid)
        .eq('student_id', data.studentId)
        .maybeSingle();
      if (!link) {
        const isTeacher = await context.supabase.rpc('has_role', { _user_id: uid, _role: 'teacher' });
        const isAdmin = await context.supabase.rpc('has_role', { _user_id: uid, _role: 'admin' });
        if (!isTeacher.data && !isAdmin.data) throw new Error('Forbidden');
      }
    }
    const { data: student } = await context.supabase
      .from('profiles')
      .select('grade')
      .eq('id', data.studentId)
      .maybeSingle();
    const grade = student?.grade ?? null;

    const [completions, lessonsInGrade, subs, attempts, classes, assignmentTitles, quizTitles] =
      await Promise.all([
        context.supabase.from('lesson_completions').select('lesson_id').eq('student_id', data.studentId),
        grade
          ? context.supabase.from('lessons').select('id, subject:subjects!inner(grade)').eq('subjects.grade', grade)
          : Promise.resolve({ data: [] as { id: string }[] }),
        context.supabase
          .from('submissions')
          .select('id, status, score, feedback, submitted_at, assignment_id')
          .eq('student_id', data.studentId)
          .order('submitted_at', { ascending: false }),
        context.supabase
          .from('quiz_attempts')
          .select('id, quiz_id, score, total_points, submitted_at')
          .eq('student_id', data.studentId)
          .order('submitted_at', { ascending: false }),
        grade
          ? context.supabase
              .from('classes')
              .select('id, title, scheduled_at, subject:subjects!inner(title, grade)')
              .eq('subjects.grade', grade)
              .gte('scheduled_at', new Date().toISOString())
              .order('scheduled_at', { ascending: true })
              .limit(3)
          : Promise.resolve({ data: [] as { id: string; title: string; scheduled_at: string; subject: { title: string } }[] }),
        context.supabase.from('assignments').select('id, title'),
        context.supabase.from('quizzes').select('id, title'),
      ]);

    const completed = new Set((completions.data ?? []).map((c) => c.lesson_id));
    const reviewedScores = (subs.data ?? []).filter((s) => s.score != null).map((s) => Number(s.score));
    const percentages = (attempts.data ?? []).map((a) => (Number(a.score) / Math.max(Number(a.total_points), 1)) * 100);
    const assignmentMap = new Map((assignmentTitles.data ?? []).map((a) => [a.id, a.title]));
    const quizMap = new Map((quizTitles.data ?? []).map((q) => [q.id, q.title]));

    return {
      lessonsCompleted: completed.size,
      lessonsTotal: (lessonsInGrade.data ?? []).length,
      assignmentsSubmitted: (subs.data ?? []).length,
      assignmentsReviewed: (subs.data ?? []).filter((s) => s.status === 'reviewed').length,
      assignmentsAverage: reviewedScores.length
        ? Math.round(reviewedScores.reduce((a, b) => a + b, 0) / reviewedScores.length)
        : null,
      quizzesTaken: (attempts.data ?? []).length,
      quizzesAverage: percentages.length
        ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
        : null,
      upcomingClasses: (classes.data ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        scheduledAt: c.scheduled_at,
        subjectTitle: c.subject?.title ?? '',
      })),
      recentSubmissions: (subs.data ?? []).slice(0, 5).map((s) => ({
        id: s.id,
        title: assignmentMap.get(s.assignment_id) ?? 'واجب',
        status: s.status,
        score: s.score == null ? null : Number(s.score),
        feedback: s.feedback,
      })),
      recentAttempts: (attempts.data ?? []).slice(0, 5).map((a) => ({
        id: a.id,
        title: quizMap.get(a.quiz_id) ?? 'اختبار',
        score: Number(a.score),
        total: Number(a.total_points),
        submittedAt: a.submitted_at,
      })),
    };
  });

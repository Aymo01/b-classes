import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type SubjectDTO = { id: string; title: string; description: string | null; grade: number };
export type LessonDTO = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  notes: string | null;
  orderIndex: number;
  subject: { id: string; title: string; grade: number } | null;
};
export type ClassDTO = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl: string | null;
  subject: { id: string; title: string; grade: number } | null;
};
export type AssignmentDTO = {
  id: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  subject: { id: string; title: string; grade: number } | null;
};
export type QuizDTO = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  subject: { id: string; title: string; grade: number } | null;
};
export type SubmissionDTO = {
  id: string;
  assignmentId: string;
  content: string | null;
  filePath: string | null;
  status: string;
  feedback: string | null;
  score: number | null;
  submittedAt: string;
};
export type QuizAttemptDTO = { quizId: string; score: number; total: number; submittedAt: string };

export const listSubjects = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { grade?: number | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    let query = context.supabase.from('subjects').select('id, title, description, grade');
    if (data?.grade) query = query.eq('grade', data.grade);
    const { data: subjects } = await query.order('grade').order('title');
    return (subjects ?? []) as SubjectDTO[];
  });

export const listLessons = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { grade?: number | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from('lessons')
      .select('id, title, description, video_url, notes, order_index, subject:subjects(id, title, grade)')
      .order('order_index');
    if (data?.grade) query = query.eq('subjects.grade', data.grade);
    const { data: lessons } = await query;
    return (lessons ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      videoUrl: l.video_url,
      notes: l.notes,
      orderIndex: l.order_index,
      subject: l.subject ? { id: l.subject.id, title: l.subject.title, grade: l.subject.grade } : null,
    })) as LessonDTO[];
  });

export const getLesson = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: lesson } = await context.supabase
      .from('lessons')
      .select('id, title, description, video_url, notes, order_index, subject:subjects(id, title, grade)')
      .eq('id', data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error('الدرس غير موجود');
    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      videoUrl: lesson.video_url,
      notes: lesson.notes,
      orderIndex: lesson.order_index,
      subject: lesson.subject ? { id: lesson.subject.id, title: lesson.subject.title, grade: lesson.subject.grade } : null,
    } as LessonDTO;
  });

export const listMyCompletions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from('lesson_completions')
      .select('lesson_id, completed_at')
      .eq('student_id', context.userId);
    return (data ?? []).map((c) => ({ lessonId: c.lesson_id, completedAt: c.completed_at }));
  });

export const setLessonCompleted = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; completed: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (data.completed) {
      const { error } = await context.supabase
        .from('lesson_completions')
        .insert({ lesson_id: data.lessonId, student_id: context.userId });
      if (error && error.code !== '23505') throw new Error('تعذر تحديث حالة الدرس');
    } else {
      await context.supabase
        .from('lesson_completions')
        .delete()
        .eq('lesson_id', data.lessonId)
        .eq('student_id', context.userId);
    }
    return { ok: true };
  });

export const listClasses = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { grade?: number | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from('classes')
      .select('id, title, description, scheduled_at, duration_minutes, meeting_url, subject:subjects(id, title, grade)')
      .order('scheduled_at');
    if (data?.grade) query = query.eq('subjects.grade', data.grade);
    const { data: classes } = await query;
    return (classes ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      scheduledAt: c.scheduled_at,
      durationMinutes: c.duration_minutes,
      meetingUrl: c.meeting_url,
      subject: c.subject ? { id: c.subject.id, title: c.subject.title, grade: c.subject.grade } : null,
    })) as ClassDTO[];
  });

export const listAssignments = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { grade?: number | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from('assignments')
      .select('id, title, instructions, due_at, subject:subjects(id, title, grade)')
      .order('created_at', { ascending: false });
    if (data?.grade) query = query.eq('subjects.grade', data.grade);
    const { data: assignments } = await query;
    return (assignments ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      dueAt: a.due_at,
      subject: a.subject ? { id: a.subject.id, title: a.subject.title, grade: a.subject.grade } : null,
    })) as AssignmentDTO[];
  });

export const getAssignment = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { assignmentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: assignment } = await context.supabase
      .from('assignments')
      .select('id, title, instructions, due_at, subject:subjects(id, title, grade)')
      .eq('id', data.assignmentId)
      .maybeSingle();
    if (!assignment) throw new Error('الواجب غير موجود');
    return {
      id: assignment.id,
      title: assignment.title,
      instructions: assignment.instructions,
      dueAt: assignment.due_at,
      subject: assignment.subject
        ? { id: assignment.subject.id, title: assignment.subject.title, grade: assignment.subject.grade }
        : null,
    } as AssignmentDTO;
  });

export const listMySubmissions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from('submissions')
      .select('id, assignment_id, content, file_path, status, feedback, score, submitted_at')
      .eq('student_id', context.userId)
      .order('submitted_at', { ascending: false });
    return (data ?? []).map((s) => ({
      id: s.id,
      assignmentId: s.assignment_id,
      content: s.content,
      filePath: s.file_path,
      status: s.status,
      feedback: s.feedback,
      score: s.score == null ? null : Number(s.score),
      submittedAt: s.submitted_at,
    })) as SubmissionDTO[];
  });

export const submitAssignment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { assignmentId: string; content?: string | null; filePath?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('submissions').insert({
      assignment_id: data.assignmentId,
      student_id: context.userId,
      content: data.content ?? null,
      file_path: data.filePath ?? null,
    });
    if (error) throw new Error('تعذر تسليم الواجب. حاول مرة أخرى.');
    return { ok: true };
  });

export const listQuizzes = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { grade?: number | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from('quizzes')
      .select('id, title, description, due_at, subject:subjects(id, title, grade)')
      .order('created_at', { ascending: false });
    if (data?.grade) query = query.eq('subjects.grade', data.grade);
    const { data: quizzes } = await query;
    return (quizzes ?? []).map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      dueAt: q.due_at,
      subject: q.subject ? { id: q.subject.id, title: q.subject.title, grade: q.subject.grade } : null,
    })) as QuizDTO[];
  });

export const listMyQuizAttempts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from('quiz_attempts')
      .select('quiz_id, score, total_points, submitted_at')
      .eq('student_id', context.userId)
      .order('submitted_at', { ascending: false });
    return (data ?? []).map((a) => ({
      quizId: a.quiz_id,
      score: Number(a.score),
      total: Number(a.total_points),
      submittedAt: a.submitted_at,
    })) as QuizAttemptDTO[];
  });

export type TakenQuizDTO = {
  id: string;
  title: string;
  description: string | null;
  subject: { id: string; title: string; grade: number } | null;
  questions: { id: string; questionText: string; options: string[]; points: number }[];
};

export const getQuizToTake = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quizId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: quiz } = await context.supabase
      .from('quizzes')
      .select('id, title, description, subject:subjects(id, title, grade)')
      .eq('id', data.quizId)
      .maybeSingle();
    if (!quiz) throw new Error('الاختبار غير موجود');
    const { data: questions } = await context.supabase.rpc('get_quiz_questions', { _quiz_id: data.quizId });
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      subject: quiz.subject ? { id: quiz.subject.id, title: quiz.subject.title, grade: quiz.subject.grade } : null,
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        questionText: q.question_text,
        options: (q.options as string[]) ?? [],
        points: q.points,
      })),
    } as TakenQuizDTO;
  });

export type QuizResultDTO = {
  score: number;
  total: number;
  submittedAt: string;
  questions: { id: string; questionText: string; options: string[]; correctIndex: number; points: number }[];
  answers: Record<string, number>;
};

export const submitQuizAttempt = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quizId: string; answers: Record<string, number> }) => input)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('submit_quiz', {
      _quiz_id: data.quizId,
      _answers: data.answers,
    });
    if (error || !result) throw new Error('تعذر إرسال الإجابات. حاول مرة أخرى.');
    return result as { score: number; total: number; questions: { id: string; correct_index: number }[] };
  });

export const getQuizResult = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quizId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: review, error } = await context.supabase.rpc('get_quiz_review', { _quiz_id: data.quizId });
    if (error || !review) throw new Error('لم تجد محاولة لهذا الاختبار بعد.');
    const parsed = review as unknown as {
      attempt: { score: number; total_points: number; submitted_at: string; answers: Record<string, number> | null };
      questions: { id: string; question_text: string; options: string[]; correct_index: number; points: number }[];
    };
    const attempt = parsed.attempt;
    return {
      score: Number(attempt.score),
      total: Number(attempt.total_points),
      submittedAt: attempt.submitted_at,
      answers: attempt.answers ?? {},
      questions: parsed.questions.map(
        (q) => ({
          id: q.id,
          questionText: q.question_text,
          options: (q.options as string[]) ?? [],
          correctIndex: q.correct_index,
          points: q.points,
        }),
      ),
    } as QuizResultDTO;
  });

export type NotificationDTO = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export const listNotifications = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from('notifications')
      .select('id, kind, title, body, read_at, created_at')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      readAt: n.read_at,
      createdAt: n.created_at,
    })) as NotificationDTO[];
  });

export const markNotificationsRead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', context.userId)
      .is('read_at', null);
    return { ok: true };
  });

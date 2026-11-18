export type TeacherOption = { id: string; name: string; enrolled: boolean };

const teacherFallbackName = 'معلم';

/** Teachers the student is enrolled with come first, then the rest; each group sorted by name. */
export function toTeacherOptions(teachers: { id: string; display_name: string | null }[], enrolledTeacherIds: string[]): TeacherOption[] {
  const enrolled = new Set(enrolledTeacherIds);
  return teachers
    .map((t) => ({ id: t.id, name: t.display_name?.trim() || teacherFallbackName, enrolled: enrolled.has(t.id) }))
    .sort((a, b) => Number(b.enrolled) - Number(a.enrolled) || a.name.localeCompare(b.name, 'ar'));
}

export type EnrolledStudent = { id: string; name: string; grade: number | null; enrolledAt: string };

/** A teacher's own roster: only enrolments pointing at that teacher, newest first. */
export function toRoster(
  teacherId: string,
  enrollments: { student_id: string; teacher_id: string; created_at: string }[],
  profiles: { id: string; display_name: string | null; grade: number | null }[],
): EnrolledStudent[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return enrollments
    .filter((e) => e.teacher_id === teacherId)
    .map((e) => ({
      id: e.student_id,
      name: byId.get(e.student_id)?.display_name?.trim() || 'طالب',
      grade: byId.get(e.student_id)?.grade ?? null,
      enrolledAt: e.created_at,
    }))
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
}

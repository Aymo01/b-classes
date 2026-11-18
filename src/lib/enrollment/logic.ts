export type TeacherOption = { id: string; name: string; enrolled: boolean };

const teacherFallbackName = 'معلم';

/** Teachers the student is enrolled with come first, then the rest; each group sorted by name. */
export function toTeacherOptions(teachers: { id: string; display_name: string | null }[], enrolledTeacherIds: string[]): TeacherOption[] {
  const enrolled = new Set(enrolledTeacherIds);
  return teachers
    .map((t) => ({ id: t.id, name: t.display_name?.trim() || teacherFallbackName, enrolled: enrolled.has(t.id) }))
    .sort((a, b) => Number(b.enrolled) - Number(a.enrolled) || a.name.localeCompare(b.name, 'ar'));
}

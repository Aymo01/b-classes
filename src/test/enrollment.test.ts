import { describe, expect, it } from 'vitest';
import { toRoster, toTeacherOptions } from '@/lib/enrollment/logic';

describe('teacher options for a student', () => {
  const teachers = [
    { id: 't1', display_name: 'خالد' },
    { id: 't2', display_name: 'سارة' },
    { id: 't3', display_name: null },
  ];

  it('flags enrolled teachers and lists them first', () => {
    const options = toTeacherOptions(teachers, ['t2']);
    expect(options[0]).toEqual({ id: 't2', name: 'سارة', enrolled: true });
    expect(options.slice(1).every((o) => !o.enrolled)).toBe(true);
    expect(options).toHaveLength(3);
  });

  it('names a teacher without a display name instead of leaving it blank', () => {
    expect(toTeacherOptions(teachers, []).find((o) => o.id === 't3')?.name).toBe('معلم');
  });

  it('ignores enrolments for teachers that are no longer listed', () => {
    expect(toTeacherOptions(teachers, ['gone']).every((o) => !o.enrolled)).toBe(true);
  });
});

describe('teacher roster', () => {
  const enrollments = [
    { student_id: 's1', teacher_id: 'me', created_at: '2026-01-01T00:00:00Z' },
    { student_id: 's2', teacher_id: 'me', created_at: '2026-02-01T00:00:00Z' },
    { student_id: 's3', teacher_id: 'someone-else', created_at: '2026-03-01T00:00:00Z' },
  ];
  const profiles = [
    { id: 's1', display_name: 'ليو', grade: 5 },
    { id: 's2', display_name: null, grade: null },
    { id: 's3', display_name: 'نور', grade: 7 },
  ];

  it('lists only students enrolled with this teacher, newest first', () => {
    const roster = toRoster('me', enrollments, profiles);
    expect(roster.map((s) => s.id)).toEqual(['s2', 's1']);
    expect(roster.some((s) => s.id === 's3')).toBe(false);
  });

  it('falls back to a generic name and no grade', () => {
    expect(toRoster('me', enrollments, profiles)[0]).toMatchObject({ name: 'طالب', grade: null });
  });

  it('is empty for a teacher nobody enrolled with', () => {
    expect(toRoster('nobody', enrollments, profiles)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { toTeacherOptions } from '@/lib/enrollment/logic';

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

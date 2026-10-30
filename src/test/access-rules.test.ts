import { describe, it, expect } from 'vitest';
import { cleanAllowlistInput, gradeForRole, resolveAccess } from '@/lib/access/policy';
import { createMockAccessRepository } from '@/lib/access/mock-repository';

const base = { email: 'x@example.com', isAdmin: false, teacher: null, allowlistRole: null };
const teacher = { id: 't', userId: 'u', schoolEmail: 'ali@school.edu', lastSignInAt: null, createdAt: '2026-01-01T00:00:00Z' };

describe('Approved-members rule', () => {
  it('a signed-in user with no role is pending', () => {
    expect(resolveAccess(base)).toMatchObject({ status: 'pending', roles: [] });
  });
  it('allowlisted student is approved as student', () => {
    expect(resolveAccess({ ...base, allowlistRole: 'student' })).toMatchObject({ status: 'approved', roles: ['student'] });
  });
  it('allowlisted parent is approved as parent', () => {
    expect(resolveAccess({ ...base, allowlistRole: 'parent' }).roles).toEqual(['parent']);
  });
  it('an admin is approved as admin', () => {
    expect(resolveAccess({ ...base, isAdmin: true })).toMatchObject({ status: 'approved', roles: ['admin'] });
  });
  it('teacher signs in with the issued school email, in any letter case', () => {
    expect(resolveAccess({ ...base, email: 'Ali@School.edu', teacher }).roles).toEqual(['teacher']);
  });
  it('a personal email never gets the teacher role', () => {
    expect(resolveAccess({ ...base, email: 'ali@gmail.com', teacher }).status).toBe('pending');
  });
});

describe('Allowlist validation', () => {
  it('a student needs a grade from 1 to 12', () => {
    expect(gradeForRole('student', 5)).toEqual({ grade: 5 });
    expect(gradeForRole('student', null)).toBeNull();
    expect(gradeForRole('student', 0)).toBeNull();
    expect(gradeForRole('student', 13)).toBeNull();
    expect(gradeForRole('student', 4.5)).toBeNull();
    expect(gradeForRole('student', '5')).toBeNull();
  });
  it('a parent has no grade', () => {
    expect(gradeForRole('parent', null)).toEqual({ grade: null });
    expect(gradeForRole('parent', 5)).toBeNull();
  });
  it('cleans the email and rejects bad input', () => {
    expect(cleanAllowlistInput({ email: '  Kid@Example.com ', role: 'student', grade: 3 })).toEqual({ email: 'kid@example.com', role: 'student', grade: 3 });
    expect(cleanAllowlistInput({ email: 'not-an-email', role: 'parent' })).toBeNull();
    expect(cleanAllowlistInput({ email: 'a@b.co', role: 'teacher', grade: null })).toBeNull();
    expect(cleanAllowlistInput({ email: 'a@b.co', role: 'student' })).toBeNull();
  });
});

describe('Mock repository', () => {
  it('links a teacher to their account on first sign-in with the school email and records the time', async () => {
    const repo = createMockAccessRepository();
    await repo.addTeacher('New.Teacher@school.edu', 'admin-1');
    const facts = await repo.getAccessFacts('user-1', 'new.teacher@school.edu');
    expect(resolveAccess(facts).roles).toEqual(['teacher']);
    const [row] = (await repo.listTeachers()).filter((t) => t.schoolEmail === 'new.teacher@school.edu');
    expect(row).toMatchObject({ userId: 'user-1' });
    expect(row?.lastSignInAt).toBeTruthy();
  });

  it('removing a teacher takes the role away', async () => {
    const repo = createMockAccessRepository();
    await repo.addTeacher('gone@school.edu', 'admin-1');
    await repo.removeTeacher('gone@school.edu');
    expect(resolveAccess(await repo.getAccessFacts('user-2', 'gone@school.edu')).status).toBe('pending');
  });

  it('keeps the grade on an allowlist entry and updates it in place', async () => {
    const repo = createMockAccessRepository();
    await repo.addAllowlist({ email: 'Kid@Example.com', role: 'student', grade: 4 }, 'admin-1');
    await repo.addAllowlist({ email: 'kid@example.com', role: 'student', grade: 6 }, 'admin-1');
    const entries = (await repo.listAllowlist()).filter((a) => a.email === 'kid@example.com');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ role: 'student', grade: 6 });
  });

  it('lists a role-less sign-up as pending, and approving it grants the role and grade', async () => {
    const repo = createMockAccessRepository();
    expect(resolveAccess(await repo.getAccessFacts('user-3', 'new@example.com')).status).toBe('pending');
    expect(await repo.listPendingSignups()).toEqual([expect.objectContaining({ userId: 'user-3', email: 'new@example.com' })]);

    await repo.approveSignup('user-3', 'student', 7, 'admin-1');
    expect(await repo.listPendingSignups()).toEqual([]);
    expect(resolveAccess(await repo.getAccessFacts('user-3', 'new@example.com')).roles).toEqual(['student']);
    expect((await repo.listAllowlist()).find((a) => a.email === 'new@example.com')?.grade).toBe(7);
  });

  it('a rejected sign-up leaves the list, stays without a role and does not come back', async () => {
    const repo = createMockAccessRepository();
    await repo.getAccessFacts('user-4', 'nope@example.com');
    await repo.rejectSignup('user-4', 'admin-1');
    expect(await repo.listPendingSignups()).toEqual([]);
    expect(resolveAccess(await repo.getAccessFacts('user-4', 'nope@example.com')).status).toBe('pending');
    expect(await repo.listPendingSignups()).toEqual([]);
  });

  it('users who already hold a role are never listed as pending', async () => {
    const repo = createMockAccessRepository();
    await repo.getAccessFacts('s-1', 'student.bclasses.test@gmail.com');
    await repo.getAccessFacts('a-1', 'admin.bclasses.test@gmail.com');
    expect(await repo.listPendingSignups()).toEqual([]);
  });
});

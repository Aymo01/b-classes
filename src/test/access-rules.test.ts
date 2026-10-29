import { describe, it, expect } from 'vitest';
import { resolveAccess } from '@/lib/access/policy';
import { createMockAccessRepository } from '@/lib/access/mock-repository';

const base = { email: 'x@example.com', isAdmin: false, teacher: null, allowlistRole: null };
const teacher = { id: 't', userId: 'u', schoolEmail: 'ali@school.edu', lastSignInEmail: null, createdAt: '2026-01-01T00:00:00Z' };

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
  it('teacher signs in with the school email (case-insensitive)', () => {
    expect(resolveAccess({ ...base, email: 'ALI@school.edu', teacher }).roles).toEqual(['teacher']);
  });
  it('teacher cannot use any other address, even a personal one', () => {
    expect(resolveAccess({ ...base, email: 'ali@gmail.com', teacher }).status).toBe('pending');
  });
  it('an admin is approved', () => {
    expect(resolveAccess({ ...base, isAdmin: true }).roles).toEqual(['admin']);
  });
});

describe('Mock repository', () => {
  it('records the address a teacher last signed in with', async () => {
    const repo = createMockAccessRepository();
    await repo.addTeacherAccount('new.teacher@school.edu');
    const facts = await repo.getAccessFacts('user-1', 'new.teacher@school.edu');
    expect(facts.teacher?.lastSignInEmail).toBe('new.teacher@school.edu');
    expect(facts.teacher?.userId).toBe('user-1');
  });
  it('a teacher account is not matched by any other address', async () => {
    const repo = createMockAccessRepository();
    await repo.addTeacherAccount('solo.teacher@school.edu');
    const facts = await repo.getAccessFacts('user-2', 'someone@gmail.com');
    expect(facts.teacher).toBeNull();
  });
  it('a sign-up with no role shows in the pending list, and approval removes it', async () => {
    const repo = createMockAccessRepository();
    await repo.getAccessFacts('pending-1', 'kid@example.com');
    expect((await repo.listPendingUsers()).map((u) => u.userId)).toContain('pending-1');
    await repo.approvePendingUser('pending-1', 'kid@example.com', 'student', 7, 'admin-1');
    expect((await repo.listPendingUsers()).map((u) => u.userId)).not.toContain('pending-1');
    const facts = await repo.getAccessFacts('pending-1', 'kid@example.com');
    expect(resolveAccess(facts).roles).toEqual(['student']);
  });
  it('a rejected sign-up leaves the pending list', async () => {
    const repo = createMockAccessRepository();
    await repo.getAccessFacts('pending-2', 'other@example.com');
    await repo.rejectPendingUser('pending-2');
    expect((await repo.listPendingUsers()).map((u) => u.userId)).not.toContain('pending-2');
  });
});

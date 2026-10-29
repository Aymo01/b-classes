import { describe, it, expect } from 'vitest';
import { resolveAccess } from '@/lib/access/policy';
import { createMockAccessRepository } from '@/lib/access/mock-repository';

const base = { email: 'x@example.com', isAdmin: false, teacher: null, allowlistRole: null };
const teacher = { id: 't', userId: 'u', schoolEmail: 'ali@school.edu', personalEmail: 'ali@gmail.com', loginEmail: null, linkedAt: null };

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
  it('teacher may sign in with the school email', () => {
    expect(resolveAccess({ ...base, email: 'ali@school.edu', teacher }).roles).toEqual(['teacher']);
  });
  it('teacher may sign in with the linked personal email', () => {
    expect(resolveAccess({ ...base, email: 'ALI@gmail.com', teacher }).roles).toEqual(['teacher']);
  });
  it('a different address does not get the teacher role', () => {
    expect(resolveAccess({ ...base, email: 'other@gmail.com', teacher }).status).toBe('pending');
  });
});

describe('Mock repository', () => {
  it('records which teacher address was used and lets the teacher link a personal email', async () => {
    const repo = createMockAccessRepository();
    await repo.createTeacherAccount('new.teacher@school.edu');
    const facts = await repo.getAccessFacts('user-1', 'new.teacher@school.edu');
    expect(facts.teacher?.loginEmail).toBe('new.teacher@school.edu');
    await repo.linkPersonalEmail('user-1', 'me@gmail.com');
    const again = await repo.getAccessFacts('user-1', 'me@gmail.com');
    expect(again.teacher?.loginEmail).toBe('me@gmail.com');
  });
  it('a teacher only sees their own account', async () => {
    const repo = createMockAccessRepository();
    expect(await repo.getTeacherAccount('someone-else')).toBeNull();
  });
});

import type { AccessRepository, AllowlistEntry, AllowlistRole, PendingUser, TeacherAccount } from './types';
import { normalizeEmail, teacherEmailMatches } from './policy';

/**
 * In-memory repository for development. Seeded with the project's test accounts.
 * State lives per server instance and resets on restart.
 */
const admins = new Set(['admin.bclasses.test@gmail.com']);
const teachers: TeacherAccount[] = [
  { id: 'mock-teacher-1', userId: null, schoolEmail: 'teacher.bclasses.dev@gmail.com', lastSignInEmail: null, createdAt: '2026-01-01T00:00:00Z' },
];
const allowlist: AllowlistEntry[] = [
  { email: 'student.bclasses.test@gmail.com', role: 'student', grade: 5, addedBy: null, createdAt: '2026-01-01T00:00:00Z' },
  { email: 'parent.bclasses.test@gmail.com', role: 'parent', grade: null, addedBy: null, createdAt: '2026-01-01T00:00:00Z' },
];
/** Every account that has signed in, so the admin can see sign-ups waiting for approval. */
const seenUsers = new Map<string, { email: string | null; createdAt: string }>();
const rejected = new Set<string>();

const copy = <T extends object>(x: T): T => ({ ...x });

export function createMockAccessRepository(): AccessRepository {
  return {
    async getAccessFacts(userId, rawEmail) {
      const email = normalizeEmail(rawEmail);
      if (!seenUsers.has(userId)) seenUsers.set(userId, { email, createdAt: new Date().toISOString() });
      const teacher = teachers.find((t) => teacherEmailMatches(t, email)) ?? null;
      if (teacher) {
        teacher.userId = userId;
        teacher.lastSignInEmail = email;
      }
      return {
        email,
        isAdmin: email ? admins.has(email) : false,
        teacher: teacher ? copy(teacher) : null,
        allowlistRole: allowlist.find((a) => a.email === email)?.role ?? null,
      };
    },
    async getTeacherAccount(userId) {
      const t = teachers.find((x) => x.userId === userId);
      return t ? copy(t) : null;
    },

    async listTeacherAccounts() {
      return teachers.map(copy);
    },
    async addTeacherAccount(rawEmail) {
      const email = normalizeEmail(rawEmail)!;
      if (teachers.some((t) => t.schoolEmail === email)) return;
      teachers.push({ id: `mock-teacher-${teachers.length + 1}`, userId: null, schoolEmail: email, lastSignInEmail: null, createdAt: new Date().toISOString() });
    },
    async removeTeacherAccount(rawEmail) {
      const i = teachers.findIndex((t) => t.schoolEmail === normalizeEmail(rawEmail));
      if (i >= 0) teachers.splice(i, 1);
    },

    async listStudentAllowlist() {
      return allowlist.map(copy);
    },
    async addStudentAllowlist(rawEmail, role: AllowlistRole, grade, addedBy) {
      const email = normalizeEmail(rawEmail)!;
      const existing = allowlist.find((a) => a.email === email);
      if (existing) Object.assign(existing, { role, grade: role === 'student' ? grade : null });
      else allowlist.push({ email, role, grade: role === 'student' ? grade : null, addedBy, createdAt: new Date().toISOString() });
    },
    async removeStudentAllowlist(rawEmail) {
      const i = allowlist.findIndex((a) => a.email === normalizeEmail(rawEmail));
      if (i >= 0) allowlist.splice(i, 1);
    },

    async listPendingUsers() {
      const pending: PendingUser[] = [];
      for (const [userId, u] of seenUsers) {
        const isTeacher = teachers.some((t) => teacherEmailMatches(t, u.email));
        const isMember = isTeacher || admins.has(u.email ?? '') || allowlist.some((a) => a.email === u.email);
        if (!isMember && !rejected.has(userId)) pending.push({ userId, email: u.email, createdAt: u.createdAt });
      }
      return pending;
    },
    async approvePendingUser(userId, rawEmail, role, grade, addedBy) {
      const email = normalizeEmail(rawEmail)!;
      rejected.delete(userId);
      const existing = allowlist.find((a) => a.email === email);
      if (existing) Object.assign(existing, { role, grade: role === 'student' ? grade : null });
      else allowlist.push({ email, role, grade: role === 'student' ? grade : null, addedBy, createdAt: new Date().toISOString() });
    },
    async rejectPendingUser(userId) {
      rejected.add(userId);
    },
  };
}

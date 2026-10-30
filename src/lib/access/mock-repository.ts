import type { AccessRepository, AllowlistEntry, AllowlistRole, PendingSignup, TeacherAccount } from './types';
import { normalizeEmail, teacherEmailMatches } from './policy';

/**
 * In-memory repository. Seeded only with the project's existing test accounts.
 * State lives per server instance and resets on restart — for development only.
 */
export function createMockAccessRepository(): AccessRepository {
  const admins = new Set(['admin.bclasses.test@gmail.com']);
  const teachers: TeacherAccount[] = [
    { id: 'mock-teacher-1', userId: null, schoolEmail: 'teacher.bclasses.dev@gmail.com', lastSignInAt: null, createdAt: '2026-01-01T00:00:00Z' },
  ];
  const allowlist: AllowlistEntry[] = [
    { email: 'student.bclasses.test@gmail.com', role: 'student', grade: 5, addedBy: null, createdAt: '2026-01-01T00:00:00Z' },
    { email: 'parent.bclasses.test@gmail.com', role: 'parent', grade: null, addedBy: null, createdAt: '2026-01-01T00:00:00Z' },
  ];
  const signups = new Map<string, PendingSignup>();
  const rejected = new Set<string>();

  const repo: AccessRepository = {
    async getAccessFacts(userId, rawEmail) {
      const email = normalizeEmail(rawEmail);
      const isAdmin = email ? admins.has(email) : false;
      const teacher =
        teachers.find((t) => t.userId === userId && teacherEmailMatches(t, email)) ??
        teachers.find((t) => t.userId === null && teacherEmailMatches(t, email)) ??
        null;
      if (teacher) {
        teacher.userId = userId;
        teacher.lastSignInAt = new Date().toISOString();
      }
      const allowlistRole = allowlist.find((a) => a.email === email)?.role ?? null;
      if (!isAdmin && !teacher && !allowlistRole && email && !rejected.has(userId) && !signups.has(userId)) {
        signups.set(userId, { userId, email, createdAt: new Date().toISOString() });
      }
      return { email, isAdmin, teacher: teacher ? { ...teacher } : null, allowlistRole };
    },

    async listTeachers() {
      return teachers.map((t) => ({ ...t }));
    },
    async addTeacher(schoolEmail) {
      const email = normalizeEmail(schoolEmail)!;
      if (teachers.some((t) => t.schoolEmail === email)) return;
      teachers.push({ id: `mock-teacher-${teachers.length + 1}`, userId: null, schoolEmail: email, lastSignInAt: null, createdAt: new Date().toISOString() });
    },
    async removeTeacher(schoolEmail) {
      const i = teachers.findIndex((t) => t.schoolEmail === normalizeEmail(schoolEmail));
      if (i >= 0) teachers.splice(i, 1);
    },

    async listAllowlist() {
      return allowlist.map((a) => ({ ...a }));
    },
    async addAllowlist({ email: rawEmail, role, grade }, addedBy) {
      const email = normalizeEmail(rawEmail)!;
      const existing = allowlist.find((a) => a.email === email);
      if (existing) Object.assign(existing, { role, grade });
      else allowlist.push({ email, role, grade, addedBy, createdAt: new Date().toISOString() });
    },
    async removeAllowlist(rawEmail) {
      const i = allowlist.findIndex((a) => a.email === normalizeEmail(rawEmail));
      if (i >= 0) allowlist.splice(i, 1);
    },

    async listPendingSignups() {
      return [...signups.values()].map((s) => ({ ...s }));
    },
    async approveSignup(userId, role: AllowlistRole, grade, approvedBy) {
      const signup = signups.get(userId);
      if (!signup) throw new Error('signup-not-found');
      signups.delete(userId);
      await repo.addAllowlist({ email: signup.email, role, grade }, approvedBy);
    },
    async rejectSignup(userId) {
      if (!signups.has(userId)) throw new Error('signup-not-found');
      signups.delete(userId);
      rejected.add(userId);
    },
  };
  return repo;
}

import type { AccessRepository, AllowlistEntry, AllowlistRole, TeacherAccount } from './types';
import { normalizeEmail, teacherEmailMatches } from './policy';

/**
 * In-memory repository. Seeded only with the project's existing test accounts.
 * State lives per server instance and resets on restart — for development only.
 */
const admins = new Set(['admin.bclasses.test@gmail.com']);
const teachers: TeacherAccount[] = [
  { id: 'mock-teacher-1', userId: null, schoolEmail: 'teacher.bclasses.dev@gmail.com', personalEmail: null, loginEmail: null, linkedAt: null },
];
const allowlist: AllowlistEntry[] = [
  { email: 'student.bclasses.test@gmail.com', role: 'student', addedBy: null, createdAt: '2026-01-01T00:00:00Z' },
  { email: 'parent.bclasses.test@gmail.com', role: 'parent', addedBy: null, createdAt: '2026-01-01T00:00:00Z' },
];

export function createMockAccessRepository(): AccessRepository {
  return {
    async getAccessFacts(userId, rawEmail) {
      const email = normalizeEmail(rawEmail);
      const teacher =
        teachers.find((t) => t.userId === userId && teacherEmailMatches(t, email)) ??
        teachers.find((t) => t.userId === null && teacherEmailMatches(t, email)) ??
        null;
      if (teacher) {
        teacher.userId = userId;
        teacher.loginEmail = email;
      }
      return {
        email,
        isAdmin: email ? admins.has(email) : false,
        teacher: teacher ? { ...teacher } : null,
        allowlistRole: allowlist.find((a) => a.email === email)?.role ?? null,
      };
    },
    async getTeacherAccount(userId) {
      const t = teachers.find((x) => x.userId === userId);
      return t ? { ...t } : null;
    },
    async linkPersonalEmail(userId, personalEmail) {
      const t = teachers.find((x) => x.userId === userId);
      if (!t) throw new Error('not-a-teacher');
      const email = normalizeEmail(personalEmail)!;
      if (teachers.some((x) => x !== t && teacherEmailMatches(x, email))) throw new Error('email-taken');
      t.personalEmail = email;
      t.linkedAt = new Date().toISOString();
      return { ...t };
    },
    async createTeacherAccount(schoolEmail) {
      const email = normalizeEmail(schoolEmail)!;
      if (teachers.some((t) => t.schoolEmail === email)) return;
      teachers.push({ id: `mock-teacher-${teachers.length + 1}`, userId: null, schoolEmail: email, personalEmail: null, loginEmail: null, linkedAt: null });
    },
    async listStudentAllowlist() {
      return allowlist.map((a) => ({ ...a }));
    },
    async addStudentAllowlist(rawEmail, role: AllowlistRole, addedBy) {
      const email = normalizeEmail(rawEmail)!;
      const existing = allowlist.find((a) => a.email === email);
      if (existing) existing.role = role;
      else allowlist.push({ email, role, addedBy, createdAt: new Date().toISOString() });
    },
    async removeStudentAllowlist(rawEmail) {
      const i = allowlist.findIndex((a) => a.email === normalizeEmail(rawEmail));
      if (i >= 0) allowlist.splice(i, 1);
    },
  };
}

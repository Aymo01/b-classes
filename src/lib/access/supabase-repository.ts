import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessRepository, AllowlistEntry, AllowlistRole, PendingSignup, TeacherAccount } from './types';
import { normalizeEmail } from './policy';

/**
 * Database repository. Requires db/pending-migrations/0008_approved_members.sql to be
 * applied. Every call goes through a SQL function that checks the caller's role itself,
 * so the signed-in user's client (with RLS) is all it needs.
 */
type Row = Record<string, unknown>;

const toTeacher = (r: Row): TeacherAccount => ({
  id: String(r['id']),
  userId: (r['user_id'] as string | null) ?? null,
  schoolEmail: String(r['school_email']),
  lastSignInAt: (r['last_sign_in_at'] as string | null) ?? null,
  createdAt: String(r['created_at']),
});

export function createSupabaseAccessRepository(client: SupabaseClient): AccessRepository {
  // The new functions are not in the generated types until the migration is applied.
  const db = client as unknown as SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  async function call(name: string, args?: Record<string, unknown>) {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error(`${name}-failed`);
    return data as unknown;
  }
  const rows = (data: unknown) => (Array.isArray(data) ? (data as Row[]) : []);

  return {
    async getAccessFacts(_userId, email) {
      let d: Row;
      try {
        d = ((await call('get_my_access_facts')) ?? {}) as Row;
      } catch {
        throw new Error('access-check-failed');
      }
      return {
        email: normalizeEmail(email),
        isAdmin: Boolean(d['is_admin']),
        teacher: d['teacher'] ? toTeacher(d['teacher'] as Row) : null,
        allowlistRole: (d['allowlist_role'] as AllowlistRole | null) ?? null,
      };
    },

    async listTeachers() {
      return rows(await call('admin_list_teachers')).map(toTeacher);
    },
    async addTeacher(schoolEmail) {
      await call('admin_add_teacher', { _email: normalizeEmail(schoolEmail) });
    },
    async removeTeacher(schoolEmail) {
      await call('admin_remove_teacher', { _email: normalizeEmail(schoolEmail) });
    },

    async listAllowlist() {
      return rows(await call('admin_list_allowlist')).map(
        (r): AllowlistEntry => ({
          email: String(r['email']),
          role: r['role'] as AllowlistRole,
          grade: (r['grade'] as number | null) ?? null,
          addedBy: (r['added_by'] as string | null) ?? null,
          createdAt: String(r['created_at']),
        }),
      );
    },
    async addAllowlist({ email, role, grade }) {
      await call('admin_set_allowlist', { _email: normalizeEmail(email), _role: role, _grade: grade });
    },
    async removeAllowlist(email) {
      await call('admin_remove_allowlist', { _email: normalizeEmail(email) });
    },

    async listPendingSignups() {
      return rows(await call('admin_list_pending_signups')).map(
        (r): PendingSignup => ({ userId: String(r['user_id']), email: String(r['email']), createdAt: String(r['created_at']) }),
      );
    },
    async approveSignup(userId, role, grade) {
      await call('admin_approve_signup', { _user_id: userId, _role: role, _grade: grade });
    },
    async rejectSignup(userId) {
      await call('admin_reject_signup', { _user_id: userId });
    },
  };
}

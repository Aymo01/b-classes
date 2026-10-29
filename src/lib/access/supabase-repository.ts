import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessRepository, AllowlistRole, PendingUser, TeacherAccount, AllowlistEntry, AccessFacts } from './types';
import { normalizeEmail } from './policy';

/**
 * Database repository. Requires db/pending-migrations/0008_approved_members.sql.
 * Reads go through RLS as the signed-in user; admin writes go through SECURITY DEFINER
 * functions that check has_role(auth.uid(), 'admin') themselves.
 */
type Row = Record<string, unknown>;

const toTeacher = (r: Row): TeacherAccount => ({
  id: String(r['id']),
  userId: (r['user_id'] as string | null) ?? null,
  schoolEmail: String(r['school_email']),
  lastSignInEmail: (r['last_sign_in_email'] as string | null) ?? null,
  createdAt: String(r['created_at']),
});

const toAllowlist = (r: Row): AllowlistEntry => ({
  email: String(r['email']),
  role: r['role'] as AllowlistRole,
  grade: (r['grade'] as number | null) ?? null,
  addedBy: (r['added_by'] as string | null) ?? null,
  createdAt: String(r['created_at']),
});

const fail = (code: string) => (e: { message?: string } | null) => {
  if (e) throw new Error(code);
};

export function createSupabaseAccessRepository(client: SupabaseClient): AccessRepository {
  // The new tables and functions are not in the generated types until migration 0008 is applied.
  const db = client as unknown as SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  return {
    async getAccessFacts(_userId, email) {
      const { data, error } = await db.rpc('get_my_access_facts');
      if (error) throw new Error('access-check-failed');
      const d = (data ?? {}) as Row;
      const facts: AccessFacts = {
        email: normalizeEmail(email),
        isAdmin: Boolean(d['is_admin']),
        teacher: d['teacher'] ? toTeacher(d['teacher'] as Row) : null,
        allowlistRole: (d['allowlist_role'] as AllowlistRole | null) ?? null,
      };
      return facts;
    },
    async getTeacherAccount(userId) {
      const { data } = await db.from('teacher_accounts').select('*').eq('user_id', userId).maybeSingle();
      return data ? toTeacher(data) : null;
    },

    async listTeacherAccounts() {
      const { data, error } = await db.from('teacher_accounts').select('*').order('created_at', { ascending: false });
      if (error) throw new Error('list-failed');
      return (data ?? []).map(toTeacher);
    },
    async addTeacherAccount(email) {
      const { error } = await db.rpc('admin_add_teacher_account', { _school_email: normalizeEmail(email) });
      fail('add-failed')(error);
    },
    async removeTeacherAccount(email) {
      const { error } = await db.rpc('admin_remove_teacher_account', { _school_email: normalizeEmail(email) });
      fail('remove-failed')(error);
    },

    async listStudentAllowlist() {
      const { data, error } = await db.from('student_allowlist').select('*').order('created_at', { ascending: false });
      if (error) throw new Error('list-failed');
      return (data ?? []).map(toAllowlist);
    },
    async addStudentAllowlist(email, role, grade) {
      const { error } = await db.rpc('admin_add_allowlist', { _email: normalizeEmail(email), _role: role, _grade: role === 'student' ? grade : null });
      fail('add-failed')(error);
    },
    async removeStudentAllowlist(email) {
      const { error } = await db.rpc('admin_remove_allowlist', { _email: normalizeEmail(email) });
      fail('remove-failed')(error);
    },

    async listPendingUsers() {
      const { data, error } = await db.rpc('admin_list_pending_users');
      if (error) throw new Error('list-failed');
      return ((data ?? []) as Row[]).map((r): PendingUser => ({
        userId: String(r['user_id']),
        email: (r['email'] as string | null) ?? null,
        createdAt: String(r['created_at']),
      }));
    },
    async approvePendingUser(userId, email, role, grade) {
      const { error } = await db.rpc('admin_approve_pending_user', {
        _user_id: userId,
        _email: normalizeEmail(email),
        _role: role,
        _grade: role === 'student' ? grade : null,
      });
      fail('approve-failed')(error);
    },
    async rejectPendingUser(userId) {
      const { error } = await db.rpc('admin_reject_pending_user', { _user_id: userId });
      fail('reject-failed')(error);
    },
  };
}

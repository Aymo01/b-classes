import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessRepository, AllowlistRole, TeacherAccount } from './types';
import { normalizeEmail } from './policy';

/**
 * Database repository. Requires db/pending-migrations/0008_approved_members.sql
 * to be applied. The client is the signed-in user's client, so RLS applies.
 */
type Row = Record<string, unknown>;
const toTeacher = (r: Row): TeacherAccount => ({
  id: String(r['id']),
  userId: (r['user_id'] as string | null) ?? null,
  schoolEmail: String(r['school_email']),
  personalEmail: (r['personal_email'] as string | null) ?? null,
  loginEmail: (r['login_email'] as string | null) ?? null,
  linkedAt: (r['linked_at'] as string | null) ?? null,
});

export function createSupabaseAccessRepository(client: SupabaseClient): AccessRepository {
  // The new tables are not in the generated types until the migration is applied.
  const db = client as unknown as SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    async getAccessFacts(_userId, email) {
      const { data, error } = await db.rpc('get_my_access_facts');
      if (error) throw new Error('access-check-failed');
      const d = (data ?? {}) as Row;
      return {
        email: normalizeEmail(email),
        isAdmin: Boolean(d['is_admin']),
        teacher: d['teacher'] ? toTeacher(d['teacher'] as Row) : null,
        allowlistRole: (d['allowlist_role'] as AllowlistRole | null) ?? null,
      };
    },
    async getTeacherAccount(userId) {
      const { data } = await db.from('teacher_accounts').select('*').eq('user_id', userId).maybeSingle();
      return data ? toTeacher(data) : null;
    },
    async linkPersonalEmail(userId, personalEmail) {
      const { data, error } = await db
        .from('teacher_accounts')
        .update({ personal_email: normalizeEmail(personalEmail), linked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error || !data) throw new Error('link-failed');
      return toTeacher(data);
    },
    async createTeacherAccount(schoolEmail) {
      await db.from('teacher_accounts').upsert({ school_email: normalizeEmail(schoolEmail) }, { onConflict: 'school_email', ignoreDuplicates: true });
    },
    async listStudentAllowlist() {
      const { data } = await db.from('student_allowlist').select('*').order('created_at', { ascending: false });
      return (data ?? []).map((r: Row) => ({
        email: String(r['email']),
        role: r['role'] as AllowlistRole,
        addedBy: (r['added_by'] as string | null) ?? null,
        createdAt: String(r['created_at']),
      }));
    },
    async addStudentAllowlist(email, role, addedBy) {
      const { error } = await db.from('student_allowlist').upsert({ email: normalizeEmail(email), role, added_by: addedBy });
      if (error) throw new Error('allowlist-failed');
    },
    async removeStudentAllowlist(email) {
      await db.from('student_allowlist').delete().eq('email', normalizeEmail(email));
    },
  };
}

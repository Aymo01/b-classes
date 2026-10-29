export type AppRole = 'student' | 'parent' | 'teacher' | 'admin';
export type AllowlistRole = 'student' | 'parent';

export type TeacherAccount = {
  id: string;
  userId: string | null;
  schoolEmail: string;
  personalEmail: string | null;
  loginEmail: string | null;
  linkedAt: string | null;
};

export type AllowlistEntry = {
  email: string;
  role: AllowlistRole;
  addedBy: string | null;
  createdAt: string;
};

/** Raw facts about a signed-in user, gathered by a repository. */
export type AccessFacts = {
  email: string | null;
  isAdmin: boolean;
  teacher: TeacherAccount | null;
  allowlistRole: AllowlistRole | null;
};

export type AccessResult = {
  status: 'approved' | 'pending';
  roles: AppRole[];
  email: string | null;
};

/**
 * Data access for membership. Implemented by an in-memory mock today and by
 * the database later (see supabase-repository.ts). Callers never touch tables.
 */
export interface AccessRepository {
  /** Gathers facts and records which teacher address was used to sign in. */
  getAccessFacts(userId: string, email: string | null): Promise<AccessFacts>;
  getTeacherAccount(userId: string): Promise<TeacherAccount | null>;
  linkPersonalEmail(userId: string, personalEmail: string): Promise<TeacherAccount>;
  createTeacherAccount(schoolEmail: string): Promise<void>;
  listStudentAllowlist(): Promise<AllowlistEntry[]>;
  addStudentAllowlist(email: string, role: AllowlistRole, addedBy: string): Promise<void>;
  removeStudentAllowlist(email: string): Promise<void>;
}

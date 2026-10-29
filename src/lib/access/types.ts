export type AppRole = 'student' | 'parent' | 'teacher' | 'admin';
export type AllowlistRole = 'student' | 'parent';

/** A teacher account issued by the school. Teachers sign in only with schoolEmail. */
export type TeacherAccount = {
  id: string;
  userId: string | null;
  schoolEmail: string;
  lastSignInEmail: string | null;
  createdAt: string;
};

export type AllowlistEntry = {
  email: string;
  role: AllowlistRole;
  grade: number | null;
  addedBy: string | null;
  createdAt: string;
};

/** A signed-in account that holds no role yet. */
export type PendingUser = {
  userId: string;
  email: string | null;
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
  /** Gathers facts for the signed-in user and records the address used to sign in. */
  getAccessFacts(userId: string, email: string | null): Promise<AccessFacts>;
  getTeacherAccount(userId: string): Promise<TeacherAccount | null>;

  listTeacherAccounts(): Promise<TeacherAccount[]>;
  addTeacherAccount(schoolEmail: string): Promise<void>;
  removeTeacherAccount(schoolEmail: string): Promise<void>;

  listStudentAllowlist(): Promise<AllowlistEntry[]>;
  addStudentAllowlist(email: string, role: AllowlistRole, grade: number | null, addedBy: string): Promise<void>;
  removeStudentAllowlist(email: string): Promise<void>;

  listPendingUsers(): Promise<PendingUser[]>;
  approvePendingUser(userId: string, email: string, role: AllowlistRole, grade: number | null, addedBy: string): Promise<void>;
  rejectPendingUser(userId: string): Promise<void>;
}

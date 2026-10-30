export type AppRole = 'student' | 'parent' | 'teacher' | 'admin';
export type AllowlistRole = 'student' | 'parent';

/** A teacher issued by an admin. Teachers sign in only with this school email. */
export type TeacherAccount = {
  id: string;
  userId: string | null;
  schoolEmail: string;
  lastSignInAt: string | null;
  createdAt: string;
};

export type AllowlistEntry = {
  email: string;
  role: AllowlistRole;
  /** 1–12 for students, null for parents. */
  grade: number | null;
  addedBy: string | null;
  createdAt: string;
};

/** Someone who signed up but holds no role yet. */
export type PendingSignup = {
  userId: string;
  email: string;
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

export type AllowlistInput = { email: string; role: AllowlistRole; grade: number | null };

/**
 * Data access for membership. Implemented by an in-memory mock for development and by
 * the database (see supabase-repository.ts). Callers never touch tables.
 */
export interface AccessRepository {
  /** Gathers facts and records the sign-in of a teacher or of a user who holds no role yet. */
  getAccessFacts(userId: string, email: string | null): Promise<AccessFacts>;

  listTeachers(): Promise<TeacherAccount[]>;
  addTeacher(schoolEmail: string, addedBy: string): Promise<void>;
  removeTeacher(schoolEmail: string): Promise<void>;

  listAllowlist(): Promise<AllowlistEntry[]>;
  addAllowlist(input: AllowlistInput, addedBy: string): Promise<void>;
  removeAllowlist(email: string): Promise<void>;

  listPendingSignups(): Promise<PendingSignup[]>;
  approveSignup(userId: string, role: AllowlistRole, grade: number | null, approvedBy: string): Promise<void>;
  rejectSignup(userId: string, rejectedBy: string): Promise<void>;
}

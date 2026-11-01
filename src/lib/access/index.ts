import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessRepository, AccessResult } from './types';
import { createMockAccessRepository } from './mock-repository';
import { createSupabaseAccessRepository } from './supabase-repository';
import { resolveAccess } from './policy';

let mock: AccessRepository | null = null;

/**
 * The database is the default: all reads and writes go through it. The in-memory mock is used only
 * when ACCESS_DATA_SOURCE=mock is set explicitly (tests and offline UI work).
 */
export function getAccessRepository(client: SupabaseClient): AccessRepository {
  if (process.env['ACCESS_DATA_SOURCE'] === 'mock') return (mock ??= createMockAccessRepository());
  return createSupabaseAccessRepository(client);
}

export async function loadAccess(repo: AccessRepository, userId: string, email: string | null): Promise<AccessResult> {
  return resolveAccess(await repo.getAccessFacts(userId, email));
}

export const emailFromClaims = (claims: unknown) =>
  typeof (claims as { email?: unknown })?.email === 'string' ? ((claims as { email: string }).email) : null;

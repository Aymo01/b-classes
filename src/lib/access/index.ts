import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessRepository, AccessResult } from './types';
import { createMockAccessRepository } from './mock-repository';
import { createSupabaseAccessRepository } from './supabase-repository';
import { resolveAccess } from './policy';

let mock: AccessRepository | null = null;

/** ACCESS_DATA_SOURCE=database switches to the real tables; anything else uses mock data. */
export function getAccessRepository(client: SupabaseClient): AccessRepository {
  if (process.env['ACCESS_DATA_SOURCE'] === 'database') return createSupabaseAccessRepository(client);
  return (mock ??= createMockAccessRepository());
}

export async function loadAccess(repo: AccessRepository, userId: string, email: string | null): Promise<AccessResult> {
  return resolveAccess(await repo.getAccessFacts(userId, email));
}

export const emailFromClaims = (claims: unknown) =>
  typeof (claims as { email?: unknown })?.email === 'string' ? ((claims as { email: string }).email) : null;

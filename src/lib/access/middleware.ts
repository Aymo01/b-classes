import { createMiddleware } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { emailFromClaims, getAccessRepository, loadAccess } from './index';

/** Signed in AND holding a role. Every school-data server function uses this. */
export const requireApprovedMember = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const repo = getAccessRepository(context.supabase);
    const access = await loadAccess(repo, context.userId, emailFromClaims(context.claims));
    if (access.status !== 'approved') throw new Error('Forbidden: account pending approval');
    return next({ context: { access, accessRepo: repo } });
  });

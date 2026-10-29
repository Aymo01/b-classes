import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { getMyAccess } from '@/lib/access.functions';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: '/auth', search: { redirect: location.href } });
    }
    // Signed in but no role (not allowlisted / not an issued teacher) → pending page.
    const access = await getMyAccess();
    if (access.status !== 'approved') throw redirect({ to: '/pending', replace: true });
    return { access };
  },
  component: () => <Outlet />,
});

import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Hourglass, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getMyAccess } from '@/lib/access.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/pending')({
  ssr: false,
  head: () => {
    const m = pageMeta('حسابك بانتظار الموافقة', 'حسابك في B classes بانتظار موافقة إدارة المدرسة.');
    return { ...m, meta: [...m.meta, { name: 'robots', content: 'noindex' }] };
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: '/auth' });
    const access = await getMyAccess();
    if (access.status === 'approved') throw redirect({ to: '/dashboard', replace: true });
  },
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: '/auth', replace: true });
  }
  return (
    <div className="auth-page page-width">
      <div className="auth-card">
        <div className="auth-heading">
          <span className="auth-icon"><Hourglass /></span>
          <h1>حسابك بانتظار الموافقة</h1>
        </div>
        <Button size="lg" variant="outline" onClick={() => void signOut()}><LogOut />تسجيل الخروج</Button>
      </div>
    </div>
  );
}

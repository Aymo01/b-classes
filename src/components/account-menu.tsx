import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, GraduationCap, LogOut, UserRound, Users, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { getMyProfile } from '@/lib/profile.functions';
import { listNotifications } from '@/lib/content.functions';
import { gradeLabel, type Grade } from '@/lib/grades';

export function AccountMenu({ email }: { email: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['my-profile'], queryFn: () => getMyProfile() });
  const { data: notifications } = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications() });
  const unread = (notifications ?? []).filter((n) => !n.readAt).length;
  const roles = data?.roles ?? [];
  const isEditor = roles.includes('teacher') || roles.includes('admin');
  const isParent = roles.includes('parent');

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: '/auth', replace: true });
  }

  return (
    <div className="account-actions">
      <Button variant="ghost" size="icon" asChild className="account-bell" aria-label={`الإشعارات${unread ? `، ${unread} غير مقروءة` : ''}`}>
        <Link to="/notifications">
          <Bell />
          {unread > 0 && <span className="bell-badge" aria-hidden="true">{unread}</span>}
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="account-trigger">
            <UserRound />
            <span className="account-name">{data?.profile?.displayName || email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="account-menu">
          <DropdownMenuLabel className="account-menu-label">
            <strong>{data?.profile?.displayName || 'حسابي'}</strong>
            <span dir="ltr">{email}</span>
            {data?.profile?.grade && (
              <span className="account-grade"><GraduationCap size={13} />{gradeLabel(data.profile.grade as Grade)}</span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link to="/profile"><UserRound />ملفي الشخصي</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/notifications"><Bell />الإشعارات{unread > 0 && <span className="menu-badge">{unread}</span>}</Link></DropdownMenuItem>
          {isEditor && <DropdownMenuItem asChild><Link to="/teacher"><Wrench />منطقة المعلم</Link></DropdownMenuItem>}
          <DropdownMenuItem asChild><Link to="/parent"><Users />{isParent ? 'منطقة ولي الأمر' : 'أنا ولي أمر'}</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleSignOut()} className="account-signout"><LogOut />تسجيل الخروج</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

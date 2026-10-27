import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Bell, BellRing, ClipboardList, FileQuestion, Loader2, Play, Video } from 'lucide-react';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { listNotifications, markNotificationsRead } from '@/lib/content.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/notifications')({
  head: () => pageMeta('الإشعارات', 'إشعاراتك عن الدروس والواجبات والنتائج في B classes.'),
  component: NotificationsPage,
});

const kindIcons: Record<string, typeof Bell> = {
  lesson: Play,
  assignment: ClipboardList,
  quiz: FileQuestion,
  class: Video,
};

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications() });

  // Mark everything as read once the list is visible.
  useEffect(() => {
    if (notifications && notifications.some((n) => !n.readAt)) {
      markNotificationsRead().then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {});
    }
  }, [notifications, queryClient]);

  return (
    <StudentWorkspace title="إشعاراتي" subtitle="كل جديد عن دروسك وواجباتك ونتائجك، في مكان واحد.">
      {isLoading ? (
        <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل الإشعارات...</p></div>
      ) : !notifications || notifications.length === 0 ? (
        <EmptyState icon={Bell} title="لا توجد إشعارات بعد" text="عندما يضيف المعلم درسًا أو واجبًا أو اختبارًا، ستصلك إشعارات هنا." />
      ) : (
        <ul className="notifications-list">
          {notifications.map((n) => {
            const Icon = kindIcons[n.kind] ?? BellRing;
            return (
              <li key={n.id} className={n.readAt ? 'notification-item' : 'notification-item notification-unread'}>
                <span className="notification-icon"><Icon size={18} /></span>
                <div>
                  <h3>{n.title}</h3>
                  {n.body && <p>{n.body}</p>}
                  <small>{new Date(n.createdAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                </div>
                {!n.readAt && <span className="notification-dot" aria-label="غير مقروء" />}
              </li>
            );
          })}
        </ul>
      )}
    </StudentWorkspace>
  );
}

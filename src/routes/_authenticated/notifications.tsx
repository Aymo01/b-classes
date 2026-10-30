import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Bell, BellRing, ClipboardList, FileQuestion, Loader2, MessageSquare, Play, Video } from 'lucide-react';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { useMessageNotifications, useMessagingViewer } from '@/lib/messaging/hooks';
import type { MessagingRole } from '@/lib/messaging/logic';
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
  message: MessageSquare,
};

/** Opens the conversation in the area the viewer replies from. */
function MessageNotificationLink({ role, conversationId, children }: { role: MessagingRole; conversationId: string; children: ReactNode }) {
  const className = 'notification-link';
  if (role === 'teacher') return <Link className={className} to="/teacher" search={{ tab: 'messages', c: conversationId }}>{children}</Link>;
  if (role === 'parent') return <Link className={className} to="/parent" search={{ c: conversationId }}>{children}</Link>;
  return <Link className={className} to="/messages" search={{ c: conversationId }}>{children}</Link>;
}

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications() });

  // Mark everything as read once the list is visible.
  useEffect(() => {
    if (notifications && notifications.some((n) => !n.readAt)) {
      markNotificationsRead().then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {});
    }
  }, [notifications, queryClient]);

  const viewer = useMessagingViewer();
  const { data: messageNotifications } = useMessageNotifications();
  const items = [
    ...(notifications ?? []).map((n) => ({ ...n, conversationId: null })),
    ...(messageNotifications ?? []),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <StudentWorkspace title="إشعاراتي" subtitle="كل جديد عن دروسك وواجباتك ونتائجك، في مكان واحد.">
      {isLoading ? (
        <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل الإشعارات...</p></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="لا توجد إشعارات بعد" text="عندما يضيف المعلم درسًا أو واجبًا أو اختبارًا، ستصلك إشعارات هنا." />
      ) : (
        <ul className="notifications-list">
          {items.map((n) => {
            const Icon = kindIcons[n.kind] ?? BellRing;
            if (n.conversationId && viewer) {
              return (
                <li key={n.id} className={n.readAt ? 'notification-item' : 'notification-item notification-unread'}>
                  <MessageNotificationLink role={viewer.role} conversationId={n.conversationId}>
                    <span className="notification-icon"><Icon size={18} /></span>
                    <div>
                      <h3>{n.title}</h3>
                      <p>{n.body}</p>
                      <small>{new Date(n.createdAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                    </div>
                    {!n.readAt && <span className="notification-dot" aria-label="غير مقروء" />}
                  </MessageNotificationLink>
                </li>
              );
            }
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProfile } from '@/lib/profile.functions';
import { mockMessaging, mockUsers } from './mock-store';
import type { MessagingRole } from './logic';

/** Which mock identity the signed-in account is shown as, from its real roles. */
export function useMessagingViewer() {
  const { data } = useQuery({ queryKey: ['my-profile'], queryFn: () => getMyProfile() });
  if (!data) return null;
  const roles = data.roles ?? [];
  const role: MessagingRole = roles.includes('teacher') || roles.includes('admin') ? 'teacher' : roles.includes('parent') ? 'parent' : 'student';
  return { role, id: mockUsers[role].id };
}

export function useUnreadMessages() {
  const viewer = useMessagingViewer();
  const { data } = useQuery({
    queryKey: ['messages', 'unread', viewer?.id],
    queryFn: () => mockMessaging.unreadCount(viewer!.id),
    enabled: !!viewer,
  });
  return data ?? 0;
}

export function useConversations() {
  const viewer = useMessagingViewer();
  return useQuery({ queryKey: ['messages', 'conversations', viewer?.id], queryFn: () => mockMessaging.listConversations(viewer!.id), enabled: !!viewer });
}

export function useThread(conversationId: string | undefined) {
  const viewer = useMessagingViewer();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['messages', 'thread', viewer?.id, conversationId],
    queryFn: async () => {
      const thread = await mockMessaging.listThread(viewer!.id, conversationId!);
      await mockMessaging.markRead(viewer!.id, conversationId!);
      void queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] });
      void queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['messages', 'notifications'] });
      return thread;
    },
    enabled: !!viewer && !!conversationId,
    retry: false,
  });
}

export function useMessageNotifications() {
  const viewer = useMessagingViewer();
  return useQuery({ queryKey: ['messages', 'notifications', viewer?.id], queryFn: () => mockMessaging.listNotifications(viewer!.id), enabled: !!viewer });
}

function useInvalidateMessages() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['messages'] });
}

export function useSendMessage(conversationId: string) {
  const viewer = useMessagingViewer();
  const invalidate = useInvalidateMessages();
  return useMutation({ mutationFn: (body: string) => mockMessaging.send(viewer!.id, conversationId, body), onSuccess: invalidate });
}

export function useStartConversation() {
  const viewer = useMessagingViewer();
  const invalidate = useInvalidateMessages();
  return useMutation({
    mutationFn: (input: { teacherId: string; studentId: string; body: string }) => mockMessaging.start(viewer!.id, input),
    onSuccess: invalidate,
  });
}

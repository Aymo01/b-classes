import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyProfile } from '@/lib/profile.functions';
import { getMessagingTargets, getUnreadMessageCount, listConversations, listMessageNotifications, listThread, markConversationRead, sendMessage, startConversation } from '@/lib/messaging.functions';
import { unreadForStudent, type MessagingRole } from './logic';

/** The signed-in account and the messaging role its real roles give it. */
export function useMessagingViewer() {
  const { data } = useQuery({ queryKey: ['my-profile'], queryFn: () => getMyProfile() });
  if (!data?.profile) return null;
  const roles = data.roles ?? [];
  const role: MessagingRole = roles.includes('teacher') || roles.includes('admin') ? 'teacher' : roles.includes('parent') ? 'parent' : 'student';
  return { role, id: data.profile.id };
}

/** Unread count for the whole account, or, with `studentId`, only for that child (as the parent inbox lists it). */
export function useUnreadMessages(studentId?: string) {
  const viewer = useMessagingViewer();
  const { data } = useQuery({
    queryKey: ['messages', 'unread', viewer?.id],
    queryFn: () => getUnreadMessageCount(),
    enabled: !!viewer && !studentId,
  });
  const { data: conversations } = useConversations(!!studentId);
  const { data: targets } = useMessagingTargets(!!studentId);
  if (studentId) return conversations && targets ? unreadForStudent(conversations, targets.teachers, studentId) : 0;
  return data ?? 0;
}

export function useConversations(enabled = true) {
  const viewer = useMessagingViewer();
  return useQuery({ queryKey: ['messages', 'conversations', viewer?.id], queryFn: () => listConversations(), enabled: !!viewer && enabled });
}

export function useThread(conversationId: string | undefined) {
  const viewer = useMessagingViewer();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['messages', 'thread', viewer?.id, conversationId],
    queryFn: async () => {
      const thread = await listThread({ data: { conversationId: conversationId! } });
      await markConversationRead({ data: { conversationId: conversationId! } });
      void queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] });
      void queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['messages', 'notifications'] });
      return thread;
    },
    enabled: !!viewer && !!conversationId,
    retry: false,
  });
}

/** Teachers (and, for a parent, children) a new conversation can be started with. */
export function useMessagingTargets(enabled = true) {
  const viewer = useMessagingViewer();
  return useQuery({ queryKey: ['messages', 'targets', viewer?.id], queryFn: () => getMessagingTargets(), enabled: !!viewer && enabled });
}

export function useMessageNotifications() {
  const viewer = useMessagingViewer();
  return useQuery({ queryKey: ['messages', 'notifications', viewer?.id], queryFn: () => listMessageNotifications(), enabled: !!viewer });
}

function useInvalidateMessages() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['messages'] });
}

export function useSendMessage(conversationId: string) {
  const invalidate = useInvalidateMessages();
  return useMutation({ mutationFn: (body: string) => sendMessage({ data: { conversationId, body } }), onSuccess: invalidate });
}

export function useStartConversation() {
  const invalidate = useInvalidateMessages();
  return useMutation({
    mutationFn: (input: { teacherId: string; studentId: string; body: string }) => startConversation({ data: input }),
    onSuccess: invalidate,
  });
}

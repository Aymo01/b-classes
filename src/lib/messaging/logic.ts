export type MessagingRole = 'teacher' | 'parent' | 'student';

export type ConversationRecord = {
  id: string;
  teacherId: string;
  participantId: string;
  studentId: string;
  createdAt: string;
};

export const MAX_MESSAGE_LENGTH = 2000;

/** Only the two participants can read or write a conversation. */
export function isParticipant(conversation: Pick<ConversationRecord, 'teacherId' | 'participantId'>, userId: string) {
  return userId === conversation.teacherId || userId === conversation.participantId;
}

/** The sender's role in a conversation, or null when they are not a participant. */
export function senderRole(conversation: ConversationRecord, userId: string): MessagingRole | null {
  if (userId === conversation.teacherId) return 'teacher';
  if (userId !== conversation.participantId) return null;
  return userId === conversation.studentId ? 'student' : 'parent';
}

/** Arabic title of the notification sent to the recipient of a new message. */
export function messageNotificationTitle(role: MessagingRole, names: { student: string; teacher: string }) {
  if (role === 'student') return `${names.student} أرسل لك رسالة`;
  if (role === 'parent') return `ولي أمر ${names.student} أرسل لك رسالة`;
  return `المعلم ${names.teacher} أرسل لك رسالة`;
}

/** Trimmed body, or null when it is empty or too long. */
export function cleanMessageBody(body: string) {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH ? trimmed : null;
}

/** Value of the `tab` search param that opens the Messages tab in the teacher and parent areas. */
export const MESSAGES_TAB = 'inbox';

/** Teachers reply inside the teacher area; parents stay in the parent area. */
export function conversationLink(role: MessagingRole, conversationId: string) {
  if (role === 'teacher') return { to: '/teacher', search: { tab: MESSAGES_TAB, c: conversationId } } as const;
  if (role === 'parent') return { to: '/parent', search: { tab: MESSAGES_TAB, c: conversationId } } as const;
  return { to: '/messages', search: { c: conversationId } } as const;
}

export type ConversationSummary = {
  id: string;
  otherName: string;
  studentName: string;
  /** What the other participant is to the student, e.g. «ولي الأمر». */
  otherRole: MessagingRole;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

export type MessageItem = { id: string; body: string; mine: boolean; readAt: string | null; createdAt: string };

export type MessageNotification = { id: string; kind: 'message'; title: string; body: string; conversationId: string; readAt: string | null; createdAt: string };

export type MessageRow = { id: string; conversationId: string; senderId: string; body: string; readAt: string | null; createdAt: string };

/** Inbox rows for one viewer: only their own conversations, newest activity first. */
export function buildConversationSummaries(
  viewerId: string,
  conversations: ConversationRecord[],
  messages: MessageRow[],
  names: Record<string, string | null | undefined>,
): ConversationSummary[] {
  return conversations
    .filter((c) => isParticipant(c, viewerId))
    .map((c) => {
      const thread = messages.filter((m) => m.conversationId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = thread.at(-1);
      const otherId = viewerId === c.teacherId ? c.participantId : c.teacherId;
      return {
        id: c.id,
        otherName: names[otherId] || 'مستخدم',
        studentName: names[c.studentId] || 'طالب',
        otherRole: senderRole(c, otherId)!,
        lastMessage: last?.body ?? '',
        lastAt: last?.createdAt ?? c.createdAt,
        unread: thread.filter((m) => m.senderId !== viewerId && !m.readAt).length,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function toMessageItems(viewerId: string, messages: MessageRow[]): MessageItem[] {
  return [...messages]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({ id: m.id, body: m.body, mine: m.senderId === viewerId, readAt: m.readAt, createdAt: m.createdAt }));
}

export type MessagingPerson = { id: string; name: string };

/** Who the viewer can write to (teachers) and about (students; empty for a student, who writes about themself). */
export type MessagingTargets = { teachers: MessagingPerson[]; students: MessagingPerson[] };

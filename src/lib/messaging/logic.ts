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
  teacherId: string;
  studentId: string;
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
        teacherId: c.teacherId,
        studentId: c.studentId,
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

/** A teacher a conversation can be started with, and which of the viewer's students are enrolled with them. */
export type MessagingTeacher = MessagingPerson & { studentIds: string[] };

/** Keep only what concerns one child: that child, and the teachers the child is enrolled with. */
export function limitToStudent<T extends { teachers: MessagingTeacher[]; students: MessagingPerson[] }>(targets: T, studentId: string): T {
  return { ...targets, teachers: targets.teachers.filter((t) => t.studentIds.includes(studentId)), students: targets.students.filter((s) => s.id === studentId) };
}

/** Conversations about one child with a teacher the child is currently enrolled with. */
export function conversationsForStudent<T extends { teacherId: string; studentId: string }>(conversations: T[], teachers: MessagingTeacher[], studentId: string): T[] {
  const allowed = new Set(teachers.filter((t) => t.studentIds.includes(studentId)).map((t) => t.id));
  return conversations.filter((c) => c.studentId === studentId && allowed.has(c.teacherId));
}

/** Who the viewer can write to (teachers) and about (students; empty for a student, who writes about themself). */
export type MessagingTargets = { teachers: MessagingTeacher[]; students: MessagingPerson[] };

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

/** Teachers reply inside the teacher area; parents stay in the parent area. */
export function conversationLink(role: MessagingRole, conversationId: string) {
  if (role === 'teacher') return { to: '/teacher', search: { tab: 'messages', c: conversationId } } as const;
  if (role === 'parent') return { to: '/parent', search: { c: conversationId } } as const;
  return { to: '/messages', search: { c: conversationId } } as const;
}

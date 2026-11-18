import { cleanMessageBody, isParticipant, messageNotificationTitle, senderRole, type ConversationRecord, type MessagingRole } from './logic';

/**
 * In-memory stand-in for the conversations/messages tables (drizzle/migrations/0008_messaging.sql).
 * State lives in the browser tab and resets on reload — for UI development only.
 */

export type MockUser = { id: string; name: string };

export const mockUsers: Record<MessagingRole, MockUser> = {
  teacher: { id: 'mock-teacher-1', name: 'سارة' },
  parent: { id: 'mock-parent-1', name: 'والد ليو' },
  student: { id: 'mock-student-1', name: 'ليو' },
};

const people: Record<string, MockUser> = {
  ...Object.fromEntries(Object.values(mockUsers).map((u) => [u.id, u])),
  'mock-teacher-2': { id: 'mock-teacher-2', name: 'خالد' },
  'mock-parent-2': { id: 'mock-parent-2', name: 'والدة نور' },
  'mock-student-2': { id: 'mock-student-2', name: 'نور' },
};

type StoredMessage = { id: string; conversationId: string; senderId: string; body: string; readAt: string | null; createdAt: string };
type StoredNotification = { id: string; userId: string; kind: 'message'; title: string; body: string; conversationId: string; readAt: string | null; createdAt: string };

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const conversations: ConversationRecord[] = [
  { id: 'conv-leo', teacherId: 'mock-teacher-1', participantId: 'mock-student-1', studentId: 'mock-student-1', createdAt: minutesAgo(300) },
  { id: 'conv-leo-parent', teacherId: 'mock-teacher-1', participantId: 'mock-parent-1', studentId: 'mock-student-1', createdAt: minutesAgo(200) },
  // Belongs to other people: must never be visible to the mock teacher, parent or student above.
  { id: 'conv-noor-other-teacher', teacherId: 'mock-teacher-2', participantId: 'mock-parent-2', studentId: 'mock-student-2', createdAt: minutesAgo(100) },
];

const messages: StoredMessage[] = [
  { id: 'm1', conversationId: 'conv-leo', senderId: 'mock-student-1', body: 'السلام عليكم أستاذة، لم أفهم السؤال الثالث في واجب الكسور.', readAt: minutesAgo(250), createdAt: minutesAgo(260) },
  { id: 'm2', conversationId: 'conv-leo', senderId: 'mock-teacher-1', body: 'وعليكم السلام ليو، حاول تقسيم الشكل إلى أجزاء متساوية أولًا.', readAt: minutesAgo(200), createdAt: minutesAgo(240) },
  { id: 'm3', conversationId: 'conv-leo', senderId: 'mock-student-1', body: 'شكرًا، سأجرب ذلك الآن.', readAt: null, createdAt: minutesAgo(12) },
  { id: 'm4', conversationId: 'conv-leo-parent', senderId: 'mock-parent-1', body: 'مرحبًا، هل يمكن معرفة موعد اختبار الأسبوع القادم؟', readAt: minutesAgo(150), createdAt: minutesAgo(180) },
  { id: 'm5', conversationId: 'conv-leo-parent', senderId: 'mock-teacher-1', body: 'الاختبار يوم الأربعاء، وسيكون على الوحدة الثالثة.', readAt: null, createdAt: minutesAgo(30) },
  { id: 'm6', conversationId: 'conv-noor-other-teacher', senderId: 'mock-parent-2', body: 'رسالة خاصة بمحادثة أخرى.', readAt: null, createdAt: minutesAgo(90) },
];

const notifications: StoredNotification[] = [];

function addNotification(conversation: ConversationRecord, message: StoredMessage) {
  const role = senderRole(conversation, message.senderId)!;
  const recipient = role === 'teacher' ? conversation.participantId : conversation.teacherId;
  notifications.push({
    id: `n-${message.id}`,
    userId: recipient,
    kind: 'message',
    title: messageNotificationTitle(role, { student: people[conversation.studentId]?.name ?? 'طالب', teacher: people[conversation.teacherId]?.name ?? 'المعلم' }),
    body: message.body.slice(0, 140),
    conversationId: conversation.id,
    readAt: message.readAt,
    createdAt: message.createdAt,
  });
}
// Seed notifications for messages that arrived unread.
for (const m of messages) {
  const c = conversations.find((x) => x.id === m.conversationId)!;
  if (!m.readAt) addNotification(c, m);
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 120));

function requireConversation(viewerId: string, conversationId: string) {
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation || !isParticipant(conversation, viewerId)) throw new Error('المحادثة غير متاحة.');
  return conversation;
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

export const mockMessaging = {
  async listConversations(viewerId: string): Promise<ConversationSummary[]> {
    await delay();
    return conversations
      .filter((c) => isParticipant(c, viewerId))
      .map((c) => {
        const thread = messages.filter((m) => m.conversationId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const last = thread.at(-1);
        const otherId = viewerId === c.teacherId ? c.participantId : c.teacherId;
        return {
          id: c.id,
          otherName: people[otherId]?.name ?? 'مستخدم',
          studentName: people[c.studentId]?.name ?? 'طالب',
          otherRole: senderRole(c, otherId)!,
          lastMessage: last?.body ?? '',
          lastAt: last?.createdAt ?? c.createdAt,
          unread: thread.filter((m) => m.senderId !== viewerId && !m.readAt).length,
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  },

  async unreadCount(viewerId: string) {
    await delay();
    return messages.filter((m) => m.senderId !== viewerId && !m.readAt && isParticipant(conversations.find((c) => c.id === m.conversationId)!, viewerId)).length;
  },

  async listThread(viewerId: string, conversationId: string): Promise<MessageItem[]> {
    await delay();
    requireConversation(viewerId, conversationId);
    return messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => ({ id: m.id, body: m.body, mine: m.senderId === viewerId, readAt: m.readAt, createdAt: m.createdAt }));
  },

  async markRead(viewerId: string, conversationId: string) {
    requireConversation(viewerId, conversationId);
    const now = new Date().toISOString();
    for (const m of messages) if (m.conversationId === conversationId && m.senderId !== viewerId && !m.readAt) m.readAt = now;
    for (const n of notifications) if (n.conversationId === conversationId && n.userId === viewerId && !n.readAt) n.readAt = now;
  },

  async send(viewerId: string, conversationId: string, rawBody: string) {
    await delay();
    const conversation = requireConversation(viewerId, conversationId);
    const body = cleanMessageBody(rawBody);
    if (!body) throw new Error('اكتب رسالة لا تزيد عن 2000 حرف.');
    const message: StoredMessage = { id: `m${messages.length + 1}`, conversationId, senderId: viewerId, body, readAt: null, createdAt: new Date().toISOString() };
    messages.push(message);
    addNotification(conversation, message);
    return { id: message.id };
  },

  /** Students and parents start conversations; teachers only reply. */
  async start(viewerId: string, input: { teacherId: string; studentId: string; body: string }) {
    await delay();
    const body = cleanMessageBody(input.body);
    if (!body) throw new Error('اكتب رسالة لا تزيد عن 2000 حرف.');
    const allowed = input.studentId === viewerId || (viewerId === mockUsers.parent.id && input.studentId === mockUsers.student.id);
    if (!allowed || !people[input.teacherId] || !input.teacherId.startsWith('mock-teacher')) throw new Error('لا يمكن بدء هذه المحادثة.');
    let conversation = conversations.find((c) => c.teacherId === input.teacherId && c.participantId === viewerId && c.studentId === input.studentId);
    if (!conversation) {
      conversation = { id: `conv-${conversations.length + 1}`, teacherId: input.teacherId, participantId: viewerId, studentId: input.studentId, createdAt: new Date().toISOString() };
      conversations.push(conversation);
    }
    await mockMessaging.send(viewerId, conversation.id, body);
    return { id: conversation.id };
  },

  async listNotifications(viewerId: string): Promise<MessageNotification[]> {
    await delay();
    return notifications
      .filter((n) => n.userId === viewerId)
      .map(({ userId: _userId, ...n }) => n)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Teachers a student or parent can write to. */
  teachers(): MockUser[] {
    return [mockUsers.teacher];
  },

  /** Students a viewer can write about: a student only themself, a parent their linked children. */
  studentsFor(role: MessagingRole): MockUser[] {
    return role === 'parent' ? [mockUsers.student] : role === 'student' ? [mockUsers.student] : [];
  },
};

import { describe, expect, it } from 'vitest';
import { buildConversationSummaries, cleanMessageBody, conversationLink, isParticipant, messageNotificationTitle, senderRole, toMessageItems, type ConversationRecord, type MessageRow } from '@/lib/messaging/logic';

const asParent: ConversationRecord = { id: 'c', teacherId: 't', participantId: 'p', studentId: 's', createdAt: '' };
const asStudent: ConversationRecord = { id: 'c', teacherId: 't', participantId: 's', studentId: 's', createdAt: '' };

describe('messaging rules', () => {
  it('only the two participants belong to a conversation', () => {
    expect(isParticipant(asParent, 't')).toBe(true);
    expect(isParticipant(asParent, 'p')).toBe(true);
    expect(isParticipant(asParent, 's')).toBe(false);
    expect(senderRole(asParent, 'x')).toBeNull();
  });

  it('tells a student sender from a parent sender', () => {
    expect(senderRole(asStudent, 's')).toBe('student');
    expect(senderRole(asParent, 'p')).toBe('parent');
    expect(senderRole(asParent, 't')).toBe('teacher');
  });

  it('builds the Arabic notification titles', () => {
    const names = { student: 'ليو', teacher: 'سارة' };
    expect(messageNotificationTitle('student', names)).toBe('ليو أرسل لك رسالة');
    expect(messageNotificationTitle('parent', names)).toBe('ولي أمر ليو أرسل لك رسالة');
  });

  it('rejects empty and over-long bodies', () => {
    expect(cleanMessageBody('   ')).toBeNull();
    expect(cleanMessageBody('x'.repeat(2001))).toBeNull();
    expect(cleanMessageBody('  مرحبا  ')).toBe('مرحبا');
  });

  it('opens a conversation in the area the viewer replies from', () => {
    expect(conversationLink('teacher', 'c1')).toEqual({ to: '/teacher', search: { tab: 'messages', c: 'c1' } });
    expect(conversationLink('parent', 'c1').to).toBe('/parent');
    expect(conversationLink('student', 'c1').to).toBe('/messages');
  });
});

describe('conversation summaries', () => {
  const at = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();
  const conversations: ConversationRecord[] = [
    { id: 'c1', teacherId: 't', participantId: 's', studentId: 's', createdAt: at(0) },
    { id: 'c2', teacherId: 't', participantId: 'p', studentId: 's', createdAt: at(1) },
    { id: 'other', teacherId: 't2', participantId: 'p2', studentId: 's2', createdAt: at(2) },
  ];
  const msg = (id: string, conversationId: string, senderId: string, createdAt: string, readAt: string | null = null): MessageRow => ({ id, conversationId, senderId, body: `body ${id}`, readAt, createdAt });
  const messages = [msg('m1', 'c1', 's', at(10), at(11)), msg('m2', 'c1', 's', at(20)), msg('m3', 'c2', 't', at(30)), msg('m4', 'other', 'p2', at(40))];
  const names = { t: 'سارة', s: 'ليو', p: 'والد ليو' };

  it('shows the teacher only their own conversations, with unread counts and the newest first', () => {
    const list = buildConversationSummaries('t', conversations, messages, names);
    expect(list.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(list.find((c) => c.id === 'c1')).toMatchObject({ otherName: 'ليو', otherRole: 'student', unread: 1, lastMessage: 'body m2' });
    expect(list.find((c) => c.id === 'c2')).toMatchObject({ otherName: 'والد ليو', otherRole: 'parent', studentName: 'ليو', unread: 0 });
  });

  it('never includes conversations the viewer is not part of', () => {
    expect(buildConversationSummaries('s', conversations, messages, names).map((c) => c.id)).toEqual(['c1']);
    expect(buildConversationSummaries('nobody', conversations, messages, names)).toEqual([]);
  });

  it('falls back to generic names and the creation time when a profile or message is missing', () => {
    const [only] = buildConversationSummaries('t', [conversations[0]!], [], {});
    expect(only).toMatchObject({ otherName: 'مستخدم', studentName: 'طالب', lastMessage: '', lastAt: at(0), unread: 0 });
  });

  it('orders a thread oldest first and marks which messages are mine', () => {
    const items = toMessageItems('s', [messages[1]!, messages[0]!]);
    expect(items.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(items.every((m) => m.mine)).toBe(true);
    expect(toMessageItems('t', messages.slice(0, 2)).every((m) => !m.mine)).toBe(true);
  });
});

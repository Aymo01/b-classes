import { describe, expect, it } from 'vitest';
import { cleanMessageBody, conversationLink, isParticipant, messageNotificationTitle, senderRole, type ConversationRecord } from '@/lib/messaging/logic';
import { mockMessaging, mockUsers } from '@/lib/messaging/mock-store';

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

describe('mock messaging store', () => {
  it('hides other people\'s conversations and refuses access to them', async () => {
    const list = await mockMessaging.listConversations(mockUsers.teacher.id);
    expect(list.some((c) => c.id === 'conv-noor-other-teacher')).toBe(false);
    await expect(mockMessaging.listThread(mockUsers.teacher.id, 'conv-noor-other-teacher')).rejects.toThrow();
    await expect(mockMessaging.send(mockUsers.student.id, 'conv-leo-parent', 'مرحبا')).rejects.toThrow();
  });

  it('notifies the teacher with kind message when a student or parent sends', async () => {
    await mockMessaging.send(mockUsers.student.id, 'conv-leo', 'سؤال جديد');
    await mockMessaging.send(mockUsers.parent.id, 'conv-leo-parent', 'شكرًا');
    const notes = await mockMessaging.listNotifications(mockUsers.teacher.id);
    expect(notes.every((n) => n.kind === 'message')).toBe(true);
    expect(notes.some((n) => n.title === 'ليو أرسل لك رسالة' && n.conversationId === 'conv-leo')).toBe(true);
    expect(notes.some((n) => n.title === 'ولي أمر ليو أرسل لك رسالة' && n.conversationId === 'conv-leo-parent')).toBe(true);
  });

  it('clears the unread count once the recipient reads the conversation', async () => {
    const before = await mockMessaging.unreadCount(mockUsers.teacher.id);
    expect(before).toBeGreaterThan(0);
    await mockMessaging.markRead(mockUsers.teacher.id, 'conv-leo');
    expect(await mockMessaging.unreadCount(mockUsers.teacher.id)).toBeLessThan(before);
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { unreadForStudent, type ConversationSummary } from '@/lib/messaging/logic';

vi.mock('@/lib/profile.functions', () => ({ getMyProfile: async () => ({ roles: ['parent'], profile: { id: 'p1' } }) }));
vi.mock('@/lib/messaging.functions', () => {
  const summary = (id: string, teacherId: string, studentId: string, unread: number) => ({ id, teacherId, studentId, otherName: 'x', studentName: 'y', otherRole: 'teacher', lastMessage: '', lastAt: '', unread });
  return {
    getUnreadMessageCount: async () => 9,
    listConversations: async () => [summary('a', 't1', 'leo', 2), summary('b', 't2', 'leo', 4), summary('c', 't2', 'noor', 5)],
    getMessagingTargets: async () => ({
      teachers: [{ id: 't1', name: 'سارة', studentIds: ['leo'] }, { id: 't2', name: 'خالد', studentIds: ['noor'] }],
      students: [{ id: 'leo', name: 'ليو' }, { id: 'noor', name: 'نور' }],
    }),
    listThread: vi.fn(), markConversationRead: vi.fn(), sendMessage: vi.fn(), startConversation: vi.fn(), listMessageNotifications: vi.fn(),
  };
});

import { UnreadBadge } from '@/components/messages-panel';

const summary = (teacherId: string, studentId: string, unread: number) => ({ id: `${teacherId}${studentId}`, teacherId, studentId, otherName: '', studentName: '', otherRole: 'teacher', lastMessage: '', lastAt: '', unread }) as ConversationSummary & { teacherId: string; studentId: string };

describe('parent unread count', () => {
  it('counts only the selected child, with teachers the child is enrolled with', () => {
    const teachers = [{ id: 't1', name: '', studentIds: ['leo'] }, { id: 't2', name: '', studentIds: ['noor'] }];
    const all = [summary('t1', 'leo', 2), summary('t2', 'leo', 4), summary('t2', 'noor', 5)];
    expect(unreadForStudent(all, teachers, 'leo')).toBe(2); // t2 is a teacher leo left
    expect(unreadForStudent(all, teachers, 'noor')).toBe(5);
    expect(unreadForStudent(all, teachers, 'nobody')).toBe(0);
  });

  it('shows the selected child count in the badge, not the account total', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><UnreadBadge studentId="leo" /></QueryClientProvider>);
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });

  it('keeps the account total when no child is given', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><UnreadBadge /></QueryClientProvider>);
    expect(await screen.findByText('9')).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const search = vi.hoisted(() => ({ value: {} as { tab?: string; c?: string } }));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options, fullPath: '/teacher', useSearch: () => search.value }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/components/student-workspace', () => ({
  StudentWorkspace: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('@/components/messages-panel', () => ({
  MessagesPanel: () => <div>messages-panel</div>,
  UnreadBadge: () => null,
}));
vi.mock('@/lib/profile.functions', () => ({ getMyProfile: async () => ({ roles: ['teacher'], profile: { id: 't1' } }) }));
vi.mock('@/lib/teacher.functions', () => ({
  listTeacherContent: async () => { throw new Error('content failed'); },
  createAssignment: vi.fn(), createClass: vi.fn(), createLesson: vi.fn(), createQuiz: vi.fn(), createSubject: vi.fn(), deleteContent: vi.fn(), gradeSubmission: vi.fn(),
}));
vi.mock('@/lib/enrollment.functions', () => ({ listMyStudents: async () => [] }));

import { Route } from '@/routes/_authenticated/teacher';

function renderTeacherPage() {
  const Page = (Route as unknown as { options: { component: () => ReactNode } }).options.component;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
}

describe('teacher Messages tab', () => {
  beforeEach(() => { search.value = {}; });

  it('renders the Messages panel even when the content query fails', async () => {
    search.value = { tab: 'inbox' };
    renderTeacherPage();
    expect(await screen.findByText('messages-panel')).toBeInTheDocument();
    expect(screen.queryByText('تعذر تحميل المحتوى')).not.toBeInTheDocument();
  });

  it('keeps the Messages tab available while a content tab shows the error', async () => {
    renderTeacherPage();
    expect(await screen.findByText('تعذر تحميل المحتوى')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /الرسائل/ })).toBeInTheDocument();
  });
});

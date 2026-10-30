import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { StudentWorkspace } from '@/components/student-workspace';
import { MessagesPanel } from '@/components/messages-panel';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/messages')({
  head: () => pageMeta('الرسائل', 'تواصل مع معلميك في B classes.'),
  validateSearch: (search: Record<string, unknown>): { c?: string | undefined } => ({ c: typeof search['c'] === 'string' ? search['c'] : undefined }),
  component: MessagesPage,
});

function MessagesPage() {
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <StudentWorkspace title="الرسائل" subtitle="تواصل مع معلميك. الرسائل نصية فقط.">
      <MessagesPanel selectedId={c} onSelect={(id) => void navigate({ search: { c: id } })} />
    </StudentWorkspace>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { ProgressDesign } from '@/components/student-workspace';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/progress')({
  head: () => pageMeta('رحلة إنجازي', 'مساحة التقدم الدراسي والإنجازات في B classes.'),
  component: ProgressDesign,
});

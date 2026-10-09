import { createFileRoute } from '@tanstack/react-router';
import { DashboardDesign } from '@/components/student-workspace';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/dashboard')({
  head: () => pageMeta('مساحتي الدراسية', 'مساحتك الدراسية، الدروس القادمة والحصص والتقدم في B classes.'),
  component: DashboardDesign,
});

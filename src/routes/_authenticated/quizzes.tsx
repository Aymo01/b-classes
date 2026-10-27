import { createFileRoute } from '@tanstack/react-router';
import { CatalogueDesign } from '@/components/student-workspace';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/quizzes')({
  head: () => pageMeta('اختباراتي', 'اختباراتك الدراسية ونتائجها في B classes.'),
  component: () => <CatalogueDesign kind="quizzes" />,
});

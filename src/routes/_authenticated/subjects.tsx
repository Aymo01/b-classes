import { createFileRoute } from '@tanstack/react-router';
import { CatalogueDesign } from '@/components/student-workspace';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/subjects')({
  head: () => pageMeta('موادي الدراسية', 'مساحة المواد الدراسية المرتبطة بصفك في B classes.'),
  component: () => <CatalogueDesign kind="subjects" />,
});

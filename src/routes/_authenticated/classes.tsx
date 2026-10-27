import { createFileRoute } from '@tanstack/react-router';
import { CatalogueDesign } from '@/components/student-workspace';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/classes')({
  head: () => pageMeta('حصصي الدراسية', 'الحصص القادمة والمباشرة والمسجلة في B classes.'),
  component: () => <CatalogueDesign kind="classes" />,
});

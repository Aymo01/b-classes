import { createFileRoute } from '@tanstack/react-router';
import { CatalogueDesign } from '@/components/student-workspace';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/lessons/')({
  head: () => pageMeta('دروسي', 'دروسك المسجلة ومواد المراجعة في B classes.'),
  component: () => <CatalogueDesign kind="lessons" />,
});

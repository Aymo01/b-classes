import { createFileRoute } from '@tanstack/react-router';
import { CatalogueDesign } from '@/components/student-workspace';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/assignments/')({
  head: () => pageMeta('واجباتي', 'واجباتك ومواعيد تسليمها في B classes.'),
  component: () => <CatalogueDesign kind="assignments" />,
});

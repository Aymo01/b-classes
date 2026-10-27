import { createFileRoute } from '@tanstack/react-router';
import { ProfileDesign } from '@/components/student-workspace';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/profile')({
  head: () => pageMeta('ملفي الشخصي', 'معلومات الطالب والصف الدراسي في B classes.'),
  component: ProfileDesign,
});

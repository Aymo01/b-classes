import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, LogOut, UserPlus, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { enrollWithTeacher, leaveTeacher, listTeachersForStudent } from '@/lib/enrollment.functions';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/my-teacher')({
  head: () => pageMeta('معلمي', 'اختر معلمك في B classes أو أنهِ التسجيل معه.'),
  component: MyTeacherPage,
});

function MyTeacherPage() {
  const queryClient = useQueryClient();
  const { data: teachers, isLoading, error } = useQuery({ queryKey: ['teachers-for-student'], queryFn: () => listTeachersForStudent() });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['teachers-for-student'] }),
    // Enrolment decides who a student can message.
    queryClient.invalidateQueries({ queryKey: ['messages', 'targets'] }),
  ]);
  const enroll = useMutation({ mutationFn: (teacherId: string) => enrollWithTeacher({ data: { teacherId } }), onSuccess: refresh });
  const leave = useMutation({ mutationFn: (teacherId: string) => leaveTeacher({ data: { teacherId } }), onSuccess: refresh });
  const actionError = enroll.error ?? leave.error;
  const pendingId = enroll.isPending ? enroll.variables : leave.isPending ? leave.variables : undefined;

  return (
    <StudentWorkspace title="معلمي" subtitle="اختر المعلم الذي تدرس معه، ويمكنك إنهاء التسجيل في أي وقت.">
      {isLoading ? (
        <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل المعلمين...</p></div>
      ) : error ? (
        <EmptyState icon={UsersRound} title="تعذر تحميل المعلمين" text="حدث خطأ غير متوقع. حاول تحديث الصفحة." />
      ) : !teachers || teachers.length === 0 ? (
        <EmptyState icon={UsersRound} title="لا يوجد معلمون بعد" text="سيظهر المعلمون هنا عندما ينضمون إلى المنصة." />
      ) : (
        <>
          {actionError instanceof Error && <p className="auth-error" role="alert">{actionError.message}</p>}
          <div className="content-list">
            {teachers.map((t) => (
              <div className="content-card" key={t.id}>
                <div>
                  {t.enrolled && <span className="content-card-kicker"><Check size={14} /> مسجّل</span>}
                  <h3>{t.name}</h3>
                </div>
                {t.enrolled ? (
                  <Button variant="outline" disabled={pendingId === t.id} onClick={() => leave.mutate(t.id)}>
                    {pendingId === t.id ? <Loader2 className="animate-spin" /> : <LogOut />}إنهاء التسجيل
                  </Button>
                ) : (
                  <Button disabled={pendingId === t.id} onClick={() => enroll.mutate(t.id)}>
                    {pendingId === t.id ? <Loader2 className="animate-spin" /> : <UserPlus />}سجّل معه
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </StudentWorkspace>
  );
}

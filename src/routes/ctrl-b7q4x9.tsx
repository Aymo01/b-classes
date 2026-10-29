import { createFileRoute, notFound } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, Loader2, Trash2, UserPlus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StudentWorkspace } from '@/components/student-workspace';
import { gradeLabel, type Grade } from '@/lib/grades';
import {
  addStudentAllowlist,
  addTeacherAccount,
  approvePendingUser,
  listPendingUsers,
  listStudentAllowlist,
  listTeacherAccounts,
  rejectPendingUser,
  removeStudentAllowlist,
  removeTeacherAccount,
} from '@/lib/access.functions';
import type { AllowlistRole } from '@/lib/access/types';

// Hidden admin page: not linked anywhere. Anyone who is not an admin sees the normal 404.
export const Route = createFileRoute('/ctrl-b7q4x9')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'الصفحة غير موجودة' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw notFound();
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' });
    if (!isAdmin) throw notFound();
  },
  component: AdminPage,
});

const grades = Array.from({ length: 12 }, (_, i) => (i + 1) as Grade);
type Notice = { kind: 'ok' | 'error'; text: string } | null;
type Pick = { role: AllowlistRole; grade: Grade };

function AdminPage() {
  const qc = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const [teacherEmail, setTeacherEmail] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<AllowlistRole>('student');
  const [memberGrade, setMemberGrade] = useState<Grade>(1);
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  const teachers = useQuery({ queryKey: ['admin', 'teachers'], queryFn: () => listTeacherAccounts() });
  const members = useQuery({ queryKey: ['admin', 'members'], queryFn: () => listStudentAllowlist() });
  const pending = useQuery({ queryKey: ['admin', 'pending'], queryFn: () => listPendingUsers() });

  async function run(action: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ kind: 'ok', text: ok });
      after?.();
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const pickFor = (userId: string): Pick => picks[userId] ?? { role: 'student', grade: 1 };
  const setPick = (userId: string, next: Partial<Pick>) =>
    setPicks((p) => ({ ...p, [userId]: { ...pickFor(userId), ...next } }));

  return (
    <StudentWorkspace title="لوحة الإدارة" subtitle="إدارة صلاحيات المعلمين والطلاب وأولياء الأمور.">
      <section className="content-card" aria-labelledby="first-admin">
        <h2 id="first-admin" className="text-lg font-bold">لإضافة أول مدير</h2>
        <p className="mt-2 text-sm">
          أضف صفًا في جدول <span dir="ltr">user_roles</span> بمعرّف المستخدم ودور <span dir="ltr">'admin'</span> من لوحة قاعدة البيانات. بعدها يمكن للمدير إدارة الباقي من هذه الصفحة.
        </p>
      </section>

      {notice && (
        <p role="status" className={notice.kind === 'ok' ? 'text-primary' : 'text-destructive'}>
          {notice.kind === 'ok' ? 'تم: ' : 'خطأ: '}{notice.text}
        </p>
      )}

      {/* Teachers */}
      <section className="content-card" aria-labelledby="teachers-admin">
        <h2 id="teachers-admin" className="text-lg font-bold">المعلمون</h2>
        <p className="mt-1 text-sm">يدخل المعلم بالبريد المدرسي الذي نوفره له فقط.</p>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (teacherEmail.trim()) void run(() => addTeacherAccount({ data: { schoolEmail: teacherEmail } }), 'تمت إضافة المعلم.', () => setTeacherEmail('')); }}>
          <Input type="email" dir="ltr" required aria-label="البريد المدرسي للمعلم" placeholder="teacher@school-domain" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} className="min-w-0 flex-1" />
          <Button type="submit" disabled={busy}><UserPlus />إضافة معلم</Button>
        </form>
        {teachers.isLoading ? <p role="status"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className="text-start">البريد المدرسي</th><th className="text-start">الحالة</th><th className="text-start">آخر دخول عبر</th><th><span className="sr-only">إجراء</span></th></tr></thead>
              <tbody>
                {(teachers.data ?? []).map((t) => (
                  <tr key={t.id} className="border-t">
                    <td dir="ltr" className="break-all py-2">{t.schoolEmail}</td>
                    <td>{t.userId ? 'نشط' : 'بانتظار أول دخول'}</td>
                    <td dir="ltr" className="break-all">{t.lastSignInEmail ?? '—'}</td>
                    <td className="text-end">
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => removeTeacherAccount({ data: { schoolEmail: t.schoolEmail } }), 'تمت إزالة صلاحية المعلم.')} aria-label={`إزالة ${t.schoolEmail}`}><Trash2 />إزالة</Button>
                    </td>
                  </tr>
                ))}
                {teachers.data?.length === 0 && <tr><td colSpan={4} className="py-2">لا يوجد معلمون بعد.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Students and parents */}
      <section className="content-card" aria-labelledby="members-admin">
        <h2 id="members-admin" className="text-lg font-bold">الطلاب وأولياء الأمور</h2>
        <p className="mt-1 text-sm">لا يمكن لأي حساب الدخول إلى المدرسة إلا إذا أُضيف بريده هنا.</p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!memberEmail.trim()) return;
            void run(
              () => addStudentAllowlist({ data: { email: memberEmail, role: memberRole, grade: memberRole === 'student' ? memberGrade : null } }),
              'تمت إضافة البريد إلى القائمة المعتمدة.',
              () => setMemberEmail(''),
            );
          }}
        >
          <Input type="email" dir="ltr" required aria-label="البريد الإلكتروني" placeholder="name@example.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} className="min-w-0 flex-1" />
          <Select value={memberRole} onValueChange={(v) => setMemberRole(v as AllowlistRole)}>
            <SelectTrigger aria-label="الدور"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">طالب</SelectItem>
              <SelectItem value="parent">ولي أمر</SelectItem>
            </SelectContent>
          </Select>
          {memberRole === 'student' && (
            <Select value={String(memberGrade)} onValueChange={(v) => setMemberGrade(Number(v) as Grade)}>
              <SelectTrigger aria-label="الصف"><SelectValue /></SelectTrigger>
              <SelectContent>{grades.map((g) => <SelectItem key={g} value={String(g)}>{gradeLabel(g)}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button type="submit" disabled={busy}><UserPlus />إضافة</Button>
        </form>
        {members.isLoading ? <p role="status"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className="text-start">البريد</th><th className="text-start">الدور</th><th className="text-start">الصف</th><th><span className="sr-only">إجراء</span></th></tr></thead>
              <tbody>
                {(members.data ?? []).map((m) => (
                  <tr key={m.email} className="border-t">
                    <td dir="ltr" className="break-all py-2">{m.email}</td>
                    <td>{m.role === 'student' ? 'طالب' : 'ولي أمر'}</td>
                    <td>{m.grade ? gradeLabel(m.grade as Grade) : '—'}</td>
                    <td className="text-end">
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => removeStudentAllowlist({ data: { email: m.email } }), 'تمت الإزالة من القائمة.')} aria-label={`إزالة ${m.email}`}><Trash2 />إزالة</Button>
                    </td>
                  </tr>
                ))}
                {members.data?.length === 0 && <tr><td colSpan={4} className="py-2">القائمة فارغة.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending sign-ups */}
      <section className="content-card" aria-labelledby="pending-admin">
        <h2 id="pending-admin" className="text-lg font-bold">حسابات بانتظار الموافقة</h2>
        <p className="mt-1 text-sm">حسابات سجّلت الدخول ولم تُعتمد بعد.</p>
        {pending.isLoading ? <p role="status"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p> : (
          <ul className="mt-3 grid gap-3">
            {(pending.data ?? []).map((u) => {
              const pick = pickFor(u.userId);
              return (
                <li key={u.userId} className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <span dir="ltr" className="min-w-0 flex-1 break-all text-sm">{u.email ?? 'بدون بريد'}</span>
                  <Select value={pick.role} onValueChange={(v) => setPick(u.userId, { role: v as AllowlistRole })}>
                    <SelectTrigger aria-label="الدور"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">طالب</SelectItem>
                      <SelectItem value="parent">ولي أمر</SelectItem>
                    </SelectContent>
                  </Select>
                  {pick.role === 'student' && (
                    <Select value={String(pick.grade)} onValueChange={(v) => setPick(u.userId, { grade: Number(v) as Grade })}>
                      <SelectTrigger aria-label="الصف"><SelectValue /></SelectTrigger>
                      <SelectContent>{grades.map((g) => <SelectItem key={g} value={String(g)}>{gradeLabel(g)}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  <Button disabled={busy || !u.email} onClick={() => void run(() => approvePendingUser({ data: { userId: u.userId, email: u.email ?? '', role: pick.role, grade: pick.role === 'student' ? pick.grade : null } }), 'تمت الموافقة على الحساب.')}><Check />موافقة</Button>
                  <Button variant="outline" disabled={busy} onClick={() => void run(() => rejectPendingUser({ data: { userId: u.userId } }), 'تم رفض الحساب.')}><X />رفض</Button>
                </li>
              );
            })}
            {pending.data?.length === 0 && <li>لا توجد حسابات بانتظار الموافقة.</li>}
          </ul>
        )}
      </section>
    </StudentWorkspace>
  );
}

import { createFileRoute, notFound } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, Hourglass, Loader2, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StudentWorkspace } from '@/components/student-workspace';
import {
  addStudentAllowlist,
  addTeacher,
  approveSignup,
  getMyAccess,
  listPendingSignups,
  listStudentAllowlist,
  listTeachers,
  rejectSignup,
  removeStudentAllowlist,
  removeTeacher,
} from '@/lib/access.functions';
import type { AllowlistRole } from '@/lib/access/types';
import { gradeLabel, type Grade } from '@/lib/grades';

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
    const access = await getMyAccess().catch(() => null);
    if (!access?.roles.includes('admin')) throw notFound();
  },
  component: AdminPage,
});

const roleLabel: Record<AllowlistRole, string> = { student: 'طالب', parent: 'ولي أمر' };
const grades = Array.from({ length: 12 }, (_, i) => i + 1);
const formatTime = (value: string) => new Date(value).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });

type Notice = { ok: boolean; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p role="status" className={notice.ok ? 'mt-3 text-primary' : 'mt-3 text-destructive'}>{notice.ok ? 'تم: ' : 'خطأ: '}{notice.text}</p>;
}

function Loading() {
  return <p className="mt-3"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p>;
}

/** Role picker, plus a grade picker for students. */
function RoleGradeFields({ role, grade, onRole, onGrade }: { role: AllowlistRole; grade: string; onRole: (r: AllowlistRole) => void; onGrade: (g: string) => void }) {
  return (
    <>
      <Select value={role} onValueChange={(v) => onRole(v as AllowlistRole)}>
        <SelectTrigger className="w-32" aria-label="الدور"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="student">{roleLabel.student}</SelectItem>
          <SelectItem value="parent">{roleLabel.parent}</SelectItem>
        </SelectContent>
      </Select>
      {role === 'student' && (
        <Select value={grade} onValueChange={onGrade}>
          <SelectTrigger className="w-40" aria-label="الصف"><SelectValue placeholder="الصف" /></SelectTrigger>
          <SelectContent>{grades.map((g) => <SelectItem key={g} value={String(g)}>{gradeLabel(g as Grade)}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </>
  );
}

function FirstAdminNote() {
  return (
    <section className="content-card" aria-labelledby="first-admin">
      <div className="min-w-0 flex-1">
        <h2 id="first-admin" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={20} />كيف تُنشئ أول مسؤول؟</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          لا يمكن إضافة المسؤولين من هذه الصفحة. سجّل حسابًا بالبريد الذي تريده مسؤولًا، ثم نفّذ هذا الأمر مرة واحدة في محرر SQL في قاعدة البيانات
          (بعد تطبيق ملف الترحيل 0008_approved_members.sql)، مع استبدال البريد ببريدك:
        </p>
        <pre dir="ltr" className="mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs">{`insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'you@example.com'
on conflict do nothing;`}</pre>
      </div>
    </section>
  );
}

function TeachersSection() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const { data, isLoading } = useQuery({ queryKey: ['admin-teachers'], queryFn: () => listTeachers() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-teachers'] });
  const add = useMutation({
    mutationFn: (value: string) => addTeacher({ data: { email: value } }),
    onSuccess: () => { setEmail(''); setNotice({ ok: true, text: 'تمت إضافة المعلم. يدخل المعلم ببريد المدرسة هذا فقط.' }); void refresh(); },
    onError: (e: Error) => setNotice({ ok: false, text: e.message }),
  });
  const remove = useMutation({
    mutationFn: (value: string) => removeTeacher({ data: { email: value } }),
    onSuccess: () => { setNotice({ ok: true, text: 'تمت إزالة المعلم.' }); void refresh(); },
    onError: (e: Error) => setNotice({ ok: false, text: e.message }),
  });

  return (
    <section className="content-card mt-4" aria-labelledby="teachers-title">
      <div className="min-w-0 flex-1">
        <h2 id="teachers-title" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={20} />المعلمون</h2>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setNotice(null); if (email.trim()) add.mutate(email); }}>
          <Input type="email" dir="ltr" required aria-label="بريد المدرسة للمعلم" placeholder="teacher@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1" />
          <Button type="submit" disabled={add.isPending}>{add.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}إضافة</Button>
        </form>
        <NoticeLine notice={notice} />
        {isLoading ? <Loading /> : (data ?? []).length === 0 ? (
          <p className="mt-3 text-muted-foreground">لا يوجد معلمون بعد.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(data ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <span dir="ltr" className="block break-all font-medium">{t.schoolEmail}</span>
                  <span className="text-sm text-muted-foreground">
                    {t.userId ? 'نشط' : 'بانتظار أول دخول'} · آخر دخول: {t.lastSignInAt ? formatTime(t.lastSignInAt) : 'لم يسجّل الدخول بعد'}
                  </span>
                </div>
                <Button variant="outline" size="sm" disabled={remove.isPending} onClick={() => { if (window.confirm(`إزالة المعلم ${t.schoolEmail}؟`)) remove.mutate(t.schoolEmail); }}>
                  <Trash2 />إزالة
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AllowlistSection() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AllowlistRole>('student');
  const [grade, setGrade] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const { data, isLoading } = useQuery({ queryKey: ['student-allowlist'], queryFn: () => listStudentAllowlist() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['student-allowlist'] });
  const add = useMutation({
    mutationFn: () => addStudentAllowlist({ data: { email, role, grade: role === 'student' ? Number(grade) : null } }),
    onSuccess: () => { setEmail(''); setNotice({ ok: true, text: 'تمت الإضافة. يمكن لصاحب البريد الدخول الآن.' }); void refresh(); },
    onError: (e: Error) => setNotice({ ok: false, text: e.message }),
  });
  const remove = useMutation({
    mutationFn: (value: string) => removeStudentAllowlist({ data: { email: value } }),
    onSuccess: () => { setNotice({ ok: true, text: 'تمت الإزالة.' }); void refresh(); },
    onError: (e: Error) => setNotice({ ok: false, text: e.message }),
  });

  return (
    <section className="content-card mt-4" aria-labelledby="allowlist-title">
      <div className="min-w-0 flex-1">
        <h2 id="allowlist-title" className="flex items-center gap-2 text-lg font-bold"><Users size={20} />الطلاب وأولياء الأمور</h2>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setNotice(null); if (email.trim()) add.mutate(); }}>
          <Input type="email" dir="ltr" required aria-label="البريد الإلكتروني" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1" />
          <RoleGradeFields role={role} grade={grade} onRole={setRole} onGrade={setGrade} />
          <Button type="submit" disabled={add.isPending || (role === 'student' && !grade)}>{add.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}إضافة</Button>
        </form>
        <NoticeLine notice={notice} />
        {isLoading ? <Loading /> : (data ?? []).length === 0 ? (
          <p className="mt-3 text-muted-foreground">لا يوجد أحد في القائمة بعد.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(data ?? []).map((a) => (
              <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <span dir="ltr" className="block break-all font-medium">{a.email}</span>
                  <span className="text-sm text-muted-foreground">{roleLabel[a.role]}{a.grade ? ` · ${gradeLabel(a.grade as Grade)}` : ''}</span>
                </div>
                <Button variant="outline" size="sm" disabled={remove.isPending} onClick={() => { if (window.confirm(`إزالة ${a.email} من القائمة؟`)) remove.mutate(a.email); }}>
                  <Trash2 />إزالة
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SignupRow({ userId, email, createdAt, onDone }: { userId: string; email: string; createdAt: string; onDone: (notice: Notice) => void }) {
  const [role, setRole] = useState<AllowlistRole>('student');
  const [grade, setGrade] = useState('');
  const approve = useMutation({
    mutationFn: () => approveSignup({ data: { userId, role, grade: role === 'student' ? Number(grade) : null } }),
    onSuccess: () => onDone({ ok: true, text: `تمت الموافقة على ${email}.` }),
    onError: (e: Error) => onDone({ ok: false, text: e.message }),
  });
  const reject = useMutation({
    mutationFn: () => rejectSignup({ data: { userId } }),
    onSuccess: () => onDone({ ok: true, text: `تم رفض ${email}.` }),
    onError: (e: Error) => onDone({ ok: false, text: e.message }),
  });
  const busy = approve.isPending || reject.isPending;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <span dir="ltr" className="block break-all font-medium">{email}</span>
        <span className="text-sm text-muted-foreground">سجّل في {formatTime(createdAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RoleGradeFields role={role} grade={grade} onRole={setRole} onGrade={setGrade} />
        <Button size="sm" disabled={busy || (role === 'student' && !grade)} onClick={() => approve.mutate()}><Check />موافقة</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm(`رفض ${email}؟`)) reject.mutate(); }}><X />رفض</Button>
      </div>
    </li>
  );
}

function PendingSection() {
  const qc = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const { data, isLoading } = useQuery({ queryKey: ['pending-signups'], queryFn: () => listPendingSignups() });
  const done = (n: Notice) => {
    setNotice(n);
    void qc.invalidateQueries({ queryKey: ['pending-signups'] });
    void qc.invalidateQueries({ queryKey: ['student-allowlist'] });
  };
  return (
    <section className="content-card mt-4" aria-labelledby="pending-title">
      <div className="min-w-0 flex-1">
        <h2 id="pending-title" className="flex items-center gap-2 text-lg font-bold"><Hourglass size={20} />طلبات التسجيل المعلّقة</h2>
        <NoticeLine notice={notice} />
        {isLoading ? <Loading /> : (data ?? []).length === 0 ? (
          <p className="mt-3 text-muted-foreground">لا توجد طلبات بانتظار الموافقة.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(data ?? []).map((s) => <SignupRow key={s.userId} {...s} onDone={done} />)}
          </ul>
        )}
      </div>
    </section>
  );
}

function AdminPage() {
  return (
    <StudentWorkspace title="لوحة الإدارة" subtitle="أدر المعلمين والطلاب وأولياء الأمور وطلبات التسجيل.">
      <FirstAdminNote />
      <TeachersSection />
      <AllowlistSection />
      <PendingSection />
    </StudentWorkspace>
  );
}

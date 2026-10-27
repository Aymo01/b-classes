import { createFileRoute, notFound } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StudentWorkspace } from '@/components/student-workspace';
import { addTeacher, listTeachers, removeTeacher } from '@/lib/admin.functions';

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

function AdminPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['admin-teachers'], queryFn: () => listTeachers() });

  const add = useMutation({
    mutationFn: (value: string) => addTeacher({ data: { email: value } }),
    onSuccess: (res) => {
      setEmail('');
      setMessage({
        kind: 'ok',
        text: res.hasAccount
          ? 'تمت إضافة المعلم. يمكنه الآن الدخول إلى منطقة المعلم.'
          : 'تمت إضافة البريد. عندما ينشئ المعلم حسابًا بهذا البريد سيحصل على صلاحية المعلم تلقائيًا.',
      });
      void qc.invalidateQueries({ queryKey: ['admin-teachers'] });
    },
    onError: (e: Error) => setMessage({ kind: 'error', text: e.message }),
  });
  const remove = useMutation({
    mutationFn: (value: string) => removeTeacher({ data: { email: value } }),
    onSuccess: () => {
      setMessage({ kind: 'ok', text: 'تمت إزالة صلاحية المعلم.' });
      void qc.invalidateQueries({ queryKey: ['admin-teachers'] });
    },
    onError: (e: Error) => setMessage({ kind: 'error', text: e.message }),
  });

  return (
    <StudentWorkspace title="لوحة الإدارة" subtitle="أضف المعلمين المصرح لهم بالدخول إلى منطقة المعلم.">
      <section className="content-card" aria-labelledby="add-teacher">
        <h2 id="add-teacher" className="flex items-center gap-2 text-lg font-bold"><UserPlus size={20} />إضافة معلم</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            if (email.trim()) add.mutate(email);
          }}
        >
          <Input
            type="email"
            dir="ltr"
            required
            aria-label="بريد المعلم الإلكتروني"
            placeholder="teacher@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}إضافة
          </Button>
        </form>
        {message && (
          <p role="status" className={message.kind === 'error' ? 'mt-3 text-destructive' : 'mt-3 text-primary'}>
            {message.kind === 'error' ? 'خطأ: ' : 'تم: '}{message.text}
          </p>
        )}
      </section>

      <section className="content-card mt-4" aria-labelledby="teacher-list">
        <h2 id="teacher-list" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={20} />المعلمون المصرح لهم</h2>
        {isLoading ? (
          <p className="mt-3"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p>
        ) : (data ?? []).length === 0 ? (
          <p className="mt-3 text-muted-foreground">لا يوجد معلمون بعد.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(data ?? []).map((t) => (
              <li key={t.email} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <span dir="ltr" className="block break-all font-medium">{t.email}</span>
                  <span className="text-sm text-muted-foreground">{t.hasAccount ? 'لديه حساب — صلاحية مفعّلة' : 'بانتظار إنشاء الحساب'}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`إزالة صلاحية المعلم عن ${t.email}؟`)) remove.mutate(t.email);
                  }}
                >
                  <Trash2 />إزالة
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StudentWorkspace>
  );
}

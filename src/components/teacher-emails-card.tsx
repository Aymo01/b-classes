import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link2, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getMyTeacherEmails, linkMyPersonalEmail } from '@/lib/access.functions';

/** Teacher's own sign-in addresses: issued school email + optional linked personal email. */
export function TeacherEmailsCard() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['my-teacher-emails'], queryFn: () => getMyTeacherEmails() });
  const link = useMutation({
    mutationFn: (value: string) => linkMyPersonalEmail({ data: { email: value } }),
    onSuccess: () => {
      setEmail('');
      setMsg({ ok: true, text: 'تم ربط البريد الشخصي. يمكنك الدخول به من الآن.' });
      void qc.invalidateQueries({ queryKey: ['my-teacher-emails'] });
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });

  if (isLoading) return <p role="status"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p>;
  if (!data) return null;

  return (
    <section className="content-card" aria-labelledby="teacher-emails">
      <div className="min-w-0 flex-1">
        <h2 id="teacher-emails" className="flex items-center gap-2 text-lg font-bold"><Mail size={20} />بريد الدخول</h2>
        <dl className="mt-2 grid gap-1 text-sm">
          <div><dt className="inline font-semibold">بريد المدرسة: </dt><dd className="inline break-all" dir="ltr">{data.schoolEmail}</dd></div>
          <div><dt className="inline font-semibold">البريد الشخصي: </dt><dd className="inline break-all" dir="ltr">{data.personalEmail ?? '—'}</dd></div>
          <div><dt className="inline font-semibold">آخر دخول عبر: </dt><dd className="inline break-all" dir="ltr">{data.loginEmail ?? '—'}</dd></div>
        </dl>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setMsg(null); if (email.trim()) link.mutate(email); }}>
          <Input type="email" dir="ltr" required aria-label="البريد الشخصي" placeholder="me@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1" />
          <Button type="submit" disabled={link.isPending}>{link.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}{data.personalEmail ? 'تغيير' : 'ربط'}</Button>
        </form>
        {msg && <p role="status" className={msg.ok ? 'mt-2 text-primary' : 'mt-2 text-destructive'}>{msg.ok ? 'تم: ' : 'خطأ: '}{msg.text}</p>}
      </div>
    </section>
  );
}

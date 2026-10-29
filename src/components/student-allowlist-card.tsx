import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addStudentAllowlist, listStudentAllowlist, removeStudentAllowlist } from '@/lib/access.functions';
import type { AllowlistRole } from '@/lib/access/types';

const roleLabel: Record<AllowlistRole, string> = { student: 'طالب', parent: 'ولي أمر' };

export function StudentAllowlistCard() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AllowlistRole>('student');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['student-allowlist'], queryFn: () => listStudentAllowlist() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['student-allowlist'] });
  const add = useMutation({
    mutationFn: () => addStudentAllowlist({ data: { email, role } }),
    onSuccess: () => { setEmail(''); setMsg({ ok: true, text: 'تمت الإضافة. يمكن لصاحب البريد الدخول الآن.' }); void refresh(); },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });
  const remove = useMutation({
    mutationFn: (value: string) => removeStudentAllowlist({ data: { email: value } }),
    onSuccess: () => { setMsg({ ok: true, text: 'تمت الإزالة.' }); void refresh(); },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });

  return (
    <section className="content-card mt-4" aria-labelledby="student-allowlist">
      <div className="min-w-0 flex-1">
        <h2 id="student-allowlist" className="flex items-center gap-2 text-lg font-bold"><Users size={20} />الطلاب وأولياء الأمور المعتمدون</h2>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setMsg(null); if (email.trim()) add.mutate(); }}>
          <Input type="email" dir="ltr" required aria-label="البريد الإلكتروني" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1" />
          <Select value={role} onValueChange={(v) => setRole(v as AllowlistRole)}>
            <SelectTrigger className="w-32" aria-label="الدور"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">طالب</SelectItem>
              <SelectItem value="parent">ولي أمر</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={add.isPending}>{add.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}إضافة</Button>
        </form>
        {msg && <p role="status" className={msg.ok ? 'mt-3 text-primary' : 'mt-3 text-destructive'}>{msg.ok ? 'تم: ' : 'خطأ: '}{msg.text}</p>}
        {isLoading ? (
          <p className="mt-3"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p>
        ) : (data ?? []).length === 0 ? (
          <p className="mt-3 text-muted-foreground">لا يوجد أحد في القائمة بعد.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(data ?? []).map((a) => (
              <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <span dir="ltr" className="block break-all font-medium">{a.email}</span>
                  <span className="text-sm text-muted-foreground">{roleLabel[a.role]}</span>
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

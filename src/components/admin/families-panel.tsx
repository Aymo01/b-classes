import { useQuery } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { adminOverview } from '@/lib/billing/admin.functions';
import { formatDate } from '@/lib/billing/format';

/** Parents and the children they added (children have no email or login). */
export function FamiliesPanel() {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-overview'], queryFn: () => adminOverview() });
  if (isLoading) return <p className="mt-3"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p>;
  if (error || !data) return <p role="alert" className="mt-3 text-destructive">تعذر تحميل البيانات.</p>;
  return (
    <section className="content-card" aria-labelledby="families-title">
      <div className="min-w-0 flex-1">
        <h2 id="families-title" className="flex items-center gap-2 text-lg font-bold"><Users size={20} />أولياء الأمور والطلاب ({data.counts.parents} / {data.counts.children})</h2>
        {data.parents.length === 0 ? <p className="mt-2 text-muted-foreground">لا يوجد أولياء أمور بعد.</p> : (
          <ul className="admin-rows">
            {data.parents.map((p) => (
              <li key={p.id} className="admin-row">
                <dl>
                  <div><dt>ولي الأمر</dt><dd>{p.name || '—'}</dd></div>
                  <div><dt>البريد</dt><dd dir="ltr" className="break-all">{p.email}</dd></div>
                  <div><dt>التسجيل</dt><dd>{p.createdAt ? formatDate(p.createdAt) : '—'}</dd></div>
                  <div><dt>الأطفال</dt><dd>{p.children.length === 0 ? 'لم يضف أطفالًا' : p.children.map((c) => `${c.position}. ${c.name} (الصف ${c.grade})`).join('، ')}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

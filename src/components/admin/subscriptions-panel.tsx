import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminOverview, adminSetSubscriptionStatus, type AdminSubscriptionDTO } from '@/lib/billing/admin.functions';
import { formatDate, formatMoney, planLabel, stateLabel } from '@/lib/billing/format';

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="study-metric"><p>{label}</p><strong>{value}</strong></div>;
}

function SubRow({ s, currency, busy, onAct }: { s: AdminSubscriptionDTO; currency: string; busy: boolean; onAct: (id: string, status: 'active' | 'cancelled') => void }) {
  return (
    <li className="admin-row">
      <dl>
        <div><dt>ولي الأمر</dt><dd dir="ltr" className="break-all">{s.parentEmail}</dd></div>
        <div><dt>الطفل</dt><dd>{s.childName}{s.grade ? ` · الصف ${s.grade}` : ''}</dd></div>
        <div><dt>الخطة</dt><dd>{planLabel[s.planType]} · {s.scope === 'grade' ? 'كل مواد الصف' : (s.subjectTitle ?? 'مادة')}</dd></div>
        <div><dt>الحالة</dt><dd><span className={`status-chip status-${s.state}`}>{stateLabel[s.state]}</span></dd></div>
        <div><dt>المدة</dt><dd>{formatDate(s.startsAt)} ← {formatDate(s.endsAt)}</dd></div>
        <div><dt>السعر</dt><dd>{formatMoney(s.finalPrice, currency)}{s.discountPercent > 0 ? ` (خصم ${s.discountPercent}%)` : ''}</dd></div>
      </dl>
      <div className="admin-row-actions">
        {s.status === 'pending' && <Button size="sm" disabled={busy} onClick={() => onAct(s.id, 'active')}><Check />تفعيل</Button>}
        {s.status !== 'cancelled' && <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm('إلغاء هذا الاشتراك؟ سيتوقف الوصول فورًا.')) onAct(s.id, 'cancelled'); }}><X />إلغاء</Button>}
      </div>
    </li>
  );
}

/** Counts, revenue, expiring and expired subscriptions, and every subscription with activate/cancel. */
export function SubscriptionsPanel() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-overview'], queryFn: () => adminOverview() });
  const act = useMutation({
    mutationFn: (v: { id: string; status: 'active' | 'cancelled' }) => adminSetSubscriptionStatus({ data: v }),
    onSuccess: () => { setMessage(null); void qc.invalidateQueries({ queryKey: ['admin-overview'] }); },
    onError: (e: Error) => setMessage(e.message),
  });

  if (isLoading) return <p className="mt-3"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p>;
  if (error || !data) return <p role="alert" className="mt-3 text-destructive">تعذر تحميل التقارير. تأكد من تطبيق ملف الترحيل على قاعدة البيانات.</p>;

  const c = data.counts;
  const cur = data.currencyLabel;
  const attention = data.subscriptions.filter((s) => s.state === 'expiring' || s.state === 'expired');
  const onAct = (id: string, status: 'active' | 'cancelled') => act.mutate({ id, status });

  return (
    <div className="admin-stack">
      <div className="study-metrics">
        <Stat label="أولياء الأمور" value={c.parents} />
        <Stat label="الأطفال" value={c.children} />
        <Stat label="مشتركون نشطون" value={c.activeSubscribers} />
        <Stat label="اشتراكات نشطة" value={c.activeSubscriptions} />
        <Stat label={`تنتهي خلال ${data.expiryWarningDays} أيام`} value={c.expiring} />
        <Stat label="منتهية" value={c.expired} />
        <Stat label="بانتظار التفعيل" value={c.pending} />
      </div>

      <section className="content-card" aria-labelledby="revenue-title">
        <div className="min-w-0 flex-1">
          <h2 id="revenue-title" className="text-lg font-bold">الإيرادات</h2>
          <p className="quiz-hint">محسوبة من الاشتراكات المفعّلة (الدفع الإلكتروني غير متصل بعد).</p>
          <dl className="price-lines">
            <div className="price-final"><dt>إجمالي الاشتراكات المفعّلة</dt><dd>{formatMoney(data.revenue.total, cur)}</dd></div>
            <div><dt>قيمة الطلبات بانتظار التفعيل</dt><dd>{formatMoney(data.revenue.pendingValue, cur)}</dd></div>
            {data.revenue.byPlan.map((p) => <div key={p.planType}><dt>{planLabel[p.planType]}</dt><dd>{formatMoney(p.amount, cur)}</dd></div>)}
            {data.revenue.byMonth.map((m) => <div key={m.month}><dt dir="ltr">{m.month}</dt><dd>{formatMoney(m.amount, cur)}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="content-card" aria-labelledby="attention-title">
        <div className="min-w-0 flex-1">
          <h2 id="attention-title" className="flex items-center gap-2 text-lg font-bold"><AlertTriangle size={20} />اشتراكات تنتهي أو انتهت</h2>
          {attention.length === 0 ? <p className="mt-2 text-muted-foreground">لا توجد اشتراكات تحتاج متابعة.</p> : (
            <ul className="admin-rows">{attention.map((s) => <SubRow key={s.id} s={s} currency={cur} busy={act.isPending} onAct={onAct} />)}</ul>
          )}
        </div>
      </section>

      <section className="content-card" aria-labelledby="all-subs-title">
        <div className="min-w-0 flex-1">
          <h2 id="all-subs-title" className="text-lg font-bold">كل الاشتراكات</h2>
          {message && <p role="alert" className="mt-2 text-destructive">{message}</p>}
          {data.subscriptions.length === 0 ? <p className="mt-2 text-muted-foreground">لا توجد اشتراكات بعد.</p> : (
            <ul className="admin-rows">{data.subscriptions.map((s) => <SubRow key={s.id} s={s} currency={cur} busy={act.isPending} onAct={onAct} />)}</ul>
          )}
        </div>
      </section>
    </div>
  );
}

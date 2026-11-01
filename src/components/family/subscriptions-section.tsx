import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CreditCard, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/student-workspace';
import { listMySubscriptions } from '@/lib/billing/billing.functions';
import { daysLeft } from '@/lib/billing/subscription';
import { formatDate, formatMoney, planLabel, stateLabel, discountLabel } from '@/lib/billing/format';

export function SubscriptionsSection({ currencyLabel }: { currencyLabel: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['my-subscriptions'], queryFn: () => listMySubscriptions() });
  const now = new Date();
  const warnings = (data ?? []).filter((s) => s.state === 'expiring' || s.state === 'expired');

  return (
    <section aria-labelledby="subs-title">
      <div className="study-section-title"><h2 id="subs-title">اشتراكاتي</h2><CreditCard size={20} /></div>
      {warnings.map((s) => (
        <p key={s.id} className="plan-warning" role="status">
          <AlertTriangle size={16} />
          {s.state === 'expired' ? `انتهى اشتراك ${s.childName} وتوقف الوصول إلى الدروس. جدّد الاشتراك لاستعادته.` : `ينتهي اشتراك ${s.childName} خلال ${Math.max(0, daysLeft(s, now))} أيام. جدّده ليستمر الوصول.`}
        </p>
      ))}
      {isLoading ? (
        <div className="study-empty" role="status"><Loader2 className="animate-spin" size={24} /></div>
      ) : error ? (
        <EmptyState icon={CreditCard} title="تعذر تحميل الاشتراكات" text="حدث خطأ غير متوقع. حاول تحديث الصفحة." />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={CreditCard} title="لا توجد اشتراكات بعد" text="اختر خطة لأحد أطفالك من الأعلى لتبدأ." />
      ) : (
        <ul className="plan-list">
          {(data ?? []).map((s) => (
            <li key={s.id} className="plan-item">
              <div>
                <h3>{s.childName} · {planLabel[s.planType]} · {s.scope === 'grade' ? 'كل مواد الصف' : (s.subjectTitle ?? 'مادة')}</h3>
                <p>
                  <span className={`status-chip status-${s.state}`}>{stateLabel[s.state]}</span>
                  <span className="plan-meta">{formatDate(s.startsAt)} ← {formatDate(s.endsAt)}</span>
                  <span className="plan-meta">{formatMoney(s.finalPrice, currencyLabel)}{s.discountPercent > 0 ? ` (${discountLabel[s.discountKind]} ${s.discountPercent}%)` : ''}</span>
                </p>
                {s.state === 'pending' && <p className="quiz-hint">يبدأ الوصول عندما تؤكد الإدارة الاشتراك.</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

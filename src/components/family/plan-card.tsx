import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, formatMoney, discountLabel, planLabel } from '@/lib/billing/format';
import { PLAN_TYPES, type PlanType } from '@/lib/billing/pricing';
import type { CatalogDTO, ChildDTO, QuoteItemDTO } from '@/lib/billing/billing.functions';

export type PlanChoice = { planType: PlanType; scope: 'grade' | 'subject'; subjectId: string | null };

/** One child's plan: pick the type and scope, and see original price, discount and final price. */
export function PlanCard({
  child,
  choice,
  onChange,
  quote,
  catalog,
}: {
  child: ChildDTO;
  choice: PlanChoice | null;
  onChange: (next: PlanChoice | null) => void;
  quote: QuoteItemDTO | undefined;
  catalog: CatalogDTO;
}) {
  const subjects = catalog.subjects.filter((s) => s.grade === child.grade);
  const money = (n: number) => formatMoney(n, catalog.currencyLabel);
  const set = (patch: Partial<PlanChoice>) => onChange({ planType: 'monthly', scope: 'grade', subjectId: null, ...(choice ?? {}), ...patch });

  return (
    <div className="plan-card" role="group" aria-label={`خطة ${child.name}`}>
      <div className="plan-card-head">
        <strong>خطة {child.name}</strong>
        {choice && <Button variant="ghost" size="sm" onClick={() => onChange(null)}>بدون اشتراك</Button>}
      </div>

      <div className="study-filters" aria-label="نوع الاشتراك">
        {PLAN_TYPES.map((t) => (
          <Button key={t} size="sm" variant={choice?.planType === t ? 'default' : 'outline'} aria-pressed={choice?.planType === t} disabled={t !== 'monthly' && !catalog.openPlans[t]} onClick={() => set({ planType: t })}>
            {planLabel[t]}
          </Button>
        ))}
      </div>
      {(!catalog.openPlans.term || !catalog.openPlans.yearly) && <p className="quiz-hint">لا يتوفر اشتراك {!catalog.openPlans.term && 'الفصل'}{!catalog.openPlans.term && !catalog.openPlans.yearly && ' ولا '}{!catalog.openPlans.yearly && 'السنة'} الآن: لم يحدد المشرف تواريخها بعد.</p>}

      {choice && (
        <>
          <div className="study-filters" aria-label="نطاق الاشتراك">
            <Button size="sm" variant={choice.scope === 'grade' ? 'default' : 'outline'} aria-pressed={choice.scope === 'grade'} onClick={() => set({ scope: 'grade', subjectId: null })}>كل مواد الصف</Button>
            <Button size="sm" variant={choice.scope === 'subject' ? 'default' : 'outline'} aria-pressed={choice.scope === 'subject'} onClick={() => set({ scope: 'subject' })} disabled={subjects.length === 0}>مادة واحدة</Button>
          </div>
          {choice.scope === 'subject' && (
            <div className="auth-field">
              <label>المادة</label>
              <Select value={choice.subjectId ?? ''} onValueChange={(v) => set({ subjectId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {quote && (
            quote.problem || !quote.available ? (
              <p className="auth-error" role="status">{quote.problem ?? 'لا يتوفر سعر لهذه الخطة.'}</p>
            ) : (
              <dl className="price-lines">
                <div><dt>السعر الأصلي</dt><dd className={quote.discountPercent > 0 ? 'price-struck' : ''}>{money(quote.listPrice)}</dd></div>
                <div>
                  <dt>{discountLabel[quote.discountKind]}{quote.offerName ? ` (${quote.offerName})` : ''}{quote.discountPercent > 0 ? ` ${quote.discountPercent}%` : ''}</dt>
                  <dd>{quote.discountAmount > 0 ? `− ${money(quote.discountAmount)}` : '—'}</dd>
                </div>
                <div className="price-final"><dt>السعر النهائي</dt><dd>{money(quote.finalPrice)}</dd></div>
                {quote.startsAt && quote.endsAt && <p className="quiz-hint">من {formatDate(quote.startsAt)} إلى {formatDate(quote.endsAt)}</p>}
              </dl>
            )
          )}
        </>
      )}
    </div>
  );
}

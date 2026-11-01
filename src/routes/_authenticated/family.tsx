import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2, Pencil, Plus, ShoppingCart, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { ChildForm } from '@/components/family/child-form';
import { PlanCard, type PlanChoice } from '@/components/family/plan-card';
import { ReferralSection } from '@/components/family/referral-section';
import { SubscriptionsSection } from '@/components/family/subscriptions-section';
import { useGrade } from '@/components/grade-provider';
import { addChild, archiveChild, getPlanCatalog, listFamilyChildren, placeOrder, quotePlans, updateChild, type ChildDTO } from '@/lib/billing/billing.functions';
import { formatMoney } from '@/lib/billing/format';
import { gradeLabel, type Grade } from '@/lib/grades';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/family')({
  head: () => pageMeta('عائلتي واشتراكاتي', 'أضف أطفالك واختر خطة الاشتراك لكل طفل في B classes.'),
  component: FamilyPage,
});

function FamilyPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { selectGrade } = useGrade();
  const { data: children, isLoading } = useQuery({ queryKey: ['family-children'], queryFn: () => listFamilyChildren() });
  const { data: catalog } = useQuery({ queryKey: ['plan-catalog'], queryFn: () => getPlanCatalog() });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, PlanChoice | null>>({});
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const list = children ?? [];
  const nextNumber = list.length + 1;

  // Only children with a chosen plan (and, for one subject, a chosen subject) are quoted.
  const items = useMemo(
    () =>
      list
        .map((c) => ({ c, ch: choices[c.id] }))
        .filter(({ ch }) => ch && (ch.scope === 'grade' || ch.subjectId))
        .map(({ c, ch }) => ({ childId: c.id, planType: ch!.planType, scope: ch!.scope, subjectId: ch!.scope === 'subject' ? ch!.subjectId : null })),
    [list, choices],
  );
  const quote = useQuery({
    queryKey: ['quote', items, appliedCode],
    queryFn: () => quotePlans({ data: { items, referralCode: appliedCode } }),
    enabled: items.length > 0,
    placeholderData: (prev) => prev,
  });

  const refreshChildren = () => qc.invalidateQueries({ queryKey: ['family-children'] });
  const add = useMutation({
    mutationFn: (v: { name: string; grade: number }) => addChild({ data: v }),
    onSuccess: () => { setAdding(false); void refreshChildren(); },
  });
  const edit = useMutation({
    mutationFn: (v: { id: string; name: string; grade: number }) => updateChild({ data: v }),
    onSuccess: () => { setEditing(null); void refreshChildren(); void qc.invalidateQueries({ queryKey: ['quote'] }); },
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveChild({ data: { id } }),
    onSuccess: (_r, id) => { setChoices((p) => ({ ...p, [id]: null })); void refreshChildren(); },
  });
  const order = useMutation({
    mutationFn: () => placeOrder({ data: { items, referralCode: appliedCode } }),
    onSuccess: (r) => {
      setConfirmed(`تم تسجيل طلبك (${r.count} ${r.count === 1 ? 'اشتراك' : 'اشتراكات'}). يبدأ الوصول إلى الدروس عندما تؤكد الإدارة الاشتراك.`);
      setChoices({});
      setAppliedCode('');
      setCodeInput('');
      void qc.invalidateQueries({ queryKey: ['my-subscriptions'] });
      void qc.invalidateQueries({ queryKey: ['my-referral-codes'] });
    },
  });

  function openLessons(child: ChildDTO) {
    selectGrade(child.grade as Grade);
    void navigate({ to: '/lessons' });
  }

  const currency = catalog?.currencyLabel ?? '';
  const q = quote.data;

  return (
    <StudentWorkspace title="عائلتي واشتراكاتي" subtitle="أضف أطفالك، واختر لكل طفل خطته. لا يحتاج الطفل إلى بريد أو حساب.">
      {confirmed && <p className="auth-notice" role="status"><CheckCircle2 size={16} />{confirmed}</p>}

      {isLoading || !catalog ? (
        <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ التحميل...</p></div>
      ) : (
        <>
          <section aria-labelledby="children-title">
            <div className="study-section-title"><h2 id="children-title">أطفالي</h2><Users size={20} /></div>

            {list.length === 0 && !adding && <EmptyState icon={Users} title="لم تضف أي طفل بعد" text="أضف الطفل الأول لتختار له خطة اشتراك." />}

            <div className="family-grid">
              {list.map((child) => (
                <div className="family-child" key={child.id}>
                  {editing === child.id ? (
                    <ChildForm heading={`تعديل ${child.name}`} submitLabel="حفظ" initial={{ name: child.name, grade: child.grade }} onSubmit={async (v) => { await edit.mutateAsync({ id: child.id, ...v }); }} onCancel={() => setEditing(null)} />
                  ) : (
                    <>
                      <div className="family-child-head">
                        <div>
                          <span className="content-card-kicker">الطفل {child.position}</span>
                          <h3>{child.name}</h3>
                          <p>{gradeLabel(child.grade as Grade)}</p>
                        </div>
                        <div className="family-child-actions">
                          <Button variant="outline" size="sm" onClick={() => openLessons(child)}><BookOpen />دروسه</Button>
                          <Button variant="ghost" size="icon" aria-label={`تعديل ${child.name}`} onClick={() => setEditing(child.id)}><Pencil /></Button>
                          <Button variant="ghost" size="icon" aria-label={`إزالة ${child.name}`} onClick={() => { if (window.confirm(`إزالة ${child.name} من حسابك؟ لن يتغير ترتيب أو خصم أي طفل آخر.`)) archive.mutate(child.id); }}><Trash2 /></Button>
                        </div>
                      </div>
                      <PlanCard child={child} choice={choices[child.id] ?? null} onChange={(next) => { setConfirmed(null); setChoices((p) => ({ ...p, [child.id]: next })); }} quote={q?.items.find((i) => i.childId === child.id)} catalog={catalog} />
                    </>
                  )}
                </div>
              ))}
            </div>

            {adding || list.length === 0 ? (
              <ChildForm
                heading={`الطفل ${nextNumber}`}
                submitLabel="حفظ الطفل"
                onSubmit={async (v) => { await add.mutateAsync(v); }}
                {...(list.length > 0 ? { onCancel: () => setAdding(false) } : {})}
              />
            ) : (
              <Button onClick={() => setAdding(true)}><Plus />إضافة الطفل {nextNumber}</Button>
            )}
          </section>

          {list.length > 0 && (
            <section aria-labelledby="order-title" className="teacher-form order-summary">
              <h3 id="order-title"><ShoppingCart size={18} />ملخص الطلب</h3>
              <div className="parent-link-row">
                <Input dir="ltr" placeholder="رمز الإحالة (اختياري)" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} aria-label="رمز الإحالة" maxLength={32} />
                <Button type="button" variant="outline" onClick={() => setAppliedCode(codeInput)}>تطبيق</Button>
              </div>
              {q?.referral.message && <p className={q.referral.state === 'invalid' ? 'auth-error' : 'quiz-hint'} role="status">{q.referral.message}</p>}
              {q?.referral.state === 'valid' && !q.referral.message && <p className="auth-notice" role="status"><CheckCircle2 size={16} />تم تطبيق رمز الإحالة.</p>}

              {items.length === 0 ? (
                <p className="quiz-hint">اختر خطة لطفل واحد على الأقل لترى السعر.</p>
              ) : (
                <dl className="price-lines">
                  {q?.items.map((i) => (
                    <div key={i.childId}><dt>{i.childName}</dt><dd>{i.available ? formatMoney(i.finalPrice, currency) : '—'}</dd></div>
                  ))}
                  {q && q.listTotal !== q.total && <div><dt>المجموع قبل الخصم</dt><dd className="price-struck">{formatMoney(q.listTotal, currency)}</dd></div>}
                  <div className="price-final"><dt>الإجمالي لكل الأطفال</dt><dd>{q ? formatMoney(q.total, currency) : '…'}</dd></div>
                </dl>
              )}
              {order.error instanceof Error && <p className="auth-error" role="alert">{order.error.message}</p>}
              <div className="form-actions">
                <Button onClick={() => order.mutate()} disabled={order.isPending || !q?.ready || items.length === 0 || q?.referral.state === 'invalid'}>
                  {order.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart />}تأكيد الطلب
                </Button>
              </div>
              <p className="quiz-hint">الدفع غير متاح بعد: يُسجَّل طلبك وتؤكده الإدارة. الأسعار والخصومات تحددها الإدارة.</p>
            </section>
          )}

          <SubscriptionsSection currencyLabel={currency} />
          <ReferralSection />
        </>
      )}
    </StudentWorkspace>
  );
}

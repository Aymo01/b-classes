import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, Copy, Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createReferralCode, listMyReferralCodes } from '@/lib/billing/billing.functions';
import { formatDate } from '@/lib/billing/format';

/** One single-use code per friend. The friend gets the discount; your own plan is unchanged. */
export function ReferralSection() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['my-referral-codes'], queryFn: () => listMyReferralCodes() });
  const create = useMutation({ mutationFn: () => createReferralCode(), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-referral-codes'] }) });

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* the code is visible on screen to copy by hand */
    }
  }

  return (
    <section aria-labelledby="referral-title" className="teacher-form">
      <h3 id="referral-title"><Gift size={18} />ادعُ صديقًا</h3>
      <p className="quiz-hint">أنشئ رمزًا لكل صديق. يحصل صديقك على خصم على خطة طفله الأول، ولا تتغير خطتك. الرمز صالح لمدة محدودة ويُستخدم مرة واحدة.</p>
      <div className="form-actions">
        <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <Loader2 className="animate-spin" /> : <Gift />}إنشاء رمز لصديق</Button>
      </div>
      {create.error instanceof Error && <p className="auth-error" role="alert">{create.error.message}</p>}
      {(data ?? []).length > 0 && (
        <ul className="plan-list">
          {(data ?? []).map((c) => (
            <li key={c.id} className="plan-item">
              <div>
                <code className="invite-code" dir="ltr">{c.code}</code>
                <p><span className="plan-meta">{c.redeemed ? 'استُخدم' : `صالح حتى ${formatDate(c.expiresAt)}`}</span></p>
              </div>
              {!c.redeemed && <Button variant="outline" size="sm" onClick={() => void copy(c.code)}>{copied === c.code ? <Check /> : <Copy />}{copied === c.code ? 'تم النسخ' : 'نسخ'}</Button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

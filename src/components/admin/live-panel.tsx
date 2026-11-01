import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, Loader2, Send, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminHandleLiveSession, adminListLiveSessions, type LiveSessionDTO } from '@/lib/billing/live.functions';
import { liveModeLabel, liveStatusLabel } from '@/lib/billing/live';
import { formatDateTime, formatMoney, fromLocalInput } from '@/lib/billing/format';
import { ConfigTable } from './config-table';

function Request({ s, onDone }: { s: LiveSessionDTO; onDone: (message: string | null) => void }) {
  const [proposal, setProposal] = useState('');
  const act = useMutation({
    mutationFn: (v: { action: 'accept' | 'propose' | 'complete' | 'cancel'; proposedAt?: string }) => adminHandleLiveSession({ data: { id: s.id, ...v } }),
    onSuccess: () => onDone(null),
    onError: (e: Error) => onDone(e.message),
  });
  return (
    <li className="admin-row">
      <dl>
        <div><dt>المادة</dt><dd>{s.subjectTitle}</dd></div>
        <div><dt>الطفل</dt><dd>{s.childName}</dd></div>
        <div><dt>النوع</dt><dd>{liveModeLabel[s.mode]} · {formatMoney(s.price)}</dd></div>
        <div><dt>الموعد المطلوب</dt><dd>{formatDateTime(s.requestedAt)}</dd></div>
        <div><dt>المعلم</dt><dd>{s.teacherName ?? 'غير محدد'}</dd></div>
        <div><dt>الحالة</dt><dd><span className={`status-chip status-live-${s.status}`}>{liveStatusLabel[s.status]}</span>{s.proposedAt ? ` · موعد مقترح ${formatDateTime(s.proposedAt)}` : ''}</dd></div>
        {s.note && <div><dt>ملاحظة</dt><dd className="break-words">{s.note}</dd></div>}
      </dl>
      <div className="admin-row-actions admin-row-actions-wrap">
        {s.status === 'pending' && (
          <>
            <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ action: 'accept' })}><Check />قبول</Button>
            <Input type="datetime-local" dir="ltr" aria-label="موعد مقترح" value={proposal} onChange={(e) => setProposal(e.target.value)} className="admin-datetime" />
            <Button size="sm" variant="outline" disabled={act.isPending || !proposal} onClick={() => act.mutate({ action: 'propose', proposedAt: fromLocalInput(proposal) })}><Send />اقتراح موعد</Button>
          </>
        )}
        {s.status === 'accepted' && <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ action: 'complete' })}><Check />تمت الجلسة</Button>}
        {(s.status === 'pending' || s.status === 'accepted') && <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => { if (window.confirm('إلغاء هذه الجلسة؟')) act.mutate({ action: 'cancel' }); }}><X />إلغاء</Button>}
      </div>
    </li>
  );
}

/** Live session requests (accept, propose another time, complete, cancel) plus their prices and open slots. */
export function LivePanel() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-live'], queryFn: () => adminListLiveSessions() });
  const done = (m: string | null) => { setMessage(m); void qc.invalidateQueries({ queryKey: ['admin-live'] }); };
  const pending = (data ?? []).filter((s) => s.status === 'pending');
  const rest = (data ?? []).filter((s) => s.status !== 'pending');

  return (
    <div className="admin-stack">
      <section className="content-card" aria-labelledby="live-requests-title">
        <div className="min-w-0 flex-1">
          <h2 id="live-requests-title" className="flex items-center gap-2 text-lg font-bold"><Video size={20} />طلبات الجلسات المباشرة ({pending.length} بانتظار القرار)</h2>
          {message && <p role="alert" className="mt-2 text-destructive">{message}</p>}
          {isLoading ? <p className="mt-3"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p> : error ? (
            <p role="alert" className="mt-3 text-destructive">تعذر تحميل الطلبات. تأكد من تطبيق ملف الترحيل.</p>
          ) : (data ?? []).length === 0 ? <p className="mt-3 text-muted-foreground">لا توجد طلبات بعد.</p> : (
            <ul className="admin-rows">{[...pending, ...rest].map((s) => <Request key={s.id} s={s} onDone={done} />)}</ul>
          )}
        </div>
      </section>
      <ConfigTable table="live_session_prices" />
      <ConfigTable table="live_slots" />
    </div>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, Loader2, Send, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { listFamilyChildren } from '@/lib/billing/billing.functions';
import { cancelMyLiveSession, getLiveOptions, listMyLiveSessions, requestLiveSession, respondToLiveProposal } from '@/lib/billing/live.functions';
import { liveModeLabel, liveStatusLabel, type LiveMode } from '@/lib/billing/live';
import { formatDateTime, formatMoney, fromLocalInput } from '@/lib/billing/format';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/live')({
  head: () => pageMeta('الجلسات المباشرة', 'اطلب جلسة مباشرة مع معلم في B classes.'),
  component: LivePage,
});

const ANY_TIME = 'custom';

function LivePage() {
  const qc = useQueryClient();
  const { data: children } = useQuery({ queryKey: ['family-children'], queryFn: () => listFamilyChildren() });
  const { data: options, isLoading } = useQuery({ queryKey: ['live-options'], queryFn: () => getLiveOptions() });
  const { data: sessions } = useQuery({ queryKey: ['my-live-sessions'], queryFn: () => listMyLiveSessions() });

  const [childId, setChildId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [mode, setMode] = useState<LiveMode | ''>('');
  const [teacherId, setTeacherId] = useState('');
  const [slotId, setSlotId] = useState(ANY_TIME);
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['my-live-sessions'] });
  const request = useMutation({
    mutationFn: () => requestLiveSession({ data: { childId, subjectId, mode, teacherId: teacherId || null, slotId: slotId === ANY_TIME ? null : slotId, requestedAt: slotId === ANY_TIME ? fromLocalInput(when) : null, note: note || null } }),
    onSuccess: () => { setSent(true); setSubjectId(''); setSlotId(ANY_TIME); setWhen(''); setNote(''); void refresh(); void qc.invalidateQueries({ queryKey: ['live-options'] }); },
  });
  const respond = useMutation({ mutationFn: (v: { id: string; accept: boolean }) => respondToLiveProposal({ data: v }), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: (id: string) => cancelMyLiveSession({ data: { id } }), onSuccess: refresh });

  const child = (children ?? []).find((c) => c.id === childId);
  const subjects = (options?.subjects ?? []).filter((s) => child && s.grade === child.grade);
  const slots = (options?.slots ?? []).filter((s) => s.subjectId === subjectId && s.mode === mode);
  const price = mode && options ? options.prices[mode] : undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(false);
    const next: Record<string, string> = {};
    if (!childId) next['child'] = 'اختر الطفل.';
    if (!subjectId) next['subject'] = 'اختر المادة.';
    if (!mode) next['mode'] = 'اختر نوع الجلسة.';
    if (slotId === ANY_TIME) {
      if (!when) next['when'] = 'اختر موعدًا أو اختر من المواعيد المتاحة.';
      else if (new Date(when).getTime() <= Date.now()) next['when'] = 'اختر موعدًا في المستقبل.';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) request.mutate();
  }

  if (isLoading || !options) {
    return <StudentWorkspace title="الجلسات المباشرة" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ التحميل...</p></div></StudentWorkspace>;
  }

  return (
    <StudentWorkspace title="الجلسات المباشرة" subtitle="اطلب جلسة مع معلم. الجلسات المباشرة منفصلة عن الاشتراك ولها سعر خاص.">
      {(children ?? []).length === 0 ? (
        <EmptyState icon={Video} title="أضف طفلًا أولًا" text="لطلب جلسة مباشرة أضف طفلك من صفحة عائلتي." />
      ) : options.modes.length === 0 ? (
        <EmptyState icon={Video} title="الجلسات المباشرة غير متاحة الآن" text="لم تفعّل الإدارة أي نوع من الجلسات بعد." />
      ) : (
        <form className="teacher-form" onSubmit={submit} noValidate>
          <h3>طلب جلسة جديدة</h3>
          {sent && <p className="auth-notice" role="status"><CheckCircle2 size={16} />وصل طلبك. ستراجعه الإدارة وتقبله أو تقترح موعدًا آخر.</p>}
          <div className="teacher-form-grid">
            <div className="auth-field">
              <label>الطفل</label>
              <Select value={childId} onValueChange={(v) => { setChildId(v); setSubjectId(''); setSlotId(ANY_TIME); }}>
                <SelectTrigger aria-invalid={!!errors['child']}><SelectValue placeholder="اختر الطفل" /></SelectTrigger>
                <SelectContent>{(children ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors['child'] && <p className="auth-error" role="alert">{errors['child']}</p>}
            </div>
            <div className="auth-field">
              <label>المادة</label>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setSlotId(ANY_TIME); }} disabled={!child}>
                <SelectTrigger aria-invalid={!!errors['subject']}><SelectValue placeholder={child ? 'اختر المادة' : 'اختر الطفل أولًا'} /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
              </Select>
              {errors['subject'] && <p className="auth-error" role="alert">{errors['subject']}</p>}
            </div>
          </div>

          <div className="auth-field">
            <label>نوع الجلسة</label>
            <div className="study-filters" role="group" aria-label="نوع الجلسة">
              {options.modes.map((m) => (
                <Button key={m} type="button" size="sm" variant={mode === m ? 'default' : 'outline'} aria-pressed={mode === m} onClick={() => { setMode(m); setSlotId(ANY_TIME); }}>
                  {liveModeLabel[m]}{options.prices[m] != null ? ` · ${formatMoney(options.prices[m]!, options.currencyLabel)}` : ''}
                </Button>
              ))}
            </div>
            {errors['mode'] && <p className="auth-error" role="alert">{errors['mode']}</p>}
            {mode && price == null && <p className="quiz-hint">لم تحدد الإدارة سعر هذا النوع بعد.</p>}
          </div>

          <div className="teacher-form-grid">
            <div className="auth-field">
              <label>المعلم (اختياري)</label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger><SelectValue placeholder="أي معلم متاح" /></SelectTrigger>
                <SelectContent>{options.teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="auth-field">
              <label>الموعد</label>
              <Select value={slotId} onValueChange={setSlotId} disabled={!subjectId || !mode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_TIME}>موعد أقترحه أنا</SelectItem>
                  {slots.map((s) => <SelectItem key={s.id} value={s.id}>{formatDateTime(s.startsAt)} · {options.teachers.find((t) => t.id === s.teacherId)?.name ?? 'معلم'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {slotId === ANY_TIME && (
            <div className="auth-field">
              <label htmlFor="live-when">الموعد الذي تقترحه</label>
              <Input id="live-when" type="datetime-local" dir="ltr" value={when} onChange={(e) => setWhen(e.target.value)} aria-invalid={!!errors['when']} />
              {errors['when'] && <p className="auth-error" role="alert">{errors['when']}</p>}
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="live-note">ملاحظة (اختياري)</label>
            <Textarea id="live-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {request.error instanceof Error && <p className="auth-error" role="alert">{request.error.message}</p>}
          <div className="form-actions"><Button type="submit" disabled={request.isPending}>{request.isPending ? <Loader2 className="animate-spin" /> : <Send />}إرسال الطلب</Button></div>
        </form>
      )}

      <section aria-labelledby="my-live-title">
        <div className="study-section-title"><h2 id="my-live-title">طلباتي</h2><Video size={20} /></div>
        {(sessions ?? []).length === 0 ? (
          <EmptyState icon={Video} title="لا توجد طلبات بعد" text="ستظهر هنا طلباتك وحالتها." />
        ) : (
          <ul className="plan-list">
            {(sessions ?? []).map((s) => (
              <li key={s.id} className="plan-item plan-item-wrap">
                <div>
                  <h3>{s.subjectTitle} · {s.childName}</h3>
                  <p>
                    <span className={`status-chip status-live-${s.status}`}>{liveStatusLabel[s.status]}</span>
                    <span className="plan-meta">{liveModeLabel[s.mode]}</span>
                    <span className="plan-meta">{formatDateTime(s.requestedAt)}</span>
                    {s.teacherName && <span className="plan-meta">المعلم: {s.teacherName}</span>}
                    <span className="plan-meta">{formatMoney(s.price, options.currencyLabel)}</span>
                  </p>
                  {s.status === 'pending' && s.proposedAt && (
                    <p className="plan-warning" role="status">اقترحت الإدارة موعدًا آخر: {formatDateTime(s.proposedAt)}</p>
                  )}
                </div>
                <div className="family-child-actions">
                  {s.status === 'pending' && s.proposedAt && (
                    <>
                      <Button size="sm" onClick={() => respond.mutate({ id: s.id, accept: true })}>قبول الموعد</Button>
                      <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: s.id, accept: false })}>رفض</Button>
                    </>
                  )}
                  {(s.status === 'pending' || s.status === 'accepted') && !s.proposedAt && (
                    <Button size="sm" variant="ghost" onClick={() => { if (window.confirm('إلغاء هذا الطلب؟')) cancel.mutate(s.id); }}>إلغاء</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="quiz-hint"><Link to="/family">اشتراكاتي</Link> منفصلة عن الجلسات المباشرة.</p>
      </section>
    </StudentWorkspace>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowRight, Check, ClipboardCheck, Loader2, Save, Sparkles, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StudentWorkspace } from '@/components/student-workspace';
import { editItem, generateDrafts, listReviewItems, reviewItem, type ReviewItemDTO } from '@/lib/game-review.functions';
import { listSubjects } from '@/lib/content.functions';
import { getMyProfile } from '@/lib/profile.functions';
import type { ItemKind, ItemStatus, Json } from '@/lib/games/rules';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/game-review')({
  head: () => pageMeta('مراجعة أسئلة الألعاب', 'اعتماد أسئلة الألعاب أو تعديلها أو رفضها قبل ظهورها للطلاب.'),
  component: GameReviewPage,
});

const statusTabs: { value: ItemStatus; label: string }[] = [
  { value: 'draft', label: 'مسودات' },
  { value: 'approved', label: 'معتمدة' },
  { value: 'rejected', label: 'مرفوضة' },
];
const kindLabels: Record<ItemKind, string> = {
  choice: 'اختيار من متعدد', pair: 'مطابقة', order: 'ترتيب', card: 'بطاقة', ladder: 'سلّم كلمات', word: 'كلمة متقاطعة', place: 'مكان على الخريطة',
};
const msg = (err: unknown) => (err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');

function GameReviewPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['my-profile'], queryFn: () => getMyProfile() });
  const isEditor = (me?.roles ?? []).some((r) => r === 'teacher' || r === 'admin');
  const [status, setStatus] = useState<ItemStatus>('draft');
  const [subjectId, setSubjectId] = useState('');
  const { data: subjects } = useQuery({ queryKey: ['review-subjects'], queryFn: () => listSubjects({ data: {} }), enabled: isEditor });
  const { data: items, isLoading, error } = useQuery({
    queryKey: ['review-items', status, subjectId],
    queryFn: () => listReviewItems({ data: { status, ...(subjectId ? { subjectId } : {}) } }),
    enabled: isEditor,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['review-items'] });

  if (!me) return <StudentWorkspace title="مراجعة أسئلة الألعاب" subtitle=""><div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ التحقق من الصلاحيات...</p></div></StudentWorkspace>;
  if (!isEditor) return <StudentWorkspace title="مراجعة أسئلة الألعاب" subtitle=""><EmptyState icon={ClipboardCheck} title="هذه الصفحة للمعلمين" text="حسابك الحالي لا يملك صلاحية مراجعة الأسئلة." /></StudentWorkspace>;

  return (
    <StudentWorkspace title="مراجعة أسئلة الألعاب" subtitle="لا يرى الطلاب إلا الأسئلة التي اعتمدتها.">
      <Button variant="link" asChild><Link to="/teacher"><ArrowRight />العودة إلى منطقة المعلم</Link></Button>
      <GenerateForm subjects={subjects ?? []} onCreated={() => { setStatus('draft'); void refresh(); }} />

      <div className="study-filters" role="group" aria-label="تصفية الأسئلة">
        {statusTabs.map((t) => <Button key={t.value} variant={status === t.value ? 'default' : 'ghost'} aria-pressed={status === t.value} onClick={() => setStatus(t.value)}>{t.label}</Button>)}
        <label className="sr-only" htmlFor="review-subject">المادة</label>
        <select id="review-subject" className="game-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">كل المواد</option>
          {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.title} — الصف {s.grade}</option>)}
        </select>
      </div>

      {isLoading && <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ التحميل...</p></div>}
      {error && <p className="auth-error" role="alert">{msg(error)}</p>}
      {items && items.length === 0 && <EmptyState icon={ClipboardCheck} title="لا توجد أسئلة هنا" text="ستظهر الأسئلة في هذه القائمة عندما تُولَّد أو تُضاف." />}
      <div className="content-list">
        {(items ?? []).map((item) => <ReviewCard key={item.id} item={item} onChanged={() => void refresh()} />)}
      </div>
    </StudentWorkspace>
  );
}

function GenerateForm({ subjects, onCreated }: { subjects: { id: string; title: string; grade: number }[]; onCreated: () => void }) {
  const [subjectId, setSubjectId] = useState('');
  const [kind, setKind] = useState<ItemKind>('choice');
  const [source, setSource] = useState('');
  const [curriculum, setCurriculum] = useState('');
  const [count, setCount] = useState(8);
  const run = useMutation({
    mutationFn: () => generateDrafts({ data: { subjectId, kind, curriculum, source, count } }),
    onSuccess: onCreated,
  });
  return (
    <form className="teacher-form" onSubmit={(e) => { e.preventDefault(); run.mutate(); }}>
      <h3><Sparkles size={18} aria-hidden="true" />توليد مسودات من المنهاج</h3>
      <p className="quiz-hint">الصق مقطعًا من الكتاب الرسمي. يكتب النموذج أسئلة من هذا المقطع فقط، وتُحفظ كلها كمسودات ولا تظهر للطلاب قبل اعتمادك.</p>
      <div className="profile-fields">
        <div><label htmlFor="gen-subject">المادة</label>
          <select id="gen-subject" className="game-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            <option value="">اختر المادة</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.title} — الصف {s.grade}</option>)}
          </select></div>
        <div><label htmlFor="gen-kind">نوع السؤال</label>
          <select id="gen-kind" className="game-input" value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
            {(Object.keys(kindLabels) as ItemKind[]).map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}
          </select></div>
        <div><label htmlFor="gen-source">مصدر المقطع (الكتاب والوحدة والصفحة)</label>
          <input id="gen-source" className="game-input" value={source} onChange={(e) => setSource(e.target.value)} required /></div>
        <div><label htmlFor="gen-count">عدد الأسئلة</label>
          <input id="gen-count" type="number" min={1} max={20} className="game-input" value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
      </div>
      <label htmlFor="gen-text">مقطع المنهاج</label>
      <textarea id="gen-text" className="game-input" rows={7} value={curriculum} onChange={(e) => setCurriculum(e.target.value)} required />
      {run.isError && <p className="auth-error" role="alert">{msg(run.error)}</p>}
      {run.isSuccess && <p className="auth-notice" role="status"><Check size={16} aria-hidden="true" />أُنشئت {run.data.created} مسودة{run.data.rejected ? ` (استُبعد ${run.data.rejected} غير صالح)` : ''}.</p>}
      <Button type="submit" disabled={run.isPending}>{run.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}توليد المسودات</Button>
    </form>
  );
}

function ReviewCard({ item, onChanged }: { item: ReviewItemDTO; onChanged: () => void }) {
  const [text, setText] = useState(() => JSON.stringify(item.payload, null, 2));
  const [topic, setTopic] = useState(item.topic ?? '');
  const [note, setNote] = useState(item.reviewNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (s: ItemStatus) => reviewItem({ data: { id: item.id, status: s, note } }),
    onSuccess: onChanged,
    onError: (e) => setError(msg(e)),
  });
  const save = useMutation({
    mutationFn: () => {
      let payload: Record<string, Json>;
      try { payload = JSON.parse(text) as Record<string, Json>; } catch { throw new Error('صيغة JSON غير صحيحة.'); }
      return editItem({ data: { id: item.id, topic, payload } });
    },
    onSuccess: () => { setError(null); onChanged(); },
    onError: (e) => setError(msg(e)),
  });
  const busy = decide.isPending || save.isPending;

  return (
    <article className="game-panel" aria-label={`${kindLabels[item.kind]} — ${item.subjectTitle}`}>
      <div className="game-status">
        <span>{kindLabels[item.kind]}</span>
        <span>{item.subjectTitle}{item.grade ? ` · الصف ${item.grade}` : ''}</span>
        <span>{item.generatedBy === 'ai' ? 'مولَّد بالذكاء الاصطناعي' : 'أضافه معلم'}</span>
        {item.source && <span>المصدر: {item.source}</span>}
      </div>
      <label htmlFor={`topic-${item.id}`}>الموضوع</label>
      <input id={`topic-${item.id}`} className="game-input" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <label htmlFor={`payload-${item.id}`}>محتوى السؤال (JSON)</label>
      <textarea id={`payload-${item.id}`} dir="ltr" className="game-input" rows={Math.min(14, text.split('\n').length + 1)} value={text} onChange={(e) => setText(e.target.value)} />
      <label htmlFor={`note-${item.id}`}>ملاحظة المراجعة (اختياري)</label>
      <input id={`note-${item.id}`} className="game-input" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="game-actions">
        <Button variant="outline" disabled={busy} onClick={() => save.mutate()}><Save />حفظ التعديل</Button>
        {item.status !== 'approved' && <Button disabled={busy} onClick={() => decide.mutate('approved')}><Check />اعتماد</Button>}
        {item.status !== 'rejected' && <Button variant="outline" disabled={busy} onClick={() => decide.mutate('rejected')}><X />رفض</Button>}
        {item.status !== 'draft' && <Button variant="ghost" disabled={busy} onClick={() => decide.mutate('draft')}><Undo2 />إعادة إلى مسودة</Button>}
      </div>
      <p className="quiz-hint">تعديل سؤال معتمد يعيده إلى مسودة حتى تعتمده من جديد.</p>
    </article>
  );
}

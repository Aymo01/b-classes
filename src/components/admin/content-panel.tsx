import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getPlanCatalog } from '@/lib/billing/billing.functions';
import { gradeLabel, type Grade } from '@/lib/grades';
import { ConfigTable } from './config-table';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
const NO_UNIT = 'none';
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Videos are filed as grade > subject > unit > lesson and stored in the private lesson-media bucket.
 * The database only serves them to staff and to parents whose subscription covers that subject.
 */
function VideoUpload() {
  const qc = useQueryClient();
  const { data: catalog } = useQuery({ queryKey: ['plan-catalog'], queryFn: () => getPlanCatalog() });
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [unitId, setUnitId] = useState(NO_UNIT);
  const [lessonId, setLessonId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const subjects = (catalog?.subjects ?? []).filter((s) => String(s.grade) === grade);
  const { data: units } = useQuery({
    queryKey: ['units', subjectId],
    queryFn: async () => (await db.from('units').select('id, title').eq('subject_id', subjectId).order('order_index')).data ?? [],
    enabled: !!subjectId,
  });
  const { data: lessons } = useQuery({
    queryKey: ['lessons-of', subjectId],
    queryFn: async () => (await db.from('lessons').select('id, title, video_path').eq('subject_id', subjectId).order('order_index')).data ?? [],
    enabled: !!subjectId,
  });

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!grade || !subjectId || !lessonId) return setMessage({ ok: false, text: 'اختر الصف والمادة والدرس.' });
    if (!file) return setMessage({ ok: false, text: 'اختر ملف الفيديو.' });
    if (!file.type.startsWith('video/')) return setMessage({ ok: false, text: 'الملف يجب أن يكون فيديو.' });
    if (file.size > MAX_BYTES) return setMessage({ ok: false, text: 'حجم الملف كبير جدًا (الحد 2 غيغابايت).' });
    setBusy(true);
    const ext = (file.name.split('.').pop() ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
    // <grade>/<subject>/<unit>/<lesson>/<file>: the second segment is what the storage policy checks.
    const path = `${grade}/${subjectId}/${unitId}/${lessonId}/video-${Date.now()}.${ext}`;
    const up = await supabase.storage.from('lesson-media').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      setBusy(false);
      return setMessage({ ok: false, text: 'تعذر رفع الفيديو. تأكد من الصلاحيات وحجم الملف وحاول مجددًا.' });
    }
    const patch: Record<string, unknown> = { video_path: path };
    if (unitId !== NO_UNIT) patch['unit_id'] = unitId;
    const { error } = await db.from('lessons').update(patch).eq('id', lessonId);
    setBusy(false);
    if (error) return setMessage({ ok: false, text: 'رُفع الفيديو لكن تعذر ربطه بالدرس.' });
    setFile(null);
    setMessage({ ok: true, text: 'تم رفع الفيديو وربطه بالدرس.' });
    void qc.invalidateQueries({ queryKey: ['lessons-of', subjectId] });
  }

  return (
    <section className="content-card" aria-labelledby="video-title">
      <div className="min-w-0 flex-1">
        <h2 id="video-title" className="flex items-center gap-2 text-lg font-bold"><Upload size={20} />رفع فيديو درس</h2>
        <p className="quiz-hint">الفيديو يُحفظ خاصًا: لا رابط عام له، ولا يشاهده إلا مشترك يشمل اشتراكه هذه المادة. لإضافة المواد والدروس استخدم <Link to="/teacher" className="underline">منطقة المعلم</Link>.</p>
        <form className="teacher-form" onSubmit={upload} noValidate>
          <div className="teacher-form-grid">
            <div className="auth-field"><label>الصف</label>
              <Select value={grade} onValueChange={(v) => { setGrade(v); setSubjectId(''); setUnitId(NO_UNIT); setLessonId(''); }}>
                <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <SelectItem key={g} value={String(g)}>{gradeLabel(g as Grade)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="auth-field"><label>المادة</label>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setUnitId(NO_UNIT); setLessonId(''); }} disabled={!grade}>
                <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="auth-field"><label>الوحدة</label>
              <Select value={unitId} onValueChange={setUnitId} disabled={!subjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NO_UNIT}>بدون وحدة</SelectItem>{(units ?? []).map((u: { id: string; title: string }) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="auth-field"><label>الدرس</label>
              <Select value={lessonId} onValueChange={setLessonId} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder="اختر الدرس" /></SelectTrigger>
                <SelectContent>{(lessons ?? []).map((l: { id: string; title: string; video_path: string | null }) => <SelectItem key={l.id} value={l.id}>{l.title}{l.video_path ? ' ✓' : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="video-file">ملف الفيديو</label>
            <input id="video-file" type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="file-input" />
          </div>
          {message && <p role="status" className={message.ok ? 'text-primary' : 'text-destructive'}>{message.ok ? 'تم: ' : 'خطأ: '}{message.text}</p>}
          <div className="form-actions"><Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Upload />}رفع الفيديو</Button></div>
        </form>
      </div>
    </section>
  );
}

export function ContentPanel() {
  return (
    <div className="admin-stack">
      <VideoUpload />
      <ConfigTable table="units" />
    </div>
  );
}

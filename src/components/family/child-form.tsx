import { useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { gradeLabel, type Grade } from '@/lib/grades';

/** Name and grade of a child. Children have no email and no login: the parent manages them. */
export function ChildForm({
  heading,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
}: {
  heading: string;
  submitLabel: string;
  initial?: { name: string; grade: number };
  onSubmit: (value: { name: string; grade: number }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [grade, setGrade] = useState(initial ? String(initial.grade) : '');
  const [errors, setErrors] = useState<{ name?: string; grade?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'اكتب اسم الطفل.';
    else if (name.trim().length > 80) next.name = 'الاسم طويل (حتى 80 حرفًا).';
    if (!grade) next.grade = 'اختر صف الطفل.';
    setErrors(next);
    if (next.name || next.grade) return;
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), grade: Number(grade) });
      if (!initial) {
        setName('');
        setGrade('');
      }
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'تعذر الحفظ.' });
    }
    setBusy(false);
  }

  return (
    <form className="teacher-form" onSubmit={submit} noValidate>
      <h3>{heading}</h3>
      <div className="teacher-form-grid">
        <div className="auth-field">
          <label htmlFor="child-name">اسم الطفل</label>
          <Input id="child-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'child-name-error' : undefined} />
          {errors.name && <p id="child-name-error" className="auth-error" role="alert">{errors.name}</p>}
        </div>
        <div className="auth-field">
          <label htmlFor="child-grade">الصف</label>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger id="child-grade" aria-invalid={!!errors.grade}><SelectValue placeholder="اختر الصف" /></SelectTrigger>
            <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <SelectItem key={g} value={String(g)}>{gradeLabel(g as Grade)}</SelectItem>)}</SelectContent>
          </Select>
          {errors.grade && <p className="auth-error" role="alert">{errors.grade}</p>}
        </div>
      </div>
      {errors.form && <p className="auth-error" role="alert">{errors.form}</p>}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : initial ? <Check /> : <Plus />}{submitLabel}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>إلغاء</Button>}
      </div>
    </form>
  );
}

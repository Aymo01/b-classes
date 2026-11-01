import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { adminTableSpecs, planTypeLabels, type AdminTable, type Column } from '@/lib/billing/admin-tables';
import { adminDeleteRow, adminListRows, adminSaveRow, type EditorRow } from '@/lib/billing/admin.functions';
import { getPlanCatalog } from '@/lib/billing/billing.functions';
import { formatDateTime, fromLocalInput, toLocalInput } from '@/lib/billing/format';

type Draft = Record<string, string | boolean | string[]>;

/** Editor for one configuration table, generated from its spec. Cards, not a wide table, so phones never scroll sideways. */
export function ConfigTable({ table }: { table: AdminTable }) {
  const spec = adminTableSpecs[table];
  const qc = useQueryClient();
  const { data: rows, isLoading, error } = useQuery({ queryKey: ['admin-rows', table], queryFn: () => adminListRows({ data: { table } }) });
  const { data: catalog } = useQuery({ queryKey: ['plan-catalog'], queryFn: () => getPlanCatalog() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const subjectName = (id: string) => {
    const s = catalog?.subjects.find((x) => x.id === id);
    return s ? `${s.title} (الصف ${s.grade})` : id;
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-rows', table] });
  const save = useMutation({
    mutationFn: (d: Draft) => adminSaveRow({ data: { table, isNew, row: toRow(spec.columns, d) } }),
    onSuccess: () => { setDraft(null); setMessage({ ok: true, text: 'تم الحفظ.' }); void refresh(); void qc.invalidateQueries({ queryKey: ['plan-catalog'] }); },
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });
  const del = useMutation({
    mutationFn: (row: EditorRow) => adminDeleteRow({ data: { table, key: Object.fromEntries(spec.columns.filter((c) => c.pk).map((c) => [c.name, row[c.name] as string | number])) } }),
    onSuccess: () => { setMessage({ ok: true, text: 'تم الحذف.' }); void refresh(); },
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });

  const display = (col: Column, value: EditorRow[string] | undefined) => {
    if (value === null || value === undefined || value === '') return '—';
    if (col.type === 'select') return col.options?.[String(value)] ?? String(value);
    if (col.type === 'bool') return value ? 'نعم' : 'لا';
    if (col.type === 'datetime') return formatDateTime(String(value));
    if (col.type === 'planTypes') return (Array.isArray(value) ? value : []).map((p) => planTypeLabels[p as keyof typeof planTypeLabels] ?? p).join('، ');
    if (col.hint === 'subject') return subjectName(String(value));
    return String(value);
  };

  function startEdit(row: EditorRow | null) {
    setMessage(null);
    setIsNew(row === null);
    setDraft(Object.fromEntries(spec.columns.map((c) => [c.name, toDraftValue(c, row?.[c.name])])));
  }

  return (
    <section className="content-card admin-config" aria-labelledby={`cfg-${table}`}>
      <div className="min-w-0 flex-1">
        <div className="admin-config-head">
          <h2 id={`cfg-${table}`} className="text-lg font-bold">{spec.title}</h2>
          <Button size="sm" onClick={() => startEdit(null)}><Plus />إضافة</Button>
        </div>
        {spec.hint && <p className="quiz-hint">{spec.hint}</p>}
        {message && <p role="status" className={message.ok ? 'mt-2 text-primary' : 'mt-2 text-destructive'}>{message.ok ? 'تم: ' : 'خطأ: '}{message.text}</p>}

        {draft && (
          <form className="teacher-form" noValidate onSubmit={(e) => { e.preventDefault(); setMessage(null); save.mutate(draft); }}>
            <h3>{isNew ? 'إضافة' : 'تعديل'}</h3>
            <div className="teacher-form-grid">
              {spec.columns.filter((c) => !(c.pk && c.type === 'uuid' && c.name === 'id')).map((c) => (
                <Field key={c.name} col={c} value={draft[c.name]} locked={!isNew && !!c.pk} subjects={catalog?.subjects ?? []} onChange={(v) => setDraft((p) => ({ ...(p ?? {}), [c.name]: v }))} />
              ))}
            </div>
            <div className="form-actions">
              <Button type="submit" disabled={save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : null}حفظ</Button>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>إلغاء</Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <p className="mt-3"><Loader2 className="inline animate-spin" /> جارٍ التحميل...</p>
        ) : error ? (
          <p role="alert" className="mt-3 text-destructive">تعذر تحميل البيانات. تأكد من تطبيق ملف الترحيل على قاعدة البيانات.</p>
        ) : (rows ?? []).length === 0 ? (
          <p className="mt-3 text-muted-foreground">لا توجد بيانات بعد.</p>
        ) : (
          <ul className="admin-rows">
            {(rows ?? []).map((row) => (
              <li key={spec.columns.filter((c) => c.pk).map((c) => String(row[c.name])).join('|')} className="admin-row">
                <dl>
                  {spec.columns.filter((c) => !(c.name === 'id')).map((c) => (
                    <div key={c.name}><dt>{c.label}</dt><dd className="break-words">{display(c, row[c.name])}</dd></div>
                  ))}
                </dl>
                <div className="admin-row-actions">
                  <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => startEdit(row)}><Pencil /></Button>
                  <Button variant="ghost" size="icon" aria-label="حذف" disabled={del.isPending} onClick={() => { if (window.confirm('حذف هذا الصف؟')) del.mutate(row); }}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function toDraftValue(col: Column, value: EditorRow[string] | undefined): string | boolean | string[] {
  if (col.type === 'bool') return value === undefined ? col.name === 'active' : Boolean(value);
  if (col.type === 'planTypes') return Array.isArray(value) ? value : [];
  if (col.type === 'datetime') return toLocalInput(typeof value === 'string' ? value : null);
  return value === null || value === undefined ? '' : String(value);
}

function toRow(columns: Column[], draft: Draft) {
  const row: Record<string, unknown> = {};
  for (const c of columns) {
    const v = draft[c.name];
    if (c.type === 'datetime') row[c.name] = typeof v === 'string' ? fromLocalInput(v) : '';
    else row[c.name] = v;
  }
  return row;
}

function Field({ col, value, locked, subjects, onChange }: { col: Column; value: string | boolean | string[] | undefined; locked: boolean; subjects: { id: string; title: string; grade: number }[]; onChange: (v: string | boolean | string[]) => void }) {
  const id = `f-${col.name}`;
  const label = <label htmlFor={id}>{col.label}{col.required ? ' *' : ''}</label>;
  if (col.type === 'bool') {
    return <div className="auth-field admin-check"><Checkbox id={id} checked={value === true} onCheckedChange={(v) => onChange(v === true)} /><label htmlFor={id}>{col.label}</label></div>;
  }
  if (col.type === 'planTypes') {
    const list = Array.isArray(value) ? value : [];
    return (
      <div className="auth-field" role="group" aria-label={col.label}>
        <label>{col.label}{col.required ? ' *' : ''}</label>
        <div className="admin-checks">
          {(Object.keys(planTypeLabels) as (keyof typeof planTypeLabels)[]).map((p) => (
            <span key={p} className="admin-check">
              <Checkbox id={`${id}-${p}`} checked={list.includes(p)} onCheckedChange={(v) => onChange(v === true ? [...list, p] : list.filter((x) => x !== p))} />
              <label htmlFor={`${id}-${p}`}>{planTypeLabels[p]}</label>
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (col.type === 'select' || col.hint === 'subject') {
    const options = col.hint === 'subject' ? Object.fromEntries(subjects.map((s) => [s.id, `${s.title} (الصف ${s.grade})`])) : (col.options ?? {});
    return (
      <div className="auth-field">
        {label}
        <Select value={typeof value === 'string' ? value : ''} onValueChange={onChange} disabled={locked}>
          <SelectTrigger id={id}><SelectValue placeholder="اختر" /></SelectTrigger>
          <SelectContent>{Object.entries(options).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    );
  }
  if (col.type === 'json') {
    return <div className="auth-field">{label}<Textarea id={id} dir="ltr" rows={2} value={typeof value === 'string' ? value : ''} disabled={locked} onChange={(e) => onChange(e.target.value)} /></div>;
  }
  const inputType = col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : col.type === 'datetime' ? 'datetime-local' : 'text';
  return (
    <div className="auth-field">
      {label}
      <Input id={id} type={inputType} step={col.type === 'number' ? 'any' : undefined} min={col.type === 'number' ? 0 : undefined} dir={col.type === 'text' ? undefined : 'ltr'} value={typeof value === 'string' ? value : ''} disabled={locked} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

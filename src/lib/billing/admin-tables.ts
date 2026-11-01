/**
 * The configuration tables an admin edits from the panel. One spec drives the server-side
 * validation and the generic editor in the UI, so adding a field never needs a second change.
 * Row-level security still decides who may write: this only keeps junk columns out.
 */

export type ColumnType = 'text' | 'number' | 'bool' | 'date' | 'datetime' | 'uuid' | 'json' | 'planTypes' | 'select';

export type Column = {
  name: string;
  label: string;
  type: ColumnType;
  /** For 'select': value -> Arabic label. */
  options?: Record<string, string>;
  /** Primary-key columns identify a row; the others are editable fields. */
  pk?: boolean;
  required?: boolean;
  /** Read-only for the editor when editing an existing row (keys). */
  hint?: string;
};

export type TableSpec = {
  table: AdminTable;
  title: string;
  hint?: string;
  columns: Column[];
  orderBy: string;
};

export const ADMIN_TABLES = [
  'full_plan_prices',
  'subject_plan_prices',
  'sibling_discounts',
  'offers',
  'academic_periods',
  'app_settings',
  'live_session_prices',
  'live_slots',
  'units',
] as const;
export type AdminTable = (typeof ADMIN_TABLES)[number];

export const planTypeLabels = { monthly: 'شهري', term: 'فصلي', yearly: 'سنوي' } as const;
export const gradeGroupLabels = {
  'g1-4': 'الصفوف 1–4',
  'g5-8': 'الصفوف 5–8',
  'g9-10': 'الصفوف 9–10',
  'first-secondary': 'الأول الثانوي',
  tawjihi: 'التوجيهي',
} as const;
export const modeLabels = { individual: 'فردية', group: 'جماعية' } as const;

export const adminTableSpecs: Record<AdminTable, TableSpec> = {
  full_plan_prices: {
    table: 'full_plan_prices',
    title: 'أسعار باقة الصف الكامل',
    hint: 'سعر كل مجموعة صفوف لكل نوع اشتراك. الباقة الكاملة تفتح كل مواد صف الطفل.',
    orderBy: 'grade_group',
    columns: [
      { name: 'grade_group', label: 'مجموعة الصفوف', type: 'select', options: gradeGroupLabels, pk: true, required: true },
      { name: 'plan_type', label: 'نوع الاشتراك', type: 'select', options: planTypeLabels, pk: true, required: true },
      { name: 'price', label: 'السعر', type: 'number', required: true },
    ],
  },
  subject_plan_prices: {
    table: 'subject_plan_prices',
    title: 'أسعار المواد المنفردة',
    hint: 'سعر كل مادة (والمادة تتبع صفًا واحدًا) لكل نوع اشتراك.',
    orderBy: 'subject_id',
    columns: [
      { name: 'subject_id', label: 'المادة', type: 'uuid', pk: true, required: true, hint: 'subject' },
      { name: 'plan_type', label: 'نوع الاشتراك', type: 'select', options: planTypeLabels, pk: true, required: true },
      { name: 'price', label: 'السعر', type: 'number', required: true },
    ],
  },
  sibling_discounts: {
    table: 'sibling_discounts',
    title: 'خصم الإخوة',
    hint: 'حسب ترتيب الطفل في حساب ولي الأمر. الترتيب 4 يعني الرابع فأكثر. الطفل الأول بلا خصم.',
    orderBy: 'position',
    columns: [
      { name: 'position', label: 'ترتيب الطفل', type: 'number', pk: true, required: true },
      { name: 'percent', label: 'نسبة الخصم %', type: 'number', required: true },
    ],
  },
  offers: {
    table: 'offers',
    title: 'العروض',
    hint: 'كل عرض له تاريخ بداية ونهاية وأنواع اشتراك مؤهلة، ويُستخدم مرة واحدة لكل ولي أمر. عرض التجديد يخص من اشترك سابقًا.',
    orderBy: 'starts_at',
    columns: [
      { name: 'id', label: 'المعرّف', type: 'uuid', pk: true },
      { name: 'name', label: 'اسم العرض', type: 'text', required: true },
      { name: 'percent', label: 'نسبة الخصم %', type: 'number', required: true },
      { name: 'starts_at', label: 'يبدأ', type: 'datetime', required: true },
      { name: 'ends_at', label: 'ينتهي', type: 'datetime', required: true },
      { name: 'plan_types', label: 'الأنواع المؤهلة', type: 'planTypes', required: true },
      { name: 'renewal_only', label: 'للتجديد فقط', type: 'bool' },
      { name: 'active', label: 'مفعّل', type: 'bool' },
    ],
  },
  academic_periods: {
    table: 'academic_periods',
    title: 'الفصول والسنة الدراسية',
    hint: 'اشتراك الفصل يبدأ وينتهي بتاريخي الفصل، واشتراك السنة بتاريخي السنة الدراسية.',
    orderBy: 'starts_on',
    columns: [
      { name: 'id', label: 'المعرّف', type: 'uuid', pk: true },
      { name: 'kind', label: 'النوع', type: 'select', options: { term: 'فصل', year: 'سنة دراسية' }, required: true },
      { name: 'name', label: 'الاسم', type: 'text', required: true },
      { name: 'starts_on', label: 'البداية', type: 'date', required: true },
      { name: 'ends_on', label: 'النهاية', type: 'date', required: true },
    ],
  },
  app_settings: {
    table: 'app_settings',
    title: 'الإعدادات العامة وإعدادات الإحالة',
    hint: 'promo_cap_percent: سقف العروض والإحالة معًا · referral_percent: خصم الصديق · referral_valid_days: مدة صلاحية رمز الإحالة · expiry_warning_days: أيام التنبيه قبل الانتهاء · live_modes_enabled: أنواع الجلسات المباشرة · currency_label: رمز العملة.',
    orderBy: 'key',
    columns: [
      { name: 'key', label: 'المفتاح', type: 'text', pk: true, required: true },
      { name: 'value', label: 'القيمة (JSON)', type: 'json', required: true },
    ],
  },
  live_session_prices: {
    table: 'live_session_prices',
    title: 'أسعار الجلسات المباشرة',
    hint: 'تُسعَّر الجلسات المباشرة بشكل منفصل عن الاشتراك.',
    orderBy: 'mode',
    columns: [
      { name: 'mode', label: 'النوع', type: 'select', options: modeLabels, pk: true, required: true },
      { name: 'price', label: 'السعر', type: 'number', required: true },
    ],
  },
  live_slots: {
    table: 'live_slots',
    title: 'مواعيد الجلسات المباشرة المتاحة',
    hint: 'مواعيد يختار منها الطالب. المعلم هو معرّف حسابه.',
    orderBy: 'starts_at',
    columns: [
      { name: 'id', label: 'المعرّف', type: 'uuid', pk: true },
      { name: 'teacher_id', label: 'معرّف المعلم', type: 'uuid', required: true },
      { name: 'subject_id', label: 'المادة', type: 'uuid', required: true, hint: 'subject' },
      { name: 'starts_at', label: 'الموعد', type: 'datetime', required: true },
      { name: 'duration_minutes', label: 'المدة (دقيقة)', type: 'number' },
      { name: 'mode', label: 'النوع', type: 'select', options: modeLabels, required: true },
      { name: 'capacity', label: 'السعة', type: 'number' },
    ],
  },
  units: {
    table: 'units',
    title: 'الوحدات',
    hint: 'تنظيم المحتوى: الصف ← المادة ← الوحدة ← الدرس.',
    orderBy: 'subject_id',
    columns: [
      { name: 'id', label: 'المعرّف', type: 'uuid', pk: true },
      { name: 'subject_id', label: 'المادة', type: 'uuid', required: true, hint: 'subject' },
      { name: 'title', label: 'عنوان الوحدة', type: 'text', required: true },
      { name: 'order_index', label: 'الترتيب', type: 'number' },
    ],
  },
};

export const isAdminTable = (value: unknown): value is AdminTable => typeof value === 'string' && (ADMIN_TABLES as readonly string[]).includes(value);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD that is a real calendar day (Date.parse alone accepts 2026-02-30). */
function isRealDate(value: string) {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Turns the editor's values into a database row, or explains what is wrong. Unknown columns are
 * dropped, empty optional fields are left out so the database default applies.
 */
export function coerceRow(spec: TableSpec, input: Record<string, unknown>, mode: 'insert' | 'update'): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const row: Record<string, unknown> = {};
  for (const col of spec.columns) {
    const raw = input[col.name];
    const empty = raw === undefined || raw === null || raw === '';
    if (empty) {
      if (col.required && !(col.pk && col.type === 'uuid' && mode === 'insert')) return { ok: false, error: `الحقل «${col.label}» مطلوب.` };
      continue;
    }
    switch (col.type) {
      case 'text':
        if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > 200) return { ok: false, error: `«${col.label}» غير صالح.` };
        row[col.name] = raw.trim();
        break;
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(n) || n < 0) return { ok: false, error: `«${col.label}» يجب أن يكون رقمًا صفرًا أو أكبر.` };
        row[col.name] = n;
        break;
      }
      case 'bool':
        row[col.name] = raw === true || raw === 'true';
        break;
      case 'date':
        if (typeof raw !== 'string' || !isRealDate(raw)) return { ok: false, error: `«${col.label}» تاريخ غير صالح.` };
        row[col.name] = raw;
        break;
      case 'datetime': {
        const t = typeof raw === 'string' ? Date.parse(raw) : NaN;
        if (Number.isNaN(t)) return { ok: false, error: `«${col.label}» تاريخ ووقت غير صالح.` };
        row[col.name] = new Date(t).toISOString();
        break;
      }
      case 'uuid':
        if (typeof raw !== 'string' || !UUID.test(raw)) return { ok: false, error: `«${col.label}» معرّف غير صالح.` };
        row[col.name] = raw;
        break;
      case 'select':
        if (typeof raw !== 'string' || !col.options || !(raw in col.options)) return { ok: false, error: `«${col.label}» قيمة غير صالحة.` };
        row[col.name] = raw;
        break;
      case 'planTypes': {
        const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',').map((s) => s.trim()).filter(Boolean) : null;
        if (!list || list.length === 0 || !list.every((p) => p === 'monthly' || p === 'term' || p === 'yearly')) return { ok: false, error: `«${col.label}» اختر نوعًا واحدًا على الأقل.` };
        row[col.name] = [...new Set(list)];
        break;
      }
      case 'json':
        try {
          row[col.name] = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return { ok: false, error: `«${col.label}» ليس JSON صحيحًا.` };
        }
        break;
    }
  }
  // Percentages stay between 0 and 100 whatever the table.
  for (const key of ['percent'] as const) {
    const v = row[key];
    if (typeof v === 'number' && v > 100) return { ok: false, error: 'النسبة يجب ألا تزيد عن 100.' };
  }
  return { ok: true, row };
}

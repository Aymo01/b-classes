import { createServerFn } from '@tanstack/react-start';
import { requireApprovedMember } from '@/lib/access/middleware';
import { canTransition, isLiveMode, type LiveMode, type LiveStatus } from './live';
import { assertAdmin, loadSettings, serviceClient, untyped } from './server';

type Row = Record<string, unknown>;
const FAILED = 'تعذر تنفيذ الطلب. حاول مرة أخرى.';
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

export type LiveOptionsDTO = {
  modes: LiveMode[];
  prices: Partial<Record<LiveMode, number>>;
  currencyLabel: string;
  teachers: { id: string; name: string }[];
  subjects: { id: string; title: string; grade: number }[];
  slots: { id: string; teacherId: string; subjectId: string; startsAt: string; durationMinutes: number; mode: LiveMode; free: number }[];
};

/** Names of teachers only (the user_roles and profiles tables are not readable by parents). */
async function teacherNames() {
  const svc = await serviceClient();
  const { data: roles } = await svc.from('user_roles').select('user_id').eq('role', 'teacher');
  const ids = (roles ?? []).map((r: Row) => String(r['user_id']));
  if (ids.length === 0) return [] as { id: string; name: string }[];
  const { data: profiles } = await svc.from('profiles').select('id, display_name').in('id', ids);
  return (profiles ?? []).map((p: Row) => ({ id: String(p['id']), name: String(p['display_name'] ?? 'معلم') }));
}

export const getLiveOptions = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<LiveOptionsDTO> => {
    const db = untyped(context.supabase);
    const settings = await loadSettings(db);
    const [prices, subjects, slots, teachers] = await Promise.all([
      db.from('live_session_prices').select('mode, price'),
      db.from('subjects').select('id, title, grade').order('grade').order('title'),
      db.from('live_slots').select('id, teacher_id, subject_id, starts_at, duration_minutes, mode, capacity').gt('starts_at', new Date().toISOString()).order('starts_at').limit(100),
      teacherNames(),
    ]);
    const svc = await serviceClient();
    const slotIds = (slots.data ?? []).map((s: Row) => String(s['id']));
    const { data: taken } = slotIds.length ? await svc.from('live_sessions').select('slot_id').in('slot_id', slotIds).neq('status', 'cancelled') : { data: [] as Row[] };
    const used = new Map<string, number>();
    for (const t of taken ?? []) used.set(String(t['slot_id']), (used.get(String(t['slot_id'])) ?? 0) + 1);
    return {
      modes: settings.liveModes,
      prices: Object.fromEntries((prices.data ?? []).filter((p: Row) => isLiveMode(p['mode'])).map((p: Row) => [p['mode'] as LiveMode, Number(p['price'])])),
      currencyLabel: settings.currencyLabel,
      teachers,
      subjects: (subjects.data ?? []).map((s: Row) => ({ id: String(s['id']), title: String(s['title']), grade: Number(s['grade']) })),
      slots: (slots.data ?? [])
        .filter((s: Row) => settings.liveModes.includes(s['mode'] as LiveMode))
        .map((s: Row) => ({
          id: String(s['id']),
          teacherId: String(s['teacher_id']),
          subjectId: String(s['subject_id']),
          startsAt: String(s['starts_at']),
          durationMinutes: Number(s['duration_minutes']),
          mode: s['mode'] as LiveMode,
          free: Math.max(0, Number(s['capacity']) - (used.get(String(s['id'])) ?? 0)),
        }))
        .filter((s: { free: number }) => s.free > 0),
    };
  });

export type LiveSessionDTO = {
  id: string;
  childName: string;
  subjectTitle: string;
  teacherName: string | null;
  mode: LiveMode;
  status: LiveStatus;
  requestedAt: string;
  proposedAt: string | null;
  price: number;
  note: string | null;
};

async function describeSessions(rows: Row[]): Promise<LiveSessionDTO[]> {
  const svc = await serviceClient();
  const childIds = [...new Set(rows.map((r) => String(r['child_id'])))];
  const subjectIds = [...new Set(rows.map((r) => String(r['subject_id'])))];
  const [children, subjects, teachers] = await Promise.all([
    childIds.length ? svc.from('children').select('id, name').in('id', childIds) : Promise.resolve({ data: [] as Row[] }),
    subjectIds.length ? svc.from('subjects').select('id, title').in('id', subjectIds) : Promise.resolve({ data: [] as Row[] }),
    teacherNames(),
  ]);
  const childName = new Map<string, string>((children.data ?? []).map((c: Row) => [String(c['id']), String(c['name'])]));
  const subjectTitle = new Map<string, string>((subjects.data ?? []).map((s: Row) => [String(s['id']), String(s['title'])]));
  const teacherName = new Map(teachers.map((t) => [t.id, t.name]));
  return rows.map((r) => ({
    id: String(r['id']),
    childName: childName.get(String(r['child_id'])) ?? '—',
    subjectTitle: subjectTitle.get(String(r['subject_id'])) ?? '—',
    teacherName: r['teacher_id'] ? (teacherName.get(String(r['teacher_id'])) ?? null) : null,
    mode: r['mode'] as LiveMode,
    status: r['status'] as LiveStatus,
    requestedAt: String(r['requested_at']),
    proposedAt: (r['proposed_at'] as string | null) ?? null,
    price: Number(r['price']),
    note: (r['note'] as string | null) ?? null,
  }));
}

const SESSION_COLUMNS = 'id, child_id, subject_id, teacher_id, mode, requested_at, proposed_at, status, price, note';

export const listMyLiveSessions = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<LiveSessionDTO[]> => {
    const db = untyped(context.supabase);
    const { data } = await db.from('live_sessions').select(SESSION_COLUMNS).eq('parent_id', context.userId).order('requested_at', { ascending: false }).limit(100);
    return describeSessions(data ?? []);
  });

type RequestInput = { childId: string; subjectId: string; mode: LiveMode; teacherId: string | null; slotId: string | null; requestedAt: string | null; note: string | null };

/** Student picks a subject and teacher and either an open slot or a time of their own. */
export const requestLiveSession = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: Record<string, unknown>): RequestInput => {
    const { childId, subjectId, mode } = input;
    if (!isId(childId) || !isId(subjectId) || !isLiveMode(mode)) throw new Error('اختر الطفل والمادة ونوع الجلسة.');
    const slotId = isId(input['slotId']) ? (input['slotId'] as string) : null;
    const teacherId = isId(input['teacherId']) ? (input['teacherId'] as string) : null;
    let requestedAt: string | null = null;
    if (!slotId) {
      const t = typeof input['requestedAt'] === 'string' ? Date.parse(input['requestedAt'] as string) : NaN;
      if (Number.isNaN(t) || t <= Date.now()) throw new Error('اختر موعدًا في المستقبل أو اختر من المواعيد المتاحة.');
      requestedAt = new Date(t).toISOString();
    }
    const note = typeof input['note'] === 'string' && input['note'].trim() ? (input['note'] as string).trim().slice(0, 500) : null;
    return { childId, subjectId, mode, teacherId, slotId, requestedAt, note };
  })
  .handler(async ({ data, context }) => {
    const db = untyped(context.supabase);
    const svc = await serviceClient();
    const settings = await loadSettings(db);
    if (!settings.liveModes.includes(data.mode)) throw new Error('هذا النوع من الجلسات غير متاح حاليًا.');

    const { data: child } = await db.from('children').select('id, grade').eq('id', data.childId).eq('parent_id', context.userId).is('archived_at', null).maybeSingle();
    if (!child) throw new Error(FAILED);
    const { data: subject } = await db.from('subjects').select('id, grade').eq('id', data.subjectId).maybeSingle();
    if (!subject || Number(subject['grade']) !== Number(child['grade'])) throw new Error('هذه المادة ليست من صف الطفل.');

    const { data: priceRow } = await db.from('live_session_prices').select('price').eq('mode', data.mode).maybeSingle();
    if (!priceRow) throw new Error('لم يحدد المشرف سعر هذا النوع من الجلسات بعد.');

    let requestedAt = data.requestedAt;
    let teacherId = data.teacherId;
    if (data.slotId) {
      const { data: slot } = await db.from('live_slots').select('id, teacher_id, subject_id, starts_at, mode, capacity').eq('id', data.slotId).maybeSingle();
      if (!slot || String(slot['subject_id']) !== data.subjectId || slot['mode'] !== data.mode || Date.parse(String(slot['starts_at'])) <= Date.now()) throw new Error('هذا الموعد لم يعد متاحًا.');
      const { count } = await svc.from('live_sessions').select('id', { count: 'exact', head: true }).eq('slot_id', data.slotId).neq('status', 'cancelled');
      if ((count ?? 0) >= Number(slot['capacity'])) throw new Error('امتلأ هذا الموعد.');
      requestedAt = String(slot['starts_at']);
      teacherId = String(slot['teacher_id']);
    }
    const { error } = await svc.from('live_sessions').insert({
      parent_id: context.userId,
      child_id: data.childId,
      subject_id: data.subjectId,
      teacher_id: teacherId,
      mode: data.mode,
      slot_id: data.slotId,
      requested_at: requestedAt,
      price: Number(priceRow['price']),
      note: data.note,
    });
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

/** Parent answers the admin's proposed time: accepting makes it the session time. */
export const respondToLiveProposal = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { id: string; accept: boolean }) => {
    if (!isId(input.id) || typeof input.accept !== 'boolean') throw new Error(FAILED);
    return input;
  })
  .handler(async ({ data, context }) => {
    const svc = await serviceClient();
    const { data: s } = await svc.from('live_sessions').select('id, status, proposed_at').eq('id', data.id).eq('parent_id', context.userId).maybeSingle();
    if (!s || s['status'] !== 'pending' || !s['proposed_at']) throw new Error(FAILED);
    const patch = data.accept ? { status: 'accepted', requested_at: s['proposed_at'], proposed_at: null } : { status: 'cancelled', proposed_at: null };
    const { error } = await svc.from('live_sessions').update(patch).eq('id', data.id);
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

export const cancelMyLiveSession = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { id: string }) => {
    if (!isId(input.id)) throw new Error(FAILED);
    return input;
  })
  .handler(async ({ data, context }) => {
    const svc = await serviceClient();
    const { data: s } = await svc.from('live_sessions').select('status').eq('id', data.id).eq('parent_id', context.userId).maybeSingle();
    if (!s || !canTransition(s['status'] as LiveStatus, 'cancelled')) throw new Error(FAILED);
    await svc.from('live_sessions').update({ status: 'cancelled', proposed_at: null }).eq('id', data.id);
    return { ok: true };
  });

/* ------------------------------------------------------------------ admin */

export const adminListLiveSessions = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<LiveSessionDTO[]> => {
    assertAdmin(context.access.roles);
    const svc = await serviceClient();
    const { data } = await svc.from('live_sessions').select(SESSION_COLUMNS).order('requested_at', { ascending: false }).limit(200);
    return describeSessions(data ?? []);
  });

/** Accept as asked, propose another time, change mode/teacher, complete or cancel. */
export const adminHandleLiveSession = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { id: string; action: 'accept' | 'propose' | 'complete' | 'cancel'; proposedAt?: string | null; teacherId?: string | null; mode?: LiveMode | null }) => {
    if (!isId(input.id) || !['accept', 'propose', 'complete', 'cancel'].includes(input.action)) throw new Error(FAILED);
    let proposedAt: string | null = null;
    if (input.action === 'propose') {
      const t = input.proposedAt ? Date.parse(input.proposedAt) : NaN;
      if (Number.isNaN(t) || t <= Date.now()) throw new Error('اختر موعدًا مقترحًا في المستقبل.');
      proposedAt = new Date(t).toISOString();
    }
    return { id: input.id, action: input.action, proposedAt, teacherId: isId(input.teacherId) ? input.teacherId : null, mode: isLiveMode(input.mode) ? input.mode : null };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    const svc = await serviceClient();
    const { data: s } = await svc.from('live_sessions').select('status').eq('id', data.id).maybeSingle();
    if (!s) throw new Error(FAILED);
    const from = s['status'] as LiveStatus;
    const to: LiveStatus = data.action === 'accept' ? 'accepted' : data.action === 'complete' ? 'completed' : data.action === 'cancel' ? 'cancelled' : 'pending';
    if (data.action !== 'propose' && !canTransition(from, to)) throw new Error('لا يمكن تغيير الحالة بهذا الشكل.');
    if (data.action === 'propose' && from !== 'pending') throw new Error('يمكن اقتراح موعد آخر للطلبات المعلّقة فقط.');
    const patch: Row = { status: to };
    if (data.action === 'propose') patch['proposed_at'] = data.proposedAt;
    if (data.action === 'accept') patch['proposed_at'] = null;
    if (data.teacherId) patch['teacher_id'] = data.teacherId;
    if (data.mode) patch['mode'] = data.mode;
    const { error } = await svc.from('live_sessions').update(patch).eq('id', data.id);
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

import { createServerFn } from '@tanstack/react-start';
import { requireApprovedMember } from '@/lib/access/middleware';
import { adminTableSpecs, coerceRow, isAdminTable, type AdminTable } from './admin-tables';
import { expiryState, planWindow, type ExpiryState } from './subscription';
import type { PlanType } from './pricing';
import { assertAdmin, loadPeriods, loadSettings, serviceClient, untyped } from './server';

type Row = Record<string, unknown>;
export type EditorRow = Record<string, string | number | boolean | null | string[]>;
const FAILED = 'تعذر تنفيذ الطلب. حاول مرة أخرى.';
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

/* ------------------------------------------------------------------ configuration tables */

export const adminListRows = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { table: string }) => {
    if (!isAdminTable(input.table)) throw new Error(FAILED);
    return { table: input.table as AdminTable };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    const spec = adminTableSpecs[data.table];
    const { data: rows, error } = await untyped(context.supabase).from(spec.table).select('*').order(spec.orderBy).limit(500);
    if (error) throw new Error(FAILED);
    // JSON columns travel as text so the row is always plain, serialisable values.
    return (rows ?? []).map((r: Row): EditorRow => {
      const out: EditorRow = {};
      for (const col of spec.columns) {
        const v = r[col.name];
        out[col.name] = col.type === 'json' ? JSON.stringify(v) : (v as EditorRow[string]) ?? null;
      }
      return out;
    });
  });

export const adminSaveRow = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { table: string; row: Record<string, unknown>; isNew: boolean }) => {
    if (!isAdminTable(input.table)) throw new Error(FAILED);
    const spec = adminTableSpecs[input.table as AdminTable];
    const coerced = coerceRow(spec, input.row ?? {}, input.isNew ? 'insert' : 'update');
    if (!coerced.ok) throw new Error(coerced.error);
    return { table: input.table as AdminTable, row: coerced.row, isNew: Boolean(input.isNew) };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    const spec = adminTableSpecs[data.table];
    const db = untyped(context.supabase);
    const pk = spec.columns.filter((c) => c.pk).map((c) => c.name);
    const keyed = pk.every((k) => data.row[k] !== undefined);
    // Writes go through the admin's own client, so row-level security is the real gate.
    // Tables keyed by a database-generated id (offers, periods, slots, units) insert when the id is absent.
    const { error } = await (keyed ? db.from(spec.table).upsert(data.row, { onConflict: pk.join(',') }) : db.from(spec.table).insert(data.row));
    if (error) throw new Error('تعذر الحفظ. تأكد من القيم (التواريخ، النسب، المعرّفات) وحاول مجددًا.');
    return { ok: true };
  });

export const adminDeleteRow = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { table: string; key: Record<string, unknown> }) => {
    if (!isAdminTable(input.table)) throw new Error(FAILED);
    const spec = adminTableSpecs[input.table as AdminTable];
    const pk = spec.columns.filter((c) => c.pk).map((c) => c.name);
    const key: Record<string, string> = {};
    for (const k of pk) {
      const v = input.key?.[k];
      if (typeof v !== 'string' && typeof v !== 'number') throw new Error(FAILED);
      key[k] = String(v);
    }
    return { table: input.table as AdminTable, key };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    let q = untyped(context.supabase).from(adminTableSpecs[data.table].table).delete();
    for (const [k, v] of Object.entries(data.key)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

/* ------------------------------------------------------------------ people, subscriptions, reports */

export type AdminSubscriptionDTO = {
  id: string;
  parentId: string;
  parentEmail: string;
  childName: string;
  grade: number;
  planType: PlanType;
  scope: 'grade' | 'subject';
  subjectTitle: string | null;
  status: 'pending' | 'active' | 'cancelled';
  state: ExpiryState;
  startsAt: string;
  endsAt: string;
  listPrice: number;
  discountPercent: number;
  finalPrice: number;
  createdAt: string;
  activatedAt: string | null;
};

export type AdminOverviewDTO = {
  currencyLabel: string;
  counts: { parents: number; children: number; activeSubscribers: number; activeSubscriptions: number; expiring: number; expired: number; pending: number };
  revenue: { total: number; pendingValue: number; byMonth: { month: string; amount: number }[]; byPlan: { planType: PlanType; amount: number }[] };
  parents: { id: string; email: string; name: string; createdAt: string; children: { name: string; grade: number; position: number }[] }[];
  subscriptions: AdminSubscriptionDTO[];
  expiryWarningDays: number;
};

export const adminOverview = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<AdminOverviewDTO> => {
    assertAdmin(context.access.roles);
    const svc = await serviceClient();
    const settings = await loadSettings(svc);
    // Keep expiry notifications current for parents (idempotent).
    await svc.rpc('notify_subscription_expiry', { _days: settings.expiryWarningDays }).then(() => undefined, () => undefined);

    const [users, roles, profiles, children, subs, subjects] = await Promise.all([
      svc.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      svc.from('user_roles').select('user_id, role'),
      svc.from('profiles').select('id, display_name'),
      svc.from('children').select('id, parent_id, name, grade, position, archived_at'),
      svc.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(2000),
      svc.from('subjects').select('id, title'),
    ]);
    const emailOf = new Map<string, { email: string; createdAt: string }>((users.data?.users ?? []).map((u) => [u.id, { email: u.email ?? '—', createdAt: u.created_at }]));
    const nameOf = new Map<string, string>((profiles.data ?? []).map((p: Row) => [String(p['id']), String(p['display_name'] ?? '')]));
    const parentIds = new Set<string>((roles.data ?? []).filter((r: Row) => r['role'] === 'parent').map((r: Row) => String(r['user_id'])));
    const allChildren: Row[] = children.data ?? [];
    const childById = new Map<string, Row>(allChildren.map((c) => [String(c['id']), c]));
    const subjectTitle = new Map<string, string>((subjects.data ?? []).map((s: Row) => [String(s['id']), String(s['title'])]));
    const now = new Date();

    const subscriptions: AdminSubscriptionDTO[] = (subs.data ?? []).map((r: Row) => {
      const child = childById.get(String(r['child_id']));
      const status = r['status'] as AdminSubscriptionDTO['status'];
      return {
        id: String(r['id']),
        parentId: String(r['parent_id']),
        parentEmail: emailOf.get(String(r['parent_id']))?.email ?? '—',
        childName: child ? String(child['name']) : '—',
        grade: child ? Number(child['grade']) : 0,
        planType: r['plan_type'] as PlanType,
        scope: r['scope'] as 'grade' | 'subject',
        subjectTitle: r['subject_id'] ? (subjectTitle.get(String(r['subject_id'])) ?? null) : null,
        status,
        state: expiryState({ status, startsAt: String(r['starts_at']), endsAt: String(r['ends_at']) }, now, settings.expiryWarningDays),
        startsAt: String(r['starts_at']),
        endsAt: String(r['ends_at']),
        listPrice: Number(r['list_price']),
        discountPercent: Number(r['discount_percent']),
        finalPrice: Number(r['final_price']),
        createdAt: String(r['created_at']),
        activatedAt: (r['activated_at'] as string | null) ?? null,
      };
    });

    const live = subscriptions.filter((s) => s.state === 'active' || s.state === 'expiring');
    const monthly = new Map<string, number>();
    const byPlan = new Map<PlanType, number>();
    let total = 0;
    let pendingValue = 0;
    for (const s of subscriptions) {
      if (s.status === 'pending') pendingValue += s.finalPrice;
      if (s.status !== 'active') continue;
      total += s.finalPrice;
      const month = (s.activatedAt ?? s.createdAt).slice(0, 7);
      monthly.set(month, (monthly.get(month) ?? 0) + s.finalPrice);
      byPlan.set(s.planType, (byPlan.get(s.planType) ?? 0) + s.finalPrice);
    }
    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      currencyLabel: settings.currencyLabel,
      expiryWarningDays: settings.expiryWarningDays,
      counts: {
        parents: parentIds.size,
        children: allChildren.filter((c) => !c['archived_at']).length,
        activeSubscribers: new Set(live.map((s) => s.parentId)).size,
        activeSubscriptions: live.length,
        expiring: subscriptions.filter((s) => s.state === 'expiring').length,
        expired: subscriptions.filter((s) => s.state === 'expired').length,
        pending: subscriptions.filter((s) => s.status === 'pending').length,
      },
      revenue: {
        total: round(total),
        pendingValue: round(pendingValue),
        byMonth: [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount: round(amount) })),
        byPlan: [...byPlan].map(([planType, amount]) => ({ planType, amount: round(amount) })),
      },
      parents: [...parentIds].map((id) => ({
        id,
        email: emailOf.get(id)?.email ?? '—',
        name: nameOf.get(id) ?? '',
        createdAt: emailOf.get(id)?.createdAt ?? '',
        children: allChildren.filter((c) => c['parent_id'] === id && !c['archived_at']).sort((a, b) => Number(a['position']) - Number(b['position'])).map((c) => ({ name: String(c['name']), grade: Number(c['grade']), position: Number(c['position']) })),
      })),
      subscriptions,
    };
  });

/** Activate (after payment is confirmed outside the app) or cancel a subscription. */
export const adminSetSubscriptionStatus = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { id: string; status: 'active' | 'cancelled' }) => {
    if (!isId(input.id) || (input.status !== 'active' && input.status !== 'cancelled')) throw new Error(FAILED);
    return input;
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.access.roles);
    const svc = await serviceClient();
    const { data: s } = await svc.from('subscriptions').select('id, status, plan_type, starts_at, ends_at').eq('id', data.id).maybeSingle();
    if (!s) throw new Error(FAILED);
    const patch: Row = { status: data.status };
    if (data.status === 'active') {
      patch['activated_at'] = new Date().toISOString();
      // A monthly plan counts from the day it is activated; terms and years keep their set dates.
      if (s['plan_type'] === 'monthly' && s['status'] === 'pending') {
        const w = planWindow('monthly', new Date(), await loadPeriods(svc));
        if (w) {
          patch['starts_at'] = w.startsAt.toISOString();
          patch['ends_at'] = w.endsAt.toISOString();
        }
      }
    }
    const { error } = await svc.from('subscriptions').update(patch).eq('id', data.id);
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

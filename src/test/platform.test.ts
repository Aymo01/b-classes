import { describe, expect, it } from 'vitest';
import { adminTableSpecs, coerceRow } from '@/lib/billing/admin-tables';
import { resolveAccess } from '@/lib/access/policy';
import { getAccessRepository } from '@/lib/access';
import { createMockAccessRepository } from '@/lib/access/mock-repository';

const base = { email: 'mum@example.com', isAdmin: false, teacher: null, allowlistRole: null };

describe('free parent sign-up', () => {
  it('a signed-in parent holding the parent role is approved', () => {
    expect(resolveAccess({ ...base, roles: ['parent'] })).toMatchObject({ status: 'approved', roles: ['parent'] });
  });
  it('a user with no stored role is still pending', () => {
    expect(resolveAccess({ ...base, roles: [] }).status).toBe('pending');
  });
  it('a stored teacher role does not count unless the issued school email is the one signed in', () => {
    expect(resolveAccess({ ...base, roles: ['teacher'] }).status).toBe('pending');
    const teacher = { id: 't', userId: 'u', schoolEmail: 'ali@school.edu', lastSignInAt: null, createdAt: '' };
    expect(resolveAccess({ ...base, email: 'ali@school.edu', teacher, roles: ['teacher'] }).roles).toEqual(['teacher']);
  });
  it('a stored admin role counts', () => {
    expect(resolveAccess({ ...base, roles: ['admin'] }).roles).toEqual(['admin']);
  });
});

describe('data source', () => {
  const fakeClient = {} as never;
  it('uses the database unless the mock is asked for explicitly', () => {
    const before = process.env['ACCESS_DATA_SOURCE'];
    try {
      delete process.env['ACCESS_DATA_SOURCE'];
      const dbRepo = getAccessRepository(fakeClient);
      expect(dbRepo).not.toBe(getAccessRepository(fakeClient)); // a fresh database repository, not the cached mock
      process.env['ACCESS_DATA_SOURCE'] = 'mock';
      expect(getAccessRepository(fakeClient)).toBe(getAccessRepository(fakeClient)); // the shared in-memory mock
    } finally {
      if (before === undefined) delete process.env['ACCESS_DATA_SOURCE'];
      else process.env['ACCESS_DATA_SOURCE'] = before;
    }
  });
  it('the mock repository still works for offline tests', async () => {
    expect((await createMockAccessRepository().listTeachers()).length).toBeGreaterThan(0);
  });
});

describe('admin configuration rows', () => {
  it('accepts a valid price row', () => {
    const r = coerceRow(adminTableSpecs.full_plan_prices, { grade_group: 'g5-8', plan_type: 'monthly', price: '12.5', evil: 'x' }, 'insert');
    expect(r).toEqual({ ok: true, row: { grade_group: 'g5-8', plan_type: 'monthly', price: 12.5 } });
  });
  it('rejects negative or non-numeric prices and unknown choices', () => {
    expect(coerceRow(adminTableSpecs.full_plan_prices, { grade_group: 'g5-8', plan_type: 'monthly', price: -1 }, 'insert').ok).toBe(false);
    expect(coerceRow(adminTableSpecs.full_plan_prices, { grade_group: 'g5-8', plan_type: 'monthly', price: 'abc' }, 'insert').ok).toBe(false);
    expect(coerceRow(adminTableSpecs.full_plan_prices, { grade_group: 'nope', plan_type: 'monthly', price: 1 }, 'insert').ok).toBe(false);
    expect(coerceRow(adminTableSpecs.full_plan_prices, { grade_group: 'g5-8', plan_type: 'monthly' }, 'insert').ok).toBe(false);
  });
  it('keeps discount percentages within 100', () => {
    expect(coerceRow(adminTableSpecs.sibling_discounts, { position: 2, percent: 101 }, 'insert').ok).toBe(false);
    expect(coerceRow(adminTableSpecs.sibling_discounts, { position: 2, percent: 10 }, 'insert').ok).toBe(true);
  });
  it('an offer needs dates and at least one eligible plan type', () => {
    const ok = coerceRow(adminTableSpecs.offers, { name: 'Launch', percent: 10, starts_at: '2026-09-01T00:00', ends_at: '2026-09-30T00:00', plan_types: ['monthly', 'term'], renewal_only: false, active: true }, 'insert');
    expect(ok.ok).toBe(true);
    expect(coerceRow(adminTableSpecs.offers, { name: 'x', percent: 10, starts_at: '2026-09-01T00:00', ends_at: '2026-09-30T00:00', plan_types: [] }, 'insert').ok).toBe(false);
    expect(coerceRow(adminTableSpecs.offers, { name: 'x', percent: 10, starts_at: 'not a date', ends_at: '2026-09-30T00:00', plan_types: ['monthly'] }, 'insert').ok).toBe(false);
    expect(coerceRow(adminTableSpecs.offers, { name: 'x', percent: 10, starts_at: '2026-09-01T00:00', ends_at: '2026-09-30T00:00', plan_types: ['weekly'] }, 'insert').ok).toBe(false);
  });
  it('term and year periods take real dates', () => {
    expect(coerceRow(adminTableSpecs.academic_periods, { kind: 'term', name: 'الفصل الأول', starts_on: '2026-09-01', ends_on: '2027-01-15' }, 'insert').ok).toBe(true);
    expect(coerceRow(adminTableSpecs.academic_periods, { kind: 'term', name: 'x', starts_on: '2026-02-30', ends_on: '2027-01-15' }, 'insert').ok).toBe(false);
  });
  it('settings accept JSON values only', () => {
    expect(coerceRow(adminTableSpecs.app_settings, { key: 'referral_percent', value: '5' }, 'update')).toMatchObject({ ok: true, row: { value: 5 } });
    expect(coerceRow(adminTableSpecs.app_settings, { key: 'k', value: '{broken' }, 'update').ok).toBe(false);
  });
});

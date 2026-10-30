import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { requireApprovedMember } from '@/lib/access/middleware';
import { cleanItemTitle, isDueDate } from '@/lib/study-plan';

export type StudyPlanItemDTO = {
  id: string;
  title: string;
  lessonId: string | null;
  lessonTitle: string | null;
  dueDate: string | null;
  done: boolean;
};
export type StudyPlanDTO = { id: string; title: string; items: StudyPlanItemDTO[] };

const FAILED = 'تعذر تنفيذ الطلب. حاول مرة أخرى.';
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;

type Client = SupabaseClient<Database>;

async function loadItems(supabase: Client, planId: string): Promise<StudyPlanItemDTO[]> {
  const { data: rows } = await supabase
    .from('study_plan_items')
    .select('id, title, lesson_id, due_date, done')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });
  const lessonIds = [...new Set((rows ?? []).map((r) => r.lesson_id).filter((id): id is string => !!id))];
  const { data: lessons } = lessonIds.length
    ? await supabase.from('lessons').select('id, title').in('id', lessonIds)
    : { data: [] as { id: string; title: string }[] };
  const lessonTitles = new Map((lessons ?? []).map((l) => [l.id, l.title]));
  return (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    lessonId: r.lesson_id,
    lessonTitle: r.lesson_id ? (lessonTitles.get(r.lesson_id) ?? null) : null,
    dueDate: r.due_date,
    done: r.done,
  }));
}

/** The signed-in student's plan; created on first use. */
export const getMyStudyPlan = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<StudyPlanDTO> => {
    const { supabase, userId } = context;
    let { data: plan } = await supabase.from('study_plans').select('id, title').eq('student_id', userId).maybeSingle();
    if (!plan) {
      const created = await supabase.from('study_plans').insert({ student_id: userId }).select('id, title').single();
      if (created.error) {
        // Lost a race with another request: the unique student_id means the plan exists now.
        const existing = await supabase.from('study_plans').select('id, title').eq('student_id', userId).maybeSingle();
        plan = existing.data;
      } else {
        plan = created.data;
      }
    }
    if (!plan) throw new Error(FAILED);
    return { id: plan.id, title: plan.title, items: await loadItems(supabase, plan.id) };
  });

export const addStudyPlanItem = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { title: string; dueDate?: string | null; lessonId?: string | null }) => {
    const title = cleanItemTitle(input.title);
    if (!title) throw new Error('اكتب عنوانًا من 1 إلى 200 حرف.');
    const dueDate = input.dueDate ? input.dueDate : null;
    if (dueDate !== null && !isDueDate(dueDate)) throw new Error('تاريخ الاستحقاق غير صحيح.');
    const lessonId = input.lessonId ? input.lessonId : null;
    if (lessonId !== null && !isId(lessonId)) throw new Error(FAILED);
    return { title, dueDate, lessonId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase.from('study_plans').select('id').eq('student_id', userId).maybeSingle();
    if (!plan) throw new Error(FAILED);
    const { error } = await supabase
      .from('study_plan_items')
      .insert({ plan_id: plan.id, title: data.title, due_date: data.dueDate, lesson_id: data.lessonId });
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

export const toggleStudyPlanItem = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { itemId: string; done: boolean }) => {
    if (!isId(input.itemId) || typeof input.done !== 'boolean') throw new Error(FAILED);
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase.from('study_plans').select('id').eq('student_id', userId).maybeSingle();
    if (!plan) throw new Error(FAILED);
    const { error } = await supabase.from('study_plan_items').update({ done: data.done }).eq('id', data.itemId).eq('plan_id', plan.id);
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

export const deleteStudyPlanItem = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { itemId: string }) => {
    if (!isId(input.itemId)) throw new Error(FAILED);
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase.from('study_plans').select('id').eq('student_id', userId).maybeSingle();
    if (!plan) throw new Error(FAILED);
    const { error } = await supabase.from('study_plan_items').delete().eq('id', data.itemId).eq('plan_id', plan.id);
    if (error) throw new Error(FAILED);
    return { ok: true };
  });

/** A linked child's plan, read-only. Returns nothing unless a parent_links row exists. */
export const getChildStudyPlan = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { studentId: string }) => {
    if (!isId(input.studentId)) throw new Error(FAILED);
    return input;
  })
  .handler(async ({ data, context }): Promise<StudyPlanDTO | null> => {
    const { supabase, userId } = context;
    const { data: link } = await supabase
      .from('parent_links')
      .select('id')
      .eq('parent_id', userId)
      .eq('student_id', data.studentId)
      .maybeSingle();
    if (!link) throw new Error('Forbidden');
    const { data: plan } = await supabase.from('study_plans').select('id, title').eq('student_id', data.studentId).maybeSingle();
    if (!plan) return null;
    return { id: plan.id, title: plan.title, items: await loadItems(supabase, plan.id) };
  });

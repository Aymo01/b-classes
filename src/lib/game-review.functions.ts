import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireApprovedMember } from '@/lib/access/middleware';
import { parseGeneratedItems, validatePayload, type ItemKind, type ItemStatus, type Json } from '@/lib/games/rules';

// Teachers and admins only. These run under the signed-in user, so the table's own policy ("teachers manage game
// items") is a second lock: a student session cannot read or change a draft even if this check were skipped.
type Db = SupabaseClient;
const db = (client: unknown) => client as Db;

async function assertEditor(client: Db, userId: string) {
  const [teacher, admin] = await Promise.all([
    client.rpc('has_role', { _user_id: userId, _role: 'teacher' }),
    client.rpc('has_role', { _user_id: userId, _role: 'admin' }),
  ]);
  if (!teacher.data && !admin.data) throw new Error('هذه الصلاحية متاحة للمعلمين فقط.');
}

export type ReviewItemDTO = {
  id: string;
  subjectId: string;
  subjectTitle: string;
  grade: number | null;
  kind: ItemKind;
  topic: string | null;
  status: ItemStatus;
  generatedBy: 'ai' | 'teacher';
  source: string | null;
  reviewNote: string | null;
  payload: Record<string, Json>;
};

export const listReviewItems = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { status: ItemStatus; subjectId?: string }) => input)
  .handler(async ({ data, context }): Promise<ReviewItemDTO[]> => {
    const client = db(context.supabase);
    await assertEditor(client, context.userId);
    let query = client
      .from('game_items')
      .select('id, subject_id, kind, topic, status, generated_by, source, review_note, payload, subject:subjects(title, grade)')
      .eq('status', data.status)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data.subjectId) query = query.eq('subject_id', data.subjectId);
    const { data: rows } = await query;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return (rows ?? []).map((r: any) => ({
      id: r.id, subjectId: r.subject_id, subjectTitle: r.subject?.title ?? '', grade: r.subject?.grade ?? null, kind: r.kind, topic: r.topic,
      status: r.status, generatedBy: r.generated_by, source: r.source, reviewNote: r.review_note, payload: r.payload,
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

/** Approve, reject, or send back to draft. Only an approved question ever reaches a student. */
export const reviewItem = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { id: string; status: ItemStatus; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const client = db(context.supabase);
    await assertEditor(client, context.userId);
    if (!['draft', 'approved', 'rejected'].includes(data.status)) throw new Error('حالة غير صالحة.');
    if (data.status === 'approved') {
      const { data: row } = await client.from('game_items').select('kind, payload').eq('id', data.id).maybeSingle();
      const problem = row ? validatePayload(row.kind as ItemKind, row.payload as Record<string, unknown>) : 'السؤال غير موجود.';
      if (problem) throw new Error(`لا يمكن اعتماد السؤال: ${problem}`);
    }
    const { error } = await client.from('game_items').update({
      status: data.status, review_note: data.note?.trim() || null, reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
    }).eq('id', data.id);
    if (error) throw new Error('تعذر حفظ القرار. حاول مرة أخرى.');
    return { ok: true };
  });

/** Editing an approved question sends it back to draft, so a changed answer is never live without a second look. */
export const editItem = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { id: string; topic?: string | null; payload: Record<string, Json> }) => input)
  .handler(async ({ data, context }) => {
    const client = db(context.supabase);
    await assertEditor(client, context.userId);
    const { data: row } = await client.from('game_items').select('kind').eq('id', data.id).maybeSingle();
    if (!row) throw new Error('السؤال غير موجود.');
    const problem = validatePayload(row.kind as ItemKind, data.payload);
    if (problem) throw new Error(problem);
    const { error } = await client.from('game_items').update({
      payload: data.payload, topic: data.topic?.trim() || null, status: 'draft', reviewed_by: null, reviewed_at: null,
    }).eq('id', data.id);
    if (error) throw new Error('تعذر حفظ التعديل. حاول مرة أخرى.');
    return { ok: true };
  });

const kindHelp: Record<ItemKind, string> = {
  choice: '{"topic": "...", "prompt": "نص السؤال", "options": ["...", "...", "..."], "correct": 0}  (correct = index of the right option)',
  pair: '{"topic": "...", "left": "...", "right": "..."}',
  order: '{"topic": "...", "prompt": "...", "sequence": ["first", "second", "third"]}  (in the correct order)',
  card: '{"topic": "...", "front": "...", "back": "..."}',
  ladder: '{"topic": "...", "start": "...", "target": "...", "words": ["..."]}  (all words the same length)',
  word: '{"topic": "...", "word": "single word, no spaces", "clue": "..."}',
  place: '{"topic": "...", "prompt": "place name", "mapUrl": "https://...", "x": 0-100, "y": 0-100, "radius": 1-50}',
};

/**
 * Asks Claude to draft questions from curriculum text the teacher pastes (an excerpt of the official book).
 * Every result is saved as a DRAFT; nothing a model writes is visible to a student until a teacher approves it.
 */
export const generateDrafts = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { subjectId: string; kind: ItemKind; curriculum: string; source: string; count: number }) => input)
  .handler(async ({ data, context }) => {
    const client = db(context.supabase);
    await assertEditor(client, context.userId);
    const key = process.env['ANTHROPIC_API_KEY'];
    if (!key) throw new Error('مفتاح خدمة الذكاء الاصطناعي (ANTHROPIC_API_KEY) غير مضبوط على الخادم.');
    const curriculum = data.curriculum.trim().slice(0, 12000);
    if (curriculum.length < 80) throw new Error('الصق مقطعًا من المنهاج لا يقل عن بضعة أسطر.');
    const source = data.source.trim();
    if (!source) throw new Error('اكتب مصدر المقطع (الكتاب والوحدة والصفحة).');
    const count = Math.min(20, Math.max(1, Math.round(data.count)));
    const { data: subject } = await client.from('subjects').select('title, grade').eq('id', data.subjectId).maybeSingle();
    if (!subject) throw new Error('المادة غير موجودة.');

    const prompt = [
      `You write practice questions for Palestinian school students (${subject.title}, grade ${subject.grade}).`,
      'Use ONLY the curriculum excerpt below. Do not add facts, names, dates or numbers that are not in it. If the excerpt does not support enough questions, return fewer.',
      'Write in Arabic (keep English subject terms in English). Keep wording suitable for the grade.',
      `Return exactly one JSON array of at most ${count} objects, no prose and no code fences. Each object has this shape:`,
      kindHelp[data.kind],
      '--- curriculum excerpt ---',
      curriculum,
    ].join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!response.ok) throw new Error('تعذر الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى لاحقًا.');
    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    const raw = (body.content ?? []).map((c) => c.text ?? '').join('');
    const parsed = parseGeneratedItems(data.kind, raw);
    if (parsed.items.length === 0) throw new Error('لم يُنتج النموذج أسئلة صالحة. جرّب مقطعًا آخر.');

    const { error } = await client.from('game_items').insert(
      parsed.items.slice(0, count).map((i) => ({
        subject_id: data.subjectId, kind: data.kind, topic: i.topic, payload: i.payload, status: 'draft', generated_by: 'ai', source, created_by: context.userId,
      })),
    );
    if (error) throw new Error('تعذر حفظ المسودات. حاول مرة أخرى.');
    return { created: Math.min(count, parsed.items.length), rejected: parsed.rejected };
  });

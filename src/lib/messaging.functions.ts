import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { requireApprovedMember } from '@/lib/access/middleware';
import {
  buildConversationSummaries,
  cleanMessageBody,
  toMessageItems,
  type ConversationRecord,
  type MessageNotification,
  type MessageRow,
  type MessagingTargets,
} from '@/lib/messaging/logic';

type Db = SupabaseClient<Database>;

const unavailable = () => new Error('المحادثة غير متاحة.');
const invalidBody = () => new Error('اكتب رسالة لا تزيد عن 2000 حرف.');

function toConversation(row: Database['public']['Tables']['conversations']['Row']): ConversationRecord {
  return { id: row.id, teacherId: row.teacher_id, participantId: row.participant_id, studentId: row.student_id, createdAt: row.created_at };
}

function toMessageRow(row: Database['public']['Tables']['messages']['Row']): MessageRow {
  return { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, body: row.body, readAt: row.read_at, createdAt: row.created_at };
}

/** RLS already limits rows to the viewer's conversations; a missing row means "not yours". */
async function requireConversation(supabase: Db, userId: string, conversationId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .or(`teacher_id.eq.${userId},participant_id.eq.${userId}`)
    .maybeSingle();
  if (!data) throw unavailable();
  return toConversation(data);
}

async function displayNames(supabase: Db, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {} as Record<string, string | null>;
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', unique);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name]));
}

async function insertMessage(supabase: Db, userId: string, conversationId: string, body: string) {
  const { data, error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, body }).select('id').single();
  if (error || !data) throw new Error('تعذر إرسال الرسالة.');
  return { id: data.id };
}

export const listConversations = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase.from('conversations').select('*').or(`teacher_id.eq.${userId},participant_id.eq.${userId}`);
    const conversations = (rows ?? []).map(toConversation);
    if (conversations.length === 0) return [];
    const { data: messages } = await supabase.from('messages').select('*').in('conversation_id', conversations.map((c) => c.id));
    const names = await displayNames(supabase, conversations.flatMap((c) => [c.teacherId, c.participantId, c.studentId]));
    return buildConversationSummaries(userId, conversations, (messages ?? []).map(toMessageRow), names);
  });

export const getUnreadMessageCount = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .neq('sender_id', context.userId)
      .is('read_at', null);
    return count ?? 0;
  });

export const listThread = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    await requireConversation(context.supabase, context.userId, data.conversationId);
    const { data: rows } = await context.supabase.from('messages').select('*').eq('conversation_id', data.conversationId);
    return toMessageItems(context.userId, (rows ?? []).map(toMessageRow));
  });

export const markConversationRead = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    await requireConversation(context.supabase, context.userId, data.conversationId);
    const now = new Date().toISOString();
    await context.supabase
      .from('messages')
      .update({ read_at: now })
      .eq('conversation_id', data.conversationId)
      .neq('sender_id', context.userId)
      .is('read_at', null);
    await context.supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', context.userId)
      .eq('conversation_id', data.conversationId)
      .is('read_at', null);
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { conversationId: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    await requireConversation(context.supabase, context.userId, data.conversationId);
    const body = cleanMessageBody(data.body);
    if (!body) throw invalidBody();
    return insertMessage(context.supabase, context.userId, data.conversationId, body);
  });

/** Students and parents start conversations; teachers only reply. The database re-checks enrolment and parent links. */
export const startConversation = createServerFn({ method: 'POST' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { teacherId: string; studentId: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const body = cleanMessageBody(data.body);
    if (!body) throw invalidBody();
    const find = () =>
      supabase
        .from('conversations')
        .select('id')
        .eq('teacher_id', data.teacherId)
        .eq('participant_id', userId)
        .eq('student_id', data.studentId)
        .maybeSingle();
    let existing = (await find()).data;
    if (!existing) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ teacher_id: data.teacherId, participant_id: userId, student_id: data.studentId })
        .select('id')
        .single();
      // A concurrent request may have created it first (unique violation): reuse that one.
      existing = error ? (await find()).data : created;
    }
    if (!existing) throw new Error('لا يمكن بدء هذه المحادثة.');
    await insertMessage(supabase, userId, existing.id, body);
    return { id: existing.id };
  });

export const listMessageNotifications = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<MessageNotification[]> => {
    const { data } = await context.supabase
      .from('notifications')
      .select('id, title, body, conversation_id, read_at, created_at')
      .eq('user_id', context.userId)
      .eq('kind', 'message')
      .not('conversation_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []).map((n) => ({
      id: n.id,
      kind: 'message' as const,
      title: n.title,
      body: n.body ?? '',
      conversationId: n.conversation_id!,
      readAt: n.read_at,
      createdAt: n.created_at,
    }));
  });

/**
 * Who the viewer can start a conversation with. A student: their enrolled teachers. A parent: the
 * teachers their children are enrolled with, and those children. Teachers only reply, so get nothing.
 */
export const getMessagingTargets = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .handler(async ({ context }): Promise<MessagingTargets> => {
    const { supabase, userId, access } = context;
    const roles = access.roles as string[];
    if (roles.includes('teacher') || roles.includes('admin')) return { teachers: [], students: [] };
    let studentIds = [userId];
    let students: MessagingTargets['students'] = [];
    if (roles.includes('parent')) {
      const { data: links } = await supabase.from('parent_links').select('student_id').eq('parent_id', userId);
      studentIds = (links ?? []).map((l) => l.student_id);
      const childNames = await displayNames(supabase, studentIds);
      students = studentIds.map((id) => ({ id, name: childNames[id] || 'طالب' }));
    }
    if (studentIds.length === 0) return { teachers: [], students };
    const { data: enrollments } = await supabase.from('enrollments').select('teacher_id').in('student_id', studentIds);
    const teacherIds = [...new Set((enrollments ?? []).map((e) => e.teacher_id))];
    const names = await displayNames(supabase, teacherIds);
    return { teachers: teacherIds.map((id) => ({ id, name: names[id] || 'المعلم' })), students };
  });

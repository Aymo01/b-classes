import { createServerFn } from '@tanstack/react-start';
import { requireApprovedMember } from '@/lib/access/middleware';
import { untyped } from './server';

const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Signed URL for a lesson video. Two database rules decide it, both enforced by row-level security:
 * the lesson row is only visible to staff or to a parent with an active subscription covering that
 * subject, and the storage object is readable under the same rule. The bucket is private, so there
 * is no public link to a video file.
 */
export const getLessonVideo = createServerFn({ method: 'GET' })
  .middleware([requireApprovedMember])
  .inputValidator((input: { lessonId: string }) => {
    if (typeof input.lessonId !== 'string' || input.lessonId.length === 0 || input.lessonId.length > 64) throw new Error('الدرس غير صحيح.');
    return input;
  })
  .handler(async ({ data, context }): Promise<{ status: 'ok'; url: string } | { status: 'locked' } | { status: 'none' }> => {
    const db = untyped(context.supabase);
    const { data: lesson } = await db.from('lessons').select('id, video_path').eq('id', data.lessonId).maybeSingle();
    if (!lesson) return { status: 'locked' };
    if (!lesson['video_path']) return { status: 'none' };
    const { data: signed, error } = await context.supabase.storage.from('lesson-media').createSignedUrl(String(lesson['video_path']), SIGNED_URL_SECONDS);
    if (error || !signed) return { status: 'locked' };
    return { status: 'ok', url: signed.signedUrl };
  });

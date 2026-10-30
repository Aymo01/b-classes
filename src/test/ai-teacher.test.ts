import { describe, expect, it } from 'vitest';
import { pickCannedReply } from '@/lib/ai-teacher';
import { cannedReplies, fallbackReply, PLACEHOLDER_TAG } from '@/data/ai-teacher-replies';

describe('ai teacher mock responder', () => {
  it('matches a keyword reply', () => {
    expect(pickCannedReply('شكرا يا معلم')).toBe(cannedReplies.find((r) => r.id === 'thanks')!.reply);
  });
  it('falls back when nothing matches', () => {
    expect(pickCannedReply('سؤال آخر')).toBe(fallbackReply);
  });
  it('every canned reply is marked as a placeholder', () => {
    for (const r of cannedReplies) expect(r.reply.startsWith(PLACEHOLDER_TAG)).toBe(true);
  });
});

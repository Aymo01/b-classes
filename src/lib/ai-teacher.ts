import { cannedReplies, fallbackReply, type CannedReply } from '@/data/ai-teacher-replies';

export type TeacherState = 'idle' | 'listening' | 'speaking';

/** Swap this implementation for a real AI/voice responder later. */
export interface TeacherResponder {
  reply(message: string): Promise<string>;
}

export function pickCannedReply(message: string, replies: CannedReply[] = cannedReplies): string {
  const text = message.trim();
  if (!text) return fallbackReply;
  const match = replies.find((r) => r.keywords.some((k) => text.includes(k)));
  return match ? match.reply : fallbackReply;
}

export const mockResponder: TeacherResponder = {
  async reply(message) {
    await new Promise((r) => setTimeout(r, 400));
    return pickCannedReply(message);
  },
};

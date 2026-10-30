/**
 * ردود المعلّم الذكي المؤقتة — PLACEHOLDER REPLIES
 *
 * هذا هو الملف الوحيد الذي يحتوي ردود الشخصية. يستطيع المعلمون استبدال
 * النصوص هنا لاحقاً. كل الردود الحالية مؤقتة وليست محتوى منهجياً.
 *
 * - keywords: كلمات إن وُجدت في سؤال الطالب يُختار هذا الرد.
 * - reply: النص الذي تقوله الشخصية.
 */
export type CannedReply = { id: string; keywords: string[]; reply: string };

export const PLACEHOLDER_TAG = '[رد مؤقت]';

export const greetingReply = `${PLACEHOLDER_TAG} مرحباً! أنا معلّمك الصغير. اكتب سؤالك أو اضغط زر الميكروفون.`;

export const fallbackReply = `${PLACEHOLDER_TAG} سيضيف معلّمك رداً لهذا السؤال قريباً.`;

export const cannedReplies: CannedReply[] = [
  { id: 'hello', keywords: ['مرحبا', 'السلام', 'أهلا', 'اهلا'], reply: `${PLACEHOLDER_TAG} أهلاً بك! يسعدني أن أراك اليوم.` },
  { id: 'help', keywords: ['ساعد', 'مساعدة', 'لا أفهم', 'لا افهم'], reply: `${PLACEHOLDER_TAG} سيكتب معلّمك هنا رداً للمساعدة.` },
  { id: 'thanks', keywords: ['شكرا', 'شكراً'], reply: `${PLACEHOLDER_TAG} على الرحب والسعة!` },
];

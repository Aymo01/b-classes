import { useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/student-workspace';
import { useConversations, useMessagingViewer, useSendMessage, useStartConversation, useThread, useUnreadMessages } from '@/lib/messaging/hooks';
import { MAX_MESSAGE_LENGTH, type MessagingRole } from '@/lib/messaging/logic';
import { mockMessaging } from '@/lib/messaging/mock-store';

const otherRoleLabel: Record<MessagingRole, string> = { teacher: 'المعلم', parent: 'ولي الأمر', student: 'الطالب' };

const formatTime = (value: string) => new Date(value).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });

export function UnreadBadge({ className = 'menu-badge' }: { className?: string }) {
  const unread = useUnreadMessages();
  if (unread === 0) return null;
  return <span className={className} aria-label={`${unread} رسائل غير مقروءة`}>{unread}</span>;
}

function Composer({ onSend, busy, error, placeholder = 'اكتب رسالتك...' }: { onSend: (body: string) => Promise<void>; busy: boolean; error: string | null; placeholder?: string }) {
  const [body, setBody] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await onSend(body);
      setBody('');
    } catch { /* surfaced through `error` */ }
  }
  return (
    <form className="message-composer" onSubmit={submit}>
      <Textarea rows={2} maxLength={MAX_MESSAGE_LENGTH} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} aria-label="نص الرسالة" />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !body.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Send />}إرسال</Button>
    </form>
  );
}

function Thread({ conversationId, heading }: { conversationId: string; heading: string }) {
  const { data: thread, isLoading, error } = useThread(conversationId);
  const send = useSendMessage(conversationId);
  if (error) return <EmptyState icon={MessageSquare} title="المحادثة غير متاحة" text="لا يمكنك الوصول إلى هذه المحادثة." />;
  return (
    <section className="message-thread" aria-label={heading}>
      <h3>{heading}</h3>
      {isLoading ? <div className="study-empty" role="status"><Loader2 className="animate-spin" size={24} /></div> : (
        <ol className="message-list" aria-live="polite">
          {(thread ?? []).map((m) => (
            <li key={m.id} className={m.mine ? 'message-bubble message-mine' : 'message-bubble'}>
              <p>{m.body}</p>
              <small>{formatTime(m.createdAt)}</small>
            </li>
          ))}
        </ol>
      )}
      <Composer onSend={async (body) => { await send.mutateAsync(body); }} busy={send.isPending} error={send.error instanceof Error ? send.error.message : null} />
    </section>
  );
}

function NewConversation({ role, onStarted }: { role: MessagingRole; onStarted: (id: string) => void }) {
  const teachers = mockMessaging.teachers();
  const students = mockMessaging.studentsFor(role);
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? '');
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const start = useStartConversation();
  return (
    <div className="teacher-form message-new">
      <h3>محادثة جديدة</h3>
      <div className="teacher-form-grid">
        <div className="auth-field"><label>المعلم</label>
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger><SelectValue placeholder="اختر المعلم" /></SelectTrigger>
            <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {role === 'parent' && (
          <div className="auth-field"><label>بخصوص الطالب</label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Composer
        placeholder="اكتب رسالتك الأولى..."
        busy={start.isPending}
        error={start.error instanceof Error ? start.error.message : null}
        onSend={async (body) => { const { id } = await start.mutateAsync({ teacherId, studentId, body }); onStarted(id); }}
      />
    </div>
  );
}

/**
 * Inbox + thread. Teachers only reply; students and parents can also start a conversation.
 * The selected conversation is owned by the caller so notifications can deep-link to it.
 */
export function MessagesPanel({ selectedId, onSelect }: { selectedId: string | undefined; onSelect: (id: string | undefined) => void }) {
  const viewer = useMessagingViewer();
  const { data: conversations, isLoading } = useConversations();
  const [composing, setComposing] = useState(false);

  if (!viewer || isLoading) return <div className="study-empty" role="status"><Loader2 className="animate-spin" size={28} /><p>جارٍ تحميل الرسائل...</p></div>;

  const canStart = viewer.role !== 'teacher';
  const selected = conversations?.find((c) => c.id === selectedId);
  const heading = selected ? `${selected.otherName} · ${otherRoleLabel[selected.otherRole]}${selected.otherRole === 'parent' ? ` ${selected.studentName}` : ''}` : '';

  return (
    <div className="messages-panel">
      <aside className="message-inbox" aria-label="المحادثات">
        {canStart && <Button variant="outline" onClick={() => { setComposing(true); onSelect(undefined); }}><MessageSquare />محادثة جديدة</Button>}
        {!conversations || conversations.length === 0 ? (
          <p className="quiz-hint">{canStart ? 'لا توجد محادثات بعد. ابدأ محادثة مع المعلم.' : 'لا توجد رسائل بعد. سيظهر هنا ما يرسله الطلاب وأولياء الأمور.'}</p>
        ) : (
          <ul className="conversation-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <button type="button" className={c.id === selectedId ? 'conversation-item conversation-active' : 'conversation-item'} onClick={() => { setComposing(false); onSelect(c.id); }}>
                  <span className="conversation-name">
                    {c.otherName} · {otherRoleLabel[c.otherRole]}{c.otherRole === 'parent' ? ` ${c.studentName}` : ''}
                    {c.unread > 0 && <span className="menu-badge" aria-label={`${c.unread} غير مقروءة`}>{c.unread}</span>}
                  </span>
                  <span className="conversation-preview">{c.lastMessage}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <div className="message-main">
        {selected ? <Thread conversationId={selected.id} heading={heading} />
          : composing && canStart ? <NewConversation role={viewer.role} onStarted={(id) => { setComposing(false); onSelect(id); }} />
          : <EmptyState icon={MessageSquare} title="اختر محادثة" text="اختر محادثة من القائمة لعرض الرسائل." />}
      </div>
    </div>
  );
}

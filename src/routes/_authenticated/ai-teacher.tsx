import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, RotateCcw, Send } from 'lucide-react';
import { StudentWorkspace } from '@/components/student-workspace';
import { Button } from '@/components/ui/button';
import { pageMeta } from '@/lib/page-meta';
import { mockResponder, type TeacherState } from '@/lib/ai-teacher';
import { greetingReply } from '@/data/ai-teacher-replies';

export const Route = createFileRoute('/_authenticated/ai-teacher')({
  head: () => pageMeta('معلّمي الصغير', 'شخصية معلّم ودودة للصفوف من الأول إلى الرابع في B classes.'),
  component: AiTeacherPage,
});

type Msg = { from: 'teacher' | 'me'; text: string };
const stateLabel: Record<TeacherState, string> = { idle: 'جاهز', listening: 'أستمع إليك…', speaking: 'أتحدث…' };

function AiTeacherPage() {
  const [state, setState] = useState<TeacherState>('idle');
  const [messages, setMessages] = useState<Msg[]>([{ from: 'teacher', text: greetingReply }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastReply = [...messages].reverse().find((m) => m.from === 'teacher')?.text;

  useEffect(() => () => clearTimeout(timer.current), []);

  function speak(text: string) {
    setState('speaking');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), Math.min(4000, 1200 + text.length * 40));
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput(''); setBusy(true);
    setMessages((m) => [...m, { from: 'me', text }]);
    const reply = await mockResponder.reply(text);
    setMessages((m) => [...m, { from: 'teacher', text: reply }]);
    setBusy(false);
    speak(reply);
  }

  function toggleMic() {
    clearTimeout(timer.current);
    setState((s) => (s === 'listening' ? 'idle' : 'listening'));
  }

  return (
    <StudentWorkspace title="معلّمي الصغير" subtitle="صديقك للصفوف من الأول إلى الرابع. الصوت والذكاء الاصطناعي قادمان قريباً.">
      <div data-theme="elementary" className="kid-teacher">
        <div className="kid-stage" data-state={state}>
          <svg className="kid-character" viewBox="0 0 200 200" role="img" aria-label={`المعلّم: ${stateLabel[state]}`}>
            <ellipse cx="100" cy="186" rx="52" ry="8" className="kid-shadow" />
            <g className="kid-body">
              <rect x="40" y="40" width="120" height="130" rx="58" className="kid-skin" />
              <path d="M58 70 Q100 20 142 70" className="kid-hair" />
              <g className="kid-eyes">
                <circle cx="78" cy="98" r="9" className="kid-ink" />
                <circle cx="122" cy="98" r="9" className="kid-ink" />
                <circle cx="81" cy="95" r="3" className="kid-shine" />
                <circle cx="125" cy="95" r="3" className="kid-shine" />
              </g>
              <circle cx="62" cy="122" r="9" className="kid-cheek" />
              <circle cx="138" cy="122" r="9" className="kid-cheek" />
              <ellipse cx="100" cy="132" rx="16" ry="8" className="kid-mouth" />
            </g>
            <g className="kid-waves">
              <path d="M172 80 q10 20 0 40" /><path d="M184 70 q16 30 0 60" />
            </g>
          </svg>
          <p className="kid-status" aria-live="polite">
            <span className="kid-dot" aria-hidden="true" />
            {stateLabel[state]}
          </p>
        </div>

        <div className="kid-chat">
          <ol className="kid-messages" aria-live="polite" aria-label="المحادثة">
            {messages.map((m, i) => (
              <li key={i} className={m.from === 'me' ? 'kid-msg kid-me' : 'kid-msg kid-them'}>
                <span className="sr-only">{m.from === 'me' ? 'أنت:' : 'المعلّم:'}</span>{m.text}
              </li>
            ))}
          </ol>
          <form className="kid-form" onSubmit={send}>
            <label htmlFor="kid-input" className="sr-only">اكتب سؤالك</label>
            <input id="kid-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب سؤالك هنا…" className="kid-input" />
            <Button type="submit" size="icon" className="kid-btn" disabled={busy || !input.trim()} aria-label="إرسال"><Send /></Button>
            <Button type="button" size="icon" variant={state === 'listening' ? 'default' : 'outline'} className="kid-btn" onClick={toggleMic} aria-pressed={state === 'listening'} aria-label={state === 'listening' ? 'إيقاف الاستماع' : 'تحدث'}>
              {state === 'listening' ? <MicOff /> : <Mic />}
            </Button>
            <Button type="button" variant="outline" className="kid-btn" onClick={() => lastReply && speak(lastReply)} disabled={!lastReply || busy}>
              <RotateCcw />أعد الرد
            </Button>
          </form>
          {state === 'listening' && <p className="kid-note">الاستماع بالصوت غير متاح بعد — اكتب سؤالك الآن.</p>}
        </div>
      </div>
    </StudentWorkspace>
  );
}

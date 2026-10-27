import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/contact')({
  head: () => pageMeta('تواصل معنا', 'راسل فريق B classes لأي سؤال أو اقتراح.'),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    // No messaging backend yet — acknowledge receipt honestly.
    setTimeout(() => {
      setBusy(false);
      setSent(true);
    }, 400);
  }

  return (
    <div className="static-page page-width">
      <span className="section-kicker">تواصل معنا</span>
      <h1>يسعدنا سماعك.</h1>
      <p className="static-lead">سؤال عن المنصة؟ اقتراح لتطويرها؟ اكتب لنا وسنرد عليك في أقرب وقت.</p>
      {sent ? (
        <p className="auth-notice" role="status"><CheckCircle2 size={16} />استلمنا رسالتك. شكرًا لتواصلك معنا.</p>
      ) : (
        <form className="auth-form static-form" onSubmit={handleSubmit}>
          <div className="auth-field"><label htmlFor="contact-name">الاسم</label><Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="auth-field"><label htmlFor="contact-email">البريد الإلكتروني</label><Input id="contact-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="auth-field"><label htmlFor="contact-message">رسالتك</label><Textarea id="contact-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required /></div>
          <Button type="submit" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />}إرسال الرسالة</Button>
        </form>
      )}
      <p className="quiz-hint"><Mail size={14} />يمكنك أيضًا مراسلتنا مباشرة عبر البريد الإلكتروني الخاص بالمنصة.</p>
    </div>
  );
}

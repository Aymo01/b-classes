import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/reset-password')({
  head: () => pageMeta('إعادة تعيين كلمة المرور', 'عيّن كلمة مرور جديدة لحسابك في B classes.'),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link carries a token in the URL hash; the supabase client
    // exchanges it for a recovery session automatically.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError('تعذر تحديث كلمة المرور. حاول مرة أخرى.');
      return;
    }
    setDone(true);
    setTimeout(() => void navigate({ to: '/dashboard' }), 1500);
  }

  return (
    <div className="auth-page page-width">
      <div className="auth-card">
        <div className="auth-heading">
          <span className="auth-icon"><LockKeyhole /></span>
          <h1>كلمة مرور جديدة</h1>
          <p>اختر كلمة مرور قوية لحسابك.</p>
        </div>
        {!ready && !done && (
          <p className="auth-notice" role="status"><Loader2 className="animate-spin" size={16} />جارٍ التحقق من الرابط...</p>
        )}
        {done ? (
          <p className="auth-notice" role="status"><CheckCircle2 size={16} />تم تحديث كلمة المرور. جارٍ تحويلك إلى مساحتك...</p>
        ) : ready ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="new-password">كلمة المرور الجديدة</label>
              <Input id="new-password" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
              <Input id="confirm-password" type="password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <Button type="submit" size="lg" disabled={busy}>{busy && <Loader2 className="animate-spin" />}حفظ كلمة المرور</Button>
          </form>
        ) : null}
        <Link to="/auth" className="auth-link">العودة لتسجيل الدخول</Link>
      </div>
    </div>
  );
}

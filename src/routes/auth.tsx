import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, GraduationCap, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useSession } from '@/lib/session';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/auth')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search['redirect'] === 'string' && search['redirect'].startsWith('/') ? search['redirect'] : undefined,
  }),
  head: () => pageMeta('تسجيل الدخول', 'سجّل دخولك إلى B classes أو أنشئ حسابًا جديدًا لتبدأ رحلتك الدراسية.'),
  component: AuthPage,
});

type Mode = 'signin' | 'signup' | 'forgot';

function AuthPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) void navigate({ to: redirectTo ?? '/dashboard' });
  }, [loading, user, navigate, redirectTo]);

  const destination = redirectTo ?? '/dashboard';

  async function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error('بيانات الدخول غير صحيحة. تأكد من البريد وكلمة المرور.');
        void navigate({ to: destination });
      } else if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
        });
        if (signUpError) {
          if (signUpError.code === 'weak_password') throw new Error('كلمة المرور ضعيفة أو شائعة. اختر كلمة أقوى وأطول.');
          throw new Error('تعذر إنشاء الحساب. ربما البريد مسجل مسبقًا.');
        }
        if (!data.session) {
          setNotice('تم إنشاء حسابك. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل دخولك.');
        } else {
          void navigate({ to: destination });
        }
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw new Error('تعذر إرسال رابط الاستعادة. حاول مرة أخرى.');
        setNotice('أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'lovable') {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      setError('تعذر تسجيل الدخول. حاول مرة أخرى.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-page page-width">
      <div className="auth-card">
        <div className="auth-heading">
          <span className="auth-icon"><GraduationCap /></span>
          <h1>{mode === 'signin' ? 'أهلًا بعودتك' : mode === 'signup' ? 'ابدأ رحلتك معنا' : 'استعادة كلمة المرور'}</h1>
          <p>{mode === 'signin' ? 'سجّل دخولك للوصول إلى مساحتك الدراسية.' : mode === 'signup' ? 'أنشئ حسابك واختر صفك لتبدأ التعلّم.' : 'أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة.'}</p>
        </div>

        {mode !== 'forgot' && (
          <div className="auth-tabs" role="tablist">
            <Button variant={mode === 'signin' ? 'default' : 'ghost'} onClick={() => { setMode('signin'); setError(null); setNotice(null); }}>تسجيل الدخول</Button>
            <Button variant={mode === 'signup' ? 'default' : 'ghost'} onClick={() => { setMode('signup'); setError(null); setNotice(null); }}>حساب جديد</Button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleEmail}>
          {mode === 'signup' && (
            <div className="auth-field">
              <label htmlFor="auth-name">الاسم</label>
              <Input id="auth-name" placeholder="اسمك الكامل" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="auth-email">البريد الإلكتروني</label>
            <Input id="auth-email" type="email" dir="ltr" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== 'forgot' && (
            <div className="auth-field">
              <label htmlFor="auth-password">كلمة المرور</label>
              <Input id="auth-password" type="password" dir="ltr" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status"><CheckCircle2 size={16} />{notice}</p>}
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === 'signin' ? 'دخول' : mode === 'signup' ? 'إنشاء الحساب' : 'إرسال رابط الاستعادة'}
          </Button>
        </form>

        {mode === 'signin' && (
          <button type="button" className="auth-link" onClick={() => { setMode('forgot'); setError(null); setNotice(null); }}>
            <LockKeyhole size={14} /> نسيت كلمة المرور؟
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="auth-link" onClick={() => { setMode('signin'); setError(null); setNotice(null); }}>
            <ArrowRight size={14} /> العودة لتسجيل الدخول
          </button>
        )}

        {mode !== 'forgot' && (
          <>
            <div className="auth-divider"><span>أو تابع عبر</span></div>
            <div className="auth-oauth">
              <Button variant="outline" onClick={() => void handleOAuth('google')} disabled={busy}>
                <Mail /> حساب Google
              </Button>
              <Button variant="outline" onClick={() => void handleOAuth('lovable')} disabled={busy}>
                <UserRound /> حساب Lovable
              </Button>
            </div>
          </>
        )}
      </div>
      <p className="auth-footer-note">بمتابعتك، أنت توافق على <Link to="/terms">شروط الاستخدام</Link> و<Link to="/privacy">سياسة الخصوصية</Link>.</p>
    </div>
  );
}

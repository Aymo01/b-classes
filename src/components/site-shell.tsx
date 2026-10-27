import { Link, useRouterState } from '@tanstack/react-router';
import { ArrowUpLeft, BookOpen, GraduationCap, LogIn, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGrade } from '@/components/grade-provider';
import { useSession } from '@/lib/session';
import { gradeLabel } from '@/lib/grades';
import { AccountMenu } from '@/components/account-menu';

export function Brand() {
  return <span className="brand" dir="ltr"><span className="brand-symbol">B<span className="brand-dot" /></span><span>classes<span className="brand-tagline" dir="rtl">لكل مرحلة، بداية جديدة</span></span></span>;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { grade } = useGrade();
  const { user, loading } = useSession();
  const pathname = useRouterState({ select: state => state.location.pathname });
  return <header className="site-header"><div className="header-inner">
    <Link to="/" aria-label="B classes — الرئيسية" className="brand-link"><Brand /></Link>
    <nav aria-label="التنقل الرئيسي" className="desktop-nav"><Link to="/" activeProps={{ className: 'nav-active' }} activeOptions={{ exact: true }}>الرئيسية</Link><Link to="/grades" search={{ stage: undefined }} activeProps={{ className: 'nav-active' }}>المراحل الدراسية</Link><Link to="/about" activeProps={{ className: 'nav-active' }}>عن المنصة</Link>{user && <Link to="/dashboard" activeProps={{ className: 'nav-active' }}>مساحتي</Link>}</nav>
    <div className="header-actions">
      {!user && <Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}><GraduationCap />{grade ? gradeLabel(grade) : 'اختر صفك'}</Link></Button>}
      {!loading && (user
        ? <AccountMenu email={user.email ?? ''} />
        : <Button asChild className="header-start"><Link to="/auth"><LogIn />تسجيل الدخول</Link></Button>)}
      <Button variant="ghost" size="icon" className="mobile-menu" aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
    </div>
  </div>{open && <nav id="mobile-navigation" className="mobile-navigation" aria-label="التنقل على الهاتف"><Link to="/" onClick={() => setOpen(false)} aria-current={pathname === '/' ? 'page' : undefined}>الرئيسية</Link><Link to="/grades" search={{ stage: undefined }} onClick={() => setOpen(false)}>المراحل الدراسية</Link><Link to="/about" onClick={() => setOpen(false)}>عن المنصة</Link>{user ? <Link to="/dashboard" onClick={() => setOpen(false)}>مساحتي</Link> : <Link to="/auth" onClick={() => setOpen(false)}>تسجيل الدخول</Link>}</nav>}</header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-inner"><Link to="/" aria-label="B classes — الرئيسية"><Brand /></Link><p>مساحة للمعرفة. فرصة للنمو. بداية للمستقبل.</p><nav className="footer-links" aria-label="روابط المنصة"><Link to="/about">عن المنصة</Link><Link to="/contact">تواصل معنا</Link><Link to="/privacy">الخصوصية</Link><Link to="/terms">الشروط</Link></nav><Link to="/grades" search={{ stage: undefined }}>اكتشف مرحلتك <BookOpen size={17} /></Link></div><div className="footer-bottom">B classes · رحلة تعلّم تناسب كل مرحلة</div></footer>;
}

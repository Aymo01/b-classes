import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Lightbulb, ArrowLeft, BookOpen, CalendarDays, Check, ClipboardList, FileQuestion, GraduationCap, LayoutGrid, Play, Search, Sparkles, Target, Trophy, UserRound, Video, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGrade } from '@/components/grade-provider';
import { gradeLabel, themeForGrade } from '@/lib/grades';

export const studentNavigation = [
  { to: '/dashboard', title: 'مساحتي', icon: LayoutGrid },
  { to: '/subjects', title: 'المواد الدراسية', icon: BookOpen },
  { to: '/lessons', title: 'الدروس', icon: Play },
  { to: '/classes', title: 'الحصص', icon: Video },
  { to: '/assignments', title: 'الواجبات', icon: ClipboardList },
  { to: '/quizzes', title: 'الاختبارات', icon: FileQuestion },
  { to: '/study-coach', title: 'مرشدي الدراسي', icon: Lightbulb },
  { to: '/progress', title: 'تقدّمي', icon: Target },
  { to: '/profile', title: 'ملفي الشخصي', icon: UserRound },
] as const;

export function StudentWorkspace({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { grade } = useGrade();
  return <div className="student-layout page-width"><aside className="student-sidebar"><div className="student-identity"><span className="student-avatar"><GraduationCap /></span><div><strong>مساحتك الدراسية</strong><span>{grade ? gradeLabel(grade) : 'لم يُحدد الصف بعد'}</span></div></div><nav aria-label="مساحة الطالب">{studentNavigation.map(({ to, title, icon: Icon }) => <Button key={to} variant="ghost" asChild><Link to={to} activeProps={{ className: 'student-nav-active' }}><Icon />{title}</Link></Button>)}</nav><Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}>تغيير الصف<ArrowLeft /></Link></Button></aside><div className="student-content"><header className="workspace-heading"><div className="min-w-0"><span className="section-kicker">B classes · {grade ? gradeLabel(grade) : 'رحلتك الدراسية'}</span><h1>{title}</h1><p>{subtitle}</p></div><span className="workspace-emblem" aria-hidden="true"><Sparkles /></span></header>{!grade && <div className="grade-prompt"><GraduationCap /><p>اختر صفك لتحديد مرحلتك الدراسية.</p><Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}>اختر صفك</Link></Button></div>}{children}</div></div>;
}

export function EmptyState({ icon: Icon = BookOpen, title, text }: { icon?: typeof BookOpen; title: string; text: string }) {
  return <div className="study-empty"><span className="empty-icon"><Icon strokeWidth={1.4} /></span><h2>{title}</h2><p>{text}</p></div>;
}

export function DashboardDesign() {
  const { grade } = useGrade();
  const theme = themeForGrade(grade);
  return <StudentWorkspace title={theme === 'elementary' ? 'جاهز لاكتشاف شيء جديد؟' : theme === 'secondary' ? 'خطوتك التالية نحو طموحك.' : 'أهلًا بك في رحلة التعلّم.'} subtitle="مساحة تجمع خطوتك القادمة وما أنجزته في رحلتك.">
    <section className="student-welcome"><div><span className="welcome-label">بداية جديدة</span><h2>{theme === 'elementary' ? 'كل سؤال، مغامرة صغيرة.' : 'كل يوم فرصة لتتقدّم.'}</h2><p>ابدأ من موادك الدراسية، وخذ خطوتك التالية بثقة.</p><Button asChild><Link to="/subjects">استكشف موادي<ArrowLeft /></Link></Button></div><span className="welcome-illustration" aria-hidden="true">{theme === 'elementary' ? <Waves /> : <GraduationCap />}</span></section>
    <div className="study-metrics">{[{ label: 'دروسي المكتملة', icon: BookOpen }, { label: 'الواجبات القادمة', icon: ClipboardList }, { label: 'نتائج الاختبارات', icon: FileQuestion }].map(({ label, icon: Icon }) => <div className="study-metric" key={label}><span><Icon /></span><p>{label}</p><strong>—</strong><small>لا توجد بيانات بعد</small></div>)}</div>
    <div className="workspace-columns"><section><div className="study-section-title"><h2>خطوتك القادمة</h2><Button variant="link" asChild><Link to="/lessons">كل الدروس<ArrowLeft /></Link></Button></div><EmptyState icon={Play} title="رحلتك تنتظر أول درس" text="ستظهر دروسك هنا عندما تصبح متاحة." /></section><section><div className="study-section-title"><h2>حصصك القادمة</h2><CalendarDays size={19} /></div><EmptyState icon={CalendarDays} title="جدولك هادئ الآن" text="لا توجد حصص مجدولة بعد." /></section></div>
    <nav className="study-shortcuts" aria-label="روابط سريعة">{[{ to: '/assignments', title: 'واجباتي', icon: ClipboardList },{ to: '/quizzes', title: 'اختبر معرفتك', icon: FileQuestion },{ to: '/progress', title: 'رحلة إنجازك', icon: Trophy }].map(({to,title,icon:Icon}) => <Button variant="outline" asChild key={to}><Link to={to as '/assignments' | '/quizzes' | '/progress'}><Icon />{title}<ArrowLeft /></Link></Button>)}</nav>
  </StudentWorkspace>;
}

const catalogueInfo = {
 subjects: { title: 'موادي الدراسية', subtitle: 'كل مادة تفتح بابًا جديدًا للمعرفة.', filters: ['كل المواد', 'قيد التعلّم', 'المكتملة'], empty: 'موادك الدراسية ستظهر هنا', text: 'لا توجد مواد مرتبطة بصفك حاليًا.', icon: BookOpen },
 lessons: { title: 'دروسي', subtitle: 'خطوات صغيرة تصنع معرفة أكبر.', filters: ['كل الدروس', 'المسجلة', 'المراجعات'], empty: 'لا توجد دروس متاحة بعد', text: 'ستجد هنا دروسك المسجلة ومواد المراجعة.', icon: Play },
 classes: { title: 'حصصي الدراسية', subtitle: 'موعدك مع المعرفة، في مكان واحد.', filters: ['القادمة', 'المباشرة', 'المسجلة'], empty: 'لا توجد حصص في هذا القسم', text: 'ستظهر مواعيد حصصك وتسجيلاتها عندما تصبح متاحة.', icon: Video },
 assignments: { title: 'واجباتي', subtitle: 'فرصة لتطبيق ما تعلّمته، خطوة بخطوة.', filters: ['القادمة', 'المسلّمة', 'المراجَعة'], empty: 'لا توجد واجبات بعد', text: 'عندما يُضاف واجب، ستجد تفاصيله وموعد تسليمه هنا.', icon: ClipboardList },
 quizzes: { title: 'اختباراتي', subtitle: 'اكتشف ما أتقنته، وما يمكنك تعلّمه بعد.', filters: ['المتاحة', 'المكتملة'], empty: 'لا توجد اختبارات متاحة', text: 'ستظهر اختباراتك ونتائجك في هذه المساحة.', icon: FileQuestion },
} as const;

export function CatalogueDesign({ kind }: { kind: keyof typeof catalogueInfo }) {
  const info = catalogueInfo[kind];
  const [filter, setFilter] = useState<string>(info.filters[0]);
  const [search, setSearch] = useState('');
  return <StudentWorkspace title={info.title} subtitle={info.subtitle}><div className="catalogue-toolbar"><div className="study-filters" aria-label="تصفية المحتوى">{info.filters.map(item => <Button key={item} variant={filter === item ? 'default' : 'ghost'} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</Button>)}</div><div className="study-search"><Search size={17} /><Input aria-label={`البحث في ${info.title}`} placeholder="ابحث هنا..." value={search} onChange={event => setSearch(event.target.value)} /></div></div><div aria-live="polite"><EmptyState icon={info.icon} title={search ? 'لا توجد نتائج مطابقة' : info.empty} text={search ? 'جرّب عبارة بحث أخرى.' : info.text} /></div></StudentWorkspace>;
}

export function ProgressDesign() {
  return <StudentWorkspace title="رحلة إنجازي" subtitle="كل خطوة تستحق أن تراها، وكل إنجاز يستحق الاحتفاء."><div className="study-metrics">{['الدروس المكتملة','الواجبات المسلّمة','متوسط الاختبارات'].map(label => <div key={label} className="study-metric"><span><Target /></span><p>{label}</p><strong>—</strong><small>بانتظار أول إنجاز</small></div>)}</div><div className="workspace-columns"><section><div className="study-section-title"><h2>تقدّمي الدراسي</h2><Target size={20} /></div><EmptyState icon={Target} title="ابدأ لتشاهد تقدّمك" text="ستظهر نسبة إنجازك عندما تبدأ دروسك." /></section><section><div className="study-section-title"><h2>إنجازاتي</h2><Trophy size={20} /></div><EmptyState icon={Trophy} title="أول إنجاز في انتظارك" text="لا توجد شارات مكتسبة بعد." /></section></div></StudentWorkspace>;
}

export function ProfileDesign() {
  const { grade } = useGrade();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);
  return <StudentWorkspace title="ملفي الشخصي" subtitle="تفاصيلك، وبداية رحلتك الدراسية."><div className="profile-heading"><span className="profile-avatar"><UserRound /></span><div><h2>{name || 'طالب B classes'}</h2><p>{grade ? gradeLabel(grade) : 'اختر صفك الدراسي'}</p></div></div><form className="profile-form" onSubmit={event => { event.preventDefault(); setSaved(true); }}><h2>معلوماتي</h2><div className="profile-fields"><div><label htmlFor="student-name">الاسم</label><Input id="student-name" placeholder="اسمك الكامل" value={name} onChange={event => { setName(event.target.value); setSaved(false); }} /></div><div><label htmlFor="student-email">البريد الإلكتروني</label><Input id="student-email" type="email" dir="ltr" placeholder="name@example.com" value={email} onChange={event => { setEmail(event.target.value); setSaved(false); }} /></div></div><div className="profile-grade"><div><strong>صفي الدراسي</strong><p>{grade ? gradeLabel(grade) : 'لم يُحدد بعد'}</p></div><Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}>تغيير الصف</Link></Button></div><div className="profile-save"><Button type="submit">تحديث العرض<Check /></Button><span>تغييرات مؤقتة لهذه الصفحة فقط.</span></div>{saved && <p className="profile-status" role="status"><Check />تم تحديث العرض؛ لم تُحفظ البيانات في حساب.</p>}</form></StudentWorkspace>;
}
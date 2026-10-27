import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, GraduationCap, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGrade } from '@/components/grade-provider';
import { useSession } from '@/lib/session';
import { gradeLabel, stages, themeForGrade, type Grade, type Stage } from '@/lib/grades';

export const Route = createFileRoute('/grades')({
  validateSearch: (search: Record<string, unknown>): { stage?: Stage | undefined } => ({ stage: search['stage'] === 'elementary' || search['stage'] === 'middle' || search['stage'] === 'secondary' ? search['stage'] : undefined }),
  head: () => ({ meta: [
    { title: 'اختر صفك الدراسي | B classes' },
    { name: 'description', content: 'اختر صفك الدراسي من الأول إلى العاشر أو الأول والثاني الثانوي لتحديد مرحلتك في B classes.' },
    { property: 'og:title', content: 'اختر صفك الدراسي | B classes' },
    { property: 'og:description', content: 'ابدأ بالصف المناسب لك واكتشف هويتك الدراسية.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: GradesPage,
});

function GradesPage() {
  const { stage: requestedStage } = Route.useSearch();
  const { grade, selectGrade } = useGrade();
  const { user } = useSession();
  const [confirmed, setConfirmed] = useState(false);
  const selectedStage = themeForGrade(grade);
  return <div className="grade-page page-width"><Button variant="link" asChild><Link to="/"><ArrowRight />العودة للرئيسية</Link></Button><div className="grade-heading"><span className="section-kicker">خطوتك الأولى</span><h1>كل رحلة تبدأ باختيار.</h1><p>ما صفك الدراسي؟ اختر صفك لنبدأ من المكان المناسب لك.</p></div>
    <div className="grade-stage-grid">{stages.map((stage, index) => <section key={stage.id} data-theme={stage.id} className={`grade-stage ${requestedStage === stage.id ? 'grade-stage-suggested' : ''}`}><div className="grade-stage-title"><span className="grade-stage-icon"><GraduationCap /></span><span><span className="stage-kicker">المرحلة 0{index + 1}</span><h2>{stage.range}</h2></span></div><div className="grade-options">{stage.grades.map(value => <Button key={value} variant="outline" className={grade === value ? 'grade-option grade-option-selected' : 'grade-option'} aria-pressed={grade === value} onClick={() => { selectGrade(value); setConfirmed(false); }}>{gradeLabel(value)}{grade === value && <Check size={17} />}</Button>)}</div></section>)}</div>
    <div className="grade-confirmation"><div aria-live="polite"><strong>{grade ? `اختيارك: ${gradeLabel(grade)}` : 'اختر صفك الدراسي للمتابعة'}</strong><p>{grade ? stages.find(stage => stage.id === selectedStage)?.title : 'يمكنك تغيير اختيارك في أي وقت.'}</p></div><Button size="lg" disabled={grade === null} onClick={() => setConfirmed(true)}>تأكيد اختياري<ArrowLeft /></Button></div>
    {confirmed && grade && <div className="selection-result" role="status"><CheckCircle2 /><div><h2>أهلًا بك في {gradeLabel(grade)}</h2><p>رحلتك تبدأ هنا. انتقل إلى مساحتك الدراسية.</p>{!user && <p className="selection-note"><LockKeyhole size={15} />سجّل دخولك ليُحفظ اختيارك في حسابك.</p>}</div><Button asChild><Link to="/dashboard">إلى مساحتي<ArrowLeft /></Link></Button></div>}
  </div>;
}
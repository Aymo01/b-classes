import { createFileRoute } from "@tanstack/react-router";
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowUpLeft, BookOpen, Check, Compass, HeartHandshake, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StageCard } from '@/components/stage-card';
import { stages } from '@/lib/grades';
import studyImage from '@/assets/study-family.jpg';

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: 'B classes | لكل مرحلة، بداية جديدة' },
    { name: 'description', content: 'اكتشف مرحلتك الدراسية مع B classes، من خطوات التأسيس الأولى إلى طموح المرحلة الثانوية.' },
    { property: 'og:title', content: 'B classes | لكل مرحلة، بداية جديدة' },
    { property: 'og:description', content: 'رحلة تعلّم عربية تناسب كل مرحلة. اختر صفك وابدأ رحلتك.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});

function Index() {
  return <>
    <section className="home-hero">
      <img className="hero-photo" src={studyImage} alt="طالبة تتعلّم وتدوّن في دفترها بمساندة والدتها" width={1600} height={1008} fetchPriority="high" />
      <div className="hero-scrim" />
      <div className="hero-inner"><div className="hero-copy">
        <span className="eyebrow"><span className="eyebrow-dot" />رحلة التعلّم تبدأ من هنا</span>
        <h1><span dir="ltr" className="hero-brand">B classes</span><br />لكل مرحلة،<br /><span className="hero-highlight">بداية جديدة.</span></h1>
        <p>من أول سؤال إلى أكبر طموح، مساحة تعلّم تنمو معك.<br className="desktop-break" /> اختر مرحلتك، وخذ خطوتك التالية بثقة.</p>
        <div className="hero-actions"><Button asChild size="lg"><Link to="/grades" search={{ stage: undefined }}>ابدأ رحلتك الآن<ArrowLeft /></Link></Button><Button variant="link" asChild><Link to="/grades" search={{ stage: undefined }}>اكتشف المراحل<ArrowUpLeft /></Link></Button></div>
        <div className="hero-notes"><span><Check />تجربة تناسب عمرك</span><span><Check />تعلّم باللغة العربية</span></div>
      </div></div>
      <div className="photo-caption"><span className="caption-icon"><BookOpen /></span><div><strong>كل خطوة تصنع فرقًا</strong><span>فضول صغير، مستقبل كبير</span></div><Sparkles size={20} /></div>
    </section>
    <div className="values-strip"><div className="values-inner"><span><Compass />رحلة تناسب كل مرحلة</span><span><BookOpen />المعرفة أقرب إليك</span><span><Target />خطوة بخطوة نحو هدفك</span><span><HeartHandshake />لأن لكل طالب طريقه</span></div></div>
    <section className="stages-section page-width"><div className="section-heading"><div><span className="section-kicker">مراحل مختلفة. شغف واحد.</span><h2>أين تبدأ رحلتك؟</h2><p>لكل عمر طريقته في التعلّم. اكتشف المساحة التي تناسبك.</p></div><span className="section-note"><span>٣</span> مراحل، عالم من الفرص <ArrowUpLeft size={19} /></span></div><div className="stages-grid">{stages.map((stage, index) => <StageCard key={stage.id} stage={stage} index={index} />)}</div></section>
    <section className="learning-section"><div className="page-width learning-inner"><div><span className="section-kicker">معك في كل خطوة</span><h2>التعلّم رحلة،<br />وليست مجرد وجهة.</h2><p>نؤمن أن البداية المناسبة تفتح أبوابًا جديدة للمعرفة،<br />وتمنح كل طالب مساحة ليكتشف قدراته.</p><Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}>اختر بدايتك<ArrowLeft /></Link></Button></div><div className="learning-values"><div><span className="value-icon"><Compass /></span><h3>طريق يناسبك</h3><p>مرحلتك واهتماماتك في قلب رحلة التعلّم.</p></div><div><span className="value-icon"><Target /></span><h3>خطوات نحو طموحك</h3><p>بداية واضحة، ومساحة للنمو يومًا بعد يوم.</p></div><div><span className="value-icon"><Sparkles /></span><h3>شغف لا يتوقف</h3><p>كل سؤال فرصة لاكتشاف شيء جديد.</p></div></div></div></section>
  </>;
}

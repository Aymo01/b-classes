import { createFileRoute } from "@tanstack/react-router";
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowUpLeft, BookOpen, Check, ClipboardList, Compass, FileCheck, HeartHandshake, Lightbulb, Radio, Target, Video } from 'lucide-react';
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
      <div className="photo-caption"><span className="caption-icon"><BookOpen /></span><div><strong>كل خطوة تصنع فرقًا</strong><span>فضول صغير، مستقبل كبير</span></div></div>
    </section>
    <div className="values-strip"><div className="values-inner"><span><Compass />رحلة تناسب كل مرحلة</span><span><BookOpen />المعرفة أقرب إليك</span><span><Target />خطوة بخطوة نحو هدفك</span><span><HeartHandshake />لأن لكل طالب طريقه</span></div></div>
    <section className="stages-section page-width"><div className="section-heading"><div><span className="section-kicker">مراحل مختلفة. شغف واحد.</span><h2>أين تبدأ رحلتك؟</h2><p>لكل عمر طريقته في التعلّم. اكتشف المساحة التي تناسبك.</p></div><span className="section-note"><span>٣</span> مراحل، عالم من الفرص <ArrowUpLeft size={19} /></span></div><div className="stages-grid">{stages.map((stage, index) => <StageCard key={stage.id} stage={stage} index={index} />)}</div></section>
    <section className="learning-section"><div className="page-width learning-inner"><div><span className="section-kicker">معك في كل خطوة</span><h2>التعلّم رحلة،<br />وليست مجرد وجهة.</h2><p>نؤمن أن البداية المناسبة تفتح أبوابًا جديدة للمعرفة،<br />وتمنح كل طالب مساحة ليكتشف قدراته.</p><Button variant="outline" asChild><Link to="/grades" search={{ stage: undefined }}>اختر بدايتك<ArrowLeft /></Link></Button></div><div className="learning-values"><div><span className="value-icon"><Compass /></span><h3>طريق يناسبك</h3><p>مرحلتك واهتماماتك في قلب رحلة التعلّم.</p></div><div><span className="value-icon"><Target /></span><h3>خطوات نحو طموحك</h3><p>بداية واضحة، ومساحة للنمو يومًا بعد يوم.</p></div><div><span className="value-icon"><Lightbulb /></span><h3>شغف لا يتوقف</h3><p>كل سؤال فرصة لاكتشاف شيء جديد.</p></div></div></div></section>
    <section className="features-section page-width"><div className="section-heading"><div><span className="section-kicker">كل ما يحتاجه الطالب</span><h2>ماذا ستجد في B classes؟</h2><p>أدوات تعلّم متكاملة، مصممة لتناسب كل مرحلة دراسية.</p></div></div><div className="features-grid">{features.map((feature) => <div key={feature.title} className="feature-card"><span className="feature-icon"><feature.icon /></span><h3>{feature.title}</h3><p>{feature.text}</p></div>)}</div></section>
    <section className="faq-section"><div className="page-width"><div className="section-heading"><div><span className="section-kicker">أسئلة شائعة</span><h2>عندك سؤال؟</h2><p>إجابات سريعة عن أكثر ما يسأل عنه الطلاب وأولياء الأمور.</p></div></div><div className="faq-list">{faqs.map((faq) => <details key={faq.q} className="faq-item"><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</div></div></section>
  </>;
}

const features = [
  { icon: Video, title: 'دروس مسجّلة', text: 'دروس فيديو مع ملاحظات المعلم، تشاهدها في الوقت الذي يناسبك وتعلّم ما أنجزته.' },
  { icon: Radio, title: 'حصص مباشرة', text: 'حصص حية بمواعيد واضحة وروابط انضمام مباشرة من مساحتك الدراسية.' },
  { icon: FileCheck, title: 'واجبات بتغذية راجعة', text: 'سلّم واجبك نصًا أو ملفًا، واستلم درجتك وملاحظات معلمك في مكان واحد.' },
  { icon: ClipboardList, title: 'اختبارات بتصحيح فوري', text: 'اختبر نفسك، واعرف نتيجتك وإجاباتك الصحيحة فور التسليم.' },
  { icon: HeartHandshake, title: 'متابعة ولي الأمر', text: 'مساحة خاصة لولي الأمر لمتابعة تقدّم ابنه في الدروس والواجبات والاختبارات.' },
  { icon: Lightbulb, title: 'مساعد دراسي ذكي', text: 'خطة مذاكرة تناسب صفك وأهدافك، جاهزة عندما تحتاجها.' },
];

const faqs = [
  { q: 'كيف أبدأ التعلّم في B classes؟', a: 'اختر صفك من صفحة المراحل الدراسية، ثم أنشئ حسابك لتدخل مساحتك الدراسية وتبدأ فورًا.' },
  { q: 'هل يحفظ الموقع صفي الدراسي؟', a: 'نعم، يُحفظ صفك في حسابك، فتجد مساحتك ومحتوى صفك جاهزين كلما عدت.' },
  { q: 'كيف يتابع ولي الأمر تقدّم ابنه؟', a: 'يجد الطالب رمز دعوة خاصًا به في صفحة ملفه الشخصي، يدخله ولي الأمر في مساحة أولياء الأمور ليرتبط حسابه بحساب ابنه ويتابع تقدّمه.' },
  { q: 'كيف أنضم كمعلم؟', a: 'أنشئ حسابًا عاديًا، ثم تمنحك إدارة المنصة صلاحية المعلم لتتمكن من إضافة المواد والدروس والحصص والواجبات والاختبارات.' },
  { q: 'ماذا أجد في مساحتي الدراسية؟', a: 'دروس صفك المسجلة، الحصص المباشرة القادمة، الواجبات والاختبارات، وملخص تقدّمك في كل مادة.' },
];

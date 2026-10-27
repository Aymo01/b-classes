import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Compass, HeartHandshake, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/about')({
  head: () => pageMeta('عن المنصة', 'تعرّف على رؤية B classes ورحلة التعلّم التي نقدمها لكل مرحلة دراسية.'),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="static-page page-width">
      <span className="section-kicker">عن B classes</span>
      <h1>لكل مرحلة، بداية جديدة.</h1>
      <p className="static-lead">B classes منصة تعلّم عربية تؤمن أن لكل طالب طريقه. نصمم تجربة تناسب عمر المتعلّم ومرحلته، من خطوات التأسيس الأولى إلى طموح المرحلة الثانوية.</p>
      <div className="static-values">
        <div><span className="value-icon"><Compass /></span><h2>رحلة تناسب كل مرحلة</h2><p>ثلاث مراحل دراسية، لكل منها هويتها وأسلوبها، ليشعر الطالب أن المساحة صُممت له.</p></div>
        <div><span className="value-icon"><Target /></span><h2>خطوة بخطوة</h2><p>دروس وحصص وواجبات واختبارات مرتبة بوضوح، ليعرف الطالب دائمًا ما خطوته التالية.</p></div>
        <div><span className="value-icon"><HeartHandshake /></span><h2>مع العائلة</h2><p>مساحة خاصة لأولياء الأمور لمتابعة تقدّم أبنائهم ودعمهم في رحلتهم.</p></div>
      </div>
      <Button asChild size="lg"><Link to="/grades" search={{ stage: undefined }}>ابدأ رحلتك<ArrowLeft /></Link></Button>
    </div>
  );
}

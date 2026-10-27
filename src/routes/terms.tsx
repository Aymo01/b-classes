import { createFileRoute } from '@tanstack/react-router';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/terms')({
  head: () => pageMeta('شروط الاستخدام', 'شروط استخدام منصة B classes.'),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="static-page page-width">
      <span className="section-kicker">شروط الاستخدام</span>
      <h1>قواعد واضحة لرحلة آمنة.</h1>
      <div className="static-body">
        <h2>استخدام المنصة</h2>
        <p>منصة B classes مخصصة للتعلّم. يلتزم المستخدم باستخدامها للأغراض التعليمية فقط، وبعدم مشاركة محتواها خارج حسابه الشخصي.</p>
        <h2>الحسابات</h2>
        <p>أنت مسؤول عن الحفاظ على سرية بيانات دخولك. يُستخدم حساب الطالب من قِبل الطالب نفسه، ويُربط حساب ولي الأمر برمز دعوة خاص بالطالب.</p>
        <h2>المحتوى</h2>
        <p>الدروس والحصص والاختبارات والمواد المتاحة على المنصة ملك لـ B classes، ولا يجوز إعادة نشرها أو توزيعها دون إذن.</p>
        <h2>السلوك</h2>
        <p>نلتزم جميعًا ببيئة تعلّم محترمة. أي إساءة استخدام قد تؤدي إلى تقييد الحساب.</p>
      </div>
    </div>
  );
}

import { Link } from '@tanstack/react-router';
import { ArrowLeft, BookOpen, Check, GraduationCap, Sparkles, Sprout, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stages } from '@/lib/grades';

export function StageCard({ stage, index }: { stage: (typeof stages)[number]; index: number }) {
  const Icon = stage.id === 'elementary' ? Waves : stage.id === 'middle' ? Sprout : GraduationCap;
  return <article data-theme={stage.id} className={`stage-card stage-card-${stage.id}`}>
    <div className="stage-art" aria-hidden="true"><span className="stage-number">0{index + 1}</span><span className="stage-art-main"><Icon strokeWidth={1.5} /></span><span className="stage-art-small"><BookOpen /></span><Sparkles className="stage-spark" /></div>
    <div className="stage-card-body"><div className="stage-kicker">{stage.id === 'elementary' ? 'مرحلة التأسيس' : stage.id === 'middle' ? 'مرحلة النمو' : 'المرحلة الثانوية'}</div><h3>{stage.title}</h3><p className="stage-range">{stage.range}</p><p className="stage-description">{stage.description}</p><ul className="stage-highlights">{stage.highlights.map(item => <li key={item}><Check size={15} />{item}</li>)}</ul><Button variant="stage" asChild><Link to="/grades" search={{ stage: stage.id }}>اكتشف المرحلة<ArrowLeft /></Link></Button></div>
  </article>;
}
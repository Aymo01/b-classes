import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stageIcon } from '@/components/stage-icon-map';
import { StageWave } from '@/components/stage-icons';
import { stages } from '@/lib/grades';

export function StageCard({ stage, index }: { stage: (typeof stages)[number]; index: number }) {
  const Icon = stageIcon(stage.id);
  const headingId = `${stage.id}-title`;
  return <article data-theme={stage.id} className={`stage-card stage-card-${stage.id}`} aria-labelledby={headingId}>
    <div className="stage-art" aria-hidden="true"><span className="stage-number">0{index + 1}</span><Icon className="stage-icon" strokeWidth={1.5} /></div>
    <div className="stage-card-body"><div className="stage-kicker">{stage.id === 'stage-1' ? 'مرحلة التأسيس' : stage.id === 'stage-2' || stage.id === 'stage-3' ? 'مرحلة النمو' : 'المرحلة الثانوية'}</div><h3 id={headingId}>{stage.title}</h3><p className="stage-range">{stage.range}</p><p className="stage-description">{stage.description}</p><ul className="stage-highlights">{stage.highlights.map(item => <li key={item}><Check size={15} aria-hidden="true" />{item}</li>)}</ul><Button variant="stage" asChild><Link to="/grades" search={{ stage: stage.id }}>اكتشف المرحلة<ArrowLeft /></Link></Button></div>
    <StageWave />
  </article>;
}

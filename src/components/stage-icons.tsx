import { stageIcon } from '@/components/stage-icon-map';
import type { Stage } from '@/lib/grades';

export function StageIcon({ stage }: { stage: Stage }) {
  const Icon = stageIcon(stage);
  return <Icon />;
}

/** Decorative wave along the bottom of a stage card, drawn in the stage's secondary colour. */
export function StageWave() {
  return (
    <svg className="stage-wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 32 C150 4 300 60 450 32 S750 4 900 32 S1100 60 1200 32 V60 H0 Z" fill="currentColor" />
    </svg>
  );
}
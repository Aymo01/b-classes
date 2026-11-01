import { BookOpen, Library, Sailboat, Target, Trophy, type LucideIcon } from 'lucide-react';
import type { Stage } from '@/lib/grades';

/** One icon per stage: grades 1-4, 5-8, 9-10, first secondary, Tawjihi. */
const icons: Record<Stage, LucideIcon> = {
  'stage-1': Sailboat,
  'stage-2': BookOpen,
  'stage-3': Trophy,
  'stage-4': Library,
  'stage-5': Target,
};

export const stageIcon = (id: Stage): LucideIcon => icons[id];

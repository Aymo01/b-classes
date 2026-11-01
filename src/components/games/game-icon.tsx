import {
  Archive, BookOpen, CalendarCheck, DoorOpen, FileCheck, Flower2, FlaskConical, Footprints, Gamepad2, Grid3x3, Layers,
  ListChecks, Map as MapIcon, Microscope, Milestone, Network, Repeat, SearchCheck, Shapes, Swords, Target, Timer, Trophy, Wheat, Zap,
  type LucideIcon,
} from 'lucide-react';

/** The games table stores an icon name; this turns it into a component. Unknown names fall back to a gamepad. */
const icons: Record<string, LucideIcon> = {
  archive: Archive, 'book-open': BookOpen, 'calendar-check': CalendarCheck, 'door-open': DoorOpen, 'file-check': FileCheck,
  flower: Flower2, 'flask-conical': FlaskConical, footprints: Footprints, gamepad: Gamepad2, 'grid-3x3': Grid3x3, layers: Layers,
  'list-checks': ListChecks, map: MapIcon, microscope: Microscope, milestone: Milestone, network: Network, repeat: Repeat,
  'search-check': SearchCheck, shapes: Shapes, swords: Swords, target: Target, timer: Timer, trophy: Trophy, wheat: Wheat, zap: Zap,
};

export const iconFor = (name: string): LucideIcon => icons[name] ?? Gamepad2;

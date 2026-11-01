export type LiveStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';
export type LiveMode = 'individual' | 'group';

export const liveStatusLabel: Record<LiveStatus, string> = {
  pending: 'قيد الانتظار',
  accepted: 'مقبولة',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
};
export const liveModeLabel: Record<LiveMode, string> = { individual: 'فردية', group: 'جماعية' };

const NEXT: Record<LiveStatus, LiveStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const canTransition = (from: LiveStatus, to: LiveStatus) => NEXT[from].includes(to);

export const isLiveMode = (v: unknown): v is LiveMode => v === 'individual' || v === 'group';

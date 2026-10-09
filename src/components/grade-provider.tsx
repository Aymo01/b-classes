import { createContext, useContext, useState, type ReactNode } from 'react';
import { themeForGrade, type Grade } from '@/lib/grades';

const GradeContext = createContext<{ grade: Grade | null; selectGrade: (grade: Grade) => void }>({ grade: null, selectGrade: () => {} });
export function GradeProvider({ children }: { children: ReactNode }) {
  const [grade, selectGrade] = useState<Grade | null>(null);
  return <GradeContext.Provider value={{ grade, selectGrade }}><div data-theme={themeForGrade(grade) ?? 'elementary'} className="platform-shell">{children}</div></GradeContext.Provider>;
}
export function useGrade() { return useContext(GradeContext); }
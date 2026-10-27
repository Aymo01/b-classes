import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { themeForGrade, type Grade } from '@/lib/grades';
import { useSession } from '@/lib/session';
import { getMyProfile, updateMyProfile } from '@/lib/profile.functions';

const GradeContext = createContext<{ grade: Grade | null; selectGrade: (grade: Grade) => void }>({ grade: null, selectGrade: () => {} });

export function GradeProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [grade, setGrade] = useState<Grade | null>(null);
  const loadedFor = useRef<string | null>(null);

  // Load the saved grade when a user signs in; clear it on sign-out.
  useEffect(() => {
    if (!user) {
      loadedFor.current = null;
      setGrade(null);
      return;
    }
    if (loadedFor.current === user.id) return;
    loadedFor.current = user.id;
    getMyProfile()
      .then(({ profile }) => {
        if (profile?.grade && profile.grade >= 1 && profile.grade <= 12) setGrade(profile.grade as Grade);
      })
      .catch(() => {});
  }, [user]);

  function selectGrade(next: Grade) {
    setGrade(next);
    if (user) {
      updateMyProfile({ data: { grade: next } }).catch(() => {});
    }
  }

  return <GradeContext.Provider value={{ grade, selectGrade }}><div data-theme={themeForGrade(grade) ?? 'elementary'} className="platform-shell">{children}</div></GradeContext.Provider>;
}
export function useGrade() { return useContext(GradeContext); }

import { Gamepad2 } from 'lucide-react';
import { EmptyState } from '@/components/student-workspace';
import { percentOf } from '@/lib/games/logic';
import type { GameSessionDTO } from '@/lib/games.functions';

/** Recent game results: game, subject, score, time and date. Read-only, used on the dashboard and in the parent area. */
export function GameSessionList({ sessions }: { sessions: GameSessionDTO[] }) {
  if (sessions.length === 0) return <EmptyState icon={Gamepad2} title="لا توجد نتائج ألعاب بعد" text="ستظهر نتائج الألعاب هنا." />;
  return (
    <div className="content-list">
      {sessions.map((s) => (
        <div className="content-card" key={s.id}>
          <div>
            <span className="content-card-kicker">{s.subjectTitle ?? 'لعبة'}</span>
            <h3>{s.gameTitle}</h3>
            <p>
              النتيجة: {s.score} من {s.maxScore} ({percentOf(s.score, s.maxScore)}%) · الزمن {s.durationSeconds} ثانية · {new Date(s.playedAt).toLocaleDateString('ar', { dateStyle: 'medium' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

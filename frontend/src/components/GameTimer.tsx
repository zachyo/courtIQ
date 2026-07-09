import { useEffect, useState } from 'react';
import type { Match } from '../types';

function format(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

// Only rendered when the match settings enable a timer (timerSeconds !== null):
// 0 counts up, >0 counts down. Driven by startedAt so every viewer (manager,
// spectators) sees the same clock.
export default function GameTimer({ match }: { match: Match }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (match.status !== 'LIVE') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [match.status]);

  if (match.timerSeconds === null) return null;
  const countdown = match.timerSeconds > 0;

  if (match.status === 'PENDING') {
    return countdown ? <div className="game-timer muted">{format(match.timerSeconds)}</div> : null;
  }

  if (!match.startedAt) return null;
  const end = match.status === 'FINISHED' && match.endedAt ? Date.parse(match.endedAt) : now;
  const elapsed = (end - Date.parse(match.startedAt)) / 1000;

  if (countdown) {
    const remaining = match.timerSeconds - elapsed;
    return (
      <div className={`game-timer${remaining <= 0 ? ' game-timer-expired' : ''}`}>
        {remaining <= 0 && match.status === 'LIVE' ? 'TIME UP' : format(remaining)}
      </div>
    );
  }

  return <div className="game-timer">{format(elapsed)}</div>;
}

import type { Match } from '../types';
import GameTimer from './GameTimer';

export default function ScoreBoard({ match }: { match: Match }) {
  const [a, b] = match.teams;
  if (!a || !b) return null;
  return (
    <div className="card scoreboard">
      <div>
        <div className="team-name">
          <span className="team-dot" style={{ background: a.colour }} />
          {a.name}
        </div>
        <div className="team-score">{a.finalScore}</div>
      </div>
      <div className="vs">
        {match.status === 'LIVE' ? (
          <span className="badge badge-live">LIVE</span>
        ) : match.status === 'FINISHED' ? (
          <span className="badge badge-finished">FINAL</span>
        ) : (
          'vs'
        )}
        {match.targetScore && (
          <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
            to {match.targetScore}
          </div>
        )}
        <GameTimer match={match} />
      </div>
      <div>
        <div className="team-name">
          <span className="team-dot" style={{ background: b.colour }} />
          {b.name}
        </div>
        <div className="team-score">{b.finalScore}</div>
      </div>
    </div>
  );
}

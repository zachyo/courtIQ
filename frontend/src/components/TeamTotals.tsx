import type { Match } from '../types';

// Read-only team panels for spectators: per-player totals, no manager controls
export default function TeamTotals({ match }: { match: Match }) {
  return (
    <div className="team-totals">
      {match.teams.map((team) => (
        <div key={team.id}>
          <div className="match-card-head">
            <strong className="team-name">
              <span className="team-dot" style={{ background: team.colour }} />
              {team.name}
            </strong>
            {match.status !== 'PENDING' && <strong>{team.finalScore}</strong>}
          </div>
          {team.players.length === 0 && <p className="muted">No players yet.</p>}
          {team.players.map((player) => (
            <div className="player-row" key={player.id}>
              <span>
                <strong>{player.displayName}</strong>{' '}
                <span className="muted">@{player.username}</span>
              </span>
              <span className="player-points">{player.points}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

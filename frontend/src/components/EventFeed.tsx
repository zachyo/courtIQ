import type { Match, ScoreEventEntry } from '../types';

export default function EventFeed({
  events,
  match,
}: {
  events: ScoreEventEntry[];
  match: Match;
}) {
  if (events.length === 0) {
    return <p className="muted">No scores yet.</p>;
  }
  const teamName = (teamId: string) =>
    match.teams.find((team) => team.id === teamId)?.name ?? '';
  return (
    <div>
      {[...events].reverse().map((event) => (
        <div className="feed-item" key={event.id}>
          <span>
            <strong>{event.displayName}</strong>{' '}
            <span className="muted">({event.teamName ?? teamName(event.teamId)})</span>
          </span>
          <strong>+{event.points}</strong>
        </div>
      ))}
    </div>
  );
}

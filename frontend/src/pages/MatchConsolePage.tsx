import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import { api } from '../api';
import { getSocket, joinMatch, leaveMatch } from '../socket';
import type { Match, MatchPlayerEntry, MatchStats, Player, Team } from '../types';
import ScoreBoard from '../components/ScoreBoard';

export default function MatchConsolePage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [error, setError] = useState('');
  const [keepOpen, setKeepOpen] = useState(false);
  const [keepCandidates, setKeepCandidates] = useState<MatchPlayerEntry[]>([]);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [roster, setRoster] = useState<Player[]>([]);

  const loadRoster = useCallback(() => {
    api<{ players: Player[] }>('/api/players')
      .then((data) => setRoster(data.players))
      .catch(() => {});
  }, []);

  const loadStats = useCallback(() => {
    api<MatchStats>(`/api/matches/${id}/stats`).then(setStats).catch(() => {});
  }, [id]);

  useEffect(() => {
    api<{ match: Match }>(`/api/matches/${id}`)
      .then((data) => {
        setMatch(data.match);
        if (data.match.status === 'FINISHED') loadStats();
        if (data.match.status === 'PENDING') loadRoster();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Match not found'));
  }, [id, loadStats, loadRoster]);

  // Keep a second device (or the spectator page in another tab) in sync
  useEffect(() => {
    if (!match?.code) return;
    const socket = getSocket();
    const onUpdate = (payload: { match: Match }) => setMatch(payload.match);
    joinMatch(match.code);
    for (const event of ['match:started', 'match:score', 'match:score-undone', 'match:ended', 'match:settings']) {
      socket.on(event, onUpdate);
    }
    return () => {
      leaveMatch(match.code);
      for (const event of ['match:started', 'match:score', 'match:score-undone', 'match:ended', 'match:settings']) {
        socket.off(event, onUpdate);
      }
    };
  }, [match?.code]);

  async function action(path: string, body?: unknown) {
    setError('');
    try {
      const data = await api<{ match: Match }>(`/api/matches/${id}${path}`, {
        method: 'POST',
        ...(body !== undefined ? { body } : {}),
      });
      setMatch(data.match);
      return data.match;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return null;
    }
  }

  async function endMatch() {
    if (!window.confirm('End this match? Scores will be final.')) return;
    const ended = await action('/end');
    if (!ended) return;
    loadStats();
    // Only offer players you manage that aren't already on your roster
    try {
      const { players } = await api<{ players: Player[] }>('/api/players');
      const owned = new Map(players.map((player) => [player.id, player]));
      const candidates = ended.teams
        .flatMap((team) => team.players)
        .filter((mp) => {
          const player = owned.get(mp.playerId);
          return player !== undefined && !player.keptForFuture;
        });
      if (candidates.length > 0) {
        setKeepCandidates(candidates);
        setKeptIds(new Set(candidates.map((mp) => mp.playerId)));
        setKeepOpen(true);
      }
    } catch {
      // roster fetch failed — skip the prompt rather than block ending
    }
  }

  async function toggleComments(enabled: boolean) {
    setError('');
    try {
      const data = await api<{ match: Match }>(`/api/matches/${id}/settings`, {
        method: 'PATCH',
        body: { commentsEnabled: enabled },
      });
      setMatch(data.match);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update settings');
    }
  }

  async function keepPlayers() {
    if (keptIds.size > 0) {
      await api('/api/players/keep', {
        method: 'POST',
        body: { playerIds: [...keptIds] },
      }).catch(() => {});
    }
    setKeepOpen(false);
  }

  async function setMvp(playerId: string) {
    setError('');
    try {
      const data = await api<MatchStats>(`/api/matches/${id}/mvp`, {
        method: 'PATCH',
        body: { playerId },
      });
      setStats(data);
      setMatch(data.match);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set MVP');
    }
  }

  if (error && !match) return <main className="page">{<p className="error">{error}</p>}</main>;
  if (!match) return <main className="page muted">Loading…</main>;

  const shareUrl = `${window.location.origin}/watch/${match.code}`;

  return (
    <main className="page">
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="field-row">
          <span className="share-code">{match.code}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
          >
            Copy watch link
          </button>
        </div>
        <div className="field-row">
          {match.status === 'PENDING' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => action('/start')}
              disabled={match.teams.some((t) => t.players.length === 0)}
            >
              Start match
            </button>
          )}
          {match.status === 'LIVE' && (
            <>
              <button type="button" className="btn" onClick={() => action('/undo')}>
                Undo last
              </button>
              <button type="button" className="btn btn-danger" onClick={endMatch}>
                End match
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <ScoreBoard match={match} />
      </div>

      {match.status === 'LIVE' && (
        <div className="card switch-row" style={{ marginTop: '1rem' }}>
          <label htmlFor="spectatorComments">Spectator comments</label>
          <Switch.Root
            id="spectatorComments"
            className="switch-root"
            checked={match.commentsEnabled}
            onCheckedChange={toggleComments}
          >
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="grid-2" style={{ marginTop: '1rem' }}>
        {match.teams.map((team) => (
          <TeamPanel
            key={team.id}
            team={team}
            match={match}
            roster={roster}
            onScore={(matchPlayerId, points) => action('/score', { matchPlayerId, points })}
            onAdd={async (username) => {
              setError('');
              try {
                const data = await api<{ match: Match }>(`/api/matches/${id}/players`, {
                  method: 'POST',
                  body: { teamId: team.id, username },
                });
                setMatch(data.match);
                loadRoster(); // a brand-new username is now part of the roster
                return true;
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not add player');
                return false;
              }
            }}
            onRemove={async (matchPlayerId) => {
              const data = await api<{ match: Match }>(
                `/api/matches/${id}/players/${matchPlayerId}`,
                { method: 'DELETE' },
              ).catch(() => null);
              if (data) setMatch(data.match);
            }}
          />
        ))}
      </div>

      {match.status === 'FINISHED' && stats && (
        <>
          <div className="section-head">
            <h2>Stats</h2>
          </div>
          <div className="card">
            <p style={{ marginTop: 0 }}>
              {stats.winner ? (
                <>
                  <strong>{stats.winner.name}</strong> win{' '}
                </>
              ) : (
                <strong>Draw </strong>
              )}
              {stats.mvp && (
                <span className="muted">
                  · MVP: <strong>{stats.mvp.displayName}</strong>
                </span>
              )}
            </p>
            {stats.leaderboard.map((entry) => (
              <div className="player-row" key={entry.matchPlayerId}>
                <span>
                  <strong>{entry.displayName}</strong>{' '}
                  <span className="muted">({entry.teamName})</span>
                  {match.mvpPlayerId === entry.playerId && (
                    <span className="badge badge-finished" style={{ marginLeft: '0.5rem' }}>
                      MVP
                    </span>
                  )}
                </span>
                <span className="field-row">
                  <span className="player-points">{entry.points}</span>
                  {match.mvpPlayerId !== entry.playerId && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setMvp(entry.playerId)}
                    >
                      Make MVP
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog.Root open={keepOpen} onOpenChange={setKeepOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title className="dialog-title">Keep players for future games?</Dialog.Title>
            <Dialog.Description className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Kept players join your roster and build career stats across matches.
            </Dialog.Description>
            <div style={{ marginTop: '0.75rem' }}>
              {keepCandidates.map((player) => (
                  <label
                    key={player.playerId}
                    className="player-row"
                    style={{ cursor: 'pointer' }}
                  >
                    <span>
                      <strong>{player.displayName}</strong>{' '}
                      <span className="muted">@{player.username}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={keptIds.has(player.playerId)}
                      onChange={(e) => {
                        const next = new Set(keptIds);
                        if (e.target.checked) next.add(player.playerId);
                        else next.delete(player.playerId);
                        setKeptIds(next);
                      }}
                    />
                  </label>
                ))}
            </div>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="btn">
                  Skip
                </button>
              </Dialog.Close>
              <button type="button" className="btn btn-primary" onClick={keepPlayers}>
                Keep selected
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}

function TeamPanel({
  team,
  match,
  roster,
  onScore,
  onAdd,
  onRemove,
}: {
  team: Team;
  match: Match;
  roster: Player[];
  onScore: (matchPlayerId: string, points: number) => void;
  onAdd: (username: string) => Promise<boolean>;
  onRemove: (matchPlayerId: string) => void;
}) {
  const [username, setUsername] = useState('');

  const inMatch = new Set(
    match.teams.flatMap((t) => t.players.map((player) => player.playerId)),
  );
  const suggestions = roster
    .filter(
      (player) =>
        !inMatch.has(player.id) &&
        player.username.includes(username.trim().toLowerCase()),
    )
    .slice(0, 6);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await onAdd(username.trim())) setUsername('');
  }

  return (
    <div className="card">
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
          {match.status === 'LIVE' ? (
            <span className="score-btns">
              <span className="player-points" style={{ alignSelf: 'center' }}>
                {player.points}
              </span>
              {[1, 2, 3].map((points) => (
                <button
                  key={points}
                  type="button"
                  className="btn btn-sm"
                  aria-label={`+${points} for ${player.displayName}`}
                  onClick={() => onScore(player.id, points)}
                >
                  +{points}
                </button>
              ))}
            </span>
          ) : match.status === 'PENDING' ? (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => onRemove(player.id)}
            >
              Remove
            </button>
          ) : (
            <span className="player-points">{player.points}</span>
          )}
        </div>
      ))}

      {match.status === 'PENDING' && (
        <>
          <form className="field-row" style={{ marginTop: '0.75rem' }} onSubmit={submit}>
            <input
              className="input"
              placeholder="username"
              aria-label={`Add player to ${team.name}`}
              value={username}
              pattern="[a-zA-Z0-9_]{3,20}"
              title="3–20 letters, digits or underscore"
              required
              onChange={(e) => setUsername(e.target.value)}
            />
            <button type="submit" className="btn">
              Add
            </button>
          </form>
          {suggestions.length > 0 && (
            <div className="chip-row">
              {suggestions.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="chip"
                  onClick={async () => {
                    if (await onAdd(player.username)) setUsername('');
                  }}
                >
                  @{player.username}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

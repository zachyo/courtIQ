import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import { api } from '../api';
import type { ClaimedPlayer, Match } from '../types';

const statusBadge: Record<Match['status'], string> = {
  PENDING: 'badge badge-pending',
  LIVE: 'badge badge-live',
  FINISHED: 'badge badge-finished',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [open, setOpen] = useState(false);
  const [teamAName, setTeamAName] = useState('Team A');
  const [teamAColour, setTeamAColour] = useState('#ea580c');
  const [teamBName, setTeamBName] = useState('Team B');
  const [teamBColour, setTeamBColour] = useState('#2563eb');
  const [targetScore, setTargetScore] = useState('');
  const [timerMode, setTimerMode] = useState<'none' | 'countup' | 'countdown'>('none');
  const [timerMinutes, setTimerMinutes] = useState('20');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ matches: Match[] }>('/api/matches').then((data) => setMatches(data.matches));
  }, []);

  async function createMatch(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api<{ match: Match }>('/api/matches', {
        method: 'POST',
        body: {
          teams: [
            { name: teamAName, colour: teamAColour },
            { name: teamBName, colour: teamBColour },
          ],
          commentsEnabled,
          visibility: isPublic ? 'PUBLIC' : 'PRIVATE',
          ...(targetScore ? { targetScore: Number(targetScore) } : {}),
          // null = no timer, 0 = count-up, >0 = countdown duration
          ...(timerMode === 'countup' ? { timerSeconds: 0 } : {}),
          ...(timerMode === 'countdown' && timerMinutes
            ? { timerSeconds: Number(timerMinutes) * 60 }
            : {}),
        },
      });
      navigate(`/match/${data.match.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create match');
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="section-head">
        <h2>Your matches</h2>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className="btn btn-primary">
              New match
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content">
              <Dialog.Title className="dialog-title">New match</Dialog.Title>
              <Dialog.Description className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                Two teams. You can add players after.
              </Dialog.Description>
              <form onSubmit={createMatch}>
                <div className="grid-2">
                  <div>
                    <label className="label" htmlFor="teamAName">
                      Team A
                    </label>
                    <div className="field-row">
                      <input
                        id="teamAName"
                        className="input"
                        value={teamAName}
                        maxLength={30}
                        required
                        onChange={(e) => setTeamAName(e.target.value)}
                      />
                      <input
                        type="color"
                        value={teamAColour}
                        onChange={(e) => setTeamAColour(e.target.value)}
                        aria-label="Team A colour"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="teamBName">
                      Team B
                    </label>
                    <div className="field-row">
                      <input
                        id="teamBName"
                        className="input"
                        value={teamBName}
                        maxLength={30}
                        required
                        onChange={(e) => setTeamBName(e.target.value)}
                      />
                      <input
                        type="color"
                        value={teamBColour}
                        onChange={(e) => setTeamBColour(e.target.value)}
                        aria-label="Team B colour"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid-2">
                  <div>
                    <label className="label" htmlFor="targetScore">
                      Target score (optional)
                    </label>
                    <input
                      id="targetScore"
                      className="input"
                      type="number"
                      min={1}
                      max={1000}
                      placeholder="e.g. 21"
                      value={targetScore}
                      onChange={(e) => setTargetScore(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="timerMode">
                      Game timer (optional)
                    </label>
                    <div className="field-row">
                      <select
                        id="timerMode"
                        className="input"
                        value={timerMode}
                        onChange={(e) =>
                          setTimerMode(e.target.value as 'none' | 'countup' | 'countdown')
                        }
                      >
                        <option value="none">No timer</option>
                        <option value="countup">Count up</option>
                        <option value="countdown">Countdown</option>
                      </select>
                      {timerMode === 'countdown' && (
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={240}
                          required
                          aria-label="Countdown minutes"
                          value={timerMinutes}
                          onChange={(e) => setTimerMinutes(e.target.value)}
                          style={{ maxWidth: '5.5rem' }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="switch-row" style={{ marginTop: '1rem' }}>
                  <label htmlFor="commentsEnabled">Allow comments during the match</label>
                  <Switch.Root
                    id="commentsEnabled"
                    className="switch-root"
                    checked={commentsEnabled}
                    onCheckedChange={setCommentsEnabled}
                  >
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                </div>
                <div className="switch-row">
                  <label htmlFor="isPublic">Public — anyone with the code can watch</label>
                  <Switch.Root
                    id="isPublic"
                    className="switch-root"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  >
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                </div>

                {error && <p className="error">{error}</p>}
                <div className="dialog-actions">
                  <Dialog.Close asChild>
                    <button type="button" className="btn">
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    Create match
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {matches === null ? (
        <p className="muted">Loading…</p>
      ) : matches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0 }}>No matches yet — create your first one.</p>
        </div>
      ) : (
        matches.map((match) => {
          const [a, b] = match.teams;
          return (
            <Link to={`/match/${match.id}`} className="card match-card" key={match.id}>
              <div className="match-card-head">
                <strong>
                  {a?.name} vs {b?.name}
                </strong>
                <span className="field-row">
                  <span className={statusBadge[match.status]}>{match.status}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    aria-label={`Delete match ${a?.name} vs ${b?.name}`}
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!window.confirm('Delete this match? Its scores, stats and comments are gone for good.'))
                        return;
                      try {
                        await api(`/api/matches/${match.id}`, { method: 'DELETE' });
                        setMatches((prev) => prev?.filter((m) => m.id !== match.id) ?? prev);
                      } catch {
                        // keep the card if deletion failed
                      }
                    }}
                  >
                    Delete
                  </button>
                </span>
              </div>
              <span className="muted">
                {match.status === 'PENDING'
                  ? `Code ${match.code} · ${new Date(match.createdAt).toLocaleDateString()}`
                  : `${a?.finalScore} – ${b?.finalScore} · Code ${match.code}`}
              </span>
            </Link>
          );
        })
      )}

      <ClaimedProfiles />
    </main>
  );
}

// A2.1 P2 — claim your username to own its stats and history
function ClaimedProfiles() {
  const [claimed, setClaimed] = useState<ClaimedPlayer[]>([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ players: ClaimedPlayer[] }>('/api/players/claimed')
      .then((data) => setClaimed(data.players))
      .catch(() => {});
  }, []);

  async function claim(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const data = await api<{ player: Omit<ClaimedPlayer, 'stats'>; stats: ClaimedPlayer['stats'] }>(
        '/api/players/claim',
        { method: 'POST', body: { username: username.trim() } },
      );
      setClaimed((prev) =>
        prev.some((p) => p.id === data.player.id)
          ? prev
          : [...prev, { ...data.player, stats: data.stats }],
      );
      setUsername('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim that username');
    }
  }

  return (
    <>
      <div className="section-head" style={{ marginTop: '2rem' }}>
        <h2>Your player profile</h2>
      </div>
      <div className="card">
        {claimed.length === 0 ? (
          <p className="muted" style={{ marginTop: 0 }}>
            Played under a username someone else registered? Claim it to own your career stats.
          </p>
        ) : (
          claimed.map((player) => (
            <div className="player-row" key={player.id}>
              <span>
                <strong>{player.displayName}</strong>{' '}
                <span className="muted">@{player.username}</span>
              </span>
              <span className="muted">
                {player.stats.points} pts · {player.stats.games} games · {player.stats.wins} wins ·{' '}
                {player.stats.mvps} MVPs
              </span>
            </div>
          ))
        )}
        <form className="field-row" style={{ marginTop: '0.75rem' }} onSubmit={claim}>
          <input
            className="input"
            placeholder="username"
            aria-label="Username to claim"
            value={username}
            pattern="[a-zA-Z0-9_]{3,20}"
            title="3–20 letters, digits or underscore"
            required
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit" className="btn">
            Claim
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </>
  );
}

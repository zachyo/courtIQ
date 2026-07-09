import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { api, ApiError } from '../api';
import { getSocket, joinMatch, leaveMatch } from '../socket';
import type { CommentEntry, Match, ScoreEventEntry } from '../types';
import ScoreBoard from '../components/ScoreBoard';
import EventFeed from '../components/EventFeed';
import TeamTotals from '../components/TeamTotals';
import CommentPanel from '../components/CommentPanel';
import ThemeToggle from '../components/ThemeToggle';

export default function SpectatePage() {
  const { code = '' } = useParams<{ code: string }>();
  const upperCode = code.toUpperCase();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<ScoreEventEntry[]>([]);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<{ match: Match }>(`/api/matches/code/${upperCode}`),
      api<{ events: ScoreEventEntry[] }>(`/api/matches/code/${upperCode}/events`),
      api<{ comments: CommentEntry[] }>(`/api/matches/code/${upperCode}/comments`),
    ])
      .then(([m, e, c]) => {
        setMatch(m.match);
        setEvents(e.events);
        setComments(c.comments);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError && err.status === 404
            ? `No match found for code ${upperCode}.`
            : 'Could not load the match.',
        );
      });
  }, [upperCode]);

  useEffect(() => {
    const socket = getSocket();
    const onMatch = (payload: { match: Match }) => setMatch(payload.match);
    const onScore = (payload: { match: Match; event: ScoreEventEntry }) => {
      setMatch(payload.match);
      setEvents((prev) => [...prev, payload.event]);
    };
    const onUndo = (payload: { match: Match; eventId: string }) => {
      setMatch(payload.match);
      setEvents((prev) => prev.filter((event) => event.id !== payload.eventId));
    };
    const onComment = (payload: { comment: CommentEntry }) =>
      setComments((prev) => [...prev, payload.comment]);

    joinMatch(upperCode);
    socket.on('match:started', onMatch);
    socket.on('match:ended', onMatch);
    socket.on('match:settings', onMatch);
    socket.on('match:score', onScore);
    socket.on('match:score-undone', onUndo);
    socket.on('match:comment', onComment);

    return () => {
      leaveMatch(upperCode);
      socket.off('match:started', onMatch);
      socket.off('match:ended', onMatch);
      socket.off('match:settings', onMatch);
      socket.off('match:score', onScore);
      socket.off('match:score-undone', onUndo);
      socket.off('match:comment', onComment);
    };
  }, [upperCode]);

  if (error) {
    return (
      <main className="page-center">
        <div className="card" style={{ textAlign: 'center' }}>
          <p>{error}</p>
          <Link to="/login" className="btn">
            Back
          </Link>
        </div>
      </main>
    );
  }

  if (!match) return <main className="page-center muted">Loading…</main>;

  const winner = match.teams.find((team) => team.id === match.winnerTeamId);
  const mvp = match.teams
    .flatMap((team) => team.players)
    .find((player) => player.playerId === match.mvpPlayerId);

  return (
    <>
      <header className="topbar">
        <Link to="/login" className="brand">
          Court<span>IQ</span> 🏀
        </Link>
        <div className="topbar-user">
          <span className="share-code">{match.code}</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="page">
        <ScoreBoard match={match} />

        {match.status === 'FINISHED' && (
          <div className="card" style={{ marginTop: '1rem', textAlign: 'center' }}>
            <strong>{winner ? `${winner.name} win!` : "It's a draw."}</strong>
            {mvp && (
              <span className="muted"> MVP: {mvp.displayName}</span>
            )}
          </div>
        )}

        <div className="grid-2" style={{ marginTop: '1rem' }}>
          <div className="card">
            <Tabs.Root defaultValue="players">
              <Tabs.List className="tabs-list" aria-label="Match details">
                <Tabs.Trigger className="tabs-trigger" value="players">
                  Players
                </Tabs.Trigger>
                <Tabs.Trigger className="tabs-trigger" value="feed">
                  Score feed
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="players">
                <TeamTotals match={match} />
              </Tabs.Content>
              <Tabs.Content value="feed">
                <EventFeed events={events} match={match} />
              </Tabs.Content>
            </Tabs.Root>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Comments</h3>
            <CommentPanel match={match} comments={comments} />
          </div>
        </div>
      </main>
    </>
  );
}

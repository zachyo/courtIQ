import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  addPlayer,
  authHeader,
  createMatch,
  createTestApp,
  registerManager,
  resetDb,
} from './helpers.js';

describe('match lifecycle', () => {
  let app: FastifyInstance;
  let token: string;
  let outsiderToken: string;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    token = (await registerManager(app)).token;
    outsiderToken = (await registerManager(app, 'other@example.com', 'Other')).token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a match with two teams, a code, and settings', async () => {
    const match = await createMatch(app, token, { targetScore: 21, timerSeconds: 600 });
    expect(match.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(match.status).toBe('PENDING');
    expect(match.targetScore).toBe(21);
    expect(match.timerSeconds).toBe(600);
    expect(match.teams).toHaveLength(2);
  });

  it('accepts a count-up timer (timerSeconds 0)', async () => {
    const match = await createMatch(app, token, { timerSeconds: 0 });
    expect(match.timerSeconds).toBe(0);
  });

  it('is not visible to another manager', async () => {
    const match = await createMatch(app, token);
    const res = await app.inject({
      method: 'GET',
      url: `/api/matches/${match.id}`,
      headers: authHeader(outsiderToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('runs the full flow: teams → start → score → undo → end → stats', async () => {
    const match = await createMatch(app, token);
    const [red, blue] = match.teams;

    // Add players — a brand-new username and reuse of an existing one
    expect((await addPlayer(app, token, match.id, red.id, 'ada')).statusCode).toBe(201);
    expect((await addPlayer(app, token, match.id, red.id, 'grace')).statusCode).toBe(201);
    expect((await addPlayer(app, token, match.id, blue.id, 'alan')).statusCode).toBe(201);

    // Same player twice in one match → conflict
    expect((await addPlayer(app, token, match.id, blue.id, 'ada')).statusCode).toBe(409);

    // Spectator can look the match up by code without a token
    const byCode = await app.inject({ method: 'GET', url: `/api/matches/code/${match.code}` });
    expect(byCode.statusCode).toBe(200);
    expect(byCode.json().match.teams[0].players).toHaveLength(2);

    // Start, then score
    const started = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/start`,
      headers: authHeader(token),
    });
    expect(started.statusCode).toBe(200);
    expect(started.json().match.status).toBe('LIVE');
    expect(started.json().match.startedAt).toBeTruthy();

    const current = started.json().match;
    const ada = current.teams[0].players.find((p: { username: string }) => p.username === 'ada');
    const alan = current.teams[1].players.find((p: { username: string }) => p.username === 'alan');

    async function score(matchPlayerId: string, points: number) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/matches/${match.id}/score`,
        headers: authHeader(token),
        payload: { matchPlayerId, points },
      });
      expect(res.statusCode).toBe(201);
      return res.json().match;
    }

    await score(ada.id, 2);
    await score(ada.id, 3);
    let after = await score(alan.id, 1);
    expect(after.teams[0].finalScore).toBe(5);
    expect(after.teams[1].finalScore).toBe(1);

    // Undo removes the last event and restores totals
    const undo = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/undo`,
      headers: authHeader(token),
    });
    expect(undo.statusCode).toBe(200);
    expect(undo.json().match.teams[1].finalScore).toBe(0);

    // The undone event no longer shows in the spectator feed
    const events = await app.inject({
      method: 'GET',
      url: `/api/matches/code/${match.code}/events`,
    });
    expect(events.json().events).toHaveLength(2);

    // Only the comments toggle may change while live
    const badSettings = await app.inject({
      method: 'PATCH',
      url: `/api/matches/${match.id}/settings`,
      headers: authHeader(token),
      payload: { targetScore: 30 },
    });
    expect(badSettings.statusCode).toBe(400);

    // End: winner finalised, MVP auto-suggested (ada, outright top scorer)
    const ended = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/end`,
      headers: authHeader(token),
    });
    expect(ended.statusCode).toBe(200);
    const final = ended.json().match;
    expect(final.status).toBe('FINISHED');
    expect(final.winnerTeamId).toBe(red.id);
    expect(final.mvpPlayerId).toBe(ada.playerId);

    // Scoring a finished match fails
    const late = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/score`,
      headers: authHeader(token),
      payload: { matchPlayerId: ada.id, points: 2 },
    });
    expect(late.statusCode).toBe(400);

    // Stats: leaderboard, winner, MVP — also public via code
    const stats = await app.inject({
      method: 'GET',
      url: `/api/matches/${match.id}/stats`,
      headers: authHeader(token),
    });
    expect(stats.statusCode).toBe(200);
    expect(stats.json().winner.id).toBe(red.id);
    expect(stats.json().leaderboard[0].username).toBe('ada');
    expect(stats.json().leaderboard[0].points).toBe(5);

    const publicStats = await app.inject({
      method: 'GET',
      url: `/api/matches/code/${match.code}/stats`,
    });
    expect(publicStats.statusCode).toBe(200);

    // Manual MVP override
    const mvp = await app.inject({
      method: 'PATCH',
      url: `/api/matches/${match.id}/mvp`,
      headers: authHeader(token),
      payload: { playerId: alan.playerId },
    });
    expect(mvp.statusCode).toBe(200);
    expect(mvp.json().mvp.username).toBe('alan');
  });

  it('refuses to start with an empty team', async () => {
    const match = await createMatch(app, token);
    await addPlayer(app, token, match.id, match.teams[0].id, 'solo');
    const res = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/start`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(400);
  });

  it('hides private matches from spectators', async () => {
    const match = await createMatch(app, token, { visibility: 'PRIVATE' });
    const res = await app.inject({ method: 'GET', url: `/api/matches/code/${match.code}` });
    expect(res.statusCode).toBe(404);
  });

  it('undo with no events fails cleanly', async () => {
    const match = await createMatch(app, token);
    await addPlayer(app, token, match.id, match.teams[0].id, 'p_one');
    await addPlayer(app, token, match.id, match.teams[1].id, 'p_two');
    await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/start`,
      headers: authHeader(token),
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/undo`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(400);
  });
});

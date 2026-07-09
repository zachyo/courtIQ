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

describe('comments, roster and claiming', () => {
  let app: FastifyInstance;
  let token: string;
  let playerToken: string;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    token = (await registerManager(app)).token;
    playerToken = (await registerManager(app, 'ada@example.com', 'Ada')).token;
  });

  afterAll(async () => {
    await app.close();
  });

  async function liveMatch(overrides: Record<string, unknown> = {}) {
    const match = await createMatch(app, token, overrides);
    await addPlayer(app, token, match.id, match.teams[0].id, 'ada');
    await addPlayer(app, token, match.id, match.teams[1].id, 'alan');
    const started = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/start`,
      headers: authHeader(token),
    });
    return started.json().match;
  }

  it('lets anonymous spectators comment on a live match', async () => {
    const match = await liveMatch();
    const res = await app.inject({
      method: 'POST',
      url: `/api/matches/code/${match.code}/comments`,
      payload: { authorName: 'Courtside Fan', body: 'What a shot!' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().comment.isManager).toBe(false);

    // Manager comments are tagged when a valid token is attached
    const managerComment = await app.inject({
      method: 'POST',
      url: `/api/matches/code/${match.code}/comments`,
      headers: authHeader(token),
      payload: { authorName: 'Coach', body: 'Keep it up' },
    });
    expect(managerComment.json().comment.isManager).toBe(true);

    // No name (or a blank one) posts as "Anonymous" — distinct IP so this
    // spectator doesn't eat into the shared per-IP comment rate limit
    const anonymous = await app.inject({
      method: 'POST',
      url: `/api/matches/code/${match.code}/comments`,
      remoteAddress: '10.0.0.2',
      payload: { body: 'great game' },
    });
    expect(anonymous.statusCode).toBe(201);
    expect(anonymous.json().comment.authorName).toBe('Anonymous');

    const blankName = await app.inject({
      method: 'POST',
      url: `/api/matches/code/${match.code}/comments`,
      remoteAddress: '10.0.0.2',
      payload: { authorName: '   ', body: 'so close!' },
    });
    expect(blankName.json().comment.authorName).toBe('Anonymous');

    const list = await app.inject({
      method: 'GET',
      url: `/api/matches/code/${match.code}/comments`,
    });
    expect(list.json().comments).toHaveLength(4);
  });

  it('blocks comments when disabled in settings, allows again after mid-match toggle', async () => {
    const match = await liveMatch({ commentsEnabled: false });
    const blocked = await app.inject({
      method: 'POST',
      url: `/api/matches/code/${match.code}/comments`,
      payload: { authorName: 'Fan', body: 'hello?' },
    });
    expect(blocked.statusCode).toBe(403);

    // Mid-match toggle is the one live settings change allowed
    const toggled = await app.inject({
      method: 'PATCH',
      url: `/api/matches/${match.id}/settings`,
      headers: authHeader(token),
      payload: { commentsEnabled: true },
    });
    expect(toggled.statusCode).toBe(200);

    const allowed = await app.inject({
      method: 'POST',
      url: `/api/matches/code/${match.code}/comments`,
      payload: { authorName: 'Fan', body: 'hello!' },
    });
    expect(allowed.statusCode).toBe(201);
  });

  it('blocks comments before the match starts', async () => {
    const match = await createMatch(app, token);
    const res = await app.inject({
      method: 'POST',
      url: `/api/matches/code/${match.code}/comments`,
      payload: { authorName: 'Early Bird', body: 'tip-off when?' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('keeps players on the roster and accumulates career stats', async () => {
    const match = await liveMatch();
    const ada = match.teams[0].players[0];
    await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/score`,
      headers: authHeader(token),
      payload: { matchPlayerId: ada.id, points: 3 },
    });
    await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/end`,
      headers: authHeader(token),
    });

    const kept = await app.inject({
      method: 'POST',
      url: '/api/players/keep',
      headers: authHeader(token),
      payload: { playerIds: [ada.playerId] },
    });
    expect(kept.statusCode).toBe(200);
    expect(kept.json().players[0].keptForFuture).toBe(true);

    const stats = await app.inject({
      method: 'GET',
      url: `/api/players/${ada.playerId}/stats`,
      headers: authHeader(token),
    });
    expect(stats.statusCode).toBe(200);
    const career = stats.json().stats;
    expect(career.games).toBeGreaterThanOrEqual(1);
    expect(career.points).toBeGreaterThanOrEqual(3);
    expect(career.wins).toBeGreaterThanOrEqual(1);
    expect(career.mvps).toBeGreaterThanOrEqual(1);
  });

  it('lets a player claim their username exactly once', async () => {
    const claim = await app.inject({
      method: 'POST',
      url: '/api/players/claim',
      headers: authHeader(playerToken),
      payload: { username: 'ada' },
    });
    expect(claim.statusCode).toBe(201);
    expect(claim.json().player.claimed).toBe(true);
    expect(claim.json().stats.games).toBeGreaterThanOrEqual(1);

    // Claiming again from the same account is idempotent
    const again = await app.inject({
      method: 'POST',
      url: '/api/players/claim',
      headers: authHeader(playerToken),
      payload: { username: 'ada' },
    });
    expect(again.statusCode).toBe(200);

    // Someone else can't take it over
    const thief = await registerManager(app, 'thief@example.com', 'Thief');
    const steal = await app.inject({
      method: 'POST',
      url: '/api/players/claim',
      headers: authHeader(thief.token),
      payload: { username: 'ada' },
    });
    expect(steal.statusCode).toBe(409);

    // Unknown username
    const missing = await app.inject({
      method: 'POST',
      url: '/api/players/claim',
      headers: authHeader(playerToken),
      payload: { username: 'nobody_here' },
    });
    expect(missing.statusCode).toBe(404);

    // Claimant sees their profiles and career stats
    const claimed = await app.inject({
      method: 'GET',
      url: '/api/players/claimed',
      headers: authHeader(playerToken),
    });
    expect(claimed.json().players).toHaveLength(1);
    expect(claimed.json().players[0].username).toBe('ada');

    const playerStats = await app.inject({
      method: 'GET',
      url: `/api/players/${claim.json().player.id}/stats`,
      headers: authHeader(playerToken),
    });
    expect(playerStats.statusCode).toBe(200);
  });
});

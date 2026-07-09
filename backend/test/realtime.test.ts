import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  addPlayer,
  authHeader,
  createMatch,
  createTestApp,
  registerManager,
  resetDb,
} from './helpers.js';

describe('realtime spectating', () => {
  let app: FastifyInstance;
  let token: string;
  let client: Socket;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    token = (await registerManager(app)).token;
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    client?.disconnect();
    await app.close();
  });

  it('pushes score events to spectators in the match room', async () => {
    const match = await createMatch(app, token);
    await addPlayer(app, token, match.id, match.teams[0].id, 'shooter');
    await addPlayer(app, token, match.id, match.teams[1].id, 'defender');
    const started = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/start`,
      headers: authHeader(token),
    });
    const live = started.json().match;
    const shooter = live.teams[0].players[0];

    const port = (app.server.address() as AddressInfo).port;
    client = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    await new Promise<void>((resolve) => client.on('connect', () => resolve()));
    client.emit('match:join', match.code);

    const received = new Promise<{ match: { teams: { finalScore: number }[] } }>((resolve) =>
      client.once('match:score', resolve),
    );

    const scored = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/score`,
      headers: authHeader(token),
      payload: { matchPlayerId: shooter.id, points: 3 },
    });
    expect(scored.statusCode).toBe(201);

    const payload = await received;
    expect(payload.match.teams[0].finalScore).toBe(3);
  });

  it('never broadcasts private matches to code-joined rooms', async () => {
    const match = await createMatch(app, token, { visibility: 'PRIVATE' });
    await addPlayer(app, token, match.id, match.teams[0].id, 'quiet_one');
    await addPlayer(app, token, match.id, match.teams[1].id, 'quiet_two');
    const started = await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/start`,
      headers: authHeader(token),
    });
    const live = started.json().match;

    client.emit('match:join', match.code);
    let leaked = false;
    const listener = () => {
      leaked = true;
    };
    client.on('match:score', listener);

    await app.inject({
      method: 'POST',
      url: `/api/matches/${match.id}/score`,
      headers: authHeader(token),
      payload: { matchPlayerId: live.teams[0].players[0].id, points: 2 },
    });

    // Give a broadcast time to arrive if one were (wrongly) sent
    await new Promise((resolve) => setTimeout(resolve, 300));
    client.off('match:score', listener);
    expect(leaked).toBe(false);
  });
});

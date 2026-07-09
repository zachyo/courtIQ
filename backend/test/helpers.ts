import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

// Wipe everything between test files; cascades cover dependent rows
export async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE "User", "Player", "Match" CASCADE');
}

export async function registerManager(
  app: FastifyInstance,
  email = 'manager@example.com',
  displayName = 'Coach',
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'password123', displayName },
  });
  const body = res.json();
  return { token: body.token as string, user: body.user as { id: string } };
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

export async function createMatch(
  app: FastifyInstance,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/matches',
    headers: authHeader(token),
    payload: {
      teams: [
        { name: 'Red', colour: '#ff0000' },
        { name: 'Blue', colour: '#0000ff' },
      ],
      ...overrides,
    },
  });
  return res.json().match;
}

export async function addPlayer(
  app: FastifyInstance,
  token: string,
  matchId: string,
  teamId: string,
  username: string,
) {
  const res = await app.inject({
    method: 'POST',
    url: `/api/matches/${matchId}/players`,
    headers: authHeader(token),
    payload: { teamId, username },
  });
  return res;
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, resetDb } from './helpers.js';

describe('auth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a manager and returns a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'coach@example.com', password: 'password123', displayName: 'Coach' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('coach@example.com');
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'COACH@example.com', password: 'password123', displayName: 'Copy' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects a weak password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'short@example.com', password: 'short', displayName: 'S' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'coach@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'coach@example.com', password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns the current user on /me and rejects missing tokens', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'coach@example.com', password: 'password123' },
    });
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${login.json().token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.displayName).toBe('Coach');

    const anonymous = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(anonymous.statusCode).toBe(401);
  });
});

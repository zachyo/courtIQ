import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { env } from './env.js';
import authPlugin from './plugins/auth.js';
import realtimePlugin from './plugins/realtime.js';
import { authRoutes } from './modules/auth/routes.js';
import { playerRoutes } from './modules/players/routes.js';
import { matchRoutes } from './modules/matches/routes.js';
import { scoringRoutes } from './modules/scoring/routes.js';
import { statsRoutes } from './modules/stats/routes.js';
import { commentRoutes } from './modules/comments/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger:
      env.nodeEnv === 'test'
        ? false
        : { level: env.nodeEnv === 'production' ? 'info' : 'debug' },
  });

  await app.register(cors, { origin: env.corsOrigin });
  // Per-route opt-in via each route's config.rateLimit
  await app.register(rateLimit, { global: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(realtimePlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(playerRoutes, { prefix: '/api/players' });
  await app.register(matchRoutes, { prefix: '/api/matches' });
  await app.register(scoringRoutes, { prefix: '/api/matches' });
  await app.register(statsRoutes, { prefix: '/api/matches' });
  await app.register(commentRoutes, { prefix: '/api/matches' });

  if (env.frontendDist && fs.existsSync(env.frontendDist)) {
    await app.register(fastifyStatic, { root: env.frontendDist });
    // SPA fallback: unknown GET paths (e.g. /watch/ABC123) get index.html
    app.setNotFoundHandler((request, reply) => {
      if (
        request.method === 'GET' &&
        !request.url.startsWith('/api') &&
        !request.url.startsWith('/socket.io')
      ) {
        return reply.sendFile('index.html');
      }
      return reply.notFound();
    });
  }

  return app;
}

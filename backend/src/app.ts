import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { env } from './env.js';
import authPlugin from './plugins/auth.js';
import realtimePlugin from './plugins/realtime.js';
import { authRoutes } from './modules/auth/routes.js';
import { playerRoutes } from './modules/players/routes.js';
import { matchRoutes } from './modules/matches/routes.js';
import { scoringRoutes } from './modules/scoring/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, { origin: env.corsOrigin });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(realtimePlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(playerRoutes, { prefix: '/api/players' });
  await app.register(matchRoutes, { prefix: '/api/matches' });
  await app.register(scoringRoutes, { prefix: '/api/matches' });

  return app;
}

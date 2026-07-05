import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { env } from './env.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, { origin: env.corsOrigin });
  await app.register(sensible);
  await app.register(authPlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api/auth' });

  return app;
}

import fp from 'fastify-plugin';
import type { Server } from 'socket.io';
import { createRealtime } from '../realtime/socket.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

export default fp(async (app) => {
  const io = createRealtime(app.server);
  app.decorate('io', io);
  app.addHook('onClose', async () => {
    io.close();
  });
});

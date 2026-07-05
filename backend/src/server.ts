import { buildApp } from './app.js';
import { createRealtime } from './realtime/socket.js';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';

const app = await buildApp();
const io = createRealtime(app.server);

app.addHook('onClose', async () => {
  io.close();
  await prisma.$disconnect();
});

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';

const credentialsBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8, maxLength: 128 },
  },
  additionalProperties: false,
} as const;

const registerBody = {
  ...credentialsBody,
  required: ['email', 'password', 'displayName'],
  properties: {
    ...credentialsBody.properties,
    displayName: { type: 'string', minLength: 1, maxLength: 60 },
  },
} as const;

function publicUser(user: { id: string; email: string; displayName: string; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string; displayName: string } }>(
    '/register',
    {
      schema: { body: registerBody },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { email, password, displayName } = request.body;

      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return reply.conflict('An account with this email already exists');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email: email.toLowerCase(), passwordHash, displayName },
      });

      const token = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' });
      return reply.code(201).send({ token, user: publicUser(user) });
    },
  );

  app.post<{ Body: { email: string; password: string } }>(
    '/login',
    {
      schema: { body: credentialsBody },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return reply.unauthorized('Invalid email or password');
      }

      const token = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' });
      return { token, user: publicUser(user) };
    },
  );

  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) {
      return reply.unauthorized('Account no longer exists');
    }
    return { user: publicUser(user) };
  });
}

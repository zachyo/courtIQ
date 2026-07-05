import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const USERNAME_PATTERN = '^[a-zA-Z0-9_]{3,20}$';

export function publicPlayer(player: {
  id: string;
  username: string;
  displayName: string;
  avatarColour: string | null;
  keptForFuture: boolean;
}) {
  return {
    id: player.id,
    username: player.username,
    displayName: player.displayName,
    avatarColour: player.avatarColour,
    keptForFuture: player.keptForFuture,
  };
}

export async function playerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // The manager's own players (their roster), optionally filtered by username
  app.get<{ Querystring: { query?: string } }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: { query: { type: 'string', maxLength: 20 } },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const players = await prisma.player.findMany({
        where: {
          managerId: request.user.sub,
          ...(request.query.query
            ? { username: { contains: request.query.query.toLowerCase() } }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return { players: players.map(publicPlayer) };
    },
  );

  // Exact-username lookup — lets a manager find any existing player to assign
  app.get<{ Params: { username: string } }>(
    '/lookup/:username',
    {
      schema: {
        params: {
          type: 'object',
          required: ['username'],
          properties: { username: { type: 'string', pattern: USERNAME_PATTERN } },
        },
      },
    },
    async (request, reply) => {
      const player = await prisma.player.findUnique({
        where: { username: request.params.username.toLowerCase() },
      });
      if (!player) {
        return reply.notFound('No player with that username');
      }
      return { player: publicPlayer(player) };
    },
  );
}

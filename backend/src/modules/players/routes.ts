import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const USERNAME_PATTERN = '^[a-zA-Z0-9_]{3,20}$';

export function publicPlayer(player: {
  id: string;
  username: string;
  displayName: string;
  avatarColour: string | null;
  keptForFuture: boolean;
  claimedByUserId: string | null;
}) {
  return {
    id: player.id,
    username: player.username,
    displayName: player.displayName,
    avatarColour: player.avatarColour,
    keptForFuture: player.keptForFuture,
    claimed: player.claimedByUserId !== null,
  };
}

async function careerStats(playerId: string) {
  const appearances = await prisma.matchPlayer.findMany({
    where: { playerId, match: { status: 'FINISHED' } },
    include: { match: true },
  });
  return {
    games: appearances.length,
    points: appearances.reduce((sum, mp) => sum + mp.points, 0),
    wins: appearances.filter((mp) => mp.match.winnerTeamId === mp.teamId).length,
    mvps: appearances.filter((mp) => mp.match.mvpPlayerId === playerId).length,
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
        take: 100,
      });
      return { players: players.map(publicPlayer) };
    },
  );

  // Post-match prompt: keep (or unkeep) players for future games
  app.post<{ Body: { playerIds: string[]; keep?: boolean } }>(
    '/keep',
    {
      schema: {
        body: {
          type: 'object',
          required: ['playerIds'],
          properties: {
            playerIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 30,
            },
            keep: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const keep = request.body.keep ?? true;
      await prisma.player.updateMany({
        where: { id: { in: request.body.playerIds }, managerId: request.user.sub },
        data: { keptForFuture: keep },
      });
      const players = await prisma.player.findMany({
        where: { id: { in: request.body.playerIds }, managerId: request.user.sub },
      });
      return { players: players.map(publicPlayer) };
    },
  );

  // Career stats across finished matches — visible to the player's manager
  // and to the account that claimed the username
  app.get<{ Params: { id: string } }>('/:id/stats', async (request, reply) => {
    const player = await prisma.player.findUnique({ where: { id: request.params.id } });
    if (
      !player ||
      (player.managerId !== request.user.sub && player.claimedByUserId !== request.user.sub)
    ) {
      return reply.notFound('Player not found');
    }

    return {
      player: publicPlayer(player),
      stats: await careerStats(player.id),
    };
  });

  // Claim a username: the person behind a player links it to their own
  // account to own its stats and history (PRD A2.1, P2). First come, first
  // served — an already-claimed username can't be taken over.
  app.post<{ Body: { username: string } }>(
    '/claim',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username'],
          properties: { username: { type: 'string', pattern: USERNAME_PATTERN } },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const username = request.body.username.toLowerCase();
      const player = await prisma.player.findUnique({ where: { username } });
      if (!player) return reply.notFound('No player with that username');
      if (player.claimedByUserId === request.user.sub) {
        return { player: publicPlayer(player), stats: await careerStats(player.id) };
      }
      if (player.claimedByUserId !== null) {
        return reply.conflict('That username has already been claimed');
      }

      const updated = await prisma.player.update({
        where: { id: player.id },
        data: { claimedByUserId: request.user.sub },
      });
      return reply
        .code(201)
        .send({ player: publicPlayer(updated), stats: await careerStats(updated.id) });
    },
  );

  // The usernames this account has claimed, with career stats
  app.get('/claimed', async (request) => {
    const players = await prisma.player.findMany({
      where: { claimedByUserId: request.user.sub },
      orderBy: { createdAt: 'asc' },
    });
    return {
      players: await Promise.all(
        players.map(async (player) => ({
          ...publicPlayer(player),
          stats: await careerStats(player.id),
        })),
      ),
    };
  });

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

import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { uniqueMatchCode } from '../../lib/matchCode.js';
import { broadcastToMatch } from '../../realtime/socket.js';
import { USERNAME_PATTERN } from '../players/routes.js';
import { matchInclude, serializeMatch } from './serializers.js';

const teamSchema = {
  type: 'object',
  required: ['name', 'colour'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 30 },
    colour: { type: 'string', minLength: 1, maxLength: 20 },
  },
  additionalProperties: false,
} as const;

const settingsProperties = {
  commentsEnabled: { type: 'boolean' },
  visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
  targetScore: { type: ['integer', 'null'], minimum: 1, maximum: 1000 },
  timerSeconds: { type: ['integer', 'null'], minimum: 60, maximum: 14400 },
} as const;

const createMatchBody = {
  type: 'object',
  required: ['teams'],
  properties: {
    teams: { type: 'array', items: teamSchema, minItems: 2, maxItems: 2 },
    ...settingsProperties,
  },
  additionalProperties: false,
} as const;

const addPlayerBody = {
  type: 'object',
  required: ['teamId', 'username'],
  properties: {
    teamId: { type: 'string' },
    username: { type: 'string', pattern: USERNAME_PATTERN },
    displayName: { type: 'string', minLength: 1, maxLength: 60 },
    avatarColour: { type: 'string', maxLength: 20 },
  },
  additionalProperties: false,
} as const;

async function loadOwnedMatch(matchId: string, managerId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: matchInclude,
  });
  if (!match || match.managerId !== managerId) return null;
  return match;
}

export async function matchRoutes(app: FastifyInstance) {
  // Public spectator lookup by match code — no account needed
  app.get<{ Params: { code: string } }>(
    '/code/:code',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: { code: { type: 'string', minLength: 4, maxLength: 10 } },
        },
      },
    },
    async (request, reply) => {
      const match = await prisma.match.findUnique({
        where: { code: request.params.code.toUpperCase() },
        include: matchInclude,
      });
      if (!match || match.visibility === 'PRIVATE') {
        return reply.notFound('No match with that code');
      }
      return { match: serializeMatch(match) };
    },
  );

  // Everything below is manager-only
  app.register(async (managerRoutes) => {
    managerRoutes.addHook('preHandler', app.authenticate);

    managerRoutes.post<{
      Body: {
        teams: { name: string; colour: string }[];
        commentsEnabled?: boolean;
        visibility?: 'PUBLIC' | 'PRIVATE';
        targetScore?: number | null;
        timerSeconds?: number | null;
      };
    }>('/', { schema: { body: createMatchBody } }, async (request, reply) => {
      const { teams, commentsEnabled, visibility, targetScore, timerSeconds } = request.body;

      const match = await prisma.match.create({
        data: {
          code: await uniqueMatchCode(),
          managerId: request.user.sub,
          commentsEnabled: commentsEnabled ?? true,
          visibility: visibility ?? 'PUBLIC',
          targetScore: targetScore ?? null,
          timerSeconds: timerSeconds ?? null,
          teams: { create: teams },
        },
        include: matchInclude,
      });

      return reply.code(201).send({ match: serializeMatch(match) });
    });

    managerRoutes.get('/', async (request) => {
      const matches = await prisma.match.findMany({
        where: { managerId: request.user.sub },
        include: matchInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return { matches: matches.map(serializeMatch) };
    });

    managerRoutes.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
      const match = await loadOwnedMatch(request.params.id, request.user.sub);
      if (!match) return reply.notFound('Match not found');
      return { match: serializeMatch(match) };
    });

    // Deleting a match cascades to teams, match players, score events, comments
    managerRoutes.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
      const match = await loadOwnedMatch(request.params.id, request.user.sub);
      if (!match) return reply.notFound('Match not found');
      await prisma.match.delete({ where: { id: match.id } });
      return { deleted: true };
    });

    // Update settings while pending; only the comments toggle once live
    managerRoutes.patch<{
      Params: { id: string };
      Body: {
        commentsEnabled?: boolean;
        visibility?: 'PUBLIC' | 'PRIVATE';
        targetScore?: number | null;
        timerSeconds?: number | null;
      };
    }>(
      '/:id/settings',
      {
        schema: {
          body: { type: 'object', properties: settingsProperties, additionalProperties: false },
        },
      },
      async (request, reply) => {
        const match = await loadOwnedMatch(request.params.id, request.user.sub);
        if (!match) return reply.notFound('Match not found');
        if (match.status === 'FINISHED') {
          return reply.badRequest('Settings cannot be changed after the match ends');
        }
        if (
          match.status === 'LIVE' &&
          Object.keys(request.body).some((key) => key !== 'commentsEnabled')
        ) {
          return reply.badRequest('Only comments can be toggled while the match is live');
        }

        const updated = await prisma.match.update({
          where: { id: match.id },
          data: request.body,
          include: matchInclude,
        });

        const serialized = serializeMatch(updated);
        if (match.status === 'LIVE') {
          broadcastToMatch(app.io, updated, 'match:settings', { match: serialized });
        }
        return { match: serialized };
      },
    );

    // Add a player to a team — new unique username or an existing player
    managerRoutes.post<{
      Params: { id: string };
      Body: { teamId: string; username: string; displayName?: string; avatarColour?: string };
    }>('/:id/players', { schema: { body: addPlayerBody } }, async (request, reply) => {
      const match = await loadOwnedMatch(request.params.id, request.user.sub);
      if (!match) return reply.notFound('Match not found');
      if (match.status !== 'PENDING') {
        return reply.badRequest('Players can only be added before the match starts');
      }
      if (!match.teams.some((team) => team.id === request.body.teamId)) {
        return reply.badRequest('That team is not part of this match');
      }

      const username = request.body.username.toLowerCase();
      let player = await prisma.player.findUnique({ where: { username } });
      if (!player) {
        player = await prisma.player.create({
          data: {
            username,
            displayName: request.body.displayName ?? request.body.username,
            avatarColour: request.body.avatarColour ?? null,
            managerId: request.user.sub,
          },
        });
      }

      if (match.teams.some((team) => team.players.some((mp) => mp.playerId === player.id))) {
        return reply.conflict(`@${username} is already in this match`);
      }

      await prisma.matchPlayer.create({
        data: { matchId: match.id, teamId: request.body.teamId, playerId: player.id },
      });

      const updated = await loadOwnedMatch(match.id, request.user.sub);
      return reply.code(201).send({ match: serializeMatch(updated!) });
    });

    // Remove a player from the match before it starts
    managerRoutes.delete<{ Params: { id: string; matchPlayerId: string } }>(
      '/:id/players/:matchPlayerId',
      async (request, reply) => {
        const match = await loadOwnedMatch(request.params.id, request.user.sub);
        if (!match) return reply.notFound('Match not found');
        if (match.status !== 'PENDING') {
          return reply.badRequest('Players can only be removed before the match starts');
        }

        const matchPlayer = match.teams
          .flatMap((team) => team.players)
          .find((mp) => mp.id === request.params.matchPlayerId);
        if (!matchPlayer) return reply.notFound('That player is not in this match');

        await prisma.matchPlayer.delete({ where: { id: matchPlayer.id } });

        const updated = await loadOwnedMatch(match.id, request.user.sub);
        return { match: serializeMatch(updated!) };
      },
    );
  });
}

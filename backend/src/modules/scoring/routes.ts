import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { matchRoom } from '../../realtime/socket.js';
import { matchInclude, serializeMatch, type MatchWithTeams } from '../matches/serializers.js';

const scoreBody = {
  type: 'object',
  required: ['matchPlayerId', 'points'],
  properties: {
    matchPlayerId: { type: 'string' },
    points: { type: 'integer', enum: [1, 2, 3] },
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

export async function scoringRoutes(app: FastifyInstance) {
  // Spectators join the socket room by code, so PRIVATE matches stay silent
  function broadcast(match: MatchWithTeams, event: string, payload: unknown) {
    if (match.visibility === 'PUBLIC') {
      app.io.to(matchRoom(match.code)).emit(event, payload);
    }
  }

  // Public: live event feed for spectators (score timeline)
  app.get<{ Params: { code: string } }>('/code/:code/events', async (request, reply) => {
    const match = await prisma.match.findUnique({
      where: { code: request.params.code.toUpperCase() },
    });
    if (!match || match.visibility === 'PRIVATE') {
      return reply.notFound('No match with that code');
    }

    const events = await prisma.scoreEvent.findMany({
      where: { matchId: match.id, undone: false },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { matchPlayer: { include: { player: true } }, team: true },
    });

    return {
      events: events.map((event) => ({
        id: event.id,
        points: event.points,
        username: event.matchPlayer.player.username,
        displayName: event.matchPlayer.player.displayName,
        teamId: event.teamId,
        teamName: event.team.name,
        createdAt: event.createdAt,
      })),
    };
  });

  app.register(async (managerRoutes) => {
    managerRoutes.addHook('preHandler', app.authenticate);

    managerRoutes.post<{ Params: { id: string } }>('/:id/start', async (request, reply) => {
      const match = await loadOwnedMatch(request.params.id, request.user.sub);
      if (!match) return reply.notFound('Match not found');
      if (match.status !== 'PENDING') {
        return reply.badRequest('Only a pending match can be started');
      }
      if (match.teams.some((team) => team.players.length === 0)) {
        return reply.badRequest('Both teams need at least one player');
      }

      const updated = await prisma.match.update({
        where: { id: match.id },
        data: { status: 'LIVE', startedAt: new Date() },
        include: matchInclude,
      });

      const serialized = serializeMatch(updated);
      broadcast(updated, 'match:started', { match: serialized });
      return { match: serialized };
    });

    managerRoutes.post<{ Params: { id: string }; Body: { matchPlayerId: string; points: 1 | 2 | 3 } }>(
      '/:id/score',
      { schema: { body: scoreBody } },
      async (request, reply) => {
        const match = await loadOwnedMatch(request.params.id, request.user.sub);
        if (!match) return reply.notFound('Match not found');
        if (match.status !== 'LIVE') {
          return reply.badRequest('Scores can only be awarded while the match is live');
        }

        const matchPlayer = match.teams
          .flatMap((team) => team.players)
          .find((mp) => mp.id === request.body.matchPlayerId);
        if (!matchPlayer) return reply.badRequest('That player is not in this match');

        const { points } = request.body;
        const [event] = await prisma.$transaction([
          prisma.scoreEvent.create({
            data: {
              matchId: match.id,
              matchPlayerId: matchPlayer.id,
              teamId: matchPlayer.teamId,
              points,
            },
          }),
          prisma.matchPlayer.update({
            where: { id: matchPlayer.id },
            data: { points: { increment: points } },
          }),
          prisma.matchTeam.update({
            where: { id: matchPlayer.teamId },
            data: { finalScore: { increment: points } },
          }),
        ]);

        const updated = (await loadOwnedMatch(match.id, request.user.sub))!;
        const serialized = serializeMatch(updated);
        broadcast(updated, 'match:score', {
          match: serialized,
          event: {
            id: event.id,
            points: event.points,
            username: matchPlayer.player.username,
            displayName: matchPlayer.player.displayName,
            teamId: matchPlayer.teamId,
            createdAt: event.createdAt,
          },
        });
        return reply.code(201).send({ match: serialized, eventId: event.id });
      },
    );

    managerRoutes.post<{ Params: { id: string } }>('/:id/undo', async (request, reply) => {
      const match = await loadOwnedMatch(request.params.id, request.user.sub);
      if (!match) return reply.notFound('Match not found');
      if (match.status !== 'LIVE') {
        return reply.badRequest('Scores can only be undone while the match is live');
      }

      const lastEvent = await prisma.scoreEvent.findFirst({
        where: { matchId: match.id, undone: false },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (!lastEvent) return reply.badRequest('No score events to undo');

      await prisma.$transaction([
        prisma.scoreEvent.update({ where: { id: lastEvent.id }, data: { undone: true } }),
        prisma.matchPlayer.update({
          where: { id: lastEvent.matchPlayerId },
          data: { points: { decrement: lastEvent.points } },
        }),
        prisma.matchTeam.update({
          where: { id: lastEvent.teamId },
          data: { finalScore: { decrement: lastEvent.points } },
        }),
      ]);

      const updated = (await loadOwnedMatch(match.id, request.user.sub))!;
      const serialized = serializeMatch(updated);
      broadcast(updated, 'match:score-undone', { match: serialized, eventId: lastEvent.id });
      return { match: serialized, undoneEventId: lastEvent.id };
    });

    managerRoutes.post<{ Params: { id: string } }>('/:id/end', async (request, reply) => {
      const match = await loadOwnedMatch(request.params.id, request.user.sub);
      if (!match) return reply.notFound('Match not found');
      if (match.status !== 'LIVE') {
        return reply.badRequest('Only a live match can be ended');
      }

      const [teamA, teamB] = match.teams;
      const winnerTeamId =
        teamA.finalScore === teamB.finalScore
          ? null
          : teamA.finalScore > teamB.finalScore
            ? teamA.id
            : teamB.id;

      const updated = await prisma.match.update({
        where: { id: match.id },
        data: { status: 'FINISHED', endedAt: new Date(), winnerTeamId },
        include: matchInclude,
      });

      const serialized = serializeMatch(updated);
      broadcast(updated, 'match:ended', { match: serialized });
      return { match: serialized };
    });
  });
}

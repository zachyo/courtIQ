import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { broadcastToMatch } from '../../realtime/socket.js';
import { matchInclude, serializeMatch, type MatchWithTeams } from '../matches/serializers.js';

function buildStats(match: MatchWithTeams) {
  const leaderboard = match.teams
    .flatMap((team) =>
      team.players.map((mp) => ({
        matchPlayerId: mp.id,
        playerId: mp.playerId,
        username: mp.player.username,
        displayName: mp.player.displayName,
        teamId: team.id,
        teamName: team.name,
        points: mp.points,
      })),
    )
    .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));

  const winner = match.teams.find((team) => team.id === match.winnerTeamId) ?? null;
  const mvp = leaderboard.find((entry) => entry.playerId === match.mvpPlayerId) ?? null;

  return {
    match: serializeMatch(match),
    leaderboard,
    winner: winner ? { id: winner.id, name: winner.name, finalScore: winner.finalScore } : null,
    mvp,
  };
}

export async function statsRoutes(app: FastifyInstance) {
  // Public: stats for spectators via match code
  app.get<{ Params: { code: string } }>('/code/:code/stats', async (request, reply) => {
    const match = await prisma.match.findUnique({
      where: { code: request.params.code.toUpperCase() },
      include: matchInclude,
    });
    if (!match || match.visibility === 'PRIVATE') {
      return reply.notFound('No match with that code');
    }
    return buildStats(match);
  });

  app.register(async (managerRoutes) => {
    managerRoutes.addHook('preHandler', app.authenticate);

    managerRoutes.get<{ Params: { id: string } }>('/:id/stats', async (request, reply) => {
      const match = await prisma.match.findUnique({
        where: { id: request.params.id },
        include: matchInclude,
      });
      if (!match || match.managerId !== request.user.sub) {
        return reply.notFound('Match not found');
      }
      return buildStats(match);
    });

    // Manual MVP override (auto-suggested top scorer is set when the match ends)
    managerRoutes.patch<{ Params: { id: string }; Body: { playerId: string | null } }>(
      '/:id/mvp',
      {
        schema: {
          body: {
            type: 'object',
            required: ['playerId'],
            properties: { playerId: { type: ['string', 'null'] } },
            additionalProperties: false,
          },
        },
      },
      async (request, reply) => {
        const match = await prisma.match.findUnique({
          where: { id: request.params.id },
          include: matchInclude,
        });
        if (!match || match.managerId !== request.user.sub) {
          return reply.notFound('Match not found');
        }
        if (match.status !== 'FINISHED') {
          return reply.badRequest('MVP can only be set after the match ends');
        }

        const { playerId } = request.body;
        if (
          playerId !== null &&
          !match.teams.some((team) => team.players.some((mp) => mp.playerId === playerId))
        ) {
          return reply.badRequest('MVP must be a player from this match');
        }

        const updated = await prisma.match.update({
          where: { id: match.id },
          data: { mvpPlayerId: playerId },
          include: matchInclude,
        });

        const stats = buildStats(updated);
        broadcastToMatch(app.io, updated, 'match:mvp', { mvp: stats.mvp });
        return stats;
      },
    );
  });
}

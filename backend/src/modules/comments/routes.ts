import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { broadcastToMatch } from '../../realtime/socket.js';

const commentBody = {
  type: 'object',
  required: ['authorName', 'body'],
  properties: {
    authorName: { type: 'string', minLength: 1, maxLength: 30 },
    body: { type: 'string', minLength: 1, maxLength: 300 },
  },
  additionalProperties: false,
} as const;

function serializeComment(comment: {
  id: string;
  authorName: string;
  userId: string | null;
  body: string;
  createdAt: Date;
}) {
  return {
    id: comment.id,
    authorName: comment.authorName,
    isManager: comment.userId !== null,
    body: comment.body,
    createdAt: comment.createdAt,
  };
}

export async function commentRoutes(app: FastifyInstance) {
  app.get<{ Params: { code: string } }>('/code/:code/comments', async (request, reply) => {
    const match = await prisma.match.findUnique({
      where: { code: request.params.code.toUpperCase() },
    });
    if (!match || match.visibility === 'PRIVATE') {
      return reply.notFound('No match with that code');
    }

    const comments = await prisma.comment.findMany({
      where: { matchId: match.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return { comments: comments.map(serializeComment) };
  });

  // Spectators comment with just a display name — no account needed
  app.post<{ Params: { code: string }; Body: { authorName: string; body: string } }>(
    '/code/:code/comments',
    {
      schema: { body: commentBody },
      config: { rateLimit: { max: 6, timeWindow: '30 seconds' } },
    },
    async (request, reply) => {
      const match = await prisma.match.findUnique({
        where: { code: request.params.code.toUpperCase() },
      });
      if (!match || match.visibility === 'PRIVATE') {
        return reply.notFound('No match with that code');
      }
      if (!match.commentsEnabled) {
        return reply.forbidden('Comments are disabled for this match');
      }
      if (match.status !== 'LIVE') {
        return reply.badRequest('Comments are only open while the match is live');
      }

      // Tag the comment with the manager's id when a valid token is sent
      let userId: string | null = null;
      try {
        await request.jwtVerify();
        userId = request.user.sub;
      } catch {
        // anonymous spectator — fine
      }

      const comment = await prisma.comment.create({
        data: {
          matchId: match.id,
          authorName: request.body.authorName,
          body: request.body.body,
          userId,
        },
      });

      const serialized = serializeComment(comment);
      broadcastToMatch(app.io, match, 'match:comment', { comment: serialized });
      return reply.code(201).send({ comment: serialized });
    },
  );
}

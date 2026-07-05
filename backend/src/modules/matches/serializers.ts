import type { Match, MatchPlayer, MatchTeam, Player } from '@prisma/client';

export type MatchWithTeams = Match & {
  teams: (MatchTeam & { players: (MatchPlayer & { player: Player })[] })[];
};

// Stable ordering: cuids are time-sortable, so id order = creation order
export const matchInclude = {
  teams: {
    orderBy: { id: 'asc' },
    include: { players: { orderBy: { id: 'asc' }, include: { player: true } } },
  },
} as const;

export function serializeMatch(match: MatchWithTeams) {
  return {
    id: match.id,
    code: match.code,
    status: match.status,
    visibility: match.visibility,
    commentsEnabled: match.commentsEnabled,
    targetScore: match.targetScore,
    timerSeconds: match.timerSeconds,
    winnerTeamId: match.winnerTeamId,
    mvpPlayerId: match.mvpPlayerId,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    createdAt: match.createdAt,
    teams: match.teams.map((team) => ({
      id: team.id,
      name: team.name,
      colour: team.colour,
      finalScore: team.finalScore,
      players: team.players.map((mp) => ({
        id: mp.id,
        playerId: mp.playerId,
        username: mp.player.username,
        displayName: mp.player.displayName,
        avatarColour: mp.player.avatarColour,
        points: mp.points,
      })),
    })),
  };
}

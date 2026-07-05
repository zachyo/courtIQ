export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface MatchPlayerEntry {
  id: string;
  playerId: string;
  username: string;
  displayName: string;
  avatarColour: string | null;
  points: number;
}

export interface Team {
  id: string;
  name: string;
  colour: string;
  finalScore: number;
  players: MatchPlayerEntry[];
}

export type MatchStatus = 'PENDING' | 'LIVE' | 'FINISHED';

export interface Match {
  id: string;
  code: string;
  status: MatchStatus;
  visibility: 'PUBLIC' | 'PRIVATE';
  commentsEnabled: boolean;
  targetScore: number | null;
  timerSeconds: number | null;
  winnerTeamId: string | null;
  mvpPlayerId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  teams: Team[];
}

export interface ScoreEventEntry {
  id: string;
  points: number;
  username: string;
  displayName: string;
  teamId: string;
  teamName?: string;
  createdAt: string;
}

export interface CommentEntry {
  id: string;
  authorName: string;
  isManager: boolean;
  body: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  matchPlayerId: string;
  playerId: string;
  username: string;
  displayName: string;
  teamId: string;
  teamName: string;
  points: number;
}

export interface MatchStats {
  match: Match;
  leaderboard: LeaderboardEntry[];
  winner: { id: string; name: string; finalScore: number } | null;
  mvp: LeaderboardEntry | null;
}

export interface Player {
  id: string;
  username: string;
  displayName: string;
  avatarColour: string | null;
  keptForFuture: boolean;
}

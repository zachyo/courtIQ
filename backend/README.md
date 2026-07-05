# CourtIQ Backend (v1 — Manual App)

Fastify + Prisma (PostgreSQL) + Socket.IO. See `../CourtIQ_PRD_Roadmap.md` Part A.

## Local development

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL and JWT_SECRET
npx prisma migrate dev      # creates/updates the local database schema
npm run dev                 # starts the API with hot reload on :3000
```

One-time local Postgres setup (Ubuntu):

```bash
sudo -u postgres psql -c "CREATE ROLE courtiq LOGIN PASSWORD 'courtiq' CREATEDB;"
sudo -u postgres createdb -O courtiq courtiq_dev
```

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check (Railway healthcheck path) |
| POST | `/api/auth/register` | — | Create manager account → `{ token, user }` |
| POST | `/api/auth/login` | — | Log in → `{ token, user }` |
| GET | `/api/auth/me` | Bearer | Current manager profile |
| GET | `/api/players?query=` | Bearer | Manager's roster, optional username filter |
| GET | `/api/players/lookup/:username` | Bearer | Find any existing player by exact username |
| POST | `/api/matches` | Bearer | Create match: 2 teams + settings → match with share code |
| GET | `/api/matches` | Bearer | Manager's matches (newest first) |
| GET | `/api/matches/:id` | Bearer | Match detail (owner only) |
| PATCH | `/api/matches/:id/settings` | Bearer | Update settings while PENDING |
| POST | `/api/matches/:id/players` | Bearer | Add player to a team (new username or existing player) |
| DELETE | `/api/matches/:id/players/:matchPlayerId` | Bearer | Remove player while PENDING |
| GET | `/api/matches/code/:code` | — | Public spectator view (404 if match is PRIVATE) |
| POST | `/api/matches/:id/start` | Bearer | Start match (needs ≥1 player per team) |
| POST | `/api/matches/:id/score` | Bearer | Award 1/2/3 points to a match player (LIVE only) |
| POST | `/api/matches/:id/undo` | Bearer | Undo the last score event (LIVE only) |
| POST | `/api/matches/:id/end` | Bearer | End match; winner computed from final scores |
| GET | `/api/matches/code/:code/events` | — | Public score timeline (undone events excluded) |

Usernames are case-insensitive (stored lowercase), 3–20 chars, letters/digits/underscore.
Match codes are 6 chars from an unambiguous alphabet (no 0/O/1/I/L).

Socket.IO: clients emit `match:join` / `match:leave` with a match code to enter
that match's live room. Broadcasts (PUBLIC matches only): `match:started`,
`match:score` (`{ match, event }`), `match:score-undone` (`{ match, eventId }`),
`match:ended` — each carries the full serialized match, so clients just re-render.

Watch a live match from a terminal: `node scripts/spectate.mjs <CODE>`.

## Deploy on Railway

1. Create a Railway project, add a **PostgreSQL** service (provides `DATABASE_URL`).
2. Add this repo/directory as a service; `railway.json` configures build & start
   (`prisma migrate deploy` runs on every start).
3. Set `JWT_SECRET` (e.g. `openssl rand -hex 32`) and `CORS_ORIGIN` in service variables.

## Structure

```
prisma/schema.prisma   Full v1 data model (User, Player, Match, MatchTeam,
                       MatchPlayer, ScoreEvent, Comment)
src/
  env.ts               Environment validation
  app.ts               Fastify app assembly (plugins + module routes)
  server.ts            Entry point (HTTP + Socket.IO)
  plugins/auth.ts      JWT plugin + `authenticate` guard
  plugins/realtime.ts  Attaches Socket.IO to the server as `app.io`
  modules/auth/        Manager register / login / me
  modules/players/     Roster list + username lookup
  modules/matches/     Match creation, teams, players, settings, code lookup
  modules/scoring/     Start/end match, score, undo, public event feed
  realtime/socket.ts   Socket.IO setup + match rooms
scripts/spectate.mjs   Terminal spectator for a live match (dev tool)
```

Modules land per roadmap phase: `stats/` and `comments/` (M4).

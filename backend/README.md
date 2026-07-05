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

## API (Phase M1)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check (Railway healthcheck path) |
| POST | `/api/auth/register` | — | Create manager account → `{ token, user }` |
| POST | `/api/auth/login` | — | Log in → `{ token, user }` |
| GET | `/api/auth/me` | Bearer | Current manager profile |

Socket.IO: clients emit `match:join` / `match:leave` with a match code to enter
that match's live room. Scoring and comment broadcasts arrive in M3/M4.

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
  modules/auth/        Manager register / login / me
  realtime/socket.ts   Socket.IO setup + match rooms
```

Modules land per roadmap phase: `matches/` and `players/` (M2), `scoring/` (M3),
`stats/` and `comments/` (M4).

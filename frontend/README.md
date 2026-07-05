# CourtIQ Frontend (v1 — Manual App)

Vite + React 19 + TypeScript SPA. Radix UI primitives (headless), hand-rolled CSS
design tokens in `src/styles.css`. Talks to the backend via `/api` and Socket.IO —
both proxied to `localhost:3000` by the Vite dev server.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (backend must be running on :3000)
npm run build      # typecheck + production bundle in dist/
```

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/login` | manager | Log in / sign up, or jump to a match as spectator via code |
| `/` | manager | Dashboard: match list + create match (teams, colours, settings) |
| `/match/:id` | manager | Console — add players (PENDING), score +1/+2/+3 / undo / comments toggle (LIVE), stats + MVP override + keep-players prompt (FINISHED) |
| `/watch/:code` | anyone | Live scoreboard, score feed, comments — no account needed |

## Structure

```
src/
  api.ts          fetch wrapper + JWT storage
  socket.ts       Socket.IO singleton + match room join/leave
  auth.tsx        AuthProvider / useAuth
  types.ts        API types (mirror backend serializers)
  components/     ScoreBoard, EventFeed, CommentPanel
  pages/          LoginPage, DashboardPage, MatchConsolePage, SpectatePage
  styles.css      design tokens + component classes
```

Live updates: pages join the match's Socket.IO room by code and re-render from
`match:*` broadcast payloads; manager actions use the full match returned by
every REST mutation.

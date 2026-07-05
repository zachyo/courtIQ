// Dev tool: watch a match's live broadcasts from the terminal.
// Usage: node scripts/spectate.mjs <MATCH_CODE> [server-url]
import { io } from 'socket.io-client';

const code = process.argv[2];
const url = process.argv[3] ?? 'http://localhost:3000';
if (!code) {
  console.error('Usage: node scripts/spectate.mjs <MATCH_CODE> [server-url]');
  process.exit(1);
}

const socket = io(url);

socket.on('connect', () => {
  socket.emit('match:join', code);
  console.log(`[spectator] watching ${code} on ${url}`);
});

for (const event of ['match:started', 'match:score', 'match:score-undone', 'match:ended', 'match:settings']) {
  socket.on(event, (payload) => {
    const teams = payload.match.teams.map((t) => `${t.name} ${t.finalScore}`).join(' vs ');
    const extra = payload.event
      ? ` (+${payload.event.points} ${payload.event.username})`
      : payload.eventId
        ? ' (last score undone)'
        : '';
    console.log(`[spectator] ${event}: ${teams}${extra}`);
  });
}

socket.on('match:comment', ({ comment }) => {
  console.log(`[spectator] match:comment: ${comment.authorName}: ${comment.body}`);
});

socket.on('match:mvp', ({ mvp }) => {
  console.log(`[spectator] match:mvp: ${mvp ? mvp.username : 'none'}`);
});

import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../env.js';

// Spectators join a room per match code; scoring/comments modules (M3/M4)
// broadcast into these rooms so live views update in real time.
export function createRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin },
  });

  io.on('connection', (socket) => {
    socket.on('match:join', (code: string) => {
      if (typeof code === 'string' && code.length <= 16) {
        socket.join(matchRoom(code));
      }
    });

    socket.on('match:leave', (code: string) => {
      if (typeof code === 'string') {
        socket.leave(matchRoom(code));
      }
    });
  });

  return io;
}

export function matchRoom(code: string) {
  return `match:${code.toUpperCase()}`;
}

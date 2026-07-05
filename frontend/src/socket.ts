import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(); // same origin — proxied to the backend in dev
  }
  return socket;
}

export function joinMatch(code: string) {
  getSocket().emit('match:join', code);
}

export function leaveMatch(code: string) {
  getSocket().emit('match:leave', code);
}

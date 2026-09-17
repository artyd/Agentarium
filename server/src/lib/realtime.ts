import type { Server } from "socket.io";

// Holds the Socket.IO server so routes/libs can push realtime events without a
// circular dependency on server.ts.
let ioRef: Server | null = null;

export function setIO(io: Server) {
  ioRef = io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  ioRef?.to(`user:${userId}`).emit(event, payload);
}

export function emitAll(event: string, payload: unknown) {
  ioRef?.emit(event, payload);
}

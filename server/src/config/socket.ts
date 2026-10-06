import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';

let io: Server;

interface AuthPayload {
  id: string;
  role: string;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
    },
  });

  // JWT authentication middleware for all socket connections
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie
        ?.split(';')
        .find((c: string) => c.trim().startsWith('token='))
        ?.split('=')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as AuthPayload;
    console.log(`🔌 Socket connected: ${user.id} (${user.role})`);

    // Join role-based room
    socket.join(`role:${user.role}`);
    socket.join(`user:${user.id}`);

    // ---- Device pairing events ----
    socket.on('pairing:qr-scanned', (data: { pairingToken: string }) => {
      io.to(`user:${user.id}`).emit('pairing:qr-scanned', data);
    });

    socket.on('pairing:photo-captured', (data: { pairingToken: string; imageUrl: string }) => {
      io.to(`user:${user.id}`).emit('pairing:photo-captured', data);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${user.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// Helper to emit to specific rooms
export function emitToRole(role: string, event: string, data: any): void {
  getIO().to(`role:${role}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: any): void {
  getIO().to(`user:${userId}`).emit(event, data);
}

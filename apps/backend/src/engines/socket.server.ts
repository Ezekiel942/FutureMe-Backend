import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from '../utils/logger';
import presence from './presence';
import * as AuthService from '../modules/auth/auth.service';

let io: Server | null = null;

export const initializeSocket = (httpServer: HTTPServer): Server => {
  if (io) {
    logger.warn('WebSocket server already initialized, skipping');
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Supabase JWT authentication middleware for Socket.IO
  io.use(async (socket: Socket, next) => {
    try {
      const raw = (socket.handshake &&
        (socket.handshake as any).auth &&
        (socket.handshake as any).auth.token) as string | undefined;

      if (!raw) {
        logger.warn('Socket auth failed: token missing', { socketId: socket.id });
        return next(new Error('Unauthorized'));
      }

      if (typeof raw !== 'string') {
        logger.warn('Socket auth failed: invalid token format', { socketId: socket.id });
        return next(new Error('Unauthorized'));
      }

      const token = raw.startsWith('Bearer ') ? raw.split(' ')[1] : raw;

      let payload: any;
      try {
        payload = await AuthService.verifyToken(token);
      } catch (err: any) {
        logger.warn('Socket auth failed: token verification error', {
          socketId: socket.id,
          reason: err?.message,
        });
        return next(new Error('Unauthorized'));
      }

      // Attach decoded user payload to socket.data.user for downstream handlers
      (socket.data as any).user = payload;

      return next();
    } catch (err: any) {
      logger.error('Unexpected error in socket auth middleware', { error: err?.message });
      return next(new Error('Unauthorized'));
    }
  });

  // Track authenticated users and their socket IDs
  io.on('connection', (socket: Socket) => {
    logger.info('Socket client connected', { socketId: socket.id });

    // Log authenticated user id if available
    const userId =
      (socket.data as any)?.user?.sub || (socket.data as any)?.user?.id || (socket as any).userId;
    const organizationId =
      (socket.data as any)?.user?.organizationId || (socket.data as any)?.user?.orgId;
    if (userId) {
      logger.info('Socket connection established', { socketId: socket.id, userId });
      logger.info('Authenticated socket user connected', { socketId: socket.id, userId });
      socket.join(`user:${userId}`);
      if (organizationId) {
        socket.join(`org:${organizationId}`);
      }
      if ((socket.data as any)?.user?.role === 'admin') {
        socket.join('admin:sessions');
        logger.info('Admin socket joined admin sessions channel', {
          socketId: socket.id,
          userId,
        });
      }
      if (organizationId) {
        // fire-and-forget
        presence
          .markOnline(String(userId), String(organizationId), socket.id)
          .catch((e) => logger.debug('presence.markOnline error', { error: String(e) }));

        // Broadcast presence events
        const payload = {
          userId,
          organizationId,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        };
        try {
          io?.to(`org:${organizationId}`).emit('USER_ONLINE', payload);
          io?.to(`org:${organizationId}`).emit('user:online', payload);
        } catch (e) {
          logger.debug('Failed to broadcast USER_ONLINE', { error: String(e) });
        }
      }
    }

    // Send a "connected" event immediately to confirm connection
    socket.emit('connected', {
      message: 'Successfully connected to WebSocket',
      socketId: socket.id,
    });

    // Log the emit as structured log
    logger.debug('Emitted connected event', { socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('Socket client disconnected', { socketId: socket.id });
      // Attempt to mark offline
      const uid =
        (socket.data as any)?.user?.sub || (socket.data as any)?.user?.id || (socket as any).userId;
      const org = (socket.data as any)?.user?.organizationId || (socket.data as any)?.user?.orgId;
      if (uid && org) {
        presence
          .markOffline(String(uid), String(org), socket.id)
          .then(async () => {
            try {
              // If user now offline, broadcast USER_OFFLINE; best-effort check via presence.getOnlineUsers
              const remaining = await presence.getOnlineUsers(String(org));
              const stillOnline = remaining && remaining.includes(String(uid));
              if (!stillOnline) {
                const payload = {
                  userId: uid,
                  organizationId: org,
                  timestamp: new Date().toISOString(),
                };
                try {
                  io?.to(`org:${org}`).emit('USER_OFFLINE', payload);
                  io?.to(`org:${org}`).emit('user:offline', payload);
                } catch (e) {
                  logger.debug('Failed to broadcast USER_OFFLINE', { error: String(e) });
                }
              }
            } catch (err) {
              logger.debug('Error processing offline user', {
                error: err instanceof Error ? err.message : String(err),
              });
            }
          })
          .catch((err) => {
            logger.debug('Error marking user offline', {
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
    });

    socket.on('authenticate', (data: { userId: string; token: string }) => {
      // Store user ID on socket for broadcasting to specific users
      (socket as any).userId = data.userId;
      socket.join(`user:${data.userId}`);
      logger.info('Socket authenticate event', { socketId: socket.id, userId: data.userId });
    });

    // Subscribe the socket to the authenticated user's room
    socket.on('session:subscribe', () => {
      const uid =
        (socket.data as any)?.user?.sub || (socket.data as any)?.user?.id || (socket as any).userId;
      if (!uid) {
        logger.warn('session:subscribe attempted without authenticated user', {
          socketId: socket.id,
        });
        return;
      }
      socket.join(`user:${uid}`);
      logger.info('Socket joined user room', { socketId: socket.id, userId: uid });
    });

    // Unsubscribe the socket from the authenticated user's room
    socket.on('session:unsubscribe', () => {
      const uid =
        (socket.data as any)?.user?.sub || (socket.data as any)?.user?.id || (socket as any).userId;
      if (!uid) {
        logger.warn('session:unsubscribe attempted without authenticated user', {
          socketId: socket.id,
        });
        return;
      }
      socket.leave(`user:${uid}`);
      logger.info('Socket left user room', { socketId: socket.id, userId: uid });
    });

    socket.on('admin:sessions:subscribe', () => {
      if ((socket.data as any)?.user?.role !== 'admin') {
        logger.warn('admin:sessions:subscribe attempted by non-admin', {
          socketId: socket.id,
          userId,
        });
        return;
      }
      socket.join('admin:sessions');
      logger.info('Socket joined admin sessions channel', {
        socketId: socket.id,
        userId,
      });
    });

    socket.on('admin:sessions:unsubscribe', () => {
      socket.leave('admin:sessions');
      logger.info('Socket left admin sessions channel', { socketId: socket.id, userId });
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};

export const closeSocket = async () => {
  if (!io) return;
  try {
    await io.close();
    io = null;
  } catch (err) {
    // ignore errors during shutdown
  }
};

export const broadcastToUser = (userId: string, event: string, data: any) => {
  const ioServer = getIO();
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  ioServer.to(`user:${userId}`).emit(event, payload);
};

export const broadcastToManagers = (organizationId: string, event: string, data: any) => {
  const socket = getIO();
  socket.to(`org:${organizationId}:managers`).emit(event, data);
};

export const broadcastToAdmins = (event: string, data: any) => {
  const ioServer = getIO();
  ioServer.to('admin:sessions').emit(event, data);
};

export default { initializeSocket, getIO, broadcastToUser, broadcastToManagers, broadcastToAdmins };

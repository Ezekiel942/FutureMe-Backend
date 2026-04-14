# WebSocket Production Guide

Production-ready WebSocket implementation with multi-instance support and distributed architecture.

## Table of Contents

1. [Configuration](#1-websocket-configuration)
2. [Connection Management](#2-connection-management)
3. [Security](#3-websocket-security)
4. [Distributed Setup](#4-distributed-multi-instance-setup)
5. [Monitoring](#5-monitoring--troubleshooting)

---

## 1. WebSocket Configuration

### Attach to Same HTTP Server

```typescript
// src/server.ts
import http from 'http';
import app from './app';
import { initializeSocket } from './engines/socket.server';

async function start() {
  // Single HTTP server
  const httpServer = http.createServer(app);

  // Attach WebSocket to same server
  if (process.env.SOCKET_ENABLED === 'true') {
    initializeSocket(httpServer);
  }

  // Start listening
  httpServer.listen(process.env.PORT);
}
```

**Why**: Prevents duplicate Socket.IO instances, allows clean shutdown, uses single port.

### Socket.IO Configuration

```typescript
// src/engines/socket.server.ts
import { Server as SocketIOServer } from 'socket.io';

const io = new Server(httpServer, {
  transports: ['websocket', 'polling'], // Fallback to polling if WebSocket fails
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '30000'),
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000'),
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
  serveClient: false, // Don't serve Socket.IO client (use npm package instead)
  path: '/socket.io', // Custom path for better security
  perMessageDeflate: false, // Disable compression for performance
});

export function initializeSocket(server: http.Server) {
  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      socket.data.userId = decoded.sub;
      socket.data.organizationId = decoded.org;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', onSocketConnection);
  return io;
}
```

---

## 2. Connection Management

### Prevent Duplicate Connections

```typescript
let globalIO: SocketIOServer | null = null;

export function initializeSocket(server: http.Server): SocketIOServer {
  // Check if already initialized
  if (globalIO) {
    logger.warn('Socket.IO already initialized');
    return globalIO;
  }

  globalIO = new Server(server, {
    /* config */
  });

  globalIO.on('connection', (socket) => {
    logger.info('Socket connected', {
      socketId: socket.id,
      userId: socket.data.userId,
    });
  });

  return globalIO;
}

export function getIO(): SocketIOServer {
  if (!globalIO) {
    throw new Error('Socket.IO not initialized');
  }
  return globalIO;
}
```

### Connection Logging

```typescript
io.on('connection', (socket) => {
  const { userId, organizationId } = socket.data;

  logger.info('User connected via WebSocket', {
    socketId: socket.id,
    userId,
    organizationId,
    clientVersion: socket.handshake.headers['user-agent'],
    ip: socket.handshake.address,
  });

  socket.on('disconnect', (reason) => {
    logger.info('User disconnected', {
      socketId: socket.id,
      userId,
      reason, // 'client namespace disconnect', 'server namespace disconnect', 'client side disconnect', etc.
    });
  });

  socket.on('error', (error) => {
    logger.error('WebSocket error', {
      socketId: socket.id,
      userId,
      error,
    });
  });
});
```

---

## 3. Authentication & Authorization

### JWT Verification

```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Missing authentication token'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    // Store in socket for later reference
    socket.data = {
      userId: decoded.sub,
      organizationId: decoded.org,
      role: decoded.role,
    };

    next();
  } catch (err: any) {
    logger.warn('Socket auth failed', { token: token.slice(0, 10) + '...', error: err.message });
    next(new Error('Invalid token'));
  }
});
```

### Room-Based Access Control

```typescript
// Users can only join rooms for their organization
socket.on('join-org', (orgId: string) => {
  // Verify user belongs to this org
  if (socket.data.organizationId !== orgId) {
    logger.warn('Unauthorized room join attempt', {
      userId: socket.data.userId,
      attemptedOrg: orgId,
      actualOrg: socket.data.organizationId,
    });
    socket.emit('error', 'Unauthorized to join this room');
    return;
  }

  socket.join(`org:${orgId}`);
  logger.info('User joined org room', { userId: socket.data.userId, orgId });
});
```

---

## 4. Event Types & Broadcasting

### Real-Time Event Patterns

```typescript
// 1. Session Events (User specific)
socket.on('session:start', (data) => {
  // Broadcast to user's org managers
  io.to(`org:${socket.data.organizationId}`).emit('session:started', {
    sessionId: data.id,
    userId: socket.data.userId,
    timestamp: new Date(),
  });
});

// 2. Risk Detection (User specific)
socket.on('risk:detected', (data) => {
  // Notify user + managers in org
  io.to(`user:${socket.data.userId}`).emit('risk:alert', data);
  io.to(`org:${socket.data.organizationId}:managers`).emit('risk:alert', data);
});

// 3. Presence (Real-time status)
socket.on('presence:update', (status: 'online' | 'idle' | 'away') => {
  // Update presence engine
  presence.setUserStatus(socket.data.userId, status);

  // Broadcast to org
  io.to(`org:${socket.data.organizationId}`).emit('user:status', {
    userId: socket.data.userId,
    status,
    timestamp: new Date(),
  });
});

// 4. Announcements (Org-wide)
socket.on('announcement:received', (announcementId: string) => {
  // Acknowledge receipt in database
  db.markAnnouncementRead(socket.data.userId, announcementId);

  // Broadcast to managers
  io.to(`org:${socket.data.organizationId}:managers`).emit('announcement:view', {
    userId: socket.data.userId,
    announcementId,
  });
});
```

---

## 5. Graceful Shutdown

### Close Connections Cleanly

```typescript
// In server.ts shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received: starting graceful shutdown`);

  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close all WebSocket connections
  const sockets = Array.from(io.sockets.sockets.values());
  sockets.forEach((socket) => {
    socket.emit('server:shutdown', { message: 'Server restarting' });
    socket.disconnect(true);
  });

  // Wait for all connections to close
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Close database and cache
  await database.destroy();
  logger.info('Connected clients forced disconnect');

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## 6. Multi-Instance Support (Distributed)

### Redis Adapter for Multiple Servers

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export async function initializeSocket(httpServer: http.Server) {
  const io = new Server(httpServer, {
    /* ... */
  });

  // If Redis available, use Redis adapter for multi-instance
  if (process.env.REDIS_ENABLED === 'true' && process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO using Redis adapter (multi-instance)');
  } else {
    logger.info('Socket.IO using memory adapter (single instance)');
  }

  io.on('connection', onSocketConnection);
  return io;
}
```

**With Redis adapter**: Messages broadcast across all server instances.

---

## 7. Rate Limiting & Anti-Abuse

### Event Rate Limiting

```typescript
import pLimit from 'p-limit';

const eventLimits = new Map<string, number[]>();

socket.on('session:start', throttleEvent(3, 60000)); // 3 events per minute

function throttleEvent(maxEvents: number, windowMs: number) {
  return (data, callback) => {
    const key = socket.data.userId;
    const now = Date.now();

    if (!eventLimits.has(key)) eventLimits.set(key, []);

    const timestamps = eventLimits.get(key)!;
    const recentEvents = timestamps.filter((t) => now - t < windowMs);

    if (recentEvents.length >= maxEvents) {
      logger.warn('Rate limit exceeded', { userId: key, event: 'session:start' });
      socket.emit('error', 'Too many requests');
      return;
    }

    recentEvents.push(now);
    eventLimits.set(key, recentEvents);
    callback?.();
  };
}
```

### Connection Limits per User

```typescript
async function onSocketConnection(socket: io.Socket) {
  const { userId, organizationId } = socket.data;

  // Check concurrent connections
  const existingSockets = await io.in(`user:${userId}`).fetchSockets();

  const maxConnections = 3; // Max 3 tabs per user
  if (existingSockets.length >= maxConnections) {
    logger.warn('Max connections exceeded', { userId, current: existingSockets.length });
    socket.disconnect(true);
    return;
  }

  socket.emit('connected', { socketId: socket.id });
}
```

---

## 8. Error Handling

### Global Error Handler

```typescript
io.on('connect_error', (error) => {
  logger.error('Socket connection error', { error: error.message });
});

socket.on('error', (error) => {
  logger.error('Socket error', {
    socketId: socket.id,
    userId: socket.data.userId,
    error,
  });

  // Attempt recovery
  socket.emit('error:recovery', { message: 'Attempting to reconnect...' });
});

socket.on('exception', (error) => {
  logger.error('Socket exception', { error });
  Sentry.captureException(error);
});
```

---

## 9. Monitoring & Health Checks

### WebSocket Health Endpoint

```typescript
app.get('/health/websocket', (req, res) => {
  const socketHealth = {
    enabled: process.env.SOCKET_ENABLED === 'true',
    connectedClients: io.engine.clientsCount,
    connectedSockets: io.sockets.sockets.size,
    status: 'healthy',
  };

  res.json(socketHealth);
});
```

### Monitor Active Connections

```typescript
setInterval(() => {
  const socketCount = io.sockets.sockets.size;
  const clientCount = io.engine.clientsCount;

  logger.info('Socket metrics', {
    activeConnections: socketCount,
    engineClients: clientCount,
  });

  // Alert if unusual spikes
  if (socketCount > 10000) {
    logger.warn('High connection count detected', { socketCount });
    Sentry.captureMessage('WebSocket connection spike');
  }
}, 60000); // Every minute
```

---

## 10. Client-Side Integration

### Frontend Connection

```typescript
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_API_URL, {
  auth: {
    token: jwtToken, // GET from auth service
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Show user notification
});

socket.on('session:started', (data) => {
  // Update UI
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

---

## 11. Production Checklist

- [ ] WebSocket attached to same HTTP server
- [ ] JWT authentication required for all connections
- [ ] Organization isolation via rooms
- [ ] Connection logging enabled
- [ ] Graceful shutdown implemented
- [ ] Redis adapter for multi-instance (if distributed)
- [ ] Event rate limiting enabled
- [ ] Error handling comprehensive
- [ ] Health check endpoint available
- [ ] Monitoring/alerting configured
- [ ] Secure WebSocket (WSS) in production

---

## 12. Debugging

### Check Connection Status

```typescript
// In backend
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  console.log('Transport:', socket.conn.transport.name);
  console.log('Rooms:', socket.rooms);
});
```

### Browser DevTools

```javascript
// In browser console
socket.on('*', (event, ...args) => {
  console.log('Event:', event, args);
});

socket.onAny((event, ...args) => {
  console.log('All events:', event, args);
});
```

---

See [Socket.IO Docs](https://socket.io/docs/)for more.

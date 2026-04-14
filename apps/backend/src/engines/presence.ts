import redisInfra from '@infrastructure/redis';
import logger from '@utils/logger';

// In-memory fallback
const userSocketsMap: Map<string, Set<string>> = new Map(); // userId -> set(socketId)
const orgUsersMap: Map<string, Set<string>> = new Map(); // orgId -> set(userId)

const USER_SOCKETS_TTL = 60 * 60; // 1 hour

/**
 * Mark a user as online (adds socketId)
 */
export async function markOnline(userId: string, orgId: string, socketId: string) {
  try {
    if (redisInfra.isRedisAvailable()) {
      const r = redisInfra.getRedisClient();
      if (!r) throw new Error('redis client missing');
      const userKey = `presence:user:${userId}`;
      const orgKey = `presence:org:${orgId}`;
      await r.sadd(userKey, socketId);
      await r.expire(userKey, USER_SOCKETS_TTL);
      await r.sadd(orgKey, userId);
      await r.expire(orgKey, USER_SOCKETS_TTL);
      return;
    }
  } catch (e: any) {
    logger.debug('Redis presence markOnline failed, falling back to memory', { error: e?.message });
  }

  // In-memory fallback
  const sockets = userSocketsMap.get(userId) || new Set<string>();
  sockets.add(socketId);
  userSocketsMap.set(userId, sockets);

  const users = orgUsersMap.get(orgId) || new Set<string>();
  users.add(userId);
  orgUsersMap.set(orgId, users);
}

/**
 * Mark a socket offline; if no more sockets for user, remove from org set
 */
export async function markOffline(userId: string, orgId: string, socketId: string) {
  try {
    if (redisInfra.isRedisAvailable()) {
      const r = redisInfra.getRedisClient();
      if (!r) throw new Error('redis client missing');
      const userKey = `presence:user:${userId}`;
      const orgKey = `presence:org:${orgId}`;
      await r.srem(userKey, socketId);
      const remaining = await r.scard(userKey);
      if (remaining === 0) {
        await r.srem(orgKey, userId);
        await r.del(userKey);
      }
      return;
    }
  } catch (e: any) {
    logger.debug('Redis presence markOffline failed, falling back to memory', {
      error: e?.message,
    });
  }

  const sockets = userSocketsMap.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSocketsMap.delete(userId);
      const users = orgUsersMap.get(orgId);
      if (users) {
        users.delete(userId);
        if (users.size === 0) orgUsersMap.delete(orgId);
      }
    } else {
      userSocketsMap.set(userId, sockets);
    }
  }
}

export async function getOnlineUsers(orgId: string): Promise<string[]> {
  try {
    if (redisInfra.isRedisAvailable()) {
      const r = redisInfra.getRedisClient();
      if (!r) throw new Error('redis client missing');
      const orgKey = `presence:org:${orgId}`;
      const members = await r.smembers(orgKey);
      return members || [];
    }
  } catch (e: any) {
    logger.debug('Redis presence getOnlineUsers failed, falling back to memory', {
      error: e?.message,
    });
  }

  const users = orgUsersMap.get(orgId);
  return users ? Array.from(users) : [];
}

export async function getOnlineCount(orgId: string): Promise<number> {
  const users = await getOnlineUsers(orgId);
  return users.length;
}

export default {
  markOnline,
  markOffline,
  getOnlineUsers,
  getOnlineCount,
};

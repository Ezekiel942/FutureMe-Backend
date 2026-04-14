// use path aliases once tsconfig paths are configured
import { getRedisClient, isRedisAvailable } from '@infrastructure/redis';
import logger from '@utils/logger';

/**
 * Token Blacklist Service
 *
 * Manages revoked JWT tokens using Redis with TTL.
 * When a user logs out, their access token is added to the blacklist.
 * When verifying tokens, check if token is in blacklist.
 *
 * Tokens automatically expire from blacklist when their JWT expiry time is reached.
 */

const BLACKLIST_PREFIX = 'token:blacklist:';

/**
 * Add token to blacklist (on logout)
 * @param token JWT token to blacklist
 * @param expiresIn TTL in seconds (typically the remaining token lifetime)
 */
export async function blacklistToken(token: string, expiresInSeconds: number): Promise<boolean> {
  if (!isRedisAvailable()) {
    logger.warn('Redis not available; token blacklist skipped', { token: token.substring(0, 20) });
    return false;
  }

  try {
    const redis = getRedisClient();
    if (!redis) return false;

    const key = `${BLACKLIST_PREFIX}${token}`;
    const expiresIn = Math.max(expiresInSeconds, 1); // Minimum 1 second

    await redis.setex(key, expiresIn, '1');
    logger.debug('Token blacklisted', {
      token: token.substring(0, 20),
      expiresInSeconds: expiresIn,
    });
    return true;
  } catch (err: any) {
    logger.error('Error blacklisting token', {
      error: err?.message,
      token: token.substring(0, 20),
    });
    return false;
  }
}

/**
 * Check if token is blacklisted
 * @param token JWT token to check
 * @returns true if blacklisted, false otherwise
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    // If Redis is unavailable, we cannot check blacklist
    // In production, you may want to fail-secure (deny access)
    logger.warn('Redis not available; cannot check token blacklist');
    return false;
  }

  try {
    const redis = getRedisClient();
    if (!redis) return false;

    const key = `${BLACKLIST_PREFIX}${token}`;
    const result = await redis.exists(key);
    return result === 1;
  } catch (err: any) {
    logger.error('Error checking token blacklist', {
      error: err?.message,
    });
    return false;
  }
}

/**
 * Clear blacklist entry (optional: use if re-issuing tokens)
 */
export async function removeFromBlacklist(token: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    if (!redis) return false;

    const key = `${BLACKLIST_PREFIX}${token}`;
    const removed = await redis.del(key);
    return removed > 0;
  } catch (err: any) {
    logger.error('Error removing token from blacklist', {
      error: err?.message,
    });
    return false;
  }
}

/**
 * Redis health check for token blacklist
 */
export async function healthCheck(): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    if (!redis) return false;

    await redis.ping();
    return true;
  } catch (err: any) {
    logger.error('Token blacklist health check failed', {
      error: err?.message,
    });
    return false;
  }
}

export default {
  blacklistToken,
  isTokenBlacklisted,
  removeFromBlacklist,
  healthCheck,
};

import { createClient, RedisClientType } from 'redis';
import { ENV } from './env';
import logger from '../utils/logger';

/**
 * Redis Client Initialization and Management
 *
 * Provides singleton Redis client for:
 * - Session caching (active sessions)
 * - Token blacklisting (revoked tokens)
 * - Rate limit store (if using Redis backend)
 * - Real-time data caching
 *
 * Connection string: REDIS_URL env var (default: redis://localhost:6379)
 */

let redisClient: RedisClientType | null = null;
let isConnecting = false;

/**
 * Initialize Redis connection
 * Called once at application startup
 */
export async function initializeRedis(): Promise<RedisClientType | null> {
  if (redisClient) {
    logger.debug('Redis client already initialized');
    return redisClient;
  }

  if (isConnecting) {
    logger.debug('Redis connection already in progress');
    return null;
  }

  try {
    isConnecting = true;
    const redisUrl = ENV.REDIS_URL || 'redis://localhost:6379';

    logger.info('Connecting to Redis', { url: redisUrl.replace(/:[^:]*@/, ':***@') });

    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error('Redis reconnection max retries exceeded');
            return new Error('Max retries exceeded');
          }
          return Math.min(retries * 50, 500);
        },
      },
    });

    // Error handling
    redisClient.on('error', (err: Error | unknown) => {
      // Redis v4 emits RedisClientError which extends Error; we log generically
      logger.error('Redis client error', {
        error: (err as any)?.message || String(err),
        // code property may exist on redis errors
        code: (err as any)?.code,
      });
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    redisClient.on('disconnect', () => {
      logger.warn('Redis disconnected');
    });

    await redisClient.connect();
    logger.info('Redis client connected');
    return redisClient;
  } catch (err: any) {
    logger.error('Failed to initialize Redis', {
      error: err?.message,
    });
    isConnecting = false;
    redisClient = null;
    // Return null instead of throwing to allow app to start in degraded mode
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * Get the Redis client
 * Returns null if Redis is not connected
 */
export function getRedisClient(): any | null {
  return redisClient;
}

/**
 * Graceful shutdown of Redis client
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis client closed');
    } catch (err: any) {
      logger.error('Error closing Redis client', {
        error: err?.message,
      });
    }
  }
}

/**
 * Utility: Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.isOpen;
}

export default {
  initializeRedis,
  getRedisClient,
  closeRedis,
  isRedisAvailable,
};

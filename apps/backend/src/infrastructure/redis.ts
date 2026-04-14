import Redis from 'ioredis';
import logger from '@utils/logger';

/**
 * Redis Implementation (Resilient with Fallback)
 *
 * This module provides a singleton Redis client that:
 * - Automatically reconnects on failure (5s retry interval, unlimited retries)
 * - Gracefully degrades if Redis is unavailable
 * - Never crashes the application
 * - Supports both local Docker and Upstash Redis
 *
 * Features:
 * - Token blacklisting (revoked tokens)
 * - Session caching
 * - Rate limiting store
 * - Real-time data caching
 *
 * If Redis fails:
 * - Log the error
 * - Set redisAvailable flag to false
 * - Services check flag before using Redis features
 * - Database fallback seamlessly handles requests
 *
 * When Redis recovers:
 * - Automatically reconnect and restore functionality
 */

// Redis client instance
let redisClient: Redis | null = null;

// Availability flag
let isAvailable = false;

/**
 * Check if Redis is available for use
 */
export function isRedisAvailable(): boolean {
  return isAvailable && redisClient !== null && redisClient.status === 'ready';
}

/**
 * Initialize Redis connection
 * Called once during server startup
 * Never throws; returns boolean indicating success
 */
export async function initializeRedis(): Promise<boolean> {
  // Skip if Redis is disabled
  if (process.env.REDIS_ENABLED !== 'true') {
    logger.info('Redis disabled (REDIS_ENABLED != "true")');
    return false;
  }

  // Skip if already initialized
  if (redisClient) {
    logger.debug('Redis already initialized');
    return isAvailable;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    logger.info('Initializing Redis client', {
      url: redisUrl.replace(/:[^:/@]*@/, ':***@'), // Mask password
    });

    // Create ioredis client with resilience config
    redisClient = new Redis(redisUrl, {
      // Retries
      retryStrategy(times: number): number | null {
        // Retry every 5 seconds, indefinitely
        const delay = Math.min(5000, times * 100); // Start at 100ms, cap at 5s
        if (times > 100) {
          // After ~100 retries (~500s+), still keep retrying every 5s
          return 5000;
        }
        return delay;
      },

      // Max retries per request: null = infinite
      maxRetriesPerRequest: null,

      // Enable ready check before allowing commands
      enableReadyCheck: true,

      // Command timeouts
      commandTimeout: 5000,

      // Connection timeout
      connectTimeout: 5000,

      // Keep-alive
      keepAlive: 30000,

      // TLS support for Upstash (rediss://)
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    });

    // 
    // Event Handlers
    // 

    /**
     * Redis connection established
     */
    redisClient.on('connect', () => {
      isAvailable = true;
      logger.info('Redis connected and ready');
    });

    /**
     * Redis connection ended
     */
    redisClient.on('disconnect', () => {
      isAvailable = false;
      logger.warn('Redis disconnected; using database fallback');
    });

    /**
     * Redis attempting to reconnect
     */
    redisClient.on('reconnecting', (info: { attempt: number }) => {
      logger.debug('Redis reconnecting...', { attempt: info.attempt });
    });

    /**
     * Redis error handler - never throws
     */
    redisClient.on('error', (err: Error) => {
      isAvailable = false;
      logger.error('Redis error (features disabled, using DB fallback)', {
        error: err.message,
        code: (err as any).code || 'UNKNOWN',
      });
      // Do NOT throw; app continues with DB fallback
    });

    /**
     * Redis closing
     */
    redisClient.on('close', () => {
      isAvailable = false;
      logger.warn('Redis connection closed');
    });

    // Wait for initial connection (with timeout)
    return await waitForConnection(5000); // 5s timeout for initial connection
  } catch (err: any) {
    isAvailable = false;
    logger.error('Failed to initialize Redis (using database fallback)', {
      error: err?.message || String(err),
    });
    // Return false but do NOT throw
    return false;
  }
}

/**
 * Wait for Redis to be ready (with timeout)
 * @param timeoutMs Timeout in milliseconds
 * @returns true if connected within timeout, false otherwise
 */
function waitForConnection(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!redisClient) {
      resolve(false);
      return;
    }

    // Already connected
    if (redisClient.status === 'ready') {
      isAvailable = true;
      resolve(true);
      return;
    }

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      resolve(isAvailable); // Return whatever state we're in
    }, timeoutMs);

    // Listen for ready
    const handleReady = () => {
      clearTimeout(timeoutHandle);
      isAvailable = true;
      redisClient?.removeListener('ready', handleReady);
      resolve(true);
    };

    redisClient.once('ready', handleReady);
  });
}

/**
 * Get the Redis client
 * Callers MUST check isRedisAvailable() before using
 * @returns Redis client or null
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Graceful Redis shutdown
 * Called on server termination
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      logger.debug('Closing Redis connection...');
      await redisClient.quit();
      redisClient = null;
      isAvailable = false;
      logger.info('Redis connection closed gracefully');
    } catch (err: any) {
      // Last-ditch: force disconnect
      logger.error('Error during Redis graceful shutdown, forcing disconnect', {
        error: err?.message,
      });
      try {
        if (redisClient) {
          redisClient.disconnect();
          redisClient = null;
        }
      } catch {
        // Ignore
      }
      isAvailable = false;
    }
  }
}

/**
 * Health check
 * @returns true if Redis is healthy, false otherwise
 */
export async function healthCheck(): Promise<boolean> {
  if (!isRedisAvailable() || !redisClient) {
    return false;
  }

  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch {
    isAvailable = false;
    return false;
  }
}

export default {
  getRedisClient,
  isRedisAvailable,
  initializeRedis,
  closeRedis,
  healthCheck,
};

import logger from './logger';

/**
 * Heartbeat keep-alive service
 *
 * Periodically pings the health endpoint to keep the application alive
 * (useful for preventing cold starts in serverless/managed environments)
 *
 * Only activates in production environment
 */

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Start the heartbeat service
 * @param appUrl The root URL of the application (e.g., http://localhost:8080)
 */
export const startHeartbeat = (appUrl: string): void => {
  // Only run in production
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('Heartbeat service disabled (not in production)');
    return;
  }

  if (heartbeatInterval) {
    logger.warn('Heartbeat service already running');
    return;
  }

  logger.info('Heartbeat service started', {
    interval: `${HEARTBEAT_INTERVAL_MS / 1000 / 60} minutes`,
    appUrl,
  });

  // Ping immediately on startup
  pingHeartbeat(appUrl);

  // Then set up periodic pings
  heartbeatInterval = setInterval(() => {
    pingHeartbeat(appUrl);
  }, HEARTBEAT_INTERVAL_MS);

  // Allow interval to not block process exit
  heartbeatInterval.unref();
};

/**
 * Stop the heartbeat service
 */
export const stopHeartbeat = (): void => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    logger.debug('Heartbeat service stopped');
  }
};

/**
 * Send a heartbeat ping to the health endpoint
 * Failures are logged silently and do not throw
 */
async function pingHeartbeat(appUrl: string): Promise<void> {
  try {
    const healthzUrl = `${appUrl}/healthz`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(healthzUrl, {
      method: 'GET',
      signal: controller.signal,
      // Suppress HTTPS certificate warnings in development
      ...(process.env.NODE_ENV !== 'production' && {
        rejectUnauthorized: false as any,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.debug('Heartbeat ping returned non-OK status', {
        status: response.status,
        statusText: response.statusText,
      });
      return;
    }

    logger.debug('Heartbeat ping successful', { status: response.status });
  } catch (error) {
    // Log silently - do not crash the application
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logger.debug('Heartbeat ping timed out');
      } else {
        logger.debug('Heartbeat ping failed', { error: error.message });
      }
    } else {
      logger.debug('Heartbeat ping failed', { error: String(error) });
    }
  }
}

export default {
  start: startHeartbeat,
  stop: stopHeartbeat,
};

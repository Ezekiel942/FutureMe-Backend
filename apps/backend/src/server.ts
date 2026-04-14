import http from 'http';

// CRITICAL: Load environment variables first, before importing any modules that use them
import { ENV } from './config/env';

import app from './app';
import { initializeSocket } from './engines/socket.server';
import idleDetector from './engines/session-engine/idleDetector';
import { initializeDatabase, AppDataSource } from './config/database';
import { initializeRedis } from './infrastructure/redis';
import { initializeSentry, setupGlobalErrorHandlers } from './infrastructure/monitoring/sentry';
import logger from './utils/logger';

// Initialize Sentry first
initializeSentry();

// Setup global error handlers
setupGlobalErrorHandlers();

async function start() {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize Redis (non-blocking)
    await initializeRedis();

    const httpServer = http.createServer(app);

    // Initialize WebSocket if enabled
    if (ENV.SOCKET_ENABLED) {
      initializeSocket(httpServer);
      logger.info('WebSocket server initialized');
    }

    // Start idle detection service after WebSocket and database are ready
    idleDetector.start();

    // Start HTTP server
    httpServer.listen(ENV.PORT, () => {
      logger.info(`Backend server running on port ${ENV.PORT}`, {
        environment: ENV.NODE_ENV,
        socketEnabled: ENV.SOCKET_ENABLED,
      });
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`${signal} signal received: starting graceful shutdown`);

      httpServer.close(async () => {
        logger.info('HTTP server closed');

        // Close database connection
        try {
          await AppDataSource.destroy();
          logger.info('Database connection closed');
        } catch (error) {
          logger.error('Error closing database connection', { error });
        }

        // Stop idle detection service
        try {
          idleDetector.stop();
          logger.info('Idle detection service stopped');
        } catch (error) {
          logger.error('Error stopping idle detection service', { error });
        }

        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

start();

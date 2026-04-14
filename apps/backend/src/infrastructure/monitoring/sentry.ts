import * as Sentry from '@sentry/node';
import { ENV } from '../../config/env';
import logger from '../../utils/logger';

export function initializeSentry(): void {
  if (!ENV.SENTRY_DSN) {
    logger.info('Sentry DSN not provided, monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: ENV.NODE_ENV,
    // Capture console logs as breadcrumbs
    integrations: [
      new Sentry.Integrations.Console({
        levels: ['warn', 'error'],
      }),
      new Sentry.Integrations.Http(),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
    // Performance monitoring
    tracesSampleRate: ENV.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Capture context
    beforeSend(event) {
      // Sanitize sensitive data
      if (event.request?.data) {
        // Remove passwords, tokens, etc.
        const sanitized = { ...event.request.data };
        if (sanitized.password) sanitized.password = '[REDACTED]';
        if (sanitized.token) sanitized.token = '[REDACTED]';
        if (sanitized.authorization) sanitized.authorization = '[REDACTED]';
        event.request.data = sanitized;
      }
      return event;
    },
  });

  // Set user context if available
  Sentry.setTag('service', 'futureme-backend');
  Sentry.setTag('environment', ENV.NODE_ENV);

  logger.info('Sentry monitoring initialized', {
    environment: ENV.NODE_ENV,
  });
}

// Global error handlers
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    Sentry.captureException(error);
    // Allow Sentry to send the error before exiting
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    Sentry.captureException(reason as Error);
  });
}

// Middleware for capturing HTTP errors
export function sentryErrorMiddleware(err: any, req: any, res: any, next: any): void {
  Sentry.withScope((scope) => {
    scope.setTag('method', req.method);
    scope.setTag('url', req.url);
    scope.setUser({
      id: req.user?.id || 'anonymous',
      email: req.user?.email,
    });
    scope.setContext('request', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    });
    Sentry.captureException(err);
  });
  next(err);
}

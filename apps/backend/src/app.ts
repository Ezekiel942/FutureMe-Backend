import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './api/routes/auth.routes';
import healthRoutes from './api/routes/health.routes';
import sessionRoutes from './api/routes/session.routes';
import adminRoutes from './api/routes/admin.routes';
import announcementRoutes from './api/routes/announcement.routes';
import auditRoutes from './api/routes/audit.routes';
import billingRoutes from './api/routes/billing.routes';
import insightRoutes from './api/routes/insight.routes';
import dashboardRoutes from './api/routes/dashboard.routes';
import projectRoutes from './api/routes/project.routes';
import taskRoutes from './api/routes/task.routes';
import userRoutes from './api/routes/user.routes';
import workforceRoutes from './api/routes/workforce.routes';
import tenantRoutes from './api/routes/tenant.routes';
import digitalTwinRoutes from './api/routes/digitalTwin.routes';
import skillGraphRoutes from './api/routes/skillGraph.routes';
import uploadRoutes from './modules/upload/upload.routes';
import errorHandler from './api/middlewares/error.middleware';
import paginationMiddleware from './api/middlewares/pagination.middleware';
import requestIdMiddleware from './api/middlewares/requestId.middleware';
import { sentryErrorMiddleware } from './infrastructure/monitoring/sentry';
import logger from '@utils/logger';
import requireAuth from './api/middlewares/auth.middleware';
import tenant from './api/middlewares/tenant.middleware';
import enforceTenantIsolation from './api/middlewares/enforceTenantIsolation.middleware';
import swaggerSpec from './config/swagger';
import { ENV } from './config/env';
import { requestLogger, errorLogger } from './api/middlewares/monitoring.middleware';

/**
 * Create and configure Express app
 */
export function createApp(): Express {
  const app = express();

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUEST ID MIDDLEWARE (must be first)
  // ═══════════════════════════════════════════════════════════════════════════
  // Generates/extracts request ID for request tracing and correlation
  app.use(requestIdMiddleware);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY HEADERS (helmet)
  // ═══════════════════════════════════════════════════════════════════════════
  // Helmet provides defense-in-depth for XSS, clickjacking, MIME sniffing, etc.
  // WebSockets continue to work unaffected (no blocking of Upgrade headers).
  app.use(
    helmet({
      // Content Security Policy: Prevents inline scripts and XSS
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // swagger-ui needs unsafe-inline
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
      // X-Frame-Options: DENY prevents clickjacking (site cannot be framed)
      frameguard: { action: 'deny' },
      // X-Content-Type-Options: nosniff prevents MIME type sniffing
      noSniff: true,
      // X-XSS-Protection: for older browser XSS filters
      xssFilter: true,
      // Referrer-Policy: controls referrer information
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Removes X-Powered-By header (does not advertise Express)
      hidePoweredBy: true,
      // HSTS (disabled for localhost; enabled in production over HTTPS)
      hsts: ENV.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    })
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CORS (environment-aware)
  // ═══════════════════════════════════════════════════════════════════════════
  // Development: Allow localhost and common dev ports
  // Production: Only allow whitelisted origins (requires ALLOWED_ORIGINS env var)
  const allowedOrigins = (() => {
    if (ENV.NODE_ENV === 'production') {
      // Production: strict whitelist (set via ALLOWED_ORIGINS env var)
      const origins = process.env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || [
        'https://futureme.local',
      ];
      return origins;
    }
    // Development: allow localhost and common dev ports
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5173', // Vite default
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];
  })();

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g., server-to-server, Postman)
        if (!requestOrigin) return callback(null, true);

        if (allowedOrigins.includes(requestOrigin)) {
          callback(null, true);
        } else {
          // Log disallowed origin in development for debugging
          if (ENV.NODE_ENV !== 'production') {
            console.warn(`[CORS] Blocked origin: ${requestOrigin}`);
          }
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true, // Allow cookies and auth headers
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 3600, // Preflight cache duration (1 hour)
    })
  );

  // Request logging
  app.use(morgan('dev'));

  // Cookie parsing
  app.use(cookieParser());

  // Request logging with monitoring
  app.use(requestLogger);

  // Request logging with monitoring
  app.use(requestLogger);

  // Request logging with monitoring
  app.use(requestLogger);

  // Structured request logger (includes requestId)
  app.use((req, res, next) => {
    const requestId = (res.locals && (res.locals as any).requestId) || (req as any).requestId;
    logger.info('HTTP request', { requestId, method: req.method, path: req.path, ip: req.ip });
    next();
  });

  // JSON and URL-encoded body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Global pagination normalizer for list endpoints
  app.use(paginationMiddleware);

  // ═══════════════════════════════════════════════════════════════════════════
  // SWAGGER/OPENAPI DOCUMENTATION (public, unprotected)
  // ═══════════════════════════════════════════════════════════════════════════
  // Disabled in production for security; enabled in development for debugging
  if (process.env.NODE_ENV !== 'production') {
    // Serve Swagger UI at /docs (visual interface)
    const swaggerOptions = {
      deepLinking: true,
      displayOperationId: false,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      docExpansion: 'list' as const,
      layout: 'StandaloneLayout',
      withCredentials: true,
    };

    app.use('/docs', swaggerUi.serve);
    app.get('/docs', swaggerUi.setup(swaggerSpec, { swaggerOptions }));

    // Serve raw OpenAPI spec as JSON at /docs-json (for programmatic access)
    app.get('/docs-json', (req: Request, res: Response) => {
      res.type('application/json');
      res.send(swaggerSpec);
    });

    logger.info('Swagger UI enabled', {
      docsUrl: 'http://localhost:' + (process.env.PORT || 8080) + '/docs',
      specUrl: 'http://localhost:' + (process.env.PORT || 8080) + '/docs-json',
      environment: process.env.NODE_ENV,
    });
  } else {
    logger.info('Swagger UI disabled in production', {
      environment: process.env.NODE_ENV,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION & TENANT ISOLATION (applied to protected routes only)
  // ═══════════════════════════════════════════════════════════════════════════
  // Order is CRITICAL:
  // 1. requireAuth: Verifies JWT and extracts user
  // 2. tenant: Extracts organizationId (tenantId) from user.organizationId
  // 3. enforceTenantIsolation: Validates no cross-tenant access attempts
  // These are applied conditionally in routes that need them
  // Not applied to health/auth endpoints (public access)

  // Lightweight health check endpoint (K8s/Docker compatible)
  // Returns immediately without querying database or Redis
  app.get('/healthz', (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json({ status: 'ok' });
  });

  // Health check
  app.use('/api/health', healthRoutes);

  // Upload routes (requires auth)
  app.use('/api/upload', uploadRoutes);

  // API Routes (all verified routes)
  app.use('/api/auth', authRoutes);
  app.use('/api/v1/sessions', sessionRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/announcements', announcementRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/insights', insightRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/tenant', tenantRoutes);
  app.use('/api/v1/tasks', taskRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/workforce', workforceRoutes);
  app.use('/api/v1/digital-twin', digitalTwinRoutes);
  app.use('/api/v1/skills', skillGraphRoutes);

  // Error logger (before final error handler)
  app.use(errorLogger);

  // Error logger (before final error handler)
  app.use(errorLogger);

  // Error logger (before final error handler)
  app.use(errorLogger);

  // Sentry error capture (before final error handler)
  app.use(sentryErrorMiddleware);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

// Default export a new app instance for server.ts
export default createApp();

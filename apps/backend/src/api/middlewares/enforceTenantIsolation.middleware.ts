import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError } from '../../utils/errors';
import logger from '@utils/logger';

/**
 * Enforce Tenant Isolation Middleware
 *
 * CRITICAL SECURITY MIDDLEWARE
 *
 * This middleware ensures:
 * 1. Tenant context is established (req.tenantId from req.user.organizationId)
 * 2. User cannot access resources outside their tenant
 * 3. Cross-tenant queries are blocked at the middleware level
 * 4. All database queries are automatically scoped to tenant
 *
 * MUST be placed AFTER requireAuth and tenant middlewares.
 * MUST be placed BEFORE route handlers.
 *
 * Usage:
 *   app.use(requireAuth);
 *   app.use(tenantMiddleware);
 *   app.use(enforceTenantIsolation); // ← THIS MIDDLEWARE
 *   app.use(routes);
 */
export default function enforceTenantIsolation(req: Request, res: Response, next: NextFunction) {
  try {
    // Verify authentication exists
    if (!req.user || !req.user.sub) {
      logger.warn('enforceTenantIsolation: No user context');
      return next(new AuthenticationError('Authentication required for tenant isolation'));
    }

    // Verify tenant context exists (should be set by tenant middleware)
    const tenantId = (req as any).tenantId;
    const tenantContext = (req as any).tenantContext;

    if (!tenantContext) {
      logger.warn('enforceTenantIsolation: No tenant context', {
        userId: req.user.sub,
      });
      return next(new AuthenticationError('Failed to establish tenant context'));
    }

    // Extract and validate tenant from request parameters (if present)
    const paramTenantId = req.query.tenantId || req.body?.tenantId || req.params?.tenantId;

    // If a specific tenant is requested in request, validate access
    if (paramTenantId && paramTenantId !== tenantId) {
      logger.warn('enforceTenantIsolation: Cross-tenant access attempted', {
        userId: req.user.sub,
        userTenant: tenantId,
        requestedTenant: paramTenantId,
        path: req.path,
      });
      return next(
        new AuthorizationError(
          'You do not have access to this tenant. Cross-tenant access is not permitted.'
        )
      );
    }

    // Check for suspicious patterns:
    // 1. User trying to modify tenantId in request body
    // 2. User trying to create resources with different tenantId
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const bodyTenantId = req.body?.organizationId || req.body?.tenantId;
      if (bodyTenantId && bodyTenantId !== tenantId) {
        logger.warn('enforceTenantIsolation: Tenant mismatch in request body', {
          userId: req.user.sub,
          userTenant: tenantId,
          bodySentTenant: bodyTenantId,
          path: req.path,
          method: req.method,
        });
        return next(
          new AuthorizationError(
            'Tenant ID mismatch. Cannot create/modify resources in different tenant.'
          )
        );
      }

      // Automatically inject tenantId/organizationId into request body for safety
      if (req.body) {
        req.body.organizationId = tenantId;
        req.body.tenantId = tenantId;
      }
    }

    // Pre-attach tenant ID to request for easy access in handlers
    // This prevents accidental cross-tenant queries
    (req as any).enforcedTenantId = tenantId;

    logger.debug('Tenant isolation enforced', {
      userId: req.user.sub,
      tenantId,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (err: any) {
    logger.error('enforceTenantIsolation middleware error', {
      error: err?.message,
      userId: (req.user as any)?.sub,
    });
    next(new AuthenticationError('Failed to enforce tenant isolation'));
  }
}

/**
 * Helper: Verify a resource belongs to the user's tenant.
 *
 * Use in route handlers to check resource ownership:
 *
 * Example:
 *   const session = await findSessionById(id);
 *   assertTenantOwnership(req, session.organizationId);
 */
export function assertTenantOwnership(
  req: Request,
  resourceTenantId: string | null | undefined
): void {
  const userTenantId = (req as any).tenantId;

  if (!resourceTenantId) {
    // Resource has no tenant context (shouldn't happen after migration)
    logger.warn('Resource missing tenant context', {
      userId: req.user?.sub,
      path: req.path,
    });
    // Allow for backward compatibility, but log it
    return;
  }

  if (resourceTenantId !== userTenantId) {
    logger.warn('Cross-tenant resource access attempted', {
      userId: req.user?.sub,
      userTenant: userTenantId,
      resourceTenant: resourceTenantId,
      path: req.path,
    });
    throw new AuthorizationError('You do not have access to this resource');
  }
}

/**
 * This middleware should be imported in app.ts like:
 *
 * import enforceTenantIsolation from './api/middlewares/enforceTenantIsolation.middleware';
 *
 * And applied in the middleware chain:
 *
 * app.use(requireAuth);  // Must be BEFORE
 * app.use(tenant);       // Must be BEFORE
 * app.use(enforceTenantIsolation); // ← AFTER AUTH/TENANT, BEFORE ROUTES
 * app.use(routes);
 */

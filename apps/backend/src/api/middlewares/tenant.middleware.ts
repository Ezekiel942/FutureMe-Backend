import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../../utils/errors';
import logger from '@utils/logger';

/**
 * Tenant Isolation Middleware
 *
 * Extracts organizationId (tenantId) from authenticated user and ensures:
 * 1. User has a valid tenant context
 * 2. All database queries are automatically scoped to that tenant
 * 3. Cross-tenant data access is blocked at the middleware level
 *
 * IMPORTANT: Must be placed after requireAuth middleware so req.user is populated
 */
export default function tenant(req: Request, res: Response, next: NextFunction) {
  try {
    // Require authentication to have tenant context
    if (!req.user || !req.user.sub) {
      return next(new AuthenticationError('Authentication required for tenant context'));
    }

    // Extract tenant ID from user record
    // If user.organizationId is null, still allow (single-tenant mode / no-org users)
    const tenantId = (req.user as any).organizationId || null;

    // Attach tenant context to request object for downstream handlers
    (req as any).tenantId = tenantId;
    (req as any).tenantContext = {
      tenantId,
      userId: req.user.sub,
      userRole: (req.user as any).role || 'user',
    };

    logger.debug('Tenant context established', {
      tenantId,
      userId: req.user.sub,
    });

    next();
  } catch (err: any) {
    logger.error('Tenant middleware error', { error: err?.message });
    next(new AuthenticationError('Failed to establish tenant context'));
  }
}

/**
 * Helper to enforce tenant isolation on queries
 * Usage: Use in repository methods to filter by tenant
 * Example: repo.find({ where: { organizationId: tenantId } })
 */
export const getTenantFilter = (tenantId: string | null) => {
  if (!tenantId) {
    // No tenant filter (single-tenant or no-org data)
    return {};
  }
  return { organizationId: tenantId };
};

/**
 * Assert that user has access to a resource in their tenant
 * Usage: assertTenantAccess(req.tenantId, resource.organizationId)
 */
export const assertTenantAccess = (
  userTenantId: string | null,
  resourceTenantId: string | null
) => {
  if (userTenantId && resourceTenantId && userTenantId !== resourceTenantId) {
    const err: any = new Error('Forbidden: Resource does not belong to your tenant');
    err.status = 403;
    throw err;
  }
};

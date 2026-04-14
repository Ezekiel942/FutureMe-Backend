import { Request, Response, NextFunction } from 'express';
import { Permission, RolePermissions, Role } from '../permissions';
import { AuthorizationError, AuthenticationError } from '../../utils/errors';
import logger from '@utils/logger';

/**
 * Require a specific permission. Safe-mode middleware:
 * - Does not overwrite req.user
 * - If req.user.permissions exists, use it
 * - Otherwise derive permissions from req.user.role via RolePermissions
 * - Never throws; returns 403 on missing permission
 */
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) return next(new AuthenticationError('Authentication required'));

      // Prefer explicit permissions attached to user
      const isRole = (r: unknown): r is Role => r === 'admin' || r === 'manager' || r === 'user';

      const role = user && typeof (user as any).role === 'string' ? (user as any).role : undefined;

      const perms: string[] = Array.isArray((user as any).permissions)
        ? (user as any).permissions
        : (isRole(role) ? RolePermissions[role] : []).map((p: string) => p as string);

      if (!perms.includes(permission as string)) {
        logger.warn('Permission denied', { userId: user.id, role: user.role, permission });
        return next(new AuthorizationError('Forbidden'));
      }

      return next();
    } catch (err) {
      // Ensure middleware never throws — translate to forbidden
      logger.error('Permission middleware error', { error: String(err) });
      return next(new AuthorizationError('Forbidden'));
    }
  };
};

export default requirePermission;

import { Request, Response, NextFunction } from 'express';
import * as AuthService from '../../modules/auth/auth.service';
import { AuthenticationError, AuthorizationError } from '../../utils/errors';
import logger from '@utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Extract and verify Supabase JWT from Authorization header
 * Sets req.user with decoded payload
 */
export const extractAuthToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AuthenticationError('Missing or invalid authorization header'));
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      const payload = await AuthService.verifyToken(token);

      // Normalize user object to ensure both id and sub are set
      if (!payload.id && payload.sub) {
        payload.id = payload.sub;
      }
      if (!payload.sub && payload.id) {
        payload.sub = payload.id;
      }

      req.user = payload;
      // Provide a permissions array placeholder for downstream code
      try {
        (req.user as any).permissions = [];
      } catch (e) {
        // ignore
      }

      logger.debug('Supabase JWT verified', { userId: payload.id || payload.sub });
      return next();
    } catch (err: any) {
      if (err.message?.includes('expired') || err.message?.includes('Token expired')) {
        return next(new AuthenticationError('Token expired'));
      }
      if (err.message?.includes('invalid') || err.message?.includes('Invalid token')) {
        return next(new AuthenticationError('Invalid token'));
      }
      return next(new AuthenticationError('Token verification failed'));
    }
  } catch (err) {
    return next(err);
  }
};

/**
 * Require authenticated user
 * Can be used after extractAuthToken OR as standalone for legacy support
 */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // If already extracted by extractAuthToken middleware, just verify
  if (req.user && (req.user.id || req.user.sub)) {
    // Normalize user object to ensure both id and sub are set
    if (!req.user.id && req.user.sub) {
      req.user.id = req.user.sub;
    }
    if (!req.user.sub && req.user.id) {
      req.user.sub = req.user.id;
    }
    return next();
  }

  // Legacy: extract from header if not already set
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AuthenticationError('Missing authorization token'));
  }

  const token = header.slice(7);

  try {
    const payload = await AuthService.verifyToken(token);
    // Normalize user object
    if (!payload.id && payload.sub) {
      payload.id = payload.sub;
    }
    if (!payload.sub && payload.id) {
      payload.sub = payload.id;
    }
    req.user = payload;
    next();
  } catch (err: any) {
    const status = err?.status || 401;
    const message = err?.message || 'Unauthorized';
    next(new AuthenticationError(message));
  }
}

/**
 * Require admin role
 * Must be used after extractAuthToken or requireAuth middleware
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user || !user.sub) {
    return next(new AuthenticationError('Authentication required'));
  }
  if (user.role !== 'admin') {
    logger.warn('Unauthorized admin access attempt', {
      userId: user.sub,
      role: user.role,
      path: req.path,
    });
    return next(new AuthorizationError('Forbidden'));
  }
  next();
};

/**
 * Require user to own the resource (by checking userId param)
 * Must be used after extractAuthToken or requireAuth middleware
 */
export const requireOwnResource = (paramName: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !user.sub) {
      return next(new AuthenticationError('Authentication required'));
    }

    // Enforce data ownership: override any userId provided in body/query
    try {
      if (req.body && typeof req.body === 'object') (req.body as any).userId = user.sub;
      if (req.query && typeof req.query === 'object') (req.query as any).userId = user.sub;
    } catch (e) {
      // ignore
    }

    const resourceOwnerId = req.params[paramName];
    if (resourceOwnerId && resourceOwnerId !== user.sub) {
      logger.warn('Unauthorized resource access attempt', {
        userId: user.sub,
        resourceOwnerId,
        resourceType: paramName,
        path: req.path,
      });
      return next(new AuthorizationError('Forbidden'));
    }

    next();
  };
};

export default requireAuth;

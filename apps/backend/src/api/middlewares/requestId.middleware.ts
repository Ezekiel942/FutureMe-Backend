import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '@utils/logger';

/**
 * Request ID Middleware
 *
 * Generates or extracts request ID from headers and attaches it to all requests.
 * Enables correlation of logs across service calls and distributed tracing.
 *
 * Priority:
 * 1. x-request-id header (if provided by client/upstream)
 * 2. x-correlation-id header (if provided)
 * 3. Generate new UUID
 *
 * The request ID is attached to:
 * - req.id
 * - req.headers['x-request-id']
 * - Response header x-request-id
 * - All logger calls via req context
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Helper to coerce header values to a single string
  const headerToString = (val: string | string[] | undefined): string | undefined => {
    if (!val) return undefined;
    return Array.isArray(val) ? val[0] : val;
  };

  // Determine request ID from headers or generate a new one
  const extracted =
    headerToString(req.headers['x-request-id']) || headerToString(req.headers['x-correlation-id']);

  const requestId: string = extracted ?? uuidv4();

  // Attach to request object (typed as any since express.Request doesn't have these properties)
  (req as any).id = requestId;
  (req as any).requestId = requestId;

  // Ensure header is set (for propagation downstream)
  req.headers['x-request-id'] = requestId;

  // Attach to response for client visibility
  res.setHeader('x-request-id', requestId);

  // Attach request ID to response locals for logger access
  res.locals.requestId = requestId;

  logger.debug('Request initiated', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  next();
}

export default requestIdMiddleware;

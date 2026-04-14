import { Request, Response, NextFunction } from 'express';

/**
 * Normalize pagination query params across endpoints.
 * - Accepts `page` (1-based) and `limit`, computes `offset`.
 * - Ensures sane defaults and max limits.
 * - Normalizes `sort` default to `createdAt:desc` when missing.
 */
export default function paginationMiddleware(req: Request, res: Response, next: NextFunction) {
  const q = req.query || {};

  const page = Math.max(parseInt(String(q.page as any) || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(String(q.limit as any) || '20', 10), 1), 100);
  const offset = (page - 1) * limit;

  // Attach normalized pagination to request for controllers to use
  (req as any).pagination = { page, limit, offset };

  // Provide offset and limit fallbacks for controllers expecting them
  (req.query as any).limit = String(limit);
  (req.query as any).offset = String(offset);

  if (!req.query.sort) {
    (req.query as any).sort = 'createdAt:desc';
  }

  next();
}

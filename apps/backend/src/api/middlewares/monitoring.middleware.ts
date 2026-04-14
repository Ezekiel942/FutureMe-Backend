import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

interface RequestLog {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  ip: string | undefined;
  userAgent?: string;
  timestamp: Date;
}

/**
 * Request logging middleware with performance monitoring
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = (res.locals && (res.locals as any).requestId) || (req as any).requestId;

  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.sub,
  });

  // Listen for response finish to log completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const logData: RequestLog = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: duration,
      userId: (req as any).user?.sub,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date(),
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed successfully', logData);
    }
  });

  next();
};

/**
 * Error logging middleware
 */
export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = (res.locals && (res.locals as any).requestId) || (req as any).requestId;

  logger.error('Request error', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: (req as any).user?.sub,
    error: {
      message: err.message,
      stack: err.stack,
      status: err.status || 500,
    },
  });

  next(err);
};

export default { requestLogger, errorLogger };

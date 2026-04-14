import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors';
import logger from '@utils/logger';

/**
 * Enhanced error handler middleware
 * - Logs all errors with structured information
 * - Sanitizes error responses (hides sensitive info in production)
 * - Handles AppError instances and generic errors uniformly
 */
export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Log the error for monitoring and debugging
  const errorMetadata = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
    userAgent: req.get('user-agent'),
  };

  // Handle AppError instances
  if (err instanceof AppError) {
    logger.warn('AppError', {
      ...errorMetadata,
      code: err.code,
      status: err.status,
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.details : undefined,
    });

    return res.status(err.status).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && err.details && { details: err.details }),
    });
  }

  // Handle known error types
  if (err.name === 'ValidationError' && err.errors) {
    // Joi or similar validation error
    const message = 'Validation failed';
    const details = err.errors.map((e: any) => ({
      field: e.context?.label || e.path.join('.'),
      message: e.message,
      type: e.type,
    }));

    logger.warn('ValidationError', {
      ...errorMetadata,
      details,
    });

    return res.status(400).json({
      success: false,
      message,
      code: 'VALIDATION_ERROR',
      details,
    });
  }

  if (err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT') {
    // Database duplicate entry error
    logger.warn('Database duplicate entry', {
      ...errorMetadata,
      originalMessage: err.message,
    });

    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      code: 'CONFLICT',
    });
  }

  // Handle TypeORM errors
  if (err.name === 'QueryFailedError') {
    logger.error('Database query error', {
      ...errorMetadata,
      originalMessage: err.message,
      databaseMessage:
        process.env.NODE_ENV === 'development' ? err.driverError?.message : undefined,
    });

    return res.status(500).json({
      success: false,
      message: 'Database operation failed',
      code: 'DATABASE_ERROR',
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    logger.warn('Invalid token', {
      ...errorMetadata,
      originalMessage: err.message,
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      code: 'AUTH_INVALID_TOKEN',
    });
  }

  if (err.name === 'TokenExpiredError') {
    logger.warn('Expired token', {
      ...errorMetadata,
      originalMessage: err.message,
    });

    return res.status(401).json({
      success: false,
      message: 'Expired token',
      code: 'AUTH_EXPIRED_TOKEN',
    });
  }

  // Default error handling (unhandled exceptions)
  const status = err?.status || 500;
  const message = status === 500 ? 'Internal Server Error' : err?.message || 'An error occurred';
  const code = err?.code || 'INTERNAL_ERROR';

  logger.error('Unhandled error', {
    ...errorMetadata,
    status,
    message,
    code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(status).json({
    success: false,
    message,
    code,
  });
}

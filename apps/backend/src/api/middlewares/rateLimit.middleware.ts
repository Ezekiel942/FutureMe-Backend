import rateLimit from 'express-rate-limit';
import logger from '@utils/logger';

/**
 * General purpose rate limiter for all requests
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: 'Too many requests, please try again later.',
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;
    return false;
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Dev: 100 attempts per 15 minutes per IP
 * Prod: 5 attempts per 15 minutes per IP
 */
const isDev = process.env.NODE_ENV !== 'production';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 5, // limit login/register attempts
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count successful requests too
  message: 'Too many authentication attempts, please try again later.',
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      email: (req.body as any)?.email || 'unknown',
    });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

/**
 * Strict rate limiter for password reset / token refresh
 * 3 attempts per 15 minutes per IP
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // allow more refresh attempts since users need this frequently
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many refresh attempts, please try again later.',
  handler: (req, res) => {
    logger.warn('Refresh rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: 'Too many refresh attempts, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

/**
 * Register limiter: 3 requests per hour
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Register rate limit exceeded', { ip: req.ip });
    res
      .status(429)
      .json({ success: false, message: 'Too many registration attempts', code: 'RATE_LIMITED' });
  },
});

/**
 * Password reset limiter: 3 requests per hour
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Password reset rate limit exceeded', { ip: req.ip });
    res
      .status(429)
      .json({ success: false, message: 'Too many password reset attempts', code: 'RATE_LIMITED' });
  },
});

/**
 * Session start limiter: 10 per hour per IP
 */
export const sessionStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Session start rate limit exceeded', { ip: req.ip });
    res
      .status(429)
      .json({ success: false, message: 'Too many session start attempts', code: 'RATE_LIMITED' });
  },
});

/**
 * AI endpoints limiter: 5 requests per hour per user (more restrictive due to API costs)
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 AI requests per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP for AI endpoints
    return (req as any).user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.warn('AI rate limit exceeded', {
      userId: (req as any).user?.id,
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: 'AI request limit exceeded. Please try again later.',
      code: 'AI_RATE_LIMIT_EXCEEDED',
    });
  },
});

export default {
  generalLimiter,
  authLimiter,
  refreshLimiter,
};

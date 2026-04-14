import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../../utils/errors';

/**
 * Generic validation middleware factory using Zod
 * Validates req.body, req.params, and req.query against a schema
 *
 * Usage:
 *   router.post('/register', validateRequest(registerSchema), register);
 */
export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse incoming request data
      const validatedData = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      // Store validated data on request for use in controller
      (req as any).validated = validatedData;

      next();
    } catch (error: any) {
      // Extract Zod validation errors
      if (error.errors && Array.isArray(error.errors)) {
        const details = error.errors.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return next(new ValidationError('Invalid request payload', details));
      }

      next(new ValidationError('Invalid request payload'));
    }
  };
};

/**
 * Legacy validation functions (kept for backward compatibility)
 * These now validate using consistent rules but without Zod schema
 */
const makeError = (res: Response, msg: string) =>
  res.status(400).json({ success: false, message: msg, code: 'VALIDATION_ERROR' });

export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body || {};
  if (!firstName || String(firstName).trim().length < 2)
    return makeError(res, 'firstName is required (min 2 chars)');
  if (!lastName || String(lastName).trim().length < 2)
    return makeError(res, 'lastName is required (min 2 chars)');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return makeError(res, 'valid email is required');
  if (!password || String(password).length < 8)
    return makeError(res, 'password must be at least 8 characters');
  if (!password.match(/[A-Z]/))
    return makeError(res, 'password must contain at least one uppercase letter');
  if (!password.match(/[a-z]/))
    return makeError(res, 'password must contain at least one lowercase letter');
  if (!password.match(/[0-9]/)) return makeError(res, 'password must contain at least one digit');
  if (password !== confirmPassword) return makeError(res, 'confirmPassword must match password');
  next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return makeError(res, 'valid email is required');
  if (!password) return makeError(res, 'password is required');
  next();
};

export default (req: Request, res: Response, next: NextFunction) => next();

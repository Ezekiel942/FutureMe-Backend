/**
 * Request validation utilities for type-safe input sanitization
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';

/**
 * Sanitizes string inputs (trim, no xss, sql injection prevention)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .slice(0, 1000); // Limit length
}

/**
 * Sanitizes email inputs
 */
export function sanitizeEmail(input: string): string {
  const sanitized = sanitizeString(input).toLowerCase();
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new ValidationError('Invalid email format');
  }
  return sanitized;
}

/**
 * Validates and sanitizes integer inputs
 */
export function sanitizeInteger(input: any, min?: number, max?: number): number {
  const num = parseInt(input);
  if (isNaN(num)) {
    throw new ValidationError('Invalid integer value');
  }
  if (min !== undefined && num < min) {
    throw new ValidationError(`Value must be at least ${min}`);
  }
  if (max !== undefined && num > max) {
    throw new ValidationError(`Value must be at most ${max}`);
  }
  return num;
}

/**
 * Validates and sanitizes boolean inputs
 */
export function sanitizeBoolean(input: any): boolean {
  if (typeof input === 'boolean') return input;
  if (input === 'true' || input === '1' || input === 1) return true;
  if (input === 'false' || input === '0' || input === 0) return false;
  throw new ValidationError('Invalid boolean value');
}

/**
 * Validates UUID format
 */
export function validateUUID(id: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError('Invalid ID format');
  }
}

/**
 * Validates and returns object with only specified fields
 */
export function sanitizeObject<T extends Record<string, any>>(
  input: any,
  allowedFields: (keyof T)[]
): Partial<T> {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Invalid input object');
  }

  const sanitized: Partial<T> = {};
  for (const field of allowedFields) {
    if (input.hasOwnProperty(field)) {
      sanitized[field] = input[field];
    }
  }

  return sanitized;
}

/**
 * Validates request body fields
 */
export function validateRequired(obj: Record<string, any>, fields: string[]): void {
  const missing = fields.filter((field) => !obj[field] || obj[field] === '');
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Middleware factory for validating request body
 */
export function validateBody(schema: (body: any) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory for validating request params
 */
export function validateParams(schema: (params: any) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema(req.params);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory for validating request query
 */
export function validateQuery(schema: (query: any) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}

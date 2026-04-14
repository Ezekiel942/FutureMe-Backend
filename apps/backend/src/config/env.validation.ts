/**
 * Environment Variables Schema & Validation
 * Production-ready environment configuration with full validation
 */

import { z } from 'zod';

// =========================================
// Environment Variable Schema
// =========================================

const EnvironmentSchema = z.object({
  // Core Configuration (REQUIRED)
  NODE_ENV: z.enum(['development', 'production', 'staging', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1000).max(65535).default(2200),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_EXPIRY: z.coerce.number().int().min(300).default(3900),

  // Supabase (REQUIRED for database operations)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Redis (OPTIONAL)
  REDIS_ENABLED: z
    .enum(['true', 'false', 'True', 'False'])
    .transform((v) => v.toLowerCase() === 'true')
    .default('false'),
  REDIS_URL: z.string().url().optional(),
  REDIS_RETRY_INTERVAL: z.coerce.number().int().min(1000).default(5000),
  REDIS_CACHE_TTL: z.coerce.number().int().min(60).default(3600),

  // WebSocket (OPTIONAL)
  SOCKET_ENABLED: z
    .enum(['true', 'false', 'True', 'False'])
    .transform((v) => v.toLowerCase() === 'true')
    .default('true'),
  SOCKET_PING_INTERVAL: z.coerce.number().int().min(5000).default(30000),
  SOCKET_PING_TIMEOUT: z.coerce.number().int().min(10000).default(60000),

  // AI Services (OPTIONAL)
  AI_ENABLED: z
    .enum(['true', 'false', 'True', 'False'])
    .transform((v) => v.toLowerCase() === 'true')
    .default('false'),
  AI_MODEL: z.string().default('gpt-3.5-turbo'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  AI_CACHE_TTL: z.coerce.number().int().min(60).default(3600),
  AI_RATE_LIMIT_PER_TENANT: z.coerce.number().int().min(1).default(100),
  OPENAI_API_KEY: z.string().optional(),

  // Email Service (OPTIONAL)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Storage (OPTIONAL)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),

  // Monitoring (OPTIONAL)
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_REQUEST_LOGGING: z
    .enum(['true', 'false', 'True', 'False'])
    .transform((v) => v.toLowerCase() === 'true')
    .default('true'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),

  // Tenant Configuration
  DEFAULT_TENANT_PLAN: z.enum(['free', 'pro', 'enterprise']).default('pro'),
  MAX_USERS_PER_TENANT: z.coerce.number().int().min(1).default(1000),
  MAX_PROJECTS_PER_TENANT: z.coerce.number().int().min(1).default(100),

  // Presence & Idle Detection
  IDLE_TIMEOUT_MIN: z.coerce.number().int().min(1).default(5),
  IDLE_END_MIN: z.coerce.number().int().min(5).default(15),
  PRESENCE_HEARTBEAT_INTERVAL: z.coerce.number().int().min(5000).default(30000),

  // File Upload Limits
  MAX_AVATAR_SIZE_MB: z.coerce.number().int().min(1).default(5),
  MAX_FILE_UPLOAD_MB: z.coerce.number().int().min(1).default(50),

  // URLs
  APP_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().optional(),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

// =========================================
// Validation Function
// =========================================

export function validateEnvironment(): Environment {
  try {
    console.log(`🔍 Validating environment for NODE_ENV=${process.env.NODE_ENV || 'development'}`);

    const env = EnvironmentSchema.parse(process.env);

    // Cross-field validation
    if (env.REDIS_ENABLED && !env.REDIS_URL) {
      throw new Error('REDIS_ENABLED is true but REDIS_URL is not set');
    }

    if (env.AI_ENABLED && !env.OPENAI_API_KEY) {
      throw new Error('AI_ENABLED is true but OPENAI_API_KEY is not set');
    }

    // Database validation
    const hasSupabase = env.SUPABASE_URL && env.SUPABASE_ANON_KEY;
    if (!hasSupabase && env.NODE_ENV === 'production') {
      throw new Error(
        'Supabase configuration (SUPABASE_URL + SUPABASE_ANON_KEY) is required in production'
      );
    }

    // Email validation
    if (env.RESEND_API_KEY && !env.EMAIL_FROM) {
      console.warn('RESEND_API_KEY set but EMAIL_FROM not configured');
    }

    // Storage validation
    const hasAllS3Keys =
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION && env.AWS_S3_BUCKET;
    if (
      !hasAllS3Keys &&
      (env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY || env.AWS_REGION || env.AWS_S3_BUCKET)
    ) {
      console.warn('AWS S3 partially configured; all keys required for file storage');
    }

    // CORS validation
    if (!env.CORS_ORIGIN && env.NODE_ENV === 'production') {
      throw new Error('CORS_ORIGIN is required in production');
    }

    console.log('Environment validation passed');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:');
      error.errors.forEach((e) => {
        console.error(`   ${e.path.join('.')}: ${e.message}`);
      });
    } else {
      console.error('Environment validation error:', (error as Error).message);
    }
    process.exit(1);
  }
}

// =========================================
// Load and validate on module import
// =========================================

export const ENV = validateEnvironment();

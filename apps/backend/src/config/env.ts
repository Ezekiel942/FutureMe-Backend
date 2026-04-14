import * as dotenv from 'dotenv';

// Load environment files based on NODE_ENV
// IMPORTANT: Does NOT load default .env file to prevent overrides
const loadEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Load environment-specific file only
  if (nodeEnv === 'development') {
    dotenv.config({ path: '.env.development' });
  } else if (nodeEnv === 'production') {
    dotenv.config({ path: '.env.production' });
  }
  // Note: .env file is NOT loaded to prevent accidental overrides
};

loadEnvironment();

// Environment validation with improved error handling
const validateEnvironment = () => {
  console.log(`Validating environment for NODE_ENV=${process.env.NODE_ENV || 'development'}`);

  // REQUIRED variables - app will crash if missing
  const requiredVars = ['PORT'];
  const missingRequired = requiredVars.filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    console.error('CRITICAL: Missing required environment variables:');
    missingRequired.forEach((key) => console.error(`   - ${key}`));
    console.error('\nThese variables are required for the app to function.');
    process.exit(1);
  }

  // Validate Supabase configuration (required for auth and database)
  const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
  if (!hasSupabase) {
    console.error(
      'CRITICAL: Missing Supabase configuration. Required for authentication and database:'
    );
    console.error('   - SUPABASE_URL');
    console.error('   - SUPABASE_ANON_KEY');
    console.error('\nSupabase Auth is now required for user authentication.');
    process.exit(1);
  }

  if (hasSupabase) {
    console.log('Using Supabase for database operations');
  } else {
    console.warn(
      'DATABASE_URL found; legacy Postgres configuration is still detected, but Supabase is preferred.'
    );
  }

  // OPTIONAL services - log warnings but don't crash
  const optionalServices = {
    'Email (Resend)': ['RESEND_API_KEY', 'EMAIL_FROM'],
    'AWS S3 Storage': ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'],
    'OpenAI AI Features': ['OPENAI_API_KEY'],
    'Redis Caching': ['REDIS_URL'],
    'Sentry Monitoring': ['SENTRY_DSN'],
  };

  let hasWarnings = false;
  for (const [service, vars] of Object.entries(optionalServices)) {
    const missing = vars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      if (!hasWarnings) {
        console.log('\nOPTIONAL SERVICES: Some features will be disabled:');
        hasWarnings = true;
      }
      console.log(`   - ${service}: Missing ${missing.join(', ')}`);
    }
  }

  if (hasWarnings) {
    console.log('\nOptional services can be configured later without restarting the app.');
  }

    console.log('Environment validation passed');
};

validateEnvironment();

// Helper function to get optional env var with default
const getOptionalEnv = (key: string, defaultValue?: string): string | undefined => {
  return process.env[key] || defaultValue;
};

// Helper function to get optional boolean
const getOptionalBoolean = (key: string, defaultValue: boolean = false): boolean => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

export const ENV = {
  // ==========================================
  // REQUIRED VARIABLES (app will crash if missing)
  // ==========================================
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT!, 10),
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,

  // ==========================================
  // OPTIONAL VARIABLES (with safe defaults)
  // ==========================================

  // Database (legacy support)
  DATABASE_URL: process.env.DATABASE_URL,

  // URLs and CORS
  APP_URL: getOptionalEnv('APP_URL', `http://localhost:${process.env.PORT || 3000}`),
  FRONTEND_URL: getOptionalEnv('FRONTEND_URL', `http://localhost:3000`),
  CORS_ORIGIN: getOptionalEnv('CORS_ORIGIN', 'http://localhost:3000'),

  // Email Service (Resend) - Optional
  RESEND_API_KEY: getOptionalEnv('RESEND_API_KEY'),
  EMAIL_FROM: getOptionalEnv('EMAIL_FROM'),

  // AI Service (OpenAI) - Optional
  OPENAI_API_KEY: getOptionalEnv('OPENAI_API_KEY'),
  OPENAI_MODEL: getOptionalEnv('OPENAI_MODEL', 'gpt-3.5-turbo'),
  AI_ENABLED: getOptionalBoolean('AI_ENABLED', false),

  // Storage Service (AWS S3) - Optional
  AWS_ACCESS_KEY_ID: getOptionalEnv('AWS_ACCESS_KEY_ID'),
  AWS_SECRET_ACCESS_KEY: getOptionalEnv('AWS_SECRET_ACCESS_KEY'),
  AWS_REGION: getOptionalEnv('AWS_REGION'),
  AWS_S3_BUCKET: getOptionalEnv('AWS_S3_BUCKET'),

  // Caching (Redis) - Optional
  REDIS_URL: getOptionalEnv('REDIS_URL'),

  // Monitoring (Sentry) - Optional
  SENTRY_DSN: getOptionalEnv('SENTRY_DSN'),

  // Other optional settings
  RATE_LIMIT_WINDOW: parseInt(getOptionalEnv('RATE_LIMIT_WINDOW', '900000')!, 10), // 15min
  RATE_LIMIT_MAX: parseInt(getOptionalEnv('RATE_LIMIT_MAX', '100')!, 10),
  SOCKET_ENABLED: getOptionalBoolean('SOCKET_ENABLED', true),

  // Legacy compatibility (deprecated - will be removed)
  JWT_SECRET: getOptionalEnv('JWT_SECRET'), // No longer required
  JWT_EXPIRES_IN: getOptionalEnv('JWT_EXPIRES_IN', '1h'),
  SALT_ROUNDS: Number(getOptionalEnv('SALT_ROUNDS', '10')),
};

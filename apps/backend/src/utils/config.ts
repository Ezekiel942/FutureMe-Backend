/**
 * Environment configuration validator
 * Runs at startup to ensure all required environment variables are set
 * and database connectivity is available
 */

import logger from './logger';

interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  JWT_SECRET: string;
  DATABASE_URL: string;
  DATABASE_TYPE: 'postgres';
  SOCKET_ENABLED: boolean;
}

/**
 * Validates required environment variables
 */
export function validateEnvironment(): EnvironmentConfig {
  logger.info('Validating environment configuration...');

  // Required variables
  const required = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TYPE: 'postgres',
    SOCKET_ENABLED: process.env.SOCKET_ENABLED !== 'false',
  };

  // Validate NODE_ENV
  if (!['development', 'production', 'test'].includes(required.NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV: ${required.NODE_ENV}. Must be development, production, or test.`
    );
  }

  // Validate PORT
  if (isNaN(required.PORT) || required.PORT < 1 || required.PORT > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535.`);
  }

  // Validate JWT_SECRET
  if (!required.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required.');
  }

  if (required.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET is less than 32 characters. This is not recommended for production.', {
      length: required.JWT_SECRET.length,
    });
  }

  // Enforce PostgreSQL only
  if (required.DATABASE_TYPE !== 'postgres') {
    throw new Error('Invalid DATABASE_TYPE: must be postgres. Sqlite/sql.js are not supported.');
  }

  // Validate DATABASE_URL presence
  if (!required.DATABASE_URL) {
    throw new Error('DATABASE_URL is required and must be a PostgreSQL connection string.');
  }

  // Validate DATABASE_URL prefix
  if (!required.DATABASE_URL.startsWith('postgresql://')) {
    throw new Error('Invalid DATABASE_URL: must be PostgreSQL connection string');
  }

  // Validate URL format strictly
  try {
    new URL(required.DATABASE_URL);
  } catch {
    throw new Error('Invalid DATABASE_URL format.');
  }

  logger.info('Environment validation passed', {
    nodeEnv: required.NODE_ENV,
    port: required.PORT,
    databaseType: required.DATABASE_TYPE,
    socketEnabled: required.SOCKET_ENABLED,
  });

  return required as EnvironmentConfig;
}

/**
 * Validates database connectivity
 * Run this after initializing the database connection
 */
export async function validateDatabaseConnection(testQuery: () => Promise<any>): Promise<boolean> {
  logger.info('Validating database connection...');

  try {
    await testQuery();
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Unable to connect to database. Check DATABASE_URL and database service.');
  }
}

/**
 * Validates system startup requirements
 */
export async function validateStartup(testDbQuery: () => Promise<any>): Promise<void> {
  logger.info('Starting system validation...');

  // Validate environment first
  validateEnvironment();

  // Then validate database
  await validateDatabaseConnection(testDbQuery);

  logger.info('System validation complete. Ready for operations.');
}

export default {
  validateEnvironment,
  validateDatabaseConnection,
  validateStartup,
};

/**
 * Swagger/OpenAPI 3.0 Configuration
 *
 * Production-safe configuration for swagger-jsdoc and swagger-ui-express.
 * Handles both development (ts-node with .ts files) and compiled production (JavaScript).
 */

import swaggerJsdoc, { Options as SwaggerOptions } from 'swagger-jsdoc';
import path from 'path';
import logger from '@utils/logger';

/**
 * Determine the correct file extension based on runtime environment
 * - Development (ts-node): .ts files
 * - Production (compiled): .js files
 */
const getFileExtension = (): string => {
  // Check if running with ts-node or tsx (development)
  const hasTypescriptLoader = require.extensions['.ts'] !== undefined;
  return hasTypescriptLoader ? 'ts' : 'js';
};

/**
 * Swagger/OpenAPI 3.0.0 Configuration
 * Compliant with OpenAPI 3.0.0 specification
 * https://spec.openapis.org/oas/v3.0.0
 */
const options: SwaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FutureMe API',
      version: '1.0.0',
      description:
        'Production-grade REST API for FutureMe. Provides endpoints for authentication, work session tracking, risk detection, insights, and team management.',
      contact: {
        name: 'FutureMe Support',
        email: 'support@futureme.local',
        url: 'https://futureme.local',
      },
      license: {
        name: 'Proprietary',
        url: 'https://futureme.local/license',
      },
      'x-logo': {
        url: 'https://futureme.local/logo.png',
        altText: 'FutureMe Logo',
      },
    },
    servers: [
      {
        url: 'http://localhost:2200',
        description: 'Development server',
        variables: {
          protocol: {
            default: 'http',
          },
          host: {
            default: 'localhost:2200',
          },
        },
      },
      {
        url: '{protocol}://{host}',
        description: 'Custom server',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'https',
          },
          host: {
            default: 'api.futureme.local',
          },
        },
      },
    ],
    // Global security definition (JWT Bearer)
    security: [
      {
        bearerAuth: [],
      },
    ],
    // Components: Reusable schemas and security schemes
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token. Obtain via POST /api/auth/login',
        },
      },
      schemas: {
        // Generic Error Response
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Machine-readable error code',
                  example: 'INVALID_INPUT',
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                  example: 'Validation failed',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details (optional)',
                  nullable: true,
                },
              },
              required: ['code', 'message'],
            },
          },
          required: ['success', 'error'],
        },
        // HTTP 400 Bad Request
        BadRequest: {
          allOf: [{ $ref: '#/components/schemas/Error' }],
        },
        // HTTP 401 Unauthorized
        Unauthorized: {
          allOf: [{ $ref: '#/components/schemas/Error' }],
        },
        // HTTP 403 Forbidden
        Forbidden: {
          allOf: [{ $ref: '#/components/schemas/Error' }],
        },
        // HTTP 404 Not Found
        NotFound: {
          allOf: [{ $ref: '#/components/schemas/Error' }],
        },
        // HTTP 500 Internal Server Error
        InternalServerError: {
          allOf: [{ $ref: '#/components/schemas/Error' }],
        },
        // User object
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            firstName: {
              type: 'string',
              description: 'User first name',
            },
            lastName: {
              type: 'string',
              description: 'User last name',
            },
            role: {
              type: 'string',
              enum: ['admin', 'manager', 'project_lead', 'user'],
              description: 'User role',
            },
            organizationId: {
              type: 'string',
              format: 'uuid',
              description: 'Organization (tenant) ID',
              nullable: true,
            },
          },
          required: ['id', 'email', 'firstName', 'lastName', 'role'],
        },
        // Authentication response
        AuthToken: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                  description: 'JWT access token (~15 min expiry)',
                },
                refreshToken: {
                  type: 'string',
                  description: 'JWT refresh token (7 days expiry)',
                },
                user: {
                  $ref: '#/components/schemas/User',
                },
              },
              required: ['accessToken', 'refreshToken', 'user'],
            },
          },
          required: ['success', 'data'],
        },
        // Work Session
        WorkSession: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Session ID',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            organizationId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            projectId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            startTime: {
              type: 'string',
              format: 'date-time',
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['active', 'paused', 'ended'],
            },
            durationSeconds: {
              type: 'number',
              nullable: true,
            },
            metadata: {
              type: 'object',
              nullable: true,
            },
          },
          required: ['id', 'userId', 'startTime', 'status'],
        },
        // Session (API response schema)
        Session: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique session identifier',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'User ID who owns the session',
            },
            projectId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Optional project ID associated with the session',
            },
            startTime: {
              type: 'string',
              format: 'date-time',
              description: 'Session start timestamp',
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Session end timestamp (null for active sessions)',
            },
            durationSeconds: {
              type: 'number',
              nullable: true,
              description: 'Total session duration in seconds',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Session creation timestamp',
            },
          },
          required: ['id', 'userId', 'startTime', 'createdAt'],
        },
        // Session Response (single session)
        SessionResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              oneOf: [{ $ref: '#/components/schemas/Session' }, { type: 'null' }],
            },
          },
          required: ['success', 'data'],
        },
        // Session List Response (with pagination)
        SessionList: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Session',
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  description: 'Total number of sessions',
                },
                page: {
                  type: 'integer',
                  description: 'Current page number',
                },
                limit: {
                  type: 'integer',
                  description: 'Items per page',
                },
                totalPages: {
                  type: 'integer',
                  description: 'Total number of pages',
                },
              },
              required: ['total', 'page', 'limit', 'totalPages'],
            },
          },
          required: ['success', 'data', 'pagination'],
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User registration, login, token management',
      },
      {
        name: 'Sessions',
        description: 'Work session tracking and management',
      },
      {
        name: 'Insights',
        description: 'Risk detection and performance insights',
      },
      {
        name: 'Billing',
        description: 'Subscription and billing management',
      },
      {
        name: 'Audit',
        description: 'Activity logs and audit trails',
      },
      {
        name: 'Dashboard',
        description: 'Real-time team and organization metrics',
      },
      {
        name: 'Admin',
        description: 'Administrative operations',
      },
      {
        name: 'Health',
        description: 'System health and liveness checks',
      },
    ],
  },
  /**
   * File paths containing JSDoc swagger comments
   * Supports both ts-node (development) and compiled JS (production)
   */
  apis: [path.join(__dirname, `../api/routes/*${getFileExtension() === 'ts' ? '.ts' : '.js'}`)],
};

/**
 * Generate OpenAPI spec from JSDoc comments in route files
 * Includes error handling and validation
 */
let swaggerSpec: Record<string, any>;

try {
  swaggerSpec = swaggerJsdoc(options);

  // Validate that spec was generated successfully
  if (!swaggerSpec || !swaggerSpec.openapi) {
    throw new Error('Failed to generate valid OpenAPI spec');
  }

  // Ensure required OpenAPI 3.0.0 fields are present
  if (!swaggerSpec.info) {
    throw new Error('OpenAPI spec missing required "info" field');
  }
  if (!swaggerSpec.paths) {
    swaggerSpec.paths = {}; // Empty paths is valid, will be populated by JSDoc
  }

  logger.info('Swagger spec generated successfully', {
    endpoints: Object.keys(swaggerSpec.paths || {}).length,
    openapi: swaggerSpec.openapi,
  });
} catch (error: any) {
  logger.error('Failed to generate Swagger spec', {
    error: error?.message,
    stack: error?.stack,
  });

  // Return a minimal valid OpenAPI spec if generation fails
  // This prevents the entire server from crashing
  swaggerSpec = {
    openapi: '3.0.0',
    info: options.definition?.info || {},
    paths: {},
    components: options.definition?.components,
    servers: options.definition?.servers,
  };
}

/**
 * Export the generated OpenAPI spec
 * Type-safe export with proper error handling
 */
export default swaggerSpec as Record<string, any>;

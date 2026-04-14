/**
 * Universal Supabase Database Query Utility
 * Replaces TypeORM AppDataSource for production use
 * Supports both repository pattern and raw SQL queries
 */

import { supabase } from './supabase';
import logger from '../utils/logger';

// =========================================
// Types
// =========================================

export interface QueryOptions {
  select?: string;
  where?: Record<string, any>;
  order?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
}

export interface RawQueryResult {
  data: any[];
  error: Error | null;
}

// =========================================
// Raw SQL Query Execution (Supabase RPC)
// =========================================

/**
 * Execute raw SQL query using Supabase RPC
 * @param table Table name to query
 * @param sql Raw SQL query (parameterized)
 * @param params Query parameters
 * @returns Query results
 */
export async function rawQuery(sql: string, params: any[] = []): Promise<RawQueryResult> {
  try {
    // For Supabase, we use the raw query method if available
    // Otherwise, we parse and use standard query builder
    const client = supabase as any;

    if (client.rpc) {
      // If Supabase RPC is available, use it
      const { data, error } = await client.rpc('execute_query', {
        sql,
        params,
      });
      if (error) throw error;
      return { data: data || [], error: null };
    }

    // Fallback: Parse query and use query builder
    // This is a simplified approach - complex queries may need adjustment
    logger.warn('Supabase RPC not available, using query builder fallback');

    // For now, return empty to indicate limitation
    return { data: [], error: new Error('Raw SQL queries require Supabase RPC setup') };
  } catch (err) {
    const error = err as Error;
    logger.error('Raw query execution failed', {
      error: error.message,
    });
    return { data: [], error };
  }
}

// =========================================
// Repository Pattern (TypeORM-like Interface)
// =========================================

type WhereClause = Record<string, any>;

const toSnakeCase = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

const inferTableName = (entity: any): string => {
  if (!entity) throw new Error('Entity type is required');
  if (typeof entity === 'string') return entity;
  if (entity.tableName) return entity.tableName;
  if (entity.name) {
    const raw = toSnakeCase(entity.name);
    if (raw.endsWith('s')) return raw;
    if (raw.endsWith('y')) return `${raw.slice(0, -1)}ies`;
    return `${raw}s`;
  }
  throw new Error('Unable to infer table name from entity');
};

const applyWhere = (builder: any, where?: WhereClause) => {
  if (!where || Object.keys(where).length === 0) return builder;
  for (const [key, value] of Object.entries(where)) {
    const dbKey = toSnakeCase(key);
    if (value === null) {
      builder = builder.is(dbKey, null);
    } else if (Array.isArray(value)) {
      builder = builder.in(dbKey, value);
    } else {
      builder = builder.eq(dbKey, value);
    }
  }
  return builder;
};

const applyOrder = (builder: any, order?: any) => {
  if (!order) return builder;
  for (const [column, direction] of Object.entries(order)) {
    const dbColumn = toSnakeCase(column);
    builder = builder.order(dbColumn, { ascending: String(direction).toUpperCase() !== 'DESC' });
  }
  return builder;
};

/**
 * Create a repository for a given entity/table
 * Provides CRUD operations compatible with TypeORM
 */
export function createRepository(entity: any) {
  const table = inferTableName(entity);

  const repo: any = {
    create: (data: any) => {
      if (data == null || typeof data !== 'object') return data;
      return Object.assign({}, data);
    },

    save: async (record: any) => {
      try {
        if (record == null || typeof record !== 'object') {
          throw new Error('Record must be an object in save()');
        }

        // Convert camelCase keys to snake_case for database
        // Filter out undefined values to prevent UUID errors in Supabase
        const convertPayload = (obj: any) => {
          const converted: any = {};
          for (const [key, value] of Object.entries(obj)) {
            // Skip undefined values (optional fields not provided)
            // Keep null, false, 0, empty strings as they are valid
            if (value !== undefined) {
              converted[toSnakeCase(key)] = value;
            }
          }
          return converted;
        };

        // Validate required fields for work_sessions table
        if (table === 'work_sessions') {
          // Build payload explicitly for type safety
          const payload: any = {};

          // UUID validation function
          const isUUID = (value: any) => {
            return (
              typeof value === 'string' &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                value
              )
            );
          };

          // Required: user_id must be valid UUID
          if (!record.userId || !isUUID(record.userId)) {
            throw new Error('userId must be a valid UUID for work_sessions');
          }
          payload.user_id = record.userId;

          // Optional: project_id only if valid UUID
          if (record.projectId && isUUID(record.projectId)) {
            payload.project_id = record.projectId;
          }

          // Optional: task_id only if valid UUID
          if (record.taskId && isUUID(record.taskId)) {
            payload.task_id = record.taskId;
          }

          // Optional: organization_id only if valid UUID
          if (record.organizationId && isUUID(record.organizationId)) {
            payload.organization_id = record.organizationId;
          }

          // Timestamp fields: ensure they are strings
          if (record.startTime && typeof record.startTime === 'string') {
            payload.start_time = record.startTime;
          }

          if (record.endTime && typeof record.endTime === 'string') {
            payload.end_time = record.endTime;
          }

          if (record.durationSeconds && typeof record.durationSeconds === 'number') {
            payload.duration_seconds = record.durationSeconds;
          }

          // Meta field
          if (record.meta !== undefined) {
            payload.meta = record.meta;
          }

          // Log payload before insert
          console.log('work_sessions insert payload:', payload);

          // Use the explicit payload instead of convertPayload
          const { data, error } = await supabase.from(table).insert([payload]).select().single();
          if (error) throw error;
          return data;
        }
      } catch (error) {
        logger.error('Database save failed', { table, error: (error as Error).message });
        throw error;
      }
    },

    findOne: async (criteria?: any) => {
      try {
        let builder = supabase.from(table).select('*');
        if (criteria?.where) {
          builder = applyWhere(builder, criteria.where);
        } else if (criteria && typeof criteria === 'object') {
          builder = applyWhere(builder, criteria);
        }
        const { data, error } = await builder.limit(1).maybeSingle();
        if (error) throw error;
        return data;
      } catch (error) {
        logger.error('Database findOne failed', { table, error: (error as Error).message });
        throw error;
      }
    },

    findOneBy: async (where: WhereClause) => {
      try {
        const builder = applyWhere(supabase.from(table).select('*'), where);
        const { data, error } = await builder.limit(1).maybeSingle();
        if (error) throw error;
        return data;
      } catch (error) {
        logger.error('Database findOneBy failed', { table, error: (error as Error).message });
        throw error;
      }
    },

    find: async (options?: any) => {
      try {
        let builder = supabase.from(table).select('*');
        if (options?.where) builder = applyWhere(builder, options.where);
        if (options?.order) builder = applyOrder(builder, options.order);
        if (options?.take != null && options?.skip != null) {
          builder = builder.range(options.skip, options.skip + options.take - 1);
        } else if (options?.take != null) {
          builder = builder.limit(options.take);
        } else if (options?.skip != null) {
          const { data, error } = await builder;
          if (error) throw error;
          const rows = data || [];
          return rows.slice(options.skip);
        }
        const { data, error } = await builder;
        if (error) throw error;
        return data || [];
      } catch (error) {
        logger.error('Database find failed', { table, error: (error as Error).message });
        throw error;
      }
    },

    findAndCount: async (options?: any) => {
      const rows = await repo.find(options);
      return [rows, rows.length];
    },

    findBy: async (where: WhereClause) => {
      return repo.find({ where });
    },

    update: async (where: WhereClause | string, patch: any) => {
      try {
        const whereClause = typeof where === 'string' ? { id: where } : where;

        // Filter out undefined values from patch to prevent UUID errors
        const cleanPatch: any = {};
        for (const [key, value] of Object.entries(patch || {})) {
          if (value !== undefined) {
            cleanPatch[key] = value;
          }
        }

        // Convert camelCase keys to snake_case if needed
        const convertedPatch: any = {};
        for (const [key, value] of Object.entries(cleanPatch)) {
          convertedPatch[toSnakeCase(key)] = value;
        }

        let builder = supabase.from(table).update(convertedPatch);
        for (const [key, value] of Object.entries(whereClause)) {
          const dbKey = toSnakeCase(key);
          if (value === null) {
            builder = builder.is(dbKey, null);
          } else if (Array.isArray(value)) {
            builder = builder.in(dbKey, value);
          } else {
            builder = builder.eq(dbKey, value);
          }
        }
        const { data, error } = await builder.select();
        if (error) throw error;
        return data;
      } catch (error) {
        logger.error('Database update failed', { table, error: (error as Error).message });
        throw error;
      }
    },

    delete: async (where: WhereClause) => {
      try {
        let builder = supabase.from(table).delete();
        for (const [key, value] of Object.entries(where)) {
          if (value === null) {
            builder = builder.is(key, null);
          } else if (Array.isArray(value)) {
            builder = builder.in(key, value);
          } else {
            builder = builder.eq(key, value);
          }
        }
        const { data, error } = await builder.select();
        if (error) throw error;
        return data;
      } catch (error) {
        logger.error('Database delete failed', { table, error: (error as Error).message });
        throw error;
      }
    },

    remove: async (entity: any) => {
      if (!entity || !entity.id) {
        throw new Error('Cannot remove entity without id');
      }
      return repo.delete({ id: entity.id });
    },

    clear: async () => {
      try {
        const { data, error } = await supabase.from(table).delete().neq('id', '');
        if (error) throw error;
        return data;
      } catch (error) {
        logger.error('Database clear failed', { table, error: (error as Error).message });
        throw error;
      }
    },
  };

  return repo;
}

// =========================================
// AppDataSource Compatibility Layer
// Used during migration to avoid breaking all code at once
// =========================================

export const AppDataSource = {
  isInitialized: true,

  initialize: async () => {
    // Supabase is initialized on-demand, no explicit init needed
    return true;
  },

  destroy: async () => {
    // Supabase client doesn't need cleanup
    return true;
  },

  getRepository: (entity: any) => createRepository(entity),

  /**
   * Execute raw SQL query
   * NOTE: For production, migrate to direct Supabase queries
   */
  query: async (sql: string, params: any[] = []) => {
    const result = await rawQuery(sql, params);
    if (result.error) throw result.error;
    return result.data;
  },
};

export default AppDataSource;

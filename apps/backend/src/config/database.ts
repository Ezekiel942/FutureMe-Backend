/**
 * Production Database Configuration
 * Supabase Adapter for FutureMe Backend
 *
 * This replaces TypeORM with a lightweight Supabase adapter.
 * - Removed all TypeORM dependencies
 * - Repository pattern matches TypeORM interface
 * - Compatible with existing code
 */

import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { ENV } from './env';
import logger from '../utils/logger';

// =========================================
// Repository Pattern (TypeORM-compatible)
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

const getSupabaseClient = (table: string) => (table === 'work_sessions' ? supabaseAdmin : supabase);

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

const createSupabaseRepository = (entity: any) => {
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
          // ...existing code...

          // Use the explicit payload instead of convertPayload and the admin client for work_sessions
          const dbClient = getSupabaseClient(table);
          const { data, error } = await dbClient
            .from(table)
            .upsert([payload], { onConflict: 'id' })
            .select()
            .single();
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
        const client = getSupabaseClient(table);
        let builder = client.from(table).select('*');
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
        const client = getSupabaseClient(table);
        const builder = applyWhere(client.from(table).select('*'), where);
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
        const client = getSupabaseClient(table);
        let builder = client.from(table).select('*');
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

        const client = getSupabaseClient(table);
        let builder = client.from(table).update(convertedPatch);
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
        const client = getSupabaseClient(table);
        let builder = client.from(table).delete();
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
        const client = getSupabaseClient(table);
        const { data, error } = await client.from(table).delete().neq('id', '');
        if (error) throw error;
        return data;
      } catch (error) {
        logger.error('Database clear failed', { table, error: (error as Error).message });
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

    createQueryBuilder: (alias?: string) => {
      logger.warn('createQueryBuilder() not supported with Supabase adapter');
      return {
        select: () => ({ from: () => ({}) }),
        from: () => ({ select: () => ({}) }),
        where: () => ({
          andWhere: () => ({}),
          orWhere: () => ({}),
          getMany: async () => [],
          getOne: async () => null,
        }),
        orderBy: () => ({
          addOrderBy: () => ({}),
          getMany: async () => [],
        }),
        take: () => ({}),
        skip: () => ({}),
        getMany: async () => [],
        getOne: async () => null,
        getManyAndCount: async () => [[], 0],
      } as any;
    },
  };

  return repo;
};

export const AppDataSource = {
  isInitialized: false,

  getRepository: (entity: any) => {
    return createSupabaseRepository(entity);
  },

  query: async (sql: string, params: any[] = []) => {
    try {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      const lower = normalizedSql.toLowerCase();
      const fromMatch = normalizedSql.match(/from\s+(["']?)([a-zA-Z0-9_]+)\1/i);
      if (!fromMatch) {
        throw new Error('Unable to parse SQL table from query');
      }

      const table = fromMatch[2];
      const client = getSupabaseClient(table);
      const { data: allRows, error: fetchError } = await client.from(table).select('*');
      if (fetchError) throw fetchError;
      const rows = (allRows || []) as any[];

      const fil = (row: any) => {
        const whereClause = normalizedSql.split(/where/i)[1]?.split(/group by|order by|limit/i)[0];
        if (!whereClause) return true;

        const conditions = whereClause.split(/\s+and\s+/i).map((cond: string) => cond.trim());
        return conditions.every((cond) => {
          cond = cond.replace(/\(\s*/g, '').replace(/\s*\)/g, '');

          let m;
          if ((m = cond.match(/"?([a-zA-Z0-9_]+)"?\s*=\s*\$(\d+)/))) {
            const key = m[1];
            const value = params[Number(m[2]) - 1];
            return row[key] === value;
          }
          if ((m = cond.match(/"?([a-zA-Z0-9_]+)"?\s*>=\s*\$(\d+)/))) {
            const key = m[1];
            const value = params[Number(m[2]) - 1];
            return row[key] >= value;
          }
          if ((m = cond.match(/"?([a-zA-Z0-9_]+)"?\s*<\s*\$(\d+)/))) {
            const key = m[1];
            const value = params[Number(m[2]) - 1];
            return row[key] < value;
          }
          if ((m = cond.match(/"?([a-zA-Z0-9_]+)"?\s*is\s+not\s+null/i))) {
            const key = m[1];
            return row[key] !== null && row[key] !== undefined;
          }
          if ((m = cond.match(/"?([a-zA-Z0-9_]+)"?\s*in\s*\(([^)]+)\)/i))) {
            const key = m[1];
            const list = m[2]
              .split(',')
              .map((x: string) => x.replace(/["'\s]/g, ''))
              .filter(Boolean);
            return list.includes(String(row[key]));
          }

          return true;
        });
      };

      const filtered = rows.filter(fil);

      if (/count\(distinct/i.test(lower)) {
        const distColumnMatch = normalizedSql.match(/count\(distinct\s+"?([a-zA-Z0-9_]+)"?\)/i);
        const col = distColumnMatch ? distColumnMatch[1] : null;
        const distinctValues = col
          ? Array.from(new Set(filtered.map((r: any) => r[col]).filter((v: any) => v != null)))
          : [];
        return [{ cnt: distinctValues.length }];
      }

      if (/count\(\*\)/i.test(lower)) {
        return [{ cnt: filtered.length }];
      }

      const sumMatch = normalizedSql.match(
        /coalesce\(sum\("?([a-zA-Z0-9_]+)"?\),0\)\s+as\s+([a-zA-Z0-9_]+)/i
      );
      if (sumMatch) {
        const col = sumMatch[1];
        const alias = sumMatch[2];
        const total = filtered.reduce((acc, r) => acc + Number(r[col] || 0), 0);
        if (/group by/i.test(lower)) {
          const groupByMatch = normalizedSql.match(/group by\s+"?([a-zA-Z0-9_]+)"?/i);
          const groupKey = groupByMatch ? groupByMatch[1] : null;
          if (groupKey) {
            const grouped: Record<string, any> = {};
            filtered.forEach((r: any) => {
              const g = r[groupKey];
              if (!grouped[g]) grouped[g] = { [groupKey]: g, [alias]: 0, session_count: 0 };
              grouped[g][alias] += Number(r[col] || 0);
              grouped[g].session_count += 1;
            });
            const result = Object.values(grouped);
            if (/order by.*user_count|session_count|total_seconds|hours/i.test(lower)) {
              result.sort((a: any, b: any) => (b[alias] || 0) - (a[alias] || 0));
            }
            if (/limit\s+(\d+)/i.test(lower)) {
              const limit = Number(lower.match(/limit\s+(\d+)/i)![1]);
              return result.slice(0, limit);
            }
            return result;
          }
        }
        return [{ [alias]: total }];
      }

      if (/sum\(/i.test(lower) && /group by/i.test(lower)) {
        const groupByMatch = normalizedSql.match(/group by\s+"?([a-zA-Z0-9_]+)"?/i);
        const groupKey = groupByMatch ? groupByMatch[1] : null;
        if (groupKey) {
          const colMatch = normalizedSql.match(/sum\("?([a-zA-Z0-9_]+)"?\)/i);
          const col = colMatch ? colMatch[1] : null;
          const grouped: Record<string, any> = {};
          filtered.forEach((r: any) => {
            const g = r[groupKey];
            if (!grouped[g])
              grouped[g] = { [groupKey]: g, session_count: 0, total_seconds: 0, hours: 0 };
            grouped[g].session_count += 1;
            if (col) grouped[g].total_seconds += Number(r[col] || 0);
          });
          const result = Object.values(grouped).map((item: any) => ({
            ...item,
            total_seconds: item.total_seconds || 0,
            hours: Number(((item.total_seconds || 0) / 3600).toFixed(2)),
          }));
          if (/order by.*hours|total_seconds/i.test(lower)) {
            result.sort((a: any, b: any) => (b.hours || 0) - (a.hours || 0));
          }
          if (/limit\s+(\d+)/i.test(lower)) {
            const limit = Number(lower.match(/limit\s+(\d+)/i)![1]);
            return result.slice(0, limit);
          }
          return result;
        }
      }

      if (
        /select \* /i.test(lower) ||
        /select \*/i.test(lower) ||
        /select "durationSeconds"/i.test(lower)
      ) {
        let result = filtered;
        if (/order by/i.test(lower)) {
          const orderMatch = normalizedSql.match(/order by\s+"?([a-zA-Z0-9_]+)"?\s+(asc|desc)/i);
          if (orderMatch) {
            const key = orderMatch[1];
            const descending = orderMatch[2].toLowerCase() === 'desc';
            result = result.sort((a: any, b: any) => {
              if (a[key] === b[key]) return 0;
              if (a[key] === undefined || a[key] === null) return 1;
              if (b[key] === undefined || b[key] === null) return -1;
              return descending ? (b[key] > a[key] ? 1 : -1) : a[key] > b[key] ? 1 : -1;
            });
          }
        }
        if (/limit\s+(\d+)/i.test(lower)) {
          const limit = Number(lower.match(/limit\s+(\d+)/i)![1]);
          result = result.slice(0, limit);
        }
        return result;
      }

      // default: return filtered rows
      return filtered;
    } catch (error) {
      logger.error('AppDataSource.query fallback failed', {
        sql,
        params,
        error: (error as Error).message,
      });
      throw error;
    }
  },

  destroy: async () => {
    logger.info('Supabase adapter destroy() called (no-op)');
  },
};

export const initializeDatabase = async () => {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  // Database is now OPTIONAL - server can start without database connection
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    logger.warn('Supabase not configured; database features will be unavailable', {
      supabaseUrl: !!ENV.SUPABASE_URL,
      supabaseKey: !!ENV.SUPABASE_ANON_KEY,
    });
    // Mark as initialized even without Supabase to prevent repeated attempts
    AppDataSource.isInitialized = true;
    return AppDataSource;
  }

  try {
    logger.info('Initializing Supabase adapter (non-blocking health check)');
    // Non-blocking health check - don't fail if it doesn't succeed
    supabase
      .from('users')
      .select('id')
      .limit(1)
      .then(({ data, error }: any) => {
        if (error) {
          logger.warn('Supabase health check failed', { error: error.message });
        } else {
          logger.info('Supabase adapter healthy', { sampleUsers: data?.length || 0 });
        }
      })
      .catch((err: any) => {
        logger.warn('Supabase health check error', { error: (err as Error).message });
      });

    AppDataSource.isInitialized = true;
    return AppDataSource;
  } catch (error) {
    logger.warn('Supabase initialization encountered an issue, but continuing anyway', {
      error: (error as Error).message,
    });
    AppDataSource.isInitialized = true;
    return AppDataSource;
  }
};

export default AppDataSource;

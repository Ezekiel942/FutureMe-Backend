import engine from '../../engines/session-engine/sessionEngine';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import {
  AdminSessionQuery,
  AdminSessionRow,
  AdminSessionsResult,
} from '../../api/types/admin.sessions';

export const startSession = async (
  userId: string,
  projectId?: string | null,
  taskId?: string | null
) => {
  return engine.start(userId, projectId, taskId);
};

export const pauseSession = async (sessionId: string, userId: string) => {
  return engine.pause(sessionId, userId);
};

export const resumeSession = async (sessionId: string, userId: string) => {
  return engine.resume(sessionId, userId);
};

export const endSession = async (sessionId: string, userId: string) => {
  return engine.end(sessionId, userId);
};

const normalizeStatus = (status?: string, meta?: any): string => {
  if (status) return status;
  if (meta?.paused) return 'paused';
  if (meta?.ended || meta?.endedAt || meta?.ended_at) return 'ended';
  return 'active';
};

const parseDateParameter = (value?: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const validateStatusFilter = (status?: string): status is AdminSessionQuery['status'] => {
  return status === 'active' || status === 'paused' || status === 'ended';
};

const mapSessionRow = (row: any): AdminSessionRow => ({
  sessionId: row.id,
  userId: row.user_id,
  status: normalizeStatus(row.status, row.meta),
  startTime: row.start_time || null,
  endTime: row.end_time || null,
  durationSeconds: row.duration_seconds ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const applyCommonFilters = (query: any, filters: AdminSessionQuery) => {
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.fromDate) {
    const fromDate = parseDateParameter(filters.fromDate);
    if (fromDate) query = query.gte('created_at', fromDate);
  }
  if (filters.toDate) {
    const toDate = parseDateParameter(filters.toDate);
    if (toDate) query = query.lte('created_at', toDate);
  }
  return query;
};

export const getAdminSessions = async (
  filters: AdminSessionQuery
): Promise<AdminSessionsResult> => {
  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);

  if (filters.status && !validateStatusFilter(filters.status)) {
    const err: any = new Error('Invalid status filter');
    err.status = 400;
    throw err;
  }

  const offset = (page - 1) * limit;
  let sessionQuery = supabaseAdmin
    .from('work_sessions')
    .select(
      'id, user_id, status, start_time, end_time, duration_seconds, created_at, updated_at, meta',
      { count: 'exact' }
    );

  if (filters.status) {
    sessionQuery = sessionQuery.eq('status', filters.status);
  }

  sessionQuery = applyCommonFilters(sessionQuery, filters)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: sessionRows, error, count } = await sessionQuery;
  if (error) {
    throw error;
  }

  const baseCountQuery = supabaseAdmin
    .from('work_sessions')
    .select('id', { count: 'exact', head: true });
  const activeCountQuery = supabaseAdmin
    .from('work_sessions')
    .select('id', { count: 'exact', head: true });
  const pausedCountQuery = supabaseAdmin
    .from('work_sessions')
    .select('id', { count: 'exact', head: true });
  const endedCountQuery = supabaseAdmin
    .from('work_sessions')
    .select('id', { count: 'exact', head: true });

  const baseFilters = { ...filters, status: undefined } as AdminSessionQuery;
  applyCommonFilters(baseCountQuery, baseFilters);
  applyCommonFilters(activeCountQuery.eq('status', 'active'), baseFilters);
  applyCommonFilters(pausedCountQuery.eq('status', 'paused'), baseFilters);
  applyCommonFilters(endedCountQuery.eq('status', 'ended'), baseFilters);

  const [
    { count: totalCount },
    { count: activeCount },
    { count: pausedCount },
    { count: endedCount },
  ] = await Promise.all([baseCountQuery, activeCountQuery, pausedCountQuery, endedCountQuery]);

  return {
    summary: {
      activeCount: activeCount ?? 0,
      pausedCount: pausedCount ?? 0,
      endedCount: endedCount ?? 0,
      total: totalCount ?? 0,
    },
    sessions: (sessionRows || []).map(mapSessionRow),
    page,
    limit,
    total: count ?? 0,
  };
};

export default { startSession, pauseSession, resumeSession, endSession, getAdminSessions };

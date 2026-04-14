import { Request, Response } from 'express';
import { listAudits, AuditLog } from '../../database/models/AuditLog.model';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

export const queryAudit = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { limit = 100, offset = 0, action, resourceType } = req.query;

    // Get all audit logs
    const allLogs = await listAudits();

    // Filter by action and resourceType if provided
    let filtered = allLogs;
    if (action) {
      filtered = filtered.filter((log: any) => log.action === action);
    }
    if (resourceType) {
      filtered = filtered.filter((log: any) => log.resourceType === resourceType);
    }

    // Sort by createdAt descending (most recent first)
    filtered.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply pagination
    const limitNum = Math.min(parseInt(String(limit)) || 100, 1000);
    const offsetNum = Math.max(parseInt(String(offset)) || 0, 0);
    const paginated = filtered.slice(offsetNum, offsetNum + limitNum);

    success(res, {
      logs: paginated,
      total: filtered.length,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to query audit logs', err?.code, err?.status || 400);
  }
};

export const getAuditLog = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = req.params;
    const allLogs = await listAudits();
    const log = allLogs.find((l: any) => l.id === id);

    if (!log) {
      return fail(res, 'Audit log not found', 'NOT_FOUND', 404);
    }

    success(res, log);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch audit log', err?.code, err?.status || 400);
  }
};

export default {
  queryAudit,
  getAuditLog,
};

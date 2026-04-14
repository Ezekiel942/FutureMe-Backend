import { Request, Response } from 'express';
import { listAuditEntries } from '../../database/models/AuditEntry.model';
import { logAction as auditLog } from '../../modules/audit/audit.service';
import * as SessionService from '../../modules/session/session.service';
import { AdminSessionsResult } from '../types/admin.sessions';

/**
 * Admin controller for audit logs
 * - Audit logs are created by controllers/services after auth succeeds.
 * - We intentionally keep audit logic out of middleware so auth remains
 *   focused on authentication/authorization and auditing stays explicit.
 * - Admin listing of logs is recorded as an `admin_action` for traceability.
 */

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    // Pagination params (controllers receive normalized query from middleware)
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10), 1), 200);
    const offset = (page - 1) * limit;

    const { items, total } = await listAuditEntries(offset, limit);

    // Audit admin action: listing audit logs (before response)
    try {
      const adminId = (req as any).user?.id || null;
      await auditLog({
        userId: adminId,
        action: 'admin_action',
        targetId: 'audit_logs:list',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {
      // Log error but don't block response
    }

    success(res, { logs: items, total, page, limit });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch audit logs', err?.code, err?.status || 500);
  }
};

export const getAdminSessions = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10), 1), 100);
    const status = req.query.status as string | undefined;
    const userId = req.query.userId as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const query = {
      page,
      limit,
      status: status as any,
      userId,
      fromDate,
      toDate,
    };

    const result: AdminSessionsResult = await SessionService.getAdminSessions(query);

    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch admin sessions', err?.code, err?.status || 500);
  }
};

export default { getAuditLogs, getAdminSessions };

import { Request, Response } from 'express';
import * as SessionService from '../../modules/session/session.service';
import * as SessionRules from '../../modules/session/session.rules';
import {
  emitSessionStarted,
  emitSessionPaused,
  emitSessionResumed,
  emitSessionEnded,
} from '../../engines/socket.events';
import { analyzeSessionBehavior } from '../../modules/session/session.monitoring.service';
import { findById } from '../../database/models/User.model';
import { findSessionsByUser, updateSession } from '../../database/models/WorkSession.model';
import { logAudit } from '../../modules/billing/billing.service';
import { logAction as auditLog } from '../../modules/audit/audit.service';
import logger from '@utils/logger';

const success = (res: Response, data: unknown) => res.json({ success: true, data });

const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * Start a new work session
 */
export const createSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const user = req.user;

    // Validate user ID is present and is a valid UUID
    const userId = user.id || user.sub;
    if (!userId) {
      return fail(res, 'Authenticated user missing ID claim', 'INVALID_USER', 401);
    }
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return fail(res, 'Invalid user ID format', 'INVALID_USER_ID', 401);
    }

    const { projectId, taskId } = req.body || {};

    // Validate projectId and taskId are valid UUID or null
    if (projectId && !uuidRegex.test(projectId)) {
      return fail(res, 'Invalid projectId format', 'INVALID_PROJECT_ID', 400);
    }
    if (taskId && !uuidRegex.test(taskId)) {
      return fail(res, 'Invalid taskId format', 'INVALID_TASK_ID', 400);
    }

    const s = await SessionService.startSession(userId, projectId || null, taskId || null);

    const userRecord = await findById(userId);
    const orgId = userRecord?.organizationId || '';

    if (userRecord) {
      emitSessionStarted(userId, orgId, s);
      void analyzeSessionBehavior(userId, orgId).catch((error) => {
        logger.error('Session behavior analysis failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    // Log audit
    await logAudit({
      actorId: userId,
      action: 'session.started',
      resourceType: 'session',
      resourceId: s.id,
      meta: { projectId, taskId },
    });

    // Audit log: session_start (fire-and-forget)
    try {
      await auditLog({
        userId: userId,
        action: 'session_start',
        targetId: s.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}

    success(res, s);
  } catch (err: any) {
    // If user already has active session, return it instead of error
    if (err?.code === 'ACTIVE_SESSION_EXISTS') {
      // Fetch and return the existing active session
      const userId = req.user?.id || req.user?.sub;
      if (userId) {
        const existing = await findSessionsByUser(userId);
        const activeSession = existing.find(
          (s: any) => !s.endTime && (!s.durationSeconds || s.durationSeconds === null)
        );
        if (activeSession) {
          // Return error response with the existing session data
          return res.status(409).json({
            success: false,
            code: 'ACTIVE_SESSION_EXISTS',
            message: 'User already has an active session',
            data: activeSession,
          });
        }
      }
    }
    fail(res, err?.message || 'Could not start session', err?.code, err?.status || 400);
  }
};

/**
 * Pause an active session
 */
export const pauseSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const user = req.user;
    const userId = user.id || user.sub;
    if (!userId) {
      return fail(res, 'Authenticated user missing ID claim', 'INVALID_USER', 401);
    }
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return fail(res, 'Invalid user ID format', 'INVALID_USER_ID', 401);
    }

    const { sessionId } = req.params;

    const s = await SessionService.pauseSession(sessionId, userId);

    if (!s) {
      return fail(res, 'No active session to pause', 'NO_ACTIVE_SESSION', 400);
    }

    const userRecord = await findById(userId);
    const orgId = userRecord?.organizationId || '';

    if (userRecord) {
      emitSessionPaused(userId, orgId, s);
    }

    // Log audit
    await logAudit({
      actorId: userId,
      action: 'session.paused',
      resourceType: 'session',
      resourceId: sessionId,
      meta: { durationSeconds: s.durationSeconds },
    });

    success(res, s);
  } catch (err: any) {
    fail(res, err?.message || 'Could not pause session', err?.code, err?.status || 400);
  }
};

/**
 * Resume a paused session
 */
export const resumeSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const user = req.user;
    const userId = user.id || user.sub;
    if (!userId) {
      return fail(res, 'Authenticated user missing ID claim', 'INVALID_USER', 401);
    }
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return fail(res, 'Invalid user ID format', 'INVALID_USER_ID', 401);
    }

    const { sessionId } = req.params;

    const s = await SessionService.resumeSession(sessionId, userId);

    if (!s) {
      return fail(res, 'No paused session to resume', 'NO_PAUSED_SESSION', 400);
    }

    const userRecord = await findById(userId);
    const orgId = userRecord?.organizationId || '';

    if (userRecord) {
      emitSessionResumed(userId, orgId, s);
      void analyzeSessionBehavior(userId, orgId).catch((error) => {
        logger.error('Session behavior analysis failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    // Log audit
    await logAudit({
      actorId: userId,
      action: 'session.resumed',
      resourceType: 'session',
      resourceId: sessionId,
    });

    success(res, s);
  } catch (err: any) {
    fail(res, err?.message || 'Could not resume session', err?.code, err?.status || 400);
  }
};

/**
 * End an active session
 */
export const endSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const userId = req.user.id || req.user.sub;
    if (!userId) {
      return fail(res, 'Authenticated user missing ID claim', 'INVALID_USER', 401);
    }
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return fail(res, 'Invalid user ID format', 'INVALID_USER_ID', 401);
    }

    const user = req.user;
    const { sessionId } = req.params;

    let s = await SessionService.endSession(sessionId, userId);

    if (!s) {
      return fail(res, 'No active session to end', 'NO_ACTIVE_SESSION', 400);
    }

    // Apply session rules: check minimum length and overtime
    const minLengthCheck = await SessionRules.validateMinimumSessionLength(sessionId);
    const overtimeCheck = await SessionRules.checkOvertime(userId);
    const dailyLimitCheck = await SessionRules.checkDailyHourLimit(userId);

    // Add metadata about rule validation
    if (s.meta) {
      s.meta.minLengthMet = minLengthCheck.valid;
      if (!minLengthCheck.valid) {
        s.meta.minLengthWarning = minLengthCheck.message;
      }

      if (overtimeCheck.inOvertime) {
        s.meta.flaggedForOvertime = true;
        s.meta.overtimeHours = overtimeCheck.overtimeHours;
      }

      if (dailyLimitCheck.exceeded) {
        s.meta.dailyLimitExceeded = true;
        s.meta.totalDailyHours = dailyLimitCheck.totalHours;
      }

      // Update session with rule metadata
      s = (await updateSession(sessionId, { meta: s.meta })) || s;
    }

    const userRecord = await findById(userId);
    const orgId = userRecord?.organizationId || '';

    if (userRecord) {
      emitSessionEnded(userId, orgId, s);
      void analyzeSessionBehavior(userId, orgId).catch((error) => {
        logger.error('Session behavior analysis failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    // Log audit
    try {
      await logAudit({
        actorId: userId,
        action: 'session.ended',
        resourceType: 'session',
        resourceId: sessionId,
        meta: {
          durationSeconds: s.durationSeconds,
          minLengthMet: minLengthCheck.valid,
          inOvertime: overtimeCheck.inOvertime,
          dailyLimitExceeded: dailyLimitCheck.exceeded,
        },
      });
    } catch (e) {}

    // Audit log: session_end
    try {
      await auditLog({
        userId: userId,
        action: 'session_end',
        targetId: sessionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}

    success(res, s);
  } catch (err: any) {
    fail(res, err?.message || 'Could not end session', err?.code, err?.status || 400);
  }
};

/**
 * Get the currently active session for the authenticated user
 */
export const getActiveSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const userId = req.user.id || req.user.sub;
    if (!userId) {
      return fail(res, 'Authenticated user missing ID claim', 'INVALID_USER', 401);
    }
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return fail(res, 'Invalid user ID format', 'INVALID_USER_ID', 401);
    }

    const sessions = await findSessionsByUser(userId);

    // Find active session: no endTime and no duration (or duration is null)
    const activeSession = sessions.find(
      (s: any) => !s.endTime && (!s.durationSeconds || s.durationSeconds === null)
    );

    if (!activeSession) {
      return success(res, null);
    }

    success(res, activeSession);
  } catch (err: any) {
    fail(res, err?.message || 'Could not retrieve active session', err?.code, err?.status || 400);
  }
};

/**
 * Get session history with pagination and optional status filter
 */
export const getSessionHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const userId = req.user.id || req.user.sub;
    if (!userId) {
      return fail(res, 'Authenticated user missing ID claim', 'INVALID_USER', 401);
    }
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return fail(res, 'Invalid user ID format', 'INVALID_USER_ID', 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const statusFilter = req.query.status as string | undefined;

    const allSessions = await findSessionsByUser(userId);

    // Filter by status if provided
    let filtered = allSessions;
    if (statusFilter) {
      if (statusFilter === 'active') {
        filtered = allSessions.filter(
          (s: any) => !s.endTime && (!s.durationSeconds || s.durationSeconds === null)
        );
      } else if (statusFilter === 'paused') {
        filtered = allSessions.filter((s: any) => !s.endTime && !!s.meta?.paused);
      } else if (statusFilter === 'ended') {
        filtered = allSessions.filter((s: any) => !!s.endTime);
      }
    }

    // Sort by most recent first
    filtered.sort((a: any, b: any) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      return bTime - aTime;
    });

    // Paginate
    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginatedSessions = filtered.slice(start, start + limit);

    res.json({
      success: true,
      data: paginatedSessions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    fail(res, err?.message || 'Could not retrieve session history', err?.code, err?.status || 400);
  }
};

import { Request, Response } from 'express';
import { AppDataSource } from '@config/database';
import { findInsightsByOrganization } from '../../database/models/Insight.model';
import { getEffectiveRules } from '../../database/models/CustomTenantRules.model';
import insightEngine from '../../engines/insight-engine/insightEngine';
import riskDetectionEngine from '../../engines/risk-engine/riskDetectionEngine';
import presence from '../../engines/presence';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * GET /api/v1/workforce/attendance
 * Returns attendance insights for current tenant, including configured risk indicators.
 */
export const getAttendanceAnalytics = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const organizationId = (user as any).organizationId;
    if (!organizationId) return fail(res, 'Organization not found in token', 'NO_ORG', 400);

    const period = (req.query.period as any) || 'weekly';

    // Ensure insights are updated for all users in tenant (best-effort)
    const users = await AppDataSource.query(
      'SELECT id FROM users WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 150',
      [organizationId]
    );

    // Avoid building a huge load in a single request.
    const generatePromises = users
      .slice(0, 100)
      .map((u: any) =>
        insightEngine.generateInsights(u.id, period as 'daily' | 'weekly' | 'monthly')
      );
    await Promise.allSettled(generatePromises);

    const allInsights = await findInsightsByOrganization(organizationId);
    const attendanceInsights = (allInsights || [])
      .filter((insight: any) => insight.type === 'attendance')
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 200);

    success(res, {
      organizationId,
      period,
      riskIndicators: ['LATE_PATTERN', 'PRODUCTIVITY_DROP', 'OVERTIME_RISK', 'IDLE_ACTIVITY'],
      insights: attendanceInsights,
      count: attendanceInsights.length,
    });
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to fetch attendance analytics',
      err?.code,
      err?.status || 500
    );
  }
};

/**
 * GET /api/v1/workforce/realtime
 * Returns real-time workforce status for active/paused/idle/overloaded employees
 */
export const getRealtimeWorkforce = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const organizationId = (user as any).organizationId;
    if (!organizationId) return fail(res, 'Organization not found in token', 'NO_ORG', 400);

    const allSessions: any[] = await AppDataSource.query(
      'SELECT id, user_id, project_id, start_time, end_time, duration_seconds, meta FROM work_sessions WHERE organization_id = $1',
      [organizationId]
    );

    const activeSessions = allSessions.filter((s: any) => !s.end_time);
    const pausedSessions = activeSessions.filter((s: any) => !!s.meta?.paused);
    const idleSessions = activeSessions.filter(
      (s: any) =>
        !!s.meta?.endedByIdleDetection ||
        (typeof s.meta?.idleDurationSeconds === 'number' && s.meta.idleDurationSeconds > 0)
    );

    const onlineUsers = (await presence.getOnlineUsers(organizationId)) || [];

    const rules = await getEffectiveRules(organizationId);
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const totalsByUser: Record<string, number> = {};
    allSessions.forEach((s: any) => {
      if (!s.end_time) return;
      const started = new Date(s.start_time).getTime();
      if (started < weekStart) return;
      const userTotal = totalsByUser[s.user_id] || 0;
      totalsByUser[s.user_id] = userTotal + (s.duration_seconds || 0) / 3600;
    });

    const overloadedEmployees = Object.keys(totalsByUser)
      .filter((uid: string) => totalsByUser[uid] > rules.overtimeThreshold)
      .map((uid: string) => ({ userId: uid, hours: Number(totalsByUser[uid].toFixed(2)) }));

    const sampleOnlineUsers = onlineUsers.slice(0, 30);
    const unusualSchedules: any[] = [];
    for (const uid of sampleOnlineUsers) {
      const userRisks = await riskDetectionEngine.detectUserRisks(uid, 'weekly', organizationId);
      if (userRisks && userRisks.length) {
        const isUnusual = userRisks.some(
          (r) =>
            r.category === 'off_hours_work' ||
            r.category === 'inconsistency' ||
            r.category === 'fragmentation' ||
            r.title?.toLowerCase().includes('off-hours')
        );
        if (isUnusual) unusualSchedules.push({ userId: uid, risks: userRisks });
      }
    }

    success(res, {
      organizationId,
      activeCount: activeSessions.length,
      pausedCount: pausedSessions.length,
      idleCount: idleSessions.length,
      onlineCount: onlineUsers.length,
      overloadedCount: overloadedEmployees.length,
      activeSessions,
      pausedSessions,
      idleSessions,
      onlineUsers,
      overloadedEmployees,
      unusualSchedules,
    });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch live workforce data', err?.code, err?.status || 500);
  }
};

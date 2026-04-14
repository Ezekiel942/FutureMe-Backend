import { Request, Response } from 'express';
import { AppDataSource } from '@config/database';
import presence from '../../engines/presence';
import riskDetectionEngine from '../../engines/risk-engine/riskDetectionEngine';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * GET /api/v1/dashboard/live
 * Returns active sessions, online users, overloaded users, and recent risk alerts for tenant
 */
export const getLiveDashboard = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    const organizationId = (user as any).organizationId;
    if (!organizationId) return fail(res, 'Organization not found in token', 'NO_ORG', 400);

    // Active sessions (endTime IS NULL)
    const activeSessions = await AppDataSource.query(
      'SELECT id, user_id, project_id, start_time, meta FROM work_sessions WHERE organization_id = $1 AND end_time IS NULL ORDER BY start_time DESC LIMIT 100',
      [organizationId]
    );

    // Online users via presence
    const onlineUsers = (await presence.getOnlineUsers(organizationId)) || [];

    // Overloaded users: users with >60 hours tracked in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const overloadedRows = await AppDataSource.query(
      'SELECT user_id, COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 GROUP BY user_id HAVING COALESCE(SUM(duration_seconds),0)/3600 > 60 ORDER BY total_seconds DESC LIMIT 50',
      [organizationId, sevenDaysAgo]
    );
    const overloadedUsers = overloadedRows.map((r: any) => ({
      userId: r.user_id,
      hours: Number(r.total_seconds) / 3600,
    }));

    // Risk alerts: run detection for online users (bounded to avoid heavy load)
    const sampleUsers = onlineUsers.slice(0, 50);
    const alerts: any[] = [];
    for (const uid of sampleUsers) {
      try {
        const risks = await riskDetectionEngine.detectUserRisks(uid, 'weekly', organizationId);
        if (risks && risks.length) {
          alerts.push({ userId: uid, risks });
        }
      } catch (e) {
        // ignore per-user failures
      }
    }

    success(res, {
      organizationId,
      activeSessions,
      onlineUsers,
      overloadedUsers,
      riskAlerts: alerts,
    });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch live dashboard', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/dashboard/predictive
 * Returns predictive risk analysis: high risk users, at-risk projects, burnout heatmap data
 */
export const getPredictiveRiskDashboard = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    const organizationId = (user as any).organizationId;
    if (!organizationId) return fail(res, 'Organization not found in token', 'NO_ORG', 400);

    const period = (req.query.period as any) || 'weekly';
    const startIso =
      period === 'daily'
        ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        : period === 'weekly'
          ? new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).toISOString()
          : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // High risk users: users with burnout score > 70 or multiple risk events
    const highRiskUsers: any[] = await AppDataSource.query(
      `
      SELECT
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(SUM(ws.duration_seconds), 0)/3600 as total_hours,
        COUNT(DISTINCT ws.project_id) as project_count,
        COUNT(re.id) as risk_event_count
      FROM users u
      LEFT JOIN work_sessions ws ON u.id = ws.user_id AND ws.organization_id = $1 AND ws.start_time >= $2
      LEFT JOIN risk_events re ON u.id = re.user_id AND re.organization_id = $1 AND re.is_active = true
      WHERE u.organization_id = $1 AND u.deleted_at IS NULL
      GROUP BY u.id, u.first_name, u.last_name, u.email
      HAVING (COALESCE(SUM(ws.duration_seconds), 0)/3600 > 50) OR (COUNT(re.id) > 2)
      ORDER BY risk_event_count DESC, total_hours DESC
      LIMIT 10
    `,
      [organizationId, startIso]
    );

    // At-risk projects: projects with high velocity variance or multiple risk events
    const atRiskProjects: any[] = await AppDataSource.query(
      `
      SELECT
        ws.project_id,
        COUNT(DISTINCT ws.user_id) as user_count,
        COALESCE(SUM(ws.duration_seconds), 0)/3600 as total_hours,
        COUNT(re.id) as risk_event_count,
        AVG(ws.duration_seconds)/3600 as avg_session_hours,
        STDDEV(ws.duration_seconds)/3600 as session_stddev
      FROM work_sessions ws
      LEFT JOIN risk_events re ON ws.project_id = re.project_id AND re.organization_id = $1 AND re.is_active = true
      WHERE ws.organization_id = $1 AND ws.start_time >= $2
      GROUP BY ws.project_id
      HAVING COUNT(re.id) > 0 OR (STDDEV(ws.duration_seconds)/3600 > AVG(ws.duration_seconds)/3600 * 0.5)
      ORDER BY risk_event_count DESC, total_hours DESC
      LIMIT 10
    `,
      [organizationId, startIso]
    );

    // Burnout heatmap data: hourly activity patterns for the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const heatmapData: any[] = await AppDataSource.query(
      `
      SELECT
        DATE_TRUNC('hour', ws.start_time) as hour_bucket,
        COUNT(*) as session_count,
        COUNT(DISTINCT ws.user_id) as user_count,
        COALESCE(SUM(ws.duration_seconds), 0)/3600 as total_hours
      FROM work_sessions ws
      WHERE ws.organization_id = $1 AND ws.start_time >= $2
      GROUP BY hour_bucket
      ORDER BY hour_bucket DESC
      LIMIT 168
    `,
      [organizationId, sevenDaysAgo]
    );

    // Transform heatmap data for visualization
    const burnoutHeatmap = heatmapData.map((row: any) => ({
      hour: row.hour_bucket,
      dayOfWeek: new Date(row.hour_bucket).getDay(),
      hourOfDay: new Date(row.hour_bucket).getHours(),
      sessionCount: Number(row.session_count),
      userCount: Number(row.user_count),
      totalHours: Number(row.total_hours.toFixed(2)),
      averageHoursPerUser:
        Number(row.user_count) > 0 ? Number((row.total_hours / row.user_count).toFixed(2)) : 0,
    }));

    success(res, {
      organizationId,
      period,
      analysisDate: new Date().toISOString(),
      highRiskUsers: highRiskUsers.map((user: any) => ({
        userId: user.user_id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        totalHours: Number(user.total_hours.toFixed(2)),
        projectCount: Number(user.project_count),
        riskEventCount: Number(user.risk_event_count),
        riskLevel: user.risk_event_count > 2 ? 'critical' : 'high',
      })),
      atRiskProjects: atRiskProjects.map((project: any) => ({
        projectId: project.project_id,
        userCount: Number(project.user_count),
        totalHours: Number(project.total_hours.toFixed(2)),
        riskEventCount: Number(project.risk_event_count),
        avgSessionHours: Number(project.avg_session_hours.toFixed(2)),
        sessionVariability: Number(project.session_stddev.toFixed(2)),
        riskLevel: project.risk_event_count > 1 ? 'high' : 'medium',
      })),
      burnoutHeatmap,
      summary: {
        highRiskUserCount: highRiskUsers.length,
        atRiskProjectCount: atRiskProjects.length,
        totalHeatmapHours: heatmapData.length,
        averageSessionsPerHour:
          heatmapData.length > 0
            ? Number(
                (
                  heatmapData.reduce((sum, h) => sum + h.session_count, 0) / heatmapData.length
                ).toFixed(2)
              )
            : 0,
      },
    });
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to fetch predictive risk dashboard',
      err?.code,
      err?.status || 500
    );
  }
};

export default {
  getLiveDashboard,
  getPredictiveRiskDashboard,
};

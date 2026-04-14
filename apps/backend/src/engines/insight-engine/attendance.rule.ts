import { WorkSession } from '../../database/models/WorkSession.model';
import { calculateUtilizationMetrics } from './utilization.rule';
import { getEffectiveRules } from '../../database/models/CustomTenantRules.model';

export type AttendanceRiskIndicator =
  | 'LATE_PATTERN'
  | 'PRODUCTIVITY_DROP'
  | 'OVERTIME_RISK'
  | 'IDLE_ACTIVITY';

export interface AttendanceInsight {
  type: 'attendance';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: {
    metric: AttendanceRiskIndicator;
    value: number;
    baseline?: number;
    deviation?: number;
    period: 'daily' | 'weekly' | 'monthly';
    details?: any;
  };
}

const toMinutesSinceMidnight = (iso: string): number => {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
};

const averageStartMinutes = (sessions: WorkSession[]): number | null => {
  if (!sessions.length) return null;
  const firstStarts = sessions
    .reduce((acc: number[], session) => {
      if (!session.startTime) return acc;
      acc.push(toMinutesSinceMidnight(session.startTime));
      return acc;
    }, [])
    .sort((a: number, b: number) => a - b);

  if (!firstStarts.length) return null;
  const sum = firstStarts.reduce((a, b) => a + b, 0);
  return sum / firstStarts.length;
};

const getPeriodCutoff = (period: 'daily' | 'weekly' | 'monthly'): Date => {
  const now = new Date();
  if (period === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'weekly') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  // monthly
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
};

const getBaselineSessions = (
  allSessions: WorkSession[],
  period: 'daily' | 'weekly' | 'monthly'
): WorkSession[] => {
  const now = Date.now();

  if (period === 'daily') {
    const cutoff = now - 8 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    return allSessions.filter((s: any) => {
      const time = new Date(s.startTime).getTime();
      return time > cutoff && time < sevenDaysAgo;
    });
  }

  if (period === 'weekly') {
    const cutoff = now - 35 * 24 * 60 * 60 * 1000;
    const fourWeeksAgo = now - 7 * 24 * 60 * 60 * 1000;
    return allSessions.filter((s: any) => {
      const time = new Date(s.startTime).getTime();
      return time > cutoff && time < fourWeeksAgo;
    });
  }

  // monthly
  const cutoff = now - 120 * 24 * 60 * 60 * 1000;
  const threeMonthsAgo = now - 30 * 24 * 60 * 60 * 1000;
  return allSessions.filter((s: any) => {
    const time = new Date(s.startTime).getTime();
    return time > cutoff && time < threeMonthsAgo;
  });
};

/**
 * Analyze attendance/work-session patterns and produce risk insights.
 */
export const analyzeAttendancePatterns = async (
  currentSessions: WorkSession[],
  allSessions: WorkSession[],
  period: 'daily' | 'weekly' | 'monthly'
): Promise<AttendanceInsight[]> => {
  const insights: AttendanceInsight[] = [];
  if (currentSessions.length === 0) return insights;

  // Baseline sessions (previous periods) for comparison
  const baselineSessions = getBaselineSessions(allSessions, period);

  // 1) Late arrival patterns (compare start times to baseline)
  const baselineStart = averageStartMinutes(baselineSessions);
  const currentStart = averageStartMinutes(currentSessions);
  if (baselineStart !== null && currentStart !== null) {
    const deltaMinutes = currentStart - baselineStart;
    // Treat > 60 min late as pattern, critical if >120
    if (deltaMinutes > 60) {
      const severity: 'info' | 'warning' | 'critical' = deltaMinutes > 120 ? 'critical' : 'warning';
      insights.push({
        type: 'attendance',
        severity,
        message: `Late arrival pattern detected: average start time is ${(
          deltaMinutes / 60
        ).toFixed(1)}h later than usual.`,
        data: {
          metric: 'LATE_PATTERN',
          value: deltaMinutes,
          baseline: baselineStart,
          deviation: (deltaMinutes / baselineStart) * 100,
          period,
          details: {
            baselineStartMinutes: baselineStart,
            currentStartMinutes: currentStart,
          },
        },
      });
    }
  }

  // 2) Productivity drops (focus hours)
  const currentMetrics = calculateUtilizationMetrics(currentSessions);
  const baselineMetrics = calculateUtilizationMetrics(baselineSessions);
  if (baselineMetrics.focusHours > 0) {
    const dropPercent =
      ((baselineMetrics.focusHours - currentMetrics.focusHours) / baselineMetrics.focusHours) * 100;
    if (dropPercent >= 40) {
      const severity: 'info' | 'warning' | 'critical' = dropPercent >= 60 ? 'critical' : 'warning';
      insights.push({
        type: 'attendance',
        severity,
        message: `Productivity drop detected: focused hours down ${dropPercent.toFixed(0)}% compared to baseline.`,
        data: {
          metric: 'PRODUCTIVITY_DROP',
          value: currentMetrics.focusHours,
          baseline: baselineMetrics.focusHours,
          deviation: -dropPercent,
          period,
        },
      });
    }
  }

  // 3) Repeated overtime (days exceeding threshold)
  const organizationId = currentSessions[0]?.organizationId ?? '';
  const { overtimeThreshold } = await getEffectiveRules(organizationId);

  const dailyTotals: Record<string, number> = {};
  currentSessions.forEach((s: any) => {
    const day = new Date(s.startTime).toISOString().split('T')[0];
    dailyTotals[day] = (dailyTotals[day] || 0) + (s.durationSeconds || 0) / 3600;
  });
  const overtimeDays = Object.values(dailyTotals).filter((h: any) => h > overtimeThreshold);
  if (overtimeDays.length >= 2) {
    insights.push({
      type: 'attendance',
      severity: 'warning',
      message: `Repeated overtime detected: ${overtimeDays.length} days above ${overtimeThreshold}h.`,
      data: {
        metric: 'OVERTIME_RISK',
        value: overtimeDays.length,
        baseline: overtimeThreshold,
        period,
        details: {
          overtimeThreshold,
          daysOverThreshold: overtimeDays,
        },
      },
    });
  }

  // 4) Inactivity during sessions (idle detection)
  const idleSessions = currentSessions.filter(
    (s) =>
      s.meta?.endedByIdleDetection === true ||
      (typeof s.meta?.idleDurationSeconds === 'number' && s.meta.idleDurationSeconds > 0)
  );
  if (idleSessions.length > 0) {
    const totalIdleMinutes =
      idleSessions.reduce((sum, s) => sum + (s.meta?.idleDurationSeconds || 0), 0) / 60;
    insights.push({
      type: 'attendance',
      severity: idleSessions.length > 2 ? 'warning' : 'info',
      message: `Idle activity detected in ${idleSessions.length} session(s) (${totalIdleMinutes.toFixed(0)} min idle).`,
      data: {
        metric: 'IDLE_ACTIVITY',
        value: totalIdleMinutes,
        period,
        details: {
          sessionIds: idleSessions.map((s: any) => s.id),
          totalIdleMinutes,
        },
      },
    });
  }

  return insights;
};

export default {
  analyzeAttendancePatterns,
};

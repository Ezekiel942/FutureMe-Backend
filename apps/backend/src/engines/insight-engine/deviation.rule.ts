import { WorkSession } from '../../database/models/WorkSession.model';
import { UtilizationMetrics, calculateUtilizationMetrics } from './utilization.rule';

export interface DeviationInsight {
  type: 'deviation';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: {
    metric: string;
    value: number;
    expected: number;
    deviation: number; // percentage
    period: 'daily' | 'weekly' | 'monthly';
  };
}

/**
 * Calculate baseline metrics from historical sessions
 */
export const calculateBaseline = (
  historicalSessions: WorkSession[],
  daysBack: number = 7
): UtilizationMetrics => {
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const relevantSessions = historicalSessions.filter(
    (s) => new Date(s.startTime).getTime() > cutoff
  );
  return calculateUtilizationMetrics(relevantSessions);
};

/**
 * Detect anomalies (deviations from baseline)
 */
export const detectDeviations = (
  currentSessions: WorkSession[],
  allHistoricalSessions: WorkSession[],
  period: 'daily' | 'weekly' | 'monthly'
): DeviationInsight[] => {
  const insights: DeviationInsight[] = [];

  // Calculate current metrics
  const currentMetrics = calculateUtilizationMetrics(currentSessions);

  // Calculate baseline (7-day average before current period)
  let baselineMetrics: UtilizationMetrics;
  if (period === 'daily') {
    // Last 7 days excluding today
    const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const baselineSessions = allHistoricalSessions.filter((s: any) => {
      const time = new Date(s.startTime).getTime();
      return time > cutoff && time < sevenDaysAgo;
    });
    baselineMetrics = calculateUtilizationMetrics(baselineSessions);
  } else if (period === 'weekly') {
    // Last 4 weeks before current week
    const cutoff = Date.now() - 35 * 24 * 60 * 60 * 1000;
    const fourWeeksAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const baselineSessions = allHistoricalSessions.filter((s: any) => {
      const time = new Date(s.startTime).getTime();
      return time > cutoff && time < fourWeeksAgo;
    });
    baselineMetrics = calculateUtilizationMetrics(baselineSessions);
  } else {
    // Last 3 months before current month
    const cutoff = Date.now() - 120 * 24 * 60 * 60 * 1000;
    const threeMonthsAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const baselineSessions = allHistoricalSessions.filter((s: any) => {
      const time = new Date(s.startTime).getTime();
      return time > cutoff && time < threeMonthsAgo;
    });
    baselineMetrics = calculateUtilizationMetrics(baselineSessions);
  }

  // Skip if not enough baseline data
  if (baselineMetrics.sessionCount === 0) {
    return insights;
  }

  // Deviation 1: Focus hours drop
  if (baselineMetrics.focusHours > 0) {
    const deviation =
      ((currentMetrics.focusHours - baselineMetrics.focusHours) / baselineMetrics.focusHours) * 100;

    if (deviation < -40) {
      insights.push({
        type: 'deviation',
        severity: 'critical',
        message: `CRITICAL: Your focus time dropped ${Math.abs(deviation).toFixed(0)}% ${period === 'daily' ? 'today' : 'this ' + period}`,
        data: {
          metric: 'focus_hours_deviation',
          value: currentMetrics.focusHours,
          expected: baselineMetrics.focusHours,
          deviation,
          period,
        },
      });
    } else if (deviation < -20) {
      insights.push({
        type: 'deviation',
        severity: 'warning',
        message: `Your focus time dropped ${Math.abs(deviation).toFixed(0)}% ${period === 'daily' ? 'today' : 'this ' + period}`,
        data: {
          metric: 'focus_hours_deviation',
          value: currentMetrics.focusHours,
          expected: baselineMetrics.focusHours,
          deviation,
          period,
        },
      });
    } else if (deviation > 30) {
      insights.push({
        type: 'deviation',
        severity: 'info',
        message: `Excellent: Focus time up ${deviation.toFixed(0)}% ${period === 'daily' ? 'today' : 'this ' + period}`,
        data: {
          metric: 'focus_hours_deviation',
          value: currentMetrics.focusHours,
          expected: baselineMetrics.focusHours,
          deviation,
          period,
        },
      });
    }
  }

  // Deviation 2: Session count anomaly
  if (baselineMetrics.sessionCount > 0) {
    const deviation =
      ((currentMetrics.sessionCount - baselineMetrics.sessionCount) /
        baselineMetrics.sessionCount) *
      100;

    if (deviation < -50 && currentMetrics.sessionCount === 0) {
      insights.push({
        type: 'deviation',
        severity: 'warning',
        message: `No sessions recorded ${period === 'daily' ? 'today' : 'this ' + period} (unusual)`,
        data: {
          metric: 'session_count_deviation',
          value: currentMetrics.sessionCount,
          expected: baselineMetrics.sessionCount,
          deviation,
          period,
        },
      });
    }
  }

  // Deviation 3: Session duration change
  if (baselineMetrics.avgSessionDuration > 0) {
    const deviation =
      ((currentMetrics.avgSessionDuration - baselineMetrics.avgSessionDuration) /
        baselineMetrics.avgSessionDuration) *
      100;

    if (deviation < -35) {
      insights.push({
        type: 'deviation',
        severity: 'warning',
        message: `Sessions are much shorter than usual (avg ${currentMetrics.avgSessionDuration.toFixed(0)} min vs ${baselineMetrics.avgSessionDuration.toFixed(0)} min)`,
        data: {
          metric: 'session_duration_deviation',
          value: currentMetrics.avgSessionDuration,
          expected: baselineMetrics.avgSessionDuration,
          deviation,
          period,
        },
      });
    }
  }

  return insights;
};

/**
 * Detect unusual work hours (off-hours work)
 */
export const detectOffHoursWork = (
  sessions: WorkSession[],
  period: 'daily' | 'weekly' | 'monthly'
): DeviationInsight[] => {
  const insights: DeviationInsight[] = [];

  const offHoursSessions = sessions.filter((s: any) => {
    const hour = new Date(s.startTime).getHours();
    const day = new Date(s.startTime).getDay();
    // Off-hours: before 6am, after 10pm, or weekends
    return hour < 6 || hour >= 22 || day === 0 || day === 6;
  });

  const offHoursMinutes =
    offHoursSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60;

  if (offHoursMinutes > 60) {
    const percentage = (offHoursSessions.length / sessions.length) * 100;
    insights.push({
      type: 'deviation',
      severity: 'info',
      message: `You logged ${offHoursMinutes.toFixed(0)} minutes of work outside normal hours (${percentage.toFixed(0)}% of sessions)`,
      data: {
        metric: 'off_hours_work',
        value: offHoursMinutes,
        expected: 0,
        deviation: percentage,
        period,
      },
    });
  }

  return insights;
};

/**
 * Detect absence (no work for extended period)
 */
export const detectAbsence = (sessions: WorkSession[]): DeviationInsight[] => {
  const insights: DeviationInsight[] = [];

  if (sessions.length === 0) {
    return insights;
  }

  const lastSessionTime = Math.max(...sessions.map((s: any) => new Date(s.startTime).getTime()));
  const daysSinceLastSession = (Date.now() - lastSessionTime) / (1000 * 60 * 60 * 24);

  if (daysSinceLastSession > 3) {
    insights.push({
      type: 'deviation',
      severity: 'info',
      message: `No sessions for ${daysSinceLastSession.toFixed(0)} days - taking time off?`,
      data: {
        metric: 'absence_days',
        value: daysSinceLastSession,
        expected: 0,
        deviation: daysSinceLastSession,
        period: 'daily',
      },
    });
  }

  return insights;
};

export default {
  calculateBaseline,
  detectDeviations,
  detectOffHoursWork,
  detectAbsence,
};

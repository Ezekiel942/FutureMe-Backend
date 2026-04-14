import { WorkSession } from '../../database/models/WorkSession.model';

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface UtilizationMetrics {
  focusHours: number;
  sessionCount: number;
  avgSessionDuration: number;
  minSessionDuration: number;
  maxSessionDuration: number;
  dailyBreakdown: Record<string, number>;
  peakHours: number[];
  consistency: number;
}

type Period = 'daily' | 'weekly' | 'monthly';

interface BaseInsightData {
  metric: string;
  value: number;
  period: Period;
  baseline?: number;
  deviation?: number;
}

interface AvgDurationInsightData extends BaseInsightData {
  avgDuration: number;
}

interface PeakHoursInsightData extends BaseInsightData {
  peakHours: number[];
}

type UtilizationInsightData = BaseInsightData | AvgDurationInsightData | PeakHoursInsightData;

export interface UtilizationInsight {
  type: 'utilization';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: UtilizationInsightData;
}

/* -------------------------------------------------------------------------- */
/*                          METRICS CALCULATION                                */
/* -------------------------------------------------------------------------- */

export const calculateUtilizationMetrics = (sessions: WorkSession[]): UtilizationMetrics => {
  if (sessions.length === 0) {
    return {
      focusHours: 0,
      sessionCount: 0,
      avgSessionDuration: 0,
      minSessionDuration: 0,
      maxSessionDuration: 0,
      dailyBreakdown: {},
      peakHours: [],
      consistency: 0,
    };
  }

  const durations = sessions.map((s: any) => s.durationSeconds || 0);
  const totalSeconds = durations.reduce((a, b) => a + b, 0);

  const focusHours = totalSeconds / 3600;
  const avgSessionDuration = totalSeconds / sessions.length / 60;
  const minSessionDuration = Math.min(...durations) / 60;
  const maxSessionDuration = Math.max(...durations) / 60;

  const mean = totalSeconds / sessions.length;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const consistency = mean > 0 ? Math.sqrt(variance) / mean : 0;

  const dailyBreakdown: Record<string, number> = {};
  sessions.forEach((s: any) => {
    const day = s.startTime.split('T')[0];
    const hours = (s.durationSeconds || 0) / 3600;
    dailyBreakdown[day] = (dailyBreakdown[day] || 0) + hours;
  });

  const hourCount: Record<number, number> = {};
  sessions.forEach((s: any) => {
    const hour = new Date(s.startTime).getHours();
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  });

  const peakHours = Object.entries(hourCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => Number(hour));

  return {
    focusHours,
    sessionCount: sessions.length,
    avgSessionDuration,
    minSessionDuration,
    maxSessionDuration,
    dailyBreakdown,
    peakHours,
    consistency,
  };
};

/* -------------------------------------------------------------------------- */
/*                              INSIGHT ENGINE                                 */
/* -------------------------------------------------------------------------- */

export const generateUtilizationInsights = (
  metrics: UtilizationMetrics,
  period: Period,
  baseline?: UtilizationMetrics
): UtilizationInsight[] => {
  const insights: UtilizationInsight[] = [];

  /* ----------------------------- Focus Hours -------------------------------- */

  if (metrics.focusHours > 0) {
    insights.push({
      type: 'utilization',
      severity: metrics.focusHours >= 4 ? 'info' : 'warning',
      message:
        metrics.focusHours >= 4
          ? `You logged ${metrics.focusHours.toFixed(1)} hours of focused work`
          : `Low focus time (${metrics.focusHours.toFixed(1)}h)`,
      data: {
        metric: 'focus_hours',
        value: metrics.focusHours,
        period,
      },
    });
  }

  /* ------------------------- Session Consistency ----------------------------- */

  if (metrics.sessionCount > 1) {
    insights.push({
      type: 'utilization',
      severity: metrics.consistency < 0.8 ? 'info' : 'warning',
      message: `Average session duration is ${metrics.avgSessionDuration.toFixed(0)} minutes`,
      data: {
        metric: 'session_consistency',
        value: metrics.consistency,
        avgDuration: metrics.avgSessionDuration,
        period,
      },
    });
  }

  /* ------------------------------ Peak Hours -------------------------------- */

  if (metrics.peakHours.length > 0) {
    insights.push({
      type: 'utilization',
      severity: 'info',
      message: `Your most productive hours are ${metrics.peakHours.join(', ')}`,
      data: {
        metric: 'peak_hours',
        value: metrics.peakHours.length,
        peakHours: metrics.peakHours,
        period,
      },
    });
  }

  /* ------------------------- Baseline Comparison ----------------------------- */

  if (baseline && baseline.focusHours > 0) {
    const deviation = ((metrics.focusHours - baseline.focusHours) / baseline.focusHours) * 100;

    if (Math.abs(deviation) > 10) {
      insights.push({
        type: 'utilization',
        severity: deviation > 0 ? 'info' : 'warning',
        message:
          deviation > 0
            ? `Focus time improved by ${deviation.toFixed(0)}%`
            : `Focus time dropped by ${Math.abs(deviation).toFixed(0)}%`,
        data: {
          metric: 'focus_hours_comparison',
          value: metrics.focusHours,
          baseline: baseline.focusHours,
          deviation,
          period,
        },
      });
    }
  }

  return insights;
};

export default {
  calculateUtilizationMetrics,
  generateUtilizationInsights,
};

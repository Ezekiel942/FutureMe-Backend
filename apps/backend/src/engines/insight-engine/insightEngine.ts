import {
  WorkSession,
  findSessionsByUser,
  listSessions,
} from '../../database/models/WorkSession.model';
import { createInsight, findInsightsByUser } from '../../database/models/Insight.model';
import {
  calculateUtilizationMetrics,
  generateUtilizationInsights,
  UtilizationInsight,
} from './utilization.rule';
import {
  detectDeviations,
  detectOffHoursWork,
  detectAbsence,
  DeviationInsight,
} from './deviation.rule';
import { analyzeAttendancePatterns, AttendanceInsight } from './attendance.rule';

export type InsightType = UtilizationInsight | DeviationInsight | AttendanceInsight;

/**
 * Main Insight Engine - orchestrates all insight generation
 */
class InsightEngine {
  /**
   * Generate insights for a user for a given period
   */
  async generateInsights(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<InsightType[]> {
    // Fetch all sessions for this user
    const allUserSessions = await findSessionsByUser(userId);

    // Filter to completed sessions only (with endTime)
    const completedSessions = allUserSessions.filter((s: any) => s.endTime);

    // Get sessions for the current period
    const currentPeriodSessions = this.getSessionsForPeriod(completedSessions, period);

    if (currentPeriodSessions.length === 0) {
      return [];
    }

    const insights: InsightType[] = [];

    // Generate utilization insights
    const utilizationMetrics = calculateUtilizationMetrics(currentPeriodSessions);
    const utilizationInsights = generateUtilizationInsights(utilizationMetrics, period);
    insights.push(...utilizationInsights);

    // Generate deviation insights
    const deviationInsights = detectDeviations(completedSessions, currentPeriodSessions, period);
    insights.push(...deviationInsights);

    // Generate off-hours insights
    const offHoursInsights = detectOffHoursWork(currentPeriodSessions, period);
    insights.push(...offHoursInsights);

    // Generate absence insights (only daily)
    if (period === 'daily') {
      const absenceInsights = detectAbsence(completedSessions);
      insights.push(...absenceInsights);
    }

    // Generate risk detection insights
    const riskInsights = this.detectRisks(currentPeriodSessions, completedSessions, period);
    insights.push(...riskInsights);

    // Generate attendance-based insights (late arrivals, overtime patterns, idle sessions)
    const attendanceInsights = await analyzeAttendancePatterns(
      currentPeriodSessions,
      completedSessions,
      period
    );
    insights.push(...attendanceInsights);

    // Store insights in database
    const organizationId = allUserSessions[0]?.organizationId || null;

    for (const insight of insights) {
      await createInsight({
        userId,
        organizationId,
        type: insight.type,
        severity: insight.severity,
        message: insight.message,
        data: insight.data,
      } as any);
    }

    return insights;
  }

  /**
   * Risk Detection: Identify anomalies and potential issues
   * Scores based on multiple factors: burnout risk, pattern anomalies, health indicators
   */
  private detectRisks(
    currentSessions: any[],
    allSessions: any[],
    period: 'daily' | 'weekly' | 'monthly'
  ): InsightType[] {
    const insights: InsightType[] = [];

    if (currentSessions.length === 0) return insights;

    const metrics = calculateUtilizationMetrics(currentSessions);

    // Risk 1: Burnout Detection (excessive focus hours)
    if (metrics.focusHours > 12) {
      insights.push({
        type: 'deviation',
        severity: 'critical',
        message: `BURNOUT RISK: ${metrics.focusHours.toFixed(1)} hours of focus today. Consider taking breaks.`,
        data: {
          metric: 'burnout_risk',
          value: metrics.focusHours,
          expected: 8,
          deviation: ((metrics.focusHours - 8) / 8) * 100,
          period,
        },
      });
    } else if (metrics.focusHours > 10) {
      insights.push({
        type: 'deviation',
        severity: 'warning',
        message: `High focus hours: ${metrics.focusHours.toFixed(1)} hours today. Remember to take breaks.`,
        data: {
          metric: 'burnout_risk',
          value: metrics.focusHours,
          expected: 8,
          deviation: ((metrics.focusHours - 8) / 8) * 100,
          period,
        },
      });
    }

    // Risk 2: Fragmentation Risk (too many small sessions)
    if (currentSessions.length > 15 && metrics.avgSessionDuration < 15) {
      insights.push({
        type: 'deviation',
        severity: 'warning',
        message: `Highly fragmented work (${currentSessions.length} short sessions). Consider longer focus blocks.`,
        data: {
          metric: 'fragmentation_risk',
          value: currentSessions.length,
          expected: 8,
          deviation: ((currentSessions.length - 8) / 8) * 100,
          period,
        },
      });
    }

    // Risk 3: Inconsistency Risk (high variability between days)
    if (period === 'weekly' && allSessions.length >= 7) {
      const dailyHours = this.calculateDailyVariance(allSessions);
      if (dailyHours.variance > 0.4) {
        insights.push({
          type: 'deviation',
          severity: 'info',
          message: `Inconsistent work schedule (CV: ${(dailyHours.variance * 100).toFixed(0)}%). Track patterns for optimization.`,
          data: {
            metric: 'inconsistency_risk',
            value: dailyHours.variance,
            expected: 0.2,
            deviation: (dailyHours.variance - 0.2) * 100,
            period,
          },
        });
      }
    }

    // Risk 4: Underutilization Warning (very low activity)
    if (metrics.focusHours < 1 && currentSessions.length > 0) {
      insights.push({
        type: 'deviation',
        severity: 'info',
        message: `📉 Low activity detected (${metrics.focusHours.toFixed(2)} hours). Ensure tracking is working correctly.`,
        data: {
          metric: 'underutilization',
          value: metrics.focusHours,
          expected: 6,
          deviation: -((6 - metrics.focusHours) / 6) * 100,
          period,
        },
      });
    }

    return insights;
  }

  /**
   * Helper: Calculate daily variance (coefficient of variation)
   * Used for inconsistency detection
   */
  private calculateDailyVariance(sessions: any[]): {
    mean: number;
    variance: number;
    stdDev: number;
  } {
    const dailyHours: { [key: string]: number } = {};

    sessions.forEach((s: any) => {
      const date = new Date(s.startTime).toISOString().split('T')[0];
      dailyHours[date] = (dailyHours[date] || 0) + (s.durationSeconds || 0) / 3600;
    });

    const hours = Object.values(dailyHours);
    if (hours.length === 0) return { mean: 0, variance: 0, stdDev: 0 };

    const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
    const variance = hours.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hours.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

    return { mean, variance: coefficientOfVariation, stdDev };
  }

  /**
   * Get recent insights for a user (paginated)
   */
  async getInsightsForUser(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ insights: any[]; total: number }> {
    const allInsights: any[] = await findInsightsByUser(userId);

    // Sort by creation date, newest first
    allInsights.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = allInsights.length;
    const paginated = allInsights.slice(offset, offset + limit);

    return {
      insights: paginated,
      total,
    };
  }

  /**
   * Get recent insights for an organization
   */
  async getInsightsForOrganization(
    organizationId: string,
    userIds: string[],
    limit: number = 50,
    severity?: string
  ): Promise<{ insights: any[]; total: number }> {
    // Fetch insights for all users in org
    const allInsights: any[] = [];
    for (const userId of userIds) {
      const userInsights = await findInsightsByUser(userId);
      allInsights.push(...userInsights);
    }

    // Filter by severity if provided
    let filtered = allInsights;
    if (severity) {
      filtered = filtered.filter((i: any) => i.severity === severity);
    }

    // Sort by creation date, newest first
    filtered.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = filtered.length;
    const paginated = filtered.slice(0, limit);

    return {
      insights: paginated,
      total,
    };
  }

  /**
   * Helper: Get sessions for a specific period
   */
  private getSessionsForPeriod(
    sessions: WorkSession[],
    period: 'daily' | 'weekly' | 'monthly'
  ): WorkSession[] {
    const now = new Date();
    let cutoffTime: Date;

    if (period === 'daily') {
      // Today only
      cutoffTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      // Last 7 days
      cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      // Last 30 days
      cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return sessions.filter((s: any) => new Date(s.startTime).getTime() >= cutoffTime.getTime());
  }
}

export default new InsightEngine();

/**
 * Risk Detection Engine Service
 * Detects work-related risks and anomalies based on session data
 */

import { WorkSession, findSessionsByUser } from '../../database/models/WorkSession.model';
import {
  RiskEvent,
  RiskEventType,
  RiskCategory,
  RiskSeverity,
  RISK_THRESHOLDS,
  RiskSummary,
  DetectedRisk,
} from './riskTypes';
import { calculateUtilizationMetrics } from '../insight-engine/utilization.rule';
import { createRiskEvent } from '../../database/models/RiskEvent.model';
import { logRiskEvent } from '../../modules/audit/audit.service';

class RiskDetectionEngine {
  /**
   * Detect all risks for a user in a given period
   */
  async detectUserRisks(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    organizationId?: string
  ): Promise<DetectedRisk[]> {
    const allSessions = await findSessionsByUser(userId);
    const completedSessions = allSessions.filter((s: any) => s.endTime);
    const currentPeriodSessions = this.getSessionsForPeriod(completedSessions, period);

    const risks: DetectedRisk[] = [];

    if (currentPeriodSessions.length > 0) {
      // Detect burnout (including late night work)
      risks.push(...this.detectBurnout(currentPeriodSessions, userId, organizationId, period));

      // Detect scope creep (tasks growing beyond historical average)
      risks.push(
        ...this.detectScopeCreep(
          currentPeriodSessions,
          completedSessions,
          userId,
          organizationId,
          period
        )
      );

      // Detect ghosting (active session without activity)
      risks.push(...this.detectGhosting(allSessions, userId, organizationId));

      // Detect excessive overtime
      risks.push(
        ...this.detectExcessiveOvertime(currentPeriodSessions, userId, organizationId, period)
      );

      // Detect fragmentation
      risks.push(
        ...this.detectFragmentation(currentPeriodSessions, userId, organizationId, period)
      );

      // Detect inconsistency (weekly/monthly only)
      if (period !== 'daily' && completedSessions.length >= 7) {
        risks.push(...this.detectInconsistency(completedSessions, userId, organizationId, period));
      }

      // Detect underutilization
      risks.push(
        ...this.detectUnderutilization(currentPeriodSessions, userId, organizationId, period)
      );

      // Detect off-hours work
      risks.push(...this.detectOffHoursWork(currentPeriodSessions, userId, organizationId, period));
    }

    // Store risks in database and audit log (fire-and-forget for performance)
    const validRisks = risks.filter((r: any) => r !== null) as DetectedRisk[];
    validRisks.forEach(async (risk) => {
      try {
        // Store in database
        const createdRisk = await createRiskEvent({
          userId: risk.userId,
          organizationId: risk.organizationId,
          riskType: risk.riskType,
          category: risk.category,
          severity: risk.severity,
          title: risk.title,
          description: risk.description,
          metadata: risk.metadata,
          detectedAt: risk.detectedAt,
          isActive: risk.isActive,
        });

        // Log to audit trail
        await logRiskEvent(createdRisk);
      } catch (error) {
        // Log error but don't fail the detection
        console.error('Failed to store risk event:', error);
      }
    });

    return validRisks;
  }

  /**
   * Detect anomalies in a user's work behavior
   * Returns a simplified array of anomalies with type, severity, and description
   */
  async detectAnomalies(userId: string, organizationId: string): Promise<any[]> {
    const risks = await this.detectUserRisks(userId, 'weekly', organizationId);

    // Transform risks into anomalies format
    return risks.map((risk: DetectedRisk) => ({
      type: risk.riskType,
      severity: risk.severity,
      description: risk.description,
      title: risk.title,
      category: risk.category,
      metadata: risk.metadata,
    }));
  }

  /**
   * Detect burnout risk (excessive hours, late night work, declining productivity)
   */
  private detectBurnout(
    sessions: WorkSession[],
    userId: string,
    organizationId: string | undefined,
    period: string
  ): any[] {
    const risks: DetectedRisk[] = [];
    const metrics = calculateUtilizationMetrics(sessions);

    // Critical burnout: >12 hours
    if (metrics.focusHours > RISK_THRESHOLDS.BURNOUT_CRITICAL_HOURS) {
      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.BURNOUT_WARNING,
        category: RiskCategory.BURNOUT,
        severity: RiskSeverity.CRITICAL,
        title: 'Critical Burnout Risk',
        description: `Excessive focus hours detected: ${metrics.focusHours.toFixed(1)}h in ${period}. Immediate break recommended.`,
        metadata: {
          metric: 'focus_hours',
          value: metrics.focusHours,
          threshold: RISK_THRESHOLDS.BURNOUT_CRITICAL_HOURS,
          period: period as any,
          recommendations: [
            'Take immediate breaks every 30 minutes',
            'Reduce workload or delegate tasks',
            'Schedule time off to recover',
            'Consider speaking with manager about workload',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }
    // Warning level: >10 hours
    else if (metrics.focusHours > RISK_THRESHOLDS.BURNOUT_WARNING_HOURS) {
      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.BURNOUT_WARNING,
        category: RiskCategory.BURNOUT,
        severity: RiskSeverity.WARNING,
        title: 'High Burnout Risk',
        description: `High focus hours: ${metrics.focusHours.toFixed(1)}h in ${period}. Remember to take breaks.`,
        metadata: {
          metric: 'focus_hours',
          value: metrics.focusHours,
          threshold: RISK_THRESHOLDS.BURNOUT_WARNING_HOURS,
          period: period as any,
          recommendations: [
            'Take regular breaks',
            'Prioritize important tasks',
            'Avoid overtime if possible',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }

    // Check for late night work pattern
    const lateNightSessions = sessions.filter((s: any) => {
      const hour = new Date(s.startTime).getHours();
      return hour >= RISK_THRESHOLDS.LATE_NIGHT_THRESHOLD_HOUR;
    });

    if (lateNightSessions.length > 0) {
      const totalLateHours =
        lateNightSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.ANOMALY_FLAGGED,
        category: RiskCategory.BURNOUT,
        severity: RiskSeverity.WARNING,
        title: 'Late Night Work Detected',
        description: `${lateNightSessions.length} sessions detected after 10 PM (${totalLateHours.toFixed(1)}h total). Sleep is important for productivity.`,
        metadata: {
          metric: 'late_night_sessions',
          value: lateNightSessions.length,
          period: period as any,
          sessionIds: lateNightSessions.map((s: any) => s.id),
          recommendations: [
            'Try to shift sessions earlier in the day',
            'Maintain consistent sleep schedule',
            'Avoid screens 1 hour before bed',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }

    return risks;
  }

  /**
   * Detect scope creep (task duration 30%+ above historical average)
   */
  private detectScopeCreep(
    currentSessions: WorkSession[],
    allSessions: WorkSession[],
    userId: string,
    organizationId: string | undefined,
    period: string
  ): DetectedRisk[] {
    const risks: DetectedRisk[] = [];

    // Get historical baseline (last N days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RISK_THRESHOLDS.SCOPE_CREEP_HISTORY_DAYS);
    const historicalSessions = allSessions.filter((s: any) => new Date(s.startTime) < cutoffDate);

    if (historicalSessions.length === 0) return risks; // Not enough history

    const historicalMetrics = calculateUtilizationMetrics(historicalSessions);
    const currentMetrics = calculateUtilizationMetrics(currentSessions);

    // Check if average session duration increased >30%
    if (historicalMetrics.avgSessionDuration > 0) {
      const durationIncrease =
        ((currentMetrics.avgSessionDuration - historicalMetrics.avgSessionDuration) /
          historicalMetrics.avgSessionDuration) *
        100;

      if (durationIncrease > (RISK_THRESHOLDS.SCOPE_CREEP_THRESHOLD - 1) * 100) {
        risks.push({
          userId,
          organizationId,
          riskType: RiskEventType.PROJECT_AT_RISK,
          category: RiskCategory.SCOPE_CREEP,
          severity: durationIncrease > 50 ? RiskSeverity.CRITICAL : RiskSeverity.WARNING,
          title: 'Scope Creep Detected',
          description: `Tasks taking ${durationIncrease.toFixed(0)}% longer than usual. May indicate scope expansion or complexity increase.`,
          metadata: {
            metric: 'session_duration_increase',
            value: currentMetrics.avgSessionDuration,
            threshold: historicalMetrics.avgSessionDuration,
            deviation: durationIncrease,
            period: period as any,
            recommendations: [
              'Review task requirements and scope',
              'Break large tasks into smaller chunks',
              'Identify blockers or complexity issues',
              'Discuss with team if requirements changed',
            ],
          },
          detectedAt: new Date(),
          isActive: true,
        });
      }
    }

    return risks;
  }

  /**
   * Detect ghosting (active session with no activity for threshold period)
   * Note: This checks for sessions that appear to be idle/ghost sessions
   */
  private detectGhosting(
    sessions: WorkSession[],
    userId: string,
    organizationId: string | undefined
  ): DetectedRisk[] {
    const risks: DetectedRisk[] = [];

    // Find sessions that were auto-ended by idle detection (ghosting indicator)
    const ghostedSessions = sessions.filter(
      (s) =>
        s.meta?.endedByIdleDetection === true ||
        (s.meta?.idleDurationSeconds && s.meta.idleDurationSeconds > 60 * 30) // >30 min idle
    );

    if (ghostedSessions.length > 2) {
      const totalGhostMinutes =
        ghostedSessions.reduce((sum, s) => sum + (s.meta?.idleDurationSeconds || 0), 0) / 60;

      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.ANOMALY_FLAGGED,
        category: RiskCategory.GHOSTING,
        severity: RiskSeverity.WARNING,
        title: 'Ghost Sessions Detected',
        description: `${ghostedSessions.length} sessions auto-ended due to inactivity (${totalGhostMinutes.toFixed(0)} min idle). Sessions left running without activity.`,
        metadata: {
          metric: 'ghost_sessions',
          value: ghostedSessions.length,
          sessionIds: ghostedSessions.map((s: any) => s.id),
          recommendations: [
            'Manually end sessions when finished',
            'Enable notifications for idle warnings',
            'Review if sessions match actual work periods',
            'Check if you are forgetting to end sessions',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }

    return risks;
  }

  /**
   * Detect excessive overtime (>10h daily / >50h weekly)
   */
  private detectExcessiveOvertime(
    sessions: WorkSession[],
    userId: string,
    organizationId: string | undefined,
    period: string
  ): DetectedRisk[] {
    const risks: DetectedRisk[] = [];
    const metrics = calculateUtilizationMetrics(sessions);

    if (period === 'daily' && metrics.focusHours > RISK_THRESHOLDS.OVERTIME_DAILY_THRESHOLD) {
      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.RISK_DETECTED,
        category: RiskCategory.EXCESSIVE_OVERTIME,
        severity: RiskSeverity.CRITICAL,
        title: 'Excessive Daily Overtime',
        description: `Working ${metrics.focusHours.toFixed(1)}+ hours today. This exceeds recommended daily limits.`,
        metadata: {
          metric: 'daily_overtime',
          value: metrics.focusHours,
          threshold: RISK_THRESHOLDS.OVERTIME_DAILY_THRESHOLD,
          period: period as any,
          recommendations: [
            'Stop work and rest',
            'Plan workload better for tomorrow',
            'Talk to manager about workload',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    } else if (
      period === 'weekly' &&
      metrics.focusHours > RISK_THRESHOLDS.OVERTIME_WEEKLY_THRESHOLD
    ) {
      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.RISK_DETECTED,
        category: RiskCategory.EXCESSIVE_OVERTIME,
        severity: RiskSeverity.WARNING,
        title: 'Excessive Weekly Overtime',
        description: `Working ${metrics.focusHours.toFixed(1)}h this week, ${(metrics.focusHours - RISK_THRESHOLDS.OVERTIME_WEEKLY_THRESHOLD).toFixed(1)}h over the limit.`,
        metadata: {
          metric: 'weekly_overtime',
          value: metrics.focusHours,
          threshold: RISK_THRESHOLDS.OVERTIME_WEEKLY_THRESHOLD,
          period: period as any,
          recommendations: [
            'Plan reduced hours next week',
            'Delegate or postpone non-urgent tasks',
            'Schedule recovery time',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }

    return risks;
  }

  /**
   * Detect fragmentation (too many short sessions)
   */
  private detectFragmentation(
    sessions: WorkSession[],
    userId: string,
    organizationId: string | undefined,
    period: string
  ): DetectedRisk[] {
    const risks: DetectedRisk[] = [];
    const metrics = calculateUtilizationMetrics(sessions);

    if (
      sessions.length > RISK_THRESHOLDS.FRAGMENTATION_SESSION_COUNT &&
      metrics.avgSessionDuration < RISK_THRESHOLDS.FRAGMENTATION_AVG_DURATION_MIN
    ) {
      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.ANOMALY_FLAGGED,
        category: RiskCategory.FRAGMENTATION,
        severity: RiskSeverity.WARNING,
        title: 'Work Fragmentation',
        description: `${sessions.length} short sessions (avg ${metrics.avgSessionDuration.toFixed(1)}min). Consider consolidating into longer focus blocks.`,
        metadata: {
          metric: 'fragmentation',
          value: sessions.length,
          period: period as any,
          recommendations: [
            'Block longer time for deep work',
            'Reduce interruptions',
            'Batch similar tasks together',
            'Use the Pomodoro technique more deliberately',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }

    return risks;
  }

  /**
   * Detect inconsistency (high variability in daily work patterns)
   */
  private detectInconsistency(
    sessions: WorkSession[],
    userId: string,
    organizationId: string | undefined,
    period: string
  ): DetectedRisk[] {
    const risks: DetectedRisk[] = [];

    const dailyHours: { [key: string]: number } = {};
    sessions.forEach((s: any) => {
      const date = new Date(s.startTime).toISOString().split('T')[0];
      dailyHours[date] = (dailyHours[date] || 0) + (s.durationSeconds || 0) / 3600;
    });

    const hours = Object.values(dailyHours);
    if (hours.length < 2) return risks;

    const mean = hours.reduce((a, b) => a + b) / hours.length;
    const variance = hours.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hours.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    if (cv > RISK_THRESHOLDS.INCONSISTENCY_CV_THRESHOLD) {
      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.ANOMALY_FLAGGED,
        category: RiskCategory.INCONSISTENCY,
        severity: RiskSeverity.WARNING,
        title: 'Inconsistent Work Pattern',
        description: `High variability in daily hours (CV: ${(cv * 100).toFixed(0)}%). Consider establishing a more consistent schedule.`,
        metadata: {
          metric: 'consistency_variance',
          value: cv,
          threshold: RISK_THRESHOLDS.INCONSISTENCY_CV_THRESHOLD,
          period: period as any,
          recommendations: [
            'Set fixed work hours',
            'Plan tasks across the week more evenly',
            'Maintain work/life balance',
            'Track if inconsistency affects productivity',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }

    return risks;
  }

  /**
   * Detect underutilization (very low activity despite sessions)
   */
  private detectUnderutilization(
    sessions: WorkSession[],
    userId: string,
    organizationId: string | undefined,
    period: string
  ): DetectedRisk[] {
    const risks: DetectedRisk[] = [];
    const metrics = calculateUtilizationMetrics(sessions);

    if (metrics.focusHours < RISK_THRESHOLDS.UNDERUTILIZATION_HOURS && sessions.length > 0) {
      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.RISK_DETECTED,
        category: RiskCategory.UNDERUTILIZATION,
        severity: RiskSeverity.WARNING,
        title: 'Low Activity Level',
        description: `Low recorded activity (${metrics.focusHours.toFixed(2)}h) despite ${sessions.length} sessions. Check if tracking is working correctly.`,
        metadata: {
          metric: 'underutilization',
          value: metrics.focusHours,
          threshold: RISK_THRESHOLDS.UNDERUTILIZATION_HOURS,
          period: period as any,
          recommendations: [
            'Verify session tracking is enabled',
            'Check if sessions are being properly ended',
            'Review if activity matches actual work',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }

    return risks;
  }

  /**
   * Detect off-hours work (sessions outside normal hours)
   */
  private detectOffHoursWork(
    sessions: WorkSession[],
    userId: string,
    organizationId: string | undefined,
    period: string
  ): DetectedRisk[] {
    const risks: DetectedRisk[] = [];

    const offHoursSessions = sessions.filter((s: any) => {
      const hour = new Date(s.startTime).getHours();
      return hour >= RISK_THRESHOLDS.OFF_HOURS_START || hour < RISK_THRESHOLDS.OFF_HOURS_END;
    });

    if (offHoursSessions.length > 2) {
      const totalOffHoursMinutes =
        offHoursSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60;

      risks.push({
        userId,
        organizationId,
        riskType: RiskEventType.ANOMALY_FLAGGED,
        category: RiskCategory.OFF_HOURS_WORK,
        severity: RiskSeverity.WARNING,
        title: 'Off-Hours Work Pattern',
        description: `${offHoursSessions.length} work sessions outside normal hours (${totalOffHoursMinutes.toFixed(0)}min total before 8 AM or after 6 PM).`,
        metadata: {
          metric: 'off_hours_sessions',
          value: offHoursSessions.length,
          sessionIds: offHoursSessions.map((s: any) => s.id),
          period: period as any,
          recommendations: [
            'Establish clear work hours boundaries',
            'Avoid working early mornings or late evenings',
            'Balance work and personal time',
            'Consider if off-hours work is necessary or habit',
          ],
        },
        detectedAt: new Date(),
        isActive: true,
      });
    }

    return risks;
  }

  /**
   * Helper: Get sessions for a given period
   */
  private getSessionsForPeriod(
    sessions: WorkSession[],
    period: 'daily' | 'weekly' | 'monthly'
  ): WorkSession[] {
    const now = new Date();
    const cutoff = new Date();

    if (period === 'daily') {
      cutoff.setDate(cutoff.getDate() - 1);
    } else if (period === 'weekly') {
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (period === 'monthly') {
      cutoff.setMonth(cutoff.getMonth() - 1);
    }

    return sessions.filter((s: any) => new Date(s.startTime) >= cutoff);
  }

  /**
   * Calculate risk score (0-100) based on active risks
   */
  calculateRiskScore(risks: RiskEvent[]): number {
    if (risks.length === 0) return 0;

    let score = 0;

    // Weight each risk by severity
    risks.forEach((risk) => {
      if (risk.severity === RiskSeverity.CRITICAL) score += 30;
      else if (risk.severity === RiskSeverity.WARNING) score += 15;
      else score += 5;
    });

    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Generate recommendations based on detected risks
   */
  generateRecommendations(risks: RiskEvent[]): string[] {
    const recommendations = new Set<string>();

    risks.forEach((risk) => {
      risk.metadata.recommendations?.forEach((rec: any) => recommendations.add(rec));
    });

    return Array.from(recommendations).slice(0, 5); // Top 5 recommendations
  }
}

export default new RiskDetectionEngine();

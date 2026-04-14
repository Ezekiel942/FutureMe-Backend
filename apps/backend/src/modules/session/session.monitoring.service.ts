import { findSessionsByUser } from '../../database/models/WorkSession.model';
import { emitSessionAnomaly } from '../../engines/socket.events';
import riskDetectionEngine from '../../engines/risk-engine/riskDetectionEngine';
import { WorkSession } from '../../database/models/WorkSession.model';

export interface SessionAnomaly {
  type: string;
  title: string;
  description: string;
  severity: 'warning' | 'critical' | 'info';
  sessionId?: string | null;
  metadata?: Record<string, any>;
}

export const analyzeSessionBehavior = async (
  userId: string,
  organizationId?: string
): Promise<SessionAnomaly[]> => {
  const sessions = await findSessionsByUser(userId);
  const now = new Date();
  const recentThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const anomalies: SessionAnomaly[] = [];

  const totalPauseEvents = sessions.reduce((sum: number, session: WorkSession) => {
    const meta = session.meta || {};
    return sum + (Number(meta.pauseCount || 0) + Number(meta.resumeCount || 0));
  }, 0);

  if (totalPauseEvents >= 6) {
    anomalies.push({
      type: 'too_frequent_pauses',
      title: 'Frequent pause/resume activity detected',
      description: `Detected ${totalPauseEvents} pause/resume actions in recent sessions. This can indicate workflow churn or context switching.`,
      severity: 'warning',
      metadata: {
        pauseResumeCycleCount: totalPauseEvents,
      },
    });
  }

  const longSessions = sessions.filter((session: WorkSession) => {
    const duration = session.durationSeconds || 0;
    return duration >= 12 * 60 * 60;
  });
  if (longSessions.length > 0) {
    anomalies.push({
      type: 'extremely_long_sessions',
      title: 'Extremely long work sessions detected',
      description: `Found ${longSessions.length} session(s) longer than 12 hours. Verify whether these sessions are still active or represent unattended tracking.`,
      severity: 'warning',
      metadata: {
        longSessionCount: longSessions.length,
        sessionIds: longSessions.map((session: WorkSession) => session.id),
      },
    });
  }

  const rapidResumes = sessions.filter((session: WorkSession) => {
    const meta = session.meta || {};
    if (!meta.pausedAt || !meta.lastResumedAt) return false;
    const pausedAt = new Date(meta.pausedAt).getTime();
    const resumedAt = new Date(meta.lastResumedAt).getTime();
    return resumedAt > pausedAt && resumedAt - pausedAt <= 2 * 60 * 1000;
  });
  if (rapidResumes.length > 0) {
    anomalies.push({
      type: 'rapid_resume_cycles',
      title: 'Rapid resume cycles detected',
      description: `Detected ${rapidResumes.length} session(s) that resumed within 2 minutes of pausing. This may signal inconsistent tracking behavior.`,
      severity: 'warning',
      metadata: {
        rapidResumeCount: rapidResumes.length,
        sessionIds: rapidResumes.map((session: WorkSession) => session.id),
      },
    });
  }

  const recentSessions = sessions.filter((session: WorkSession) => {
    const startedAt = new Date(session.startTime);
    const endedAt = session.endTime ? new Date(session.endTime) : null;
    return startedAt >= recentThreshold || (endedAt && endedAt >= recentThreshold);
  });

  if (recentSessions.length > 0) {
    const aiAnomalies = await riskDetectionEngine.detectAnomalies(userId, organizationId || '');
    aiAnomalies.forEach((risk: any) => {
      anomalies.push({
        type: risk.type || risk.riskType || 'ai_anomaly',
        title: risk.title,
        description: risk.description,
        severity: risk.severity || 'warning',
        sessionId: risk.metadata?.sessionId || null,
        metadata: risk.metadata,
      });
    });
  }

  anomalies.forEach((anomaly) => {
    emitSessionAnomaly(userId, organizationId || '', anomaly);
  });

  return anomalies;
};

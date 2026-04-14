import { broadcastToUser, broadcastToManagers, broadcastToAdmins } from './socket.server';
import logger from '@utils/logger';
import { WorkSession } from '../database/models/WorkSession.model';
import { RiskEvent } from './risk-engine/riskTypes';

const buildEventNames = (eventBase: string) => [
  `session:${eventBase}`,
  `session.${eventBase}`,
  `SESSION_${eventBase.toUpperCase()}`,
];

const emitSessionEvent = (
  userId: string,
  organizationId: string,
  eventBase: string,
  payload: any
) => {
  const names = buildEventNames(eventBase);
  names.forEach((event) => {
    broadcastToUser(userId, event, payload);
    if (organizationId) {
      broadcastToManagers(organizationId, event, payload);
    }
    broadcastToAdmins(event, payload);
  });
};

const createSessionPayload = (session: WorkSession, status: string) => ({
  sessionId: session.id,
  userId: session.userId,
  projectId: session.projectId ?? null,
  taskId: session.taskId ?? null,
  status,
  startTime: session.startTime ?? null,
  endTime: session.endTime ?? null,
  durationSeconds: session.durationSeconds ?? 0,
  meta: session.meta ?? {},
  timestamp: new Date().toISOString(),
});

export const emitSessionStarted = (
  userId: string,
  organizationId: string,
  session: WorkSession
) => {
  const payload = createSessionPayload(session, 'active');
  emitSessionEvent(userId, organizationId, 'started', payload);
  logger.info('Emitted socket event', { event: 'session.started', userId, organizationId });
};

export const emitSessionPaused = (userId: string, organizationId: string, session: WorkSession) => {
  const payload = {
    ...createSessionPayload(session, 'paused'),
    pausedAt: session.meta?.pausedAt ?? null,
  };
  emitSessionEvent(userId, organizationId, 'paused', payload);
  logger.info('Emitted socket event', { event: 'session.paused', userId, organizationId });
};

export const emitSessionResumed = (
  userId: string,
  organizationId: string,
  session: WorkSession
) => {
  const payload = {
    ...createSessionPayload(session, 'active'),
    resumedAt: session.meta?.lastResumedAt ?? null,
  };
  emitSessionEvent(userId, organizationId, 'resumed', payload);
  logger.info('Emitted socket event', { event: 'session.resumed', userId, organizationId });
};

export const emitSessionEnded = (userId: string, organizationId: string, session: WorkSession) => {
  const payload = {
    ...createSessionPayload(session, 'ended'),
    endTime: session.endTime ?? null,
  };
  emitSessionEvent(userId, organizationId, 'ended', payload);
  logger.info('Emitted socket event', { event: 'session.ended', userId, organizationId });
};

export const emitSessionIdle = (
  userId: string,
  organizationId: string,
  session: WorkSession,
  idleMinutes: number
) => {
  const payload = {
    ...createSessionPayload(session, 'idle'),
    idleMinutes,
    idleAt: session.meta?.idleAt ?? new Date().toISOString(),
  };
  emitSessionEvent(userId, organizationId, 'idle', payload);
  logger.info('Emitted socket event', { event: 'session.idle', userId, organizationId });
};

export const emitSessionAnomaly = (
  userId: string,
  organizationId: string,
  anomaly: Record<string, any>
) => {
  const payload = {
    sessionId: anomaly.sessionId ?? null,
    userId,
    title: anomaly.title,
    description: anomaly.description,
    type: anomaly.type,
    severity: anomaly.severity,
    metadata: anomaly.metadata ?? {},
    timestamp: new Date().toISOString(),
  };
  emitSessionEvent(userId, organizationId, 'anomaly', payload);
  logger.info('Emitted socket event', { event: 'session.anomaly', userId, organizationId });
};

/**
 * Emit risk detected event (critical/warning level risks)
 */
export const emitRiskDetected = (userId: string, organizationId: string, risk: RiskEvent) => {
  const payload = {
    id: risk.id,
    category: risk.category,
    severity: risk.severity,
    title: risk.title,
    description: risk.description,
    metadata: risk.metadata,
    detectedAt: risk.detectedAt,
    timestamp: new Date().toISOString(),
  };

  broadcastToUser(userId, 'risk:detected', payload);
  broadcastToManagers(organizationId, 'risk:detected', payload);
  broadcastToAdmins('risk:detected', payload);
  // Uppercase alias
  broadcastToUser(userId, 'RISK_DETECTED', payload);
  broadcastToManagers(organizationId, 'RISK_DETECTED', payload);
  broadcastToAdmins('RISK_DETECTED', payload);
  logger.info('Emitted socket event', {
    event: 'risk:detected',
    userId,
    organizationId,
    category: risk.category,
  });
};

/**
 * Emit anomaly flagged event (info level risks)
 */
export const emitAnomalyFlagged = (userId: string, organizationId: string, risk: RiskEvent) => {
  const payload = {
    id: risk.id,
    category: risk.category,
    severity: risk.severity,
    title: risk.title,
    description: risk.description,
    metadata: risk.metadata,
    detectedAt: risk.detectedAt,
    timestamp: new Date().toISOString(),
  };

  broadcastToUser(userId, 'anomaly:flagged', payload);
  broadcastToManagers(organizationId, 'anomaly:flagged', payload);
  broadcastToAdmins('anomaly:flagged', payload);
  broadcastToUser(userId, 'ANOMALY_FLAGGED', payload);
  broadcastToManagers(organizationId, 'ANOMALY_FLAGGED', payload);
  broadcastToAdmins('ANOMALY_FLAGGED', payload);
  logger.info('Emitted socket event', {
    event: 'anomaly:flagged',
    userId,
    organizationId,
    category: risk.category,
  });
};

export default {
  emitSessionStarted,
  emitSessionPaused,
  emitSessionResumed,
  emitSessionEnded,
  emitSessionIdle,
  emitSessionAnomaly,
  emitRiskDetected,
  emitAnomalyFlagged,
};

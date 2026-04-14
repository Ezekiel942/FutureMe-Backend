import {
  WorkSession,
  findSessionById,
  updateSession,
} from '../../database/models/WorkSession.model';
import { emitSessionIdle, emitSessionEnded } from '../socket.events';
import logger from '@utils/logger';

/**
 * Idle Detection Engine
 *
 * Monitors active sessions for inactivity and automatically pauses/ends them
 * after a configurable timeout. Sends WebSocket notifications to clients.
 *
 * Configuration:
 * - IDLE_TIMEOUT_MIN: Time before marking initial idle warning (default: 5 min)
 * - IDLE_END_MIN: Time before auto-ending session (default: 15 min)
 */

interface IdleTracking {
  sessionId: string;
  userId: string;
  lastActivity: Date;
  idleWarningSent: boolean;
}

class IdleDetector {
  private activeSessions: Map<string, IdleTracking> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private readonly idleTimeoutMs = Number(process.env.IDLE_TIMEOUT_MIN || 5) * 60 * 1000;
  private readonly idleEndMs = Number(process.env.IDLE_END_MIN || 15) * 60 * 1000;

  /**
   * Start idle detection service (called once on app initialization)
   */
  public start(): void {
    if (this.checkInterval) return;

    logger.info('Idle detection service started', {
      idleTimeoutMin: this.idleTimeoutMs / 1000 / 60,
      idleEndMin: this.idleEndMs / 1000 / 60,
    });

    // Check every 30 seconds for idle sessions
    this.checkInterval = setInterval(() => this.checkIdleSessions(), 30000);
  }

  /**
   * Stop idle detection service (called on graceful shutdown)
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Idle detection service stopped');
    }
  }

  /**
   * Register a new active session
   */
  public trackSession(sessionId: string, userId: string): void {
    this.activeSessions.set(sessionId, {
      sessionId,
      userId,
      lastActivity: new Date(),
      idleWarningSent: false,
    });
    logger.debug('Session tracked for idle detection', { sessionId, userId });
  }

  /**
   * Update activity timestamp (client sends heartbeat or interacts)
   */
  public updateActivity(sessionId: string): void {
    const tracking = this.activeSessions.get(sessionId);
    if (tracking) {
      tracking.lastActivity = new Date();
      tracking.idleWarningSent = false; // Reset warning flag on activity
    }
  }

  /**
   * Untrack session (session ended manually)
   */
  public untrackSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    logger.debug('Session untracked from idle detection', { sessionId });
  }

  /**
   * Check all tracked sessions for idle and take action
   */
  private async checkIdleSessions(): Promise<void> {
    const now = new Date();
    const sessionsToCheck = Array.from(this.activeSessions.values());

    for (const tracking of sessionsToCheck) {
      const idleDuration = now.getTime() - tracking.lastActivity.getTime();

      try {
        const session = await findSessionById(tracking.sessionId);
        if (!session || session.endTime) {
          // Session already ended; clean up tracking
          this.untrackSession(tracking.sessionId);
          continue;
        }

        // Phase 1: Send idle event (after configured timeout)
        if (idleDuration >= this.idleTimeoutMs && !tracking.idleWarningSent) {
          tracking.idleWarningSent = true;
          const idleAt = new Date().toISOString();
          const updatedSession = await updateSession(tracking.sessionId, {
            meta: {
              ...(session.meta || {}),
              idleAt,
              idleDetected: true,
              idleDurationSeconds: Math.floor(idleDuration / 1000),
            },
          });

          if (updatedSession) {
            emitSessionIdle(
              tracking.userId,
              updatedSession.organizationId || '',
              updatedSession,
              Math.floor(idleDuration / 1000 / 60)
            );
          }

          logger.info('Idle session event emitted', {
            sessionId: tracking.sessionId,
            userId: tracking.userId,
            idleMinutes: Math.floor(idleDuration / 1000 / 60),
          });
        }

        // Phase 2: Auto-end session (after configured max idle)
        if (idleDuration >= this.idleEndMs) {
          const now = new Date().toISOString();
          const durationSeconds = Math.floor(idleDuration / 1000);
          const updatedSession = await updateSession(tracking.sessionId, {
            endTime: now,
            durationSeconds,
            meta: {
              ...(session.meta || {}),
              endedByIdleDetection: true,
              idleDurationSeconds: durationSeconds,
              endedAt: now,
            },
          });

          this.untrackSession(tracking.sessionId);
          if (updatedSession) {
            emitSessionEnded(tracking.userId, updatedSession.organizationId || '', updatedSession);
          }

          logger.info('Session auto-ended due to idle', {
            sessionId: tracking.sessionId,
            userId: tracking.userId,
            idleMinutes: Math.floor(idleDuration / 1000 / 60),
          });
        }
      } catch (err: any) {
        logger.error('Error checking idle session', {
          sessionId: tracking.sessionId,
          error: err?.message,
        });
      }
    }
  }
}

export default new IdleDetector();

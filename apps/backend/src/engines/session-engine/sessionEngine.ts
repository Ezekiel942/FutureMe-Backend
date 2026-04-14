import {
  createSession,
  findSessionsByUser,
  updateSession,
  findSessionById,
} from '../../database/models/WorkSession.model';
import { SessionState, assertCanTransition } from './stateMachine';
import idleDetector from './idleDetector';

class SessionEngine {
  async start(userId: string, projectId?: string | null, taskId?: string | null) {
    // Validate required userId
    if (!userId) {
      const err: any = new Error('userId is required to start a session');
      err.code = 'INVALID_USER_ID';
      err.status = 400;
      throw err;
    }

    // Validate userId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      const err: any = new Error('userId must be a valid UUID');
      err.code = 'INVALID_USER_ID';
      err.status = 400;
      throw err;
    }

    // Validate projectId is valid UUID or null
    if (projectId && !uuidRegex.test(projectId)) {
      const err: any = new Error('projectId must be a valid UUID or null');
      err.code = 'INVALID_PROJECT_ID';
      err.status = 400;
      throw err;
    }

    // Validate taskId is valid UUID or null
    if (taskId && !uuidRegex.test(taskId)) {
      const err: any = new Error('taskId must be a valid UUID or null');
      err.code = 'INVALID_TASK_ID';
      err.status = 400;
      throw err;
    }

    // prevent overlapping active sessions
    const existing = await findSessionsByUser(userId);
    const active = existing.find(
      (s: any) => !s.endTime && (!s.durationSeconds || s.durationSeconds === null)
    );
    if (active) {
      const err: any = new Error('User has an active session');
      err.code = 'ACTIVE_SESSION_EXISTS';
      err.status = 409;
      throw err;
    }

    const startTime = new Date().toISOString();
    const s = await createSession({
      userId,
      projectId: projectId || null,
      taskId: taskId || null,
      startTime,
      meta: { pauseCount: 0, resumeCount: 0 },
    });
    // Track session for idle detection
    idleDetector.trackSession(s.id, userId);
    return s;
  }

  async pause(sessionId: string, userId: string) {
    const session = await findSessionById(sessionId);
    if (!session) {
      const err: any = new Error('Session not found');
      err.status = 404;
      throw err;
    }
    if (session.userId !== userId) {
      const err: any = new Error('Permission denied');
      err.status = 403;
      throw err;
    }

    // current state detection: ACTIVE when endTime null and no paused flag; PAUSED when metadata indicates paused
    const isActive =
      !session.endTime && (!session.durationSeconds || session.durationSeconds === null);
    const isPaused = !!session.meta?.paused;
    if (!isActive) {
      const err: any = new Error('Session is not active');
      err.status = 400;
      throw err;
    }

    // mark pause in meta and set duration so far
    const now = new Date().toISOString();
    const durationSoFar = session.startTime
      ? Math.floor((new Date(now).getTime() - new Date(session.startTime).getTime()) / 1000)
      : 0;
    const updated = await updateSession(sessionId, {
      meta: {
        ...(session.meta || {}),
        paused: true,
        pausedAt: now,
        pauseCount: (session.meta?.pauseCount || 0) + 1,
      },
      durationSeconds: durationSoFar,
    });
    // Update activity timestamp on pause
    idleDetector.updateActivity(sessionId);
    return updated;
  }

  async resume(sessionId: string, userId: string) {
    const session = await findSessionById(sessionId);
    if (!session) {
      const err: any = new Error('Session not found');
      err.status = 404;
      throw err;
    }
    if (session.userId !== userId) {
      const err: any = new Error('Permission denied');
      err.status = 403;
      throw err;
    }

    const isPaused = !!session.meta?.paused;
    if (!isPaused) {
      const err: any = new Error('Session is not paused');
      err.status = 400;
      throw err;
    }

    // resume by clearing paused meta and adjusting startTime to continue counting
    const pausedAt = session.meta?.pausedAt ? new Date(session.meta.pausedAt) : null;
    const now = new Date();
    // keep original startTime but track resume count in meta
    const newMeta = { ...(session.meta || {}) };
    delete newMeta.paused;
    delete newMeta.pausedAt;
    newMeta.lastResumedAt = now.toISOString();
    newMeta.resumeCount = (session.meta?.resumeCount || 0) + 1;

    const updated = await updateSession(sessionId, { meta: newMeta });
    // Update activity timestamp on resume
    idleDetector.updateActivity(sessionId);
    return updated;
  }

  async end(sessionId: string, userId: string) {
    const session = await findSessionById(sessionId);
    if (!session) {
      const err: any = new Error('Session not found');
      err.status = 404;
      throw err;
    }
    if (session.userId !== userId) {
      const err: any = new Error('Permission denied');
      err.status = 403;
      throw err;
    }

    if (session.endTime) {
      const err: any = new Error('Session already ended');
      err.status = 400;
      throw err;
    }

    // compute final duration
    const now = new Date().toISOString();
    const start = new Date(session.startTime).getTime();
    let duration = Math.floor((new Date(now).getTime() - start) / 1000);
    // if durationSeconds already present (paused duration), add it
    if (session.durationSeconds) duration += session.durationSeconds;

    const updated = await updateSession(sessionId, {
      endTime: now,
      durationSeconds: duration,
      meta: { ...(session.meta || {}), endedAt: now },
    });
    // Untrack session from idle detection
    idleDetector.untrackSession(sessionId);
    return updated;
  }
}

export default new SessionEngine();

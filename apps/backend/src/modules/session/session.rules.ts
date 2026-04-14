import { findSessionsByUser, findSessionById } from '../../database/models/WorkSession.model';
import { getEffectiveRules } from '../../database/models/CustomTenantRules.model';
import logger from '@utils/logger';

// Fallback defaults (if CustomTenantRules lookup fails)
const DEFAULT_MIN_SESSION_SECONDS = Number(process.env.MIN_SESSION_SECONDS || 300); // 5 minutes
const DEFAULT_MAX_DAILY_HOURS = Number(process.env.MAX_DAILY_HOURS || 8); // 8 hours
const DEFAULT_OVERTIME_THRESHOLD_HOURS = Number(process.env.OVERTIME_THRESHOLD_HOURS || 8); // Threshold

/**
 * Get effective session validation rules for a user's organization.
 * Retrieves custom rules if exist, otherwise returns system defaults.
 */
async function getSessionRulesForUser(userId: string, organizationId?: string) {
  try {
    // If organizationId not provided, would need to fetch user org
    // For now, we require organizationId to be passed by caller
    if (!organizationId) {
      logger.debug('No organizationId provided, using defaults', { userId });
      return {
        minSessionLength: DEFAULT_MIN_SESSION_SECONDS,
        maxDailyHours: DEFAULT_MAX_DAILY_HOURS,
        overtimeThreshold: DEFAULT_OVERTIME_THRESHOLD_HOURS,
      };
    }

    const rules = await getEffectiveRules(organizationId);
    return {
      minSessionLength: rules.minSessionLength,
      maxDailyHours: rules.maxDailyHours,
      overtimeThreshold: rules.overtimeThreshold,
    };
  } catch (err: any) {
    logger.error('Failed to load session rules, using defaults', {
      userId,
      organizationId,
      error: err?.message,
    });
    return {
      minSessionLength: DEFAULT_MIN_SESSION_SECONDS,
      maxDailyHours: DEFAULT_MAX_DAILY_HOURS,
      overtimeThreshold: DEFAULT_OVERTIME_THRESHOLD_HOURS,
    };
  }
}

export const hasActiveSession = async (userId: string) => {
  const sessions = await findSessionsByUser(userId);
  return sessions.some(
    (s: any) => !s.endTime && (!s.durationSeconds || s.durationSeconds === null)
  );
};

export const validateStart = async (userId: string) => {
  if (await hasActiveSession(userId)) {
    const err: any = new Error('User already has an active session');
    err.code = 'ACTIVE_SESSION_EXISTS';
    err.status = 409;
    throw err;
  }
};

export const validatePause = async (sessionId: string, userId: string) => {
  const s = await findSessionById(sessionId);
  if (!s) {
    const err: any = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  if (s.userId !== userId) {
    const err: any = new Error('Permission denied');
    err.status = 403;
    throw err;
  }
  if (s.endTime) {
    const err: any = new Error('Session already ended');
    err.status = 400;
    throw err;
  }
};

export const validateEnd = async (sessionId: string, userId: string) => {
  const s = await findSessionById(sessionId);
  if (!s) {
    const err: any = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  if (s.userId !== userId) {
    const err: any = new Error('Permission denied');
    err.status = 403;
    throw err;
  }
  if (s.endTime) {
    const err: any = new Error('Session already ended');
    err.status = 400;
    throw err;
  }
};

/**
 * Check if session meets minimum duration requirement.
 * Uses organization-specific rules if available, otherwise system defaults.
 *
 * @param sessionId Session to validate
 * @param organizationId Organization (tenant) ID
 * @returns { valid: boolean; message?: string; durationSeconds: number }
 */
export const validateMinimumSessionLength = async (sessionId: string, organizationId?: string) => {
  const session = await findSessionById(sessionId);
  if (!session) {
    return { valid: false, message: 'Session not found', durationSeconds: 0 };
  }

  if (!session.endTime) {
    return { valid: false, message: 'Session has not ended', durationSeconds: 0 };
  }

  const rules = await getSessionRulesForUser(session.userId, organizationId);
  const durationSeconds = session.durationSeconds || 0;
  const meetsMinimum = durationSeconds >= rules.minSessionLength;

  return {
    valid: meetsMinimum,
    message: meetsMinimum
      ? undefined
      : `Session duration (${durationSeconds}s) is below minimum (${rules.minSessionLength}s)`,
    durationSeconds,
  };
};

/**
 * Calculate total session time for a user in a given day (UTC)
 * @param userId User ID
 * @param date Date to calculate for (defaults to today)
 * @returns Total duration in seconds
 */
export const calculateDailySessionTime = async (userId: string, date?: Date): Promise<number> => {
  const targetDate = date || new Date();
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const sessions = await findSessionsByUser(userId);

  // Filter sessions that occurred on this day (ended within the day)
  const daySessions = sessions.filter((s: any) => {
    if (!s.endTime) return false; // Only count ended sessions
    const endTime = new Date(s.endTime);
    return endTime >= dayStart && endTime <= dayEnd;
  });

  // Sum up all duration seconds
  return daySessions.reduce((total: number, s: any) => total + (s.durationSeconds || 0), 0);
};

/**
 * Check if user has exceeded maximum daily hours.
 * Uses organization-specific rules if available, otherwise system defaults.
 *
 * @param userId User ID
 * @param organizationId Organization (tenant) ID
 * @param date Date to check (defaults to today)
 * @returns { exceeded: boolean; totalSeconds: number; maxSeconds: number; message?: string }
 */
export const checkDailyHourLimit = async (userId: string, organizationId?: string, date?: Date) => {
  const rules = await getSessionRulesForUser(userId, organizationId);
  const totalSeconds = await calculateDailySessionTime(userId, date);
  const maxSeconds = rules.maxDailyHours * 3600;
  const exceeded = totalSeconds > maxSeconds;

  return {
    exceeded,
    totalSeconds,
    maxSeconds,
    totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
    maxHours: rules.maxDailyHours,
    message: exceeded
      ? `Daily limit exceeded: ${Math.round((totalSeconds / 3600) * 100) / 100}h / ${rules.maxDailyHours}h`
      : undefined,
  };
};

/**
 * Check if user is in overtime (exceeded threshold).
 * Uses organization-specific rules if available, otherwise system defaults.
 *
 * @param userId User ID
 * @param organizationId Organization (tenant) ID
 * @param date Date to check (defaults to today)
 * @returns { inOvertime: boolean; totalSeconds: number; overtimeSeconds: number; message?: string }
 */
export const checkOvertime = async (userId: string, organizationId?: string, date?: Date) => {
  const rules = await getSessionRulesForUser(userId, organizationId);
  const totalSeconds = await calculateDailySessionTime(userId, date);
  const thresholdSeconds = rules.overtimeThreshold * 3600;
  const inOvertime = totalSeconds > thresholdSeconds;
  const overtimeSeconds = Math.max(0, totalSeconds - thresholdSeconds);

  return {
    inOvertime,
    totalSeconds,
    overtimeSeconds,
    overtimeHours: Math.round((overtimeSeconds / 3600) * 100) / 100,
    thresholdSeconds,
    thresholdHours: rules.overtimeThreshold,
    message: inOvertime
      ? `Overtime: ${Math.round((overtimeSeconds / 3600) * 100) / 100}h of overtime`
      : undefined,
  };
};

/**
 * Add overtime flag to session metadata if applicable.
 * Uses organization-specific rules if available, otherwise system defaults.
 *
 * @param sessionId Session ID
 * @param userId User ID
 * @param organizationId Organization (tenant) ID
 * @returns Updated session with overtime flag if applicable
 */
export const flagOvertimeIfNeeded = async (
  sessionId: string,
  userId: string,
  organizationId?: string
) => {
  const session = await findSessionById(sessionId);
  if (!session) return null;

  const dailyCheck = await checkDailyHourLimit(userId, organizationId);
  const overtimeCheck = await checkOvertime(userId, organizationId);

  if (dailyCheck.exceeded || overtimeCheck.inOvertime) {
    const meta = session.meta || {};
    meta.flaggedForOvertime = true;
    meta.flaggedAt = new Date().toISOString();
    meta.dailyTotal = dailyCheck.totalSeconds;
    meta.overtimeHours = overtimeCheck.overtimeHours;

    // Update session with overtime metadata
    return {
      ...session,
      meta,
    };
  }

  return session;
};

export default {
  hasActiveSession,
  validateStart,
  validatePause,
  validateEnd,
  validateMinimumSessionLength,
  calculateDailySessionTime,
  checkDailyHourLimit,
  checkOvertime,
  flagOvertimeIfNeeded,
};

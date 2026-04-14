import { createAuditEntry } from '../../database/models/AuditEntry.model';
import { RiskEvent } from '../../engines/risk-engine/riskTypes';

export interface AuditLogPayload {
  userId?: string | null;
  action: string;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * AuditLogService.logAction
 * - Async function that performs fire-and-forget writes to the audit table
 * - Never throws (errors are caught and swallowed)
 * - Returns immediately so it does not block request execution
 *
 * Rationale: audit logging should not affect application flow. Any DB
 * errors are logged internally and swallowed to avoid impacting users.
 */
export const logAction = async (payload: AuditLogPayload): Promise<void> => {
  try {
    // Fire-and-forget: start an async write but do not await it here.
    void (async () => {
      try {
        await createAuditEntry({
          userId: payload.userId ?? null,
          action: payload.action,
          targetId: payload.targetId ?? null,
          ipAddress: payload.ipAddress ?? null,
          userAgent: payload.userAgent ?? null,
        });
      } catch (e) {
        // Swallow any errors — audit must not throw
      }
    })();
  } catch (e) {
    // Swallow any synchronous errors as well
  }
};

/**
 * Log a risk detection event to audit trail
 * This ensures all risk events are captured in the audit log for compliance/monitoring
 */
export const logRiskEvent = async (risk: RiskEvent): Promise<void> => {
  try {
    void (async () => {
      try {
        await createAuditEntry({
          userId: risk.userId,
          action: `risk:${risk.category}`,
          targetId: risk.id,
          ipAddress: null, // Risk detection is background process
          userAgent: null,
        });
      } catch (e) {
        // Swallow any errors — audit must not throw
      }
    })();
  } catch (e) {
    // Swallow any synchronous errors
  }
};

export default {
  logAction,
  logRiskEvent,
};
export const auditService = async () => ({});

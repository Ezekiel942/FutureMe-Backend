/**
 * Risk Event Types & Enum
 * Categorizes all detectable risk/anomaly conditions
 */

// Re-export enums and model from the database
export {
  RiskEventType,
  RiskSeverity,
  RiskCategory,
  RiskEvent,
} from '../../database/models/RiskEvent.model';

// Import enums for use in DetectedRisk interface
import { RiskEventType, RiskSeverity, RiskCategory } from '../../database/models/RiskEvent.model';

/**
 * Detected Risk - simplified structure returned by detection engine
 */
export interface DetectedRisk {
  userId: string;
  organizationId?: string;
  riskType: RiskEventType;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  metadata: any;
  detectedAt: Date;
  isActive: boolean;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
}

/**
 * Detection Rule Thresholds
 */
export const RISK_THRESHOLDS = {
  // Burnout
  BURNOUT_CRITICAL_HOURS: 12, // >12h in period
  BURNOUT_WARNING_HOURS: 10, // >10h in period
  LATE_NIGHT_THRESHOLD_HOUR: 22, // Sessions after 10 PM
  EARLY_MORNING_THRESHOLD_HOUR: 6, // Sessions before 6 AM

  // Scope Creep
  SCOPE_CREEP_THRESHOLD: 1.3, // 30% above historical average
  SCOPE_CREEP_HISTORY_DAYS: 14, // Use last 14 days for baseline

  // Ghosting (active session but no actual work)
  GHOSTING_SESSION_THRESHOLD_MIN: 5, // Session >5 min old
  GHOSTING_ACTIVITY_CHECK_INTERVAL_SEC: 300, // Check every 5 min

  // Excessive Overtime
  OVERTIME_DAILY_THRESHOLD: 10, // >10h in a day
  OVERTIME_WEEKLY_THRESHOLD: 50, // >50h in a week

  // Fragmentation
  FRAGMENTATION_SESSION_COUNT: 15, // >15 sessions
  FRAGMENTATION_AVG_DURATION_MIN: 15, // Avg <15 min

  // Inconsistency
  INCONSISTENCY_CV_THRESHOLD: 0.4, // Coefficient of Variation > 0.4

  // Underutilization
  UNDERUTILIZATION_HOURS: 1, // <1h with sessions present

  // Off-Hours Work
  OFF_HOURS_START: 18, // After 6 PM
  OFF_HOURS_END: 8, // Before 8 AM
};

export interface RiskSummary {
  userId: string;
  organizationId?: string;
  period: 'daily' | 'weekly' | 'monthly';
  totalRisks: number;
  risksByCategory: Record<string, number>;
  risksBySeverity: Record<string, number>;
  activeRisks: any[];
  resolvedRisks: any[];
  riskScore: number; // 0-100 (0=no risk, 100=critical)
  recommendations: string[];
}

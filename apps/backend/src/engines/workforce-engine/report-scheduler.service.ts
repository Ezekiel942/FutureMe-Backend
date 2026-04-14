export interface ReportSchedulerOptions {
  daily?: boolean;
  weekly?: boolean;
  monthly?: boolean;
  dailyTime?: string;
  weeklyDay?: number;
  weeklyTime?: string;
  monthlyDay?: number;
  monthlyTime?: string;
}

/**
 * Initialize report scheduling.
 *
 * This is a lightweight stub that avoids runtime errors when the server imports the
 * scheduler module. In the future, it can be enhanced to run periodic tasks (e.g.,
 * generating analytics reports or kicking off background jobs).
 */
export const initializeReportScheduling = (_opts: ReportSchedulerOptions) => {
  // No-op scheduler (safe default)
  return () => {
    // no cleanup needed
  };
};

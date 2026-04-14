import { AppDataSource } from '@config/database';
import { isAIResponse } from '@infrastructure/ai/openai';
import { WorkSession } from '../../database/models/WorkSession.model';
import { User } from '../../database/models/User.model';
import * as BillingService from '../../modules/billing/billing.service';

function periodStartIso(period: 'daily' | 'weekly' | 'monthly') {
  const now = new Date();
  if (period === 'daily') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.toISOString();
  }
  if (period === 'weekly') {
    const day = now.getDay();
    const diff = now.getDate() - day;
    const d = new Date(now.getFullYear(), now.getMonth(), diff);
    return d.toISOString();
  }
  // monthly
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d.toISOString();
}

export const getUtilizationMetrics = async (
  organizationId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'monthly'
) => {
  const startIso = periodStartIso(period);

  // total tracked seconds for organization in period (single aggregate query)
  const totalRow: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2',
    [organizationId, startIso]
  );
  const totalSeconds = Number(totalRow[0]?.total_seconds || 0);

  // per-user totals (grouped) - avoids N+1
  const perUser: any[] = await AppDataSource.query(
    'SELECT user_id, COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 GROUP BY user_id',
    [organizationId, startIso]
  );

  // team size (active users)
  const usersRow: any[] = await AppDataSource.query(
    'SELECT COUNT(*) AS cnt FROM users WHERE organization_id = $1 AND deleted_at IS NULL',
    [organizationId]
  );
  const teamCount = Number(usersRow[0]?.cnt || 0) || 1;

  // available seconds (approx 8h per workday * days in period)
  const now = new Date();
  const start = new Date(startIso);
  const days = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const availableSeconds = teamCount * days * 8 * 3600;

  const utilizationPercent = availableSeconds === 0 ? 0 : (totalSeconds / availableSeconds) * 100;

  return {
    organizationId,
    period,
    totalSeconds,
    totalHours: totalSeconds / 3600,
    perUser: perUser.map((r: any) => ({
      userId: r.user_id,
      totalSeconds: Number(r.total_seconds || 0),
      totalHours: Number(r.total_seconds || 0) / 3600,
    })),
    teamCount,
    availableHours: availableSeconds / 3600,
    utilizationPercent: Number(utilizationPercent.toFixed(2)),
  };
};

export const getFinancialMetrics = async (
  organizationId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'monthly',
  overrideCostPerHour?: number
) => {
  const startIso = periodStartIso(period);

  // per-project totals
  const perProject: any[] = await AppDataSource.query(
    'SELECT project_id, COALESCE(SUM(duration_seconds),0) AS total_seconds, COUNT(*) AS session_count FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 GROUP BY project_id',
    [organizationId, startIso]
  );

  // determine cost per hour fallback from subscription plan if available
  let fallbackRate: number | null = null;
  try {
    const subs = await BillingService.getSubscriptionsByOrg(organizationId);
    const active = subs && subs.length ? subs[0] : null;
    if (active) {
      const details = BillingService.getPlanDetails(active.plan);
      if (details && details.monthlyRate && details.teamMembers && details.teamMembers > 0) {
        // rough per-user-per-hour estimate: monthlyRate / (teamMembers * 160)
        fallbackRate = details.monthlyRate / (details.teamMembers * 160);
      }
    }
  } catch (e) {
    // ignore and leave fallbackRate null
  }

  const costPerHour = overrideCostPerHour ?? fallbackRate ?? null;

  const projects = perProject.map((r: any) => {
    const secs = Number(r.total_seconds || 0);
    const hours = secs / 3600;
    const cost = costPerHour == null ? null : Number((hours * costPerHour).toFixed(2));
    return {
      projectId: r.project_id,
      totalSeconds: secs,
      totalHours: hours,
      estimatedCost: cost,
      sessionCount: Number(r.session_count || 0),
    };
  });

  const orgTotalSeconds = projects.reduce((s, p) => s + p.totalSeconds, 0);
  const orgTotalHours = orgTotalSeconds / 3600;
  const orgCost = costPerHour == null ? null : Number((orgTotalHours * costPerHour).toFixed(2));

  return {
    organizationId,
    period,
    costPerHour: costPerHour === null ? null : Number(costPerHour.toFixed(2)),
    projects,
    orgTotalHours,
    orgEstimatedCost: orgCost,
  };
};

export const getEfficiencyMetrics = async (
  organizationId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'monthly'
) => {
  // Compare current period total to previous period to compute MoM growth
  const now = new Date();
  const startIso = periodStartIso(period);

  // current
  const currRow: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2',
    [organizationId, startIso]
  );
  const currSeconds = Number(currRow[0]?.total_seconds || 0);

  // compute previous period start by subtracting same interval
  let prevStart: Date;
  if (period === 'monthly') {
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else if (period === 'weekly') {
    prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  } else {
    prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }

  const prevIso = prevStart.toISOString();
  const prevRow: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 AND start_time < $3',
    [organizationId, prevIso, startIso]
  );
  const prevSeconds = Number(prevRow[0]?.total_seconds || 0);

  const growthPercent =
    prevSeconds === 0 ? null : ((currSeconds - prevSeconds) / prevSeconds) * 100;

  // Burnout score: reuse risk heuristics by proxy — compute average overtime ratio
  const usersRow: any[] = await AppDataSource.query(
    'SELECT COUNT(*) AS cnt FROM users WHERE organization_id = $1 AND deleted_at IS NULL',
    [organizationId]
  );
  const teamCount = Number(usersRow[0]?.cnt || 0) || 1;

  // average hours per user in current period
  const avgHours = currSeconds / 3600 / teamCount;
  // naive burnout score: normalized 0-100 where >60h/week -> high
  // map avgHours (per period) to weekly equivalent and score
  const weeklyHoursEquivalent =
    period === 'weekly' ? avgHours : period === 'daily' ? avgHours * 7 : avgHours / 4.345;
  const burnoutScore = Math.min(
    100,
    Math.max(0, Math.round(((weeklyHoursEquivalent - 40) / 40) * 100))
  );

  return {
    organizationId,
    period,
    currentTotalHours: currSeconds / 3600,
    previousTotalHours: prevSeconds / 3600,
    growthPercent: growthPercent == null ? null : Number(growthPercent.toFixed(2)),
    averageHoursPerUser: Number(avgHours.toFixed(2)),
    estimatedBurnoutScore: burnoutScore, // 0-100
  };
};

/**
 * Daily productivity summary
 */
export const getProductivitySummary = async (organizationId: string, period: 'daily') => {
  const startIso = periodStartIso(period);

  // Total work hours
  const totalRow: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2',
    [organizationId, startIso]
  );
  const totalHours = Number(totalRow[0]?.total_seconds || 0) / 3600;

  // Idle % - assuming no idle tracking yet, set to 0
  const idlePercent = 0;

  // Projects touched
  const projectsRow: any[] = await AppDataSource.query(
    'SELECT COUNT(DISTINCT project_id) AS cnt FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 AND project_id IS NOT NULL',
    [organizationId, startIso]
  );
  const projectsTouched = Number(projectsRow[0]?.cnt || 0);

  // Risk events
  const risksRow: any[] = await AppDataSource.query(
    'SELECT COUNT(*) AS cnt FROM insights WHERE organization_id = $1 AND created_at >= $2 AND severity IN (\'critical\', \'warning\')',
    [organizationId, startIso]
  );
  const riskEvents = Number(risksRow[0]?.cnt || 0);

  // Efficiency score: based on hours worked vs 8h expected
  const expectedHours = 8;
  const efficiencyScore = Math.min(100, Math.round((totalHours / expectedHours) * 100));

  return {
    totalWorkHours: Number(totalHours.toFixed(2)),
    idlePercent,
    projectsTouched,
    riskEvents,
    efficiencyScore,
  };
};

/**
 * Weekly summary
 */
export const getWeeklySummary = async (organizationId: string) => {
  const startIso = periodStartIso('weekly');

  // Productivity trend % - compare to previous week
  const now = new Date();
  const prevWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const prevIso = prevWeekStart.toISOString();

  const currRow: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2',
    [organizationId, startIso]
  );
  const currSeconds = Number(currRow[0]?.total_seconds || 0);

  const prevRow: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 AND start_time < $3',
    [organizationId, prevIso, startIso]
  );
  const prevSeconds = Number(prevRow[0]?.total_seconds || 0);

  const productivityTrendPercent =
    prevSeconds === 0 ? null : ((currSeconds - prevSeconds) / prevSeconds) * 100;

  // Burnout risk trend - using average hours per user
  const usersRow: any[] = await AppDataSource.query(
    'SELECT COUNT(*) AS cnt FROM users WHERE organization_id = $1 AND deleted_at IS NULL',
    [organizationId]
  );
  const teamCount = Number(usersRow[0]?.cnt || 0) || 1;

  const avgHoursCurr = currSeconds / 3600 / teamCount;
  const avgHoursPrev = prevSeconds / 3600 / teamCount;
  const burnoutRiskTrend =
    avgHoursPrev === 0 ? null : ((avgHoursCurr - avgHoursPrev) / avgHoursPrev) * 100;

  // Most time-consuming tasks - assuming tasks are not linked yet, use projects
  const tasksRow: any[] = await AppDataSource.query(
    'SELECT project_id, COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 AND project_id IS NOT NULL GROUP BY project_id ORDER BY total_seconds DESC LIMIT 5',
    [organizationId, startIso]
  );
  const mostTimeConsumingTasks = tasksRow.map((row: any) => ({
    projectId: row.project_id,
    hours: Number((row.total_seconds / 3600).toFixed(2)),
  }));

  // Over-utilized users (>40h/week)
  const overUtilizedRow: any[] = await AppDataSource.query(
    'SELECT user_id, COALESCE(SUM(duration_seconds),0)/3600 AS hours FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 GROUP BY user_id HAVING SUM(duration_seconds)/3600 > 40',
    [organizationId, startIso]
  );
  const overUtilizedUsers = overUtilizedRow.length;

  // Under-utilized users (<20h/week)
  const underUtilizedRow: any[] = await AppDataSource.query(
    'SELECT user_id, COALESCE(SUM(duration_seconds),0)/3600 AS hours FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 GROUP BY user_id HAVING SUM(duration_seconds)/3600 < 20',
    [organizationId, startIso]
  );
  const underUtilizedUsers = underUtilizedRow.length;

  return {
    productivityTrendPercent:
      productivityTrendPercent == null ? null : Number(productivityTrendPercent.toFixed(2)),
    burnoutRiskTrend: burnoutRiskTrend == null ? null : Number(burnoutRiskTrend.toFixed(2)),
    mostTimeConsumingTasks,
    overUtilizedUsers,
    underUtilizedUsers,
  };
};

/**
 * Monthly executive report
 */
export const getMonthlyExecutiveReport = async (organizationId: string) => {
  const startIso = periodStartIso('monthly');

  // Cost per project - assuming no billing per project yet, set to 0 or estimate
  // Since billing exists, but per project not tracked, perhaps average cost
  const costPerProject = 0; // Placeholder

  // Cost per task - tasks not linked, placeholder
  const costPerTask = 0;

  // Utilization rate - total hours / available hours
  const totalRow: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2',
    [organizationId, startIso]
  );
  const totalHours = Number(totalRow[0]?.total_seconds || 0) / 3600;

  const usersRow: any[] = await AppDataSource.query(
    'SELECT COUNT(*) AS cnt FROM users WHERE organization_id = $1 AND deleted_at IS NULL',
    [organizationId]
  );
  const teamCount = Number(usersRow[0]?.cnt || 0) || 1;

  // Assuming 160h per month per user (40h/week * 4)
  const availableHours = teamCount * 160;
  const utilizationRate = availableHours === 0 ? 0 : (totalHours / availableHours) * 100;

  // Revenue estimation - if billing exists, sum subscription rates
  let revenueEstimation = 0;
  try {
    const subsRow: any[] = await AppDataSource.query(
      'SELECT COALESCE(SUM(monthly_rate),0) AS revenue FROM subscriptions WHERE organization_id = $1',
      [organizationId]
    );
    revenueEstimation = Number(subsRow[0]?.revenue || 0);
  } catch (err) {
    // If no subscriptions table or error, set to 0
  }

  // Team growth trend - compare user count to previous month
  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevIso = prevMonthStart.toISOString();

  const currUsers = teamCount;
  const prevUsersRow: any[] = await AppDataSource.query(
    'SELECT COUNT(*) AS cnt FROM users WHERE organization_id = $1 AND deleted_at IS NULL AND created_at < $2',
    [organizationId, startIso]
  );
  const prevUsers = Number(prevUsersRow[0]?.cnt || 0);
  const teamGrowthTrend = prevUsers === 0 ? null : ((currUsers - prevUsers) / prevUsers) * 100;

  // Risk index - count risk insights
  const risksRow: any[] = await AppDataSource.query(
    'SELECT COUNT(*) AS cnt FROM insights WHERE organization_id = $1 AND created_at >= $2 AND severity IN (\'critical\', \'warning\')',
    [organizationId, startIso]
  );
  const riskIndex = Number(risksRow[0]?.cnt || 0);

  return {
    costPerProject: Number(costPerProject.toFixed(2)),
    costPerTask: Number(costPerTask.toFixed(2)),
    utilizationRate: Number(utilizationRate.toFixed(2)),
    revenueEstimation: Number(revenueEstimation.toFixed(2)),
    teamGrowthTrend: teamGrowthTrend == null ? null : Number(teamGrowthTrend.toFixed(2)),
    riskIndex,
  };
};

/**
 * AI-Powered: Executive Summary Generator
 * Generates natural language executive report from monthly data
 */
export const getAIExecutiveSummary = async (organizationId: string) => {
  try {
    const monthlySummary = await getMonthlyExecutiveReport(organizationId);

    // Get additional context for AI
    const tasksRow: any[] = await AppDataSource.query(
      'SELECT project_id, COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 GROUP BY project_id ORDER BY total_seconds DESC LIMIT 5',
      [organizationId, new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()]
    );
    const mostTimeConsumingTasks = tasksRow.map((row: any) => ({
      projectId: row.project_id,
      hours: Number((row.total_seconds / 3600).toFixed(2)),
    }));

    // Get productivity trend
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthIso = prevMonthStart.toISOString();
    const currMonthIso = currMonthStart.toISOString();

    const currRow: any[] = await AppDataSource.query(
      'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2',
      [organizationId, currMonthIso]
    );
    const currSeconds = Number(currRow[0]?.total_seconds || 0);

    const prevRow: any[] = await AppDataSource.query(
      'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 AND start_time < $3',
      [organizationId, prevMonthIso, currMonthIso]
    );
    const prevSeconds = Number(prevRow[0]?.total_seconds || 0);

    const productivityTrendPercent =
      prevSeconds === 0 ? null : ((currSeconds - prevSeconds) / prevSeconds) * 100;

    const aiClient = (await import('@infrastructure/ai/openai')).default;

    if (!aiClient.isAvailable()) {
      // Return basic summary without AI
      return {
        success: true,
        aiEnabled: false,
        summary: monthlySummary,
      };
    }

    const aiResult = await aiClient.generateExecutiveSummary({
      totalWorkHours: monthlySummary.costPerProject || 0,
      utilizationRate: monthlySummary.utilizationRate,
      teamCount: 1, // Will be calculated from users count
      costPerProject: monthlySummary.costPerProject,
      revenueEstimation: monthlySummary.revenueEstimation,
      teamGrowthTrend: monthlySummary.teamGrowthTrend,
      riskIndex: monthlySummary.riskIndex,
      mostTimeConsumingTasks,
      productivityTrendPercent,
    });

    const summaryData = isAIResponse(aiResult) ? aiResult.data : null;

    return {
      success: isAIResponse(aiResult) ? aiResult.success : false,
      aiEnabled: true,
      executiveSummary: summaryData,
      metrics: monthlySummary,
    };
  } catch (err: any) {
    // Fallback to regular summary
    const monthlySummary = await getMonthlyExecutiveReport(organizationId);
    return {
      success: true,
      aiEnabled: false,
      summary: monthlySummary,
      error: err?.message,
    };
  }
};

/**
 * AI-Powered: Burnout Risk Analysis
 * Combines session patterns, late work, idle time, overtime for burnout assessment
 */
export const getAIBurnoutAnalysis = async (userId: string, organizationId: string) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartIso = monthStart.toISOString();

    // Get user sessions for this month
    const sessionsRow: any[] = await AppDataSource.query(
      'SELECT * FROM work_sessions WHERE user_id = $1 AND start_time >= $2 ORDER BY start_time DESC',
      [userId, monthStartIso]
    );

    if (sessionsRow.length === 0) {
      return {
        success: true,
        message: 'No session data available for analysis',
        aiEnabled: false,
      };
    }

    // Calculate metrics
    const totalSeconds = sessionsRow.reduce(
      (sum: number, s: any) => sum + (s.duration_seconds || 0),
      0
    );
    const totalHours = totalSeconds / 3600;
    const avgHoursPerDay =
      totalHours /
      Math.max(1, new Set(sessionsRow.map((s: any) => new Date(s.start_time).toDateString())).size);

    // Late night sessions (after 9 PM)
    const lateNightSessions = sessionsRow.filter((s: any) => {
      const hour = new Date(s.start_time).getHours();
      return hour >= 21 || hour < 6;
    }).length;

    // Overtime hours (>40h/week)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartIso = weekStart.toISOString();
    const weekRow: any[] = await AppDataSource.query(
      'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE user_id = $1 AND start_time >= $2',
      [userId, weekStartIso]
    );
    const weekSeconds = Number(weekRow[0]?.total_seconds || 0);
    const weekHours = weekSeconds / 3600;
    const overtimeHours = Math.max(0, weekHours - 40);

    // Consecutive high-load days (>8h)
    const dayHours = new Map<string, number>();
    sessionsRow.forEach((s: any) => {
      const dateStr = new Date(s.start_time).toDateString();
      dayHours.set(dateStr, (dayHours.get(dateStr) || 0) + (s.duration_seconds || 0) / 3600);
    });
    let consecutiveHighLoadDays = 0;
    let currentStreak = 0;
    const sortedDates = Array.from(dayHours.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
    for (const [_, hours] of sortedDates) {
      if (hours > 8) {
        currentStreak++;
        consecutiveHighLoadDays = Math.max(consecutiveHighLoadDays, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const aiClient = (await import('@infrastructure/ai/openai')).default;

    if (!aiClient.isAvailable()) {
      // Return basic analysis without AI
      return {
        success: true,
        aiEnabled: false,
        userId,
        month: monthStart.toISOString().substring(0, 7),
        metrics: {
          totalHoursThisMonth: Number(totalHours.toFixed(2)),
          averageHoursPerDay: Number(avgHoursPerDay.toFixed(2)),
          lateNightSessions,
          overtimeHours: Number(overtimeHours.toFixed(2)),
          consecutiveHighLoadDays,
        },
      };
    }

    const aiResult = await aiClient.analyzeBurnoutRisk({
      userId,
      totalHoursThisMonth: totalHours,
      averageHoursPerDay: avgHoursPerDay,
      lateNightSessions,
      sessionCount: sessionsRow.length,
      averageSessionLength: totalSeconds / Math.max(1, sessionsRow.length) / 60,
      overtimeHours,
      consecutiveHighLoadDays,
    });

    const analysisData = isAIResponse(aiResult) ? aiResult.data : null;

    return {
      success: isAIResponse(aiResult) ? aiResult.success : false,
      aiEnabled: true,
      userId,
      month: monthStart.toISOString().substring(0, 7),
      metrics: {
        totalHoursThisMonth: Number(totalHours.toFixed(2)),
        averageHoursPerDay: Number(avgHoursPerDay.toFixed(2)),
        lateNightSessions,
        overtimeHours: Number(overtimeHours.toFixed(2)),
        consecutiveHighLoadDays,
      },
      analysis: analysisData,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message,
      aiEnabled: false,
    };
  }
};

/**
 * AI-Powered: Scope Creep & Project Risk Analysis
 * Compares historical task duration to current project velocity
 */
export const getAIScopeCreepAnalysis = async (projectId: string, organizationId: string) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartIso = monthStart.toISOString();

    // Get current month sessions for this project
    const currentSessions: any[] = await AppDataSource.query(
      'SELECT duration_seconds FROM work_sessions WHERE project_id = $1 AND organization_id = $2 AND start_time >= $3',
      [projectId, organizationId, monthStartIso]
    );

    if (currentSessions.length === 0) {
      return {
        success: true,
        message: 'No project activity in current period',
        aiEnabled: false,
      };
    }

    const currentSeconds = currentSessions.reduce(
      (sum: number, s: any) => sum + (s.duration_seconds || 0),
      0
    );
    const currentHours = currentSeconds / 3600;

    // Get historical data (previous 3 months, excluding current month)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const threeMonthsAgoIso = threeMonthsAgo.toISOString();

    const historicalSessions: any[] = await AppDataSource.query(
      'SELECT duration_seconds FROM work_sessions WHERE project_id = $1 AND organization_id = $2 AND start_time >= $3 AND start_time < $4',
      [projectId, organizationId, threeMonthsAgoIso, monthStartIso]
    );

    const historicalSeconds = historicalSessions.reduce(
      (sum: number, s: any) => sum + (s.duration_seconds || 0),
      0
    );
    const historicalHours = historicalSeconds / 3600;
    const historicalAverage = historicalSessions.length > 0 ? historicalHours / 3 : currentHours; // Average per month

    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();
    const currentVelocity = currentHours / Math.max(1, daysPassed);

    const aiClient = (await import('@infrastructure/ai/openai')).default;

    if (!aiClient.isAvailable()) {
      // Return basic analysis without AI
      return {
        success: true,
        aiEnabled: false,
        projectId,
        metrics: {
          currentHours: Number(currentHours.toFixed(2)),
          historicalAverageHours: Number(historicalAverage.toFixed(2)),
          currentVelocity: Number(currentVelocity.toFixed(2)),
          taskCount: currentSessions.length,
        },
      };
    }

    const aiResult = await aiClient.analyzeProjectRisk({
      projectId,
      projectName: undefined,
      historicalAverageDuration: historicalAverage,
      currentAccumulatedHours: currentHours,
      taskCount: currentSessions.length,
      currentPeriod: 'monthly',
      currentVelocity,
    });

    const analysisData = isAIResponse(aiResult) ? aiResult.data : null;

    return {
      success: isAIResponse(aiResult) ? aiResult.success : false,
      aiEnabled: true,
      projectId,
      month: monthStart.toISOString().substring(0, 7),
      metrics: {
        currentHours: Number(currentHours.toFixed(2)),
        historicalAverageHours: Number(historicalAverage.toFixed(2)),
        currentVelocity: Number(currentVelocity.toFixed(2)),
        taskCount: currentSessions.length,
      },
      analysis: analysisData,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message,
      aiEnabled: false,
    };
  }
};

/**
 * Deep Financial Analysis
 * Combines cost per feature, team utilization, and efficiency growth metrics
 */
export const getFinancialDeepAnalysis = async (
  organizationId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'monthly',
  costPerHourOverride?: number
) => {
  try {
    const startIso = periodStartIso(period);
    const now = new Date();

    // 1. Get utilization metrics
    const utilizationMetrics = await getUtilizationMetrics(organizationId, period);

    // 2. Get financial metrics (cost per project)
    const financialMetrics = await getFinancialMetrics(organizationId, period, costPerHourOverride);

    // 3. Get efficiency growth (current vs previous period)
    const efficiencyMetrics = await getEfficiencyMetrics(organizationId, period);

    // 4. Calculate Team Utilization Rate
    // Total productive time (in hours) / total available hours
    const teamUtilizationRate = utilizationMetrics.utilizationPercent;

    // 5. Cost per feature (mapped from projects)
    const costPerFeature = financialMetrics.projects.map((project: any) => ({
      featureId: project.projectId,
      hours: Number(project.totalHours.toFixed(2)),
      cost: project.estimatedCost,
      costPerHour: financialMetrics.costPerHour,
      sessions: project.sessionCount,
    }));

    // 6. Get monthly breakdown for efficiency growth trend
    // Current month
    const currMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const currMonthRow: any[] = await AppDataSource.query(
      'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2',
      [organizationId, currMonthStart]
    );
    const currMonthHours = Number(currMonthRow[0]?.total_seconds || 0) / 3600;

    // Previous month
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = currMonthStart;
    const prevMonthRow: any[] = await AppDataSource.query(
      'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 AND start_time < $3',
      [organizationId, prevMonthStart, prevMonthEnd]
    );
    const prevMonthHours = Number(prevMonthRow[0]?.total_seconds || 0) / 3600;

    // 2 months ago
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
    const twoMonthsRow: any[] = await AppDataSource.query(
      'SELECT COALESCE(SUM(duration_seconds),0) AS total_seconds FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 AND start_time < $3',
      [organizationId, twoMonthsAgoStart, prevMonthStart]
    );
    const twoMonthsAgoHours = Number(twoMonthsRow[0]?.total_seconds || 0) / 3600;

    // Calculate month-over-month growth percentages
    const momGrowth =
      prevMonthHours === 0 ? null : ((currMonthHours - prevMonthHours) / prevMonthHours) * 100;
    const prevMomGrowth =
      twoMonthsAgoHours === 0
        ? null
        : ((prevMonthHours - twoMonthsAgoHours) / twoMonthsAgoHours) * 100;

    // 7. Get top 10 projects by cost
    const topProjects = financialMetrics.projects
      .filter((p: any) => p.estimatedCost !== null && p.estimatedCost > 0)
      .sort((a: any, b: any) => (b.estimatedCost || 0) - (a.estimatedCost || 0))
      .slice(0, 10);

    // 8. Calculate team cost metrics
    const totalTeamCost = financialMetrics.orgEstimatedCost || 0;
    const costPerTeamMember =
      utilizationMetrics.teamCount > 0 ? totalTeamCost / utilizationMetrics.teamCount : 0;
    const costPerProductiveHour =
      financialMetrics.orgTotalHours > 0 ? totalTeamCost / financialMetrics.orgTotalHours : 0;

    return {
      organizationId,
      period,
      analysisDate: new Date().toISOString(),

      // Team utilization metrics
      teamUtilization: {
        utilizationRate: Number(teamUtilizationRate.toFixed(2)),
        totalProductiveHours: Number(utilizationMetrics.totalHours.toFixed(2)),
        totalAvailableHours: Number(utilizationMetrics.availableHours.toFixed(2)),
        teamSize: utilizationMetrics.teamCount,
      },

      // Financial metrics
      financialSummary: {
        totalProjectCost: Number(totalTeamCost.toFixed(2)),
        costPerTeamMember: Number(costPerTeamMember.toFixed(2)),
        costPerProductiveHour: Number(costPerProductiveHour.toFixed(2)),
        costPerHour: financialMetrics.costPerHour,
        currencyUnit: 'USD',
      },

      // Cost per feature (project breakdown)
      costPerFeature: costPerFeature.map((cf: any) => ({
        featureId: cf.featureId,
        hours: cf.hours,
        cost: cf.cost,
        costPerHour: cf.costPerHour,
      })),

      // Top projects by cost
      topProjects: topProjects.map((p: any) => ({
        projectId: p.projectId,
        hours: Number(p.totalHours.toFixed(2)),
        cost: p.estimatedCost,
        costPerHour: financialMetrics.costPerHour,
      })),

      // Efficiency growth trends
      efficiencyGrowth: {
        monthToMonthGrowthPercent: momGrowth === null ? null : Number(momGrowth.toFixed(2)),
        previousMoMGrowthPercent: prevMomGrowth === null ? null : Number(prevMomGrowth.toFixed(2)),
        currentMonthHours: Number(currMonthHours.toFixed(2)),
        previousMonthHours: Number(prevMonthHours.toFixed(2)),
        twoMonthsAgoHours: Number(twoMonthsAgoHours.toFixed(2)),
        trend:
          momGrowth === null
            ? 'unknown'
            : momGrowth > 0
              ? 'increasing'
              : momGrowth < 0
                ? 'decreasing'
                : 'stable',
      },

      // Summary metrics
      summary: {
        totalProjects: financialMetrics.projects.length,
        projectsWithCost: financialMetrics.projects.filter(
          (p) => p.estimatedCost && p.estimatedCost > 0
        ).length,
        averageCostPerProject:
          financialMetrics.projects.length > 0
            ? Number((totalTeamCost / financialMetrics.projects.length).toFixed(2))
            : 0,
        productivityTrend: efficiencyMetrics.estimatedBurnoutScore < 50 ? 'healthy' : 'at-risk',
      },
    };
  } catch (err: any) {
    throw new Error(`Failed to generate financial deep analysis: ${err?.message}`);
  }
};

/**
 * AI-Powered Recommendations Engine
 * Provides task reassignment, overtime prevention, and risk mitigation suggestions
 */
export const getAIRecommendations = async (
  organizationId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'weekly'
) => {
  try {
    const startIso = periodStartIso(period);

    // Gather comprehensive organization data for AI analysis
    const utilizationMetrics = await getUtilizationMetrics(organizationId, period);
    const financialMetrics = await getFinancialMetrics(organizationId, period);
    const efficiencyMetrics = await getEfficiencyMetrics(organizationId, period);

    // Get active risk events
    const riskEvents: any[] = await AppDataSource.query(
      'SELECT id, user_id, category, severity, description, detected_at FROM risk_events WHERE organization_id = $1 AND is_active = true AND detected_at >= $2 ORDER BY detected_at DESC LIMIT 50',
      [organizationId, startIso]
    );

    // Get user workloads for the period
    const userWorkloads: any[] = await AppDataSource.query(
      'SELECT user_id, COALESCE(SUM(duration_seconds),0)/3600 AS hours FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 GROUP BY user_id ORDER BY hours DESC',
      [organizationId, startIso]
    );

    // Get project statuses
    const projectStatuses: any[] = await AppDataSource.query(
      'SELECT project_id, COUNT(*) as session_count, COALESCE(SUM(duration_seconds),0)/3600 AS total_hours FROM work_sessions WHERE organization_id = $1 AND start_time >= $2 GROUP BY project_id ORDER BY total_hours DESC LIMIT 20',
      [organizationId, startIso]
    );

    const aiClient = (await import('@infrastructure/ai/openai')).default;

    const aiResult = await aiClient.generateRecommendations({
      organizationId,
      period,
      utilizationMetrics,
      financialMetrics,
      efficiencyMetrics,
      riskEvents,
      userWorkloads,
      projectStatuses,
    });

    const recommendationsData = isAIResponse(aiResult) ? aiResult.data : null;

    return {
      success: isAIResponse(aiResult) ? aiResult.success : false,
      aiEnabled: aiClient.isAvailable(),
      organizationId,
      period,
      analysisDate: new Date().toISOString(),
      recommendations: recommendationsData,
      dataSources: {
        utilizationMetrics,
        financialMetrics,
        efficiencyMetrics,
        riskEventsCount: riskEvents.length,
        userWorkloadsCount: userWorkloads.length,
        projectStatusesCount: projectStatuses.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message,
      aiEnabled: false,
      organizationId,
      period,
    };
  }
};

/**
 * AI-Powered: Personal Work Coach
 * Provides supportive productivity suggestions based on user's work patterns
 */
export const getAIWorkCoach = async (userId: string, organizationId: string) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of current week
    const weekStartIso = weekStart.toISOString();

    // Get user sessions for this week
    const sessionsRow: any[] = await AppDataSource.query(
      'SELECT * FROM work_sessions WHERE user_id = $1 AND organization_id = $2 AND start_time >= $3 ORDER BY start_time DESC',
      [userId, organizationId, weekStartIso]
    );

    if (sessionsRow.length === 0) {
      return {
        success: true,
        message: 'No session data available for coaching',
        aiEnabled: false,
      };
    }

    // Calculate user session metrics
    const totalSeconds = sessionsRow.reduce(
      (sum: number, s: any) => sum + (s.duration_seconds || 0),
      0
    );
    const totalHoursThisWeek = totalSeconds / 3600;

    // Average hours per day (unique days worked)
    const uniqueDays = new Set(sessionsRow.map((s: any) => new Date(s.start_time).toDateString()))
      .size;
    const averageHoursPerDay = totalHoursThisWeek / Math.max(1, uniqueDays);

    const sessionCount = sessionsRow.length;
    const averageSessionLength = totalSeconds / Math.max(1, sessionCount) / 60; // in minutes

    // Focus hours: assuming sessions > 30 minutes are focused work
    const focusHours =
      sessionsRow
        .filter((s: any) => (s.duration_seconds || 0) > 1800) // > 30 minutes
        .reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0) / 3600;

    // Task switches: estimated by session count (each session could be a task switch)
    const taskSwitches = sessionCount;

    // Break patterns: sessions with breaks (assuming sessions < 15 minutes are breaks)
    const breakPatterns = sessionsRow.filter((s: any) => (s.duration_seconds || 0) < 900).length; // < 15 minutes

    // Late night sessions (after 9 PM or before 6 AM)
    const lateNightSessions = sessionsRow.filter((s: any) => {
      const hour = new Date(s.start_time).getHours();
      return hour >= 21 || hour < 6;
    }).length;

    // Idle time: placeholder, assuming 10% of total time is idle
    const idleTime = (totalSeconds * 0.1) / 60; // in minutes

    const aiClient = (await import('@infrastructure/ai/openai')).default;

    if (!aiClient.isAvailable()) {
      // Return basic suggestions without AI
      return {
        success: true,
        aiEnabled: false,
        userId,
        week: weekStart.toISOString().substring(0, 10),
        metrics: {
          totalHoursThisWeek: Number(totalHoursThisWeek.toFixed(2)),
          averageHoursPerDay: Number(averageHoursPerDay.toFixed(2)),
          sessionCount,
          averageSessionLength: Number(averageSessionLength.toFixed(2)),
          focusHours: Number(focusHours.toFixed(2)),
          taskSwitches,
          breakPatterns,
          lateNightSessions,
          idleTime: Number(idleTime.toFixed(2)),
        },
      };
    }

    const aiResult = await aiClient.generateWorkCoachSuggestions({
      userId,
      totalHoursThisWeek,
      averageHoursPerDay,
      sessionCount,
      averageSessionLength,
      focusHours,
      taskSwitches,
      breakPatterns,
      lateNightSessions,
      idleTime,
    });

    const coachingData = isAIResponse(aiResult) ? aiResult.data : null;

    return {
      success: isAIResponse(aiResult) ? aiResult.success : false,
      aiEnabled: true,
      userId,
      week: weekStart.toISOString().substring(0, 10),
      metrics: {
        totalHoursThisWeek: Number(totalHoursThisWeek.toFixed(2)),
        averageHoursPerDay: Number(averageHoursPerDay.toFixed(2)),
        sessionCount,
        averageSessionLength: Number(averageSessionLength.toFixed(2)),
        focusHours: Number(focusHours.toFixed(2)),
        taskSwitches,
        breakPatterns,
        lateNightSessions,
        idleTime: Number(idleTime.toFixed(2)),
      },
      coaching: coachingData,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message,
      aiEnabled: false,
    };
  }
};

/**
 * AI-Powered Workforce Reassignment
 * Analyzes team workload and suggests optimal task redistribution
 */
export const getAIWorkforceReassignment = async (organizationId: string) => {
  try {
    // Get current team workload data
    const employees: any[] = await AppDataSource.query(
      'SELECT "userId", COALESCE(SUM("durationSeconds"),0)/3600 AS hours FROM work_sessions WHERE "organizationId" = $1 AND "startTime" >= $2 GROUP BY "userId"',
      [organizationId, periodStartIso('weekly')]
    );

    // Get user skills from SkillGraph
    const skillGraphService = (await import('../skill-graph/skillGraph.service')).default;

    // Build employee data structure with skills
    const employeeData = [];
    for (const workload of employees) {
      try {
        const userSkills = await skillGraphService.getUserSkills(workload.userId);
        const skillNames = userSkills.map((s: any) => s.skill);

        employeeData.push({
          userId: workload.userId,
          currentWorkload: Number(workload.hours),
          availability: 100, // Simplified - could be enhanced with calendar integration
          expertise: skillNames,
          assignedTasks: [], // Simplified - would need task assignment system
        });
      } catch (err) {
        // If skill data unavailable, continue without it
        employeeData.push({
          userId: workload.userId,
          currentWorkload: Number(workload.hours),
          availability: 100,
          expertise: [],
          assignedTasks: [],
        });
      }
    }

    const aiClient = (await import('@infrastructure/ai/openai')).default;

    const aiResult = await aiClient.generateWorkforceReassignment({
      organizationId,
      employees: employeeData,
      unassignedTasks: [], // Simplified - would need task management system
    });

    const reassignmentData = isAIResponse(aiResult) ? aiResult.data : null;

    return {
      success: isAIResponse(aiResult) ? aiResult.success : false,
      aiEnabled: aiClient.isAvailable(),
      organizationId,
      analysisDate: new Date().toISOString(),
      reassignment: reassignmentData,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message,
      aiEnabled: false,
    };
  }
};

export const getProjectRiskPrediction = async (projectId: string, organizationId: string) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartIso = monthStart.toISOString();

    // Get current project sessions
    const currentSessions: any[] = await AppDataSource.query(
      'SELECT "durationSeconds", "startTime" FROM work_sessions WHERE "projectId" = $1 AND "organizationId" = $2',
      [projectId, organizationId]
    );

    if (currentSessions.length === 0) {
      return {
        riskLevel: 'low',
        predictedDelayDays: 0,
        reasons: ['No project activity detected'],
        mitigationSteps: ['Start working on the project to establish baseline metrics'],
      };
    }

    const totalSeconds = currentSessions.reduce(
      (sum: number, s: any) => sum + (s.durationSeconds || 0),
      0
    );
    const totalHours = totalSeconds / 3600;

    // Calculate project age in days
    const firstSession = currentSessions.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )[0];
    const projectStart = new Date(firstSession.startTime);
    const projectAgeDays = Math.max(
      1,
      Math.ceil((now.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Get team utilization
    const teamUtilization = await getUtilizationMetrics(organizationId, 'monthly');

    // Get historical project velocities (average hours per day for completed projects)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const sixMonthsAgoIso = sixMonthsAgo.toISOString();

    const historicalProjects: any[] = await AppDataSource.query(
      'SELECT "projectId", COUNT(*) as session_count, SUM("durationSeconds") as total_seconds FROM work_sessions WHERE "organizationId" = $1 AND "startTime" >= $2 AND "projectId" IS NOT NULL GROUP BY "projectId"',
      [organizationId, sixMonthsAgoIso]
    );

    const velocities = historicalProjects
      .filter((p: any) => p.session_count > 5) // Only projects with meaningful activity
      .map((p: any) => {
        const hours = (p.total_seconds || 0) / 3600;
        // Assume projects take at least 5 days, max 90 days
        const estimatedDays = Math.max(5, Math.min(90, Math.ceil(hours / 8))); // 8 hours/day assumption
        return hours / estimatedDays;
      });

    const avgHistoricalVelocity =
      velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 8; // Default 8 hours/day

    // Current velocity
    const currentVelocity = totalHours / projectAgeDays;

    // Predict completion
    // Assume project needs 100 hours to complete (this is a heuristic - in real system would come from project definition)
    const estimatedTotalHours = Math.max(50, totalHours * 1.5); // Heuristic: current * 1.5, min 50
    const remainingHours = Math.max(0, estimatedTotalHours - totalHours);
    const estimatedDaysRemaining = remainingHours / Math.max(1, currentVelocity);

    // Risk assessment
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let predictedDelayDays = 0;
    const reasons: string[] = [];
    const mitigationSteps: string[] = [];

    // Check velocity vs historical
    const velocityRatio = currentVelocity / avgHistoricalVelocity;
    if (velocityRatio < 0.7) {
      riskLevel = 'high';
      predictedDelayDays = Math.ceil(estimatedDaysRemaining * 1.5);
      reasons.push('Project velocity is significantly below historical average');
      mitigationSteps.push('Increase team allocation or identify blockers');
    } else if (velocityRatio < 0.9) {
      riskLevel = 'medium';
      predictedDelayDays = Math.ceil(estimatedDaysRemaining * 1.2);
      reasons.push('Project velocity is below historical average');
      mitigationSteps.push('Monitor progress closely and consider resource adjustments');
    }

    // Check team utilization
    if (teamUtilization.utilizationPercent > 90) {
      if (riskLevel === 'low') riskLevel = 'medium';
      else if (riskLevel === 'medium') riskLevel = 'high';
      predictedDelayDays = Math.ceil(predictedDelayDays * 1.3);
      reasons.push('Team is over-utilized, risking burnout and delays');
      mitigationSteps.push('Consider hiring additional resources or redistributing workload');
    }

    // Check project age vs progress
    if (projectAgeDays > 30 && totalHours < 100) {
      riskLevel = 'high';
      predictedDelayDays = Math.max(predictedDelayDays, 30);
      reasons.push('Project has been active for over a month with limited progress');
      mitigationSteps.push('Review project scope and requirements');
    }

    return {
      riskLevel,
      predictedDelayDays,
      reasons,
      mitigationSteps,
    };
  } catch (error) {
    console.error('Error in project risk prediction:', error);
    return {
      riskLevel: 'high',
      predictedDelayDays: 30,
      reasons: ['Unable to analyze project data'],
      mitigationSteps: ['Review project manually and consult with team'],
    };
  }
};

export const getAIExecutiveReport = async (
  organizationId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'monthly'
) => {
  try {
    // Gather raw productivity data
    const utilization = await getUtilizationMetrics(organizationId, period);
    const efficiency = await getEfficiencyMetrics(organizationId, period);

    // Calculate productivity score (0-100 based on utilization and efficiency)
    const productivityScore = Math.min(
      100,
      Math.max(
        0,
        utilization.utilizationPercent * 0.4 + (100 - efficiency.estimatedBurnoutScore) * 0.6
      )
    );

    // Get project risk data
    const projectRisk = await getProjectRiskPrediction('dummy-project-id', organizationId); // This would need actual project IDs

    // Get burnout risk users count
    const burnoutRiskUsers = 0; // TODO: Implement org-level burnout analysis

    const inputData = {
      teamHours: utilization.totalHours,
      productivityScore: Math.round(productivityScore),
      burnoutRiskUsers,
      projectRisk: projectRisk.riskLevel,
      utilizationRate: utilization.utilizationPercent,
    };

    // Use AI to generate executive report
    const aiClient = (await import('@infrastructure/ai/openai')).default;

    if (!aiClient.isAvailable()) {
      // Fallback to rule-based analysis
      return generateRuleBasedExecutiveReport(inputData);
    }

    const prompt = `You are an enterprise workforce analytics assistant.

Your job is to convert raw productivity data into a concise executive report.

Rules:
- Use professional business language
- Identify risks and opportunities
- Do not invent data
- Provide clear insights and recommendations
- Focus on productivity trends, workload balance, burnout risk, and project delivery risk.

INPUT DATA:
${JSON.stringify(inputData, null, 2)}

OUTPUT FORMAT:
{
  "summary": "",
  "keyInsights": [],
  "risks": [],
  "recommendations": []
}`;

    const aiResponse = await aiClient.generateCompletion(prompt, {
      maxTokens: 800,
      temperature: 0.3,
    });

    try {
      const report = JSON.parse(aiResponse.data);
      return {
        success: true,
        aiEnabled: true,
        report,
        rawData: inputData,
      };
    } catch (parseError) {
      // Fallback if AI returns invalid JSON
      return {
        success: true,
        aiEnabled: false,
        report: generateRuleBasedExecutiveReport(inputData),
        rawData: inputData,
      };
    }
  } catch (error) {
    console.error('Error generating executive report:', error);
    return {
      success: false,
      aiEnabled: false,
      report: {
        summary: 'Unable to generate executive report due to data analysis error.',
        keyInsights: [],
        risks: ['Data analysis system error'],
        recommendations: ['Contact technical support'],
      },
      rawData: null,
    };
  }
};

function generateRuleBasedExecutiveReport(data: any) {
  const { teamHours, productivityScore, burnoutRiskUsers, projectRisk, utilizationRate } = data;

  let summary = '';
  const keyInsights = [];
  const risks = [];
  const recommendations = [];

  // Summary
  if (productivityScore >= 80) {
    summary = `Team productivity is excellent at ${productivityScore}%, with strong utilization and efficiency metrics.`;
  } else if (productivityScore >= 60) {
    summary = `Team productivity is moderate at ${productivityScore}%, showing room for improvement in utilization and efficiency.`;
  } else {
    summary = `Team productivity requires attention at ${productivityScore}%, indicating potential operational challenges.`;
  }

  // Key Insights
  if (utilizationRate > 85) {
    keyInsights.push(
      `High team utilization at ${utilizationRate}% suggests optimal resource deployment`
    );
  } else if (utilizationRate < 70) {
    keyInsights.push(
      `Low team utilization at ${utilizationRate}% may indicate underutilization of available capacity`
    );
  }

  if (teamHours > 160 * 4) {
    // Assuming 4 team members, 160 hours/month each
    keyInsights.push(
      `Total team hours (${teamHours.toFixed(0)}) exceed typical capacity, indicating overtime`
    );
  }

  if (burnoutRiskUsers > 0) {
    keyInsights.push(`${burnoutRiskUsers} team member(s) showing burnout risk indicators`);
  }

  // Risks
  if (burnoutRiskUsers > 2) {
    risks.push('Multiple team members at high burnout risk');
  }

  if (projectRisk === 'high') {
    risks.push('High project delivery risk detected');
  }

  if (utilizationRate > 95) {
    risks.push('Team over-utilization may lead to burnout and quality issues');
  }

  if (productivityScore < 50) {
    risks.push('Low productivity scores indicate operational inefficiencies');
  }

  // Recommendations
  if (burnoutRiskUsers > 0) {
    recommendations.push('Implement workload balancing and consider additional hiring');
  }

  if (projectRisk === 'high') {
    recommendations.push('Review project timelines and resource allocation');
  }

  if (utilizationRate > 90) {
    recommendations.push('Monitor for burnout signs and plan capacity expansion');
  }

  if (productivityScore < 70) {
    recommendations.push('Conduct productivity analysis and implement process improvements');
  }

  return {
    summary,
    keyInsights,
    risks,
    recommendations,
  };
}

export const getAIBurnoutPredictor = async (
  userId: string,
  organizationId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'weekly'
) => {
  try {
    const startIso = periodStartIso(period);

    // Gather burnout analysis data
    const userSessions: any[] = await AppDataSource.query(
      'SELECT "startTime", "durationSeconds", "endTime" FROM work_sessions WHERE "userId" = $1 AND "organizationId" = $2 AND "startTime" >= $3 ORDER BY "startTime" DESC',
      [userId, organizationId, startIso]
    );

    if (userSessions.length === 0) {
      return {
        burnoutScore: 0,
        explanation: 'Insufficient data for burnout analysis',
        recommendedAction: 'Continue monitoring work patterns',
      };
    }

    // Calculate burnout indicators
    const totalSeconds = userSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const totalHours = totalSeconds / 3600;

    // Working hours analysis
    const workingHours = totalHours;

    // Overtime frequency (hours > 8 per day)
    const dailyHours = userSessions.reduce(
      (acc, session) => {
        const date = new Date(session.startTime).toDateString();
        acc[date] = (acc[date] || 0) + (session.durationSeconds || 0) / 3600;
        return acc;
      },
      {} as Record<string, number>
    );

    const overtimeDays = (Object.values(dailyHours) as number[]).filter(
      (hours: number) => hours > 8
    ).length;
    const totalDays = Object.keys(dailyHours).length;
    const overtimeFrequency = totalDays > 0 ? (overtimeDays / totalDays) * 100 : 0;

    // Late-night work (after 8 PM)
    const lateNightSessions = userSessions.filter((session) => {
      const hour = new Date(session.startTime).getHours();
      return hour >= 20 || hour <= 6; // 8 PM to 6 AM
    }).length;
    const lateNightPercentage = (lateNightSessions / userSessions.length) * 100;

    // Idle percentage (this would need more sophisticated tracking)
    const idlePercentage = Math.max(
      0,
      100 - (workingHours / (period === 'daily' ? 8 : period === 'weekly' ? 40 : 160)) * 100
    );

    // Productivity trends (simplified - would need historical comparison)
    const recentSessions = userSessions.slice(0, Math.min(10, userSessions.length));
    const recentHours = recentSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
    const productivityTrend = recentHours > workingHours * 0.8 ? 'stable' : 'declining';

    const inputData = {
      workingHours: Math.round(workingHours * 100) / 100,
      overtimeFrequency: Math.round(overtimeFrequency),
      idlePercentage: Math.round(idlePercentage),
      lateNightWork: Math.round(lateNightPercentage),
      productivityTrends: productivityTrend,
      period,
    };

    // Use AI for burnout prediction
    const aiClient = (await import('@infrastructure/ai/openai')).default;

    if (!aiClient.isAvailable()) {
      // Fallback to rule-based analysis
      return generateRuleBasedBurnoutPrediction(inputData);
    }

    const prompt = `You are an AI trained to detect early burnout in knowledge workers.

Analyze the following patterns:
- working hours
- overtime frequency
- idle percentage
- late-night work
- productivity trends

Rules:
- Return a burnout risk score from 0–100
- Provide explanation
- Provide recommendation for the manager

INPUT DATA:
${JSON.stringify(inputData, null, 2)}

OUTPUT FORMAT:
{
  "burnoutScore": number,
  "explanation": "",
  "recommendedAction": ""
}`;

    const aiResponse = await aiClient.generateCompletion(prompt, {
      maxTokens: 400,
      temperature: 0.2,
    });

    try {
      const prediction = JSON.parse(aiResponse.data);
      return {
        success: true,
        aiEnabled: true,
        ...prediction,
      };
    } catch (parseError) {
      // Fallback if AI returns invalid JSON
      return {
        success: true,
        aiEnabled: false,
        ...generateRuleBasedBurnoutPrediction(inputData),
      };
    }
  } catch (error) {
    console.error('Error in burnout prediction:', error);
    return {
      success: false,
      aiEnabled: false,
      burnoutScore: 50,
      explanation: 'Unable to analyze burnout risk due to system error',
      recommendedAction: 'Monitor employee well-being manually',
    };
  }
};

function generateRuleBasedBurnoutPrediction(data: any) {
  const {
    workingHours,
    overtimeFrequency,
    idlePercentage,
    lateNightWork,
    productivityTrends,
    period,
  } = data;

  let burnoutScore = 0;
  let explanation = '';
  let recommendedAction = '';

  // Calculate score based on various factors
  if (overtimeFrequency > 50) burnoutScore += 30;
  else if (overtimeFrequency > 25) burnoutScore += 15;

  if (lateNightWork > 30) burnoutScore += 25;
  else if (lateNightWork > 15) burnoutScore += 10;

  if (workingHours > 60 && period === 'weekly')
    burnoutScore += 20; // Weekly
  else if (workingHours > 200 && period === 'monthly') burnoutScore += 20; // Monthly

  if (productivityTrends === 'declining') burnoutScore += 15;

  if (idlePercentage < 10) burnoutScore += 10; // Very low idle time

  // Cap at 100
  burnoutScore = Math.min(100, burnoutScore);

  // Generate explanation
  const factors = [];
  if (overtimeFrequency > 25) factors.push(`high overtime frequency (${overtimeFrequency}%)`);
  if (lateNightWork > 15) factors.push(`frequent late-night work (${lateNightWork}%)`);
  if (workingHours > 50) factors.push(`extended working hours (${workingHours.toFixed(1)} hours)`);
  if (productivityTrends === 'declining') factors.push('declining productivity trends');

  if (factors.length > 0) {
    explanation = `Burnout risk detected due to: ${factors.join(', ')}.`;
  } else {
    explanation = 'No significant burnout indicators detected in current work patterns.';
  }

  // Generate recommendation
  if (burnoutScore >= 70) {
    recommendedAction =
      'Immediate intervention required: reduce workload, provide time off, and schedule wellness check.';
  } else if (burnoutScore >= 50) {
    recommendedAction = 'Monitor closely and consider workload adjustment or additional support.';
  } else if (burnoutScore >= 30) {
    recommendedAction = 'Watch for early warning signs and ensure adequate work-life balance.';
  } else {
    recommendedAction = 'Continue monitoring work patterns and maintain current support structure.';
  }

  return {
    burnoutScore,
    explanation,
    recommendedAction,
  };
}

export default {
  getUtilizationMetrics,
  getFinancialMetrics,
  getEfficiencyMetrics,
  getProductivitySummary,
  getWeeklySummary,
  getMonthlyExecutiveReport,
  getAIExecutiveSummary,
  getAIBurnoutAnalysis,
  getAIScopeCreepAnalysis,
  getAIWorkCoach,
  getAIWorkforceReassignment,
  getFinancialDeepAnalysis,
  getAIRecommendations,
  getProjectRiskPrediction,
  getAIExecutiveReport,
  getAIBurnoutPredictor,
};

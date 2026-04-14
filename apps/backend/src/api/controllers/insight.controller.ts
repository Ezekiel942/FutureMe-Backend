import { Request, Response } from 'express';
import insightEngine from '../../engines/insight-engine/insightEngine';
import riskDetectionEngine from '../../engines/risk-engine/riskDetectionEngine';
import insightsService from '../../engines/insight-engine/insights.service';
import { RiskSummary } from '../../engines/risk-engine/riskTypes';
import { findRiskEventsByUser } from '../../database/models/RiskEvent.model';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * Generate or fetch insights for the current user
 */
export const getInsights = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { period = 'daily', limit = 10, offset = 0 } = req.query;
    const periodStr = String(period) as 'daily' | 'weekly' | 'monthly';

    // Generate fresh insights for this period
    await insightEngine.generateInsights(user.id, periodStr);

    // Fetch paginated insights
    const result = await insightEngine.getInsightsForUser(
      user.id,
      Math.min(parseInt(String(limit)) || 10, 100),
      parseInt(String(offset)) || 0
    );

    success(res, {
      insights: result.insights,
      total: result.total,
      period: periodStr,
    });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch insights', err?.code, err?.status || 400);
  }
};

/**
 * Generate insights for a specific user (manager only)
 */
export const generateUserInsights = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { userId } = req.params;
    if (!userId) {
      return fail(res, 'User ID is required', 'MISSING_USER_ID', 400);
    }
    const { period = 'daily' } = req.body;
    const periodStr = String(period) as 'daily' | 'weekly' | 'monthly';

    // Generate insights
    const insights = await insightEngine.generateInsights(userId, periodStr);

    success(res, {
      insights,
      userId,
      period: periodStr,
      count: insights.length,
    });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to generate insights', err?.code, err?.status || 400);
  }
};

/**
 * Get risk summary for the current user
 * Returns all detected risks, risk score, and actionable recommendations
 */
export const getRiskSummary = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { period = 'daily' } = req.query;
    const periodStr = String(period) as 'daily' | 'weekly' | 'monthly';
    const organizationId = (user as any).organizationId;

    // Get existing risks from database
    const existingRisks = await findRiskEventsByUser(user.id, organizationId);

    // Trigger fresh risk detection (this will store new risks in DB)
    const newRisks = await riskDetectionEngine.detectUserRisks(user.id, periodStr, organizationId);

    // Combine existing and new risks, filter by period
    const periodStart =
      periodStr === 'daily'
        ? new Date(new Date().setHours(0, 0, 0, 0))
        : periodStr === 'weekly'
          ? new Date(new Date().setDate(new Date().getDate() - new Date().getDay()))
          : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const allRisks = [...existingRisks, ...newRisks].filter(
      (risk) => new Date(risk.detectedAt) >= periodStart
    );

    // Emit WebSocket events for new risks
    const { emitRiskDetected, emitAnomalyFlagged } = await import('../../engines/socket.events');

    newRisks.forEach((risk: any) => {
      if (risk.severity === 'critical' || risk.severity === 'warning') {
        emitRiskDetected(user.id, organizationId || '', risk);
      } else {
        emitAnomalyFlagged(user.id, organizationId || '', risk);
      }
    });

    // Categorize risks
    const risksByCategory = allRisks.reduce(
      (acc, risk) => {
        acc[risk.category] = (acc[risk.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const risksBySeverity = allRisks.reduce(
      (acc, risk) => {
        acc[risk.severity] = (acc[risk.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate risk score (0-100)
    const riskScore = riskDetectionEngine.calculateRiskScore(allRisks as any);

    // Separate active and resolved risks
    const activeRisks = allRisks.filter((r: any) => r.isActive && !r.resolvedAt);
    const resolvedRisks = allRisks.filter((r: any) => !r.isActive || r.resolvedAt);

    // Generate recommendations
    const recommendations = riskDetectionEngine.generateRecommendations(activeRisks as any);

    const summary: RiskSummary = {
      userId: user.id,
      organizationId,
      period: periodStr,
      totalRisks: allRisks.length,
      risksByCategory,
      risksBySeverity,
      activeRisks,
      resolvedRisks,
      riskScore,
      recommendations,
    };

    success(res, summary);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch risk summary', err?.code, err?.status || 400);
  }
};

/**
 * GET /api/v1/insights/utilization
 * Returns team and per-user utilization metrics for the tenant
 */
export const getUtilization = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    const organizationId = (user as any).organizationId;
    const period = (req.query.period as any) || 'monthly';
    const result = await insightsService.getUtilizationMetrics(organizationId, period);
    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch utilization', err?.code, err?.status || 400);
  }
};

/**
 * GET /api/v1/insights/financial
 * Returns cost estimates per project and organization using provided or fallback rates
 */
export const getFinancial = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    const organizationId = (user as any).organizationId;
    const period = (req.query.period as any) || 'monthly';
    const costPerHour = req.query.costPerHour ? Number(req.query.costPerHour) : undefined;
    const result = await insightsService.getFinancialMetrics(organizationId, period, costPerHour);
    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch financial metrics', err?.code, err?.status || 400);
  }
};

/**
 * GET /api/v1/insights/efficiency
 * Returns MoM efficiency growth and an estimated burnout score (0-100)
 */
export const getEfficiency = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    const organizationId = (user as any).organizationId;
    const period = (req.query.period as any) || 'monthly';
    const result = await insightsService.getEfficiencyMetrics(organizationId, period);
    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch efficiency metrics', err?.code, err?.status || 400);
  }
};

/**
 * Tenant-scoped productivity summary endpoints
 */
export const getSummary = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { period } = req.params as { period: 'daily' | 'weekly' | 'monthly' };
    const organizationId = (user as any).organizationId;

    let data: any;
    if (period === 'daily') {
      data = await insightsService.getProductivitySummary(organizationId, 'daily');
    } else if (period === 'weekly') {
      data = await insightsService.getWeeklySummary(organizationId);
    } else if (period === 'monthly') {
      data = await insightsService.getMonthlyExecutiveReport(organizationId);
    } else {
      return fail(res, 'Invalid period', 'INVALID_PERIOD');
    }

    success(res, data);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch summary', err?.code, err?.status || 400);
  }
};

/**
 * POST /api/v1/insights/ai/executive-summary
 * Generate AI-powered executive summary for the organization
 */
export const postExecutiveSummary = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const organizationId = (user as any).organizationId;

    // Non-blocking: Fire and forget AI call in background
    // This ensures request completes immediately without waiting for AI
    const result = await insightsService.getAIExecutiveSummary(organizationId);

    success(res, result);
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to generate executive summary',
      err?.code,
      err?.status || 400
    );
  }
};

/**
 * GET /api/v1/insights/ai/burnout-analysis/:userId
 * Get AI-powered burnout risk analysis for a specific user
 * Accessible by: user (own data) or manager (team members)
 */
export const getBurnoutAnalysis = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { userId } = req.params;
    const organizationId = (user as any).organizationId;
    const userRole = (user as any).role;

    // Authorization: Allow users to view own data, managers can view team
    if (user.id !== userId && userRole !== 'manager') {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const result = await insightsService.getAIBurnoutAnalysis(userId, organizationId);

    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to analyze burnout risk', err?.code, err?.status || 400);
  }
};

/**
 * GET /api/v1/insights/ai/project-risk/:projectId
 * Get AI-powered scope creep and budget risk analysis for a project
 * Accessible by: manager or project lead
 */
export const getProjectRisk = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.params;
    const organizationId = (user as any).organizationId;
    const userRole = (user as any).role;

    // Authorization: Only managers can access project risk analysis
    if (userRole !== 'manager') {
      return fail(res, 'Forbidden - Managers only', 'FORBIDDEN', 403);
    }

    const result = await insightsService.getAIScopeCreepAnalysis(projectId, organizationId);

    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to analyze project risk', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/insights/financial/deep-analysis
 * Advanced financial intelligence: cost per feature, team utilization, efficiency growth
 */
export const getFinancialDeepAnalysis = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const organizationId = (user as any).organizationId;
    const period = (req.query.period as any) || 'monthly';
    const costPerHour = req.query.costPerHour ? Number(req.query.costPerHour) : undefined;

    const result = await insightsService.getFinancialDeepAnalysis(
      organizationId,
      period as 'daily' | 'weekly' | 'monthly',
      costPerHour
    );

    success(res, result);
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to fetch financial deep analysis',
      err?.code,
      err?.status || 500
    );
  }
};

/**
 * GET /api/v1/insights/ai/recommendations
 * Returns AI-powered recommendations for task reassignment, overtime prevention, and risk mitigation
 */
export const getAIRecommendations = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const organizationId = (user as any).organizationId;
    if (!organizationId) return fail(res, 'Organization not found in token', 'NO_ORG', 400);

    const period = (req.query.period as any) || 'weekly';

    const result = await insightsService.getAIRecommendations(
      organizationId,
      period as 'daily' | 'weekly' | 'monthly'
    );

    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch AI recommendations', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/insights/ai/work-coach/:userId
 * Get AI-powered personal productivity coaching suggestions
 * Accessible by: user (own data) or manager (team members)
 */
export const getWorkCoach = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { userId } = req.params;
    const organizationId = (user as any).organizationId;
    const userRole = (user as any).role;

    // Authorization: Allow users to view own data, managers can view team
    if (user.id !== userId && userRole !== 'manager') {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const result = await insightsService.getAIWorkCoach(userId, organizationId);

    success(res, result);
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to get work coach suggestions',
      err?.code,
      err?.status || 400
    );
  }
};

/**
 * GET /api/v1/insights/ai/workforce-reassignment
 * Get AI-powered workforce reassignment suggestions for workload balancing
 * Accessible by: managers only
 */
export const getWorkforceReassignment = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const organizationId = (user as any).organizationId;
    const userRole = (user as any).role;

    // Authorization: Only managers can access workforce reassignment
    if (userRole !== 'manager') {
      return fail(res, 'Forbidden - Managers only', 'FORBIDDEN', 403);
    }

    const result = await insightsService.getAIWorkforceReassignment(organizationId);

    success(res, result);
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to get workforce reassignment suggestions',
      err?.code,
      err?.status || 500
    );
  }
};

/**
 * GET /api/v1/insights/ai/project-risk-predictor/:projectId
 * AI-powered project risk prediction: analyzes task progress, team workload, historical velocity
 */
export const getProjectRiskPredictor = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.params;
    const organizationId = (user as any).organizationId;
    const userRole = (user as any).role;

    // Authorization: Only managers can access project risk analysis
    if (userRole !== 'manager') {
      return fail(res, 'Forbidden - Managers only', 'FORBIDDEN', 403);
    }

    const result = await insightsService.getProjectRiskPrediction(projectId, organizationId);

    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to predict project risk', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/insights/ai/executive-report
 * AI-powered executive workforce analytics report
 */
export const getExecutiveReport = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const organizationId = (user as any).organizationId;
    const period = (req.query.period as any) || 'monthly';

    const result = await insightsService.getAIExecutiveReport(
      organizationId,
      period as 'daily' | 'weekly' | 'monthly'
    );

    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to generate executive report', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/insights/ai/burnout-predictor/:userId
 * AI-powered burnout risk prediction for individual users
 */
export const getBurnoutPredictor = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { userId } = req.params;
    const organizationId = (user as any).organizationId;
    const userRole = (user as any).role;
    const period = (req.query.period as any) || 'weekly';

    // Authorization: Managers can check any user, users can only check themselves
    if (userRole !== 'manager' && user.id !== userId) {
      return fail(res, 'Forbidden - Can only access your own burnout analysis', 'FORBIDDEN', 403);
    }

    const result = await insightsService.getAIBurnoutPredictor(
      userId,
      organizationId,
      period as 'daily' | 'weekly' | 'monthly'
    );

    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to predict burnout risk', err?.code, err?.status || 500);
  }
};

export default {
  getInsights,
  generateUserInsights,
  getRiskSummary,
  getUtilization,
  getFinancial,
  getEfficiency,
  getSummary,
  postExecutiveSummary,
  getBurnoutAnalysis,
  getProjectRisk,
  getWorkCoach,
  getWorkforceReassignment,
  getFinancialDeepAnalysis,
  getAIRecommendations,
  getProjectRiskPredictor,
  getExecutiveReport,
  getBurnoutPredictor,
};

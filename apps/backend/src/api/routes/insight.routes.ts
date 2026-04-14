import { Router } from 'express';
import {
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
} from '../controllers/insight.controller';
import requireAuth from '../middlewares/auth.middleware';
import { aiLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

router.get('/', requireAuth, getInsights);
router.post('/:userId/generate', requireAuth, generateUserInsights);

/**
 * @swagger
 * /api/v1/insights/risk-summary:
 *   get:
 *     tags:
 *       - Insights
 *     summary: Get risk summary for current user
 *     description: Returns all detected risks, risk score (0-100), and actionable recommendations for the specified period.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: Period to analyze
 *     responses:
 *       200:
 *         description: Risk summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     organizationId:
 *                       type: string
 *                     period:
 *                       type: string
 *                     totalRisks:
 *                       type: integer
 *                     risksByCategory:
 *                       type: object
 *                       example: {"burnout": 2, "scope_creep": 1}
 *                     risksBySeverity:
 *                       type: object
 *                       example: {"critical": 1, "warning": 2}
 *                     riskScore:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 100
 *                     activeRisks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RiskEvent'
 *                     resolvedRisks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RiskEvent'
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/risk-summary', requireAuth, getRiskSummary);

// New tenant-scoped analytics endpoints
router.get('/utilization', requireAuth, getUtilization);
router.get('/financial', requireAuth, getFinancial);
router.get('/efficiency', requireAuth, getEfficiency);

/**
 * @swagger
 * /api/v1/insights/financial/deep-analysis:
 *   get:
 *     tags:
 *       - Insights
 *       - Financial Intelligence
 *     summary: Advanced financial intelligence analysis
 *     description: |
 *       Comprehensive financial analysis including:
 *       - Cost per feature (project-wise breakdown)
 *       - Team utilization rate (productive time vs available hours)
 *       - Efficiency growth trends (month-over-month comparison)
 *       - Top projects by cost
 *       - Burnout trend analysis
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: monthly
 *         description: Analysis period
 *       - name: costPerHour
 *         in: query
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Override hourly cost rate (if not specified, calculated from subscription)
 *     responses:
 *       200:
 *         description: Financial deep analysis retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     organizationId:
 *                       type: string
 *                     period:
 *                       type: string
 *                     analysisDate:
 *                       type: string
 *                       format: date-time
 *                     teamUtilization:
 *                       type: object
 *                       properties:
 *                         utilizationRate:
 *                           type: number
 *                           description: Percentage of available hours used productively
 *                         totalProductiveHours:
 *                           type: number
 *                         totalAvailableHours:
 *                           type: number
 *                         teamSize:
 *                           type: integer
 *                     financialSummary:
 *                       type: object
 *                       properties:
 *                         totalProjectCost:
 *                           type: number
 *                         costPerTeamMember:
 *                           type: number
 *                         costPerProductiveHour:
 *                           type: number
 *                         costPerHour:
 *                           type: number
 *                         currencyUnit:
 *                           type: string
 *                     costPerFeature:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           featureId:
 *                             type: string
 *                           hours:
 *                             type: number
 *                           cost:
 *                             type: number
 *                           costPerHour:
 *                             type: number
 *                     topProjects:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           projectId:
 *                             type: string
 *                           hours:
 *                             type: number
 *                           cost:
 *                             type: number
 *                           costPerHour:
 *                             type: number
 *                     efficiencyGrowth:
 *                       type: object
 *                       properties:
 *                         monthToMonthGrowthPercent:
 *                           type: number
 *                           nullable: true
 *                         previousMoMGrowthPercent:
 *                           type: number
 *                           nullable: true
 *                         currentMonthHours:
 *                           type: number
 *                         previousMonthHours:
 *                           type: number
 *                         twoMonthsAgoHours:
 *                           type: number
 *                         trend:
 *                           type: string
 *                           enum: [increasing, decreasing, stable, unknown]
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalProjects:
 *                           type: integer
 *                         projectsWithCost:
 *                           type: integer
 *                         averageCostPerProject:
 *                           type: number
 *                         productivityTrend:
 *                           type: string
 *                           enum: [healthy, at-risk]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/financial/deep-analysis', requireAuth, getFinancialDeepAnalysis);

// Productivity summaries (daily/weekly/monthly)
/**
 * @swagger
 * /api/v1/insights/summary/{period}:
 *   get:
 *     tags:
 *       - Insights
 *     summary: Get tenant-scoped productivity summary
 *     description: |
 *       Returns aggregated productivity statistics for the organization. The `period`
 *       path parameter must be one of `daily`, `weekly` or `monthly`. Separate
 *       endpoints exist for convenience (e.g. `/summary/daily`).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *         description: Period to summarise
 *     responses:
 *       200:
 *         description: Summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Summary object varies by period (see controller/service)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/summary/:period(daily|weekly|monthly)', requireAuth, getSummary);

/**
 * @swagger
 * /api/v1/insights/ai/executive-summary:
 *   post:
 *     tags:
 *       - Insights
 *       - AI Features
 *     summary: Generate AI-powered executive summary
 *     description: |
 *       Generates a natural language executive report using AI based on monthly metrics.
 *       Combines organizational data with AI analysis for business tone recommendations.
 *       Falls back to rule-based summary if OPENAI_API_KEY is not configured.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Executive summary generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     aiEnabled:
 *                       type: boolean
 *                     executiveSummary:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           type: string
 *                         keyHighlights:
 *                           type: array
 *                           items:
 *                             type: string
 *                         concerns:
 *                           type: array
 *                           items:
 *                             type: string
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             type: string
 *                     metrics:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/ai/executive-summary', requireAuth, aiLimiter, postExecutiveSummary);

/**
 * @swagger
 * /api/v1/insights/ai/burnout-analysis/{userId}:
 *   get:
 *     tags:
 *       - Insights
 *       - AI Features
 *     summary: Get AI-powered burnout risk analysis
 *     description: |
 *       Analyzes burnout risk combining session patterns, late work, idle time, and overtime.
 *       Returns burnout score (0-100), risk explanation, and recommended intervention.
 *       Users can access own data; managers can access team member data.
 *       Falls back to rule-based analysis if AI is unavailable.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to analyze
 *     responses:
 *       200:
 *         description: Burnout analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     aiEnabled:
 *                       type: boolean
 *                     month:
 *                       type: string
 *                       format: date
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         totalHoursThisMonth:
 *                           type: number
 *                         averageHoursPerDay:
 *                           type: number
 *                         lateNightSessions:
 *                           type: integer
 *                         overtimeHours:
 *                           type: number
 *                         consecutiveHighLoadDays:
 *                           type: integer
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         burnoutScore:
 *                           type: integer
 *                           minimum: 0
 *                           maximum: 100
 *                         riskLevel:
 *                           type: string
 *                           enum: [low, moderate, high, critical]
 *                         explanation:
 *                           type: string
 *                         primaryRisks:
 *                           type: array
 *                           items:
 *                             type: string
 *                         recommendedIntervention:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Cannot view other users' data without manager role
 *       500:
 *         description: Internal server error
 */
router.get('/ai/burnout-analysis/:userId', requireAuth, aiLimiter, getBurnoutAnalysis);

/**
 * @swagger
 * /api/v1/insights/ai/project-risk/{projectId}:
 *   get:
 *     tags:
 *       - Insights
 *       - AI Features
 *     summary: Get AI-powered scope creep and budget risk analysis
 *     description: |
 *       Analyzes scope creep and budget risk by comparing historical task duration
 *       against current project velocity. Returns overrun probability, budget risk level,
 *       and suggested corrections. Managers only.
 *       Falls back to rule-based analysis if AI is unavailable.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID to analyze
 *     responses:
 *       200:
 *         description: Project risk analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     projectId:
 *                       type: string
 *                     aiEnabled:
 *                       type: boolean
 *                     month:
 *                       type: string
 *                       format: date
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         currentHours:
 *                           type: number
 *                         historicalAverageHours:
 *                           type: number
 *                         currentVelocity:
 *                           type: number
 *                         taskCount:
 *                           type: integer
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         overrunProbability:
 *                           type: integer
 *                           minimum: 0
 *                           maximum: 100
 *                         budgetRiskLevel:
 *                           type: string
 *                           enum: [low, moderate, high, critical]
 *                         projectedTotalHours:
 *                           type: number
 *                         budgetOverrunRisk:
 *                           type: number
 *                         analysis:
 *                           type: string
 *                         suggestedCorrection:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Managers only
 *       500:
 *         description: Internal server error
 */
router.get('/ai/project-risk/:projectId', requireAuth, aiLimiter, getProjectRisk);

/**
 * @swagger
 * /api/v1/insights/ai/project-risk-predictor/{projectId}:
 *   get:
 *     tags:
 *       - Insights
 *       - AI Features
 *     summary: AI Project Risk Predictor
 *     description: |
 *       Analyzes task progress, team workload, and historical project velocity to predict:
 *       - Whether the project will finish on time
 *       - If it will miss deadline
 *       - If it will exceed budget
 *
 *       Returns risk level, predicted delay days, reasons, and mitigation steps.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID to analyze
 *     responses:
 *       200:
 *         description: Project risk prediction completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 riskLevel:
 *                   type: string
 *                   enum: [low, medium, high]
 *                 predictedDelayDays:
 *                   type: number
 *                 reasons:
 *                   type: array
 *                   items:
 *                     type: string
 *                 mitigationSteps:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Managers only
 *       500:
 *         description: Internal server error
 */
router.get(
  '/ai/project-risk-predictor/:projectId',
  requireAuth,
  aiLimiter,
  getProjectRiskPredictor
);

/**
 * @swagger
 * /api/v1/insights/ai/recommendations:
 *   get:
 *     tags:
 *       - Insights
 *       - AI Recommendations
 *     summary: AI-powered recommendations engine
 *     description: |
 *       Provides actionable recommendations for:
 *       - Task reassignment suggestions (redistribute work from overloaded users)
 *       - Overtime prevention strategies (reduce overtime hours)
 *       - Risk mitigation actions (address identified risks)
 *
 *       Uses AI analysis when available, falls back to rule-based logic.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: weekly
 *         description: Analysis period for recommendations
 *     responses:
 *       200:
 *         description: AI recommendations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     aiEnabled:
 *                       type: boolean
 *                     organizationId:
 *                       type: string
 *                     period:
 *                       type: string
 *                     analysisDate:
 *                       type: string
 *                       format: date-time
 *                     recommendations:
 *                       type: object
 *                       properties:
 *                         taskReassignment:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               fromUserId:
 *                                 type: string
 *                               toUserId:
 *                                 type: string
 *                               taskDescription:
 *                                 type: string
 *                               reason:
 *                                 type: string
 *                               estimatedTimeSavings:
 *                                 type: number
 *                         overtimePrevention:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               strategy:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                               expectedImpact:
 *                                 type: string
 *                               implementationSteps:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                         riskMitigation:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               riskType:
 *                                 type: string
 *                               severity:
 *                                 type: string
 *                                 enum: [low, medium, high, critical]
 *                               action:
 *                                 type: string
 *                               timeline:
 *                                 type: string
 *                               responsible:
 *                                 type: string
 *                     dataSources:
 *                       type: object
 *                       properties:
 *                         utilizationMetrics:
 *                           type: object
 *                         financialMetrics:
 *                           type: object
 *                         efficiencyMetrics:
 *                           type: object
 *                         riskEventsCount:
 *                           type: integer
 *                         userWorkloadsCount:
 *                           type: integer
 *                         projectStatusesCount:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/ai/recommendations', requireAuth, aiLimiter, getAIRecommendations);

/**
 * @swagger
 * /api/v1/insights/ai/work-coach/{userId}:
 *   get:
 *     tags:
 *       - Insights
 *       - AI Features
 *     summary: Get AI-powered personal productivity coaching
 *     description: |
 *       Provides supportive productivity suggestions based on user's work patterns.
 *       Analyzes focus hours, task switching, break timing, and productivity rhythm
 *       to offer personalized coaching recommendations.
 *       Users can access own data; managers can access team member data.
 *       Falls back to rule-based suggestions if AI is unavailable.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to coach
 *     responses:
 *       200:
 *         description: Work coach suggestions provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     aiEnabled:
 *                       type: boolean
 *                     week:
 *                       type: string
 *                       format: date
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         totalHoursThisWeek:
 *                           type: number
 *                         averageHoursPerDay:
 *                           type: number
 *                         sessionCount:
 *                           type: integer
 *                         averageSessionLength:
 *                           type: number
 *                         focusHours:
 *                           type: number
 *                         taskSwitches:
 *                           type: integer
 *                         breakPatterns:
 *                           type: integer
 *                         lateNightSessions:
 *                           type: integer
 *                         idleTime:
 *                           type: number
 *                     coaching:
 *                       type: object
 *                       properties:
 *                         optimalFocusHours:
 *                           type: string
 *                           example: "6-8 hours"
 *                         suggestions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["Consider taking regular breaks during long work sessions", "Try grouping similar tasks together to reduce context switching"]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Cannot view other users' data without manager role
 *       500:
 *         description: Internal server error
 */
router.get('/ai/work-coach/:userId', requireAuth, aiLimiter, getWorkCoach);

/**
 * @swagger
 * /api/v1/insights/ai/workforce-reassignment:
 *   get:
 *     tags:
 *       - Insights
 *       - AI Features
 *     summary: Get AI-powered workforce reassignment suggestions
 *     description: |
 *       Analyzes team workload distribution and provides optimal task reassignment
 *       suggestions to balance workload across the team. Considers employee availability,
 *       current workload, and task expertise for balanced team optimization.
 *       Managers only. Falls back to rule-based analysis if AI is unavailable.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workforce reassignment analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     aiEnabled:
 *                       type: boolean
 *                     organizationId:
 *                       type: string
 *                     analysisDate:
 *                       type: string
 *                       format: date-time
 *                     reassignment:
 *                       type: object
 *                       properties:
 *                         overloadedUsers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: string
 *                               currentWorkload:
 *                                 type: number
 *                               reason:
 *                                 type: string
 *                         underutilizedUsers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: string
 *                               currentWorkload:
 *                                 type: number
 *                               availableCapacity:
 *                                 type: number
 *                         reassignmentSuggestions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               fromUserId:
 *                                 type: string
 *                               toUserId:
 *                                 type: string
 *                               taskId:
 *                                 type: string
 *                               taskDescription:
 *                                 type: string
 *                               reason:
 *                                 type: string
 *                               expectedImpact:
 *                                 type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Managers only
 *       500:
 *         description: Internal server error
 */
router.get('/ai/workforce-reassignment', requireAuth, aiLimiter, getWorkforceReassignment);

/**
 * @swagger
 * /api/v1/insights/ai/executive-report:
 *   get:
 *     tags:
 *       - Insights
 *       - AI Features
 *     summary: AI Executive Workforce Analytics Report
 *     description: |
 *       Generates a comprehensive executive report on workforce productivity, risks, and opportunities.
 *
 *       Analyzes:
 *       - Productivity trends and workload balance
 *       - Burnout risk across the team
 *       - Project delivery risk
 *       - Resource utilization patterns
 *
 *       Returns structured executive summary with key insights, risks, and recommendations.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: monthly
 *         description: Analysis period
 *     responses:
 *       200:
 *         description: Executive report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 aiEnabled:
 *                   type: boolean
 *                 report:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: string
 *                     keyInsights:
 *                       type: array
 *                       items:
 *                         type: string
 *                     risks:
 *                       type: array
 *                       items:
 *                         type: string
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *                 rawData:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/ai/executive-report', requireAuth, aiLimiter, getExecutiveReport);

/**
 * @swagger
 * /api/v1/insights/ai/burnout-predictor/{userId}:
 *   get:
 *     tags:
 *       - Insights
 *       - AI Features
 *     summary: AI Burnout Risk Predictor
 *     description: |
 *       Analyzes individual user work patterns to predict burnout risk.
 *
 *       Evaluates:
 *       - Working hours and overtime frequency
 *       - Late-night work patterns
 *       - Productivity trends
 *       - Work-life balance indicators
 *
 *       Returns burnout score (0-100), explanation, and recommended actions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to analyze
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: weekly
 *         description: Analysis period
 *     responses:
 *       200:
 *         description: Burnout prediction completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 aiEnabled:
 *                   type: boolean
 *                 burnoutScore:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 100
 *                 explanation:
 *                   type: string
 *                 recommendedAction:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only access your own data unless manager
 *       500:
 *         description: Internal server error
 */
router.get('/ai/burnout-predictor/:userId', requireAuth, aiLimiter, getBurnoutPredictor);

export default router;

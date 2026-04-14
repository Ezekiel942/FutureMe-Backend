import { Router } from 'express';
import { getLiveDashboard, getPredictiveRiskDashboard } from '../controllers/dashboard.controller';
import requireAuth from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/dashboard/live:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get live dashboard metrics
 *     description: Returns real-time dashboard data including active sessions, top projects, and recent activity for the organization.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Live dashboard data retrieved successfully
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
 *                     activeSessions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     topProjects:
 *                       type: array
 *                       items:
 *                         type: object
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                     riskAlerts:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/live', requireAuth, getLiveDashboard);

/**
 * @swagger
 * /api/v1/dashboard/predictive:
 *   get:
 *     tags:
 *       - Dashboard
 *       - Risk Analysis
 *     summary: Get predictive risk dashboard
 *     description: |
 *       Returns predictive risk analysis including:
 *       - High risk users (burnout score >70 or multiple risk events)
 *       - At-risk projects (high velocity variance or multiple risk events)
 *       - Burnout heatmap data (hourly activity patterns for last 7 days)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: weekly
 *         description: Analysis period for risk assessment
 *     responses:
 *       200:
 *         description: Predictive risk dashboard retrieved successfully
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
 *                     highRiskUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           totalHours:
 *                             type: number
 *                           projectCount:
 *                             type: integer
 *                           riskEventCount:
 *                             type: integer
 *                           riskLevel:
 *                             type: string
 *                             enum: [high, critical]
 *                     atRiskProjects:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           projectId:
 *                             type: string
 *                           userCount:
 *                             type: integer
 *                           totalHours:
 *                             type: number
 *                           riskEventCount:
 *                             type: integer
 *                           avgSessionHours:
 *                             type: number
 *                           sessionVariability:
 *                             type: number
 *                           riskLevel:
 *                             type: string
 *                             enum: [medium, high]
 *                     burnoutHeatmap:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: string
 *                             format: date-time
 *                           dayOfWeek:
 *                             type: integer
 *                           hourOfDay:
 *                             type: integer
 *                           sessionCount:
 *                             type: integer
 *                           userCount:
 *                             type: integer
 *                           totalHours:
 *                             type: number
 *                           averageHoursPerUser:
 *                             type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         highRiskUserCount:
 *                           type: integer
 *                         atRiskProjectCount:
 *                           type: integer
 *                         totalHeatmapHours:
 *                           type: integer
 *                         averageSessionsPerHour:
 *                           type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/predictive', requireAuth, getPredictiveRiskDashboard);

export default router;

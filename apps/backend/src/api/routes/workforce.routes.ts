import { Router } from 'express';
import requireAuth from '../middlewares/auth.middleware';
import { getAttendanceAnalytics, getRealtimeWorkforce } from '../controllers/workforce.controller';

const router = Router();

/**
 * @swagger
 * /api/v1/workforce:
 *   get:
 *     tags:
 *       - Workforce
 *     summary: Get workforce overview
 *     description: Returns basic workforce analytics and insights
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workforce overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Workforce analytics endpoint - coming soon"
 */
router.get('/', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Workforce analytics endpoint - coming soon',
      features: [
        'Attendance Intelligence',
        'Productivity Analytics',
        'Risk Detection',
        'Workforce Optimization',
      ],
    },
  });
});

/**
 * @swagger
 * /api/v1/workforce/attendance:
 *   get:
 *     tags:
 *       - Workforce
 *     summary: Get attendance analytics
 *     description: Returns attendance patterns and insights for the organization
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: weekly
 *         description: Analysis period
 *     responses:
 *       200:
 *         description: Attendance analytics retrieved successfully
 */
router.get('/attendance', requireAuth, getAttendanceAnalytics);

/**
 * @swagger
 * /api/v1/workforce/realtime:
 *   get:
 *     tags:
 *       - Workforce
 *     summary: Get realtime workforce status
 *     description: Returns active, paused, idle, and overloaded employee counts for dashboard support.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Realtime workforce status retrieved successfully
 */
router.get('/realtime', requireAuth, getRealtimeWorkforce);

export default router;

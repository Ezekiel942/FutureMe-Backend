import { Router } from 'express';
import {
  createAnnouncement,
  listAnnouncements,
  getAnnouncement,
  respondToAnnouncement,
  acknowledgeAnnouncement,
  getResponses,
  deleteAnnouncement,
} from '../controllers/announcement.controller';
import requireAuth from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/announcements:
 *   post:
 *     tags:
 *       - Announcements
 *     summary: Create a new announcement
 *     description: Create a new announcement for the organization. Manager only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Managers only
 *       500:
 *         description: Internal server error
 */
router.post('/', requireAuth, createAnnouncement);

/**
 * @swagger
 * /api/v1/announcements:
 *   get:
 *     tags:
 *       - Announcements
 *     summary: List announcements for organization
 *     description: Get all active announcements for the current organization.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: includeInactive
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive/expired announcements
 *     responses:
 *       200:
 *         description: List retrieved successfully
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
 *                     announcements:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', requireAuth, listAnnouncements);

/**
 * @swagger
 * /api/v1/announcements/{id}:
 *   get:
 *     tags:
 *       - Announcements
 *     summary: Get announcement details
 *     description: Get a specific announcement. Automatically marks as read for the current user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Announcement retrieved successfully
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
 *                     announcement:
 *                       type: object
 *                     userResponse:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', requireAuth, getAnnouncement);

/**
 * @swagger
 * /api/v1/announcements/{id}/respond:
 *   post:
 *     tags:
 *       - Announcements
 *     summary: Post a response to an announcement
 *     description: Users can respond to announcements with custom text.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response]
 *             properties:
 *               response:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response submitted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/respond', requireAuth, respondToAnnouncement);

/**
 * @swagger
 * /api/v1/announcements/{id}/acknowledge:
 *   post:
 *     tags:
 *       - Announcements
 *     summary: Acknowledge an announcement
 *     description: Mark an announcement as acknowledged/confirmed by the user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Announcement acknowledged successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/acknowledge', requireAuth, acknowledgeAnnouncement);

/**
 * @swagger
 * /api/v1/announcements/{id}/responses:
 *   get:
 *     tags:
 *       - Announcements
 *     summary: Get all responses to an announcement
 *     description: Manager only. Get responses and statistics for an announcement.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Responses retrieved successfully
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
 *                     responses:
 *                       type: array
 *                       items:
 *                         type: object
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         read:
 *                           type: integer
 *                         acknowledged:
 *                           type: integer
 *                         responded:
 *                           type: integer
 *                         readPercent:
 *                           type: integer
 *                         acknowledgedPercent:
 *                           type: integer
 *                         respondedPercent:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Managers only
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/responses', requireAuth, getResponses);

/**
 * @swagger
 * /api/v1/announcements/{id}:
 *   delete:
 *     tags:
 *       - Announcements
 *     summary: Delete an announcement
 *     description: Deactivate an announcement. Manager only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Announcement deactivated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Managers only
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', requireAuth, deleteAnnouncement);

export default router;

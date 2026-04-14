import { Router } from 'express';
import {
  createSession,
  pauseSession,
  resumeSession,
  endSession,
  getActiveSession,
  getSessionHistory,
} from '../controllers/session.controller';
import requireAuth from '../middlewares/auth.middleware';
import { sessionStartLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/sessions/active:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Get active session for current user
 *     description: Returns the currently active session, if any. Returns null/empty if no active session.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *       500:
 *         description: Internal server error
 */
router.get('/active', requireAuth, getActiveSession);

/**
 * @swagger
 * /api/v1/sessions:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Get session history for current user
 *     description: Lists all sessions (active and ended) for the authenticated user with pagination support.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, paused, ended]
 *         description: Filter sessions by status
 *     responses:
 *       200:
 *         description: Session history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionList'
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *       500:
 *         description: Internal server error
 */
router.get('/', requireAuth, getSessionHistory);

/**
 * @swagger
 * /api/v1/sessions:
 *   post:
 *     tags:
 *       - Sessions
 *     summary: Create a new session
 *     description: Starts a new session for the authenticated user. Subject to rate limiting (max 10 per minute).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId:
 *                 type: string
 *                 description: Optional project ID to associate with the session
 *               taskId:
 *                 type: string
 *                 description: Optional task ID to associate with the session
 *               metadata:
 *                 type: object
 *                 description: Optional metadata for the session
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BadRequest'
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Unauthorized'
 *       409:
 *         description: Conflict - user already has an active session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       429:
 *         description: Too many session creation requests. Maximum 10 per minute.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalServerError'
 */
router.post('/', requireAuth, sessionStartLimiter, createSession);

/**
 * @swagger
 * /api/v1/sessions/{sessionId}/pause:
 *   post:
 *     tags:
 *       - Sessions
 *     summary: Pause an active session
 *     description: Pauses an active session. Can be resumed later. Requires the session to be owned by the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique session identifier
 *     responses:
 *       200:
 *         description: Session paused successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       400:
 *         description: Invalid session ID or session cannot be paused
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BadRequest'
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Unauthorized'
 *       403:
 *         description: Forbidden - session does not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Forbidden'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalServerError'
 */
router.post('/:sessionId/pause', requireAuth, pauseSession);

/**
 * @swagger
 * /api/v1/sessions/{sessionId}/resume:
 *   post:
 *     tags:
 *       - Sessions
 *     summary: Resume a paused session
 *     description: Resumes a paused session. Only applicable to sessions with status "paused". Requires ownership of the session.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique session identifier
 *     responses:
 *       200:
 *         description: Session resumed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       400:
 *         description: Invalid session ID or session cannot be resumed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BadRequest'
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Unauthorized'
 *       403:
 *         description: Forbidden - session does not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Forbidden'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalServerError'
 */
router.post('/:sessionId/resume', requireAuth, resumeSession);

/**
 * @swagger
 * /api/v1/sessions/{sessionId}/end:
 *   post:
 *     tags:
 *       - Sessions
 *     summary: End an active or paused session
 *     description: Terminates a session and records the end time. Permanent operation. Requires ownership of the session.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique session identifier
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Optional notes to save with the session
 *     responses:
 *       200:
 *         description: Session ended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       400:
 *         description: Invalid session ID or session cannot be ended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BadRequest'
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Unauthorized'
 *       403:
 *         description: Forbidden - session does not belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Forbidden'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalServerError'
 */
router.post('/:sessionId/end', requireAuth, endSession);

export default router;

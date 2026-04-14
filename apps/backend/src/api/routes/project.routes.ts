import { Router } from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addTeamMember,
  removeTeamMember,
  getProjectMetrics,
} from '../controllers/project.controller';
import requireAuth from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: List all projects
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of projects
 *       401:
 *         description: Unauthorized
 */
router.get('/', requireAuth, listProjects);

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     tags:
 *       - Projects
 *     summary: Create a new project
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               targetEndDate:
 *                 type: string
 *                 format: date-time
 *               budget:
 *                 type: number
 *               estimatedHours:
 *                 type: number
 *               teamSize:
 *                 type: number
 *     responses:
 *       200:
 *         description: Project created
 *       401:
 *         description: Unauthorized
 */
router.post('/', requireAuth, createProject);

/**
 * @swagger
 * /api/v1/projects/{projectId}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get a project by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project details
 *       404:
 *         description: Project not found
 */
router.get('/:projectId', requireAuth, getProject);

/**
 * @swagger
 * /api/v1/projects/{projectId}:
 *   put:
 *     tags:
 *       - Projects
 *     summary: Update a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [planning, active, on-hold, completed, archived]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               targetEndDate:
 *                 type: string
 *                 format: date-time
 *               budget:
 *                 type: number
 *               estimatedHours:
 *                 type: number
 *     responses:
 *       200:
 *         description: Project updated
 *       404:
 *         description: Project not found
 */
router.put('/:projectId', requireAuth, updateProject);

/**
 * @swagger
 * /api/v1/projects/{projectId}:
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Delete a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project deleted
 *       404:
 *         description: Project not found
 */
router.delete('/:projectId', requireAuth, deleteProject);

/**
 * @swagger
 * /api/v1/projects/{projectId}/team-members:
 *   post:
 *     tags:
 *       - Projects
 *     summary: Add a team member to a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
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
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Team member added
 *       404:
 *         description: Project not found
 */
router.post('/:projectId/team-members', requireAuth, addTeamMember);

/**
 * @swagger
 * /api/v1/projects/{projectId}/team-members:
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Remove a team member from a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
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
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Team member removed
 *       404:
 *         description: Project not found
 */
router.delete('/:projectId/team-members', requireAuth, removeTeamMember);

/**
 * @swagger
 * /api/v1/projects/{projectId}/metrics:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get project metrics (tasks, hours, completion)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project metrics
 *       404:
 *         description: Project not found
 */
router.get('/:projectId/metrics', requireAuth, getProjectMetrics);

export default router;

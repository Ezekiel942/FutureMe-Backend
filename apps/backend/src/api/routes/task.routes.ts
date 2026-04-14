import { Router } from 'express';
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getMyTasks,
  getTasksByStatus,
} from '../controllers/task.controller';
import requireAuth from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/tasks:
 *   get:
 *     tags:
 *       - Tasks
 *     summary: List all tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *     responses:
 *       200:
 *         description: List of tasks
 *       401:
 *         description: Unauthorized
 */
router.get('/', requireAuth, listTasks);

/**
 * @swagger
 * /api/v1/tasks/my-tasks:
 *   get:
 *     tags:
 *       - Tasks
 *     summary: Get tasks assigned to current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's tasks
 *       401:
 *         description: Unauthorized
 */
router.get('/my-tasks', requireAuth, getMyTasks);

/**
 * @swagger
 * /api/v1/tasks/by-status:
 *   get:
 *     tags:
 *       - Tasks
 *     summary: Get tasks by status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, completed, blocked]
 *     responses:
 *       200:
 *         description: List of tasks filtered by status
 *       401:
 *         description: Unauthorized
 */
router.get('/by-status', requireAuth, getTasksByStatus);

/**
 * @swagger
 * /api/v1/tasks:
 *   post:
 *     tags:
 *       - Tasks
 *     summary: Create a new task
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - title
 *             properties:
 *               projectId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               assignedTo:
 *                 type: string
 *               priority:
 *                 type: number
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               estimatedHours:
 *                 type: number
 *     responses:
 *       200:
 *         description: Task created
 *       401:
 *         description: Unauthorized
 */
router.post('/', requireAuth, createTask);

/**
 * @swagger
 * /api/v1/tasks/{taskId}:
 *   get:
 *     tags:
 *       - Tasks
 *     summary: Get a task by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: taskId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task details
 *       404:
 *         description: Task not found
 */
router.get('/:taskId', requireAuth, getTask);

/**
 * @swagger
 * /api/v1/tasks/{taskId}:
 *   put:
 *     tags:
 *       - Tasks
 *     summary: Update a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: taskId
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed, blocked]
 *               assignedTo:
 *                 type: string
 *               priority:
 *                 type: number
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               estimatedHours:
 *                 type: number
 *               actualHours:
 *                 type: number
 *     responses:
 *       200:
 *         description: Task updated
 *       404:
 *         description: Task not found
 */
router.put('/:taskId', requireAuth, updateTask);

/**
 * @swagger
 * /api/v1/tasks/{taskId}:
 *   delete:
 *     tags:
 *       - Tasks
 *     summary: Delete a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: taskId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted
 *       404:
 *         description: Task not found
 */
router.delete('/:taskId', requireAuth, deleteTask);

export default router;

import { Router } from 'express';
import {
  addSkill,
  updateProficiency,
  getUserSkills,
  getTopUsersForSkill,
  getSkillDistribution,
  suggestUsersForTask,
} from '../controllers/skillGraph.controller';
import requireAuth from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/skills:
 *   post:
 *     tags:
 *       - SkillGraph
 *     summary: Add a new skill for a user
 *     description: |
 *       Adds a new skill entry for a user with initial proficiency level.
 *       Only administrators and managers can add skills.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - skill
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to add skill for
 *               skill:
 *                 type: string
 *                 description: Skill name (e.g., "JavaScript", "Python", "Project Management")
 *               initialProficiency:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 default: 1
 *                 description: Initial proficiency level (1-5)
 *     responses:
 *       200:
 *         description: Skill added successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin/Manager only
 *       500:
 *         description: Internal server error
 */
router.post('/', requireAuth, addSkill);

/**
 * @swagger
 * /api/v1/skills/{userId}/{skill}:
 *   put:
 *     tags:
 *       - SkillGraph
 *     summary: Update proficiency level for a user's skill
 *     description: |
 *       Updates the proficiency level for an existing user skill.
 *       Only administrators and managers can update skills.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - name: skill
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Skill name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - level
 *             properties:
 *               level:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: New proficiency level (1-5)
 *     responses:
 *       200:
 *         description: Proficiency updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin/Manager only
 *       500:
 *         description: Internal server error
 */
router.put('/:userId/:skill', requireAuth, updateProficiency);

/**
 * @swagger
 * /api/v1/skills/{userId}:
 *   get:
 *     tags:
 *       - SkillGraph
 *     summary: Get all skills for a user
 *     description: |
 *       Retrieves all skills and proficiency levels for a user.
 *       Users can view their own skills; admins and managers can view any user's skills.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to fetch skills for
 *     responses:
 *       200:
 *         description: Skills retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       skill:
 *                         type: string
 *                       proficiency:
 *                         type: integer
 *                         minimum: 1
 *                         maximum: 5
 *                       projectCount:
 *                         type: integer
 *                       lastUpdated:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/:userId', requireAuth, getUserSkills);

/**
 * @swagger
 * /api/v1/skills/top/{skill}:
 *   get:
 *     tags:
 *       - SkillGraph
 *     summary: Get top users for a specific skill
 *     description: |
 *       Returns the top users in the organization for a specific skill,
 *       ranked by proficiency level and project experience.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: skill
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Skill name to search for
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Top users retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/top/:skill', requireAuth, getTopUsersForSkill);

/**
 * @swagger
 * /api/v1/skills/distribution:
 *   get:
 *     tags:
 *       - SkillGraph
 *     summary: Get skill distribution across the organization
 *     description: |
 *       Returns statistics about skill distribution across all users in the organization.
 *       Only administrators and managers can access this endpoint.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Skill distribution retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       skill:
 *                         type: string
 *                       userCount:
 *                         type: integer
 *                       averageProficiency:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin/Manager only
 *       500:
 *         description: Internal server error
 */
router.get('/distribution', requireAuth, getSkillDistribution);

/**
 * @swagger
 * /api/v1/skills/suggest-users:
 *   post:
 *     tags:
 *       - SkillGraph
 *     summary: Suggest best users for a task based on required skills
 *     description: |
 *       Analyzes required skills for a task and suggests the best users
 *       based on proficiency levels and project experience.
 *       Returns users ranked by composite skill score.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requiredSkills
 *             properties:
 *               requiredSkills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of skills required for the task
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 5
 *                 description: Maximum number of suggestions to return
 *     responses:
 *       200:
 *         description: User suggestions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       skills:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             skill:
 *                               type: string
 *                             proficiency:
 *                               type: integer
 *                             projectCount:
 *                               type: integer
 *                             skillScore:
 *                               type: number
 *                       totalScore:
 *                         type: number
 *                       matchedSkills:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/suggest-users', requireAuth, suggestUsersForTask);

export default router;

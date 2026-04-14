import { Request, Response } from 'express';
import skillGraphService from '../../engines/skill-graph/skillGraph.service';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * POST /api/v1/skills
 * Add a new skill for a user (admin/manager only)
 */
export const addSkill = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { userId, skill, initialProficiency = 1 } = req.body;
    const userRole = (user as any).role;
    const organizationId = (user as any).organizationId;

    // Authorization: Only admins/managers can add skills
    if (userRole !== 'admin' && userRole !== 'manager') {
      return fail(res, 'Forbidden - Admin/Manager only', 'FORBIDDEN', 403);
    }

    if (!userId || !skill) {
      return fail(res, 'userId and skill are required', 'MISSING_PARAMS');
    }

    const skillEntry = await skillGraphService.addSkill(userId, organizationId, skill, initialProficiency);
    success(res, skillEntry);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to add skill', err?.code, err?.status || 500);
  }
};

/**
 * PUT /api/v1/skills/:userId/:skill
 * Update proficiency level for a user's skill (admin/manager only)
 */
export const updateProficiency = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { userId, skill } = req.params;
    const { level } = req.body;
    const userRole = (user as any).role;

    // Authorization: Only admins/managers can update skills
    if (userRole !== 'admin' && userRole !== 'manager') {
      return fail(res, 'Forbidden - Admin/Manager only', 'FORBIDDEN', 403);
    }

    if (level === undefined || level < 1 || level > 5) {
      return fail(res, 'level must be between 1 and 5', 'INVALID_LEVEL');
    }

    const skillEntry = await skillGraphService.updateProficiency(userId, skill, level);
    success(res, skillEntry);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to update proficiency', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/skills/:userId
 * Get all skills for a user (user can view own, admin/manager can view any)
 */
export const getUserSkills = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { userId } = req.params;
    const userRole = (user as any).role;

    // Authorization: Users can view own skills, admins/managers can view any
    if (user.id !== userId && userRole !== 'admin' && userRole !== 'manager') {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const skills = await skillGraphService.getUserSkills(userId);
    success(res, skills);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch user skills', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/skills/top/:skill
 * Get top users for a specific skill
 */
export const getTopUsersForSkill = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { skill } = req.params;
    const { limit = 10 } = req.query;
    const organizationId = (user as any).organizationId;

    const topUsers = await skillGraphService.getTopUsersForSkill(
      organizationId,
      skill,
      Math.min(parseInt(String(limit)) || 10, 50) // Max 50
    );
    success(res, topUsers);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch top users for skill', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/skills/distribution
 * Get skill distribution across the organization (admin/manager only)
 */
export const getSkillDistribution = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const userRole = (user as any).role;
    const organizationId = (user as any).organizationId;

    // Authorization: Only admins/managers can view skill distribution
    if (userRole !== 'admin' && userRole !== 'manager') {
      return fail(res, 'Forbidden - Admin/Manager only', 'FORBIDDEN', 403);
    }

    const distribution = await skillGraphService.getSkillDistribution(organizationId);
    success(res, distribution);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch skill distribution', err?.code, err?.status || 500);
  }
};

/**
 * POST /api/v1/skills/suggest-users
 * Suggest best users for a task based on required skills
 */
export const suggestUsersForTask = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { requiredSkills, limit = 5 } = req.body;
    const organizationId = (user as any).organizationId;

    if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      return fail(res, 'requiredSkills must be a non-empty array', 'INVALID_SKILLS');
    }

    const suggestions = await skillGraphService.suggestUsersForTask(
      organizationId,
      requiredSkills,
      Math.min(parseInt(String(limit)) || 5, 20) // Max 20
    );
    success(res, suggestions);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to suggest users for task', err?.code, err?.status || 500);
  }
};

export default {
  addSkill,
  updateProficiency,
  getUserSkills,
  getTopUsersForSkill,
  getSkillDistribution,
  suggestUsersForTask,
};
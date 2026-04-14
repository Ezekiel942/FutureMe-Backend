import { Request, Response, NextFunction } from 'express';
import * as ProjectModel from '../../database/models/Project.model';
import { logAction as auditLog } from '../../modules/audit/audit.service';

const success = (res: Response, data: unknown) => res.json({ success: true, data });

const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * List all projects for the organization
 */
export const listProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const organizationId = (req.user as any).organizationId;
    const projects = await ProjectModel.findProjectsByOrganization(organizationId);

    success(res, projects);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get a single project by ID
 */
export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.params;
    const project = await ProjectModel.findProjectById(projectId);

    if (!project) {
      return fail(res, 'Project not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (project.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    success(res, project);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Create a new project
 */
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { name, description, startDate, targetEndDate, budget, estimatedHours, teamSize } =
      req.body || {};

    if (!name) {
      return fail(res, 'Project name is required', 'MISSING_NAME', 400);
    }

    // Validate date fields if provided
    if (startDate && isNaN(new Date(startDate).getTime())) {
      return fail(res, 'Invalid startDate format', 'INVALID_START_DATE', 400);
    }
    if (targetEndDate && isNaN(new Date(targetEndDate).getTime())) {
      return fail(res, 'Invalid targetEndDate format', 'INVALID_END_DATE', 400);
    }

    const organizationId = (req.user as any).organizationId;
    const userId = req.user.id;

    const project = await ProjectModel.createProject({
      name,
      description,
      organizationId,
      ownerId: userId,
      startDate: startDate ? new Date(startDate) : undefined,
      targetEndDate: targetEndDate ? new Date(targetEndDate) : undefined,
      budget: budget || 0,
      estimatedHours: estimatedHours || 0,
      teamSize: teamSize || 1,
      teamMembers: [userId],
    });

    // Audit log
    try {
      await auditLog({
        userId,
        action: 'project_created',
        targetId: project.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}

    success(res, project);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update a project
 */
export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.params;
    const { name, description, status, startDate, targetEndDate, budget, estimatedHours } =
      req.body || {};

    const project = await ProjectModel.findProjectById(projectId);

    if (!project) {
      return fail(res, 'Project not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (project.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const updates: Partial<any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (startDate !== undefined) updates.startDate = new Date(startDate);
    if (targetEndDate !== undefined) updates.targetEndDate = new Date(targetEndDate);
    if (budget !== undefined) updates.budget = budget;
    if (estimatedHours !== undefined) updates.estimatedHours = estimatedHours;

    const updated = await ProjectModel.updateProject(projectId, updates);

    // Audit log
    try {
      await auditLog({
        userId: req.user.id,
        action: 'project_updated',
        targetId: projectId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}

    success(res, updated);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.params;
    const project = await ProjectModel.findProjectById(projectId);

    if (!project) {
      return fail(res, 'Project not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (project.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    await ProjectModel.deleteProject(projectId);

    // Audit log
    try {
      await auditLog({
        userId: req.user.id,
        action: 'project_deleted',
        targetId: projectId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}

    success(res, { id: projectId });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Add a team member to a project
 */
export const addTeamMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.params;
    const { userId } = req.body || {};

    if (!userId) {
      return fail(res, 'User ID is required', 'MISSING_USER_ID', 400);
    }

    const project = await ProjectModel.findProjectById(projectId);

    if (!project) {
      return fail(res, 'Project not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (project.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const updated = await ProjectModel.addTeamMember(projectId, userId);

    success(res, updated);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Remove a team member from a project
 */
export const removeTeamMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.params;
    const { userId } = req.body || {};

    if (!userId) {
      return fail(res, 'User ID is required', 'MISSING_USER_ID', 400);
    }

    const project = await ProjectModel.findProjectById(projectId);

    if (!project) {
      return fail(res, 'Project not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (project.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const updated = await ProjectModel.removeTeamMember(projectId, userId);

    success(res, updated);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get project metrics (tasks, hours, completion)
 */
export const getProjectMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.params;
    const project = await ProjectModel.findProjectById(projectId);

    if (!project) {
      return fail(res, 'Project not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (project.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const metrics = await ProjectModel.getProjectMetrics(projectId);
    success(res, metrics);
  } catch (error: any) {
    next(error);
  }
};

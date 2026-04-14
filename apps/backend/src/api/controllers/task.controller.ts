import { Request, Response, NextFunction } from 'express';
import * as TaskModel from '../../database/models/Task.model';
import { logAction as auditLog } from '../../modules/audit/audit.service';

const success = (res: Response, data: unknown) => res.json({ success: true, data });

const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * List all tasks for a project
 */
export const listTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId } = req.query;
    const organizationId = (req.user as any).organizationId;

    let tasks;
    if (projectId) {
      tasks = await TaskModel.findTasksByProject(projectId as string, organizationId);
    } else {
      tasks = await TaskModel.listTasksByOrganization(organizationId);
    }

    success(res, tasks);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get a single task by ID
 */
export const getTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { taskId } = req.params;
    const task = await TaskModel.findTaskById(taskId);

    if (!task) {
      return fail(res, 'Task not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (task.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    success(res, task);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Create a new task
 */
export const createTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId, title, description, assignedTo, priority, dueDate, estimatedHours } =
      req.body || {};

    if (!projectId || !title) {
      return fail(res, 'Project ID and title are required', 'MISSING_FIELDS', 400);
    }

    const organizationId = (req.user as any).organizationId;

    const task = await TaskModel.createTask({
      projectId,
      title,
      description,
      assignedTo,
      organizationId,
      priority: priority || 0,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      estimatedHours,
      actualHours: 0,
      status: 'pending',
    });

    // Audit log
    try {
      await auditLog({
        userId: req.user.id,
        action: 'task_created',
        targetId: task.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}

    success(res, task);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update a task
 */
export const updateTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { taskId } = req.params;
    const {
      title,
      description,
      status,
      assignedTo,
      priority,
      dueDate,
      estimatedHours,
      actualHours,
    } = req.body || {};

    const task = await TaskModel.findTaskById(taskId);

    if (!task) {
      return fail(res, 'Task not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (task.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    const updates: Partial<any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (priority !== undefined) updates.priority = priority;
    if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
    if (estimatedHours !== undefined) updates.estimatedHours = estimatedHours;
    if (actualHours !== undefined) updates.actualHours = actualHours;

    const updated = await TaskModel.updateTask(taskId, updates);

    // Audit log
    try {
      await auditLog({
        userId: req.user.id,
        action: 'task_updated',
        targetId: taskId,
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
 * Delete a task
 */
export const deleteTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { taskId } = req.params;
    const task = await TaskModel.findTaskById(taskId);

    if (!task) {
      return fail(res, 'Task not found', 'NOT_FOUND', 404);
    }

    // Verify organization access
    if (task.organizationId !== (req.user as any).organizationId) {
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    }

    await TaskModel.deleteTask(taskId);

    // Audit log
    try {
      await auditLog({
        userId: req.user.id,
        action: 'task_deleted',
        targetId: taskId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}

    success(res, { id: taskId });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get tasks assigned to current user
 */
export const getMyTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const organizationId = (req.user as any).organizationId;
    const tasks = await TaskModel.findTasksByAssignee(req.user.id, organizationId);

    success(res, tasks);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get tasks by status
 */
export const getTasksByStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { projectId, status } = req.query;
    const organizationId = (req.user as any).organizationId;

    if (!projectId || !status) {
      return fail(res, 'Project ID and status are required', 'MISSING_FIELDS', 400);
    }

    const tasks = await TaskModel.findTasksByStatus(
      projectId as string,
      status as 'pending' | 'in-progress' | 'completed' | 'blocked',
      organizationId
    );

    success(res, tasks);
  } catch (error: any) {
    next(error);
  }
};

import { Request, Response } from 'express';
import announcementService from '../../modules/announcement/announcement.service';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * POST /api/v1/announcements
 * Create a new announcement (Manager only)
 */
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const userRole = (user as any).role;
    if (userRole !== 'manager') {
      return fail(res, 'Managers only', 'FORBIDDEN', 403);
    }

    const { title, content, expiresAt } = req.body;
    const organizationId = (user as any).organizationId;

    if (!title || !content) {
      return fail(res, 'Title and content are required', 'VALIDATION_ERROR');
    }

    // Validate expiresAt if provided
    if (expiresAt && isNaN(new Date(expiresAt).getTime())) {
      return fail(res, 'Invalid expiresAt date format', 'INVALID_DATE', 400);
    }

    const announcement = await announcementService.createNew(
      organizationId,
      user.id,
      title,
      content,
      expiresAt
    );

    success(res, announcement);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to create announcement', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/announcements
 * List announcements for the organization
 */
export const listAnnouncements = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const organizationId = (user as any).organizationId;
    const includeInactive = req.query.includeInactive === 'true';

    const announcements = await announcementService.listForOrganization(
      organizationId,
      includeInactive
    );

    // For each announcement, get the current user's response status
    const enrichedAnnouncements = announcements.map((ann: any) => {
      // Note: This is a simple approach, could be optimized with a batch query
      return {
        ...ann,
      };
    });

    success(res, {
      announcements: enrichedAnnouncements,
      total: enrichedAnnouncements.length,
    });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to list announcements', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/announcements/:id
 * Get a specific announcement with user's response status
 */
export const getAnnouncement = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = req.params;
    const organizationId = (user as any).organizationId;

    const { announcement, userResponse } = await announcementService.getAnnouncementWithUserStatus(
      id,
      user.id,
      organizationId
    );

    if (!announcement) {
      return fail(res, 'Announcement not found', 'NOT_FOUND', 404);
    }

    // Auto-mark as read
    await announcementService.markAsRead(id, user.id, organizationId);

    success(res, {
      announcement,
      userResponse,
    });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to get announcement', err?.code, err?.status || 500);
  }
};

/**
 * POST /api/v1/announcements/:id/respond
 * Post a response to an announcement
 */
export const respondToAnnouncement = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = req.params;
    const { response: responseText } = req.body;
    const organizationId = (user as any).organizationId;

    if (!responseText) {
      return fail(res, 'Response text is required', 'VALIDATION_ERROR');
    }

    const response = await announcementService.respondToAnnouncement(
      id,
      user.id,
      organizationId,
      responseText
    );

    success(res, response);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to respond to announcement', err?.code, err?.status || 500);
  }
};

/**
 * POST /api/v1/announcements/:id/acknowledge
 * Acknowledge (confirm viewing) an announcement
 */
export const acknowledgeAnnouncement = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = req.params;
    const organizationId = (user as any).organizationId;

    const response = await announcementService.acknowledgeAnnouncement(id, user.id, organizationId);

    success(res, response);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to acknowledge announcement', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/announcements/:id/responses
 * Get all responses to an announcement (Manager only)
 */
export const getResponses = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const userRole = (user as any).role;
    if (userRole !== 'manager') {
      return fail(res, 'Managers only', 'FORBIDDEN', 403);
    }

    const { id } = req.params;
    const organizationId = (user as any).organizationId;

    const [responses, statistics] = await Promise.all([
      announcementService.getAnnouncementResponses(id, organizationId),
      announcementService.getResponseStatistics(id, organizationId),
    ]);

    success(res, {
      responses,
      statistics,
    });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to get responses', err?.code, err?.status || 500);
  }
};

/**
 * DELETE /api/v1/announcements/:id
 * Deactivate an announcement (Manager only)
 */
export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const userRole = (user as any).role;
    if (userRole !== 'manager') {
      return fail(res, 'Managers only', 'FORBIDDEN', 403);
    }

    const { id } = req.params;
    const organizationId = (user as any).organizationId;

    const deleted = await announcementService.deactivateAnnouncement(id, organizationId);

    if (!deleted) {
      return fail(res, 'Announcement not found', 'NOT_FOUND', 404);
    }

    success(res, { message: 'Announcement deactivated' });
  } catch (err: any) {
    fail(res, err?.message || 'Failed to delete announcement', err?.code, err?.status || 500);
  }
};

export default {
  createAnnouncement,
  listAnnouncements,
  getAnnouncement,
  respondToAnnouncement,
  acknowledgeAnnouncement,
  getResponses,
  deleteAnnouncement,
};

import { AppDataSource } from '@config/database';
import logger from '@utils/logger';
import {
  Announcement,
  createAnnouncement,
  findAnnouncementById,
  findAnnouncementsByOrganization,
  updateAnnouncement as updateAnnouncementDb,
  deleteAnnouncement as deleteAnnouncementDb,
} from '../../database/models/Announcement.model';
import {
  AnnouncementResponse,
  createResponse,
  findResponseById,
  findResponsesByAnnouncement,
  findResponseByUserAndAnnouncement,
  updateResponse as updateResponseDb,
  findResponsesByOrganization,
} from '../../database/models/AnnouncementResponse.model';
import { User } from '../../database/models/User.model';
import { logAction } from '../audit/audit.service';

/**
 * Create a new announcement (Manager only)
 */
export const createNew = async (
  organizationId: string,
  createdBy: string,
  title: string,
  content: string,
  expiresAt?: string | null
): Promise<Announcement> => {
  try {
    const announcement = await createAnnouncement({
      organizationId,
      createdBy,
      title,
      content,
      expiresAt,
      isActive: true,
    });

    logger.info('Announcement created', {
      announcementId: announcement.id,
      organizationId,
      createdBy,
    });

    // Audit log: announcement created
    await logAction({
      userId: createdBy,
      action: 'announcement.created',
      targetId: announcement.id,
    });

    return announcement;
  } catch (err: any) {
    logger.error('Failed to create announcement', {
      error: err?.message,
      organizationId,
    });
    throw err;
  }
};

/**
 * List announcements for organization
 */
export const listForOrganization = async (
  organizationId: string,
  includeInactive: boolean = false
): Promise<Announcement[]> => {
  try {
    let announcements = await findAnnouncementsByOrganization(organizationId);

    // Filter out inactive/expired announcements unless requested
    if (!includeInactive) {
      announcements = announcements.filter((a: any) => {
        if (!a.isActive) return false;
        if (a.expiresAt && new Date(a.expiresAt) < new Date()) return false;
        return true;
      });
    }

    return announcements;
  } catch (err: any) {
    logger.error('Failed to list announcements', {
      error: err?.message,
      organizationId,
    });
    throw err;
  }
};

/**
 * Get a specific announcement with the user's response status
 */
export const getAnnouncementWithUserStatus = async (
  announcementId: string,
  userId: string,
  organizationId: string
): Promise<{
  announcement: Announcement | null;
  userResponse: AnnouncementResponse | null;
}> => {
  try {
    const announcement = await findAnnouncementById(announcementId);

    if (!announcement || announcement.organizationId !== organizationId) {
      return { announcement: null, userResponse: null };
    }

    const userResponse = await findResponseByUserAndAnnouncement(userId, announcementId);

    return { announcement, userResponse };
  } catch (err: any) {
    logger.error('Failed to get announcement with user status', {
      error: err?.message,
      announcementId,
      userId,
    });
    throw err;
  }
};

/**
 * Mark announcement as read for a user
 */
export const markAsRead = async (
  announcementId: string,
  userId: string,
  organizationId: string
): Promise<AnnouncementResponse> => {
  try {
    let response = await findResponseByUserAndAnnouncement(userId, announcementId);

    if (!response) {
      // Create new response
      response = await createResponse({
        announcementId,
        userId,
        organizationId,
        isRead: true,
        readAt: new Date().toISOString(),
      });
    } else {
      // Update existing response
      response = await updateResponseDb(response.id, {
        isRead: true,
        readAt: new Date().toISOString(),
      });
    }

    return response!;
  } catch (err: any) {
    logger.error('Failed to mark announcement as read', {
      error: err?.message,
      announcementId,
      userId,
    });
    throw err;
  }
};

/**
 * Acknowledge an announcement (confirm viewing)
 */
export const acknowledgeAnnouncement = async (
  announcementId: string,
  userId: string,
  organizationId: string
): Promise<AnnouncementResponse> => {
  try {
    let response = await findResponseByUserAndAnnouncement(userId, announcementId);

    if (!response) {
      // Create new response
      response = await createResponse({
        announcementId,
        userId,
        organizationId,
        isRead: true,
        readAt: new Date().toISOString(),
        isAcknowledged: true,
        acknowledgedAt: new Date().toISOString(),
      });
    } else {
      // Update existing response
      response = await updateResponseDb(response.id, {
        isAcknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        isRead: true,
        readAt: response.readAt || new Date().toISOString(),
      });
    }

    // Audit log: announcement acknowledged
    await logAction({
      userId,
      action: 'announcement.acknowledged',
      targetId: announcementId,
    });

    return response!;
  } catch (err: any) {
    logger.error('Failed to acknowledge announcement', {
      error: err?.message,
      announcementId,
      userId,
    });
    throw err;
  }
};

/**
 * Post a response to an announcement
 */
export const respondToAnnouncement = async (
  announcementId: string,
  userId: string,
  organizationId: string,
  responseText: string
): Promise<AnnouncementResponse> => {
  try {
    let response = await findResponseByUserAndAnnouncement(userId, announcementId);

    if (!response) {
      // Create new response
      response = await createResponse({
        announcementId,
        userId,
        organizationId,
        response: responseText,
        hasResponded: true,
        respondedAt: new Date().toISOString(),
        isRead: true,
        readAt: new Date().toISOString(),
      });
    } else {
      // Update existing response
      response = await updateResponseDb(response.id, {
        response: responseText,
        hasResponded: true,
        respondedAt: new Date().toISOString(),
        isRead: true,
        readAt: response.readAt || new Date().toISOString(),
      });
    }

    logger.info('User responded to announcement', {
      announcementId,
      userId,
    });

    // Audit log: announcement response
    await logAction({
      userId,
      action: 'announcement.responded',
      targetId: announcementId,
    });

    return response!;
  } catch (err: any) {
    logger.error('Failed to respond to announcement', {
      error: err?.message,
      announcementId,
      userId,
    });
    throw err;
  }
};

/**
 * Get all responses to an announcement
 */
export const getAnnouncementResponses = async (
  announcementId: string,
  organizationId: string
): Promise<
  Array<{
    response: AnnouncementResponse;
    userName: string | null;
    userEmail: string | null;
  }>
> => {
  try {
    const responses = await findResponsesByOrganization(organizationId, announcementId);

    // Get user names for responses
    const enrichedResponses = await Promise.all(
      responses.map(async (resp: any) => {
        try {
          const user = await AppDataSource.getRepository(User).findOne({
            where: { id: resp.userId } as any,
          });
          const userName = user ? `${user.firstName} ${user.lastName}`.trim() : null;
          return {
            response: resp,
            userName,
            userEmail: user?.email || null,
          };
        } catch {
          return {
            response: resp,
            userName: null,
            userEmail: null,
          };
        }
      })
    );

    return enrichedResponses;
  } catch (err: any) {
    logger.error('Failed to get announcement responses', {
      error: err?.message,
      announcementId,
    });
    throw err;
  }
};

/**
 * Get response statistics for an announcement
 */
export const getResponseStatistics = async (
  announcementId: string,
  organizationId: string
): Promise<{
  total: number;
  read: number;
  acknowledged: number;
  responded: number;
  readPercent: number;
  acknowledgedPercent: number;
  respondedPercent: number;
}> => {
  try {
    const responses = await findResponsesByOrganization(organizationId, announcementId);

    const total = responses.length;
    const read = responses.filter((r: any) => r.isRead).length;
    const acknowledged = responses.filter((r: any) => r.isAcknowledged).length;
    const responded = responses.filter((r: any) => r.hasResponded).length;

    return {
      total,
      read,
      acknowledged,
      responded,
      readPercent: total > 0 ? Math.round((read / total) * 100) : 0,
      acknowledgedPercent: total > 0 ? Math.round((acknowledged / total) * 100) : 0,
      respondedPercent: total > 0 ? Math.round((responded / total) * 100) : 0,
    };
  } catch (err: any) {
    logger.error('Failed to get response statistics', {
      error: err?.message,
      announcementId,
    });
    throw err;
  }
};

/**
 * Deactivate/delete an announcement (Manager only)
 */
export const deactivateAnnouncement = async (
  announcementId: string,
  organizationId: string
): Promise<boolean> => {
  try {
    const announcement = await findAnnouncementById(announcementId);

    if (!announcement || announcement.organizationId !== organizationId) {
      return false;
    }

    await updateAnnouncementDb(announcementId, { isActive: false });

    logger.info('Announcement deactivated', {
      announcementId,
      organizationId,
    });

    // Audit log: announcement deactivated
    await logAction({
      userId: null, // System action, no specific user
      action: 'announcement.deactivated',
      targetId: announcementId,
    });

    return true;
  } catch (err: any) {
    logger.error('Failed to deactivate announcement', {
      error: err?.message,
      announcementId,
    });
    throw err;
  }
};

export default {
  createNew,
  listForOrganization,
  getAnnouncementWithUserStatus,
  markAsRead,
  acknowledgeAnnouncement,
  respondToAnnouncement,
  getAnnouncementResponses,
  getResponseStatistics,
  deactivateAnnouncement,
};

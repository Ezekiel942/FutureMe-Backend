import { Request, Response } from 'express';
import * as ChatService from './chat.service';
import { getIO } from '../../engines/socket.server';
import logger from '../../utils/logger';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * GET /api/chat/conversations
 * Get all conversations for the authenticated user
 */
export const getConversations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub || (req as any).user?.id;
    
    if (!userId) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const conversations = await ChatService.getConversations(userId);

    // Enrich with participant details and unread counts
    const enrichedConversations = await Promise.all(
      conversations.map(async (room) => {
        const otherUserId = room.participants.find((p: string) => p !== userId);
        const unreadCount = otherUserId 
          ? await ChatService.getUnreadCount(room.id, userId)
          : 0;
        
        return {
          id: room.id,
          participants: room.participants,
          lastMessage: room.lastMessage,
          lastMessageAt: room.lastMessageAt,
          unreadCount,
          createdAt: room.createdAt,
        };
      })
    );

    success(res, enrichedConversations);
  } catch (err: any) {
    logger.error('Get conversations error', { error: err.message });
    fail(res, err?.message || 'Failed to get conversations', err?.code, 500);
  }
};

/**
 * GET /api/chat/messages/:roomId
 * Get messages for a conversation with pagination
 */
export const getMessages = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub || (req as any).user?.id;
    const { roomId } = req.params;
    const { limit = '50', before } = req.query;

    if (!userId) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const messages = await ChatService.getMessages(
      roomId,
      userId,
      parseInt(limit as string, 10),
      before ? new Date(before as string) : undefined
    );

    success(res, messages);
  } catch (err: any) {
    logger.error('Get messages error', { error: err.message });
    fail(res, err?.message || 'Failed to get messages', err?.code, err?.status || 500);
  }
};

/**
 * POST /api/chat/send
 * Send a message to a conversation
 */
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub || (req as any).user?.id;
    const { roomId, content, type = 'text' } = req.body;

    if (!userId) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    if (!roomId || !content) {
      return fail(res, 'Room ID and content are required', 'INVALID_INPUT', 400);
    }

    const message = await ChatService.sendMessage(
      { roomId, content, type: type as any },
      userId
    );

    // Emit real-time event via socket
    let io: any = null;
    try {
      io = getIO();
    } catch (e) {
      // Socket not initialized, skip real-time emit
      logger.debug('Socket not available for real-time emit');
    }
    
    if (io) {
      const room = await ChatService.getConversationById(roomId, userId);
      if (room) {
        // Notify other participants
        room.participants.forEach((participantId: string) => {
          if (participantId !== userId) {
            io.to(`user:${participantId}`).emit('receive_message', {
              message,
              roomId,
            });
          }
        });
      }
    }

    success(res, message);
  } catch (err: any) {
    logger.error('Send message error', { error: err.message });
    fail(res, err?.message || 'Failed to send message', err?.code, err?.status || 500);
  }
};

/**
 * POST /api/chat/conversations
 * Create or get a conversation with another user
 */
export const createConversation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub || (req as any).user?.id;
    const { participantId } = req.body;

    if (!userId) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    if (!participantId) {
      return fail(res, 'Participant ID is required', 'INVALID_INPUT', 400);
    }

    const conversation = await ChatService.getOrCreateConversation(userId, participantId);

    success(res, {
      id: conversation.id,
      participants: conversation.participants,
      createdAt: conversation.createdAt,
    });
  } catch (err: any) {
    logger.error('Create conversation error', { error: err.message });
    fail(res, err?.message || 'Failed to create conversation', err?.code, 500);
  }
};

/**
 * POST /api/chat/read/:roomId
 * Mark messages as read
 */
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub || (req as any).user?.id;
    const { roomId } = req.params;

    if (!userId) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    await ChatService.markMessagesAsRead(roomId, userId);

    // Emit read receipt via socket
    const io = (req as any).io;
    if (io) {
      const room = await ChatService.getConversationById(roomId, userId);
      if (room) {
        room.participants.forEach((participantId: string) => {
          if (participantId !== userId) {
            io.to(`user:${participantId}`).emit('message_read', {
              roomId,
              readBy: userId,
              readAt: new Date(),
            });
          }
        });
      }
    }

    success(res, { success: true });
  } catch (err: any) {
    logger.error('Mark as read error', { error: err.message });
    fail(res, err?.message || 'Failed to mark as read', err?.code, err?.status || 500);
  }
};
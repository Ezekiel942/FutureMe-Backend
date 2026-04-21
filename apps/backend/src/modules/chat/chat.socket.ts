import { Server, Socket } from 'socket.io';
import logger from '../../utils/logger';
import * as ChatService from './chat.service';

let io: Server | null = null;

/**
 * Initialize chat WebSocket handlers
 */
export const initializeChatSocket = (socketIO: Server) => {
  io = socketIO;

  io.on('connection', (socket: Socket) => {
    const userId = (socket.data as any)?.user?.sub || (socket.data as any)?.user?.id;
    
    if (!userId) {
      logger.warn('Chat socket: no user authenticated');
      return;
    }

    logger.info('Chat socket connected', { socketId: socket.id, userId });

    // Join user's personal room for direct messages
    socket.join(`user:${userId}`);

    /**
     * Send a message to a conversation
     * Payload: { roomId, content, type }
     */
    socket.on('send_message', async (payload: {
      roomId: string;
      content: string;
      type?: 'text' | 'image' | 'file';
    }) => {
      try {
        const { roomId, content, type = 'text' } = payload;

        if (!roomId || !content) {
          socket.emit('error', { message: 'Room ID and content are required' });
          return;
        }

        const message = await ChatService.sendMessage(
          { roomId, content, type: type as any },
          userId
        );

        // Get conversation to find participants
        const room = await ChatService.getConversationById(roomId, userId);
        
        if (room) {
          // Emit to all participants
          room.participants.forEach((participantId: string) => {
            io?.to(`user:${participantId}`).emit('receive_message', {
              message,
              roomId,
            });
          });
        }

        // Confirm to sender
        socket.emit('message_sent', { message });
      } catch (err: any) {
        logger.error('Chat send_message error', { error: err.message });
        socket.emit('error', { message: err.message || 'Failed to send message' });
      }
    });

    /**
     * Start typing indicator
     * Payload: { roomId }
     */
    socket.on('typing', async (payload: { roomId: string }) => {
      try {
        const { roomId } = payload;

        const room = await ChatService.getConversationById(roomId, userId);
        
        if (room) {
          room.participants.forEach((participantId: string) => {
            if (participantId !== userId) {
              io?.to(`user:${participantId}`).emit('user_typing', {
                roomId,
                userId,
                isTyping: true,
              });
            }
          });
        }
      } catch (err: any) {
        logger.error('Chat typing error', { error: err.message });
      }
    });

    /**
     * Stop typing indicator
     * Payload: { roomId }
     */
    socket.on('stop_typing', async (payload: { roomId: string }) => {
      try {
        const { roomId } = payload;

        const room = await ChatService.getConversationById(roomId, userId);
        
        if (room) {
          room.participants.forEach((participantId: string) => {
            if (participantId !== userId) {
              io?.to(`user:${participantId}`).emit('user_typing', {
                roomId,
                userId,
                isTyping: false,
              });
            }
          });
        }
      } catch (err: any) {
        logger.error('Chat stop_typing error', { error: err.message });
      }
    });

    /**
     * Mark messages as read
     * Payload: { roomId }
     */
    socket.on('mark_read', async (payload: { roomId: string }) => {
      try {
        const { roomId } = payload;

        await ChatService.markMessagesAsRead(roomId, userId);

        const room = await ChatService.getConversationById(roomId, userId);
        
        if (room) {
          room.participants.forEach((participantId: string) => {
            if (participantId !== userId) {
              io?.to(`user:${participantId}`).emit('message_read', {
                roomId,
                readBy: userId,
                readAt: new Date(),
              });
            }
          });
        }
      } catch (err: any) {
        logger.error('Chat mark_read error', { error: err.message });
      }
    });

    /**
     * Create or get a conversation
     * Payload: { participantId }
     */
    socket.on('create_conversation', async (payload: { participantId: string }) => {
      try {
        const { participantId } = payload;

        if (!participantId) {
          socket.emit('error', { message: 'Participant ID is required' });
          return;
        }

        const conversation = await ChatService.getOrCreateConversation(userId, participantId);

        socket.emit('conversation_created', {
          id: conversation.id,
          participants: conversation.participants,
          createdAt: conversation.createdAt,
        });
      } catch (err: any) {
        logger.error('Chat create_conversation error', { error: err.message });
        socket.emit('error', { message: err.message || 'Failed to create conversation' });
      }
    });

    /**
     * Get all conversations
     */
    socket.on('get_conversations', async () => {
      try {
        const conversations = await ChatService.getConversations(userId);
        socket.emit('conversations', { conversations });
      } catch (err: any) {
        logger.error('Chat get_conversations error', { error: err.message });
        socket.emit('error', { message: err.message || 'Failed to get conversations' });
      }
    });

    /**
     * Get messages for a conversation
     * Payload: { roomId, limit?, before? }
     */
    socket.on('get_messages', async (payload: {
      roomId: string;
      limit?: number;
      before?: string;
    }) => {
      try {
        const { roomId, limit = 50, before } = payload;

        const messages = await ChatService.getMessages(
          roomId,
          userId,
          limit,
          before ? new Date(before) : undefined
        );

        socket.emit('messages', { roomId, messages });
      } catch (err: any) {
        logger.error('Chat get_messages error', { error: err.message });
        socket.emit('error', { message: err.message || 'Failed to get messages' });
      }
    });

    socket.on('disconnect', () => {
      logger.info('Chat socket disconnected', { socketId: socket.id, userId });
    });
  });
};

/**
 * Get the Socket.IO instance for use in controllers
 */
export const getChatIO = () => io;
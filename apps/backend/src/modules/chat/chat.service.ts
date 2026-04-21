import { AppDataSource } from '@config/database';
import { ChatRoom } from '../../database/models/ChatRoom.model';
import { ChatMessage, MessageType } from '../../database/models/ChatMessage.model';
import logger from '../../utils/logger';

const roomRepository = () => AppDataSource.getRepository(ChatRoom);
const messageRepository = () => AppDataSource.getRepository(ChatMessage);

export interface SendMessageInput {
  roomId: string;
  content: string;
  type?: MessageType;
}

export interface CreateConversationInput {
  participantIds: string[];
}

/**
 * Get or create a conversation between two users
 */
export const getOrCreateConversation = async (userId1: string, userId2: string): Promise<ChatRoom> => {
  const repo = roomRepository();
  
  // Find existing conversation with both participants
  const allRooms = await repo.find() as ChatRoom[];
  const existing = allRooms.find(room => 
    room.participants && 
    room.participants.includes(userId1) && 
    room.participants.includes(userId2)
  );

  if (existing) {
    return existing;
  }

  // Create new conversation
  const newRoom = repo.create({
    participants: [userId1, userId2],
  });

  return await repo.save(newRoom);
};

/**
 * Get all conversations for a user
 */
export const getConversations = async (userId: string): Promise<ChatRoom[]> => {
  const repo = roomRepository();
  
  const allRooms = await repo.find() as ChatRoom[];
  return allRooms
    .filter(room => room.participants && room.participants.includes(userId))
    .sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA;
    });
};

/**
 * Get a single conversation by ID
 */
export const getConversationById = async (roomId: string, userId: string): Promise<ChatRoom | null> => {
  const repo = roomRepository();
  
  const room = await repo.findOne({ id: roomId } as any) as ChatRoom | null;

  if (!room || !room.participants || !room.participants.includes(userId)) {
    return null;
  }

  return room;
};

/**
 * Get messages for a conversation with pagination
 */
export const getMessages = async (
  roomId: string,
  userId: string,
  limit: number = 50,
  before?: Date
): Promise<ChatMessage[]> => {
  const repo = messageRepository();
  
  // Verify user is participant
  const room = await roomRepository().findOne({ id: roomId } as any) as ChatRoom | null;
  if (!room || !room.participants || !room.participants.includes(userId)) {
    throw new Error('Access denied');
  }

  // Get all messages for the room and filter/sort in memory
  const allMessages = await repo.find({ roomId } as any) as ChatMessage[];
  
  let filtered = allMessages
    .filter(msg => !before || new Date(msg.createdAt) < before)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return filtered.slice(0, limit);
};

/**
 * Send a message to a conversation
 */
export const sendMessage = async (input: SendMessageInput, senderId: string): Promise<ChatMessage> => {
  const { roomId, content, type = MessageType.TEXT } = input;
  
  const repo = messageRepository();
  const roomRepo = roomRepository();

  // Verify user is participant
  const room = await roomRepo.findOne({ id: roomId } as any) as ChatRoom | null;
  if (!room || !room.participants || !room.participants.includes(senderId)) {
    throw new Error('Access denied');
  }

  // Create message
  const message = repo.create({
    roomId,
    senderId,
    content,
    type,
  });

  const savedMessage = await repo.save(message) as ChatMessage;

  // Update room's last message
  await roomRepo.update(roomId, {
    lastMessageId: savedMessage.id,
    lastMessage: content.substring(0, 100),
    lastMessageAt: savedMessage.createdAt,
  });

  logger.info('Message sent', { messageId: savedMessage.id, roomId, senderId });

  return savedMessage;
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (roomId: string, userId: string): Promise<void> => {
  const repo = messageRepository();
  
  // Verify user is participant
  const room = await roomRepository().findOne({ id: roomId } as any) as ChatRoom | null;
  if (!room || !room.participants || !room.participants.includes(userId)) {
    throw new Error('Access denied');
  }

  // Get all unread messages from other users
  const allMessages = await repo.find({ roomId } as any) as ChatMessage[];
  const unreadMessages = allMessages.filter(
    msg => msg.senderId !== userId && !msg.isRead
  );

  // Mark each as read
  for (const msg of unreadMessages) {
    await repo.update(msg.id, { isRead: true, readAt: new Date() });
  }
};

/**
 * Get unread message count for a user
 */
export const getUnreadCount = async (roomId: string, userId: string): Promise<number> => {
  const repo = messageRepository();
  
  const allMessages = await repo.find({ roomId } as any) as ChatMessage[];
  return allMessages.filter(
    msg => msg.senderId !== userId && !msg.isRead
  ).length;
};
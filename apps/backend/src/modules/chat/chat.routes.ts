import { Router } from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  createConversation,
  markAsRead,
} from './chat.controller';
import requireAuth from '../../api/middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     tags:
 *       - Chat
 *     summary: Get all conversations for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 *       401:
 *         description: Unauthorized
 */
router.get('/conversations', requireAuth, getConversations);

/**
 * @swagger
 * /api/chat/conversations:
 *   post:
 *     tags:
 *       - Chat
 *     summary: Create or get a conversation with another user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversation created or retrieved
 *       401:
 *         description: Unauthorized
 */
router.post('/conversations', requireAuth, createConversation);

/**
 * @swagger
 * /api/chat/messages/:roomId:
 *   get:
 *     tags:
 *       - Chat
 *     summary: Get messages for a conversation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: List of messages
 *       401:
 *         description: Unauthorized
 */
router.get('/messages/:roomId', requireAuth, getMessages);

/**
 * @swagger
 * /api/chat/send:
 *   post:
 *     tags:
 *       - Chat
 *     summary: Send a message to a conversation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, image, file]
 *     responses:
 *       200:
 *         description: Message sent
 *       401:
 *         description: Unauthorized
 */
router.post('/send', requireAuth, sendMessage);

/**
 * @swagger
 * /api/chat/read/:roomId:
 *   post:
 *     tags:
 *       - Chat
 *     summary: Mark messages as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 *       401:
 *         description: Unauthorized
 */
router.post('/read/:roomId', requireAuth, markAsRead);

export default router;
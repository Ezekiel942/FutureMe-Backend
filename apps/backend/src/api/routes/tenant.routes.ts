import { Router } from 'express';
import requireAuth from '../middlewares/auth.middleware';
import {
  getTenantRules,
  updateTenantRules,
  resetTenantRules,
} from '../controllers/tenant.controller';

const router = Router();

/**
 * @swagger
 * /api/v1/tenant/rules:
 *   get:
 *     tags:
 *       - Tenant
 *     summary: Get tenant session rules
 *     description: Retrieve meeting rules configuration for the logged-in organization.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant rules retrieved successfully
 */
router.get('/rules', requireAuth, getTenantRules);

/**
 * @swagger
 * /api/v1/tenant/rules:
 *   put:
 *     tags:
 *       - Tenant
 *     summary: Update tenant session rules
 *     description: Update tenant-specific session rules like minimum duration, idle timeout, and overtime thresholds.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Tenant rule configuration payload
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minSessionLength:
 *                 type: number
 *               maxDailyHours:
 *                 type: number
 *               idleTimeout:
 *                 type: number
 *               overtimeThreshold:
 *                 type: number
 *     responses:
 *       200:
 *         description: Tenant rules updated successfully
 */
router.put('/rules', requireAuth, updateTenantRules);

/**
 * @swagger
 * /api/v1/tenant/rules/reset:
 *   post:
 *     tags:
 *       - Tenant
 *     summary: Reset tenant rules to defaults
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant rules reset to defaults
 */
router.post('/rules/reset', requireAuth, resetTenantRules);

export default router;

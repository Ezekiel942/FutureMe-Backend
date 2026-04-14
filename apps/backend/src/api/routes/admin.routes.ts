import { Router } from 'express';
import { getAuditLogs, getAdminSessions } from '../controllers/admin.controller';
import requireAuth from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/audit-logs', requireAuth, requireAdmin, getAuditLogs);
router.get('/sessions', requireAuth, requireAdmin, getAdminSessions);

export default router;

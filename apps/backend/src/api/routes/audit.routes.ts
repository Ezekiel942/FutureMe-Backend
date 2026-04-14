import { Router } from 'express';
import { queryAudit, getAuditLog } from '../controllers/audit.controller';
import requireAuth from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, queryAudit);
router.get('/:id', requireAuth, getAuditLog);

export default router;

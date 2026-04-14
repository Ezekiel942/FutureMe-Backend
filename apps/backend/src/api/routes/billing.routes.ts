import { Router } from 'express';
import {
  getBillingOverview,
  upgradePlan,
  cancelSubscription,
} from '../controllers/billing.controller';
import requireAuth from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, getBillingOverview);
router.post('/upgrade', requireAuth, upgradePlan);
router.post('/cancel', requireAuth, cancelSubscription);

export default router;
